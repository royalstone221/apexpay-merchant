import { db } from './firebase.js';
import { doc,getDoc } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';

const params=new URLSearchParams(location.search);
const title=document.querySelector('#checkoutTitle');
const body=document.querySelector('#checkoutBody');
const money=n=>Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function renderPayment(p){
  title.textContent=`Pay ${p.merchantName||'merchant'}`;
  body.innerHTML=`<p class="eyebrow">${esc(p.reference||'PAYMENT')}</p><h2 style="font-size:3rem;margin:.4rem 0">APX ${money(p.amount)}</h2><p>${esc(p.title||'Payment')}</p><p><span class="status sandbox">SANDBOX</span></p><p class="muted">Merchant identity verified. Customer wallet authorization is the next component; this page cannot alter balances.</p>`;
}

(async()=>{
  try{
    const id=params.get('id');
    const token=params.get('token');
    if(id&&token){
      const snap=await getDoc(doc(db,'paymentIntents',id));
      if(!snap.exists()||snap.data().token!==token){title.textContent='Payment not found';body.textContent='This payment link is invalid or unavailable.';return}
      renderPayment(snap.data());return;
    }

    const merchantId=params.get('merchant');
    const amount=Number(params.get('amount'));
    const reference=params.get('reference');
    if(!merchantId||!reference||!Number.isFinite(amount)||amount<=0){title.textContent='Invalid checkout';body.textContent='Merchant, amount and reference are required.';return}
    const merchantSnap=await getDoc(doc(db,'publicMerchants',merchantId));
    if(!merchantSnap.exists()||merchantSnap.data().status!=='active'){title.textContent='Merchant unavailable';body.textContent='This merchant could not be verified.';return}
    renderPayment({merchantName:merchantSnap.data().businessName,amount,reference,title:params.get('title')||'Online purchase'});
  }catch(e){title.textContent='Checkout unavailable';body.textContent=e.message}
})();
