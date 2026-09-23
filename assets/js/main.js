let products = [
  { id: "abeni-maxi-dress", name: "Abeni Maxi Dress", category: "Dresses", price: 85000, displayPrice: "₦85,000", description: "Flowing rust print maxi dress with a refined African silhouette.", image: "assets/images/product-abeni-1.jpg", sizes: ["S", "M", "L", "XL"], colours: ["Rust Print", "Black", "Olive"], url: "product.html?slug=abeni-maxi-dress" },
  { id: "tunde-kaftan", name: "Tunde Kaftan", category: "Kaftans", price: 75000, displayPrice: "₦75,000", description: "Elegant black kaftan cut for ease, movement and occasion dressing.", image: "", sizes: ["S", "M", "L", "XL"], colours: ["Black", "Sand"], url: "product.html?slug=tunde-kaftan" },
  { id: "ife-blazer-set", name: "Ife Blazer Set", category: "Sets", price: 120000, displayPrice: "₦120,000", description: "Structured set with a contemporary finish for the modern woman.", image: "", sizes: ["S", "M", "L"], colours: ["Terracotta", "Ivory"], url: "product.html?slug=ife-blazer-set" },
  { id: "zuri-shirt-set", name: "Zuri Shirt Set", category: "Sets", price: 95000, displayPrice: "₦95,000", description: "Relaxed shirt set with warm textile-inspired styling.", image: "", sizes: ["S", "M", "L", "XL"], colours: ["Espresso", "Clay"], url: "product.html?slug=zuri-shirt-set" },
  { id: "kele-shirt", name: "Kele Shirt", category: "Tops", price: 48000, displayPrice: "₦48,000", description: "Clean ivory shirt with subtle detailing and everyday polish.", image: "", sizes: ["S", "M", "L", "XL"], colours: ["Ivory", "Black"], url: "product.html?slug=kele-shirt" },
  { id: "sade-set", name: "Sade Set", category: "Sets", price: 76000, displayPrice: "₦76,000", description: "Versatile two-piece set with deep tones and soft structure.", image: "", sizes: ["S", "M", "L"], colours: ["Espresso", "Burnt Orange"], url: "product.html?slug=sade-set" },
  { id: "brass-drop-earrings", name: "Brass Drop Earrings", category: "Accessories", price: 32000, displayPrice: "₦32,000", description: "Sculptural brass earrings for finishing a Cossirae look.", image: "", sizes: [], colours: ["Gold", "Bronze"], url: "product.html?slug=brass-drop-earrings" }
];

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
const storage = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

const findProduct = (id) => products.find((product) => product.id === id) || products[0];
const config = window.COSSIRAE_CONFIG || {};
const hasSupabaseConfig = Boolean(config.supabaseUrl && config.supabaseAnonKey && !config.supabaseUrl.includes("YOUR_"));
const hasPaystackConfig = Boolean(config.paystackPublicKey && !config.paystackPublicKey.includes("YOUR_"));
const cossiraeSupabase = hasSupabaseConfig && window.supabase
  ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
  : null;
let currentCustomer = null;

function mapProductRow(row) {
  return {
    id: row.slug,
    name: row.name,
    category: row.category,
    price: row.price_ngn,
    displayPrice: naira.format(row.price_ngn),
    description: row.description || "",
    image: row.image_urls?.[0] || "",
    videos: row.video_urls || [],
    sizes: row.sizes || [],
    colours: row.colours || [],
    fabricAndCare: row.fabric_and_care || "",
    url: `product.html?slug=${row.slug}`
  };
}

function getAdminProducts() {
  return storage.get("cossirae_admin_products", []).filter((product) => product.isActive !== false);
}

function mergeAdminProducts() {
  const localProducts = getAdminProducts();
  localProducts.forEach((product) => {
    const mapped = {
      id: product.slug,
      name: product.name,
      category: product.category,
      price: Number(product.price || 0),
      displayPrice: naira.format(Number(product.price || 0)),
      description: product.description || "",
      image: product.images?.[0] || "",
      videos: product.videos || [],
      sizes: product.sizes || [],
      colours: product.colours || [],
      fabricAndCare: product.fabricAndCare || "",
      url: `product.html?slug=${product.slug}`
    };
    const existingIndex = products.findIndex((item) => item.id === mapped.id);
    if (existingIndex >= 0) products[existingIndex] = mapped;
    else products.unshift(mapped);
  });
}

async function loadProductsFromSupabase() {
  if (!cossiraeSupabase) {
    mergeAdminProducts();
    return;
  }
  const { data, error } = await cossiraeSupabase
    .from("products")
    .select("slug,name,category,description,price_ngn,image_urls,video_urls,sizes,colours,fabric_and_care,is_featured")
    .eq("is_active", true)
    .order("is_featured", { ascending: false });

  if (error) {
    console.warn("Cossirae Supabase products failed to load:", error.message);
    return;
  }

  if (data?.length) {
    products = data.map(mapProductRow);
  }
  mergeAdminProducts();
}

async function loadCurrentCustomer() {
  if (!cossiraeSupabase) return;
  const { data } = await cossiraeSupabase.auth.getSession();
  currentCustomer = data.session?.user || null;
  renderAuthState();
}

async function logBrowserEvent(level, message, context = {}) {
  if (!cossiraeSupabase) return;
  try {
    await cossiraeSupabase.functions.invoke("log-event", {
      body: { level, source: "browser", message, context }
    });
  } catch (error) {
    console.warn("Log event failed:", error.message);
  }
}

window.addEventListener("error", (event) => {
  logBrowserEvent("error", "browser_error", {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

window.addEventListener("unhandledrejection", (event) => {
  logBrowserEvent("error", "unhandled_rejection", {
    reason: String(event.reason)
  });
});

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function getCart() {
  return storage.get("cossirae_cart", []);
}

function saveCart(cart) {
  storage.set("cossirae_cart", cart);
  updateHeaderCounts();
}

function addToCart(id, quantity = 1) {
  const cart = getCart();
  const item = cart.find((entry) => entry.id === id);
  if (item) item.quantity += quantity;
  else cart.push({ id, quantity });
  saveCart(cart);
  showToast(`${findProduct(id).name} added to bag`);
}

function getWishlist() {
  return storage.get("cossirae_wishlist", []);
}

function toggleWishlist(id) {
  const wishlist = getWishlist();
  const exists = wishlist.includes(id);
  const next = exists ? wishlist.filter((item) => item !== id) : [...wishlist, id];
  storage.set("cossirae_wishlist", next);
  updateHeaderCounts();
  updateWishlistButtons();
  showToast(exists ? "Removed from wishlist" : `${findProduct(id).name} saved`);
}

function updateHeaderCounts() {
  const cartCount = getCart().reduce((total, item) => total + item.quantity, 0);
  const wishCount = getWishlist().length;
  document.querySelectorAll('a[href="cart.html"]').forEach((link) => {
    if (link.classList.contains("icon-link")) link.textContent = cartCount ? `Bag ${cartCount}` : "Bag";
  });
  document.querySelectorAll('a[href="wishlist.html"]').forEach((link) => {
    if (link.classList.contains("icon-link")) link.textContent = wishCount ? `♡ ${wishCount}` : "♡";
  });
}

function renderAuthState() {
  document.querySelectorAll("[data-auth-state]").forEach((node) => {
    node.textContent = currentCustomer ? `Signed in as ${currentCustomer.email}` : "Not signed in";
  });
  document.querySelectorAll("[data-auth-email]").forEach((node) => {
    node.textContent = currentCustomer?.email || "";
  });
}

function setupCustomerAuth() {
  const authForm = document.querySelector("[data-customer-auth]");
  const signOutButton = document.querySelector("[data-customer-signout]");
  if (!authForm && !signOutButton) return;

  authForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!cossiraeSupabase) {
      showToast("Add Supabase keys to enable customer login");
      return;
    }
    const values = Object.fromEntries(new FormData(authForm));
    const mode = event.submitter?.dataset.authMode || "signin";
    const method = mode === "signup" ? "signUp" : "signInWithPassword";
    const { data, error } = await cossiraeSupabase.auth[method]({
      email: values.email,
      password: values.password
    });
    if (error) {
      showToast(error.message);
      await logBrowserEvent("warn", "customer_auth_failed", { mode, email: values.email });
      return;
    }
    currentCustomer = data.user || data.session?.user || null;
    if (currentCustomer && values.full_name) {
      await cossiraeSupabase.from("profiles").upsert({
        id: currentCustomer.id,
        full_name: values.full_name,
        phone: values.phone || null
      });
    }
    renderAuthState();
    showToast(mode === "signup" ? "Account created" : "Signed in");
  });

  signOutButton?.addEventListener("click", async () => {
    if (cossiraeSupabase) await cossiraeSupabase.auth.signOut();
    currentCustomer = null;
    renderAuthState();
    showToast("Signed out");
  });
}

function enhanceProductCards() {
  document.querySelectorAll(".product-card").forEach((card) => {
    const name = card.querySelector(".product-name")?.textContent.trim();
    const product = products.find((item) => item.name === name);
    if (!product) return;
    card.dataset.productId = product.id;
    const wishlistButton = card.querySelector(".wishlist-button");
    if (wishlistButton) {
      wishlistButton.type = "button";
      wishlistButton.dataset.wishlist = product.id;
      wishlistButton.setAttribute("aria-label", `Save ${product.name}`);
    }
    if (!card.querySelector("[data-add-cart]")) {
      const actions = document.createElement("div");
      actions.className = "product-actions";
      actions.innerHTML = `<button type="button" data-add-cart="${product.id}">Add to Bag</button>`;
      card.append(actions);
    }
  });
}

function productCardMarkup(product) {
  const imageStyle = product.image ? ` style="--image:url('${product.image}')"` : "";
  return `
    <article class="product-card" data-product-id="${product.id}">
      <a href="${product.url}"><div class="product-image"${imageStyle}><button class="wishlist-button" data-wishlist="${product.id}" type="button" aria-label="Save ${product.name}">♡</button></div></a>
      <h3 class="product-name">${product.name}</h3>
      <div class="price">${product.displayPrice}</div>
      <div class="product-meta">${product.category}</div>
      <div class="product-actions"><button type="button" data-add-cart="${product.id}">Add to Bag</button></div>
    </article>`;
}

function renderDynamicCatalogue() {
  const shopGrid = document.querySelector("[data-shop-grid]");
  if (shopGrid) {
    shopGrid.innerHTML = products.map(productCardMarkup).join("");
  }
}

function renderProductDetail() {
  const layout = document.querySelector("[data-product-detail]");
  if (!layout) return;
  const slug = new URLSearchParams(window.location.search).get("slug") || "abeni-maxi-dress";
  const product = products.find((item) => item.id === slug);

  if (!product) {
    layout.innerHTML = `<div class="empty-state"><h2>Product not found.</h2><p>This piece may have moved or sold out.</p><a class="button dark" href="shop.html">Back to Shop →</a></div>`;
    return;
  }

  document.title = `${product.name} | Cossirae`;
  const images = [product.image, ...(product.images || [])].filter(Boolean);
  const mainImage = images[0] || "";
  const thumbs = images.length
    ? images.map((image) => `<div class="thumb" style="background-image:url('${image}')"></div>`).join("")
    : `<div class="thumb"></div><div class="thumb"></div><div class="thumb"></div>`;
  const sizes = (product.sizes || ["S", "M", "L", "XL"])
    .map((size, index) => `<button type="button" class="${index === 1 ? "dark" : ""}">${size}</button>`)
    .join("") || "<button>One Size</button>";
  const colours = (product.colours || []).join(", ") || "Selected print";

  layout.innerHTML = `
    <div class="product-gallery">
      <div class="thumbs">${thumbs}</div>
      <div class="main-product-image" ${mainImage ? `style="background-image:url('${mainImage}')"` : ""}></div>
    </div>
    <div class="product-info">
      <div class="product-meta">Women / ${product.category}</div>
      <h1>${product.name}</h1>
      <div class="price">${product.displayPrice}</div>
      <p>${product.description}</p>
      <div class="rating">★★★★★ <span class="product-meta">(12 reviews)</span></div>
      <p class="label">Colour: ${colours}</p>
      <p class="label">Size</p><div class="option-row">${sizes}</div>
      <p><button class="dark" data-add-cart="${product.id}">Add to Bag</button> <button type="button" data-product-wishlist="${product.id}">♡</button></p>
      <div class="details-list"><div><span>Details</span><span>+</span></div><div><span>Size & Fit</span><span>+</span></div><div><span>Care Instructions</span><span>${product.fabricAndCare || "+"}</span></div></div>
    </div>`;
}

function updateWishlistButtons() {
  const wishlist = getWishlist();
  document.querySelectorAll("[data-wishlist]").forEach((button) => {
    const active = wishlist.includes(button.dataset.wishlist);
    button.classList.toggle("active", active);
    button.textContent = active ? "♥" : "♡";
  });
}

function setupMenu() {
  const menuButton = document.querySelector("[data-menu]");
  const nav = document.querySelector(".main-nav");
  if (!menuButton || !nav) return;

  if (!nav.querySelector(".mobile-menu-actions")) {
    const actions = document.createElement("div");
    actions.className = "mobile-menu-actions";
    actions.innerHTML = `
      <button type="button" data-open-search>Search</button>
      <a href="account.html">Account</a>
      <a href="wishlist.html">Wishlist</a>
      <a href="cart.html">Bag</a>
      <a href="admin.html">Admin</a>
    `;
    nav.append(actions);
  }

  menuButton.setAttribute("aria-expanded", "false");
  menuButton.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.textContent = isOpen ? "×" : "☰";
  });

  nav.querySelectorAll("a, [data-open-search]").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.textContent = "☰";
    });
  });
}

function setupCarousel() {
  const carousel = document.querySelector("[data-carousel]");
  if (!carousel) return;
  const slides = [...carousel.querySelectorAll(".carousel-slide")];
  const status = carousel.querySelector("[data-carousel-status]");
  const prev = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");
  let index = 0;

  const show = (nextIndex) => {
    index = (nextIndex + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => slide.classList.toggle("active", slideIndex === index));
    if (status) status.textContent = `${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
  };

  prev?.addEventListener("click", () => show(index - 1));
  next?.addEventListener("click", () => show(index + 1));
  setInterval(() => show(index + 1), 5200);
}

function setupSearch() {
  const overlay = document.createElement("section");
  overlay.className = "search-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="search-panel" role="dialog" aria-modal="true" aria-label="Search Cossirae">
      <div class="search-top">
        <div><div class="label">Search Cossirae</div><h2>Find your next piece.</h2></div>
        <button type="button" data-close-search aria-label="Close search">×</button>
      </div>
      <form class="search-form">
        <input type="search" placeholder="Search dresses, kaftans, sets, accessories..." aria-label="Search products" autocomplete="off">
        <button class="dark" type="submit">Search</button>
      </form>
      <div class="search-suggestions">
        <button type="button" data-search-term="Dresses">Dresses</button>
        <button type="button" data-search-term="Kaftans">Kaftans</button>
        <button type="button" data-search-term="Sets">Sets</button>
        <button type="button" data-search-term="Accessories">Accessories</button>
      </div>
      <div class="search-results" aria-live="polite"></div>
    </div>`;
  document.body.append(overlay);

  const input = overlay.querySelector("input");
  const results = overlay.querySelector(".search-results");
  const render = (term = "") => {
    const query = term.trim().toLowerCase();
    const matches = products.filter((product) => `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(query));
    results.innerHTML = matches.length
      ? matches.map((product) => `
          <article class="search-result">
            <a href="${product.url}"><span class="search-thumb"></span><span><strong>${product.name}</strong><small>${product.category} · ${product.displayPrice}</small></span></a>
            <button type="button" data-add-cart="${product.id}">Add</button>
          </article>`).join("")
      : "<p>No pieces found. Try dresses, kaftans, sets or accessories.</p>";
  };
  const open = () => {
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    render(input.value);
    setTimeout(() => input.focus(), 50);
  };
  const close = () => {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
  };

  document.querySelectorAll("[data-open-search], .icon-link[aria-label='Search']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      open();
    });
  });
  overlay.querySelector("[data-close-search]").addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  input.addEventListener("input", () => render(input.value));
  overlay.querySelector(".search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    render(input.value);
  });
  overlay.querySelectorAll("[data-search-term]").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.searchTerm;
      render(input.value);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
}

function setupActions() {
  document.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add-cart]");
    if (addButton) {
      event.preventDefault();
      event.stopPropagation();
      addToCart(addButton.dataset.addCart || "abeni-maxi-dress");
      const original = addButton.textContent;
      addButton.textContent = "Added";
      setTimeout(() => {
        addButton.textContent = original.includes("Add") ? original : "Add to Bag";
      }, 1200);
      return;
    }

    const wishlistButton = event.target.closest("[data-wishlist], [data-product-wishlist]");
    if (wishlistButton) {
      event.preventDefault();
      event.stopPropagation();
      toggleWishlist(wishlistButton.dataset.wishlist || wishlistButton.dataset.productWishlist || "abeni-maxi-dress");
    }
  });
}

function renderCartPage() {
  const cartList = document.querySelector("[data-cart-list]");
  const subtotalNode = document.querySelector("[data-cart-subtotal]");
  const totalNode = document.querySelector("[data-cart-total]");
  const titleNode = document.querySelector("[data-cart-title]");
  if (!cartList) return;

  const cart = getCart();
  const lines = cart.map((item) => ({ ...item, product: findProduct(item.id) }));
  const subtotal = lines.reduce((total, item) => total + item.product.price * item.quantity, 0);
  titleNode.textContent = `Your Cart (${cart.reduce((total, item) => total + item.quantity, 0)})`;
  cartList.innerHTML = lines.length
    ? lines.map((item) => `
        <div class="cart-row" data-cart-item="${item.id}">
          <div class="cart-thumb"></div>
          <div><h3 class="product-name">${item.product.name}</h3><p>${item.product.category}</p><div class="price">${item.product.displayPrice}</div></div>
          <div class="qty"><button type="button" data-cart-dec="${item.id}">-</button><span>${item.quantity}</span><button type="button" data-cart-inc="${item.id}">+</button><button type="button" data-cart-remove="${item.id}">Remove</button></div>
        </div>`).join("")
    : `<div class="empty-state"><h2>Your bag is empty.</h2><p>Start with a dress, kaftan or set from the collection.</p><a class="button dark" href="shop.html">Shop Now →</a></div>`;
  subtotalNode.textContent = naira.format(subtotal);
  totalNode.textContent = naira.format(subtotal);
}

function setupCartControls() {
  const cartList = document.querySelector("[data-cart-list]");
  if (!cartList) return;
  cartList.addEventListener("click", (event) => {
    const cart = getCart();
    const inc = event.target.closest("[data-cart-inc]");
    const dec = event.target.closest("[data-cart-dec]");
    const remove = event.target.closest("[data-cart-remove]");
    if (!inc && !dec && !remove) return;
    const id = inc?.dataset.cartInc || dec?.dataset.cartDec || remove?.dataset.cartRemove;
    const item = cart.find((entry) => entry.id === id);
    if (!item) return;
    if (inc) item.quantity += 1;
    if (dec) item.quantity -= 1;
    const next = remove || item.quantity < 1 ? cart.filter((entry) => entry.id !== id) : cart;
    saveCart(next);
    renderCartPage();
  });
}

async function createOrderInSupabase(formData, cart, total) {
  if (!cossiraeSupabase) return null;

  const orderId = crypto.randomUUID();
  const reference = `cossirae-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const orderPayload = {
    id: orderId,
    user_id: currentCustomer?.id || null,
    customer_name: formData.name,
    customer_email: formData.email,
    customer_phone: formData.phone,
    delivery_address: formData.address,
    delivery_city: formData.city,
    payment_method: "paystack",
    payment_reference: reference,
    payment_status: "pending",
    subtotal_ngn: total,
    total_ngn: total
  };
  const itemPayload = cart.map((item) => {
    const product = findProduct(item.id);
    return {
      order_id: orderId,
      product_slug: product.id,
      product_name: product.name,
      quantity: item.quantity,
      unit_price_ngn: product.price,
      line_total_ngn: product.price * item.quantity
    };
  });

  const { error: orderError } = await cossiraeSupabase.from("orders").insert(orderPayload);
  if (orderError) throw new Error(orderError.message);

  const { error: itemsError } = await cossiraeSupabase.from("order_items").insert(itemPayload);
  if (itemsError) throw new Error(itemsError.message);

  return { orderId, reference };
}

async function verifyPaystackPayment(reference, orderId) {
  if (!cossiraeSupabase) return { paid: false };
  const { data, error } = await cossiraeSupabase.functions.invoke("verify-paystack", {
    body: { reference, order_id: orderId }
  });
  if (error) throw new Error(error.message);
  return data;
}

function openPaystackCheckout({ email, amount, reference, orderId }) {
  if (!window.PaystackPop || !hasPaystackConfig) {
    showToast("Add Paystack public key to enable live payment");
    return;
  }

  const popup = new window.PaystackPop();
  popup.newTransaction({
    key: config.paystackPublicKey,
    email,
    amount: amount * 100,
    currency: config.currency || "NGN",
    reference,
    metadata: {
      custom_fields: [
        { display_name: "Order ID", variable_name: "order_id", value: orderId }
      ]
    },
    onSuccess: async (transaction) => {
      try {
        const result = await verifyPaystackPayment(transaction.reference || reference, orderId);
        if (result.paid) {
          await cossiraeSupabase.functions.invoke("send-order-email", {
            body: {
              id: orderId,
              payment_reference: reference,
              customer_name: document.querySelector('[name="name"]')?.value,
              customer_email: email,
              total_ngn: amount,
              payment_status: "paid"
            }
          });
          saveCart([]);
          renderCartPage();
          showToast("Payment confirmed. Order received.");
        } else {
          showToast("Payment was not confirmed yet");
        }
      } catch (error) {
        showToast(`Payment made, verification failed: ${error.message}`);
      }
    },
    onCancel: () => showToast("Payment cancelled")
  });
}

function setupCheckout() {
  const form = document.querySelector("[data-checkout-form]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const cart = getCart();
    if (!cart.length) {
      showToast("Add an item before checkout");
      return;
    }
    const required = [...form.querySelectorAll("[required]")];
    const invalid = required.find((field) => !field.value.trim());
    if (invalid) {
      invalid.focus();
      showToast("Please complete your checkout details");
      return;
    }
    const formData = Object.fromEntries(new FormData(form));
    const total = cart.reduce((sum, item) => sum + findProduct(item.id).price * item.quantity, 0);

    if (cossiraeSupabase && hasPaystackConfig) {
      try {
        showToast("Preparing secure checkout...");
        const order = await createOrderInSupabase(formData, cart, total);
        openPaystackCheckout({ email: formData.email, amount: total, reference: order.reference, orderId: order.orderId });
      } catch (error) {
        showToast(`Checkout failed: ${error.message}`);
      }
      return;
    }

    storage.set("cossirae_last_order", { createdAt: new Date().toISOString(), items: cart, customer: formData });
    showToast("Demo order captured. Add Supabase and Paystack keys for live checkout.");
  });
}

function setupSimpleForms() {
  document.querySelectorAll(".newsletter form, .form-page form").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (form.closest(".newsletter")) {
        const email = form.querySelector('input[type="email"]')?.value;
        if (cossiraeSupabase && email) {
          await cossiraeSupabase.from("newsletter_subscribers").insert({ email });
        }
        form.reset();
        showToast("You are on the Cossirae list");
      } else {
        const values = Object.fromEntries(new FormData(form));
        if (cossiraeSupabase) {
          await cossiraeSupabase.from("product_submissions").insert({
            product_name: values.product_name,
            category: values.category,
            price_ngn: Number(values.price || 0),
            stock_quantity: Number(values.stock || 0),
            sizes: values.sizes,
            colours: values.colours,
            description: values.description,
            fabric_and_care: values.care,
            image_file_names: values.images,
            extra_notes: values.notes
          });
        } else {
          const saved = storage.get("cossirae_product_submissions", []);
          saved.push({ ...values, createdAt: new Date().toISOString() });
          storage.set("cossirae_product_submissions", saved);
        }
        form.reset();
        showToast(cossiraeSupabase ? "Product details sent to Supabase" : "Product details saved in this browser");
      }
    });
  });
}

function renderWishlistPage() {
  const target = document.querySelector("[data-wishlist-list]");
  const title = document.querySelector("[data-wishlist-title]");
  if (!target) return;
  const items = getWishlist().map(findProduct);
  title.textContent = `My Wishlist (${items.length})`;
  target.innerHTML = items.length
    ? items.map((product) => `
        <article class="product-card">
          <a href="${product.url}"><div class="product-image"><button class="wishlist-button active" data-wishlist="${product.id}" type="button">♥</button></div></a>
          <h3 class="product-name">${product.name}</h3>
          <div class="price">${product.displayPrice}</div>
          <div class="product-actions"><button type="button" data-add-cart="${product.id}">Add to Bag</button></div>
        </article>`).join("")
    : `<div class="empty-state"><h2>No saved pieces yet.</h2><p>Tap the heart on any product to save it here.</p><a class="button dark" href="shop.html">Shop Collection →</a></div>`;
}

async function initCossirae() {
  await loadProductsFromSupabase();
  await loadCurrentCustomer();
  renderDynamicCatalogue();
  renderProductDetail();
  enhanceProductCards();
  setupMenu();
  setupCarousel();
  setupSearch();
  setupActions();
  setupSimpleForms();
  setupCustomerAuth();
  renderWishlistPage();
  renderCartPage();
  setupCartControls();
  setupCheckout();
  updateWishlistButtons();
  updateHeaderCounts();
}

initCossirae();
