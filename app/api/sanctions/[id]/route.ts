import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import SanctionEntry from '@/lib/models/SanctionEntry';
import SanctionSource from '@/lib/models/SanctionSource';
import AuditLog, { calculateChanges } from '@/lib/models/AuditLog';

// Generate unique audit ID
function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `AUD-${timestamp}-${random}`.toUpperCase();
}

// GET - Get single sanction entry
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    const entry = await SanctionEntry.findOne({
      entryId: params.id,
      isDeleted: false,
    });

    if (!entry) {
      return NextResponse.json({
        success: false,
        error: 'Sanction entry not found',
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: entry,
    });

  } catch (error) {
    console.error('Get sanction error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch sanction entry',
    }, { status: 500 });
  }
}

// PUT - Update sanction entry
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Only the PEP & Sanctions Uploader (and admin) may edit sanctions entries.
    const role = request.headers.get('x-user-role') || '';
    if (role !== 'admin' && role !== 'sanction_uploader') {
      return NextResponse.json({ success: false, error: 'Only the PEP & Sanctions Uploader can manage the sanctions list.' }, { status: 403 });
    }

    await connectToDatabase();

    const body = await request.json();
    const { updatedBy: _ignoreUpdatedBy, ...updateData } = body;
    // F9: actor from the authenticated session, not the client payload
    const actor = request.headers.get('x-user-name') || request.headers.get('x-user-email') || 'system';

    // Find existing entry
    const existingEntry = await SanctionEntry.findOne({
      entryId: params.id,
      isDeleted: false,
    });

    if (!existingEntry) {
      return NextResponse.json({
        success: false,
        error: 'Sanction entry not found',
      }, { status: 404 });
    }

    const previousData = existingEntry.toObject();

    // Update the entry
    const fieldsToUpdate = [
      'firstName', 'middleName', 'lastName', 'fullName', 'fullNameAmharic',
      'dateOfBirth', 'nationality', 'gender', 'sanctionType', 'sourceId',
      'status', 'reason', 'programs', 'remarks', 'pepPosition', 'pepCountry',
      'aliases', 'identifiers', 'addresses', 'riskScore', 'listedDate', 'expiryDate'
    ];

    for (const field of fieldsToUpdate) {
      if (updateData[field] !== undefined) {
        (existingEntry as any)[field] = updateData[field];
      }
    }

    // Recalculate full name if name parts changed
    if (updateData.firstName || updateData.middleName || updateData.lastName) {
      existingEntry.fullName = `${existingEntry.firstName} ${existingEntry.middleName || ''} ${existingEntry.lastName}`.replace(/\s+/g, ' ').trim();
    }

    existingEntry.updatedBy = actor;
    existingEntry.lastUpdated = new Date();

    await existingEntry.save();

    // Calculate changes for audit log
    const changes = calculateChanges(previousData, existingEntry.toObject(), fieldsToUpdate);

    // Create audit log
    await AuditLog.create({
      auditId: generateAuditId(),
      module: 'SANCTIONS',
      action: 'UPDATE',
      entityType: 'SanctionEntry',
      entityId: existingEntry.entryId,
      entityName: existingEntry.fullName,
      performedBy: actor,
      description: `Updated ${existingEntry.sanctionType} entry: ${existingEntry.fullName}`,
      changes,
      previousData,
      newData: existingEntry.toObject(),
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: existingEntry,
      message: 'Sanction entry updated successfully',
    });

  } catch (error) {
    console.error('Update sanction error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update sanction entry',
    }, { status: 500 });
  }
}

// DELETE - Soft delete sanction entry
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Only the PEP & Sanctions Uploader (and admin) may delete sanctions entries.
    const role = request.headers.get('x-user-role') || '';
    if (role !== 'admin' && role !== 'sanction_uploader') {
      return NextResponse.json({ success: false, error: 'Only the PEP & Sanctions Uploader can manage the sanctions list.' }, { status: 403 });
    }

    await connectToDatabase();

    // F9: actor from the authenticated session, not a client-supplied query param
    const deletedBy = request.headers.get('x-user-name') || request.headers.get('x-user-email') || 'system';

    // Find existing entry
    const entry = await SanctionEntry.findOne({
      entryId: params.id,
      isDeleted: false,
    });

    if (!entry) {
      return NextResponse.json({
        success: false,
        error: 'Sanction entry not found',
      }, { status: 404 });
    }

    const previousData = entry.toObject();

    // Soft delete
    entry.isDeleted = true;
    entry.deletedAt = new Date();
    entry.deletedBy = deletedBy;
    entry.status = 'INACTIVE';
    await entry.save();

    // Update source statistics
    await SanctionSource.findOneAndUpdate(
      { sourceId: entry.sourceId },
      { $inc: { activeEntries: -1 } }
    );

    // Create audit log
    await AuditLog.create({
      auditId: generateAuditId(),
      module: 'SANCTIONS',
      action: 'DELETE',
      entityType: 'SanctionEntry',
      entityId: entry.entryId,
      entityName: entry.fullName,
      performedBy: deletedBy,
      description: `Deleted ${entry.sanctionType} entry: ${entry.fullName}`,
      previousData,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Sanction entry deleted successfully',
    });

  } catch (error) {
    console.error('Delete sanction error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete sanction entry',
    }, { status: 500 });
  }
}
