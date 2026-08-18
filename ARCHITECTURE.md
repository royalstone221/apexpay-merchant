# ApexPay Network Architecture

ApexPay is intentionally split into three applications that share one trusted financial model.

## 1. Merchant Gateway

This repository is the merchant-facing application. It may:

- authenticate a merchant with Firebase Authentication;
- read/update the merchant's own business profile;
- create/manage the merchant's own payment links;
- create/manage the merchant's own customer directory;
- read transaction records assigned to that merchant;
- expose a public merchant integration key.

It must **never** create successful transactions, alter balances, settle funds, reverse money, or approve transfers from browser code.

## 2. Customer Wallet

A separate application will authenticate customers and provide wallet UX: balances, send/receive, merchant checkout, transfer history and account controls. Wallet screens may request operations, but the browser must not be authoritative for the final financial state.

## 3. Admin Panel / Trusted Money Control

A separate privileged application and trusted execution layer will control money flow. It will own the authoritative operations for:

- wallet creation and status;
- debit/credit operations;
- transfer approval and rejection;
- transaction state transitions;
- holds, reversals and disputes;
- merchant restrictions and account limits;
- system fees and settlement states;
- audit trails and network monitoring.

## Shared Firestore model

```text
merchants/{merchantId}
  paymentLinks/{linkId}
  customers/{customerId}
  transactions/{transactionId}  # merchant reads only

wallets/{walletId}               # trusted layer only
ledger/{entryId}                 # append-only trusted layer
moneyOperations/{operationId}    # trusted layer workflow
```

A future wallet/customer model can be added without changing the merchant-owned subcollections above.

## Financial invariants

1. A client-provided amount or status is never sufficient proof that money moved.
2. Successful transaction records are created only after the trusted layer commits the corresponding financial operation.
3. Balances are derived from or updated alongside authoritative ledger operations, never from browser-local state.
4. Every money operation has a unique reference/idempotency key to prevent double-spend via retries.
5. Reversals create compensating ledger entries; history is not silently rewritten.
6. Admin actions that affect money require an audit record.
7. Merchant and wallet frontends receive least-privilege Firestore access.

## Current Merchant V1 boundary

The merchant app currently implements the safe client-side portion: authentication, business profile, customers, payment links, developer identity and read-only ledger visibility. The settlement engine and admin money controls are deliberately not simulated in the browser.
