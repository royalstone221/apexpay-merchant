# ApexPay Merchant

Merchant-facing web application for the ApexPay digital payment ecosystem.

## Current V1 foundation

- Responsive merchant landing page
- Firebase email/password merchant authentication
- Merchant dashboard
- Transactions interface
- Payment Links interface
- JavaScript integration documentation screen
- Firestore security rules that prevent merchants from directly writing transaction ledger records
- Vercel/Vite-ready frontend

## Firebase setup

Create a Firebase project and enable Email/Password Authentication and Cloud Firestore. Copy `.env.example` to `.env.local` and fill in the Firebase web configuration values.

Deploy `firestore.rules` to your Firebase project before production use.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Security boundary

The browser must never be authoritative for balances, minting currency, settlement, or irreversible transfers. The transaction ledger is intentionally read-only to merchant clients. A trusted transaction-processing layer must be implemented before ApexPay handles real value.
