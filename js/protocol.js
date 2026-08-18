// ApexPay V1 shared protocol constants.
// Keep this file synchronized across Merchant, Wallet and Admin repositories.

export const APEXPAY_PROTOCOL = Object.freeze({
  version: '1.0',
  currency: Object.freeze({
    code: 'APX',
    name: 'ApexPay',
    decimals: 2,
    minorUnitFactor: 100
  }),
  paymentStates: Object.freeze({
    CREATED: 'created',
    AWAITING_CUSTOMER: 'awaiting_customer',
    AUTHORIZED: 'authorized',
    PROCESSING: 'processing',
    SETTLED: 'settled',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired',
    DECLINED: 'declined',
    FAILED: 'failed',
    REVERSED: 'reversed'
  }),
  collections: Object.freeze({
    customers: 'customers',
    merchants: 'merchants',
    publicMerchants: 'publicMerchants',
    wallets: 'wallets',
    paymentIntents: 'paymentIntents',
    transactions: 'transactions',
    ledgerEntries: 'ledgerEntries',
    treasuryOperations: 'treasuryOperations',
    adminUsers: 'adminUsers',
    auditEvents: 'auditEvents'
  })
});

export function toMinorUnits(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) throw new Error('Amount must be greater than zero.');
  const minor = Math.round(numeric * APEXPAY_PROTOCOL.currency.minorUnitFactor);
  if (!Number.isSafeInteger(minor)) throw new Error('Amount is outside the supported range.');
  return minor;
}

export function fromMinorUnits(value) {
  if (!Number.isSafeInteger(value)) return 0;
  return value / APEXPAY_PROTOCOL.currency.minorUnitFactor;
}

export function formatAPXMinor(value) {
  return `${APEXPAY_PROTOCOL.currency.code} ${fromMinorUnits(value).toLocaleString(undefined, {
    minimumFractionDigits: APEXPAY_PROTOCOL.currency.decimals,
    maximumFractionDigits: APEXPAY_PROTOCOL.currency.decimals
  })}`;
}

export function createReference(prefix = 'APX') {
  const time = Date.now().toString(36).toUpperCase();
  const random = Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${prefix}_${time}_${random}`;
}
