// Currency of the account FlexCube opens (CreateCustAcc / CreateIACustAcc CCY). Accounts are in birr
// unless their account class is a foreign currency (FCY) class: Account Products → Currency, where KYC
// chooses which of these currencies the class is offered in; the applicant picks one of them.

export const LOCAL_CURRENCY = 'ETB';

export const FCY_CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'EUR', name: 'Euro' },
] as const;

export const currencyName = (code: string) =>
  code === LOCAL_CURRENCY ? 'Ethiopian Birr' : FCY_CURRENCIES.find(c => c.code === code)?.name || code;

/** The FCY currencies of an account class as stored: known codes only, once each, in the list's order */
export function normalizeCurrencies(value: unknown): string[] {
  const asked = Array.isArray(value) ? value.map(v => String(v).trim().toUpperCase()) : [];
  return FCY_CURRENCIES.map(c => c.code).filter(code => asked.includes(code));
}

/**
 * The currency an application's account opens in. An FCY class needs one of its currencies
 * (`null` = missing or not offered: ask the applicant to choose); any other class opens in ETB.
 */
export function accountCurrency(requested: unknown, classCurrencies: string[] | undefined | null): string | null {
  const offered = classCurrencies || [];
  if (!offered.length) return LOCAL_CURRENCY;
  const code = String(requested || '').trim().toUpperCase();
  return offered.includes(code) ? code : null;
}
