'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Shield, Search, Plus, Upload, Download, AlertTriangle,
  Users, Eye, Edit2, Trash2, X, Check, ChevronDown,
  FileText, Clock, Filter, RefreshCw, AlertCircle, CheckCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Toast notification component
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 ${
            toast.type === 'success' ? 'bg-green-600 text-white' :
            toast.type === 'error' ? 'bg-red-600 text-white' :
            'bg-blue-600 text-white'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          {toast.type === 'info' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <span className="font-medium">{toast.message}</span>
          <button onClick={() => onRemove(toast.id)} className="ml-2 hover:opacity-80 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

interface SanctionEntry {
  _id: string;
  entryId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;
  fullNameAmharic?: string;
  dateOfBirth?: string;
  nationality?: string;
  gender?: string;
  sanctionType: string;
  sourceId: string;
  status: string;
  reason?: string;
  programs?: string[];
  pepPosition?: string;
  pepCountry?: string;
  riskScore?: number;
  createdAt: string;
}

interface Source {
  sourceId: string;
  name: string;
  shortName: string;
  type: string;
  totalEntries: number;
  activeEntries: number;
}

interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
}

interface AuditLog {
  auditId: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  performedBy: string;
  description: string;
  timestamp: string;
  changes?: FieldChange[];
}

const SANCTION_TYPES = [
  { value: 'SANCTIONS', label: 'Sanctions', color: 'red' },
  { value: 'PEP', label: 'PEP', color: 'purple' },
  { value: 'WATCHLIST', label: 'Watchlist', color: 'orange' },
  { value: 'ADVERSE_MEDIA', label: 'Adverse Media', color: 'yellow' },
  { value: 'OTHER', label: 'Other', color: 'gray' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active', color: 'green' },
  { value: 'INACTIVE', label: 'Inactive', color: 'gray' },
  { value: 'EXPIRED', label: 'Expired', color: 'red' },
  { value: 'UNDER_REVIEW', label: 'Under Review', color: 'yellow' },
];

// Flexible header mapping so standard sanctions / NBE-banned / terminated-customer list files
// import cleanly regardless of column naming (case / spacing / common synonyms).
const normKey = (k: string) => String(k).toLowerCase().replace(/[\s_\-./]/g, '');
const HEADER_MAP: Record<string, string> = {
  firstname: 'firstName', fname: 'firstName', givenname: 'firstName',
  middlename: 'middleName', mname: 'middleName',
  lastname: 'lastName', surname: 'lastName', familyname: 'lastName',
  fullname: 'fullName', name: 'fullName', fullnameenglish: 'fullName',
  fullnameamharic: 'fullNameAmharic', amharicname: 'fullNameAmharic', nameamharic: 'fullNameAmharic',
  dateofbirth: 'dateOfBirth', dob: 'dateOfBirth', birthdate: 'dateOfBirth',
  nationality: 'nationality', country: 'nationality',
  gender: 'gender', sex: 'gender',
  reason: 'reason', remark: 'reason', remarks: 'reason',
  programs: 'programs', program: 'programs',
  pepposition: 'pepPosition', position: 'pepPosition',
  pepcountry: 'pepCountry',
  riskscore: 'riskScore', score: 'riskScore', risk: 'riskScore',
};
function normalizeImportRow(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    const canon = HEADER_MAP[normKey(key)];
    if (canon && (out[canon] === undefined || out[canon] === '')) {
      out[canon] = typeof row[key] === 'string' ? row[key].trim() : row[key];
    }
  }
  if (out.dateOfBirth instanceof Date) {
    out.dateOfBirth = out.dateOfBirth.toISOString().split('T')[0];
  }
  return out;
}

export default function SanctionsPage() {
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'import' | 'audit'>('list');
  const [entries, setEntries] = useState<SanctionEntry[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ total: 0, sanctions: 0, pep: 0, watchlist: 0, active: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SanctionEntry | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    fullNameAmharic: '',
    dateOfBirth: '',
    nationality: '',
    gender: 'unknown',
    sanctionType: 'SANCTIONS',
    sourceId: 'ETH_LOCAL',
    reason: '',
    programs: '',
    pepPosition: '',
    pepCountry: '',
    riskScore: 50,
  });

  // Import state
  const [importData, setImportData] = useState<any[]>([]);
  const [importSource, setImportSource] = useState('ETH_LOCAL');
  const [importType, setImportType] = useState('SANCTIONS');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  }

  function removeToast(id: number) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  useEffect(() => {
    loadData();
  }, [search, filterType, filterStatus, filterSource]);

  async function loadData() {
    setLoading(true);
    try {
      // Load entries
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      if (filterSource) params.set('source', filterSource);

      const [entriesRes, sourcesRes] = await Promise.all([
        fetch(`/api/sanctions?${params}`),
        fetch('/api/sanctions/sources'),
      ]);

      const entriesData = await entriesRes.json();
      const sourcesData = await sourcesRes.json();

      if (entriesData.success) {
        setEntries(entriesData.data);
        setCounts(entriesData.counts);
      }

      if (sourcesData.success) {
        setSources(sourcesData.data);
      }

    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAuditLogs() {
    try {
      const res = await fetch('/api/sanctions/audit?module=SANCTIONS&limit=100');
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.data);
      }
    } catch (error) {
      console.error('Load audit logs error:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const res = await fetch('/api/sanctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          programs: formData.programs.split(',').map(p => p.trim()).filter(Boolean),
          createdBy: 'Admin',
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Entry created successfully', 'success');
        setShowAddModal(false);
        resetForm();
        loadData();
      } else {
        showToast(data.error || 'Failed to create entry', 'error');
      }
    } catch (error) {
      console.error('Submit error:', error);
      showToast('Failed to create entry', 'error');
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEntry) return;

    try {
      const res = await fetch(`/api/sanctions/${selectedEntry.entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          programs: formData.programs.split(',').map(p => p.trim()).filter(Boolean),
          updatedBy: 'Admin',
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('Entry updated successfully', 'success');
        setShowEditModal(false);
        setSelectedEntry(null);
        loadData();
      } else {
        showToast(data.error || 'Failed to update entry', 'error');
      }
    } catch (error) {
      console.error('Update error:', error);
      showToast('Failed to update entry', 'error');
    }
  }

  // async function handleDelete() {
  //   if (!selectedEntry) return;

  //   try {
  //     const res = await fetch(`/api/sanctions/${selectedEntry.entryId}?deletedBy=Admin`, {
  //       method: 'DELETE',
  //     });

  //     const data = await res.json();
  //     if (data.success) {
  //       showToast('Entry deleted successfully', 'success');
  //       setShowDeleteModal(false);
  //       setSelectedEntry(null);
  //       loadData();
  //     } else {
  //       showToast(data.error || 'Failed to delete entry', 'error');
  //     }
  //   } catch (error) {
  //     console.error('Delete error:', error);
  //     showToast('Failed to delete entry', 'error');
  //   }
  // }

  function resetForm() {
    setFormData({
      firstName: '',
      middleName: '',
      lastName: '',
      fullNameAmharic: '',
      dateOfBirth: '',
      nationality: '',
      gender: 'unknown',
      sanctionType: 'SANCTIONS',
      sourceId: 'ETH_LOCAL',
      reason: '',
      programs: '',
      pepPosition: '',
      pepCountry: '',
      riskScore: 50,
    });
  }

  function handleEdit(entry: SanctionEntry) {
    setSelectedEntry(entry);
    setFormData({
      firstName: entry.firstName,
      middleName: entry.middleName || '',
      lastName: entry.lastName,
      fullNameAmharic: entry.fullNameAmharic || '',
      dateOfBirth: entry.dateOfBirth ? entry.dateOfBirth.split('T')[0] : '',
      nationality: entry.nationality || '',
      gender: entry.gender || 'unknown',
      sanctionType: entry.sanctionType,
      sourceId: entry.sourceId,
      reason: entry.reason || '',
      programs: entry.programs?.join(', ') || '',
      pepPosition: entry.pepPosition || '',
      pepCountry: entry.pepCountry || '',
      riskScore: entry.riskScore || 50,
    });
    setShowEditModal(true);
  }

  // Import from Excel/CSV — robust parsing (ArrayBuffer) + flexible header mapping
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' }) as Record<string, any>[];
        const normalized = rawRows.map(normalizeImportRow).filter(r => r.firstName || r.fullName);
        if (normalized.length === 0) {
          showToast('No valid rows found. Make sure the file has a Name (or First/Last Name) column.', 'error');
          return;
        }
        setImportData(normalized);
        showToast(`${normalized.length} record(s) loaded from ${file.name}`, 'success');
      } catch (err) {
        console.error('Parse error:', err);
        showToast('Could not read this file. Please upload a valid .xlsx, .xls or .csv file.', 'error');
      }
    };
    reader.onerror = () => showToast('Failed to read the file.', 'error');
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (importData.length === 0) {
      showToast('No data to import', 'error');
      return;
    }

    try {
      const res = await fetch('/api/sanctions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: importData,
          sourceId: importSource,
          sanctionType: importType,
          importedBy: 'Admin',
          fileName: 'import.xlsx',
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Import completed: ${data.data.success} added, ${data.data.skipped} skipped, ${data.data.errors} errors`, 'success');
        setImportData([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadData();
      } else {
        showToast(data.error || 'Import failed', 'error');
      }
    } catch (error) {
      console.error('Import error:', error);
      showToast('Import failed', 'error');
    }
  }

  // Excel Export
  async function handleExport() {
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (filterSource) params.set('source', filterSource);
      params.set('exportedBy', 'Admin');

      const res = await fetch(`/api/sanctions/export?${params}`);
      const data = await res.json();

      if (data.success) {
        const worksheet = XLSX.utils.json_to_sheet(data.data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sanctions');
        XLSX.writeFile(workbook, `sanctions_export_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast(`Exported ${data.data.length} entries successfully`, 'success');
      } else {
        showToast('Export failed', 'error');
      }
    } catch (error) {
      console.error('Export error:', error);
      showToast('Export failed', 'error');
    }
  }

  // Download a sample Excel template showing the exact columns the import expects,
  // with one example row so staff can prepare their list in the right format.
  function downloadSampleTemplate() {
    const sample = [
      {
        firstName: 'Abebe',
        middleName: 'Kebede',
        lastName: 'Tadesse',
        fullName: 'Abebe Kebede Tadesse',
        fullNameAmharic: 'አበበ ከበደ ታደሰ',
        dateOfBirth: '1985-03-12',
        nationality: 'Ethiopia',
        gender: 'male',
        reason: 'Example row — delete this and add your real entries',
        programs: 'OFAC,UN',
        riskScore: 90,
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(sample);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, 'sanctions_import_template.xlsx');
    showToast('Sample template downloaded', 'success');
  }

  const getTypeColor = (type: string) => {
    const t = SANCTION_TYPES.find(t => t.value === type);
    return t?.color || 'gray';
  };

  const getStatusColor = (status: string) => {
    const s = STATUS_OPTIONS.find(s => s.value === status);
    return s?.color || 'gray';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-red-600" />
            Sanctions & PEP Screening
          </h1>
          <p className="text-gray-500 mt-1">Manage sanctions list, PEP records, and watchlist entries</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.total}</p>
              <p className="text-sm text-gray-500">Total Entries</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.sanctions}</p>
              <p className="text-sm text-gray-500">Sanctions</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.pep}</p>
              <p className="text-sm text-gray-500">PEP</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.watchlist}</p>
              <p className="text-sm text-gray-500">Watchlist</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts.active}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border">
        <div className="border-b px-4">
          <div className="flex gap-4">
            {[
              { id: 'list', label: 'Entries List', icon: Users },
              { id: 'import', label: 'Import', icon: Upload },
              { id: 'audit', label: 'Audit Trail', icon: Clock },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === 'audit') loadAuditLogs();
                }}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* List Tab */}
        {activeTab === 'list' && (
          <div className="p-4">
            {/* Filters */}
            <div className="flex gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Types</option>
                {SANCTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Status</option>
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Sources</option>
                {sources.map(s => (
                  <option key={s.sourceId} value={s.sourceId}>{s.shortName}</option>
                ))}
              </select>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No entries found</td>
                    </tr>
                  ) : entries.map(entry => (
                    <tr key={entry._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{entry.entryId}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{entry.fullName}</p>
                          {entry.fullNameAmharic && (
                            <p className="text-sm text-gray-500">{entry.fullNameAmharic}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${getTypeColor(entry.sanctionType)}-100 text-${getTypeColor(entry.sanctionType)}-700`}>
                          {entry.sanctionType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.sourceId}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${getStatusColor(entry.status)}-100 text-${getStatusColor(entry.status)}-700`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full">
                            <div
                              className={`h-2 rounded-full ${
                                (entry.riskScore || 0) >= 75 ? 'bg-red-500' :
                                (entry.riskScore || 0) >= 50 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${entry.riskScore || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{entry.riskScore || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(entry)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setSelectedEntry(entry); setShowDeleteModal(true); }}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="p-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-gray-50 border-2 border-dashed rounded-xl p-8 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Import from Excel or CSV</h3>
                <p className="text-gray-500 mb-4">Upload a sanctions, NBE-banned, or terminated-customer list (.xlsx, .xls, or .csv). PEP lists are not supported.</p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
                  >
                    Select File
                  </button>
                  <button
                    onClick={downloadSampleTemplate}
                    className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Sample Template
                  </button>
                </div>
              </div>

              {importData.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">{importData.length} records ready to import</h4>
                    <div className="flex gap-4">
                      <select
                        value={importSource}
                        onChange={(e) => setImportSource(e.target.value)}
                        className="px-3 py-2 border rounded-lg"
                      >
                        {sources.map(s => (
                          <option key={s.sourceId} value={s.sourceId}>{s.name}</option>
                        ))}
                      </select>
                      <select
                        value={importType}
                        onChange={(e) => setImportType(e.target.value)}
                        className="px-3 py-2 border rounded-lg"
                      >
                        {SANCTION_TYPES.filter(t => t.value !== 'PEP').map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="bg-white border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">DOB</th>
                          <th className="px-3 py-2 text-left">Nationality</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importData.slice(0, 10).map((row, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2">{row.fullName || `${row.firstName} ${row.lastName}`}</td>
                            <td className="px-3 py-2">{row.dateOfBirth || '-'}</td>
                            <td className="px-3 py-2">{row.nationality || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex gap-4">
                    <button
                      onClick={handleImport}
                      className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Import {importData.length} Records
                    </button>
                    <button
                      onClick={() => { setImportData([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="px-6 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Expected Excel Columns</h4>
                <p className="text-sm text-blue-700">
                  firstName, middleName, lastName, fullName, fullNameAmharic, dateOfBirth, nationality, gender, reason, programs, pepPosition, pepCountry, riskScore
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No audit logs</td>
                    </tr>
                  ) : auditLogs.map(log => (
                    <tr key={log.auditId} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                          log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                          log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                          log.action === 'IMPORT' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-mono text-gray-600">{log.entityId}</span>
                        {log.entityName && <p className="text-gray-500 text-xs mt-1">{log.entityName}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{log.performedBy}</td>
                      <td className="px-4 py-3 text-sm">
                        <p className="text-gray-600 mb-2">{log.description}</p>
                        {log.action === 'UPDATE' && log.changes && log.changes.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Field Changes:</p>
                            {log.changes.map((change, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs">
                                <span className="font-medium text-gray-700 min-w-[100px]">{change.field}:</span>
                                <span className="text-red-600 line-through">{String(change.oldValue || '(empty)')}</span>
                                <span className="text-gray-400">→</span>
                                <span className="text-green-600 font-medium">{String(change.newValue || '(empty)')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {showEditModal ? 'Edit Entry' : 'Add New Entry'}
              </h2>
              <button
                onClick={() => { setShowAddModal(false); setShowEditModal(false); setSelectedEntry(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={showEditModal ? handleUpdate : handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name (Amharic)</label>
                <input
                  type="text"
                  value={formData.fullNameAmharic}
                  onChange={(e) => setFormData({ ...formData, fullNameAmharic: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    required
                    value={formData.sanctionType}
                    onChange={(e) => setFormData({ ...formData, sanctionType: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {SANCTION_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source *</label>
                  <select
                    required
                    value={formData.sourceId}
                    onChange={(e) => setFormData({ ...formData, sourceId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {sources.map(s => (
                      <option key={s.sourceId} value={s.sourceId}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
                  <input
                    type="text"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>

              {formData.sanctionType === 'PEP' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PEP Position</label>
                    <input
                      type="text"
                      value={formData.pepPosition}
                      onChange={(e) => setFormData({ ...formData, pepPosition: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="e.g., Minister of Finance"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PEP Country</label>
                    <input
                      type="text"
                      value={formData.pepCountry}
                      onChange={(e) => setFormData({ ...formData, pepCountry: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="e.g., Ethiopia"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Programs (comma-separated)</label>
                <input
                  type="text"
                  value={formData.programs}
                  onChange={(e) => setFormData({ ...formData, programs: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., SDGT, IRAN"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Risk Score: {formData.riskScore}</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.riskScore}
                  onChange={(e) => setFormData({ ...formData, riskScore: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setShowEditModal(false); setSelectedEntry(null); }}
                  className="px-6 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  {showEditModal ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Entry</h3>
                <p className="text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{selectedEntry.fullName}</strong> ({selectedEntry.entryId})?
            </p>

            <div className="flex justify-end gap-4">
              <button
                onClick={() => { setShowDeleteModal(false); setSelectedEntry(null); }}
                className="px-6 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
