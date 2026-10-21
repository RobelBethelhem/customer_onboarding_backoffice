import SanctionEntry from '@/lib/models/SanctionEntry';
import SanctionSource from '@/lib/models/SanctionSource';

// PEP/sanctions screening: the web app's check after the Fayda OTP (/api/screening/check) and the
// authoritative check when an application is submitted both use this.

// Edit distance with two rows (the same result as the full table, without allocating it per pair)
function levenshteinDistance(str1: string, str2: string): number {
  const n = str2.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= str1.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = str1[i - 1] === str2[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function calculateSimilarity(str1: string, str2: string): number {
  return similarityIfAtLeast(str1, str2, 0);
}

/**
 * calculateSimilarity, or 0 when the lengths alone show it is below `min` (the edit distance is at
 * least the difference in length) — screening only needs scores that can reach its thresholds.
 */
function similarityIfAtLeast(str1: string, str2: string, min: number): number {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 100;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;
  if (min > 0 && Math.round((1 - Math.abs(s1.length - s2.length) / maxLen) * 100) < min) return 0;
  const distance = levenshteinDistance(s1, s2);
  return Math.round((1 - distance / maxLen) * 100);
}

export function getMatchStrength(score: number): 'EXACT' | 'STRONG' | 'MEDIUM' | 'WEAK' {
  if (score === 100) return 'EXACT';
  if (score >= 90) return 'STRONG';
  if (score >= 75) return 'MEDIUM';
  return 'WEAK';
}

export function getRiskLevel(matches: any[]): 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAR' {
  if (matches.length === 0) return 'CLEAR';
  const hasExact = matches.some(m => m.matchStrength === 'EXACT');
  const hasStrong = matches.some(m => m.matchStrength === 'STRONG');
  const hasSanction = matches.some(m => m.sanctionType === 'SANCTIONS');
  const maxRiskScore = matches.reduce((mx, m) => Math.max(mx, m.riskScore || 0), 0);
  if (hasExact || (hasStrong && hasSanction) || maxRiskScore >= 90) return 'HIGH';
  if (hasStrong || matches.length > 2 || maxRiskScore >= 60) return 'MEDIUM';
  return 'LOW';
}

export interface ScreenInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fullName?: string;
  dateOfBirth?: string;
}

export interface ScreenResult {
  matches: any[];
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAR';
  status: 'MATCHED' | 'CLEAR';
  blocked: boolean;   // true only for a real (non-PEP) HIGH-risk sanctions/NBE/terminated hit
  hasPEP: boolean;    // true if any match is a PEP — escalate to second-level approval
  customerFullName: string;
}

const FULL_NAME_THRESHOLD = 80;
const DOB_NAME_THRESHOLD = 70; // with the same date of birth

/** The active screening lists (sanctions, PEP, NBE …) and each source's risk score */
export interface ScreeningLists {
  sanctions: any[];
  sourceRiskMap: Record<string, number>;
}

// The lists stay in memory between checks: reloaded after a change made here (invalidate…) and at
// least every minute (changes made by another server process)
const LISTS_MAX_AGE_MS = 60 * 1000;
let cachedLists: { lists: Promise<ScreeningLists>; loadedAt: number } | null = null;

/** The sanctions / PEP lists changed (entry added, edited, deleted, imported, list risk score) */
export function invalidateScreeningLists() {
  cachedLists = null;
}

export async function loadScreeningLists(): Promise<ScreeningLists> {
  if (!cachedLists || Date.now() - cachedLists.loadedAt > LISTS_MAX_AGE_MS) {
    const lists = readScreeningLists();
    cachedLists = { lists, loadedAt: Date.now() };
    lists.catch(() => { if (cachedLists?.lists === lists) cachedLists = null; }); // a failed load is not kept
  }
  return cachedLists.lists;
}

async function readScreeningLists(): Promise<ScreeningLists> {
  const [sanctions, sources] = await Promise.all([
    // only what the matching uses
    SanctionEntry.find({ status: 'ACTIVE', isDeleted: false })
      .select('entryId fullName firstName middleName lastName aliases.fullName dateOfBirth sanctionType sourceId riskScore reason')
      .lean(),
    SanctionSource.find({}).select('sourceId riskScore').lean(),
  ]);
  const sourceRiskMap: Record<string, number> = {};
  for (const s of sources as any[]) {
    sourceRiskMap[s.sourceId] = typeof s.riskScore === 'number' ? s.riskScore : 50;
  }
  return { sanctions: sanctions as any[], sourceRiskMap };
}

export async function screenCustomer(input: ScreenInput): Promise<ScreenResult> {
  return screenAgainst(await loadScreeningLists(), input);
}

/** Screen one person against lists loaded once (several people of one application) */
export function screenAgainst(lists: ScreeningLists, input: ScreenInput): ScreenResult {
  const firstName = input.firstName || '';
  const middleName = input.middleName || '';
  const lastName = input.lastName || '';
  const dateOfBirth = input.dateOfBirth;
  const customerFullName = (input.fullName || `${firstName} ${middleName} ${lastName}`).replace(/\s+/g, ' ').trim();
  const { sanctions, sourceRiskMap } = lists;

  // The customer's date of birth, once
  let customerDob = '';
  if (dateOfBirth) {
    try { customerDob = new Date(dateOfBirth).toISOString().split('T')[0]; } catch {}
  }

  const matches: any[] = [];
  for (const entry of sanctions) {
    // A match needs the whole name (or an alias) to score at least 70 (80 without a date of
    // birth match): lower scores are never computed in full
    const fullNameScore = similarityIfAtLeast(customerFullName, entry.fullName, DOB_NAME_THRESHOLD);
    let bestAliasScore = 0;
    if (entry.aliases && entry.aliases.length > 0) {
      for (const alias of entry.aliases) {
        if (alias.fullName) {
          const aliasScore = similarityIfAtLeast(customerFullName, alias.fullName, DOB_NAME_THRESHOLD);
          if (aliasScore > bestAliasScore) bestAliasScore = aliasScore;
        }
      }
    }
    const effectiveScore = Math.max(fullNameScore, bestAliasScore);
    if (effectiveScore < DOB_NAME_THRESHOLD) continue;

    let dobMatch = false;
    if (customerDob && entry.dateOfBirth) {
      try {
        dobMatch = new Date(entry.dateOfBirth).toISOString().split('T')[0] === customerDob;
      } catch {}
    }

    const isFullNameMatch = effectiveScore >= FULL_NAME_THRESHOLD;
    const isDobCorroborated = dobMatch && effectiveScore >= DOB_NAME_THRESHOLD;

    if (isFullNameMatch || isDobCorroborated) {
      // Which parts of the name matched — for the reviewer
      const matchedFields: string[] = [];
      if (fullNameScore >= FULL_NAME_THRESHOLD) matchedFields.push('fullName');
      if (bestAliasScore >= FULL_NAME_THRESHOLD) matchedFields.push('alias');
      if (similarityIfAtLeast(firstName, entry.firstName, 80) >= 80) matchedFields.push('firstName');
      if (similarityIfAtLeast(lastName, entry.lastName, 80) >= 80) matchedFields.push('lastName');
      if (middleName && entry.middleName && similarityIfAtLeast(middleName, entry.middleName, 80) >= 80) matchedFields.push('middleName');
      if (dobMatch) matchedFields.push('dateOfBirth');

      matches.push({
        sanctionEntryId: entry._id.toString(),
        entryId: entry.entryId,
        fullName: entry.fullName,
        sanctionType: entry.sanctionType,
        sourceId: entry.sourceId,
        riskScore: sourceRiskMap[entry.sourceId] ?? (entry.riskScore ?? 50),
        matchScore: effectiveScore,
        overallScore: effectiveScore,
        matchStrength: getMatchStrength(effectiveScore),
        matchedFields,
        reason: entry.reason,
      });
    }
  }

  matches.sort((a, b) => b.matchScore - a.matchScore);
  const riskLevel = getRiskLevel(matches);
  const status: 'MATCHED' | 'CLEAR' = matches.length > 0 ? 'MATCHED' : 'CLEAR';
  const nonPepMatches = matches.filter(m => m.sanctionType !== 'PEP');
  const hasPEP = matches.some(m => m.sanctionType === 'PEP');
  const blocked = getRiskLevel(nonPepMatches) === 'HIGH';

  return { matches, riskLevel, status, blocked, hasPEP, customerFullName };
}
