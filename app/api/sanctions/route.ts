import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import SanctionEntry from '@/lib/models/SanctionEntry';
import SanctionSource, { defaultSources } from '@/lib/models/SanctionSource';
import AuditLog, { calculateChanges } from '@/lib/models/AuditLog';
import { auditContext } from '@/lib/audit';

// Generate unique audit ID
function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `AUD-${timestamp}-${random}`.toUpperCase();
}

// Initialize default sources if they don't exist
async function initializeSources() {
  for (const source of defaultSources) {
    await SanctionSource.findOneAndUpdate(
      { sourceId: source.sourceId },
      { $setOnInsert: source },
      { upsert: true }
    );
  }
}

// GET - List all sanctions entries with filters
export async function GET(request: Request) {
  try {
    await connectToDatabase();
    await initializeSources();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const sanctionType = searchParams.get('type') || '';
    const status = searchParams.get('status') || '';
    const sourceId = searchParams.get('source') || '';

    // Build query
    const query: any = { isDeleted: false };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { middleName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { entryId: { $regex: search, $options: 'i' } },
      ];
    }

    if (sanctionType) query.sanctionType = sanctionType;
    if (status) query.status = status;
    if (sourceId) query.sourceId = sourceId;

    // Get total count
    const total = await SanctionEntry.countDocuments(query);

    // Get entries
    const entries = await SanctionEntry.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Get sources for reference
    const sources = await SanctionSource.find({ isActive: true }).lean();

    // Get counts by type
    const counts = {
      total: await SanctionEntry.countDocuments({ isDeleted: false }),
      sanctions: await SanctionEntry.countDocuments({ isDeleted: false, sanctionType: 'SANCTIONS' }),
      pep: await SanctionEntry.countDocuments({ isDeleted: false, sanctionType: 'PEP' }),
      watchlist: await SanctionEntry.countDocuments({ isDeleted: false, sanctionType: 'WATCHLIST' }),
      active: await SanctionEntry.countDocuments({ isDeleted: false, status: 'ACTIVE' }),
    };

    return NextResponse.json({
      success: true,
      data: entries,
      sources,
      counts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Get sanctions error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch sanctions entries',
    }, { status: 500 });
  }
}

// POST - Create new sanction entry
export async function POST(request: Request) {
  try {
    // Only the PEP & Sanctions Uploader (and admin) may create sanctions entries.
    const role = request.headers.get('x-user-role') || '';
    if (role !== 'admin' && role !== 'sanction_uploader') {
      return NextResponse.json({ success: false, error: 'Only the PEP & Sanctions Uploader can manage the sanctions list.' }, { status: 403 });
    }

    await connectToDatabase();

    const body = await request.json();
    const {
      firstName,
      middleName,
      lastName,
      fullName,
      fullNameAmharic,
      dateOfBirth,
      nationality,
      gender,
      sanctionType,
      sourceId,
      reason,
      programs,
      remarks,
      pepPosition,
      pepCountry,
      aliases,
      identifiers,
      addresses,
      riskScore,
    } = body;

    // F9: audit actor derived from the authenticated session, not the client payload
    const actor = request.headers.get('x-user-name') || request.headers.get('x-user-email') || 'system';

    // Validate required fields
    if (!firstName || !lastName || !sanctionType || !sourceId) {
      return NextResponse.json({
        success: false,
        error: 'First name, last name, sanction type, and source are required',
      }, { status: 400 });
    }

    // Generate unique entryId
    const count = await SanctionEntry.countDocuments() || 0;
    const entryId = `SAN-${String(count + 1).padStart(6, '0')}`;

    // Create the entry
    const entry = await SanctionEntry.create({
      entryId,
      firstName,
      middleName,
      lastName,
      fullName: fullName || `${firstName} ${middleName || ''} ${lastName}`.replace(/\s+/g, ' ').trim(),
      fullNameAmharic,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      nationality,
      gender,
      sanctionType,
      sourceId,
      status: 'ACTIVE',
      reason,
      programs: programs || [],
      remarks,
      pepPosition,
      pepCountry,
      aliases: aliases || [],
      identifiers: identifiers || [],
      addresses: addresses || [],
      riskScore: riskScore || 50,
      createdBy: actor,
      lastUpdated: new Date(),
    });

    // Update source statistics
    await SanctionSource.findOneAndUpdate(
      { sourceId },
      {
        $inc: { totalEntries: 1, activeEntries: 1 },
        lastImportDate: new Date(),
      }
    );

    // Create audit log
    await AuditLog.create({
      ...auditContext(request), // who (id, name, email, role), IP and browser
      auditId: generateAuditId(),
      module: 'SANCTIONS',
      action: 'CREATE',
      entityType: 'SanctionEntry',
      entityId: entry.entryId,
      entityName: entry.fullName,
      performedBy: actor,
      description: `Created new ${sanctionType} entry: ${entry.fullName}`,
      newData: entry.toObject(),
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: entry,
      message: 'Sanction entry created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Create sanction error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create sanction entry',
    }, { status: 500 });
  }
}
