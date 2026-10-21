'use client';

import { useEffect, useState } from 'react';
import { Package, Layers, Smartphone, Building2, Eye } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import AccountProductsManager from '@/components/AccountProductsManager';
import AdditionalServicesManager from '@/components/AdditionalServicesManager';
import CorporateCatalogManager from '@/components/CorporateCatalogManager';

type Tab = 'products' | 'services' | 'business';

// What customers can choose in the web app — changed by admin; KYC officers see it read-only
export default function ProductsAndServicesPage() {
  const { user } = useAuth();
  const readOnly = user?.role !== 'admin';
  const [tab, setTab] = useState<Tab>('products');

  // ?tab=services / ?tab=business opens that tab directly
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'services' || t === 'business') setTab(t);
  }, []);

  const select = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, '', next === 'products' ? window.location.pathname : `?tab=${next}`);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'products', label: 'Account Products', icon: Layers },
    { id: 'services', label: 'Additional Services', icon: Smartphone },
    { id: 'business', label: 'Business Accounts', icon: Building2 },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-6 h-6 text-green-700" /> Products &amp; Services
        </h1>
        <p className="text-sm text-gray-500 mt-1">What customers can choose in the web app. Changes apply as soon as you save.</p>
      </div>

      {readOnly && (
        <div className="flex items-start gap-2 p-3 bg-sky-50 border border-sky-200 rounded-lg text-sm text-sky-900">
          <Eye className="w-4 h-4 mt-0.5 shrink-0" />
          View only — products, services and business account settings are changed by an administrator.
        </div>
      )}

      <div className="border-b border-gray-200">
        <nav className="flex gap-6 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => select(t.id)}
              className={`flex items-center gap-2 pb-3 px-1 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.id ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Both stay mounted so unsaved edits survive switching tabs */}
      <div className={tab === 'products' ? '' : 'hidden'}><AccountProductsManager readOnly={readOnly} /></div>
      <div className={tab === 'services' ? '' : 'hidden'}><AdditionalServicesManager readOnly={readOnly} /></div>
      <div className={tab === 'business' ? '' : 'hidden'}><CorporateCatalogManager readOnly={readOnly} /></div>
    </div>
  );
}
