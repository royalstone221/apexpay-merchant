import './styles.css';
import { auth, db, firebaseReady } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

const app = document.querySelector('#app');
let activeUnsubscribers = [];

const money = (value = 0) => `APX ${Number(value || 0).toFixed(2)}`;
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const shell = (content) => `
<header class="topbar"><a class="brand" href="#/">Apex<span>Pay</span></a><nav><a href="#/dashboard">Dashboard</a><a href="#/transactions">Transactions</a><a href="#/links">Payment Links</a><a href="#/developers">Developers</a></nav><button id="authButton" class="ghost">Sign in</button></header>
<main>${content}</main><footer>© 2026 ApexPay · Merchant Gateway</footer>`;

const home = () => shell(`<section class="hero"><div><div class="eyebrow">MERCHANT PAYMENT INFRASTRUCTURE</div><h1>Accept the new digital economy.</h1><p>Create payment links, monitor transactions and integrate ApexPay checkout into JavaScript-based stores and web apps.</p><div class="actions"><a class="primary" href="#/signup">Create merchant account</a><a class="secondary" href="#/developers">View integration</a></div></div><div class="terminal"><div class="terminal-head">ApexPay Checkout</div><code>&lt;script src="https://checkout.apexpay.app/v1.js"&gt;&lt;/script&gt;<br/><br/>ApexPay.checkout({<br/> &nbsp;amount: 250,<br/> &nbsp;currency: "APX",<br/> &nbsp;reference: "ORDER-1042"<br/>});</code><div class="note">Integration contract preview — checkout service will be activated when the trusted transaction backend is implemented.</div></div></section><section class="features"><article><b>Payment Links</b><p>Create reusable checkout links for products and services.</p></article><article><b>Transaction Ledger</b><p>See merchant transaction records and payment status in one place.</p></article><article><b>JavaScript Integration</b><p>A simple browser integration surface for compatible web applications.</p></article></section>`);

const authPage = (mode = 'signin') => shell(`<section class="auth-card"><div class="eyebrow">${mode === 'signup' ? 'NEW MERCHANT' : 'MERCHANT ACCESS'}</div><h2>${mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>${!firebaseReady ? '<div class="warning">Firebase is not configured.</div>' : ''}<form id="authForm">${mode === 'signup' ? '<label>Business name<input id="business" required minlength="2" maxlength="120" placeholder="Your business"/></label>' : ''}<label>Email<input id="email" type="email" required placeholder="merchant@example.com"/></label><label>Password<input id="password" type="password" minlength="6" required placeholder="••••••••"/></label><button class="primary" type="submit">${mode === 'signup' ? 'Create account' : 'Sign in'}</button><p id="message"></p></form><p>${mode === 'signup' ? 'Already registered? <a href="#/signin">Sign in</a>' : 'New merchant? <a href="#/signup">Create account</a>'}</p></section>`);

const dashboard = () => shell(`<section class="page"><div class="eyebrow">MERCHANT CONSOLE</div><h2>Dashboard</h2><div class="stats"><article><small>Recorded volume</small><strong id="volumeStat">APX 0.00</strong></article><article><small>Successful payments</small><strong id="successStat">0</strong></article><article><small>Transactions</small><strong id="transactionStat">0</strong></article></div><div class="panel"><h3>Recent activity</h3><div id="recentActivity" class="muted">Loading transaction records…</div></div></section>`);

const transactions = () => shell(`<section class="page"><div class="eyebrow">LEDGER</div><h2>Transactions</h2><div class="panel"><table><thead><tr><th>Reference</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead><tbody id="transactionRows"><tr><td colspan="4" class="muted">Loading transactions…</td></tr></tbody></table></div></section>`);

const links = () => shell(`<section class="page"><div class="eyebrow">CHECKOUT</div><h2>Payment Links</h2><div class="panel"><h3>Create payment link</h3><form id="linkForm" class="grid"><label>Title<input id="linkTitle" required maxlength="160" placeholder="Product or service"/></label><label>Amount (APX)<input id="linkAmount" type="number" min="0.01" step="0.01" required placeholder="0.00"/></label><div><button class="primary" type="submit">Create link</button><p id="linkMessage" class="muted"></p></div></form></div><div class="panel"><h3>Your links</h3><div id="paymentLinkList" class="muted">Loading payment links…</div></div></section>`);

const developers = () => shell(`<section class="page"><div class="eyebrow">DEVELOPERS</div><h2>JavaScript integration</h2><div class="panel"><p>ApexPay is being designed around a small browser integration contract rather than requiring merchants to install an SDK.</p><pre>&lt;script src="https://checkout.apexpay.app/v1.js"&gt;&lt;/script&gt;
&lt;script&gt;
ApexPay.checkout({
  merchant: "YOUR_MERCHANT_ID",
  amount: 250,
  currency: "APX",
  reference: "ORDER-1042"
});
&lt;/script&gt;</pre><div class="warning">Client-side JavaScript is not authoritative for balances or settlement. Those operations require trusted transaction logic.</div></div></section>`);

function requireMerchantPage(renderer) {
  if (!auth?.currentUser) return authPage('signin');
  return renderer();
}

function route() {
  activeUnsubscribers.forEach((unsubscribe) => unsubscribe());
  activeUnsubscribers = [];

  const path = location.hash.replace('#', '') || '/';
  if (path === '/signup') app.innerHTML = authPage('signup');
  else if (path === '/signin') app.innerHTML = authPage('signin');
  else if (path === '/dashboard') app.innerHTML = requireMerchantPage(dashboard);
  else if (path === '/transactions') app.innerHTML = requireMerchantPage(transactions);
  else if (path === '/links') app.innerHTML = requireMerchantPage(links);
  else if (path === '/developers') app.innerHTML = developers();
  else app.innerHTML = home();

  bind(path);
}

function bind(path) {
  const authButton = document.querySelector('#authButton');
  if (authButton) {
    authButton.onclick = () => {
      if (auth?.currentUser) signOut(auth).then(() => { location.hash = '/'; });
      else location.hash = '/signin';
    };
    if (auth?.currentUser) authButton.textContent = 'Sign out';
  }

  const form = document.querySelector('#authForm');
  if (form) {
    form.onsubmit = async (event) => {
      event.preventDefault();
      const msg = document.querySelector('#message');
      try {
        const email = document.querySelector('#email').value.trim();
        const password = document.querySelector('#password').value;
        const business = document.querySelector('#business');
        if (business) {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          await setDoc(doc(db, 'merchants', cred.user.uid), {
            businessName: business.value.trim(),
            email: cred.user.email,
            createdAt: serverTimestamp(),
          });
        } else {
          await signInWithEmailAndPassword(auth, email, password);
        }
        location.hash = '/dashboard';
      } catch (err) {
        msg.textContent = err.message;
      }
    };
  }

  if (!auth?.currentUser) return;
  if (path === '/links') bindPaymentLinks(auth.currentUser.uid);
  if (path === '/transactions') bindTransactions(auth.currentUser.uid, false);
  if (path === '/dashboard') bindTransactions(auth.currentUser.uid, true);
}

function bindPaymentLinks(uid) {
  const form = document.querySelector('#linkForm');
  const list = document.querySelector('#paymentLinkList');
  const linksRef = collection(db, 'merchants', uid, 'paymentLinks');

  if (form) {
    form.onsubmit = async (event) => {
      event.preventDefault();
      const message = document.querySelector('#linkMessage');
      const title = document.querySelector('#linkTitle').value.trim();
      const amount = Number(document.querySelector('#linkAmount').value);
      message.textContent = 'Saving…';
      try {
        await addDoc(linksRef, {
          title,
          amount,
          currency: 'APX',
          status: 'active',
          merchantId: uid,
          createdAt: serverTimestamp(),
        });
        form.reset();
        message.textContent = 'Payment link created.';
      } catch (err) {
        message.textContent = err.message;
      }
    };
  }

  const unsubscribe = onSnapshot(query(linksRef, orderBy('createdAt', 'desc')), (snapshot) => {
    if (!list) return;
    if (snapshot.empty) {
      list.innerHTML = '<p class="muted">No payment links yet.</p>';
      return;
    }
    list.innerHTML = snapshot.docs.map((item) => {
      const data = item.data();
      return `<article class="link-row"><div><strong>${escapeHtml(data.title)}</strong><div class="muted">${escapeHtml(item.id)}</div></div><div><strong>${money(data.amount)}</strong><div class="muted">${escapeHtml(data.status || 'active')}</div></div></article>`;
    }).join('');
  }, (err) => {
    if (list) list.textContent = err.message;
  });

  activeUnsubscribers.push(unsubscribe);
}

function bindTransactions(uid, compact) {
  const transactionsRef = collection(db, 'merchants', uid, 'transactions');
  const transactionQuery = query(transactionsRef, orderBy('createdAt', 'desc'), limit(compact ? 10 : 100));

  const unsubscribe = onSnapshot(transactionQuery, (snapshot) => {
    const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

    if (compact) {
      const volume = records.filter((item) => item.status === 'success').reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const successful = records.filter((item) => item.status === 'success').length;
      const volumeStat = document.querySelector('#volumeStat');
      const successStat = document.querySelector('#successStat');
      const transactionStat = document.querySelector('#transactionStat');
      const recentActivity = document.querySelector('#recentActivity');
      if (volumeStat) volumeStat.textContent = money(volume);
      if (successStat) successStat.textContent = String(successful);
      if (transactionStat) transactionStat.textContent = String(records.length);
      if (recentActivity) recentActivity.innerHTML = records.length
        ? records.slice(0, 5).map((item) => `<article class="link-row"><div><strong>${escapeHtml(item.reference || item.id)}</strong><div class="muted">${escapeHtml(item.customer || 'Customer')}</div></div><div><strong>${money(item.amount)}</strong><div class="muted">${escapeHtml(item.status || 'pending')}</div></div></article>`).join('')
        : '<p class="muted">No transactions yet.</p>';
      return;
    }

    const rows = document.querySelector('#transactionRows');
    if (!rows) return;
    rows.innerHTML = records.length
      ? records.map((item) => `<tr><td>${escapeHtml(item.reference || item.id)}</td><td>${escapeHtml(item.customer || 'Customer')}</td><td>${money(item.amount)}</td><td>${escapeHtml(item.status || 'pending')}</td></tr>`).join('')
      : '<tr><td colspan="4" class="muted">No transactions yet.</td></tr>';
  }, (err) => {
    const target = compact ? document.querySelector('#recentActivity') : document.querySelector('#transactionRows');
    if (target) target.textContent = err.message;
  });

  activeUnsubscribers.push(unsubscribe);
}

window.addEventListener('hashchange', route);
onAuthStateChanged(auth, route);
route();
