import { db } from './firebase.js';
import { APEXPAY_PROTOCOL, toMinorUnits, formatAPXMinor } from './protocol.js';
import { doc,getDoc } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';

const params=new URLSearchParams(location.search);
const title=document.querySelector('#checkoutTitle');
const body=document.querySelector('#checkoutBody');
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function renderPayment(p){
  const amountMinor=Number.isSafeInteger(p.amountMinor)?p.amountMinor:toMinorUnits(p.amount);
  const status=p.status||APEXPAY_PROTOCOL.paymentStates.CREATED;
  title.textContent=`Pay ${p.merchantName||'merchant'}`;
  body.innerHTML=`<p class="eyebrow">${esc(p.reference||'PAYMENT')}</p><h2 style="font-size:3rem;margin:.4rem 0">${formatAPXMinor(amountMinor)}</h2><p>${esc(p.title||'Payment')}</p><p><span class="status sandbox">${esc(status.replaceAll('_',' ').toUpperCase())}</span></p><p class="muted">Merchant identity verified. This checkout does not have authority to mint currency or directly alter wallet balances. Wallet authorization and ledger settlement are handled by the shared ApexPay financial flow.</p>`;
}

(async()=>{
  try{
    const id=params.get('id');
    const token=params.get('token');
    if(id&&token){
      const snap=await getDoc(doc(db,'paymentIntents',id));
      if(!snap.exists()||snap.data().token!==token){title.textContent='Payment not found';body.textContent='This payment link is invalid or unavailable.';return}
      const payment=snap.data();
      if(![APEXPAY_PROTOCOL.paymentStates.CREATED,APEXPAY_PROTOCOL.paymentStates.AWAITING_CUSTOMER].includes(payment.status)){
        title.textContent='Payment unavailable';body.textContent=`This payment is ${String(payment.status||'unavailable').replaceAll('_',' ')}.`;return;
      }
      renderPayment(payment);return;
    }

    // Lightweight JavaScript launcher mode. This is a checkout presentation only;
    // it does not prove the merchant's order total. Authoritative order/payment
    // intents must come from an ApexPay-controlled merchant-created record.
    const merchantId=params.get('merchant');
    const reference=params.get('reference');
    let amountMinor;
    try{amountMinor=toMinorUnits(params.get('amount'))}catch{}
    if(!merchantId||!reference||!Number.isSafeInteger(amountMinor)){title.textContent='Invalid checkout';body.textContent='Merchant, amount and reference are required.';return}
    const merchantSnap=await getDoc(doc(db,'publicMerchants',merchantId));
    if(!merchantSnap.exists()||merchantSnap.data().status!=='active'){title.textContent='Merchant unavailable';body.textContent='This merchant could not be verified.';return}
    renderPayment({merchantName:merchantSnap.data().businessName,amountMinor,reference,title:params.get('title')||'Online purchase',status:APEXPAY_PROTOCOL.paymentStates.CREATED});
  }catch(e){title.textContent='Checkout unavailable';body.textContent=e.message}
})();
