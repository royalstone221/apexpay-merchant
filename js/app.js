import { auth, db } from './firebase.js';
import { APEXPAY_PROTOCOL, toMinorUnits, formatAPXMinor, createReference } from './protocol.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { doc, setDoc, getDoc, collection, addDoc, query, where, orderBy, getDocs, serverTimestamp, limit } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let merchant = null;
let merchantWallet = null;
let currentPayments = [];

function toast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2600)}
function merchantCode(uid){return `APX_${uid.slice(0,6).toUpperCase()}_${uid.slice(-4).toUpperCase()}`}
function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(18)),b=>b.toString(16).padStart(2,'0')).join('')}
function stateLabel(value){return String(value||'created').replaceAll('_',' ').toUpperCase()}
function displayAmount(payment){
  if(Number.isSafeInteger(payment.amountMinor)) return formatAPXMinor(payment.amountMinor);
  const legacy=Number(payment.amount||0);
  return `${APEXPAY_PROTOCOL.currency.code} ${legacy.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

$$('[data-auth-tab]').forEach(btn=>btn.addEventListener('click',()=>{
  $$('[data-auth-tab]').forEach(x=>x.classList.toggle('active',x===btn));
  $('#loginForm').classList.toggle('hidden',btn.dataset.authTab!=='login');
  $('#registerForm').classList.toggle('hidden',btn.dataset.authTab!=='register');
}));

async function ensurePublicMerchant(uid,data){
  await setDoc(doc(db,'publicMerchants',data.merchantId),{
    ownerUid:uid,merchantId:data.merchantId,businessName:data.businessName,status:data.status,
    currency:APEXPAY_PROTOCOL.currency.code,protocolVersion:APEXPAY_PROTOCOL.version
  },{merge:true});
}

async function ensureMerchantWallet(uid){
  const walletRef=doc(db,'wallets',uid);
  const snap=await getDoc(walletRef);
  if(!snap.exists()){
    await setDoc(walletRef,{
      ownerUid:uid,ownerType:'merchant',currency:APEXPAY_PROTOCOL.currency.code,
      availableBalanceMinor:0,pendingBalanceMinor:0,status:'active',
      protocolVersion:APEXPAY_PROTOCOL.version,createdAt:serverTimestamp()
    });
    merchantWallet={id:uid,availableBalanceMinor:0,pendingBalanceMinor:0,status:'active'};
  }else merchantWallet={id:snap.id,...snap.data()};
}

$('#registerForm').addEventListener('submit',async(e)=>{
  e.preventDefault();
  const businessName=$('#businessName').value.trim();
  const email=$('#registerEmail').value.trim();
  const password=$('#registerPassword').value;
  try{
    const cred=await createUserWithEmailAndPassword(auth,email,password);
    const merchantId=merchantCode(cred.user.uid);
    const data={
      ownerUid:cred.user.uid,businessName,email,merchantId,status:'active',environment:'sandbox',
      currency:APEXPAY_PROTOCOL.currency.code,protocolVersion:APEXPAY_PROTOCOL.version,createdAt:serverTimestamp()
    };
    await setDoc(doc(db,'merchants',cred.user.uid),data);
    await ensureMerchantWallet(cred.user.uid);
    await ensurePublicMerchant(cred.user.uid,data);
    toast('Merchant account created');
  }catch(err){toast(err.message.replace('Firebase: ',''))}
});

$('#loginForm').addEventListener('submit',async(e)=>{
  e.preventDefault();
  try{await signInWithEmailAndPassword(auth,$('#loginEmail').value.trim(),$('#loginPassword').value)}catch(err){toast(err.message.replace('Firebase: ',''))}
});
$('#logoutBtn').addEventListener('click',()=>signOut(auth));

onAuthStateChanged(auth,async(user)=>{
  if(!user){merchant=null;merchantWallet=null;$('#appView').classList.add('hidden');$('#authView').classList.remove('hidden');return}
  const snap=await getDoc(doc(db,'merchants',user.uid));
  if(!snap.exists()){toast('Merchant profile is missing');await signOut(auth);return}
  merchant={uid:user.uid,...snap.data()};
  try{await ensureMerchantWallet(user.uid);await ensurePublicMerchant(user.uid,merchant)}catch(err){toast('Account financial profile needs attention')}
  $('#authView').classList.add('hidden');$('#appView').classList.remove('hidden');
  bindMerchant();await loadPayments();
});

function bindMerchant(){
  const name=merchant.businessName||'Merchant';
  $('#merchantName').textContent=name;$('#merchantInitial').textContent=name[0].toUpperCase();$('#merchantId').textContent=merchant.merchantId;
  $('#settingsBusinessName').textContent=name;$('#settingsEmail').textContent=merchant.email;$('#settingsMerchantId').textContent=merchant.merchantId;
  $('#balance').textContent=formatAPXMinor(Number.isSafeInteger(merchantWallet?.availableBalanceMinor)?merchantWallet.availableBalanceMinor:0).replace('APX ','');
  $('#integrationCode').textContent=`ApexPay.open({\n  merchantId: '${merchant.merchantId}',\n  amount: 100.00,\n  reference: 'ORDER-1001'\n});`;
}

$$('.nav-item[data-page]').forEach(btn=>btn.addEventListener('click',()=>go(btn.dataset.page)));
$$('[data-go]').forEach(btn=>btn.addEventListener('click',()=>go(btn.dataset.go)));
$('#newLinkHero').addEventListener('click',()=>go('links'));
function go(page){$$('.page').forEach(x=>x.classList.toggle('active-page',x.id===page));$$('.nav-item[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('#pageTitle').textContent=({overview:'Overview',payments:'Payments',links:'Payment links',developers:'Developers',settings:'Settings'})[page]||page}

async function loadPayments(){
  if(!merchant)return;
  try{
    const q=query(collection(db,'paymentIntents'),where('merchantUid','==',merchant.uid),orderBy('createdAt','desc'),limit(100));
    const snap=await getDocs(q);currentPayments=snap.docs.map(d=>({id:d.id,...d.data()}));renderPayments();
  }catch(err){
    const q=query(collection(db,'paymentIntents'),where('merchantUid','==',merchant.uid),limit(100));
    const snap=await getDocs(q);currentPayments=snap.docs.map(d=>({id:d.id,...d.data()}));renderPayments();
  }
}
$('#refreshPayments').addEventListener('click',loadPayments);

function renderPayments(){
  const settled=currentPayments.filter(x=>x.status===APEXPAY_PROTOCOL.paymentStates.SETTLED);
  const open=currentPayments.filter(x=>[APEXPAY_PROTOCOL.paymentStates.CREATED,APEXPAY_PROTOCOL.paymentStates.AWAITING_CUSTOMER,APEXPAY_PROTOCOL.paymentStates.AUTHORIZED,APEXPAY_PROTOCOL.paymentStates.PROCESSING].includes(x.status));
  $('#successCount').textContent=settled.length;$('#pendingCount').textContent=open.length;
  $('#volume').textContent=formatAPXMinor(settled.reduce((sum,p)=>sum+(Number.isSafeInteger(p.amountMinor)?p.amountMinor:Math.round(Number(p.amount||0)*100)),0));
  const rows=currentPayments.map(p=>`<tr><td><strong>${escapeHtml(p.reference||'—')}</strong></td><td>${escapeHtml(p.title||'Payment')}</td><td>${displayAmount(p)}</td><td><span class="status ${p.status||'created'}">${escapeHtml(stateLabel(p.status))}</span></td><td>${p.createdAt?.toDate?p.createdAt.toDate().toLocaleString():'Just now'}</td></tr>`).join('');
  const table=rows?`<table class="payment-table"><thead><tr><th>Reference</th><th>Description</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table>`:'<div class="empty-box">No payment activity yet.</div>';
  $('#paymentsTable').innerHTML=table;
  $('#recentPayments').innerHTML=rows?`<table class="payment-table"><thead><tr><th>Reference</th><th>Amount</th><th>Status</th></tr></thead><tbody>${currentPayments.slice(0,5).map(p=>`<tr><td>${escapeHtml(p.reference||'—')}</td><td>${displayAmount(p)}</td><td><span class="status ${p.status||'created'}">${escapeHtml(stateLabel(p.status))}</span></td></tr>`).join('')}</tbody></table>`:'<div class="empty-box">Your first payment will appear here.</div>';
}

$('#paymentLinkForm').addEventListener('submit',async(e)=>{
  e.preventDefault();if(!merchant)return;
  let amountMinor;
  try{amountMinor=toMinorUnits($('#linkAmount').value)}catch(err){return toast(err.message)}
  const token=randomToken();
  const merchantReference=$('#linkReference').value.trim()||createReference('ORDER');
  const payload={
    merchantUid:merchant.uid,merchantId:merchant.merchantId,merchantName:merchant.businessName,
    title:$('#linkTitle').value.trim(),amountMinor,reference:merchantReference,
    currency:APEXPAY_PROTOCOL.currency.code,status:APEXPAY_PROTOCOL.paymentStates.CREATED,
    protocolVersion:APEXPAY_PROTOCOL.version,token,source:'payment_link',createdAt:serverTimestamp()
  };
  try{
    const ref=await addDoc(collection(db,'paymentIntents'),payload);
    const url=new URL('./checkout.html',location.href);url.searchParams.set('id',ref.id);url.searchParams.set('token',token);
    $('#generatedLink').innerHTML=`<p><strong>${escapeHtml(payload.title)}</strong> · ${formatAPXMinor(amountMinor)}</p><div class="generated-url">${escapeHtml(url.href)}</div><p><button id="copyGenerated" class="secondary">Copy link</button></p>`;
    $('#copyGenerated').onclick=()=>copy(url.href,'Payment link copied');
    e.target.reset();await loadPayments();
  }catch(err){toast(err.message)}
});

$('#copyCode').addEventListener('click',()=>copy($('#integrationCode').textContent,'Integration copied'));
$('#copyMerchantId').addEventListener('click',()=>copy(merchant?.merchantId||'','Merchant ID copied'));
async function copy(value,msg){try{await navigator.clipboard.writeText(value);toast(msg)}catch{toast('Copy failed — select the text manually')}}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
