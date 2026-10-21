'use client';

import { useState, useEffect } from 'react';
import {
  Users, Plus, Loader2, Shield, Eye, EyeOff,
  CheckCircle2, XCircle, Pencil, UserX, UserCheck, Unlock, Search, ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';

interface UserRecord {
  _id: string;
  email: string;
  name: string;
  role: 'admin' | 'kyc' | 'marketing' | 'branch' | 'senior_approver' | 'sanction_uploader' | 'personal_banker' | 'auditor';
  branchCode?: string;
  phone?: string;
  isActive: boolean;
  isLocked?: boolean;
  lastLogin?: string;
  createdAt: string;
}

type StatusFilter = 'all' | 'active' | 'inactive' | 'locked';
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'inactive', label: 'Inactive' }, { id: 'locked', label: 'Locked' },
];
const ROLE_FILTERS: { id: string; label: string }[] = [
  { id: '', label: 'All roles' }, { id: 'admin', label: 'Admin' }, { id: 'kyc', label: 'KYC' },
  { id: 'senior_approver', label: 'Senior Approver' }, { id: 'sanction_uploader', label: 'Sanctions Uploader' },
  { id: 'marketing', label: 'Marketing' }, { id: 'branch', label: 'Branch' }, { id: 'personal_banker', label: 'Personal Banker' },
  { id: 'auditor', label: 'Auditor' },
];

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  // Filters and paging (server side)
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [counts, setCounts] = useState<Record<StatusFilter, number>>({ all: 0, active: 0, inactive: 0, locked: 0 });
  const [listError, setListError] = useState('');
  // Activate / deactivate: the user waiting for confirmation, and the request in flight
  const [confirmUser, setConfirmUser] = useState<UserRecord | null>(null);
  const [statusBusy, setStatusBusy] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'kyc' as 'admin' | 'kyc' | 'marketing' | 'branch' | 'senior_approver' | 'sanction_uploader' | 'personal_banker' | 'auditor',
    branchCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search as you type, once typing pauses
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statusFilter, roleFilter, page, pageSize]);

  async function fetchUsers() {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize), status: statusFilter });
      if (query) params.set('search', query);
      if (roleFilter) params.set('role', roleFilter);
      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
        setTotal(data.total);
        setPages(data.pages);
        if (data.counts) setCounts(data.counts);
        setListError('');
        // The page emptied (e.g. its last user changed status): show the last page that has users
        if (data.users.length === 0 && page > 1 && page > data.pages) setPage(data.pages);
      } else {
        setListError(data.error || 'Failed to load users');
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setListError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    setEditingUser(null);
    setFormData({ email: '', password: '', name: '', phone: '', role: 'kyc', branchCode: '' });
    setError('');
    setShowForm(true);
  }

  function openEditForm(user: UserRecord) {
    setEditingUser(user);
    setFormData({ email: user.email, password: '', name: user.name, phone: user.phone || '', role: user.role, branchCode: user.branchCode || '' });
    setError('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (editingUser) {
        // Update
        const body: any = { name: formData.name, role: formData.role, branchCode: formData.branchCode, phone: formData.phone };
        if (formData.password) body.password = formData.password;

        const res = await fetch(`/api/users/${editingUser._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        if (data.success) {
          setSuccessMsg('User updated successfully');
          setShowForm(false);
          fetchUsers();
        } else {
          setError(data.error);
        }
      } else {
        // Create
        if (!formData.password) {
          setError('Password is required');
          setSaving(false);
          return;
        }

        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();

        if (data.success) {
          setSuccessMsg('User created successfully');
          setShowForm(false);
          fetchUsers();
        } else {
          setError(data.error);
        }
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  // Activate right away; deactivate after the admin confirms (the user is signed out)
  async function setUserActive(user: UserRecord, isActive: boolean) {
    setStatusBusy(user._id);
    setListError('');
    try {
      const res = await fetch(`/api/users/${user._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not change the user');
      setSuccessMsg(isActive ? `${user.name} is active and can sign in again` : `${user.name} is deactivated and signed out`);
      fetchUsers();
    } catch (err) {
      setListError((err as Error).message);
    } finally {
      setStatusBusy('');
      setConfirmUser(null);
    }
  }

  async function unlockUser(user: UserRecord) {
    try {
      await fetch(`/api/users/${user._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: false }),
      });
      setSuccessMsg(`${user.name} unlocked`);
      fetchUsers();
    } catch (err) {
      console.error('Failed to unlock user:', err);
    }
  }

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 3000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Admin</span>;
      case 'kyc':
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">KYC</span>;
      case 'senior_approver':
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Senior Approver</span>;
      case 'sanction_uploader':
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-teal-100 text-teal-700">Sanctions Uploader</span>;
      case 'marketing':
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Marketing</span>;
      case 'branch':
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">Branch</span>;
      case 'personal_banker':
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-pink-100 text-pink-700">Personal Banker</span>;
      case 'auditor':
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-200 text-slate-700">Auditor</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">{role}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-600" />
            User Management
          </h1>
          <p className="text-gray-500 mt-1">Manage dashboard users and their roles</p>
        </div>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      {listError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {listError}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex p-1 bg-gray-100 rounded-lg w-fit">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => { setStatusFilter(f.id); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === f.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label} <span className="text-xs text-gray-400">{counts[f.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone or branch code..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ROLE_FILTERS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>

      {/* Deactivate: confirm first */}
      {confirmUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => !statusBusy && setConfirmUser(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-600" /> Deactivate {confirmUser.name}?
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              {confirmUser.email} is signed out and cannot sign in until you activate the account again. Their work and
              the audit trail are kept.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setConfirmUser(null)}
                disabled={!!statusBusy}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setUserActive(confirmUser, false)}
                disabled={!!statusBusy}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {statusBusy ? <Loader2 size={16} className="animate-spin" /> : <UserX size={16} />} Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingUser ? 'Edit User' : 'Create New User'}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                  required
                  placeholder="e.g., 0911234567 (used for login OTP)"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none pr-10 text-gray-900"
                    required={!editingUser}
                    minLength={12}
                    placeholder={editingUser ? 'Leave blank to keep current' : 'Min 12 chars: upper, lower, number, symbol'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                >
                  <option value="admin">Admin - Full access</option>
                  <option value="kyc">KYC - Reviews and approvals; Products &amp; Services and Settings view only</option>
                  <option value="senior_approver">Senior Approver - Second-level (PEP) approval</option>
                  <option value="sanction_uploader">PEP &amp; Sanctions Uploader - Manage the sanctions list only</option>
                  <option value="marketing">Marketing - Referral program only</option>
                  <option value="branch">Branch - View approved customers (read-only)</option>
                  <option value="personal_banker">Personal Banker (PBB) - Set up requested services for their branch</option>
                  <option value="auditor">Auditor - View and export the Audit Log only (read-only)</option>
                </select>
              </div>

              {(formData.role === 'branch' || formData.role === 'personal_banker') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch Code</label>
                  <input
                    type="text"
                    value={formData.branchCode}
                    onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                    required
                    placeholder="e.g., 103, 164"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {formData.role === 'personal_banker'
                      ? 'This user will only see service requests from customers of this branch'
                      : 'This user will only see approved customers from this branch'}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user._id} className={`hover:bg-gray-50 ${!user.isActive ? 'opacity-60' : ''}`}>
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </td>
                <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {(user.role === 'branch' || user.role === 'personal_banker') && user.branchCode ? user.branchCode : '-'}
                </td>
                <td className="px-6 py-4">
                  {user.isLocked ? (
                    <span className="flex items-center gap-1.5 text-amber-600 text-sm font-medium">
                      <XCircle className="w-4 h-4" />
                      Locked
                    </span>
                  ) : user.isActive ? (
                    <span className="flex items-center gap-1.5 text-green-600 text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-red-500 text-sm">
                      <XCircle className="w-4 h-4" />
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {user.lastLogin
                    ? format(new Date(user.lastLogin), 'MMM d, yyyy HH:mm')
                    : 'Never'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {format(new Date(user.createdAt), 'MMM d, yyyy')}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {user.isLocked && (
                      <button
                        onClick={() => unlockUser(user)}
                        className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Unlock account"
                      >
                        <Unlock className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => openEditForm(user)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit user"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {user.isActive ? (
                      <button
                        onClick={() => setConfirmUser(user)}
                        disabled={statusBusy === user._id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Deactivate: the user is signed out and cannot sign in"
                      >
                        <UserX className="w-3.5 h-3.5" /> Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => setUserActive(user, true)}
                        disabled={statusBusy === user._id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
                        title="Activate: the user can sign in again"
                      >
                        {statusBusy === user._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />} Activate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No users found</p>
          </div>
        )}

        {/* Paging */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
          <span>
            {total === 0 ? 'No users' : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              Per page
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="px-2 py-1 border border-gray-200 rounded-md bg-white"
              >
                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 border border-gray-200 rounded-md bg-white hover:bg-gray-100 disabled:opacity-40"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {page} of {pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="p-1.5 border border-gray-200 rounded-md bg-white hover:bg-gray-100 disabled:opacity-40"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Role Info */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-semibold text-blue-900 flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5" />
          Role Permissions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="font-medium text-purple-700 mb-1">Admin</p>
            <p className="text-gray-600">Full access to all features including user management</p>
          </div>
          <div>
            <p className="font-medium text-blue-700 mb-1">KYC Officer</p>
            <p className="text-gray-600">Customer onboarding, screening, approvals. Products &amp; Services and Settings view only; no referral or user management</p>
          </div>
          <div>
            <p className="font-medium text-green-700 mb-1">Marketing</p>
            <p className="text-gray-600">Referral program dashboard and configuration only</p>
          </div>
          <div>
            <p className="font-medium text-orange-700 mb-1">Branch</p>
            <p className="text-gray-600">View approved customers from their assigned branch only (read-only)</p>
          </div>
          <div>
            <p className="font-medium text-teal-700 mb-1">PEP &amp; Sanctions Uploader</p>
            <p className="text-gray-600">Manage the sanctions/watchlist database (upload, add, edit) only. No customer or approval access</p>
          </div>
          <div>
            <p className="font-medium text-pink-700 mb-1">Personal Banker (PBB)</p>
            <p className="text-gray-600">For their branch only: sets up the Mobile Banking, Internet Banking and Debit Card that customers requested, then notifies them by SMS</p>
          </div>
        </div>
      </div>
    </div>
  );
}
