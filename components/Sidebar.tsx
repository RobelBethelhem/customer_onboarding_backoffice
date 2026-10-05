'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  Shield,
  ShieldAlert,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  TrendingUp,
  Gift,
  Users,
  Smartphone,
  History,
  Package,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth, UserRole } from './AuthProvider';

interface MenuItem {
  name: string;
  href: string;
  icon: any;
  badge?: boolean;
  servicesBadge?: boolean;  // count of service requests waiting for this Personal Banker
  divider?: boolean;
  roles: UserRole[];
}

const menuItems: MenuItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'kyc', 'senior_approver'] },
  { name: 'Pending Review', href: '/pending', icon: Clock, badge: true, roles: ['admin', 'kyc', 'senior_approver'] },
  { name: 'Escalated (PEP)', href: '/escalated', icon: ShieldAlert, roles: ['admin', 'kyc', 'senior_approver'] },
  { name: 'Auto Approved', href: '/auto-approved', icon: Zap, roles: ['admin', 'kyc', 'branch', 'senior_approver'] },
  { name: 'Manually Approved', href: '/approved', icon: CheckCircle2, roles: ['admin', 'kyc', 'branch', 'senior_approver'] },
  { name: 'Rejected', href: '/rejected', icon: XCircle, roles: ['admin', 'kyc', 'senior_approver'] },
  { name: 'Sanctions & PEP', href: '/sanctions', icon: Shield, roles: ['admin', 'sanction_uploader'] },
  { name: 'Service Requests', href: '/services', icon: Smartphone, servicesBadge: true, roles: ['admin', 'personal_banker'] },
  { name: 'Executive Review', href: '/executive-review', icon: TrendingUp, divider: true, roles: ['admin', 'kyc'] },
  { name: 'Referral Program', href: '/referrals', icon: Gift, roles: ['admin', 'marketing'] },
  { name: 'Products & Services', href: '/products', icon: Package, roles: ['admin', 'kyc'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin', 'kyc', 'marketing'] },
  { name: 'User Management', href: '/users', icon: Users, roles: ['admin'] },
  { name: 'Audit Log', href: '/audit-logs', icon: History, roles: ['admin'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [servicesCount, setServicesCount] = useState(0);

  const filteredItems = menuItems.filter(item =>
    user && item.roles.includes(user.role)
  );

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'kyc')) {
      fetchPendingCount();
      const interval = setInterval(fetchPendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'personal_banker') {
      fetchServicesCount();
      const interval = setInterval(fetchServicesCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  async function fetchServicesCount() {
    try {
      const response = await fetch('/api/services?status=pending');
      const data = await response.json();
      if (data.success) {
        setServicesCount(data.data.length);
      }
    } catch (err) {
      console.error('Failed to fetch service request count:', err);
    }
  }

  async function fetchPendingCount() {
    try {
      const response = await fetch('/api/customers?status=pending_all&limit=0');
      const data = await response.json();
      if (data.success) {
        setPendingCount(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch pending count:', err);
    }
  }

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'kyc': return 'KYC Officer';
      case 'senior_approver': return 'Senior Approver';
      case 'sanction_uploader': return 'Sanctions Uploader';
      case 'marketing': return 'Marketing';
      case 'branch': return `Branch (${user?.branchCode || ''})`;
      case 'personal_banker': return `Personal Banker (${user?.branchCode || ''})`;
      default: return 'User';
    }
  };

  return (
    <aside
      className={`${
        collapsed ? 'w-20' : 'w-64'
      } bg-gradient-to-b from-slate-900 to-slate-800 min-h-screen flex flex-col transition-all duration-300`}
    >
      {/* Logo */}
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex flex-col items-center gap-4">
          <div className={`${collapsed ? 'w-12 h-12' : 'w-24 h-24'} rounded-xl flex items-center justify-center overflow-hidden transition-all duration-300`}>
            <Image
              src="/zblogo.png"
              alt="Zemen Bank Logo"
              width={collapsed ? 48 : 96}
              height={collapsed ? 48 : 96}
              className="object-contain"
            />
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          >
            {collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const count = item.badge ? pendingCount : item.servicesBadge ? servicesCount : 0;

          return (
            <div key={item.name}>
              {item.divider && <div className="border-t border-slate-700/50 my-3"></div>}
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative ${
                  isActive
                    ? 'bg-red-600 text-white shadow-lg shadow-red-500/25'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                <Icon size={20} />
                {!collapsed && (
                  <>
                    <span className="font-medium flex-1">{item.name}</span>
                    {count > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {count}
                      </span>
                    )}
                  </>
                )}
                {collapsed && count > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                    {count}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-slate-700/50">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{user?.name || 'User'}</p>
              <p className="text-slate-400 text-xs truncate">{getRoleLabel(user?.role)}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
