// IFB (interest-free) branch-code rules — no database access, so pages can import it too.

// Bank convention: an IFB branch code is the conventional code with its first digit swapped
// (1xx → 6xx, 3xx → 8xx). Used to suggest codes; the stored mapping is what counts.
const IFB_FIRST_DIGIT: Record<string, string> = { '1': '6', '3': '8' };

export function suggestIfbCode(conventionalCode: string): string {
  const swap = IFB_FIRST_DIGIT[conventionalCode.charAt(0)];
  return swap ? swap + conventionalCode.slice(1) : '';
}

/** Interest-free product, from the account type the web app sent (e.g. "Z-Digital IFB", "IFB Saving") */
export function isIfbProduct(c: { accountTypeId?: string; accountTypeName?: string; accountType?: string }): boolean {
  return /\bIFB\b/i.test(`${c.accountTypeId || ''} ${c.accountTypeName || ''} ${c.accountType || ''}`);
}
