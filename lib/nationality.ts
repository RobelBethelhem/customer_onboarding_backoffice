// Nationality from Fayda: Ethiopian or a foreign national (who must give a passport and a work
// permit or Origin ID), and the ISO country code FlexCube takes as the CIF's nationality (NLTY).
// Kept free of server-only imports so dashboard pages can use it too.

const ETHIOPIAN = new Set(['ethiopia', 'ethiopian', 'et', 'eth', 'ኢትዮጵያ', 'ኢትዮጵያዊ', 'ኢትዮጵያዊት']);

const clean = (nationality?: string) => String(nationality || '').trim().replace(/\s+/g, ' ').toLowerCase();

/** A nationality other than Ethiopia (any case); none given counts as Ethiopian */
export function isForeignNational(nationality?: string): boolean {
  const n = clean(nationality);
  return !!n && !ETHIOPIAN.has(n);
}

let countryCodes: Map<string, string> | null = null;

/** Country name (English, any case) → ISO 3166 alpha-2 code, from the runtime's own country names */
function codeOfCountry(name: string): string {
  if (!countryCodes) {
    countryCodes = new Map();
    try {
      const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
      for (let a = 65; a <= 90; a++) {
        for (let b = 65; b <= 90; b++) {
          const code = String.fromCharCode(a, b);
          const country = names.of(code);
          if (country && country !== code) countryCodes.set(country.toLowerCase(), code);
        }
      }
    } catch {
      // no country names in this runtime: only two-letter codes are understood
    }
  }
  return countryCodes.get(name) || '';
}

/**
 * FlexCube nationality code: 'ET' for Ethiopians, the ISO code of a foreign country when its name
 * (or code) is known, else '' (the caller keeps 'ET' and KYC corrects it).
 */
export function nationalityCode(nationality?: string): string {
  const n = clean(nationality);
  if (!n || ETHIOPIAN.has(n)) return 'ET';
  if (/^[a-z]{2}$/.test(n)) return n.toUpperCase();
  return codeOfCountry(n);
}
