# ApexPay Merchant

A clean V1 merchant gateway foundation for the ApexPay web-payment ecosystem.

## Stack

- HTML
- CSS
- Vanilla JavaScript
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting

No Stripe, Paystack, external payment API, Node server or custom backend is used.

## Current V1 scope

- Merchant registration and sign-in
- Merchant identity / merchant ID
- Dashboard metrics
- Payment-intent history
- Hosted payment-link generation
- Sandbox checkout page
- Copy-and-paste JavaScript checkout launcher (`pay.js`)
- Firestore rules that deny all client writes to future wallet, ledger, treasury and transaction collections

## Security boundary

This repository intentionally does **not** implement real balance settlement from browser JavaScript. A public browser must never have authority to mint currency or directly change wallet balances. The future customer-wallet + ledger design must preserve this invariant.

## Firebase

The web Firebase configuration is in `js/firebase.js`. Before public deployment, deploy `firestore.rules` and `firestore.indexes.json` to the same Firebase project and configure Firebase Authentication authorized domains.

## Local preview

Serve the repository with any static HTTP server. ES modules will not work correctly when opened directly with `file://`.

## Developer integration

```html
<script src="https://YOUR-DOMAIN/pay.js"></script>
<script>
  ApexPay.open({
    merchantId: 'APX_MERCHANT_ID',
    amount: 100,
    reference: 'ORDER-1001'
  });
</script>
```

The current launcher opens the hosted checkout. Real wallet settlement remains intentionally disabled in this merchant-only repository.
