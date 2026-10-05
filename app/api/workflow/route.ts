import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import WorkflowSettings, { defaultWorkflowSettings, IWorkflowSettings } from '@/lib/models/WorkflowSettings';
import { audit, fieldChanges } from '@/lib/audit';

// Always run on request: otherwise `next build` pre-renders this route, which freezes its data and makes saving (PUT) fail with 405
export const dynamic = 'force-dynamic';

// GET - Retrieve workflow settings
export async function GET() {
  try {
    await connectToDatabase();

    let settings = await WorkflowSettings.findById('default');

    // If no settings exist, create default settings
    if (!settings) {
      settings = await WorkflowSettings.create(defaultWorkflowSettings);
    }

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching workflow settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch workflow settings' },
      { status: 500 }
    );
  }
}

// PUT - Update workflow settings
export async function PUT(request: Request) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const {
      mode,
      autoApprovalEnabled,
      minFaceMatchScore,
      requireManualReviewAbove,
      notifyOnAutoApproval,
      notifyOnManualRequired,
      flexcubeEndpoint,
      flexcubeEnabled,
      useProductAccountClass,
      flexcubeIaServiceUrl,
      flexcubeIfbAccountClass,
      flexcubeIfbAccountCode,
      // FlexCube SOAP configuration
      flexcubeCustomerServiceUrl,
      flexcubeAccountServiceUrl,
      flexcubeUserId,
      flexcubeSource,
      flexcubeBranch,
      flexcubeTimeout,
      updatedBy,
    } = body;

    // Build update object with only provided fields
    const updateData: Partial<IWorkflowSettings> = {};

    if (mode !== undefined) {
      updateData.mode = mode;
      updateData.autoApprovalEnabled = mode === 'auto';
    }
    if (autoApprovalEnabled !== undefined) updateData.autoApprovalEnabled = autoApprovalEnabled;
    if (minFaceMatchScore !== undefined) updateData.minFaceMatchScore = minFaceMatchScore;
    if (requireManualReviewAbove !== undefined) updateData.requireManualReviewAbove = requireManualReviewAbove;
    if (notifyOnAutoApproval !== undefined) updateData.notifyOnAutoApproval = notifyOnAutoApproval;
    if (notifyOnManualRequired !== undefined) updateData.notifyOnManualRequired = notifyOnManualRequired;
    if (flexcubeEndpoint !== undefined) updateData.flexcubeEndpoint = flexcubeEndpoint;
    if (flexcubeEnabled !== undefined) updateData.flexcubeEnabled = flexcubeEnabled;
    if (useProductAccountClass !== undefined) updateData.useProductAccountClass = useProductAccountClass === true;
    // IFB accounts (FCUBSIAService); empty values fall back to the defaults
    if (flexcubeIaServiceUrl !== undefined) updateData.flexcubeIaServiceUrl = String(flexcubeIaServiceUrl).trim();
    if (flexcubeIfbAccountClass !== undefined) {
      const v = String(flexcubeIfbAccountClass).trim().toUpperCase();
      if (v && !/^[A-Z0-9]{1,10}$/.test(v)) {
        return NextResponse.json({ success: false, error: 'IFB account class must be letters or digits (e.g. WCSA)' }, { status: 400 });
      }
      updateData.flexcubeIfbAccountClass = v;
    }
    if (flexcubeIfbAccountCode !== undefined) {
      const v = String(flexcubeIfbAccountCode).trim();
      if (v && !/^\d{1,5}$/.test(v)) {
        return NextResponse.json({ success: false, error: 'IFB account number code must be digits (e.g. 126)' }, { status: 400 });
      }
      updateData.flexcubeIfbAccountCode = v;
    }
    // FlexCube SOAP configuration
    if (flexcubeCustomerServiceUrl !== undefined) updateData.flexcubeCustomerServiceUrl = flexcubeCustomerServiceUrl;
    if (flexcubeAccountServiceUrl !== undefined) updateData.flexcubeAccountServiceUrl = flexcubeAccountServiceUrl;
    if (flexcubeUserId !== undefined) updateData.flexcubeUserId = flexcubeUserId;
    if (flexcubeSource !== undefined) updateData.flexcubeSource = flexcubeSource;
    if (flexcubeBranch !== undefined) updateData.flexcubeBranch = flexcubeBranch;
    if (flexcubeTimeout !== undefined) updateData.flexcubeTimeout = flexcubeTimeout;
    if (updatedBy !== undefined) updateData.updatedBy = updatedBy;
    // The signed-in user, not the client payload, is recorded as the editor
    const sessionUser = request.headers.get('x-user-name') || request.headers.get('x-user-email');
    if (sessionUser) updateData.updatedBy = sessionUser;

    const before = (await WorkflowSettings.findById('default').lean()) || {};

    // Upsert - create if not exists, update if exists
    const settings = await WorkflowSettings.findByIdAndUpdate(
      'default',
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );

    const changes = fieldChanges(before, settings?.toObject() || {}, Object.keys(updateData).filter(k => k !== 'updatedBy'));
    if (changes.length) {
      await audit(request, {
        module: 'SETTINGS', action: 'UPDATE', entityType: 'WorkflowSettings', entityId: 'default',
        entityName: 'Workflow & FlexCube settings', changes,
        description: `Changed ${changes.map(c => c.field).join(', ')}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: settings,
      message: 'Workflow settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating workflow settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update workflow settings' },
      { status: 500 }
    );
  }
}
