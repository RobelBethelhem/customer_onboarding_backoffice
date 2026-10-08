import { getAccountProducts } from '@/lib/accountProducts';

// No-Debit: after an account is opened it can be flagged in FlexCube so nothing can be debited
// until the branch activates it (AC_STAT_NO_DR = 'Y', set by the Fayda backend's Oracle
// connection: POST /api/flexcube/set-no-debit). Whether a new account gets it is a KYC setting
// of each account product (Products & Services → Account Products): one switch for accounts
// opened by individuals (default on) and one for accounts opened by organizations (default off).

export type NoDebitStatus = 'set' | 'not_required' | 'failed';

export interface NoDebitResult {
  status: NoDebitStatus;
  at: Date;
  error?: string;
}

const FAYDA_BACKEND_URL = () => process.env.FAYDA_BACKEND_URL || 'http://localhost:5000';

/** The product's No-Debit setting for this kind of account holder */
export async function noDebitRequired(productId: string, holder: 'individual' | 'organization'): Promise<boolean> {
  const product = (await getAccountProducts()).find(p => p.id === productId);
  if (holder === 'organization') return product?.noDebitOrganizations === true;
  // individuals: on unless KYC switched it off (also for older applications whose product is gone)
  return product ? product.noDebit !== false : true;
}

/**
 * After an account was opened in FlexCube: flag it No-Debit if its product says so. Never throws —
 * the account is open either way; the result is kept on the application for the branch.
 */
export async function applyNoDebit(
  accountNumber: string, productId: string, holder: 'individual' | 'organization'
): Promise<NoDebitResult> {
  let required: boolean;
  try {
    required = await noDebitRequired(productId, holder);
  } catch (e: any) {
    console.error('[NoDebit] Could not read the product setting:', e?.message || e);
    return { status: 'failed', at: new Date(), error: 'Could not read the account product setting' };
  }
  if (!required) {
    console.log(`[NoDebit] Account ${accountNumber}: not set (product ${productId}, ${holder} — No-Debit off)`);
    return { status: 'not_required', at: new Date() };
  }
  try {
    const res = await fetch(`${FAYDA_BACKEND_URL()}/api/flexcube/set-no-debit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountNumber }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      console.log(`[NoDebit] Account ${accountNumber} flagged as No-Debit`);
      return { status: 'set', at: new Date() };
    }
    console.error(`[NoDebit] Failed to set No-Debit on ${accountNumber}: ${data.error || `HTTP ${res.status}`}`);
    return { status: 'failed', at: new Date(), error: String(data.error || `HTTP ${res.status}`).slice(0, 300) };
  } catch (e: any) {
    console.error('[NoDebit] Error calling the Fayda backend:', e?.message || e);
    return { status: 'failed', at: new Date(), error: String(e?.message || e).slice(0, 300) };
  }
}

/** For audit / history lines */
export const noDebitNote = (r?: NoDebitResult | null) =>
  !r ? '' : r.status === 'set' ? 'No-Debit set' : r.status === 'not_required' ? 'No-Debit not needed (product setting)'
    : `No-Debit FAILED${r.error ? ` (${r.error})` : ''} — set it in FlexCube`;
