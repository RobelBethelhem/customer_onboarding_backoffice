import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import WorkflowSettings, { defaultWorkflowSettings, IWorkflowSettings } from '@/lib/models/WorkflowSettings';

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
    // FlexCube SOAP configuration
    if (flexcubeCustomerServiceUrl !== undefined) updateData.flexcubeCustomerServiceUrl = flexcubeCustomerServiceUrl;
    if (flexcubeAccountServiceUrl !== undefined) updateData.flexcubeAccountServiceUrl = flexcubeAccountServiceUrl;
    if (flexcubeUserId !== undefined) updateData.flexcubeUserId = flexcubeUserId;
    if (flexcubeSource !== undefined) updateData.flexcubeSource = flexcubeSource;
    if (flexcubeBranch !== undefined) updateData.flexcubeBranch = flexcubeBranch;
    if (flexcubeTimeout !== undefined) updateData.flexcubeTimeout = flexcubeTimeout;
    if (updatedBy !== undefined) updateData.updatedBy = updatedBy;

    // Upsert - create if not exists, update if exists
    const settings = await WorkflowSettings.findByIdAndUpdate(
      'default',
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );

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
