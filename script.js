
// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================

const SUPABASE_URL = "https://yovtbbbihdmctbyyestc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdnRiYmJpaGRtY3RieXllc3RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwMDQ1NjQsImV4cCI6MjEwOTU4MDU2NH0.unTJHNPJJTdiRgR9QWqeu3bJ2_2Nc6psy95XjITVx80";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ==========================================
// VARIÁVEIS
// ==========================================

let products = [];
let cart = [];
let currentCategory = "Todos";

const money = value =>
  Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

// ==========================================
// CARREGAR PRODUTOS DO SUPABASE
// ==========================================

async function loadProducts() {
  const container = document.getElementById("products");

  try {
    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    products = data || [];
    renderProducts();

  } catch (error) {
    console.error("Erro ao carregar produtos:", error);
    container.innerHTML =
      "<p class='loading'>Não foi possível carregar os produtos. Verifique a conexão com o banco de dados.</p>";
  }
}

// ==========================================
// MOSTRAR PRODUTOS
// ==========================================

function renderProducts() {
  const container = document.getElementById("products");

  const filtered = currentCategory === "Todos"
    ? products
    : products.filter(p => p.category === currentCategory);

  if (!filtered.length) {
    container.innerHTML =
      "<p class='loading'>Nenhum produto encontrado nesta categoria.</p>";
    return;
  }

  container.innerHTML = filtered.map(product => `
    <article class="product-card">
      <img
        src="${escapeHTML(product.image_url || '')}"
        alt="${escapeHTML(product.name)}"
        loading="lazy"
        onerror="this.src='https://placehold.co/400x500/fff0f5/d66d96?text=Pink+Boutique'"
      >

      <div class="product-info">
        <span class="product-category">
          ${escapeHTML(product.category)}
        </span>

        <h3>${escapeHTML(product.name)}</h3>

        <p class="product-description">
          ${escapeHTML(product.description || "")}
        </p>

        <div class="product-price">
          ${money(product.price)}
        </div>

        <button
          class="add-button"
          onclick="addToCart('${product.id}')"
          ${product.stock < 1 ? "disabled" : ""}
        >
          ${product.stock < 1 ? "Esgotado" : "Adicionar à sacola"}
        </button>
      </div>
    </article>
  `).join("");
}

// ==========================================
// FILTROS
// ==========================================

function filterProducts(category, button) {
  currentCategory = category;

  document.querySelectorAll(".category").forEach(el => {
    el.classList.remove("active");
  });

  button.classList.add("active");
  renderProducts();
}

// ==========================================
// CARRINHO
// ==========================================

function addToCart(productId) {
  const product = products.find(p => p.id === productId);

  if (!product || product.stock < 1) return;

  const item = cart.find(i => i.id === productId);

  if (item) {
    if (item.quantity >= product.stock) {
      alert("Quantidade máxima disponível em estoque.");
      return;
    }

    item.quantity++;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: 1,
      stock: product.stock
    });
  }

  updateCart();
}

function changeQuantity(productId, amount) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  const newQuantity = item.quantity + amount;

  if (newQuantity > item.stock) {
    alert("Quantidade máxima disponível em estoque.");
    return;
  }

  item.quantity = newQuantity;

  if (item.quantity <= 0) {
    cart = cart.filter(i => i.id !== productId);
  }

  updateCart();
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.id !== productId);
  updateCart();
}

function updateCart() {
  const container = document.getElementById("cart-items");

  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity, 0
  );

  document.getElementById("cart-count").textContent = count;
  document.getElementById("cart-total").textContent = money(total);

  if (!cart.length) {
    container.innerHTML =
      "<p class='empty-cart'>Sua sacola está vazia. ♡</p>";
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div>
        <h4>${escapeHTML(item.name)}</h4>
        <p>${money(item.price)}</p>

        <div class="quantity-controls">
          <button onclick="changeQuantity('${item.id}', -1)">−</button>
          <span>${item.quantity}</span>
          <button onclick="changeQuantity('${item.id}', 1)">+</button>
        </div>
      </div>

      <button onclick="removeFromCart('${item.id}')">
        Remover
      </button>
    </div>
  `).join("");
}

function toggleCart() {
  document.getElementById("cart").classList.toggle("open");
  document.getElementById("cart-overlay").classList.toggle("show");
}

// ==========================================
// CHECKOUT
// ==========================================

function openCheckout() {
  if (!cart.length) {
    alert("Adicione produtos à sacola antes de finalizar.");
    return;
  }

  toggleCart();
  document.getElementById("checkout-modal").classList.add("show");
}

function closeCheckout() {
  document.getElementById("checkout-modal").classList.remove("show");
}

// ==========================================
// PROTEÇÃO CONTRA HTML INJETADO
// ==========================================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

// ==========================================
// REGISTRAR PEDIDO NO SUPABASE
// ==========================================

document.getElementById("checkout-form").addEventListener(
  "submit",
  async function(event) {
    event.preventDefault();

    if (!cart.length) return;

    const button = this.querySelector("button[type='submit']");
    const message = document.getElementById("checkout-message");

    button.disabled = true;
    button.textContent = "Registrando pedido...";
    message.textContent = "";

    const customer = {
      name: document.getElementById("customer-name").value.trim(),
      email: document.getElementById("customer-email").value.trim(),
      phone: document.getElementById("customer-phone").value.trim(),
      address: document.getElementById("customer-address").value.trim()
    };

    const items = cart.map(item => ({
      product_id: item.id,
      quantity: item.quantity
    }));

    try {
      const { data, error } = await supabaseClient.rpc(
        "place_order",
        {
          p_customer: customer,
          p_items: items
        }
      );

      if (error) throw error;

      message.style.color = "green";
      message.textContent =
        "Pedido registrado com sucesso! Número: " + data;

      cart = [];
      updateCart();
      loadProducts();

      this.reset();

      setTimeout(() => {
        closeCheckout();
        message.textContent = "";
      }, 4000);

    } catch (error) {
      console.error("Erro ao registrar pedido:", error);

      message.style.color = "#c44";
      message.textContent =
        error.message || "Não foi possível registrar seu pedido.";

    } finally {
      button.disabled = false;
      button.textContent = "Confirmar pedido";
    }
  }
);

// ==========================================
// INICIALIZAÇÃO
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  updateCart();
});
