'use client';

import { useEffect, useState } from 'react';
import { Package, Layers, Smartphone } from 'lucide-react';
import AccountProductsManager from '@/components/AccountProductsManager';
import AdditionalServicesManager from '@/components/AdditionalServicesManager';

type Tab = 'products' | 'services';

// What customers can choose in the web app — managed by KYC officers (and admin)
export default function ProductsAndServicesPage() {
  const [tab, setTab] = useState<Tab>('products');

  // ?tab=services opens the services tab directly
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'services') setTab('services');
  }, []);

  const select = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, '', next === 'services' ? '?tab=services' : window.location.pathname);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'products', label: 'Account Products', icon: Layers },
    { id: 'services', label: 'Additional Services', icon: Smartphone },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-6 h-6 text-green-700" /> Products &amp; Services
        </h1>
        <p className="text-sm text-gray-500 mt-1">What customers can choose in the web app. Changes apply as soon as you save.</p>
      </div>

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
      <div className={tab === 'products' ? '' : 'hidden'}><AccountProductsManager /></div>
      <div className={tab === 'services' ? '' : 'hidden'}><AdditionalServicesManager /></div>
    </div>
  );
}
