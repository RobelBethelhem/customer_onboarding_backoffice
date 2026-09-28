'use client';

import { Download, Plus } from 'lucide-react';
import CustomerTable from '@/components/CustomerTable';
import { customers } from '@/lib/data';

export default function CustomersPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Customers</h1>
          <p className="text-gray-500 mt-1">Manage and view all registered customers</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Customer Table */}
      <CustomerTable customers={customers} title="Customer Database" />
    </div>
  );
}
