/**
 * ================================================================
 *  HATBAZAR GO — FIREBASE ADMIN DASHBOARD — script.js
 *  Firebase v9 Modular SDK (CDN)
 *  Features: Auth, Firestore Real-time, Full CRUD
 * ================================================================
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ——— YOUR FIREBASE CONFIG ———
const firebaseConfig = {
  apiKey: "AIzaSyC3diAg_MKhn1s2kt60poJFgLIuOm93dpI",
  authDomain: "hatbazargo-67035.firebaseapp.com",
  projectId: "hatbazargo-67035",
  storageBucket: "hatbazargo-67035.firebasestorage.app",
  messagingSenderId: "390651949826",
  appId: "1:390651949826:web:b399f67c269001fabd881b",
  measurementId: "G-X0VK6250SC",
};

// ==============================
// INITIALIZE FIREBASE
// ==============================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==============================
// GLOBAL STATE
// ==============================
let currentUser = null;
let currentOrderId = null;
let currentRiderId = null;
let currentStoreId = null;
let currentProductId = null;
let activeRiders = [];
let currentOrderFilter = "all";

let unsubOrders = null;
let unsubUsers = null;

// ==============================
// DOM READY
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  initSidebar();
  initNavigation();
  initSearchFilters();
  initPasswordToggle();
  initButtons();
  listenAuth();
});

// ==============================
// INIT BUTTONS (wire up all static button handlers)
// ==============================
function initButtons() {
  // Login button
  document.getElementById("loginBtn")?.addEventListener("click", handleLogin);

  // Logout button
  document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);

  // Add product button
  document
    .getElementById("addProductBtn")
    ?.addEventListener("click", () => openProductModal(null));

  // Save product button
  document
    .getElementById("saveProductBtn")
    ?.addEventListener("click", saveProduct);

  // Payment save buttons
  document
    .getElementById("saveBkash")
    ?.addEventListener("click", () => savePaymentSettings("bkash"));
  document
    .getElementById("saveNagad")
    ?.addEventListener("click", () => savePaymentSettings("nagad"));

  // Shipping area buttons
  document
    .getElementById("addAreaBtn")
    ?.addEventListener("click", addShippingArea);
  document
    .getElementById("saveEditAreaBtn")
    ?.addEventListener("click", saveEditArea);

  // Allow Enter key on add area inputs
  document.getElementById("newAreaName")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("newAreaFee")?.focus();
  });
  document.getElementById("newAreaFee")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addShippingArea();
  });

  // Modal close buttons (data-close attribute)
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-close");
      closeModal(id);
    });
  });

  // Close modals on overlay click
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("open");
    });
  });

  // ESC key closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document
        .querySelectorAll(".modal-overlay.open")
        .forEach((m) => m.classList.remove("open"));
    }
  });
}

// ==============================
// AUTH LISTENER
// ==============================
function listenAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      currentUser = null;
      showLogin();
      return;
    }

    try {
      // 🔥 Match Auth UID with Firestore document ID
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await signOut(auth);
        showLoginError("User record not found in database.");
        return;
      }

      const userData = userSnap.data();

      // 🔥 Check role
      if (userData.role === "admin") {
        currentUser = {
          uid: user.uid,
          email: user.email,
          ...userData,
        };

        showApp();
      } else {
        await signOut(auth);
        showLoginError("Access denied. Only admin can login.");
      }
    } catch (error) {
      console.error("Admin verification failed:", error);
      await signOut(auth);
      showLoginError("Something went wrong. Please try again.");
    }
  });
}

// ==============================
// SHOW / HIDE SCREENS
// ==============================
function showLogin() {
  // HTML uses id="loginScreen" and id="app"
  document.getElementById("loginScreen").style.display = "flex";
  const appEl = document.getElementById("app");
  if (appEl) {
    appEl.style.display = "none";
    appEl.classList.add("hidden");
  }
}

function showApp() {
  document.getElementById("loginScreen").style.display = "none";
  const appEl = document.getElementById("app");
  if (appEl) {
    appEl.style.display = "flex";
    appEl.classList.remove("hidden");
  }

  // HTML IDs: userAva, userName, userEmail, topbarAva
  const name = currentUser.name || currentUser.email?.split("@")[0] || "Admin";
  const initial = name.charAt(0).toUpperCase();

  const userAva = document.getElementById("userAva");
  if (userAva) userAva.textContent = initial;

  const userName = document.getElementById("userName");
  if (userName) userName.textContent = name;

  const userEmail = document.getElementById("userEmail");
  if (userEmail) userEmail.textContent = currentUser.email || "";

  const topbarAva = document.getElementById("topbarAva");
  if (topbarAva) topbarAva.textContent = initial;

  navigateTo("dashboard");
}

// ==============================
// LOGIN HANDLER
// ==============================
async function handleLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const btn = document.getElementById("loginBtn");
  // HTML uses id="loginBtnText" and id="loginSpinner"
  const btnText = document.getElementById("loginBtnText");
  const btnSpinner = document.getElementById("loginSpinner");

  hideLoginError();

  if (!email || !password) {
    showLoginError("Please enter email and password.");
    return;
  }

  btn.disabled = true;
  if (btnText) btnText.style.display = "none";
  if (btnSpinner) btnSpinner.classList.remove("hidden");

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error("Login error:", err);
    const messages = {
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password. Please try again.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/too-many-requests": "Too many attempts. Please try again later.",
      "auth/invalid-credential":
        "Invalid credentials. Please check and try again.",
    };
    showLoginError(messages[err.code] || `Login failed: ${err.message}`);
  } finally {
    btn.disabled = false;
    if (btnText) btnText.style.display = "inline";
    if (btnSpinner) btnSpinner.classList.add("hidden");
  }
}

// Allow Enter key to submit login
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginPassword")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLogin();
  });
  document.getElementById("loginEmail")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLogin();
  });
});

// ==============================
// LOGOUT HANDLER
// ==============================
async function handleLogout() {
  try {
    if (unsubOrders) {
      unsubOrders();
      unsubOrders = null;
    }
    if (unsubUsers) {
      unsubUsers();
      unsubUsers = null;
    }
    if (unsubShippingAreas) {
      unsubShippingAreas();
      unsubShippingAreas = null;
    }
    await signOut(auth);
    showToast("Logged out successfully.", "info");
  } catch (err) {
    console.error("Logout error:", err);
    showToast("Logout failed.", "error");
  }
}

// ==============================
// LOGIN UI HELPERS
// ==============================
function showLoginError(msg) {
  const el = document.getElementById("loginError");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  el.style.display = "block";
}

function hideLoginError() {
  const el = document.getElementById("loginError");
  if (!el) return;
  el.classList.add("hidden");
  el.style.display = "none";
}

function initPasswordToggle() {
  // HTML uses id="togglePass"
  const btn = document.getElementById("togglePass");
  const input = document.getElementById("loginPassword");
  if (!btn || !input) return;
  btn.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
  });
}

// ==============================
// SIDEBAR
// ==============================
function initSidebar() {
  // HTML uses id="sidebarOverlay" and id="sidebarClose"
  const hamburger = document.getElementById("hamburger");
  const overlay = document.getElementById("sidebarOverlay");
  const sidebar = document.getElementById("sidebar");
  const closeBtn = document.getElementById("sidebarClose");

  hamburger?.addEventListener("click", () => {
    sidebar?.classList.add("open");
    overlay?.classList.add("show");
  });

  overlay?.addEventListener("click", () => {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("show");
  });

  closeBtn?.addEventListener("click", () => {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("show");
  });
}

// ==============================
// NAVIGATION
// ==============================
function initNavigation() {
  // HTML uses class="nav-item" with data-page attribute
  document.querySelectorAll(".nav-item[data-page]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) {
        navigateTo(page);
        // Close mobile sidebar
        document.getElementById("sidebar")?.classList.remove("open");
        document.getElementById("sidebarOverlay")?.classList.remove("show");
      }
    });
  });
}

// Expose globally for inline onclick calls in HTML
window.navigateTo = function (page) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  // HTML uses class="nav-item" not "nav-link"
  document
    .querySelectorAll(".nav-item[data-page]")
    .forEach((l) => l.classList.remove("active"));

  const pageEl = document.getElementById("page-" + page);
  if (!pageEl) return;
  pageEl.classList.add("active");

  const navLink = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navLink) navLink.classList.add("active");

  const titles = {
    dashboard: "Dashboard",
    orders: "Orders",
    riders: "Riders",
    stores: "Stores",
    products: "Products",
    users: "Users",
    payments: "Payment Settings",
    delivery: "Shipping Areas",
  };
  const topbarTitle = document.getElementById("topbarTitle");
  if (topbarTitle) topbarTitle.textContent = titles[page] || page;

  loadPageData(page);
};

// Also keep as local function
function navigateTo(page) {
  window.navigateTo(page);
}

// ==============================
// LOAD DATA BY PAGE
// ==============================
function loadPageData(page) {
  if (page !== "orders" && page !== "dashboard" && unsubOrders) {
    unsubOrders();
    unsubOrders = null;
  }
  if (page !== "delivery" && unsubShippingAreas) {
    unsubShippingAreas();
    unsubShippingAreas = null;
  }

  switch (page) {
    case "dashboard":
      loadDashboard();
      break;
    case "orders":
      loadOrders();
      break;
    case "riders":
      loadRiders();
      break;
    case "stores":
      loadStores();
      break;
    case "products":
      loadProducts();
      break;
    case "users":
      loadUsers();
      break;
    case "payments":
      loadPaymentSettings();
      break;
    case "delivery":
      loadShippingAreas();
      break;
  }
}

// ==============================
// DASHBOARD PAGE
// ==============================
async function loadDashboard() {
  const ordersQ = query(
    collection(db, "orders"),
    orderBy("created_at", "desc"),
  );

  if (unsubOrders) unsubOrders();

  unsubOrders = onSnapshot(
    ordersQ,
    (snap) => {
      const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // HTML uses id="statOrders" (not "statTotalOrders")
      const statOrders = document.getElementById("statOrders");
      if (statOrders) statOrders.textContent = orders.length.toLocaleString();

      const revenue = orders
        .filter((o) => o.payment_status === "paid")
        .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
      const statRevenue = document.getElementById("statRevenue");
      if (statRevenue)
        statRevenue.textContent = "৳ " + revenue.toLocaleString();

      // Pending badge — HTML uses id="pendingBadge"
      const pending = orders.filter((o) => o.status === "pending").length;
      const navBadge = document.getElementById("pendingBadge");
      if (navBadge) {
        navBadge.textContent = pending;
        navBadge.style.display = pending > 0 ? "inline-flex" : "none";
      }

      // HTML uses id="recentOrdersBody"
      renderRecentOrders(orders.slice(0, 10));
    },
    (err) => {
      console.error("Orders snapshot error:", err);
      showToast("Failed to load orders.", "error");
    },
  );

  // Riders count — HTML uses id="statRiders"
  try {
    const ridersSnap = await getDocs(
      query(collection(db, "users"), where("role", "==", "rider")),
    );
    const statRiders = document.getElementById("statRiders");
    if (statRiders) statRiders.textContent = ridersSnap.size.toLocaleString();
  } catch (err) {
    console.error("Riders count error:", err);
    const el = document.getElementById("statRiders");
    if (el) el.textContent = "—";
  }

  // Stores count — HTML uses id="statStores"
  try {
    const storesSnap = await getDocs(
      query(collection(db, "users"), where("role", "==", "store_admin")),
    );
    const statStores = document.getElementById("statStores");
    if (statStores) statStores.textContent = storesSnap.size.toLocaleString();
  } catch (err) {
    console.error("Stores count error:", err);
    const el = document.getElementById("statStores");
    if (el) el.textContent = "—";
  }
}

function renderRecentOrders(orders) {
  // HTML uses id="recentOrdersBody"
  const tbody = document.getElementById("recentOrdersBody");
  if (!tbody) return;

  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="td-empty">No orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders
    .map(
      (o) => `
    <tr>
      <td class="td-mono">${escHtml(o.order_id || o.id.slice(0, 8))}</td>
      <td>${escHtml(o.customer_name || "—")}</td>
      <td>৳ ${formatNum(o.total)}</td>
      <td>${paymentBadge(o.payment_status)}</td>
      <td>${statusBadge(o.status)}</td>
      <td>${formatTimestamp(o.created_at)}</td>
    </tr>
  `,
    )
    .join("");
}

// ==============================
// ORDERS PAGE
// ==============================
function loadOrders() {
  const ordersQ = query(
    collection(db, "orders"),
    orderBy("created_at", "desc"),
  );

  if (unsubOrders) unsubOrders();

  unsubOrders = onSnapshot(
    ordersQ,
    (snap) => {
      const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      window._allOrders = orders;
      filterAndRenderOrders(
        orders,
        currentOrderFilter,
        document.getElementById("orderSearch")?.value || "",
      );
    },
    (err) => {
      console.error("Orders listener error:", err);
      showToast("Failed to load orders.", "error");
    },
  );

  loadActiveRiders();
}

function filterAndRenderOrders(orders, filter, search) {
  let filtered = orders;
  if (filter && filter !== "all") {
    filtered = filtered.filter((o) => o.status === filter);
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (o) =>
        (o.order_id || "").toLowerCase().includes(s) ||
        (o.customer_name || "").toLowerCase().includes(s) ||
        (o.contact_number || "").includes(s),
    );
  }
  renderOrdersTable(filtered);
}

function renderOrdersTable(orders) {
  // HTML uses id="ordersTableBody"
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;

  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="td-empty">No orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders
    .map(
      (o) => `
    <tr>
      <td class="td-mono">${escHtml(o.order_id || o.id.slice(0, 8))}</td>
      <td>${escHtml(o.customer_name || "—")}</td>
      <td>৳ ${formatNum(o.total)}</td>
      <td>${paymentBadge(o.payment_status)}</td>
      <td>${statusBadge(o.status)}</td>
      <td>${formatTimestamp(o.created_at)}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-sm btn-ghost" onclick="openOrderModal('${o.id}')">Details</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteOrder('${o.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

async function loadActiveRiders() {
  try {
    const snap = await getDocs(
      query(
        collection(db, "users"),
        where("role", "==", "rider"),
        where("status", "==", "active"),
      ),
    );
    activeRiders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Load riders error:", err);
    activeRiders = [];
  }
}

// ==============================
// ORDER MODAL
// ==============================
window.openOrderModal = async function (docId) {
  currentOrderId = docId;
  // HTML uses id="orderModalOverlay"
  openModal("orderModalOverlay");

  const bodyEl = document.getElementById("orderModalBody");
  if (bodyEl)
    bodyEl.innerHTML = `<div style="text-align:center;padding:40px"><div class="spinner-sm"></div></div>`;

  try {
    const snap = await getDoc(doc(db, "orders", docId));
    if (!snap.exists()) {
      showToast("Order not found.", "error");
      closeModal("orderModalOverlay");
      return;
    }
    const o = { id: snap.id, ...snap.data() };

    const titleEl = document.getElementById("orderModalTitle");
    if (titleEl)
      titleEl.textContent = `Order — ${o.order_id || o.id.slice(0, 8)}`;

    const itemsHtml =
      Array.isArray(o.items) && o.items.length
        ? o.items
            .map(
              (item) => `
          <div class="order-item">
            <span class="order-item-name">${escHtml(item.name || item.pd_name || "—")}</span>
            <span class="order-item-qty">× ${item.quantity || 1}</span>
            <span class="order-item-price">৳ ${formatNum(item.total || item.price)}</span>
          </div>`,
            )
            .join("")
        : '<p style="color:var(--text-3);font-size:13px">No items data.</p>';

    if (bodyEl)
      bodyEl.innerHTML = `
      <div class="order-detail-grid">
        <div class="order-detail-row"><div class="od-label">Customer</div><div class="od-val">${escHtml(o.customer_name || "—")}</div></div>
        <div class="order-detail-row"><div class="od-label">Phone</div><div class="od-val">${escHtml(o.contact_number || "—")}</div></div>
        <div class="order-detail-row"><div class="od-label">Address</div><div class="od-val">${escHtml(o.delivery_address || "—")}</div></div>
        <div class="order-detail-row"><div class="od-label">Payment</div><div class="od-val">${escHtml(o.payment_method || "—")} — ${paymentBadge(o.payment_status)}</div></div>
        <div class="order-detail-row"><div class="od-label">Transaction ID</div><div class="od-val" style="font-family:monospace;font-size:12px">${escHtml(o.transaction_id || "—")}</div></div>
        <div class="order-detail-row"><div class="od-label">Subtotal</div><div class="od-val">৳ ${formatNum(o.subtotal)}</div></div>
        <div class="order-detail-row"><div class="od-label">Delivery Fee</div><div class="od-val">৳ ${formatNum(o.delivery_fee)}</div></div>
        <div class="order-detail-row"><div class="od-label">Total</div><div class="od-val" style="color:var(--primary);font-size:16px">৳ ${formatNum(o.total)}</div></div>
        <div class="order-detail-row"><div class="od-label">Store ID</div><div class="od-val" style="font-size:12px">${escHtml(o.store_id || "—")}</div></div>
        <div class="order-detail-row"><div class="od-label">Note</div><div class="od-val">${escHtml(o.note || "—")}</div></div>
        <div class="order-detail-row"><div class="od-label">Ordered</div><div class="od-val">${formatTimestamp(o.created_at)}</div></div>
        <div class="order-detail-row"><div class="od-label">Status</div><div class="od-val">${statusBadge(o.status)}</div></div>
      </div>
      <div class="order-items-wrap">
        <div class="order-items-title">Order Items</div>
        ${itemsHtml}
      </div>
      <div class="order-actions-wrap">
        <div class="order-actions-row">
          <span class="order-actions-label">Update Status</span>
          <select id="orderStatusSelect" class="status-select">
            <option value="pending" ${o.status === "pending" ? "selected" : ""}>Pending</option>
            <option value="Preparing" ${o.status === "preparing" ? "selected" : ""}>Preparing</option>
            <option value="Ready" ${o.status === "ready" ? "selected" : ""}>Ready</option>
            <option value="delivered" ${o.status === "delivered" ? "selected" : ""}>Delivered</option>
            <option value="cancelled" ${o.status === "cancelled" ? "selected" : ""}>Cancelled</option>
          </select>
        </div>
        <div class="order-actions-row">
          <span class="order-actions-label">Assign Rider</span>
          <select id="orderRiderSelect" class="status-select">
            <option value="">— Select Rider —</option>
            ${activeRiders.map((r) => `<option value="${r.id}" ${o.rider === r.id ? "selected" : ""}>${escHtml(r.name || r.id)}</option>`).join("")}
          </select>
        </div>
        <div class="order-actions-row">
          <span class="order-actions-label">Payment Status</span>
          <select id="orderPaymentSelect" class="status-select">
            <option value="Paid" ${o.payment_status === "Paid" ? "selected" : ""}>Paid</option>
            <option value="Unpaid" ${o.payment_status === "Unpaid" ? "selected" : ""}>Unpaid</option>
          </select>
        </div>
        <div class="order-actions-row">
          <span class="order-actions-label">Delivery Fee</span>
          <input type="number" id="orderDeliveryFeeInput" class="form-input" style="width:120px" value="${o.delivery_fee || ""}" placeholder="Fee" />
        </div>
        <div class="order-actions-row" style="justify-content:flex-end;gap:10px">
          <button class="btn btn-danger btn-sm" onclick="confirmDeleteOrder('${o.id}', true)">Delete Order</button>
          <button class="btn btn-primary btn-sm" onclick="saveOrderChanges()">Save Changes</button>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Open order modal error:", err);
    if (bodyEl)
      bodyEl.innerHTML = `<p style="color:var(--danger)">Failed to load order.</p>`;
  }
};

window.saveOrderChanges = async function () {
  if (!currentOrderId) return;
  const newStatus = document.getElementById("orderStatusSelect")?.value;
  const newStatusPayment = document.getElementById("orderPaymentSelect")?.value;
  const newRider = document.getElementById("orderRiderSelect")?.value;
  const newFee = document.getElementById("orderDeliveryFeeInput")?.value;

  try {
    const updates = {};
    if (newStatus) updates.status = newStatus;
    if (newStatusPayment) updates.payment_status = newStatusPayment;
    if (newRider) updates.rider = newRider;
    if (newFee !== "") updates.delivery_fee = newFee;

    await updateDoc(doc(db, "orders", currentOrderId), updates);
    showToast("Order updated successfully!", "success");
    closeModal("orderModalOverlay");
  } catch (err) {
    console.error("Save order error:", err);
    showToast("Failed to update order.", "error");
  }
};

window.confirmDeleteOrder = function (docId, fromModal = false) {
  currentOrderId = docId;
  if (
    !confirm(
      "Are you sure you want to permanently delete this order? This cannot be undone.",
    )
  )
    return;
  deleteOrder(docId, fromModal);
};

async function deleteOrder(docId, fromModal) {
  try {
    await deleteDoc(doc(db, "orders", docId));
    showToast("Order deleted.", "success");
    if (fromModal) closeModal("orderModalOverlay");
  } catch (err) {
    console.error("Delete order error:", err);
    showToast("Failed to delete order.", "error");
  }
}

// ==============================
// RIDERS PAGE
// ==============================
async function loadRiders() {
  // HTML uses id="ridersTableBody"
  const tbody = document.getElementById("ridersTableBody");
  if (tbody)
    tbody.innerHTML = `<tr><td colspan="5" class="td-loading"><div class="spinner-sm"></div></td></tr>`;

  try {
    const snap = await getDocs(
      query(collection(db, "users"), where("role", "==", "rider")),
    );
    const riders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    window._allRiders = riders;
    renderRidersTable(riders);

    const searchEl = document.getElementById("riderSearch");
    if (searchEl) {
      // Remove old listener by cloning
      const newSearch = searchEl.cloneNode(true);
      searchEl.parentNode.replaceChild(newSearch, searchEl);
      newSearch.addEventListener("input", function () {
        const s = this.value.toLowerCase();
        renderRidersTable(
          riders.filter(
            (r) =>
              (r.name || "").toLowerCase().includes(s) ||
              (r.phone_number || "").includes(s),
          ),
        );
      });
    }
  } catch (err) {
    console.error("Load riders error:", err);
    if (tbody)
      tbody.innerHTML = `<tr><td colspan="5" class="td-empty" style="color:var(--danger)">Failed to load riders.</td></tr>`;
  }
}

function renderRidersTable(riders) {
  const tbody = document.getElementById("ridersTableBody");
  if (!tbody) return;
  if (!riders.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="td-empty">No riders found.</td></tr>`;
    return;
  }
  tbody.innerHTML = riders
    .map(
      (r) => `
    <tr>
      <td>${escHtml(r.name || "—")}</td>
      <td>${escHtml(r.phone_number || "—")}</td>
      <td style="font-size:12px;color:var(--text-3)">${escHtml(r.address || "—")}</td>
      <td>${riderStatusBadge(r.status)}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-sm btn-ghost" onclick="openRiderModal('${r.id}')">Details</button>
          ${
            r.status === "active"
              ? `<button class="btn btn-sm btn-warn" onclick="toggleRiderStatus('${r.id}','inactive')">Suspend</button>`
              : `<button class="btn btn-sm btn-success" onclick="toggleRiderStatus('${r.id}','active')">Activate</button>`
          }
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

window.openRiderModal = async function (docId) {
  currentRiderId = docId;
  // HTML uses id="riderModalOverlay"
  openModal("riderModalOverlay");

  const bodyEl = document.getElementById("riderModalBody");
  if (bodyEl)
    bodyEl.innerHTML = `<div style="text-align:center;padding:40px"><div class="spinner-sm"></div></div>`;

  try {
    const snap = await getDoc(doc(db, "users", docId));
    if (!snap.exists()) {
      closeModal("riderModalOverlay");
      return;
    }
    const r = { id: snap.id, ...snap.data() };

    if (bodyEl)
      bodyEl.innerHTML = `
      <div class="detail-row"><span class="detail-label">Name</span><span class="detail-val">${escHtml(r.name || "—")}</span></div>
      <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-val">${escHtml(r.phone_number || "—")}</span></div>
      <div class="detail-row"><span class="detail-label">Address</span><span class="detail-val">${escHtml(r.address || "—")}</span></div>
      <div class="detail-row"><span class="detail-label">Status</span><span class="detail-val">${riderStatusBadge(r.status)}</span></div>
      <div class="detail-row"><span class="detail-label">Role</span><span class="detail-val">${escHtml(r.role || "rider")}</span></div>
      <div class="detail-row"><span class="detail-label">User ID</span><span class="detail-val" style="font-family:monospace;font-size:12px">${r.id}</span></div>
      <div class="form-actions" style="margin-top:16px">
        ${
          r.status === "active"
            ? `<button class="btn btn-warn" onclick="toggleRiderStatus('${r.id}','inactive',true)">Suspend Rider</button>`
            : `<button class="btn btn-success" onclick="toggleRiderStatus('${r.id}','active',true)">Activate Rider</button>`
        }
      </div>
    `;
  } catch (err) {
    console.error("Rider modal error:", err);
    if (bodyEl)
      bodyEl.innerHTML = `<p style="color:var(--danger)">Failed to load rider.</p>`;
  }
};

window.toggleRiderStatus = async function (
  docId,
  newStatus,
  fromModal = false,
) {
  try {
    await updateDoc(doc(db, "users", docId), { status: newStatus });
    showToast(
      `Rider ${newStatus === "active" ? "activated" : "suspended"}.`,
      "success",
    );
    if (fromModal) closeModal("riderModalOverlay");
    loadRiders();
  } catch (err) {
    console.error("Toggle rider error:", err);
    showToast("Failed to update rider.", "error");
  }
};

// ==============================
// STORES PAGE
// ==============================
async function loadStores() {
  // HTML uses id="storesTableBody"
  const tbody = document.getElementById("storesTableBody");
  if (tbody)
    tbody.innerHTML = `<tr><td colspan="6" class="td-loading"><div class="spinner-sm"></div></td></tr>`;

  try {
    const snap = await getDocs(
      query(collection(db, "users"), where("role", "==", "store_admin")),
    );
    const stores = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    window._allStores = stores;
    renderStoresTable(stores);

    const searchEl = document.getElementById("storeSearch");
    if (searchEl) {
      const newSearch = searchEl.cloneNode(true);
      searchEl.parentNode.replaceChild(newSearch, searchEl);
      newSearch.addEventListener("input", function () {
        const s = this.value.toLowerCase();
        renderStoresTable(
          stores.filter(
            (st) =>
              (st.store_name || "").toLowerCase().includes(s) ||
              (st.name || "").toLowerCase().includes(s),
          ),
        );
      });
    }
  } catch (err) {
    console.error("Load stores error:", err);
    if (tbody)
      tbody.innerHTML = `<tr><td colspan="6" class="td-empty" style="color:var(--danger)">Failed to load stores.</td></tr>`;
  }
}

function renderStoresTable(stores) {
  const tbody = document.getElementById("storesTableBody");
  if (!tbody) return;
  if (!stores.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="td-empty">No stores found.</td></tr>`;
    return;
  }
  tbody.innerHTML = stores
    .map(
      (s) => `
    <tr>
      <td>${escHtml(s.store_name || "—")}</td>
      <td>${escHtml(s.name || "—")}</td>
      <td>${escHtml(s.phone_number || "—")}</td>
      <td style="font-size:12px;color:var(--text-3)">${escHtml(s.store_address || "—")}</td>
      <td>${riderStatusBadge(s.status || "active")}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-sm btn-ghost" onclick="openStoreModal('${s.id}')">Details</button>
          ${
            (s.status || "active") === "active"
              ? `<button class="btn btn-sm btn-warn" onclick="toggleStoreStatus('${s.id}','inactive')">Suspend</button>`
              : `<button class="btn btn-sm btn-success" onclick="toggleStoreStatus('${s.id}','active')">Activate</button>`
          }
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

window.openStoreModal = async function (docId) {
  currentStoreId = docId;
  // HTML uses id="storeModalOverlay"
  openModal("storeModalOverlay");

  const bodyEl = document.getElementById("storeModalBody");
  if (bodyEl)
    bodyEl.innerHTML = `<div style="text-align:center;padding:40px"><div class="spinner-sm"></div></div>`;

  try {
    const snap = await getDoc(doc(db, "users", docId));
    if (!snap.exists()) {
      closeModal("storeModalOverlay");
      return;
    }
    const s = { id: snap.id, ...snap.data() };
    const curStatus = s.status || "active";

    if (bodyEl)
      bodyEl.innerHTML = `
      <div class="detail-row"><span class="detail-label">Store Name</span><span class="detail-val">${escHtml(s.store_name || "—")}</span></div>
      <div class="detail-row"><span class="detail-label">Owner Name</span><span class="detail-val">${escHtml(s.name || "—")}</span></div>
      <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-val">${escHtml(s.phone_number || "—")}</span></div>
      <div class="detail-row"><span class="detail-label">Store Address</span><span class="detail-val">${escHtml(s.store_address || "—")}</span></div>
      <div class="detail-row"><span class="detail-label">Address</span><span class="detail-val">${escHtml(s.address || "—")}</span></div>
      <div class="detail-row"><span class="detail-label">Status</span><span class="detail-val">${riderStatusBadge(curStatus)}</span></div>
      <div class="detail-row"><span class="detail-label">Store ID</span><span class="detail-val" style="font-family:monospace;font-size:12px">${s.id}</span></div>
      <div class="form-actions" style="margin-top:16px">
        ${
          curStatus === "active"
            ? `<button class="btn btn-warn" onclick="toggleStoreStatus('${s.id}','inactive',true)">Suspend Store</button>`
            : `<button class="btn btn-success" onclick="toggleStoreStatus('${s.id}','active',true)">Activate Store</button>`
        }
      </div>
    `;
  } catch (err) {
    console.error("Store modal error:", err);
    if (bodyEl)
      bodyEl.innerHTML = `<p style="color:var(--danger)">Failed to load store.</p>`;
  }
};

window.toggleStoreStatus = async function (
  docId,
  newStatus,
  fromModal = false,
) {
  try {
    await updateDoc(doc(db, "users", docId), { status: newStatus });
    showToast(
      `Store ${newStatus === "active" ? "activated" : "suspended"}.`,
      "success",
    );
    if (fromModal) closeModal("storeModalOverlay");
    loadStores();
  } catch (err) {
    console.error("Toggle store error:", err);
    showToast("Failed to update store.", "error");
  }
};

// ==============================
// PRODUCTS PAGE
// ==============================
async function loadProducts() {
  // HTML uses id="productsTableBody"
  const tbody = document.getElementById("productsTableBody");
  if (tbody)
    tbody.innerHTML = `<tr><td colspan="6" class="td-loading"><div class="spinner-sm"></div></td></tr>`;

  try {
    const snap = await getDocs(
      query(collection(db, "products"), orderBy("created_at", "desc")),
    );
    const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    window._allProducts = products;
    renderProductsTable(products);

    const searchEl = document.getElementById("productSearch");
    if (searchEl) {
      const newSearch = searchEl.cloneNode(true);
      searchEl.parentNode.replaceChild(newSearch, searchEl);
      newSearch.addEventListener("input", function () {
        const s = this.value.toLowerCase();
        renderProductsTable(
          products.filter(
            (p) =>
              (p.pd_name || "").toLowerCase().includes(s) ||
              (p.store_id || "").toLowerCase().includes(s),
          ),
        );
      });
    }
  } catch (err) {
    console.error("Load products error:", err);
    if (tbody)
      tbody.innerHTML = `<tr><td colspan="6" class="td-empty" style="color:var(--danger)">Failed to load products.</td></tr>`;
  }
}

function renderProductsTable(products) {
  const tbody = document.getElementById("productsTableBody");
  if (!tbody) return;
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="td-empty">No products found.</td></tr>`;
    return;
  }
  tbody.innerHTML = products
    .map(
      (p) => `
    <tr>
      <td>
        ${
          p.pd_image
            ? `<img src="${escHtml(p.pd_image)}" class="td-img" alt="${escHtml(p.pd_name)}" onerror="this.style.display='none'" />`
            : `<div class="td-img-placeholder">🖼</div>`
        }
      </td>
      <td>${escHtml(p.pd_name || "—")}</td>
      <td class="td-desc" style="max-width:200px">${escHtml((p.pd_description || "").slice(0, 60))}${(p.pd_description || "").length > 60 ? "..." : ""}</td>
      <td>৳ ${formatNum(p.pd_price)}</td>
      <td style="font-size:12px;font-family:monospace">${escHtml(p.store_id || "—")}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-sm btn-ghost" onclick="openProductModal('${p.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

window.openProductModal = async function (docId = null) {
  currentProductId = docId;
  const docIdEl = document.getElementById("productDocId");
  if (docIdEl) docIdEl.value = docId || "";

  const titleEl = document.getElementById("productModalTitle");

  if (docId) {
    if (titleEl) titleEl.textContent = "Edit Product";
    try {
      const snap = await getDoc(doc(db, "products", docId));
      if (snap.exists()) {
        const p = snap.data();
        document.getElementById("pdName").value = p.pd_name || "";
        document.getElementById("pdDesc").value = p.pd_description || "";
        document.getElementById("pdPrice").value = p.pd_price || "";
        document.getElementById("pdStoreId").value = p.store_id || "";
        document.getElementById("pdImage").value = p.pd_image || "";
      }
    } catch (err) {
      console.error("Load product for edit error:", err);
    }
  } else {
    if (titleEl) titleEl.textContent = "Add Product";
    document.getElementById("pdName").value = "";
    document.getElementById("pdDesc").value = "";
    document.getElementById("pdPrice").value = "";
    document.getElementById("pdStoreId").value = "";
    document.getElementById("pdImage").value = "";
  }

  // HTML uses id="productModalOverlay"
  openModal("productModalOverlay");
};

async function saveProduct() {
  const name = document.getElementById("pdName").value.trim();
  const desc = document.getElementById("pdDesc").value.trim();
  const price = document.getElementById("pdPrice").value;
  const storeId = document.getElementById("pdStoreId").value.trim();
  const image = document.getElementById("pdImage").value.trim();

  if (!name || !price || !storeId) {
    showToast("Name, Price and Store ID are required.", "error");
    return;
  }

  const data = {
    pd_name: name,
    pd_description: desc,
    pd_price: parseFloat(price),
    store_id: storeId,
    pd_image: image,
  };

  try {
    if (currentProductId) {
      await updateDoc(doc(db, "products", currentProductId), data);
      showToast("Product updated!", "success");
    } else {
      data.created_at = serverTimestamp();
      await addDoc(collection(db, "products"), data);
      showToast("Product added!", "success");
    }
    closeModal("productModalOverlay");
    loadProducts();
  } catch (err) {
    console.error("Save product error:", err);
    showToast("Failed to save product.", "error");
  }
}

window.deleteProduct = async function (docId) {
  if (!confirm("Delete this product? This cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "products", docId));
    showToast("Product deleted.", "success");
    loadProducts();
  } catch (err) {
    console.error("Delete product error:", err);
    showToast("Failed to delete product.", "error");
  }
};

// ==============================
// USERS PAGE
// ==============================
async function loadUsers() {
  // HTML uses id="usersTableBody"
  const tbody = document.getElementById("usersTableBody");
  if (tbody)
    tbody.innerHTML = `<tr><td colspan="5" class="td-loading"><div class="spinner-sm"></div></td></tr>`;

  try {
    const snap = await getDocs(
      query(collection(db, "users"), where("role", "==", "users")),
    );
    const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    window._allUsers = users;
    renderUsersTable(users);

    const searchEl = document.getElementById("userSearch");
    if (searchEl) {
      const newSearch = searchEl.cloneNode(true);
      searchEl.parentNode.replaceChild(newSearch, searchEl);
      newSearch.addEventListener("input", function () {
        const s = this.value.toLowerCase();
        renderUsersTable(
          users.filter(
            (u) =>
              (u.name || "").toLowerCase().includes(s) ||
              (u.phone_number || "").includes(s),
          ),
        );
      });
    }
  } catch (err) {
    console.error("Load users error:", err);
    if (tbody)
      tbody.innerHTML = `<tr><td colspan="5" class="td-empty" style="color:var(--danger)">Failed to load users.</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;
  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="td-empty">No users found.</td></tr>`;
    return;
  }
  tbody.innerHTML = users
    .map(
      (u) => `
    <tr>
      <td>${escHtml(u.name || "—")}</td>
      <td>${escHtml(u.phone_number || "—")}</td>
      <td style="font-size:12px;color:var(--text-3)">${escHtml(u.address || "—")}</td>
      <td>${riderStatusBadge(u.status || "active")}</td>
      <td>
        <div class="actions-cell">
          ${
            (u.status || "active") === "active"
              ? `<button class="btn btn-sm btn-danger" onclick="toggleUserStatus('${u.id}','inactive')">Block</button>`
              : `<button class="btn btn-sm btn-success" onclick="toggleUserStatus('${u.id}','active')">Unblock</button>`
          }
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

window.toggleUserStatus = async function (docId, newStatus) {
  try {
    await updateDoc(doc(db, "users", docId), { status: newStatus });
    showToast(
      `User ${newStatus === "active" ? "unblocked" : "blocked"}.`,
      "success",
    );
    loadUsers();
  } catch (err) {
    console.error("Toggle user error:", err);
    showToast("Failed to update user.", "error");
  }
};

// ==============================
// PAYMENT SETTINGS
// ==============================
async function loadPaymentSettings() {
  try {
    const snap = await getDocs(collection(db, "adminPaymentNum"));
    if (!snap.empty) {
      const data = snap.docs[0].data();
      // HTML uses id="bkashNumber" and id="nagadNumber"
      const bkashEl = document.getElementById("bkashNumber");
      const nagadEl = document.getElementById("nagadNumber");
      if (bkashEl) bkashEl.value = data.Bkash || "";
      if (nagadEl) nagadEl.value = data.nagat || "";
      window._paymentDocId = snap.docs[0].id;
    }
  } catch (err) {
    console.error("Load payment settings error:", err);
    showToast("Failed to load payment settings.", "error");
  }
}

async function savePaymentSettings(type) {
  // HTML uses id="bkashNumber" and id="nagadNumber"
  const bkash = document.getElementById("bkashNumber")?.value.trim();
  const nagad = document.getElementById("nagadNumber")?.value.trim();

  if (type === "bkash" && !bkash) {
    showToast("Please enter a bKash number.", "error");
    return;
  }
  if (type === "nagad" && !nagad) {
    showToast("Please enter a Nagad number.", "error");
    return;
  }

  try {
    const snap = await getDocs(collection(db, "adminPaymentNum"));
    const updates = {};
    if (type === "bkash") updates.Bkash = bkash;
    if (type === "nagad") updates.nagat = nagad;

    if (!snap.empty) {
      await updateDoc(doc(db, "adminPaymentNum", snap.docs[0].id), updates);
    } else {
      await addDoc(collection(db, "adminPaymentNum"), {
        Bkash: bkash || "",
        nagat: nagad || "",
      });
    }
    showToast(
      `${type === "bkash" ? "bKash" : "Nagad"} number saved!`,
      "success",
    );
  } catch (err) {
    console.error("Save payment settings error:", err);
    showToast("Failed to save payment settings.", "error");
  }
}

// ==============================
// SHIPPING AREAS (area-based delivery fee)
// ==============================
let unsubShippingAreas = null;

function loadShippingAreas() {
  const tbody = document.getElementById("shippingAreasBody");
  const countBadge = document.getElementById("areaCountBadge");

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="3" class="td-loading"><div class="spinner-sm"></div></td></tr>`;
  }

  if (unsubShippingAreas) {
    unsubShippingAreas();
    unsubShippingAreas = null;
  }

  const areasCol = collection(db, "shipping_area");

  unsubShippingAreas = onSnapshot(
    areasCol,
    (snap) => {
      const areas = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.area || "").localeCompare(b.area || ""));

      if (countBadge) {
        countBadge.textContent = `${areas.length} area${areas.length !== 1 ? "s" : ""}`;
      }

      if (!tbody) return;

      if (!areas.length) {
        tbody.innerHTML = `<tr><td colspan="3" class="td-empty">No shipping areas yet. Add one above.</td></tr>`;
        return;
      }

      tbody.innerHTML = areas
        .map(
          (a) => `
          <tr>
            <td class="area-name-cell">
              <span class="area-name-text">${escHtml(a.area || "—")}</span>
            </td>
            <td>
              <span class="area-fee-badge">৳ ${formatNum(a.fee)}</span>
            </td>
            <td>
              <div class="action-btns">
                <button class="btn btn-sm btn-outline-primary" onclick="openEditAreaModal('${escHtml(a.id)}','${escHtml(a.area || "")}',${parseFloat(a.fee) || 0})">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
                <button class="btn btn-sm btn-danger-outline" onclick="deleteShippingArea('${escHtml(a.id)}','${escHtml(a.area || "")}')">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `,
        )
        .join("");
    },
    (err) => {
      console.error("Shipping areas snapshot error:", err);
      showToast("Failed to load shipping areas.", "error");
    },
  );
}

async function addShippingArea() {
  const nameInput = document.getElementById("newAreaName");
  const feeInput = document.getElementById("newAreaFee");
  const btn = document.getElementById("addAreaBtn");

  const name = nameInput?.value.trim();
  const feeRaw = feeInput?.value.trim();

  if (!name) {
    showToast("Please enter an area name.", "error");
    nameInput?.focus();
    return;
  }
  if (!feeRaw || isNaN(Number(feeRaw)) || Number(feeRaw) < 0) {
    showToast("Please enter a valid delivery fee.", "error");
    feeInput?.focus();
    return;
  }

  const fee = Number(feeRaw);
  if (btn) btn.disabled = true;

  try {
    await addDoc(collection(db, "shipping_area"), {
      area: name,
      fee: fee,
    });
    showToast(`"${name}" added with ৳${fee} fee!`, "success");
    if (nameInput) nameInput.value = "";
    if (feeInput) feeInput.value = "";
  } catch (err) {
    console.error("Add shipping area error:", err);
    showToast("Failed to add area.", "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

window.openEditAreaModal = function (docId, areaName, fee) {
  document.getElementById("editAreaDocId").value = docId;
  document.getElementById("editAreaName").value = areaName;
  document.getElementById("editAreaFee").value = fee;
  openModal("editAreaModalOverlay");
};

async function saveEditArea() {
  const docId = document.getElementById("editAreaDocId")?.value;
  const name = document.getElementById("editAreaName")?.value.trim();
  const feeRaw = document.getElementById("editAreaFee")?.value.trim();
  const btn = document.getElementById("saveEditAreaBtn");

  if (!docId) return;

  if (!name) {
    showToast("Area name cannot be empty.", "error");
    return;
  }
  if (!feeRaw || isNaN(Number(feeRaw)) || Number(feeRaw) < 0) {
    showToast("Please enter a valid delivery fee.", "error");
    return;
  }

  const fee = Number(feeRaw);
  if (btn) btn.disabled = true;

  try {
    await updateDoc(doc(db, "shipping_area", docId), {
      area: name,
      fee: fee,
    });
    showToast(`Area updated successfully!`, "success");
    closeModal("editAreaModalOverlay");
  } catch (err) {
    console.error("Update shipping area error:", err);
    showToast("Failed to update area.", "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

window.deleteShippingArea = async function (docId, areaName) {
  if (!confirm(`Delete "${areaName}"? This cannot be undone.`)) return;
  try {
    await deleteDoc(doc(db, "shipping_area", docId));
    showToast(`"${areaName}" deleted.`, "success");
  } catch (err) {
    console.error("Delete shipping area error:", err);
    showToast("Failed to delete area.", "error");
  }
};

// ==============================
// SEARCH & FILTER INIT
// ==============================
function initSearchFilters() {
  // Orders filter tabs — HTML uses class="filter-tab" with data-val attribute
  const orderTabs = document.getElementById("orderFilterTabs");
  if (orderTabs) {
    orderTabs.addEventListener("click", (e) => {
      const tab = e.target.closest(".filter-tab");
      if (!tab) return;
      orderTabs
        .querySelectorAll(".filter-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentOrderFilter = tab.dataset.val; // HTML uses data-val not data-filter
      if (window._allOrders) {
        filterAndRenderOrders(
          window._allOrders,
          currentOrderFilter,
          document.getElementById("orderSearch")?.value || "",
        );
      }
    });
  }

  // Order search
  document
    .getElementById("orderSearch")
    ?.addEventListener("input", function () {
      if (window._allOrders) {
        filterAndRenderOrders(
          window._allOrders,
          currentOrderFilter,
          this.value,
        );
      }
    });
}

// ==============================
// MODAL HELPERS
// ==============================
window.openModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("open");
};

window.closeModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
};

// ==============================
// TOAST NOTIFICATIONS
// ==============================
function showToast(message, type = "info") {
  // HTML uses id="toastWrap"
  const container = document.getElementById("toastWrap");
  if (!container) return;
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || "ℹ"}</span><span>${escHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("out");
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// ==============================
// BADGE HELPERS
// ==============================
function statusBadge(status) {
  const map = {
    pending: "badge-pending",
    preparing: "badge-preparing",
    ready: "badge-ready",
    delivered: "badge-delivered",
    cancelled: "badge-cancelled",
  };
  const cls = map[status] || "badge-pending";
  return `<span class="badge ${cls}">${capitalize(status || "pending")}</span>`;
}

function paymentBadge(status) {
  return status === "Paid"
    ? `<span class="badge badge-paid">Paid</span>`
    : `<span class="badge badge-unpaid">Unpaid</span>`;
}

function riderStatusBadge(status) {
  return status === "active"
    ? `<span class="badge badge-active">Active</span>`
    : `<span class="badge badge-inactive">Inactive</span>`;
}

// ==============================
// UTILITY FUNCTIONS
// ==============================
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNum(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return n.toLocaleString("en-BD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatTimestamp(ts) {
  if (!ts) return "—";
  let date;
  if (ts.toDate) {
    date = ts.toDate();
  } else if (ts.seconds) {
    date = new Date(ts.seconds * 1000);
  } else {
    date = new Date(ts);
  }
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}