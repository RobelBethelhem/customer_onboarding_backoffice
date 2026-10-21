'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Loader2, AlertTriangle, Printer, Download, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import ServiceNotifyDialog from '@/components/ServiceNotifyDialog';
import {
  ServiceRequestCustomer, serviceRequestSections, serviceRequestServices, serviceRequestNotifications,
  serviceRequestStatus, formatFormDate,
} from '@/lib/serviceRequestForm';

/**
 * One customer's Additional Services Request: their contact, identity, address and account details
 * and the services asked for — to set the services up, print the request or download it as PDF.
 */
export default function ServiceRequestPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const isBanker = user?.role === 'personal_banker';
  const [customer, setCustomer] = useState<ServiceRequestCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notifying, setNotifying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printedAt, setPrintedAt] = useState(() => new Date());

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/services/${encodeURIComponent(params.id)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) setCustomer(data.data);
      else setError(data.error || 'Failed to load the service request');
    } catch {
      setError('Failed to load the service request');
    } finally {
      setLoading(false);
    }
  }

  async function handlePrint() {
    // Recorded in the Audit Log; printing goes ahead even if that fails
    await fetch(`/api/services/${encodeURIComponent(params.id)}/print`, { method: 'POST' }).catch(() => undefined);
    setPrintedAt(new Date());
    setTimeout(() => window.print(), 50);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/services/${encodeURIComponent(params.id)}/pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not create the PDF');
      }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `service-request-${params.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast.success('Service request downloaded', { description: link.download });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-6 space-y-4">
        <Link href="/services" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Service Requests
        </Link>
        <div className="flex items-center gap-2 justify-center py-12 text-red-600 bg-white rounded-xl border border-gray-200">
          <AlertTriangle className="w-5 h-5" /> {error || 'Service request not found'}
        </div>
      </div>
    );
  }

  const status = serviceRequestStatus(customer);
  const services = serviceRequestServices(customer);
  const notifications = serviceRequestNotifications(customer);

  return (
    <div className="p-6 space-y-6 print:p-0">
      {/* Toolbar */}
      <div className="no-print flex flex-col md:flex-row md:items-center md:justify-between gap-4 max-w-4xl mx-auto">
        <Link href="/services" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Service Requests
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download PDF
          </button>
          {isBanker && (
            <button
              onClick={() => setNotifying(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                status === 'Completed' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Send className="w-4 h-4" /> {status === 'Completed' ? 'Resend SMS' : 'Mark Created & Notify'}
            </button>
          )}
        </div>
      </div>

      {/* The request form, as printed */}
      <div className="bg-white rounded-xl border border-gray-200 max-w-4xl mx-auto p-8 space-y-6 print:border-0 print:rounded-none print:p-0 print:max-w-none [print-color-adjust:exact]">
        <div className="flex items-start justify-between gap-6 border-b-2 border-blue-800 pb-4">
          <div className="flex items-center gap-3">
            <Image src="/zblogo.png" alt="Zemen Bank" width={56} height={51} className="object-contain" />
            <div>
              <p className="text-xl font-bold text-blue-800 tracking-wide">ZEMEN BANK</p>
              <h1 className="text-lg font-bold text-gray-900">Additional Services Request</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Application ID</p>
            <p className="font-bold text-gray-900">{customer.customerId}</p>
            <p className="hidden print:block text-xs text-gray-500 mt-1">
              Printed {formatFormDate(printedAt)}<br />by {user?.name || user?.email || ''}
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-500">
          Request status:{' '}
          <span className={`font-semibold ${status === 'Completed' ? 'text-green-700' : 'text-amber-700'}`}>{status}</span>
        </p>

        {serviceRequestSections(customer).map(section => (
          <section key={section.title} className="break-inside-avoid">
            <h2 className="px-3 py-1.5 bg-slate-100 text-sm font-bold text-blue-800">{section.title}</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-x-8 print:gap-x-4 gap-y-2 px-3 pt-3">
              {section.rows.map(row => (
                <div key={row.label} className="grid grid-cols-[9rem_1fr] print:grid-cols-[7.5rem_1fr] gap-2 items-baseline">
                  <dt className="text-xs text-gray-500">{row.label}</dt>
                  <dd className="text-sm text-gray-900 break-words">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <section className="break-inside-avoid">
          <h2 className="px-3 py-1.5 bg-slate-100 text-sm font-bold text-blue-800">Requested services</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="px-3 py-2 font-semibold">Service</th>
                <th className="px-3 py-2 font-semibold">Terms and conditions</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {services.map(s => (
                <tr key={s.name} className="border-b border-gray-100 align-top">
                  <td className="px-3 py-2 font-semibold text-gray-900">{s.name}</td>
                  <td className={`px-3 py-2 ${s.termsMissing ? 'text-red-700 font-medium' : 'text-gray-700'}`}>{s.terms}</td>
                  <td className={`px-3 py-2 ${s.done ? 'text-green-700' : 'text-amber-700'}`}>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {notifications.length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="px-3 py-1.5 bg-slate-100 text-sm font-bold text-blue-800">SMS sent to the customer</h2>
            <ul className="px-3 pt-2 space-y-1 text-sm text-gray-700">
              {notifications.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </section>
        )}

        <section className="break-inside-avoid">
          <h2 className="px-3 py-1.5 bg-slate-100 text-sm font-bold text-blue-800">Signatures</h2>
          <div className="grid grid-cols-2 gap-8 px-3 pt-3">
            {[['Customer', customer.fullName], ['Personal Banker', '']].map(([title, name]) => (
              <div key={title} className="space-y-4">
                <p className="text-sm font-bold text-gray-900">{title}</p>
                {[['Name', name], ['Signature', ''], ['Date', '']].map(([label, value]) => (
                  <div key={label} className="flex items-end gap-3">
                    <span className="w-16 text-xs text-gray-500">{label}</span>
                    <span className="flex-1 border-b border-gray-400 text-sm text-gray-900 min-h-[1.5rem]">{value}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>

      {notifying && (
        <ServiceNotifyDialog
          customer={customer}
          onClose={() => setNotifying(false)}
          onDone={() => { setNotifying(false); load(); }}
        />
      )}
    </div>
  );
}
