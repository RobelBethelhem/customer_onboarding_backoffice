'use client';

import { Clock, AlertCircle } from 'lucide-react';
import CustomerTable from '@/components/CustomerTable';
import { customers } from '@/lib/data';

export default function ApplicationsPage() {
  // Get customers created in the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const newApplications = customers.filter(
    (c) => new Date(c.createdAt) >= sevenDaysAgo
  );

  const todayApps = customers.filter(
    (c) => new Date(c.createdAt).toDateString() === new Date().toDateString()
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Applications</h1>
          <p className="text-gray-500 mt-1">Recent account opening requests</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-blue-600 font-medium">Today</p>
            <p className="text-2xl font-bold text-blue-900">{todayApps.length}</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-amber-600 font-medium">This Week</p>
            <p className="text-2xl font-bold text-amber-900">{newApplications.length}</p>
          </div>
        </div>

        <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-green-600 font-medium">Avg. Processing Time</p>
            <p className="text-2xl font-bold text-green-900">2.3 days</p>
          </div>
        </div>
      </div>

      {/* Applications Table */}
      <CustomerTable
        customers={newApplications}
        title="Applications (Last 7 Days)"
      />
    </div>
  );
}
