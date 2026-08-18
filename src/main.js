import './styles.css';
import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const root = document.querySelector('#app');
const state = {
  user: null,
  merchant: null,
  transactions: [],
  paymentLinks: [],
  customers: [],
  unsubscribers: [],
};

const PRIVATE_ROUTES = new Set(['/dashboard', '/transactions', '/links', '/customers', '/developers', '/settings', '/security']);

const fmtMoney = (value = 0) => `APX ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const fmtDate = (timestamp) => {
  const date = timestamp?.toDate?.() || (timestamp ? new Date(timestamp) : null);
  return date && !Number.isNaN(date.valueOf()) ? date.toLocaleString() : '—';
};
const uidKey = (uid) => `pk_live_${uid.slice(0, 8)}_${uid.slice(-6)}`;

function clearListeners() {
  state.unsubscribers.forEach((fn) => fn?.());
  state.unsubscribers = [];
}

function toast(message, tone = 'info') {
  let tray = document.querySelector('#toastTray');
  if (!tray) {
    tray = document.createElement('div');
    tray.id = 'toastTray';
    tray.className = 'toast-tray';
    document.body.appendChild(tray);
  }
  const item = document.createElement('div');
  item.className = `toast ${tone}`;
  item.textContent = message;
  tray.appendChild(item);
  setTimeout(() => item.remove(), 3600);
}

const icon = (name) => ({
  dashboard: '▦', transactions: '⇄', links: '↗', customers: '◎', developers: '</>', settings: '⚙', security: '⌾', logout: '↪', bell: '•', plus: '+', search: '⌕'
}[name] || '•');

function marketingShell(content) {
  return `
    <div class="marketing-shell">
      <header class="marketing-nav">
        <a class="brand" href="#/">Apex<span>Pay</span></a>
        <nav><a href="#/developers">Developers</a><a href="#/signin">Sign in</a><a class="button primary small" href="#/signup">Start accepting payments</a></nav>
      </header>
      ${content}
      <footer class="marketing-footer"><span>ApexPay Merchant Network</span><span>Built for the APX economy · 2026</span></footer>
    </div>`;
}

function appShell(title, subtitle, content, actions = '') {
  const business = esc(state.merchant?.businessName || state.user?.displayName || 'Merchant');
  const email = esc(state.user?.email || '');
  const path = location.hash.replace('#', '') || '/dashboard';
  const nav = [
    ['/dashboard', 'dashboard', 'Overview'], ['/transactions', 'transactions', 'Transactions'], ['/links', 'links', 'Payment links'], ['/customers', 'customers', 'Customers'], ['/developers', 'developers', 'Developers'], ['/settings', 'settings', 'Business settings'], ['/security', 'security', 'Security'],
  ].map(([href, ic, label]) => `<a class="side-link ${path === href ? 'active' : ''}" href="#${href}"><span>${icon(ic)}</span>${label}</a>`).join('');

  return `<div class="console-shell">
    <aside class="sidebar">
      <a class="brand console-brand" href="#/dashboard">Apex<span>Pay</span></a>
      <div class="workspace"><div class="workspace-avatar">${esc(business.charAt(0).toUpperCase())}</div><div><strong>${business}</strong><small>Merchant workspace</small></div></div>
      <nav>${nav}</nav>
      <div class="side-footer"><div class="status-pill"><i></i> Network connected</div><button id="logoutButton" class="side-link button-reset"><span>${icon('logout')}</span>Sign out</button></div>
    </aside>
    <section class="console-main">
      <header class="console-topbar"><button id="mobileMenu" class="icon-button mobile-only">☰</button><div class="topbar-spacer"></div><button class="icon-button">${icon('bell')}</button><div class="identity"><div class="identity-avatar">${esc(business.charAt(0).toUpperCase())}</div><div><strong>${business}</strong><small>${email}</small></div></div></header>
      <main class="console-content">
        <div class="page-heading"><div><p class="kicker">MERCHANT CONSOLE</p><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="page-actions">${actions}</div></div>
        ${content}
      </main>
    </section>
  </div>`;
}

const landing = () => marketingShell(`
  <main>
    <section class="hero-v2">
      <div class="hero-copy"><div class="badge">APX MERCHANT INFRASTRUCTURE</div><h1>Run payments like infrastructure, not paperwork.</h1><p>ApexPay gives merchants one operating console for collections, payment links, customers, transaction visibility and JavaScript checkout integration.</p><div class="hero-actions"><a class="button primary" href="#/signup">Create merchant account</a><a class="button secondary" href="#/developers">Read integration guide</a></div><div class="hero-proof"><span><b>Realtime</b> Firestore ledger views</span><span><b>Protected</b> transaction writes</span><span><b>Simple</b> JavaScript integration</span></div></div>
      <div class="product-window"><div class="window-bar"><span></span><span></span><span></span><small>merchant.apexpay.app</small></div><div class="window-body"><div class="mini-side"><b>ApexPay</b><i></i><i></i><i></i><i></i></div><div class="mini-main"><small>Available network volume</small><h3>APX 184,450.00</h3><div class="mini-grid"><div><small>Successful</small><strong>1,248</strong></div><div><small>Customers</small><strong>386</strong></div></div><div class="mini-chart"><span style="height:34%"></span><span style="height:50%"></span><span style="height:44%"></span><span style="height:72%"></span><span style="height:62%"></span><span style="height:88%"></span><span style="height:78%"></span></div></div></div></div>
    </section>
    <section class="trust-strip"><span>MERCHANT DASHBOARD</span><span>PAYMENT LINKS</span><span>CUSTOMERS</span><span>TRANSACTION LEDGER</span><span>JAVASCRIPT CHECKOUT</span></section>
    <section class="feature-section"><div class="section-title"><p class="kicker">ONE CONTROL SURFACE</p><h2>Everything a merchant needs before money settlement.</h2></div><div class="feature-grid"><article><span>01</span><h3>Operate</h3><p>Monitor activity, customers and collections from one authenticated console.</p></article><article><span>02</span><h3>Collect</h3><p>Create payment links with APX-denominated amounts and track their state.</p></article><article><span>03</span><h3>Integrate</h3><p>Use a merchant public key and a small JavaScript contract in compatible web apps.</p></article></div></section>
  </main>`);

function authView(mode = 'signin') {
  const signup = mode === 'signup';
  return marketingShell(`<main class="auth-layout"><section class="auth-copy"><div class="badge">${signup ? 'CREATE MERCHANT WORKSPACE' : 'SECURE MERCHANT ACCESS'}</div><h1>${signup ? 'Start operating on ApexPay.' : 'Welcome back.'}</h1><p>${signup ? 'Create your merchant identity, then manage payment links, customers and transaction visibility from one console.' : 'Sign in to continue to your merchant workspace.'}</p><div class="auth-points"><span>✓ Firebase Authentication</span><span>✓ Merchant-isolated Firestore paths</span><span>✓ Read-only authoritative ledger</span></div></section><section class="auth-panel"><form id="authForm" class="stack-form">${signup ? `<label>Business name<input id="business" autocomplete="organization" required minlength="2" maxlength="120" placeholder="e.g. Royal Studios"/></label><label>Contact name<input id="contactName" autocomplete="name" required maxlength="120" placeholder="Your full name"/></label>` : ''}<label>Email address<input id="email" type="email" autocomplete="email" required placeholder="merchant@example.com"/></label><label>Password<input id="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="6" required placeholder="At least 6 characters"/></label><button class="button primary full" type="submit">${signup ? 'Create merchant account' : 'Sign in'}</button><p id="authMessage" class="form-message"></p></form>${!signup ? '<button id="resetPassword" class="text-button">Forgot password?</button>' : ''}<div class="form-switch">${signup ? 'Already have an account? <a href="#/signin">Sign in</a>' : 'New to ApexPay? <a href="#/signup">Create an account</a>'}</div></section></main>`);
}

function dashboardView() {
  const tx = state.transactions;
  const success = tx.filter((t) => t.status === 'success');
  const volume = success.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const pending = tx.filter((t) => t.status === 'pending').length;
  const recent = tx.slice(0, 6);
  return appShell('Overview', 'A live view of merchant activity across the ApexPay network.', `<section class="metric-grid"><article class="metric-card"><div><small>Successful volume</small><strong>${fmtMoney(volume)}</strong></div><span class="metric-icon">↗</span><p>${success.length} successful payments</p></article><article class="metric-card"><div><small>Total transactions</small><strong>${tx.length}</strong></div><span class="metric-icon">⇄</span><p>${pending} pending</p></article><article class="metric-card"><div><small>Payment links</small><strong>${state.paymentLinks.length}</strong></div><span class="metric-icon">⌁</span><p>${state.paymentLinks.filter((l) => l.status !== 'disabled').length} active</p></article><article class="metric-card"><div><small>Customers</small><strong>${state.customers.length}</strong></div><span class="metric-icon">◎</span><p>Merchant-owned directory</p></article></section>
    <section class="dashboard-grid"><article class="panel chart-panel"><div class="panel-head"><div><h2>Transaction pulse</h2><p>Recent successful payment values</p></div><span class="soft-badge">LIVE</span></div><div class="chart-bars">${(success.slice(0, 10).reverse().length ? success.slice(0, 10).reverse() : Array(8).fill({ amount: 0 })).map((t) => `<span style="height:${Math.max(8, Math.min(100, Number(t.amount || 0) / Math.max(1, ...success.map((x) => Number(x.amount || 0))) * 100))}%"></span>`).join('')}</div></article><article class="panel"><div class="panel-head"><div><h2>Network status</h2><p>Merchant integration readiness</p></div></div><div class="status-list"><div><span><i class="dot good"></i>Authentication</span><b>Connected</b></div><div><span><i class="dot good"></i>Firestore</span><b>Connected</b></div><div><span><i class="dot warn"></i>Settlement engine</span><b>Reserved</b></div><div><span><i class="dot warn"></i>Admin money controls</span><b>Planned</b></div></div></article></section>
    <section class="panel"><div class="panel-head"><div><h2>Recent transactions</h2><p>Newest ledger entries visible to this merchant</p></div><a href="#/transactions">View all →</a></div>${transactionTable(recent, true)}</section>`, `<a class="button primary" href="#/links">${icon('plus')} Create payment link</a>`);
}

function transactionTable(records, compact = false) {
  if (!records.length) return `<div class="empty-state"><div>⇄</div><h3>No transactions yet</h3><p>Authoritative transaction entries will appear here when the wallet/admin transaction layer begins writing to this merchant ledger.</p></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Customer</th><th>Amount</th><th>Status</th>${compact ? '' : '<th>Date</th>'}</tr></thead><tbody>${records.map((t) => `<tr><td><strong>${esc(t.reference || t.id)}</strong></td><td>${esc(t.customerName || t.customer || t.customerEmail || 'Customer')}</td><td>${fmtMoney(t.amount)}</td><td><span class="status ${esc(t.status || 'pending')}">${esc(t.status || 'pending')}</span></td>${compact ? '' : `<td>${fmtDate(t.createdAt)}</td>`}</tr>`).join('')}</tbody></table></div>`;
}

function transactionsView() {
  return appShell('Transactions', 'Read-only merchant ledger. Client browsers cannot create or alter transaction records.', `<section class="panel"><div class="toolbar"><div class="search-box"><span>${icon('search')}</span><input id="transactionSearch" placeholder="Search reference or customer"/></div><select id="transactionStatus"><option value="all">All statuses</option><option value="success">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="reversed">Reversed</option></select><button id="exportTransactions" class="button secondary">Export CSV</button></div><div id="transactionTable">${transactionTable(state.transactions)}</div></section>`);
}

function paymentLinksView() {
  const cards = state.paymentLinks.length ? state.paymentLinks.map((link) => `<article class="link-card"><div class="link-card-top"><span class="status ${link.status || 'active'}">${esc(link.status || 'active')}</span><button class="icon-button danger-text delete-link" data-id="${esc(link.id)}" title="Delete link">×</button></div><h3>${esc(link.title)}</h3><strong>${fmtMoney(link.amount)}</strong><p>${esc(link.description || 'No description')}</p><div class="link-code">${esc(link.slug || link.id)}</div><div class="link-actions"><button class="button secondary copy-link" data-slug="${esc(link.slug || link.id)}">Copy identifier</button></div></article>`).join('') : `<div class="empty-state wide"><div>↗</div><h3>No payment links yet</h3><p>Create a reusable APX payment request for a product, invoice or service.</p></div>`;
  return appShell('Payment links', 'Create and manage reusable merchant checkout requests.', `<section class="panel create-panel"><div class="panel-head"><div><h2>Create payment link</h2><p>Links are stored under your isolated merchant workspace.</p></div></div><form id="linkForm" class="form-grid"><label>Title<input id="linkTitle" required maxlength="160" placeholder="Studio session deposit"/></label><label>Amount (APX)<input id="linkAmount" type="number" min="0.01" step="0.01" required placeholder="250.00"/></label><label class="span-2">Description<textarea id="linkDescription" maxlength="280" placeholder="What is this payment for?"></textarea></label><button class="button primary" type="submit">Create payment link</button></form></section><section class="cards-grid">${cards}</section>`);
}

function customersView() {
  const rows = state.customers.length ? `<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Created</th></tr></thead><tbody>${state.customers.map((c) => `<tr><td><strong>${esc(c.name || 'Unnamed')}</strong></td><td>${esc(c.email || '—')}</td><td>${esc(c.phone || '—')}</td><td>${fmtDate(c.createdAt)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty-state"><div>◎</div><h3>No saved customers</h3><p>Add customers you invoice or serve frequently. This directory belongs only to your merchant workspace.</p></div>`;
  return appShell('Customers', 'Maintain a merchant-owned customer directory for faster payment operations.', `<section class="panel create-panel"><div class="panel-head"><div><h2>Add customer</h2><p>Customer records are isolated under your merchant ID.</p></div></div><form id="customerForm" class="form-grid three"><label>Name<input id="customerName" required maxlength="120" placeholder="Customer name"/></label><label>Email<input id="customerEmail" type="email" placeholder="customer@example.com"/></label><label>Phone<input id="customerPhone" placeholder="+233..."/></label><button class="button primary" type="submit">Add customer</button></form></section><section class="panel">${rows}</section>`);
}

function developersView() {
  const key = state.merchant?.publicKey || (state.user ? uidKey(state.user.uid) : 'pk_live_xxxxx');
  return state.user ? appShell('Developers', 'Integration surfaces for JavaScript-based stores and web applications.', `<section class="dev-grid"><article class="panel"><div class="panel-head"><div><h2>Merchant public key</h2><p>Safe to identify your merchant in client-side integrations. It is not a settlement secret.</p></div></div><div class="key-box"><code id="publicKey">${esc(key)}</code><button id="copyKey" class="button secondary">Copy</button></div><div class="warning-card"><b>Important</b><p>Never use a browser-generated value as authority for balances, successful payment status or settlement. Those will be written by the trusted transaction layer.</p></div></article><article class="panel"><div class="panel-head"><div><h2>Integration status</h2><p>What is live versus reserved in V1.</p></div></div><div class="status-list"><div><span><i class="dot good"></i>Merchant identity</span><b>Live</b></div><div><span><i class="dot good"></i>Payment-link records</span><b>Live</b></div><div><span><i class="dot warn"></i>Checkout runtime</span><b>Reserved</b></div><div><span><i class="dot warn"></i>Wallet debit/credit</span><b>Admin-controlled</b></div></div></article></section><section class="panel code-panel"><div class="panel-head"><div><h2>JavaScript contract</h2><p>The planned merchant-facing integration shape.</p></div></div><pre><code>&lt;script src="https://checkout.apexpay.app/v1.js"&gt;&lt;/script&gt;
&lt;script&gt;
  ApexPay.checkout({
    merchant: "${esc(key)}",
    amount: 250,
    currency: "APX",
    reference: "ORDER-1042",
    onSuccess(transaction) {
      console.log(transaction.reference);
    }
  });
&lt;/script&gt;</code></pre></section>`) : marketingShell(`<main class="docs-public"><p class="kicker">DEVELOPERS</p><h1>A small JavaScript integration surface.</h1><p>Merchant accounts receive a public integration key. Authoritative money movement remains outside browser code.</p><pre><code>&lt;script src="https://checkout.apexpay.app/v1.js"&gt;&lt;/script&gt;</code></pre><a class="button primary" href="#/signup">Create merchant account</a></main>`);
}

function settingsView() {
  const m = state.merchant || {};
  return appShell('Business settings', 'Manage the merchant identity presented across the ApexPay network.', `<section class="settings-grid"><article class="panel"><div class="panel-head"><div><h2>Business profile</h2><p>Core merchant information.</p></div></div><form id="settingsForm" class="stack-form"><label>Business name<input id="settingsBusiness" required value="${esc(m.businessName || '')}"/></label><label>Contact name<input id="settingsContact" value="${esc(m.contactName || state.user?.displayName || '')}"/></label><label>Support email<input id="settingsEmail" type="email" value="${esc(m.supportEmail || state.user?.email || '')}"/></label><label>Phone<input id="settingsPhone" value="${esc(m.phone || '')}" placeholder="+233..."/></label><label>Business category<input id="settingsCategory" value="${esc(m.category || '')}" placeholder="e.g. Media & Entertainment"/></label><button class="button primary" type="submit">Save changes</button></form></article><article class="panel"><div class="panel-head"><div><h2>Merchant identity</h2><p>Immutable network identifiers.</p></div></div><dl class="definition-list"><div><dt>Merchant ID</dt><dd>${esc(state.user.uid)}</dd></div><div><dt>Public key</dt><dd>${esc(m.publicKey || uidKey(state.user.uid))}</dd></div><div><dt>Account email</dt><dd>${esc(state.user.email)}</dd></div><div><dt>Network state</dt><dd><span class="status active">active</span></dd></div></dl></article></section>`);
}

function securityView() {
  return appShell('Security', 'Authentication and merchant-account security controls.', `<section class="settings-grid"><article class="panel"><div class="panel-head"><div><h2>Password</h2><p>Send a Firebase password-reset email to the account owner.</p></div></div><p class="muted-copy">A reset link will be sent to <strong>${esc(state.user.email)}</strong>.</p><button id="sendReset" class="button secondary">Send reset email</button></article><article class="panel"><div class="panel-head"><div><h2>Client permissions</h2><p>Security boundary for this frontend.</p></div></div><div class="security-points"><span>✓ Merchant may update own profile</span><span>✓ Merchant may manage own customers and payment links</span><span>✓ Merchant may read own transaction ledger</span><span>× Merchant may not write transaction state or balances</span></div></article></section>`);
}

async function loadMerchant(user) {
  const ref = doc(db, 'merchants', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    state.merchant = { id: snap.id, ...snap.data() };
    if (!state.merchant.publicKey) {
      const publicKey = uidKey(user.uid);
      await updateDoc(ref, { publicKey, updatedAt: serverTimestamp() });
      state.merchant.publicKey = publicKey;
    }
  } else {
    const merchant = { businessName: user.displayName || 'Merchant', contactName: user.displayName || '', email: user.email, supportEmail: user.email, publicKey: uidKey(user.uid), status: 'active', createdAt: serverTimestamp() };
    await setDoc(ref, merchant);
    state.merchant = { id: user.uid, ...merchant };
  }
}

function subscribeMerchantData(uid) {
  clearListeners();
  const collections = [
    ['transactions', 'transactions', 200], ['paymentLinks', 'paymentLinks', 100], ['customers', 'customers', 200],
  ];
  collections.forEach(([path, key, max]) => {
    const q = query(collection(db, 'merchants', uid, path), orderBy('createdAt', 'desc'), limit(max));
    const unsub = onSnapshot(q, (snapshot) => {
      state[key] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const current = location.hash.replace('#', '') || '/dashboard';
      if (PRIVATE_ROUTES.has(current)) render();
    }, (error) => toast(`${path}: ${error.message}`, 'error'));
    state.unsubscribers.push(unsub);
  });
}

function render() {
  const path = location.hash.replace('#', '') || '/';
  if (PRIVATE_ROUTES.has(path) && !state.user) {
    root.innerHTML = authView('signin');
    bindCommon();
    bindAuth(false);
    return;
  }

  if (path === '/signup') root.innerHTML = authView('signup');
  else if (path === '/signin') root.innerHTML = authView('signin');
  else if (path === '/dashboard') root.innerHTML = dashboardView();
  else if (path === '/transactions') root.innerHTML = transactionsView();
  else if (path === '/links') root.innerHTML = paymentLinksView();
  else if (path === '/customers') root.innerHTML = customersView();
  else if (path === '/developers') root.innerHTML = developersView();
  else if (path === '/settings') root.innerHTML = settingsView();
  else if (path === '/security') root.innerHTML = securityView();
  else root.innerHTML = landing();

  bindCommon();
  if (path === '/signup') bindAuth(true);
  if (path === '/signin') bindAuth(false);
  if (path === '/links') bindLinks();
  if (path === '/customers') bindCustomers();
  if (path === '/transactions') bindTransactionTools();
  if (path === '/developers' && state.user) bindDevelopers();
  if (path === '/settings') bindSettings();
  if (path === '/security') bindSecurity();
}

function bindCommon() {
  document.querySelector('#logoutButton')?.addEventListener('click', async () => {
    await signOut(auth);
    location.hash = '/';
  });
  document.querySelector('#mobileMenu')?.addEventListener('click', () => document.querySelector('.sidebar')?.classList.toggle('open'));
}

function bindAuth(signup) {
  const form = document.querySelector('#authForm');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.querySelector('#authMessage');
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    message.textContent = signup ? 'Creating secure workspace…' : 'Signing in…';
    try {
      const email = document.querySelector('#email').value.trim();
      const password = document.querySelector('#password').value;
      if (signup) {
        const businessName = document.querySelector('#business').value.trim();
        const contactName = document.querySelector('#contactName').value.trim();
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: contactName });
        await setDoc(doc(db, 'merchants', cred.user.uid), {
          businessName, contactName, email: cred.user.email, supportEmail: cred.user.email,
          publicKey: uidKey(cred.user.uid), status: 'active', currency: 'APX', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      location.hash = '/dashboard';
    } catch (error) {
      message.textContent = error.message.replace('Firebase: ', '');
      message.classList.add('error-text');
    } finally { button.disabled = false; }
  });

  document.querySelector('#resetPassword')?.addEventListener('click', async () => {
    const email = document.querySelector('#email').value.trim();
    if (!email) return toast('Enter your email address first.', 'error');
    try { await sendPasswordResetEmail(auth, email); toast('Password reset email sent.', 'success'); }
    catch (error) { toast(error.message, 'error'); }
  });
}

function bindLinks() {
  document.querySelector('#linkForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = document.querySelector('#linkTitle').value.trim();
    const amount = Number(document.querySelector('#linkAmount').value);
    const description = document.querySelector('#linkDescription').value.trim();
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)}-${crypto.randomUUID().slice(0, 6)}`;
    try {
      await addDoc(collection(db, 'merchants', state.user.uid, 'paymentLinks'), { title, amount, description, slug, currency: 'APX', status: 'active', merchantId: state.user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      event.target.reset(); toast('Payment link created.', 'success');
    } catch (error) { toast(error.message, 'error'); }
  });
  document.querySelectorAll('.delete-link').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('Delete this payment link?')) return;
    try { await deleteDoc(doc(db, 'merchants', state.user.uid, 'paymentLinks', btn.dataset.id)); toast('Payment link deleted.', 'success'); }
    catch (error) { toast(error.message, 'error'); }
  }));
  document.querySelectorAll('.copy-link').forEach((btn) => btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(btn.dataset.slug); toast('Payment-link identifier copied.', 'success');
  }));
}

function bindCustomers() {
  document.querySelector('#customerForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = document.querySelector('#customerName').value.trim();
    const email = document.querySelector('#customerEmail').value.trim();
    const phone = document.querySelector('#customerPhone').value.trim();
    try { await addDoc(collection(db, 'merchants', state.user.uid, 'customers'), { name, email, phone, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); event.target.reset(); toast('Customer added.', 'success'); }
    catch (error) { toast(error.message, 'error'); }
  });
}

function bindTransactionTools() {
  const search = document.querySelector('#transactionSearch');
  const status = document.querySelector('#transactionStatus');
  const rerender = () => {
    const needle = search.value.trim().toLowerCase();
    const wanted = status.value;
    const filtered = state.transactions.filter((t) => {
      const haystack = `${t.reference || t.id} ${t.customerName || t.customer || ''} ${t.customerEmail || ''}`.toLowerCase();
      return (!needle || haystack.includes(needle)) && (wanted === 'all' || t.status === wanted);
    });
    document.querySelector('#transactionTable').innerHTML = transactionTable(filtered);
  };
  search?.addEventListener('input', rerender); status?.addEventListener('change', rerender);
  document.querySelector('#exportTransactions')?.addEventListener('click', () => {
    const rows = [['reference', 'customer', 'amount', 'status', 'createdAt'], ...state.transactions.map((t) => [t.reference || t.id, t.customerName || t.customer || t.customerEmail || '', t.amount || 0, t.status || 'pending', fmtDate(t.createdAt)])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'apexpay-transactions.csv'; a.click(); URL.revokeObjectURL(url);
  });
}

function bindDevelopers() {
  document.querySelector('#copyKey')?.addEventListener('click', async () => { await navigator.clipboard.writeText(document.querySelector('#publicKey').textContent); toast('Public key copied.', 'success'); });
}

function bindSettings() {
  document.querySelector('#settingsForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = { businessName: document.querySelector('#settingsBusiness').value.trim(), contactName: document.querySelector('#settingsContact').value.trim(), supportEmail: document.querySelector('#settingsEmail').value.trim(), phone: document.querySelector('#settingsPhone').value.trim(), category: document.querySelector('#settingsCategory').value.trim(), updatedAt: serverTimestamp() };
    try { await updateDoc(doc(db, 'merchants', state.user.uid), payload); state.merchant = { ...state.merchant, ...payload }; toast('Business settings saved.', 'success'); render(); }
    catch (error) { toast(error.message, 'error'); }
  });
}

function bindSecurity() {
  document.querySelector('#sendReset')?.addEventListener('click', async () => {
    try { await sendPasswordResetEmail(auth, state.user.email); toast('Password reset email sent.', 'success'); }
    catch (error) { toast(error.message, 'error'); }
  });
}

window.addEventListener('hashchange', render);
onAuthStateChanged(auth, async (user) => {
  state.user = user;
  state.merchant = null;
  state.transactions = []; state.paymentLinks = []; state.customers = [];
  clearListeners();
  if (user) {
    try { await loadMerchant(user); subscribeMerchantData(user.uid); }
    catch (error) { toast(error.message, 'error'); }
  }
  const path = location.hash.replace('#', '') || '/';
  if (user && (path === '/signin' || path === '/signup')) location.hash = '/dashboard';
  else render();
});
