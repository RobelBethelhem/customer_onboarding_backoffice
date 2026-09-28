import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import SanctionEntry from '@/lib/models/SanctionEntry';
import AuditLog from '@/lib/models/AuditLog';

// Generate unique audit ID
function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `AUD-${timestamp}-${random}`.toUpperCase();
}

// GET - Export sanctions to JSON (will be converted to Excel on client side)
export async function GET(request: Request) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const sanctionType = searchParams.get('type') || '';
    const sourceId = searchParams.get('source') || '';
    const status = searchParams.get('status') || 'ACTIVE';
    const exportedBy = searchParams.get('exportedBy') || 'SYSTEM';

    // Build query
    const query: any = { isDeleted: false };
    if (sanctionType) query.sanctionType = sanctionType;
    if (sourceId) query.sourceId = sourceId;
    if (status) query.status = status;

    // Get all matching entries
    const entries = await SanctionEntry.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Transform for export
    const exportData = entries.map(entry => ({
      entryId: entry.entryId,
      firstName: entry.firstName,
      middleName: entry.middleName || '',
      lastName: entry.lastName,
      fullName: entry.fullName,
      fullNameAmharic: entry.fullNameAmharic || '',
      dateOfBirth: entry.dateOfBirth ? new Date(entry.dateOfBirth).toISOString().split('T')[0] : '',
      placeOfBirth: entry.placeOfBirth || '',
      nationality: entry.nationality || '',
      gender: entry.gender || '',
      sanctionType: entry.sanctionType,
      sourceId: entry.sourceId,
      status: entry.status,
      reason: entry.reason || '',
      programs: entry.programs?.join(', ') || '',
      remarks: entry.remarks || '',
      pepPosition: entry.pepPosition || '',
      pepCountry: entry.pepCountry || '',
      riskScore: entry.riskScore || 0,
      listedDate: entry.listedDate ? new Date(entry.listedDate).toISOString().split('T')[0] : '',
      createdAt: new Date(entry.createdAt).toISOString(),
    }));

    // Create audit log
    await AuditLog.create({
      auditId: generateAuditId(),
      module: 'SANCTIONS',
      action: 'EXPORT',
      entityType: 'SanctionEntry',
      entityId: `EXP-${Date.now().toString(36)}`,
      entityName: `Export ${entries.length} entries`,
      performedBy: exportedBy,
      description: `Exported ${entries.length} sanctions entries`,
      importExportDetails: {
        fileName: `sanctions_export_${new Date().toISOString().split('T')[0]}.xlsx`,
        recordCount: entries.length,
        successCount: entries.length,
        errorCount: 0,
      },
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: exportData,
      total: exportData.length,
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to export sanctions entries',
    }, { status: 500 });
  }
}
