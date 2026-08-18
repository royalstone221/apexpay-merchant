(function(global){
  'use strict';

  const VERSION='1.0.0';
  const script=document.currentScript;
  const base=script&&script.src?new URL('.',script.src).href:new URL('.',location.href).href;
  const checkoutOrigin=new URL(base).origin;
  let active=null;

  function requireText(value,name,max){
    const text=String(value??'').trim();
    if(!text)throw new Error(`ApexPay: ${name} is required`);
    if(text.length>max)throw new Error(`ApexPay: ${name} is too long`);
    return text;
  }

  function normalizeAmount(value){
    const amount=Number(value);
    if(!Number.isFinite(amount)||amount<=0)throw new Error('ApexPay: amount must be greater than zero');
    const minor=Math.round(amount*100);
    if(!Number.isSafeInteger(minor)||minor>100000000000)throw new Error('ApexPay: amount is outside the supported range');
    return (minor/100).toFixed(2);
  }

  function open(options){
    if(!options||typeof options!=='object')throw new Error('ApexPay: checkout options are required');
    const merchantId=requireText(options.merchantId,'merchantId',128);
    const reference=requireText(options.reference,'reference',120);
    const amount=normalizeAmount(options.amount);
    const title=options.title?requireText(options.title,'title',160):'';

    const url=new URL('checkout.html',base);
    url.searchParams.set('merchant',merchantId);
    url.searchParams.set('amount',amount);
    url.searchParams.set('reference',reference);
    if(title)url.searchParams.set('title',title);

    const popup=global.open(url.href,'ApexPayCheckout','popup=yes,width=480,height=720,resizable=yes,scrollbars=yes');
    if(!popup)throw new Error('ApexPay: checkout popup was blocked by the browser');

    active={popup,reference,onSuccess:typeof options.onSuccess==='function'?options.onSuccess:null,onClose:typeof options.onClose==='function'?options.onClose:null};
    popup.focus?.();
    return Object.freeze({reference,close:()=>popup.close()});
  }

  global.addEventListener('message',event=>{
    if(event.origin!==checkoutOrigin||!active||event.source!==active.popup)return;
    const data=event.data;
    if(!data||data.source!=='apexpay-checkout'||data.reference!==active.reference)return;
    if(data.type==='apexpay:settled'&&active.onSuccess)active.onSuccess(Object.freeze({...data}));
    if(data.type==='apexpay:closed'){
      const callback=active.onClose;
      active=null;
      if(callback)callback(Object.freeze({...data}));
    }
  });

  const api=Object.freeze({version:VERSION,open});
  global.ApexPay=api;
  // Backward-compatible alias for the earliest internal prototype.
  global.RoyalPay=api;
})(window);
