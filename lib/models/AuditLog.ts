import mongoose, { Schema, Document } from 'mongoose';
import {
  AUDIT_ACTIONS, AUDIT_MODULES, AUDIT_STATUSES, AuditAction, AuditModule, AuditStatus,
} from '@/lib/auditTypes';

export type { AuditAction, AuditModule, AuditStatus };

export interface IFieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface IAuditLog extends Document {
  // Reference
  auditId: string;
  module: AuditModule;
  action: AuditAction;

  // Target entity
  entityType: string; // 'SanctionEntry', 'Customer', etc.
  entityId: string;
  entityName?: string; // Human-readable name for display

  // Actor
  performedBy: string; // Display name (or email / 'SYSTEM' / 'Applicant')
  performedById?: string; // Dashboard user id
  performedByName?: string;
  performedByEmail?: string;
  performedByRole?: string;
  ipAddress?: string;
  userAgent?: string;
  status?: AuditStatus; // SUCCESS (default), FAILURE (e.g. wrong password) or DENIED (not allowed)

  // Change details
  description: string;
  changes?: IFieldChange[];
  previousData?: any; // Snapshot before change
  newData?: any; // Snapshot after change

  // Screening specific
  screeningResult?: {
    customerId?: string;
    customerName?: string;
    matchCount: number;
    matchedEntries?: string[];
    riskLevel?: 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAR';
  };

  // Import/Export specific
  importExportDetails?: {
    fileName?: string;
    recordCount?: number;
    successCount?: number;
    errorCount?: number;
    errors?: string[];
  };

  // Metadata
  timestamp: Date;
  sessionId?: string;

  // For grouping related actions
  batchId?: string;
}

const FieldChangeSchema = new Schema<IFieldChange>({
  field: { type: String, required: true },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
}, { _id: false });

const AuditLogSchema = new Schema<IAuditLog>({
  auditId: { type: String, required: true, unique: true },
  module: {
    type: String,
    enum: [...AUDIT_MODULES],
    required: true,
    index: true,
  },
  action: {
    type: String,
    enum: [...AUDIT_ACTIONS],
    required: true,
    index: true,
  },

  entityType: { type: String, required: true },
  entityId: { type: String, required: true, index: true },
  entityName: { type: String },

  performedBy: { type: String, required: true, index: true },
  performedById: { type: String, index: true },
  performedByName: { type: String },
  performedByEmail: { type: String },
  performedByRole: { type: String, index: true },
  ipAddress: { type: String },
  userAgent: { type: String },
  status: { type: String, enum: [...AUDIT_STATUSES], default: 'SUCCESS' },

  description: { type: String, required: true },
  changes: [FieldChangeSchema],
  previousData: { type: Schema.Types.Mixed },
  newData: { type: Schema.Types.Mixed },

  screeningResult: {
    customerId: { type: String },
    customerName: { type: String },
    matchCount: { type: Number },
    matchedEntries: [{ type: String }],
    riskLevel: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW', 'CLEAR'] },
  },

  importExportDetails: {
    fileName: { type: String },
    recordCount: { type: Number },
    successCount: { type: Number },
    errorCount: { type: Number },
    errors: [{ type: String }],
  },

  timestamp: { type: Date, default: Date.now, index: true },
  sessionId: { type: String },
  batchId: { type: String, index: true },
}, {
  timestamps: false, // We use our own timestamp field
});

// Indexes for efficient querying
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ module: 1, timestamp: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
AuditLogSchema.index({ performedBy: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });

// Generate audit ID before saving
AuditLogSchema.pre('save', async function() {
  if (!this.auditId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    this.auditId = `AUD-${timestamp}-${random}`.toUpperCase();
  }
});

// Static method to create audit log
AuditLogSchema.statics.log = async function(data: Partial<IAuditLog>) {
  return this.create({
    ...data,
    timestamp: new Date(),
  });
};

export default mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

// Helper function to create audit logs
export async function createAuditLog(data: Omit<IAuditLog, 'auditId' | 'timestamp'>) {
  const AuditLogModel = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
  return AuditLogModel.create({
    ...data,
    timestamp: new Date(),
  });
}

// Helper to calculate field changes
export function calculateChanges(oldData: any, newData: any, fieldsToTrack?: string[]): IFieldChange[] {
  const changes: IFieldChange[] = [];
  const fields = fieldsToTrack || Object.keys({ ...oldData, ...newData });

  for (const field of fields) {
    const oldValue = oldData?.[field];
    const newValue = newData?.[field];

    // Skip if both are undefined/null
    if (oldValue === undefined && newValue === undefined) continue;
    if (oldValue === null && newValue === null) continue;

    // Compare values
    const oldStr = JSON.stringify(oldValue);
    const newStr = JSON.stringify(newValue);

    if (oldStr !== newStr) {
      changes.push({ field, oldValue, newValue });
    }
  }

  return changes;
}
