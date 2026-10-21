'use client';

import { useState } from 'react';
import { Loader2, Send, X, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { servicesReadySms, serviceNamesFor } from '@/lib/services';
import { ServiceRequestCustomer, formatFormDate } from '@/lib/serviceRequestForm';
import ServiceIcon from '@/components/ServiceIcon';

const MAX_CUSTOM_MESSAGE = 300;

export const doneRecord = (c: ServiceRequestCustomer, service: string) => (c.completedServices || []).find(s => s.service === service);
// The service as requested: name, icon and terms acceptance saved with the application
export const detailOf = (c: ServiceRequestCustomer, service: string) => (c.requestedServiceDetails || []).find(d => d.id === service);
export const termsNote = (c: ServiceRequestCustomer, service: string): { ok: boolean; text: string } | null => {
  const d = detailOf(c, service);
  if (!d?.termsRequired) return null;
  return d.termsAcceptedVersion
    ? { ok: true, text: `Terms accepted (version ${d.termsAcceptedVersion}${d.termsAcceptedAt ? `, ${formatFormDate(d.termsAcceptedAt)}` : ''})` }
    : { ok: false, text: 'Terms not accepted online — have the customer sign them at the branch' };
};

/**
 * The Personal Banker has set services up: mark them created and SMS the customer (POST
 * /api/services/[id]). `onDone` runs after a successful update.
 */
export default function ServiceNotifyDialog({ customer, onClose, onDone }: {
  customer: ServiceRequestCustomer;
  onClose: () => void;
  onDone: () => void;
}) {
  const requested = customer.requestedServices || [];
  const outstanding = requested.filter(s => !doneRecord(customer, s));
  // Pre-select what is still outstanding (everything, when re-sending)
  const [selected, setSelected] = useState<string[]>(outstanding.length ? outstanding : requested);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const names = serviceNamesFor(customer);

  function toggleService(service: string) {
    setSelected(prev => prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]);
  }

  async function handleSend() {
    if (selected.length === 0) return;
    setSending(true);
    try {
      const res = await fetch(`/api/services/${customer.customerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: selected, customMessage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update the service request');
      }
      if (data.smsSent) {
        toast.success(`Marked as created — SMS sent to ${customer.phone}`);
      } else {
        toast.warning('Marked as created, but the SMS could not be sent', {
          description: 'Please contact the customer directly.',
        });
      }
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  const preview = selected.length
    ? servicesReadySms(customer.fullName, customer.accountNumber, requested.filter(s => selected.includes(s)), customMessage, names)
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print" onClick={() => !sending && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Notify {customer.fullName}</h3>
            <p className="text-sm text-gray-500">
              Account {customer.accountNumber || '-'} · {customer.phone || 'no phone on file'}
            </p>
          </div>
          <button onClick={onClose} disabled={sending} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Which services have you set up?</p>
            <div className="space-y-2">
              {requested.map(service => {
                const done = doneRecord(customer, service);
                const terms = termsNote(customer, service);
                return (
                  <label
                    key={service}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected.includes(service) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(service)}
                      onChange={() => toggleService(service)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <ServiceIcon id={service} icon={detailOf(customer, service)?.icon} className="w-5 h-5 text-gray-500" />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-gray-800">{names[service] || service}</span>
                      {terms && (
                        <span className={`block text-xs ${terms.ok ? 'text-gray-500' : 'text-red-600 font-medium'}`}>{terms.text}</span>
                      )}
                    </span>
                    {done && (
                      <span className="text-xs text-green-700">
                        Created {formatFormDate(done.completedAt)} by {done.completedBy}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <MessageSquare className="w-4 h-4" /> Additional message (optional)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value.slice(0, MAX_CUSTOM_MESSAGE))}
              rows={3}
              placeholder="e.g. Please collect your debit card at the branch with your ID."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <p className="text-xs text-gray-400 text-right">{customMessage.length}/{MAX_CUSTOM_MESSAGE}</p>
          </div>

          {preview && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">SMS preview</p>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{preview}</div>
            </div>
          )}

          {(customer.serviceNotifications || []).length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Previous notifications</p>
              <ul className="space-y-1 text-xs text-gray-500">
                {(customer.serviceNotifications || []).map((n, i) => (
                  <li key={i}>
                    {formatFormDate(n.sentAt)} · {n.sentBy} · {n.services.map(s => names[s] || s).join(', ')}
                    {n.smsSent ? '' : ' · SMS not delivered'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={sending}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || selected.length === 0}
            className="flex-[2] flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Mark as Created &amp; Send SMS
          </button>
        </div>
      </div>
    </div>
  );
}
