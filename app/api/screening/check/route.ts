import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import SanctionEntry from '@/lib/models/SanctionEntry';
import SanctionSource from '@/lib/models/SanctionSource';
import ScreeningResult from '@/lib/models/ScreeningResult';
import AuditLog from '@/lib/models/AuditLog';

// Generate unique screening ID
function generateScreeningId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SCR-${dateStr}-${random}`;
}

// Generate unique audit ID
function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `AUD-${timestamp}-${random}`.toUpperCase();
}

// Name similarity using Levenshtein distance
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

// Calculate similarity score (0-100)
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(s1, s2);
  return Math.round((1 - distance / maxLen) * 100);
}

// Get match strength from score
function getMatchStrength(score: number): 'EXACT' | 'STRONG' | 'MEDIUM' | 'WEAK' {
  if (score === 100) return 'EXACT';
  if (score >= 90) return 'STRONG';
  if (score >= 75) return 'MEDIUM';
  return 'WEAK';
}

// Get risk level from matches.
// Incorporates the configurable per-list risk score (UAT): a match on a list
// configured with a high risk score (sanctions / NBE-banned / terminated) raises the level.
function getRiskLevel(matches: any[]): 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAR' {
  if (matches.length === 0) return 'CLEAR';

  const hasExact = matches.some(m => m.matchStrength === 'EXACT');
  const hasStrong = matches.some(m => m.matchStrength === 'STRONG');
  const hasSanction = matches.some(m => m.sanctionType === 'SANCTIONS');
  const maxRiskScore = matches.reduce((mx, m) => Math.max(mx, m.riskScore || 0), 0);

  if (hasExact || (hasStrong && hasSanction) || maxRiskScore >= 90) return 'HIGH';
  if (hasStrong || matches.length > 2 || maxRiskScore >= 60) return 'MEDIUM';
  return 'LOW';
}

// POST - Check a person against sanctions list
export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const {
      firstName,
      middleName,
      lastName,
      fullName,
      dateOfBirth,
      uin,
      screeningType = 'ONBOARDING',
      triggeredBy = 'SYSTEM',
      customerId,
    } = body;

    // Validate required fields
    if (!firstName || !lastName) {
      return NextResponse.json({
        success: false,
        error: 'First name and last name are required',
      }, { status: 400 });
    }

    const customerFullName = fullName || `${firstName} ${middleName || ''} ${lastName}`.replace(/\s+/g, ' ').trim();

    console.log('=== SANCTIONS SCREENING ===');
    console.log('Screening:', customerFullName);
    console.log('First:', firstName, 'Middle:', middleName, 'Last:', lastName);

    // Get all active sanction entries
    const sanctions = await SanctionEntry.find({
      status: 'ACTIVE',
      isDeleted: false,
    }).lean();

    console.log('Total active sanctions entries:', sanctions.length);

    // Per-list (source) risk scores — configurable on each SanctionSource (UAT)
    const sources = await SanctionSource.find({}).lean();
    const sourceRiskMap: Record<string, number> = {};
    for (const s of sources as any[]) {
      sourceRiskMap[s.sourceId] = typeof s.riskScore === 'number' ? s.riskScore : 50;
    }

    const matches: any[] = [];
    const FULL_NAME_THRESHOLD = 80; // Minimum full-name score to be considered a match

    for (const entry of sanctions) {
      const matchedFields: string[] = [];

      // ── PRIMARY CHECK: Compare FULL NAMES as a whole ──
      // This avoids false positives from individual field matching
      // (e.g., "Solomon" customer vs "Solomon" in sanctions who are different people)
      const fullNameScore = calculateSimilarity(customerFullName, entry.fullName);

      // Also compute individual scores for logging/detail purposes only
      const firstNameScore = calculateSimilarity(firstName, entry.firstName);
      const lastNameScore = calculateSimilarity(lastName, entry.lastName);
      let middleNameScore = 0;
      if (middleName && entry.middleName) {
        middleNameScore = calculateSimilarity(middleName, entry.middleName);
      }

      // ── CHECK ALIASES against full name ──
      let bestAliasScore = 0;
      if (entry.aliases && entry.aliases.length > 0) {
        for (const alias of entry.aliases) {
          if (alias.fullName) {
            const aliasScore = calculateSimilarity(customerFullName, alias.fullName);
            if (aliasScore > bestAliasScore) {
              bestAliasScore = aliasScore;
            }
          }
        }
      }

      // The effective score is the best of fullName vs entry.fullName or any alias
      const effectiveScore = Math.max(fullNameScore, bestAliasScore);

      // Track which fields contributed
      if (fullNameScore >= FULL_NAME_THRESHOLD) matchedFields.push('fullName');
      if (bestAliasScore >= FULL_NAME_THRESHOLD) matchedFields.push('alias');
      if (firstNameScore >= 80) matchedFields.push('firstName');
      if (lastNameScore >= 80) matchedFields.push('lastName');
      if (middleNameScore >= 80) matchedFields.push('middleName');

      // Check date of birth if provided (bonus signal, not primary)
      let dobMatch = false;
      if (dateOfBirth && entry.dateOfBirth) {
        try {
          const customerDob = new Date(dateOfBirth).toISOString().split('T')[0];
          const entryDob = new Date(entry.dateOfBirth).toISOString().split('T')[0];
          if (customerDob === entryDob) {
            matchedFields.push('dateOfBirth');
            dobMatch = true;
          }
        } catch {}
      }

      console.log(`Checking "${entry.fullName}": fullName=${fullNameScore}%, alias=${bestAliasScore}%, effective=${effectiveScore}%, first=${firstNameScore}%, middle=${middleNameScore}%, last=${lastNameScore}%`);

      // ── MATCH DECISION: Based on full-name similarity only ──
      // Score >= 80% on the WHOLE name (customer vs sanction entry) = flagged
      // DOB match with score >= 70% also flags (strong corroboration)
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

        console.log(`MATCH FOUND: ${entry.fullName} - Score: ${effectiveScore}%, Type: ${entry.sanctionType}`);
      }
    }

    // Sort matches by score (highest first)
    matches.sort((a, b) => b.matchScore - a.matchScore);

    const riskLevel = getRiskLevel(matches);
    const status = matches.length > 0 ? 'MATCHED' : 'CLEAR';

    // PEP-aware blocking (UAT): a real sanctions / NBE-banned / terminated hit blocks
    // onboarding, but a PEP-only match must NOT block — PEP cases are escalated to a
    // second-level (senior) approver instead of being auto-rejected.
    const nonPepMatches = matches.filter(m => m.sanctionType !== 'PEP');
    const hasPEP = matches.some(m => m.sanctionType === 'PEP');
    const blocked = getRiskLevel(nonPepMatches) === 'HIGH';

    // Generate screening ID
    const screeningId = generateScreeningId();

    // Create screening result record
    const screeningResult = await ScreeningResult.create({
      screeningId,
      customerId,
      customerName: customerFullName,
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      uin,
      screeningType,
      triggeredBy,
      status,
      riskLevel,
      totalMatches: matches.length,
      matches,
      screenedAt: new Date(),
      completedAt: new Date(),
    });

    // Create audit log
    await AuditLog.create({
      auditId: generateAuditId(),
      module: 'SCREENING',
      action: matches.length > 0 ? 'SCREENING_MATCH' : 'SCREENING_CLEAR',
      entityType: 'ScreeningResult',
      entityId: screeningId,
      entityName: customerFullName,
      performedBy: triggeredBy,
      description: matches.length > 0
        ? `Screening found ${matches.length} potential match(es) for ${customerFullName}`
        : `Screening cleared for ${customerFullName}`,
      screeningResult: {
        customerId,
        customerName: customerFullName,
        matchCount: matches.length,
        matchedEntries: matches.map(m => m.entryId),
        riskLevel,
      },
      timestamp: new Date(),
    });

    console.log('Screening result:', status, 'Matches:', matches.length, 'Risk:', riskLevel);
    console.log('=== END SCREENING ===');

    // Return result
    return NextResponse.json({
      success: true,
      data: {
        screeningId,
        status,
        riskLevel,
        totalMatches: matches.length,
        matches: matches.slice(0, 10), // Return top 10 matches
        message: matches.length > 0
          ? `Found ${matches.length} potential match(es) in sanctions/PEP list`
          : 'No matches found - cleared',
        blocked, // Block only on real sanctions/high-risk hits (PEP does not block)
        hasPEP,
        requiresSecondLevelApproval: hasPEP, // PEP cases escalate to a senior approver
      },
    });

  } catch (error) {
    console.error('Screening error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to perform screening check',
    }, { status: 500 });
  }
}
