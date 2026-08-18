import './styles.css';
import { auth, db, firebaseReady } from './firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const app = document.querySelector('#app');

const shell = (content) => `
<header class="topbar"><a class="brand" href="#/">Apex<span>Pay</span></a><nav><a href="#/dashboard">Dashboard</a><a href="#/transactions">Transactions</a><a href="#/links">Payment Links</a><a href="#/developers">Developers</a></nav><button id="authButton" class="ghost">Sign in</button></header>
<main>${content}</main><footer>© 2026 ApexPay · Merchant Gateway</footer>`;

const home = () => shell(`<section class="hero"><div><div class="eyebrow">MERCHANT PAYMENT INFRASTRUCTURE</div><h1>Accept the new digital economy.</h1><p>Create payment links, monitor transactions and integrate ApexPay checkout into JavaScript-based stores and web apps.</p><div class="actions"><a class="primary" href="#/signup">Create merchant account</a><a class="secondary" href="#/developers">View integration</a></div></div><div class="terminal"><div class="terminal-head">ApexPay Checkout</div><code>&lt;script src="https://checkout.apexpay.app/v1.js"&gt;&lt;/script&gt;<br/><br/>ApexPay.checkout({<br/> &nbsp;amount: 250,<br/> &nbsp;currency: "APX",<br/> &nbsp;reference: "ORDER-1042"<br/>});</code><div class="note">Integration contract preview — checkout service will be activated when the trusted transaction backend is implemented.</div></div></section><section class="features"><article><b>Payment Links</b><p>Create reusable checkout links for products and services.</p></article><article><b>Transaction Ledger</b><p>See merchant transaction records and payment status in one place.</p></article><article><b>JavaScript Integration</b><p>A simple browser integration surface for compatible web applications.</p></article></section>`);

const authPage = (mode='signin') => shell(`<section class="auth-card"><div class="eyebrow">${mode==='signup'?'NEW MERCHANT':'MERCHANT ACCESS'}</div><h2>${mode==='signup'?'Create your account':'Welcome back'}</h2>${!firebaseReady?'<div class="warning">Firebase environment variables are not configured yet.</div>':''}<form id="authForm">${mode==='signup'?'<label>Business name<input id="business" required placeholder="Your business"/></label>':''}<label>Email<input id="email" type="email" required placeholder="merchant@example.com"/></label><label>Password<input id="password" type="password" minlength="6" required placeholder="••••••••"/></label><button class="primary" type="submit">${mode==='signup'?'Create account':'Sign in'}</button><p id="message"></p></form><p>${mode==='signup'?'Already registered? <a href="#/signin">Sign in</a>':'New merchant? <a href="#/signup">Create account</a>'}</p></section>`);

const dashboard = () => shell(`<section class="page"><div class="eyebrow">MERCHANT CONSOLE</div><h2>Dashboard</h2><div class="stats"><article><small>Available balance</small><strong>APX 0.00</strong></article><article><small>Total received</small><strong>APX 0.00</strong></article><article><small>Transactions</small><strong>0</strong></article></div><div class="panel"><h3>Recent activity</h3><p class="muted">Transaction records will appear here after the payment-processing layer is activated.</p></div></section>`);
const transactions = () => shell(`<section class="page"><div class="eyebrow">LEDGER</div><h2>Transactions</h2><div class="panel"><table><thead><tr><th>Reference</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead><tbody><tr><td colspan="4" class="muted">No transactions yet.</td></tr></tbody></table></div></section>`);
const links = () => shell(`<section class="page"><div class="eyebrow">CHECKOUT</div><h2>Payment Links</h2><div class="panel"><h3>Create payment link</h3><div class="grid"><label>Title<input placeholder="Product or service"/></label><label>Amount (APX)<input type="number" min="0" placeholder="0.00"/></label></div><button class="primary">Create link</button><p class="muted">Link persistence will use Firestore once Firebase is configured.</p></div></section>`);
const developers = () => shell(`<section class="page"><div class="eyebrow">DEVELOPERS</div><h2>JavaScript integration</h2><div class="panel"><p>ApexPay is being designed around a small browser integration contract rather than requiring merchants to install an SDK.</p><pre>&lt;script src="https://checkout.apexpay.app/v1.js"&gt;&lt;/script&gt;
&lt;script&gt;
ApexPay.checkout({
  merchant: "YOUR_MERCHANT_ID",
  amount: 250,
  currency: "APX",
  reference: "ORDER-1042"
});
&lt;/script&gt;</pre><div class="warning">Do not treat client-side JavaScript as authoritative for balances or settlement. Those operations require trusted transaction logic.</div></div></section>`);

function route(){const path=location.hash.replace('#','')||'/'; if(path==='/signup') app.innerHTML=authPage('signup'); else if(path==='/signin') app.innerHTML=authPage('signin'); else if(path==='/dashboard') app.innerHTML=dashboard(); else if(path==='/transactions') app.innerHTML=transactions(); else if(path==='/links') app.innerHTML=links(); else if(path==='/developers') app.innerHTML=developers(); else app.innerHTML=home(); bind();}

function bind(){const authButton=document.querySelector('#authButton'); if(authButton){authButton.onclick=()=>{if(auth?.currentUser){signOut(auth).then(()=>location.hash='/');}else location.hash='/signin';}; if(auth?.currentUser) authButton.textContent='Sign out';}
const form=document.querySelector('#authForm'); if(form) form.onsubmit=async(e)=>{e.preventDefault();const msg=document.querySelector('#message');if(!firebaseReady){msg.textContent='Add Firebase environment variables first.';return;}try{const email=document.querySelector('#email').value;const password=document.querySelector('#password').value;if(document.querySelector('#business')){const cred=await createUserWithEmailAndPassword(auth,email,password);await setDoc(doc(db,'merchants',cred.user.uid),{businessName:document.querySelector('#business').value,email,createdAt:serverTimestamp()});}else await signInWithEmailAndPassword(auth,email,password);location.hash='/dashboard';}catch(err){msg.textContent=err.message;}};}

window.addEventListener('hashchange',route); if(auth) onAuthStateChanged(auth,route); route();
