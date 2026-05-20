// CampaignsTab — Broadcast Campaign manager
// Sends bulk WhatsApp messages via /api/broadcast endpoint

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { Loader2, Send, Users, MessageSquare, CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface CampaignCustomer {
  id: string;
  name: string;
  phone: string;
  outstanding_amount: number;
}

interface CampaignsTabProps {
  bunkId: string;
  storeTables: { customers: string; salesTable?: string };
  webhookUrl: string;
  cronSecret: string;
}

const TEMPLATES = [
  {
    id: 'payment_reminder',
    label: 'Payment Reminder',
    template: (name: string, amount: number) =>
      `Hi ${name}, you have ₹${amount.toFixed(0)} outstanding. Please pay at earliest. Thank you.`,
    requiresAmount: true,
  },
  {
    id: 'new_offer',
    label: 'New Offer',
    template: () => '',
    requiresAmount: false,
  },
  {
    id: 'generic',
    label: 'Generic Message',
    template: () => '',
    requiresAmount: false,
  },
];

export function CampaignsTab({ bunkId, storeTables, webhookUrl, cronSecret }: CampaignsTabProps) {
  const [customers, setCustomers] = useState<CampaignCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'outstanding' | 'custom'>('all');
  const [customPhones, setCustomPhones] = useState('');
  const [templateId, setTemplateId] = useState('generic');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from(storeTables.customers)
      .select('id, name, phone, outstanding_amount')
      .eq('bunk_id', bunkId)
      .eq('is_active', true)
      .order('name');
    setCustomers((data as CampaignCustomer[]) || []);
    setLoading(false);
  }, [bunkId, storeTables.customers]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  // Derive recipients based on filter
  const recipients: CampaignCustomer[] = (() => {
    if (filter === 'outstanding') return customers.filter(c => c.outstanding_amount > 0);
    if (filter === 'custom') {
      const phones = customPhones.split(/[\n,]+/).map(p => p.trim()).filter(Boolean);
      return phones.map(p => ({ id: p, name: p, phone: p, outstanding_amount: 0 }));
    }
    return customers;
  })();

  const handleTemplateChange = (tid: string) => {
    setTemplateId(tid);
    setResult(null);
    const tmpl = TEMPLATES.find(t => t.id === tid);
    if (!tmpl) return;
    if (tid === 'payment_reminder') {
      // Preview with first customer who has outstanding
      const sample = customers.find(c => c.outstanding_amount > 0) || customers[0];
      if (sample) setMessage(tmpl.template(sample.name, sample.outstanding_amount));
    } else {
      setMessage('');
    }
  };

  const buildMessageFor = (customer: CampaignCustomer): string => {
    if (templateId === 'payment_reminder') {
      const tmpl = TEMPLATES[0];
      return tmpl.template(customer.name, customer.outstanding_amount);
    }
    return message;
  };

  const handleSend = async () => {
    if (!message.trim() && templateId !== 'payment_reminder') {
      setError('Please enter a message.');
      return;
    }
    if (recipients.length === 0) {
      setError('No recipients selected.');
      return;
    }
    if (recipients.length > 200) {
      setError('Maximum 200 recipients per broadcast.');
      return;
    }

    setSending(true);
    setError(null);
    setResult(null);

    try {
      // For payment_reminder, we personalize per recipient
      // For others, single message to all phones
      if (templateId === 'payment_reminder') {
        // Send personalized: group by phone and message pair, then POST
        let sent = 0; let failed = 0;
        for (const c of recipients) {
          const msg = buildMessageFor(c);
          try {
            const res = await fetch(`${webhookUrl}/api/broadcast`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ secret: cronSecret, bunk_id: bunkId, phones: [c.phone], message: msg }),
            });
            const data = await res.json();
            sent += data.sent || 0; failed += data.failed || 0;
          } catch { failed++; }
        }
        setResult({ sent, failed, total: recipients.length });
      } else {
        const phones = recipients.map(c => c.phone).filter(Boolean);
        const res = await fetch(`${webhookUrl}/api/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: cronSecret, bunk_id: bunkId, phones, message }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setResult({ sent: data.sent || 0, failed: data.failed || 0, total: data.total || phones.length });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const charCount = message.length;
  const msgCount = Math.ceil(charCount / 160) || 1;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
          <Send size={18} className="text-indigo-600" /> Broadcast Campaign
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">Send WhatsApp messages to your customers in bulk.</p>
      </div>

      {/* Recipients */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2"><Users size={15} /> Recipients</h3>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'all', label: 'All Active Customers' },
            { id: 'outstanding', label: 'Has Outstanding Balance' },
            { id: 'custom', label: 'Custom Phones' },
          ].map(opt => (
            <button key={opt.id} onClick={() => setFilter(opt.id as typeof filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${filter === opt.id ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
              {opt.label}
            </button>
          ))}
        </div>
        {filter === 'custom' && (
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
            rows={3}
            placeholder="Enter phone numbers separated by commas or newlines..."
            value={customPhones}
            onChange={e => setCustomPhones(e.target.value)}
          />
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 size={14} className="animate-spin" /> Loading customers...</div>
        ) : (
          <p className="text-sm text-gray-600">
            <span className="font-bold text-indigo-600">{recipients.length}</span> recipient(s) selected
            {filter === 'outstanding' && ` · total outstanding: ₹${customers.filter(c => c.outstanding_amount > 0).reduce((s, c) => s + c.outstanding_amount, 0).toLocaleString('en-IN')}`}
          </p>
        )}
      </div>

      {/* Template + Message */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2"><MessageSquare size={15} /> Message</h3>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Template</label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={templateId}
            onChange={e => handleTemplateChange(e.target.value)}
          >
            {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            Message {templateId === 'payment_reminder' ? '(preview — will be personalized per customer)' : ''}
          </label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
            rows={5}
            maxLength={4000}
            placeholder="Type your message here..."
            value={message}
            onChange={e => { setMessage(e.target.value); setResult(null); }}
            readOnly={templateId === 'payment_reminder'}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{charCount}/4000 chars</span>
            <span>~{msgCount} WhatsApp message{msgCount > 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* WhatsApp Preview */}
        {message && (
          <div className="bg-[#e5ddd5] rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1.5 font-medium">WhatsApp Preview</p>
            <div className="bg-white rounded-xl rounded-tl-none px-3 py-2 text-sm text-gray-800 max-w-xs shadow-sm whitespace-pre-wrap">{message}</div>
          </div>
        )}
      </div>

      {/* Send button */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />{error}
            <button className="ml-auto" onClick={() => setError(null)}><X size={14} /></button>
          </div>
        )}
        {result && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">
            <CheckCircle2 size={16} />
            <span>Sent: <b>{result.sent}</b> · Failed: <b>{result.failed}</b> · Total: <b>{result.total}</b></span>
          </div>
        )}
        <button
          onClick={handleSend}
          disabled={sending || loading || recipients.length === 0 || (!message.trim() && templateId !== 'payment_reminder')}
          className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {sending ? <><Loader2 size={15} className="animate-spin" /> Sending...</> : <><Send size={15} /> Send to {recipients.length} Recipient{recipients.length !== 1 ? 's' : ''}</>}
        </button>
        <p className="text-xs text-gray-400 text-center">Messages are rate-limited to ~80/min to comply with WhatsApp policies.</p>
      </div>
    </div>
  );
}
