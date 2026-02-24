
alert("ff");
/**
 * ================================================================
 *  HATBAZAR GO — FIREBASE ADMIN DASHBOARD — script.js
 *  Firebase v9 Modular SDK (CDN)
 *  Features: Auth, Firestore Real-time, Full CRUD
 * ================================================================
 */

// ==============================
// FIREBASE CONFIGURATION
// Replace with your own Firebase project credentials
// ==============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
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
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ——— YOUR FIREBASE CONFIG ———
// IMPORTANT: Replace these values with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyC3diAg_MKhn1s2kt60poJFgLIuOm93dpI",
  authDomain: "hatbazargo-67035.firebaseapp.com",
  projectId: "hatbazargo-67035",
  storageBucket: "hatbazargo-67035.firebasestorage.app",
  messagingSenderId: "390651949826",
  appId: "1:390651949826:web:b399f67c269001fabd881b",
  measurementId: "G-X0VK6250SC"
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
let currentOrderId = null;    // Firestore doc ID for open order modal
let currentRiderId = null;    // Firestore doc ID for open rider modal
let currentStoreId = null;    // Firestore doc ID for open store modal
let currentProductId = null;  // Firestore doc ID for edit product modal
let activeRiders = [];        // Cache of active riders for assign dropdown
let sidebarCollapsed = false;
let currentOrderFilter = 'all';

// Unsubscribe handles for Firestore listeners (to prevent memory leaks)
let unsubOrders = null;
let unsubUsers = null;

// ==============================
// DOM READY
// ==============================
document.addEventListener('DOMContentLoaded', () => {
  initPageDate();
  initSidebar();
  initNavigation();
  initSearchFilters();
  initPasswordToggle();
  listenAuth();
});

// ==============================
// DATE DISPLAY
// ==============================
function initPageDate() {
  const el = document.getElementById('currentDate');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ==============================
// AUTH LISTENER
// ==============================
function listenAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Check if user has admin role in Firestore
      alert("44");
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          currentUser = { uid: user.uid, email: user.email, ...userDoc.data() };
          showApp();
          alert("4)";
        } else {
          // Not an admin — sign out and show error
          await signOut(auth);
          showLoginError('Access denied. Only admin accounts are allowed.');
        }
      } catch (err) {
        console.error('Error fetching user role:', err);
        await signOut(auth);
        showLoginError('Failed to verify admin access. Please try again.');
      }
    } else {
      currentUser = null;
      showLogin();
    }
  });
}

// ==============================
// SHOW / HIDE SCREENS
// ==============================
function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appShell').style.display = 'none';
}

function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';

  // Set admin display name
  const name = currentUser.name || currentUser.email?.split('@')[0] || 'Admin';
  const initial = name.charAt(0).toUpperCase();
  document.getElementById('sUserName').textContent = name;
  document.getElementById('sUserAvatar').textContent = initial;
  document.getElementById('topbarAvatar').textContent = initial;

  // Load initial page
  navigateTo('dashboard');
}

// ==============================
// LOGIN HANDLER
// ==============================
window.handleLogin = async function () {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginBtn');
  const btnText = document.getElementById('loginBtnText');
  const btnLoader = document.getElementById('loginBtnLoader');

  hideLoginError();

  if (!email || !password) {
    showLoginError('Please enter email and password.');
    return;
  }

  // Show loading state
  btn.disabled = true;
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline-block';

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will handle the rest
  } catch (err) {
    console.error('Login error:', err);
    const messages = {
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/invalid-credential': 'Invalid credentials. Please check and try again.',
    };
    showLoginError(messages[err.code] || `Login failed: ${err.message}`);
  } finally {
    btn.disabled = false;
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
  }
};

// Allow Enter key to submit login
document.getElementById('loginPassword')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});
document.getElementById('loginEmail')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});

// ==============================
// LOGOUT HANDLER
// ==============================
window.handleLogout = async function () {
  try {
    // Clean up listeners
    if (unsubOrders) { unsubOrders(); unsubOrders = null; }
    if (unsubUsers) { unsubUsers(); unsubUsers = null; }
    await signOut(auth);
    showToast('Logged out successfully.', 'info');
  } catch (err) {
    console.error('Logout error:', err);
    showToast('Logout failed.', 'error');
  }
};

// ==============================
// LOGIN UI HELPERS
// ==============================
function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = 'block';
}
function hideLoginError() {
  document.getElementById('loginError').style.display = 'none';
}

function initPasswordToggle() {
  const btn = document.getElementById('togglePw');
  const input = document.getElementById('loginPassword');
  if (!btn || !input) return;
  btn.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
  });
}

// ==============================
// SIDEBAR
// ==============================
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mainWrap = document.getElementById('mainWrap');
  const collapseBtn = document.getElementById('sidebarCollapseBtn');
  const hamburger = document.getElementById('hamburger');
  const overlay = document.getElementById('mobileOverlay');

  collapseBtn.addEventListener('click', () => {
    sidebarCollapsed = !sidebarCollapsed;
    sidebar.classList.toggle('collapsed', sidebarCollapsed);
    mainWrap.classList.toggle('collapsed', sidebarCollapsed);
  });

  hamburger.addEventListener('click', () => {
    sidebar.classList.add('mobile-open');
    overlay.classList.add('visible');
  });
}

window.closeMobileSidebar = function () {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('mobileOverlay').classList.remove('visible');
};

// ==============================
// NAVIGATION
// ==============================
function initNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) {
        navigateTo(page);
        closeMobileSidebar();
      }
    });
  });
}

function navigateTo(page) {
  // Update active page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (!pageEl) return;
  pageEl.classList.add('active');

  const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (navLink) navLink.classList.add('active');

  // Update topbar title
  const titles = {
    dashboard: 'Dashboard',
    orders: 'Orders',
    riders: 'Riders',
    stores: 'Stores',
    products: 'Products',
    users: 'Users',
    payments: 'Payment Settings',
    delivery: 'Delivery Fee Settings'
  };
  document.getElementById('topbarTitle').textContent = titles[page] || page;

  // Load page data
  loadPageData(page);
}

// ==============================
// LOAD DATA BY PAGE
// ==============================
function loadPageData(page) {
  // Clean up previous listeners
  if (page !== 'orders' && page !== 'dashboard' && unsubOrders) {
    unsubOrders(); unsubOrders = null;
  }

  switch (page) {
    case 'dashboard': loadDashboard(); break;
    case 'orders': loadOrders(); break;
    case 'riders': loadRiders(); break;
    case 'stores': loadStores(); break;
    case 'products': loadProducts(); break;
    case 'users': loadUsers(); break;
    case 'payments': loadPaymentSettings(); break;
    case 'delivery': loadDeliveryFee(); break;
  }
}

// ==============================
// DASHBOARD PAGE
// ==============================
async function loadDashboard() {
  // Use real-time listener for orders
  const ordersQ = query(collection(db, 'orders'), orderBy('created_at', 'desc'));

  if (unsubOrders) { unsubOrders(); }

  unsubOrders = onSnapshot(ordersQ, (snap) => {
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Total Orders
    document.getElementById('statTotalOrders').textContent = orders.length.toLocaleString();
    document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('skeleton'));

    // Total Revenue (paid orders)
    const revenue = orders
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    document.getElementById('statRevenue').textContent = '৳ ' + revenue.toLocaleString();

    // Pending badge in nav
    const pending = orders.filter(o => o.status === 'pending').length;
    const navBadge = document.getElementById('navOrderBadge');
    if (pending > 0) {
      navBadge.textContent = pending;
      navBadge.style.display = 'inline-flex';
    } else {
      navBadge.style.display = 'none';
    }

    // Recent orders (latest 10)
    renderRecentOrders(orders.slice(0, 10));
  }, (err) => {
    console.error('Orders snapshot error:', err);
    showToast('Failed to load orders.', 'error');
  });

  // Load riders count
  try {
    const ridersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'rider')));
    document.getElementById('statRiders').textContent = ridersSnap.size.toLocaleString();
  } catch (err) {
    console.error('Riders count error:', err);
    document.getElementById('statRiders').textContent = '—';
  }

  // Load stores count
  try {
    const storesSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'store_admin')));
    document.getElementById('statStores').textContent = storesSnap.size.toLocaleString();
  } catch (err) {
    console.error('Stores count error:', err);
    document.getElementById('statStores').textContent = '—';
  }
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('recentOrdersTbody');
  if (!tbody) return;

  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="td-empty">No orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td class="td-mono td-bold">${o.order_id || o.id.slice(0, 8)}</td>
      <td>${escHtml(o.customer_name || '—')}</td>
      <td>${escHtml(o.store_id || '—')}</td>
      <td class="td-bold">৳ ${formatNum(o.total)}</td>
      <td>${paymentBadge(o.payment_status)}</td>
      <td>${statusBadge(o.status)}</td>
      <td>${formatTimestamp(o.created_at)}</td>
    </tr>
  `).join('');
}

// ==============================
// ORDERS PAGE
// ==============================
function loadOrders() {
  const ordersQ = query(collection(db, 'orders'), orderBy('created_at', 'desc'));

  if (unsubOrders) { unsubOrders(); }

  unsubOrders = onSnapshot(ordersQ, (snap) => {
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window._allOrders = orders; // cache for filtering
    filterAndRenderOrders(orders, currentOrderFilter, document.getElementById('orderSearch')?.value || '');
  }, (err) => {
    console.error('Orders listener error:', err);
    showToast('Failed to load orders.', 'error');
  });

  // Load active riders for assign dropdown
  loadActiveRiders();
}

function filterAndRenderOrders(orders, filter, search) {
  let filtered = orders;
  if (filter && filter !== 'all') {
    filtered = filtered.filter(o => o.status === filter);
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(o =>
      (o.order_id || '').toLowerCase().includes(s) ||
      (o.customer_name || '').toLowerCase().includes(s) ||
      (o.contact_number || '').includes(s)
    );
  }
  renderOrdersTable(filtered);
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('ordersTbody');
  if (!tbody) return;

  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="td-empty">No orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td class="td-mono td-bold">${escHtml(o.order_id || o.id.slice(0, 8))}</td>
      <td>${escHtml(o.customer_name || '—')}</td>
      <td>${escHtml(o.contact_number || '—')}</td>
      <td class="td-bold">৳ ${formatNum(o.total)}</td>
      <td>${paymentBadge(o.payment_status)}</td>
      <td>${statusBadge(o.status)}</td>
      <td><span style="font-size:12px;color:var(--text-3)">${escHtml(o.rider || '—')}</span></td>
      <td style="font-size:12px;color:var(--text-3)">${formatTimestamp(o.created_at)}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-sm btn-outline" onclick="openOrderModal('${o.id}')">Details</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteOrder('${o.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadActiveRiders() {
  try {
    const snap = await getDocs(query(
      collection(db, 'users'),
      where('role', '==', 'rider'),
      where('status', '==', 'active')
    ));
    activeRiders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Load riders error:', err);
    activeRiders = [];
  }
}

// ==============================
// ORDER MODAL
// ==============================
window.openOrderModal = async function (docId) {
  currentOrderId = docId;
  openModal('orderModal');

  try {
    const snap = await getDoc(doc(db, 'orders', docId));
    if (!snap.exists()) { showToast('Order not found.', 'error'); closeModal('orderModal'); return; }
    const o = { id: snap.id, ...snap.data() };

    document.getElementById('orderModalTitle').textContent = `Order — ${o.order_id || o.id.slice(0, 8)}`;

    // Build items HTML
    const itemsHtml = Array.isArray(o.items) && o.items.length
      ? o.items.map(item => `
          <div class="order-item-row">
            <span class="order-item-name">${escHtml(item.name || item.pd_name || '—')} × ${item.quantity || 1}</span>
            <span class="order-item-total">৳ ${formatNum(item.total || item.price)}</span>
          </div>`).join('')
      : '<p style="color:var(--text-3);font-size:13px">No items data.</p>';

    document.getElementById('orderModalBody').innerHTML = `
      <div class="order-detail-grid">
        <div class="od-item"><div class="od-label">Customer</div><div class="od-val">${escHtml(o.customer_name || '—')}</div></div>
        <div class="od-item"><div class="od-label">Phone</div><div class="od-val">${escHtml(o.contact_number || '—')}</div></div>
        <div class="od-item"><div class="od-label">Address</div><div class="od-val">${escHtml(o.delivery_address || '—')}</div></div>
        <div class="od-item"><div class="od-label">Payment</div><div class="od-val">${escHtml(o.payment_method || '—')} — ${paymentBadge(o.payment_status)}</div></div>
        <div class="od-item"><div class="od-label">Transaction ID</div><div class="od-val" style="font-family:monospace;font-size:12px">${escHtml(o.transaction_id || '—')}</div></div>
        <div class="od-item"><div class="od-label">Subtotal</div><div class="od-val">৳ ${formatNum(o.subtotal)}</div></div>
        <div class="od-item"><div class="od-label">Delivery Fee</div><div class="od-val">৳ ${formatNum(o.delivery_fee)}</div></div>
        <div class="od-item"><div class="od-label">Total</div><div class="od-val" style="color:var(--primary);font-size:16px">৳ ${formatNum(o.total)}</div></div>
        <div class="od-item"><div class="od-label">Store ID</div><div class="od-val" style="font-size:12px">${escHtml(o.store_id || '—')}</div></div>
        <div class="od-item"><div class="od-label">Note</div><div class="od-val">${escHtml(o.note || '—')}</div></div>
        <div class="od-item"><div class="od-label">Ordered</div><div class="od-val">${formatTimestamp(o.created_at)}</div></div>
        <div class="od-item"><div class="od-label">Status</div><div class="od-val">${statusBadge(o.status)}</div></div>
      </div>
      <div class="order-items-section">
        <div class="order-items-title">Order Items</div>
        ${itemsHtml}
      </div>
    `;

    // Set current status in dropdown
    const statusSel = document.getElementById('orderStatusSelect');
    statusSel.value = o.status || 'pending';

    // Set current delivery fee
    document.getElementById('orderDeliveryFeeInput').value = o.delivery_fee || '';

    // Populate rider dropdown
    const riderSel = document.getElementById('orderRiderSelect');
    riderSel.innerHTML = '<option value="">— Select Rider —</option>' +
      activeRiders.map(r => `<option value="${r.id}" ${o.rider === r.id ? 'selected' : ''}>${escHtml(r.name || r.id)}</option>`).join('');

  } catch (err) {
    console.error('Open order modal error:', err);
    document.getElementById('orderModalBody').innerHTML = `<p style="color:var(--danger)">Failed to load order.</p>`;
  }
};

window.updateOrderStatus = function () {
  // Live preview — actual save happens on "Save Changes"
};

window.saveOrderChanges = async function () {
  if (!currentOrderId) return;
  const newStatus = document.getElementById('orderStatusSelect').value;
  const newRider = document.getElementById('orderRiderSelect').value;
  const newFee = document.getElementById('orderDeliveryFeeInput').value;

  try {
    const updates = { status: newStatus };
    if (newRider) updates.rider = newRider;
    if (newFee !== '') updates.delivery_fee = newFee;

    await updateDoc(doc(db, 'orders', currentOrderId), updates);
    showToast('Order updated successfully!', 'success');
    closeModal('orderModal');
  } catch (err) {
    console.error('Save order error:', err);
    showToast('Failed to update order.', 'error');
  }
};

window.deleteCurrentOrder = async function () {
  if (!currentOrderId) return;
  confirmDeleteOrder(currentOrderId, true);
};

window.confirmDeleteOrder = function (docId, fromModal = false) {
  currentOrderId = docId;
  if (!confirm('Are you sure you want to permanently delete this order? This cannot be undone.')) return;
  deleteOrder(docId, fromModal);
};

async function deleteOrder(docId, fromModal) {
  try {
    await deleteDoc(doc(db, 'orders', docId));
    showToast('Order deleted.', 'success');
    if (fromModal) closeModal('orderModal');
  } catch (err) {
    console.error('Delete order error:', err);
    showToast('Failed to delete order.', 'error');
  }
}

// ==============================
// RIDERS PAGE
// ==============================
async function loadRiders() {
  const tbody = document.getElementById('ridersTbody');
  tbody.innerHTML = `<tr><td colspan="5" class="td-loading">Loading riders...</td></tr>`;

  try {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'rider')));
    const riders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window._allRiders = riders;
    renderRidersTable(riders);

    document.getElementById('riderSearch').addEventListener('input', function () {
      const s = this.value.toLowerCase();
      renderRidersTable(riders.filter(r =>
        (r.name || '').toLowerCase().includes(s) || (r.phone_number || '').includes(s)
      ));
    });
  } catch (err) {
    console.error('Load riders error:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="td-empty" style="color:var(--danger)">Failed to load riders.</td></tr>`;
  }
}

function renderRidersTable(riders) {
  const tbody = document.getElementById('ridersTbody');
  if (!tbody) return;
  if (!riders.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="td-empty">No riders found.</td></tr>`;
    return;
  }
  tbody.innerHTML = riders.map(r => `
    <tr>
      <td class="td-bold">${escHtml(r.name || '—')}</td>
      <td>${escHtml(r.phone_number || '—')}</td>
      <td style="font-size:12px;color:var(--text-3)">${escHtml(r.address || '—')}</td>
      <td>${riderStatusBadge(r.status)}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-sm btn-outline" onclick="openRiderModal('${r.id}')">Details</button>
          ${r.status === 'active'
            ? `<button class="btn btn-sm btn-warning" onclick="toggleRiderStatus('${r.id}','inactive')">Suspend</button>`
            : `<button class="btn btn-sm btn-success" onclick="toggleRiderStatus('${r.id}','active')">Activate</button>`
          }
        </div>
      </td>
    </tr>
  `).join('');
}

window.openRiderModal = async function (docId) {
  currentRiderId = docId;
  openModal('riderModal');

  try {
    const snap = await getDoc(doc(db, 'users', docId));
    if (!snap.exists()) { closeModal('riderModal'); return; }
    const r = { id: snap.id, ...snap.data() };

    document.getElementById('riderModalBody').innerHTML = `
      <div class="detail-row"><span class="detail-label">Name</span><span class="detail-val">${escHtml(r.name || '—')}</span></div>
      <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-val">${escHtml(r.phone_number || '—')}</span></div>
      <div class="detail-row"><span class="detail-label">Address</span><span class="detail-val">${escHtml(r.address || '—')}</span></div>
      <div class="detail-row"><span class="detail-label">Status</span>${riderStatusBadge(r.status)}</div>
      <div class="detail-row"><span class="detail-label">Role</span><span class="detail-val">${escHtml(r.role || 'rider')}</span></div>
      <div class="detail-row"><span class="detail-label">User ID</span><span class="detail-val" style="font-family:monospace;font-size:12px">${r.id}</span></div>
    `;

    // Update action button
    const btn = document.getElementById('riderActionBtn');
    btn.textContent = r.status === 'active' ? 'Suspend Rider' : 'Activate Rider';
    btn.onclick = () => toggleRiderStatus(r.id, r.status === 'active' ? 'inactive' : 'active', true);
    btn.className = `btn ${r.status === 'active' ? 'btn-warning' : 'btn-success'}`;
  } catch (err) {
    console.error('Rider modal error:', err);
    document.getElementById('riderModalBody').innerHTML = `<p style="color:var(--danger)">Failed to load rider.</p>`;
  }
};

window.toggleRiderStatus = async function (docId, newStatus, fromModal = false) {
  if (!docId) { docId = currentRiderId; newStatus = document.getElementById('riderActionBtn').textContent.includes('Suspend') ? 'inactive' : 'active'; }
  try {
    await updateDoc(doc(db, 'users', docId), { status: newStatus });
    showToast(`Rider ${newStatus === 'active' ? 'activated' : 'suspended'}.`, 'success');
    if (fromModal) closeModal('riderModal');
    loadRiders();
  } catch (err) {
    console.error('Toggle rider error:', err);
    showToast('Failed to update rider.', 'error');
  }
};

// ==============================
// STORES PAGE
// ==============================
async function loadStores() {
  const tbody = document.getElementById('storesTbody');
  tbody.innerHTML = `<tr><td colspan="6" class="td-loading">Loading stores...</td></tr>`;

  try {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'store_admin')));
    const stores = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window._allStores = stores;
    renderStoresTable(stores);

    document.getElementById('storeSearch').addEventListener('input', function () {
      const s = this.value.toLowerCase();
      renderStoresTable(stores.filter(st =>
        (st.store_name || '').toLowerCase().includes(s) || (st.name || '').toLowerCase().includes(s)
      ));
    });
  } catch (err) {
    console.error('Load stores error:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="td-empty" style="color:var(--danger)">Failed to load stores.</td></tr>`;
  }
}

function renderStoresTable(stores) {
  const tbody = document.getElementById('storesTbody');
  if (!tbody) return;
  if (!stores.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="td-empty">No stores found.</td></tr>`;
    return;
  }
  tbody.innerHTML = stores.map(s => `
    <tr>
      <td class="td-bold">${escHtml(s.store_name || '—')}</td>
      <td>${escHtml(s.name || '—')}</td>
      <td>${escHtml(s.phone_number || '—')}</td>
      <td style="font-size:12px;color:var(--text-3)">${escHtml(s.store_address || '—')}</td>
      <td>${riderStatusBadge(s.status || 'active')}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-sm btn-outline" onclick="openStoreModal('${s.id}')">Details</button>
          ${(s.status || 'active') === 'active'
            ? `<button class="btn btn-sm btn-warning" onclick="toggleStoreStatus('${s.id}','inactive')">Suspend</button>`
            : `<button class="btn btn-sm btn-success" onclick="toggleStoreStatus('${s.id}','active')">Activate</button>`
          }
        </div>
      </td>
    </tr>
  `).join('');
}

window.openStoreModal = async function (docId) {
  currentStoreId = docId;
  openModal('storeModal');

  try {
    const snap = await getDoc(doc(db, 'users', docId));
    if (!snap.exists()) { closeModal('storeModal'); return; }
    const s = { id: snap.id, ...snap.data() };

    document.getElementById('storeModalBody').innerHTML = `
      <div class="detail-row"><span class="detail-label">Store Name</span><span class="detail-val">${escHtml(s.store_name || '—')}</span></div>
      <div class="detail-row"><span class="detail-label">Owner Name</span><span class="detail-val">${escHtml(s.name || '—')}</span></div>
      <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-val">${escHtml(s.phone_number || '—')}</span></div>
      <div class="detail-row"><span class="detail-label">Store Address</span><span class="detail-val">${escHtml(s.store_address || '—')}</span></div>
      <div class="detail-row"><span class="detail-label">Address</span><span class="detail-val">${escHtml(s.address || '—')}</span></div>
      <div class="detail-row"><span class="detail-label">Status</span>${riderStatusBadge(s.status || 'active')}</div>
      <div class="detail-row"><span class="detail-label">Store ID</span><span class="detail-val" style="font-family:monospace;font-size:12px">${s.id}</span></div>
    `;

    const btn = document.getElementById('storeActionBtn');
    const curStatus = s.status || 'active';
    btn.textContent = curStatus === 'active' ? 'Suspend Store' : 'Activate Store';
    btn.onclick = () => toggleStoreStatus(s.id, curStatus === 'active' ? 'inactive' : 'active', true);
    btn.className = `btn ${curStatus === 'active' ? 'btn-warning' : 'btn-success'}`;
  } catch (err) {
    console.error('Store modal error:', err);
    document.getElementById('storeModalBody').innerHTML = `<p style="color:var(--danger)">Failed to load store.</p>`;
  }
};

window.toggleStoreStatus = async function (docId, newStatus, fromModal = false) {
  try {
    await updateDoc(doc(db, 'users', docId), { status: newStatus });
    showToast(`Store ${newStatus === 'active' ? 'activated' : 'suspended'}.`, 'success');
    if (fromModal) closeModal('storeModal');
    loadStores();
  } catch (err) {
    console.error('Toggle store error:', err);
    showToast('Failed to update store.', 'error');
  }
};

// ==============================
// PRODUCTS PAGE
// ==============================
async function loadProducts() {
  const tbody = document.getElementById('productsTbody');
  tbody.innerHTML = `<tr><td colspan="7" class="td-loading">Loading products...</td></tr>`;

  try {
    const snap = await getDocs(query(collection(db, 'products'), orderBy('created_at', 'desc')));
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window._allProducts = products;
    renderProductsTable(products);

    document.getElementById('productSearch').addEventListener('input', function () {
      const s = this.value.toLowerCase();
      renderProductsTable(products.filter(p =>
        (p.pd_name || '').toLowerCase().includes(s) || (p.store_id || '').toLowerCase().includes(s)
      ));
    });
  } catch (err) {
    console.error('Load products error:', err);
    tbody.innerHTML = `<tr><td colspan="7" class="td-empty" style="color:var(--danger)">Failed to load products.</td></tr>`;
  }
}

function renderProductsTable(products) {
  const tbody = document.getElementById('productsTbody');
  if (!tbody) return;
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="td-empty">No products found.</td></tr>`;
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td>
        ${p.pd_image
          ? `<img src="${escHtml(p.pd_image)}" class="td-product-img" alt="${escHtml(p.pd_name)}" onerror="this.style.display='none'" />`
          : `<div class="td-product-img-ph">🖼</div>`
        }
      </td>
      <td class="td-bold">${escHtml(p.pd_name || '—')}</td>
      <td style="max-width:200px;font-size:12px;color:var(--text-3)">${escHtml((p.pd_description || '').slice(0, 60))}${(p.pd_description || '').length > 60 ? '...' : ''}</td>
      <td class="td-bold">৳ ${formatNum(p.pd_price)}</td>
      <td style="font-size:12px;font-family:monospace">${escHtml(p.store_id || '—')}</td>
      <td style="font-size:12px;color:var(--text-3)">${formatTimestamp(p.created_at)}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-sm btn-outline" onclick="openProductModal('${p.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.openProductModal = async function (docId = null) {
  currentProductId = docId;
  document.getElementById('productDocId').value = docId || '';

  if (docId) {
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    try {
      const snap = await getDoc(doc(db, 'products', docId));
      if (snap.exists()) {
        const p = snap.data();
        document.getElementById('pdName').value = p.pd_name || '';
        document.getElementById('pdDesc').value = p.pd_description || '';
        document.getElementById('pdPrice').value = p.pd_price || '';
        document.getElementById('pdStoreId').value = p.store_id || '';
        document.getElementById('pdImage').value = p.pd_image || '';
      }
    } catch (err) {
      console.error('Load product for edit error:', err);
    }
  } else {
    document.getElementById('productModalTitle').textContent = 'Add Product';
    document.getElementById('pdName').value = '';
    document.getElementById('pdDesc').value = '';
    document.getElementById('pdPrice').value = '';
    document.getElementById('pdStoreId').value = '';
    document.getElementById('pdImage').value = '';
  }

  openModal('productModal');
};

window.saveProduct = async function () {
  const name = document.getElementById('pdName').value.trim();
  const desc = document.getElementById('pdDesc').value.trim();
  const price = document.getElementById('pdPrice').value;
  const storeId = document.getElementById('pdStoreId').value.trim();
  const image = document.getElementById('pdImage').value.trim();

  if (!name || !price || !storeId) {
    showToast('Name, Price and Store ID are required.', 'error');
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
      await updateDoc(doc(db, 'products', currentProductId), data);
      showToast('Product updated!', 'success');
    } else {
      data.created_at = serverTimestamp();
      await addDoc(collection(db, 'products'), data);
      showToast('Product added!', 'success');
    }
    closeModal('productModal');
    loadProducts();
  } catch (err) {
    console.error('Save product error:', err);
    showToast('Failed to save product.', 'error');
  }
};

window.deleteProduct = async function (docId) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  try {
    await deleteDoc(doc(db, 'products', docId));
    showToast('Product deleted.', 'success');
    loadProducts();
  } catch (err) {
    console.error('Delete product error:', err);
    showToast('Failed to delete product.', 'error');
  }
};

// ==============================
// USERS PAGE
// ==============================
async function loadUsers() {
  const tbody = document.getElementById('usersTbody');
  tbody.innerHTML = `<tr><td colspan="5" class="td-loading">Loading users...</td></tr>`;

  try {
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'users')));
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window._allUsers = users;
    renderUsersTable(users);

    document.getElementById('userSearch').addEventListener('input', function () {
      const s = this.value.toLowerCase();
      renderUsersTable(users.filter(u =>
        (u.name || '').toLowerCase().includes(s) || (u.phone_number || '').includes(s)
      ));
    });
  } catch (err) {
    console.error('Load users error:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="td-empty" style="color:var(--danger)">Failed to load users.</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTbody');
  if (!tbody) return;
  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="td-empty">No users found.</td></tr>`;
    return;
  }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td class="td-bold">${escHtml(u.name || '—')}</td>
      <td>${escHtml(u.phone_number || '—')}</td>
      <td style="font-size:12px;color:var(--text-3)">${escHtml(u.address || '—')}</td>
      <td>${riderStatusBadge(u.status || 'active')}</td>
      <td>
        <div class="actions-cell">
          ${(u.status || 'active') === 'active'
            ? `<button class="btn btn-sm btn-danger" onclick="toggleUserStatus('${u.id}','inactive')">Block</button>`
            : `<button class="btn btn-sm btn-success" onclick="toggleUserStatus('${u.id}','active')">Unblock</button>`
          }
        </div>
      </td>
    </tr>
  `).join('');
}

window.toggleUserStatus = async function (docId, newStatus) {
  try {
    await updateDoc(doc(db, 'users', docId), { status: newStatus });
    showToast(`User ${newStatus === 'active' ? 'unblocked' : 'blocked'}.`, 'success');
    loadUsers();
  } catch (err) {
    console.error('Toggle user error:', err);
    showToast('Failed to update user.', 'error');
  }
};

// ==============================
// PAYMENT SETTINGS
// ==============================
async function loadPaymentSettings() {
  try {
    const snap = await getDocs(collection(db, 'adminPaymentNum'));
    if (!snap.empty) {
      const data = snap.docs[0].data();
      document.getElementById('bkashInput').value = data.Bkash || '';
      document.getElementById('nagadInput').value = data.nagat || '';
      window._paymentDocId = snap.docs[0].id;
    }
  } catch (err) {
    console.error('Load payment settings error:', err);
    showToast('Failed to load payment settings.', 'error');
  }
}

window.savePaymentSettings = async function (type) {
  const bkash = document.getElementById('bkashInput').value.trim();
  const nagad = document.getElementById('nagadInput').value.trim();

  if (type === 'bkash' && !bkash) { showToast('Please enter a bKash number.', 'error'); return; }
  if (type === 'nagad' && !nagad) { showToast('Please enter a Nagad number.', 'error'); return; }

  try {
    const snap = await getDocs(collection(db, 'adminPaymentNum'));
    const updates = {};
    if (type === 'bkash') updates.Bkash = bkash;
    if (type === 'nagad') updates.nagat = nagad;

    if (!snap.empty) {
      await updateDoc(doc(db, 'adminPaymentNum', snap.docs[0].id), updates);
    } else {
      await addDoc(collection(db, 'adminPaymentNum'), { Bkash: bkash, nagat: nagad });
    }
    showToast(`${type === 'bkash' ? 'bKash' : 'Nagad'} number saved!`, 'success');
  } catch (err) {
    console.error('Save payment settings error:', err);
    showToast('Failed to save payment settings.', 'error');
  }
};

// ==============================
// DELIVERY FEE
// ==============================
async function loadDeliveryFee() {
  try {
    const snap = await getDocs(collection(db, 'deliveryFee'));
    if (!snap.empty) {
      const data = snap.docs[0].data();
      const fee = data.fee || '—';
      document.getElementById('deliveryFeeDisplay').textContent = `৳ ${fee}`;
      document.getElementById('deliveryFeeInput').value = fee;
      window._deliveryFeeDocId = snap.docs[0].id;
    } else {
      document.getElementById('deliveryFeeDisplay').textContent = '৳ 0';
    }
  } catch (err) {
    console.error('Load delivery fee error:', err);
    showToast('Failed to load delivery fee.', 'error');
  }
}

window.saveDeliveryFee = async function () {
  const fee = document.getElementById('deliveryFeeInput').value.trim();
  if (!fee) { showToast('Please enter a delivery fee.', 'error'); return; }

  try {
    const snap = await getDocs(collection(db, 'deliveryFee'));
    if (!snap.empty) {
      await updateDoc(doc(db, 'deliveryFee', snap.docs[0].id), { fee });
    } else {
      await addDoc(collection(db, 'deliveryFee'), { fee });
    }
    document.getElementById('deliveryFeeDisplay').textContent = `৳ ${fee}`;
    showToast('Delivery fee updated!', 'success');
  } catch (err) {
    console.error('Save delivery fee error:', err);
    showToast('Failed to save delivery fee.', 'error');
  }
};

// ==============================
// SEARCH & FILTER INIT
// ==============================
function initSearchFilters() {
  // Orders filter tabs
  const orderTabs = document.getElementById('orderFilterTabs');
  if (orderTabs) {
    orderTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.ftab');
      if (!tab) return;
      orderTabs.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentOrderFilter = tab.dataset.filter;
      if (window._allOrders) {
        filterAndRenderOrders(window._allOrders, currentOrderFilter, document.getElementById('orderSearch')?.value || '');
      }
    });
  }

  // Order search
  document.getElementById('orderSearch')?.addEventListener('input', function () {
    if (window._allOrders) {
      filterAndRenderOrders(window._allOrders, currentOrderFilter, this.value);
    }
  });
}

// ==============================
// MODAL HELPERS
// ==============================
window.openModal = function (id) {
  document.getElementById(id).classList.add('open');
};
window.closeModal = function (id) {
  document.getElementById(id).classList.remove('open');
};

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
    }
  });
});

// ESC key closes modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// ==============================
// TOAST NOTIFICATIONS
// ==============================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastStack');
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// ==============================
// BADGE HELPERS
// ==============================
function statusBadge(status) {
  const map = {
    pending: 'badge-pending',
    preparing: 'badge-preparing',
    ready: 'badge-ready',
    delivered: 'badge-delivered',
    cancelled: 'badge-cancelled',
  };
  const cls = map[status] || 'badge-pending';
  return `<span class="badge ${cls}">${capitalize(status || 'pending')}</span>`;
}

function paymentBadge(status) {
  return status === 'paid'
    ? `<span class="badge badge-paid">Paid</span>`
    : `<span class="badge badge-unpaid">Unpaid</span>`;
}

function riderStatusBadge(status) {
  return status === 'active'
    ? `<span class="badge badge-active">Active</span>`
    : `<span class="badge badge-inactive">Inactive</span>`;
}

// ==============================
// UTILITY FUNCTIONS
// ==============================
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatNum(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  let date;
  if (ts.toDate) {
    // Firestore Timestamp
    date = ts.toDate();
  } else if (ts.seconds) {
    date = new Date(ts.seconds * 1000);
  } else {
    date = new Date(ts);
  }
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-BD', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}
