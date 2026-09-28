import SanctionEntry from '@/lib/models/SanctionEntry';
import SanctionSource from '@/lib/models/SanctionSource';

// NOTE: This mirrors the matching logic used by /api/screening/check so that onboarding
// can run an authoritative server-side PEP/sanctions check at submission time. It is kept
// self-contained to avoid altering the verified screening route. Keep the two in sync if
// the scoring rules change.

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 100;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;
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

export async function screenCustomer(input: ScreenInput): Promise<ScreenResult> {
  const firstName = input.firstName || '';
  const middleName = input.middleName || '';
  const lastName = input.lastName || '';
  const dateOfBirth = input.dateOfBirth;
  const customerFullName = (input.fullName || `${firstName} ${middleName} ${lastName}`).replace(/\s+/g, ' ').trim();

  const sanctions = await SanctionEntry.find({ status: 'ACTIVE', isDeleted: false }).lean();
  const sources = await SanctionSource.find({}).lean();
  const sourceRiskMap: Record<string, number> = {};
  for (const s of sources as any[]) {
    sourceRiskMap[s.sourceId] = typeof s.riskScore === 'number' ? s.riskScore : 50;
  }

  const matches: any[] = [];
  for (const entry of sanctions as any[]) {
    const matchedFields: string[] = [];
    const fullNameScore = calculateSimilarity(customerFullName, entry.fullName);
    const firstNameScore = calculateSimilarity(firstName, entry.firstName);
    const lastNameScore = calculateSimilarity(lastName, entry.lastName);
    let middleNameScore = 0;
    if (middleName && entry.middleName) middleNameScore = calculateSimilarity(middleName, entry.middleName);

    let bestAliasScore = 0;
    if (entry.aliases && entry.aliases.length > 0) {
      for (const alias of entry.aliases) {
        if (alias.fullName) {
          const aliasScore = calculateSimilarity(customerFullName, alias.fullName);
          if (aliasScore > bestAliasScore) bestAliasScore = aliasScore;
        }
      }
    }

    const effectiveScore = Math.max(fullNameScore, bestAliasScore);
    if (fullNameScore >= FULL_NAME_THRESHOLD) matchedFields.push('fullName');
    if (bestAliasScore >= FULL_NAME_THRESHOLD) matchedFields.push('alias');
    if (firstNameScore >= 80) matchedFields.push('firstName');
    if (lastNameScore >= 80) matchedFields.push('lastName');
    if (middleNameScore >= 80) matchedFields.push('middleName');

    let dobMatch = false;
    if (dateOfBirth && entry.dateOfBirth) {
      try {
        const customerDob = new Date(dateOfBirth).toISOString().split('T')[0];
        const entryDob = new Date(entry.dateOfBirth).toISOString().split('T')[0];
        if (customerDob === entryDob) { matchedFields.push('dateOfBirth'); dobMatch = true; }
      } catch {}
    }

    const isFullNameMatch = effectiveScore >= FULL_NAME_THRESHOLD;
    const isDobCorroborated = dobMatch && effectiveScore >= 70;

    if (isFullNameMatch || isDobCorroborated) {
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
