'use client';

import { useState, useEffect } from 'react';
import {
  Users, Plus, Loader2, Shield, Eye, EyeOff,
  CheckCircle2, XCircle, Pencil, UserX, UserCheck, Unlock,
} from 'lucide-react';
import { format } from 'date-fns';

interface UserRecord {
  _id: string;
  email: string;
  name: string;
  role: 'admin' | 'kyc' | 'marketing' | 'branch' | 'senior_approver' | 'sanction_uploader' | 'personal_banker';
  branchCode?: string;
  phone?: string;
  isActive: boolean;
  isLocked?: boolean;
  lastLogin?: string;
  createdAt: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'kyc' as 'admin' | 'kyc' | 'marketing' | 'branch' | 'senior_approver' | 'sanction_uploader' | 'personal_banker',
    branchCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
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

  async function toggleUserStatus(user: UserRecord) {
    try {
      if (user.isActive) {
        await fetch(`/api/users/${user._id}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/users/${user._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: true }),
        });
      }
      fetchUsers();
    } catch (err) {
      console.error('Failed to toggle user status:', err);
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
                  <option value="kyc">KYC - All except referrals & user management</option>
                  <option value="senior_approver">Senior Approver - Second-level (PEP) approval</option>
                  <option value="sanction_uploader">PEP &amp; Sanctions Uploader - Manage the sanctions list only</option>
                  <option value="marketing">Marketing - Referral program only</option>
                  <option value="branch">Branch - View approved customers (read-only)</option>
                  <option value="personal_banker">Personal Banker (PBB) - Set up requested services for their branch</option>
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
                    <button
                      onClick={() => toggleUserStatus(user)}
                      className={`p-2 rounded-lg transition-colors ${
                        user.isActive
                          ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                      }`}
                      title={user.isActive ? 'Deactivate user' : 'Activate user'}
                    >
                      {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
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
            <p className="text-gray-600">Customer onboarding, screening, approvals. No referral or user management</p>
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
