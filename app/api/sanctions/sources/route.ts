import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import SanctionSource, { defaultSources } from '@/lib/models/SanctionSource';
import SanctionEntry from '@/lib/models/SanctionEntry';

// Initialize default sources if they don't exist
async function initializeSources() {
  for (const source of defaultSources) {
    await SanctionSource.findOneAndUpdate(
      { sourceId: source.sourceId },
      { $setOnInsert: { ...source, isActive: true } },
      { upsert: true }
    );
  }
}

// GET - Get all sources
export async function GET() {
  try {
    await connectToDatabase();
    await initializeSources();

    const sources = await SanctionSource.find().sort({ priority: -1 }).lean();

    // Update counts for each source
    for (const source of sources) {
      const totalEntries = await SanctionEntry.countDocuments({ sourceId: source.sourceId, isDeleted: false });
      const activeEntries = await SanctionEntry.countDocuments({ sourceId: source.sourceId, isDeleted: false, status: 'ACTIVE' });

      // Update in memory
      source.totalEntries = totalEntries;
      source.activeEntries = activeEntries;
    }

    return NextResponse.json({
      success: true,
      data: sources,
    });

  } catch (error) {
    console.error('Get sources error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch sources',
    }, { status: 500 });
  }
}

// POST - Create new source
export async function POST(request: Request) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const {
      name,
      shortName,
      type,
      description,
      country,
      website,
      priority = 50,
      matchingThreshold = 80,
      createdBy = 'SYSTEM',
    } = body;

    if (!name || !shortName || !type) {
      return NextResponse.json({
        success: false,
        error: 'Name, short name, and type are required',
      }, { status: 400 });
    }

    // Generate source ID
    const sourceId = shortName.toUpperCase().replace(/\s+/g, '_');

    // Check for existing
    const existing = await SanctionSource.findOne({ sourceId });
    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'Source with this short name already exists',
      }, { status: 400 });
    }

    const source = await SanctionSource.create({
      sourceId,
      name,
      shortName,
      type,
      description,
      country,
      website,
      priority,
      matchingThreshold,
      isActive: true,
      createdBy,
    });

    return NextResponse.json({
      success: true,
      data: source,
      message: 'Source created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Create source error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create source',
    }, { status: 500 });
  }
}
