# ApexPay Shared Financial Protocol

Status: V1 foundation

ApexPay is designed as three separate web applications sharing one financial data model:

1. ApexPay Merchant — merchant operations, checkout creation, payment links and JavaScript integration.
2. ApexPay Wallet — customer wallet, payment authorization, transfers and transaction history.
3. ApexPay Admin — treasury, risk, compliance, merchant operations and audit oversight.

## V1 technology boundary

- HTML
- CSS
- JavaScript
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- Firestore Security Rules
- No third-party payment processor
- No external payment API
- No external payment SDK
- Third-party web integrations use ApexPay-hosted JavaScript checkout.

## Currency model

Working currency code: APX.

All monetary amounts are represented as integer minor units in authoritative financial records. UI applications may display decimal values, but ledger records must never use floating-point arithmetic as the source of truth.

Example: APX 10.25 is stored as 1025 minor units when the currency uses two decimal places.

Currency parameters belong in a versioned protocol configuration and must not be silently changed by a client application.

## Financial invariants

1. A settled transaction is immutable.
2. Currency cannot appear because a client changes a balance field.
3. Every value movement has a globally unique transaction ID.
4. Every completed value movement has matching debit and credit ledger entries.
5. Sum of ledger debits must equal sum of ledger credits for each completed transaction.
6. Reversals create new compensating entries; they never rewrite historical entries.
7. Merchant and customer clients cannot mint currency.
8. Treasury issuance and destruction are separately auditable operations.
9. Financial records use server timestamps where Firebase rules permit them.
10. Idempotency/reference controls prevent accidental duplicate payments.

## Identity domains

### Customer
Owns a wallet identity and may request authorized payments/transfers subject to account state and limits.

### Merchant
Owns a merchant identity and may create checkout/payment requests and read payments belonging to that merchant. A merchant cannot debit a customer wallet directly.

### Admin
Administrative access is role-scoped. Support, risk, compliance, merchant operations, audit and treasury are separate responsibilities. Treasury powers must not be granted to ordinary support roles.

## Core collections

The shared Firebase project is expected to converge on these logical domains:

- `customers/{uid}` — private customer profile.
- `merchants/{uid}` — private merchant profile.
- `publicMerchants/{merchantId}` — minimal checkout-safe merchant identity.
- `wallets/{walletId}` — wallet metadata and cached/derived balance state.
- `paymentIntents/{paymentId}` — checkout/payment request lifecycle.
- `transactions/{transactionId}` — canonical transaction envelope.
- `ledgerEntries/{entryId}` — immutable debit/credit entries.
- `treasuryOperations/{operationId}` — issuance/destruction operations.
- `adminUsers/{uid}` — administrative role assignments.
- `auditEvents/{eventId}` — security and administrative audit events.
- `protocol/config` — versioned monetary/network configuration.

## Payment lifecycle

Canonical states:

`created -> awaiting_customer -> authorized -> processing -> settled`

Terminal/exception states:

`cancelled`, `expired`, `declined`, `failed`, `reversed`.

A merchant creates a payment intent. The hosted ApexPay checkout presents it to the customer. The customer explicitly authorizes the payment from the Wallet domain. A successful financial transition creates a transaction and balanced ledger entries. The merchant observes settlement; it does not declare settlement itself.

## JavaScript integration contract

A merchant website integrates ApexPay through an ApexPay-hosted script and checkout page. Merchant websites provide public transaction context such as merchant ID, amount, reference and description. They never receive customer credentials or privileged Firebase access.

Browser callbacks are UX signals only. A merchant must use ApexPay's authoritative payment state before treating a payment as financially final. Under the V1 browser-only constraint, the hosted checkout and Firestore rules must expose only the minimum read model necessary to confirm a specific transaction.

## Security posture

All frontend JavaScript is considered public and attacker-controlled. Security must never depend on hidden source code, obscured collection names or secret values embedded in the browser.

Firestore rules are deny-by-default. Public reads are document-specific and minimized. Financial write paths must validate identity, ownership, allowed state transitions, immutable fields, amount bounds and affected-document relationships.

No application may directly expose a generic `set balance` operation.

## Auditability

Every treasury/admin action that affects accounts, merchants, transaction status, limits or monetary supply requires an audit record containing actor identity, action type, target, reason, timestamp and before/after identifiers where appropriate.

## Infrastructure independence

Firebase is the V1 infrastructure, not the definition of APX. The monetary rules, transaction identifiers and ledger semantics are documented independently so the system can migrate infrastructure without redefining the currency or invalidating historical transactions.

## Production gate

No component should be described as production-grade solely because its UI works. Public monetary operation requires completion and testing of the shared ledger, authorization flow, security rules, account recovery, audit controls, abuse controls, operational monitoring and applicable regulatory controls.
