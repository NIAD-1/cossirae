const adminConfig = window.COSSIRAE_CONFIG || {};
const adminHasSupabase = Boolean(adminConfig.supabaseUrl && adminConfig.supabaseAnonKey && !adminConfig.supabaseUrl.includes("YOUR_"));
const adminSupabase = adminHasSupabase && window.supabase
  ? window.supabase.createClient(adminConfig.supabaseUrl, adminConfig.supabaseAnonKey)
  : null;
const mediaBucket = adminConfig.supabaseStorageBucket || "product-media";
const adminNaira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
const defaultCategories = [
  { name: "Dresses", slug: "dresses", description: "Statement dresses and flowing silhouettes." },
  { name: "Kaftans", slug: "kaftans", description: "Elegant kaftans for ease and occasion dressing." },
  { name: "Sets", slug: "sets", description: "Coordinated two-piece looks." },
  { name: "Tops", slug: "tops", description: "Shirts, blouses and refined tops." },
  { name: "Accessories", slug: "accessories", description: "Jewellery and finishing pieces." }
];
const starterProducts = [
  { slug: "abeni-maxi-dress", name: "Abeni Maxi Dress", category: "Dresses", price: 85000, stock: 12, sizes: ["S", "M", "L", "XL"], colours: ["Rust Print", "Black", "Olive"], description: "Flowing rust print maxi dress with a refined African silhouette.", fabricAndCare: "Premium cotton blend. Hand wash cold.", images: ["assets/images/product-abeni-1.jpg"], videos: [], isActive: true, isFeatured: true },
  { slug: "tunde-kaftan", name: "Tunde Kaftan", category: "Kaftans", price: 75000, stock: 8, sizes: ["S", "M", "L", "XL"], colours: ["Black", "Sand"], description: "Elegant black kaftan cut for ease, movement and occasion dressing.", fabricAndCare: "Soft woven fabric. Dry clean recommended.", images: [], videos: [], isActive: true, isFeatured: true },
  { slug: "ife-blazer-set", name: "Ife Blazer Set", category: "Sets", price: 120000, stock: 6, sizes: ["S", "M", "L"], colours: ["Terracotta", "Ivory"], description: "Structured set with a contemporary finish for the modern woman.", fabricAndCare: "Structured blend. Steam gently.", images: [], videos: [], isActive: true, isFeatured: true },
  { slug: "zuri-shirt-set", name: "Zuri Shirt Set", category: "Sets", price: 95000, stock: 9, sizes: ["S", "M", "L", "XL"], colours: ["Espresso", "Clay"], description: "Relaxed shirt set with warm textile-inspired styling.", fabricAndCare: "Machine wash gentle.", images: [], videos: [], isActive: true, isFeatured: false },
  { slug: "kele-shirt", name: "Kele Shirt", category: "Tops", price: 48000, stock: 15, sizes: ["S", "M", "L", "XL"], colours: ["Ivory", "Black"], description: "Clean ivory shirt with subtle detailing and everyday polish.", fabricAndCare: "Cotton blend. Hang dry.", images: [], videos: [], isActive: true, isFeatured: false },
  { slug: "sade-set", name: "Sade Set", category: "Sets", price: 76000, stock: 10, sizes: ["S", "M", "L"], colours: ["Espresso", "Burnt Orange"], description: "Versatile two-piece set with deep tones and soft structure.", fabricAndCare: "Hand wash cold.", images: [], videos: [], isActive: true, isFeatured: true },
  { slug: "brass-drop-earrings", name: "Brass Drop Earrings", category: "Accessories", price: 32000, stock: 20, sizes: [], colours: ["Gold", "Bronze"], description: "Sculptural brass earrings for finishing a Cossirae look.", fabricAndCare: "Keep dry. Store in pouch.", images: [], videos: [], isActive: true, isFeatured: false }
];
const starterOrders = [
  { customer_name: "Demo Customer", customer_phone: "08000000000", delivery_city: "Lagos", total_ngn: 85000, payment_status: "paid", order_status: "new", created_at: new Date().toISOString() }
];

const adminStore = {
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

let adminProducts = [];
let adminCategories = [];
let adminOrders = [];
let adminLogs = [];
let uploadedImages = [];
let uploadedVideos = [];
let adminUserIsAuthorized = !adminSupabase;
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const listFromText = (value) => value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
const boolValue = (value) => value === "true";

function toast(message) {
  let node = document.querySelector(".toast");
  if (!node) {
    node = document.createElement("div");
    node.className = "toast";
    document.body.append(node);
  }
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2400);
}

async function filesToDataUrls(fileList) {
  const files = [...fileList];
  return Promise.all(files.map((file) => new Promise((resolve) => {
    if (file.type.startsWith("image/")) {
      const image = new Image();
      image.onload = () => {
        const maxSize = 1600;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          resolve({ name: file.name.replace(/\.[^.]+$/, ".webp"), url, blob, type: "image/webp" });
        }, "image/webp", 0.82);
      };
      image.src = URL.createObjectURL(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, url: reader.result, blob: file, type: file.type });
    reader.readAsDataURL(file);
  })));
}

async function uploadMediaAssets(slug, assets, folder) {
  if (!adminSupabase || !adminUserIsAuthorized) {
    return assets.map((asset) => asset.url);
  }

  const urls = [];
  for (const asset of assets) {
    if (!asset.blob) {
      urls.push(asset.url);
      continue;
    }
    const safeName = asset.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
    const path = `${slug}/${folder}/${Date.now()}-${safeName}`;
    const { error } = await adminSupabase.storage.from(mediaBucket).upload(path, asset.blob, {
      contentType: asset.type,
      upsert: true
    });
    if (error) {
      throw new Error(`Media upload failed: ${error.message}`);
    }
    const { data } = adminSupabase.storage.from(mediaBucket).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

function localProducts() {
  return adminStore.get("cossirae_admin_products", []);
}

function saveLocalProducts(products) {
  adminStore.set("cossirae_admin_products", products);
}

function localCategories() {
  return adminStore.get("cossirae_admin_categories", defaultCategories);
}

function saveLocalCategories(categories) {
  adminStore.set("cossirae_admin_categories", categories);
}

async function loadAdminData() {
  adminCategories = localCategories();
  adminProducts = localProducts();
  if (!adminProducts.length) {
    adminProducts = starterProducts;
    saveLocalProducts(adminProducts);
  }
  adminOrders = adminStore.get("cossirae_admin_orders", starterOrders);

  if (!adminSupabase) return;

  const { data: sessionData } = await adminSupabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (userId) {
    const { data: role } = await adminSupabase.from("admin_roles").select("role").eq("user_id", userId).maybeSingle();
    adminUserIsAuthorized = Boolean(role);
  }

  const [{ data: products }, { data: categories }, { data: orders }, { data: logs }] = await Promise.all([
    adminSupabase.from("products").select("*").order("created_at", { ascending: false }),
    adminSupabase.from("product_categories").select("*").order("name"),
    adminSupabase.from("orders").select("*").order("created_at", { ascending: false }),
    adminSupabase.from("app_logs").select("*").order("created_at", { ascending: false }).limit(50)
  ]);

  if (categories?.length) adminCategories = categories;
  if (products?.length) {
    adminProducts = products.map((product) => ({
      slug: product.slug,
      name: product.name,
      category: product.category,
      description: product.description || "",
      price: product.price_ngn,
      stock: product.stock_quantity,
      sizes: product.sizes || [],
      colours: product.colours || [],
      garmentType: product.garment_type || "",
      setIncludes: product.set_includes || "",
      lengths: product.lengths || [],
      fit: product.fit || "",
      fabric: product.fabric || "",
      specifications: product.specifications || [],
      images: product.image_urls || [],
      videos: product.video_urls || [],
      fabricAndCare: product.fabric_and_care || "",
      isActive: product.is_active,
      isFeatured: product.is_featured
    }));
  }
  if (orders?.length) adminOrders = orders;
  if (logs?.length) adminLogs = logs;
}

function renderStats() {
  const revenue = adminOrders.filter((order) => order.payment_status === "paid").reduce((sum, order) => sum + Number(order.total_ngn || 0), 0);
  const lowStock = adminProducts.filter((product) => Number(product.stock || 0) <= 3).length;
  document.querySelector("[data-stat-products]").textContent = adminProducts.length;
  document.querySelector("[data-stat-orders]").textContent = adminOrders.length;
  document.querySelector("[data-stat-revenue]").textContent = adminNaira.format(revenue);
  document.querySelector("[data-stat-low-stock]").textContent = lowStock;
}

function renderCategorySelect() {
  const select = document.querySelector("[data-admin-category-select]");
  select.innerHTML = adminCategories.map((category) => `<option value="${category.name}">${category.name}</option>`).join("");
}

function renderCatalogue(filter = "") {
  const target = document.querySelector("[data-admin-catalogue]");
  const query = filter.toLowerCase();
  const rows = adminProducts.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(query));
  target.innerHTML = rows.length ? rows.map((product) => `
    <tr>
      <td><strong>${product.name}</strong><small>${product.slug}</small></td>
      <td>${product.category}</td>
      <td>${adminNaira.format(Number(product.price || 0))}</td>
      <td>${product.stock || 0}</td>
      <td>${product.isActive === false ? "Hidden" : "Published"}</td>
      <td><button type="button" data-edit-product="${product.slug}">Edit</button></td>
    </tr>
  `).join("") : `<tr><td colspan="6">No products yet.</td></tr>`;
}

function renderOrders() {
  const target = document.querySelector("[data-admin-orders]");
  const filter = document.querySelector("[data-admin-order-filter]").value;
  const rows = adminOrders.filter((order) => !filter || order.payment_status === filter);
  target.innerHTML = rows.length ? rows.map((order) => `
    <tr>
      <td><strong>${order.customer_name || "Customer"}</strong><small>${order.customer_email || ""}</small></td>
      <td>${order.customer_phone || ""}</td>
      <td>${order.delivery_city || ""}</td>
      <td>${adminNaira.format(Number(order.total_ngn || 0))}</td>
      <td>${order.payment_status || "pending"}</td>
      <td>${order.order_status || "new"}</td>
    </tr>
  `).join("") : `<tr><td colspan="6">No orders yet.</td></tr>`;
}

function renderOverviewLists() {
  const recent = document.querySelector("[data-admin-recent-orders]");
  const stock = document.querySelector("[data-admin-stock-watch]");
  recent.innerHTML = adminOrders.slice(0, 5).map((order) => `<p><strong>${order.customer_name || "Customer"}</strong> · ${adminNaira.format(Number(order.total_ngn || 0))} · ${order.payment_status || "pending"}</p>`).join("") || "<p>No orders yet.</p>";
  stock.innerHTML = adminProducts.filter((product) => Number(product.stock || 0) <= 5).slice(0, 6).map((product) => `<p><strong>${product.name}</strong> · ${product.stock || 0} left</p>`).join("") || "<p>Stock levels look fine.</p>";
}

function renderCategories() {
  const target = document.querySelector("[data-admin-categories]");
  target.innerHTML = adminCategories.map((category) => `
    <div class="admin-list-row">
      <span><strong>${category.name}</strong><small>${category.slug}</small></span>
      <button type="button" data-delete-category="${category.slug}">Remove</button>
    </div>
  `).join("");
}

function renderAnalytics() {
  const target = document.querySelector("[data-admin-analytics]");
  const grouped = adminProducts.reduce((acc, product) => {
    acc[product.category] = (acc[product.category] || 0) + 1;
    return acc;
  }, {});
  const max = Math.max(1, ...Object.values(grouped));
  target.innerHTML = Object.entries(grouped).map(([category, count]) => `
    <div>
      <span>${category}</span>
      <strong>${count}</strong>
      <i style="width:${(count / max) * 100}%"></i>
    </div>
  `).join("") || "<p>No catalogue data yet.</p>";
}

function renderLogs() {
  const target = document.querySelector("[data-admin-logs]");
  if (!target) return;
  target.innerHTML = adminLogs.length ? adminLogs.map((log) => `
    <tr>
      <td>${new Date(log.created_at).toLocaleString()}</td>
      <td>${log.level}</td>
      <td>${log.source}</td>
      <td>${log.message}</td>
    </tr>
  `).join("") : `<tr><td colspan="4">No logs yet. Live logs appear after Supabase functions are deployed.</td></tr>`;
}

function renderAll() {
  renderStats();
  renderCategorySelect();
  renderCatalogue(document.querySelector("[data-admin-catalogue-search]")?.value || "");
  renderOrders();
  renderOverviewLists();
  renderCategories();
  renderAnalytics();
  renderLogs();
}

function fillProductForm(slug) {
  const product = adminProducts.find((item) => item.slug === slug);
  if (!product) return;
  const form = document.querySelector("[data-admin-product-form]");
  const fields = form.elements;
  fields.editing_slug.value = product.slug;
  fields.name.value = product.name;
  fields.slug.value = product.slug;
  fields.category.value = product.category;
  fields.price.value = product.price || 0;
  fields.stock.value = product.stock || 0;
  fields.sizes.value = (product.sizes || []).join(", ");
  fields.colours.value = (product.colours || []).join(", ");
  fields.garment_type.value = product.garmentType || "";
  fields.set_includes.value = product.setIncludes || "";
  fields.lengths.value = (product.lengths || []).join(", ");
  fields.fit.value = product.fit || "";
  fields.fabric.value = product.fabric || "";
  fields.specifications.value = (product.specifications || []).map((item) => `${item.label}: ${item.value}`).join("\n");
  fields.is_active.value = String(product.isActive !== false);
  fields.is_featured.value = String(Boolean(product.isFeatured));
  fields.description.value = product.description || "";
  fields.fabric_and_care.value = product.fabricAndCare || "";
  fields.image_urls.value = (product.images || []).filter((url) => !url.startsWith("data:")).join(", ");
  fields.video_urls.value = (product.videos || []).filter((url) => !url.startsWith("data:")).join(", ");
  uploadedImages = (product.images || []).filter((url) => url.startsWith("data:")).map((url) => ({ url, type: "image" }));
  uploadedVideos = (product.videos || []).filter((url) => url.startsWith("data:")).map((url) => ({ url, type: "video" }));
  renderMediaPreview();
  document.querySelector('[data-admin-tab="products"]').click();
}

function renderMediaPreview() {
  const target = document.querySelector("[data-admin-media-preview]");
  const imageNodes = uploadedImages.map((file) => `<img src="${escapeHtml(file.url)}" alt="Product photo preview">`).join("");
  const videoNodes = uploadedVideos.map((file) => `<video src="${escapeHtml(file.url)}" controls playsinline></video>`).join("");
  target.innerHTML = imageNodes + videoNodes || "<p class='form-note'>Selected images and videos will preview here.</p>";
}

function renderProductPreview(form) {
  const values = Object.fromEntries(new FormData(form));
  const imageUrl = uploadedImages[0]?.url || listFromText(values.image_urls || "")[0] || "";
  const media = imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(values.name || "Product image")}">` : `<div class="product-preview-placeholder">Product photo</div>`;
  const target = document.querySelector("[data-admin-product-preview]");
  target.innerHTML = `<article class="product-card preview-product-card">${media}<h3 class="product-name">${escapeHtml(values.name || "Product name")}</h3><div class="price">${adminNaira.format(Number(values.price || 0))}</div><div class="product-meta">${escapeHtml(values.category || "Category")}</div></article>`;
}

function parseSpecifications(value) {
  return value.split("\n").map((line) => {
    const separator = line.indexOf(":");
    return separator < 1 ? null : { label: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
  }).filter((item) => item?.label && item?.value);
}

async function saveProduct(form) {
  if (adminSupabase && !adminUserIsAuthorized) {
    toast("Sign in with an admin role before saving products");
    return;
  }
  const values = Object.fromEntries(new FormData(form));
  const productSlug = slugify(values.slug || values.name);
  let uploadedImageUrls;
  let uploadedVideoUrls;
  try {
    uploadedImageUrls = await uploadMediaAssets(productSlug, uploadedImages, "images");
    uploadedVideoUrls = await uploadMediaAssets(productSlug, uploadedVideos, "videos");
  } catch (error) {
    toast(error.message);
    return;
  }
  const product = {
    slug: productSlug,
    name: values.name,
    category: values.category,
    price: Number(values.price || 0),
    stock: Number(values.stock || 0),
    sizes: listFromText(values.sizes || ""),
    colours: listFromText(values.colours || ""),
    garmentType: values.garment_type || "",
    setIncludes: values.set_includes || "",
    lengths: listFromText(values.lengths || ""),
    fit: values.fit || "",
    fabric: values.fabric || "",
    specifications: parseSpecifications(values.specifications || ""),
    description: values.description,
    fabricAndCare: values.fabric_and_care,
    images: [...uploadedImageUrls, ...listFromText(values.image_urls || "")],
    videos: [...uploadedVideoUrls, ...listFromText(values.video_urls || "")],
    isActive: boolValue(values.is_active),
    isFeatured: boolValue(values.is_featured),
    updatedAt: new Date().toISOString()
  };

  const existingIndex = adminProducts.findIndex((item) => item.slug === values.editing_slug || item.slug === product.slug);
  if (existingIndex >= 0) adminProducts[existingIndex] = product;
  else adminProducts.unshift(product);
  saveLocalProducts(adminProducts);

  if (adminSupabase) {
    const { error } = await adminSupabase.from("products").upsert({
      slug: product.slug,
      name: product.name,
      category: product.category,
      description: product.description,
      fabric_and_care: product.fabricAndCare,
      price_ngn: product.price,
      stock_quantity: product.stock,
      sizes: product.sizes,
      colours: product.colours,
      garment_type: product.garmentType,
      set_includes: product.setIncludes,
      lengths: product.lengths,
      fit: product.fit,
      fabric: product.fabric,
      specifications: product.specifications,
      image_urls: product.images,
      video_urls: product.videos,
      is_active: product.isActive,
      is_featured: product.isFeatured
    }, { onConflict: "slug" });
    if (error) {
      toast(`Cloud save failed: ${error.message}`);
      return;
    }
    else toast("Product saved to Supabase and local catalogue");
  } else {
    toast("Product saved locally. Add Supabase keys for cloud storage.");
  }
  form.reset();
  uploadedImages = [];
  uploadedVideos = [];
  renderMediaPreview();
  renderAll();
}

function setupAdminEvents() {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-admin-tab]").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll("[data-admin-section]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`[data-admin-section="${button.dataset.adminTab}"]`).classList.add("active");
    });
  });

  const form = document.querySelector("[data-admin-product-form]");
  const fields = form.elements;
  fields.name.addEventListener("input", () => {
    if (!fields.editing_slug.value) fields.slug.value = slugify(fields.name.value);
  });
  fields.image_files.addEventListener("change", async () => {
    uploadedImages = [...uploadedImages, ...await filesToDataUrls(fields.image_files.files)];
    renderMediaPreview();
    renderProductPreview(form);
  });
  fields.video_files.addEventListener("change", async () => {
    const tooLarge = [...fields.video_files.files].find((file) => file.size > 50 * 1024 * 1024);
    if (tooLarge) {
      toast(`${tooLarge.name} is over the 50 MB upload limit`);
      fields.video_files.value = "";
      return;
    }
    uploadedVideos = [...uploadedVideos, ...await filesToDataUrls(fields.video_files.files)];
    renderMediaPreview();
  });
  form.addEventListener("input", () => renderProductPreview(form));
  form.elements.image_urls.addEventListener("input", () => renderProductPreview(form));
  form.elements.is_active.value = "false";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveProduct(form);
  });
  document.querySelector("[data-admin-reset-product]").addEventListener("click", () => {
    form.reset();
    fields.editing_slug.value = "";
    uploadedImages = [];
    uploadedVideos = [];
    renderMediaPreview();
  });
  document.querySelector("[data-admin-delete-product]").addEventListener("click", async () => {
    const slug = fields.editing_slug.value || slugify(fields.slug.value);
    if (!slug) return;
    adminProducts = adminProducts.filter((product) => product.slug !== slug);
    saveLocalProducts(adminProducts);
    if (adminSupabase) await adminSupabase.from("products").update({ is_active: false }).eq("slug", slug);
    form.reset();
    renderAll();
    toast("Product removed from visible catalogue");
  });

  document.querySelector("[data-admin-catalogue]").addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-product]");
    if (button) fillProductForm(button.dataset.editProduct);
  });
  document.querySelector("[data-admin-catalogue-search]").addEventListener("input", (event) => renderCatalogue(event.target.value));
  document.querySelector("[data-admin-order-filter]").addEventListener("change", renderOrders);
  document.querySelector("[data-admin-refresh-logs]").addEventListener("click", async () => {
    await loadAdminData();
    renderAll();
    toast("Logs refreshed");
  });

  document.querySelector("[data-admin-category-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const category = { name: values.name, slug: slugify(values.slug || values.name), description: values.description };
    adminCategories = adminCategories.filter((item) => item.slug !== category.slug);
    adminCategories.push(category);
    saveLocalCategories(adminCategories);
    if (adminSupabase) await adminSupabase.from("product_categories").upsert(category, { onConflict: "slug" });
    event.currentTarget.reset();
    renderAll();
    toast("Category saved");
  });

  document.querySelector("[data-admin-categories]").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-category]");
    if (!button) return;
    adminCategories = adminCategories.filter((category) => category.slug !== button.dataset.deleteCategory);
    saveLocalCategories(adminCategories);
    if (adminSupabase) await adminSupabase.from("product_categories").update({ is_active: false }).eq("slug", button.dataset.deleteCategory);
    renderAll();
  });

  document.querySelector("[data-admin-auth]").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!adminSupabase) {
      toast("Add Supabase keys before admin sign-in");
      return;
    }
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const { error } = await adminSupabase.auth.signInWithPassword(values);
    if (error) toast(error.message);
    else {
      toast("Admin signed in");
      await loadAdminData();
      renderAll();
      if (!adminUserIsAuthorized) toast("This account is not in admin_roles yet");
    }
  });
}

async function initAdmin() {
  await loadAdminData();
  setupAdminEvents();
  renderAll();
  renderMediaPreview();
  renderProductPreview(document.querySelector("[data-admin-product-form]"));
  const notice = document.querySelector("[data-admin-storage-notice]");
  if (notice) notice.textContent = adminSupabase
    ? "Cloud catalogue is enabled. Sign in with an approved admin account before saving."
    : "Demo mode: products and media are saved only in this browser. Configure Supabase before sharing this editor with the owner.";
}

initAdmin();
