import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import ScreeningResult from '@/lib/models/ScreeningResult';
import { loadScreeningLists, screenAgainst } from '@/lib/sanctionsScreening';
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

    // The same matching as at submission (lib/sanctionsScreening), on the lists kept in memory
    const { matches, riskLevel, status, blocked, hasPEP } = screenAgainst(await loadScreeningLists(), {
      firstName, middleName, lastName, fullName: customerFullName, dateOfBirth,
    });

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

    console.log(`[Screening] ${status} — ${matches.length} match(es), risk ${riskLevel}`);

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
