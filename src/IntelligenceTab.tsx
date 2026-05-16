// ═══════════════════════════════════════════════════════════════════════════
// Smart Biz AI — Intelligence Tab  v2.0
// 5 sections: Overview · Customers · Agent Activity · Payment Calendar · Patterns
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, AlertTriangle, Users, Zap, BarChart2, RefreshCw, Loader2,
  ShieldAlert, Activity, Sparkles, ChevronRight, Star,
  CalendarClock, TrendingDown, TrendingUp, Bot, Clock, CheckCircle2,
  CircleDot, Bell,
} from 'lucide-react';
import { supabase } from './supabase';

interface Props { bunkId: string }

interface AgentMemory {
  id: string; key: string; value: string;
  mem_type: string; source: string; updated_at: string;
}
interface BotActivity {
  id?: string; action: string; detail: string;
  result: string; created_at: string;
}
interface CustomerRow {
  id: string; name: string; balance: number;
  last_payment: string | null; phone?: string;
}

function inr(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 9999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function computeRisk(c: CustomerRow): { grade: 'A'|'B'|'C'|'D'; risk: 'low'|'medium'|'high'|'critical'; score: number } {
  const days = daysSince(c.last_payment);
  let score = 100;
  if (days > 60) score -= 50; else if (days > 30) score -= 30; else if (days > 15) score -= 15;
  if (c.balance > 100000) score -= 20; else if (c.balance > 50000) score -= 10; else if (c.balance > 20000) score -= 5;
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 75 ? 'A' : score >= 50 ? 'B' : score >= 30 ? 'C' : 'D';
  const risk = score >= 75 ? 'low' : score >= 50 ? 'medium' : score >= 30 ? 'high' : 'critical';
  return { grade: grade as 'A'|'B'|'C'|'D', risk: risk as 'low'|'medium'|'high'|'critical', score };
}

const RISK = {
  low:      { badge: 'bg-green-100 text-green-700',   bar: 'bg-green-500',  dot: 'bg-green-500',  label: 'Low Risk' },
  medium:   { badge: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-400', dot: 'bg-yellow-400', label: 'Medium Risk' },
  high:     { badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500', dot: 'bg-orange-500', label: 'High Risk' },
  critical: { badge: 'bg-red-100 text-red-700',       bar: 'bg-red-600',   dot: 'bg-red-600',    label: 'Critical' },
};
const GRADE = {
  A: 'text-green-600 bg-green-50 border-green-200',
  B: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  C: 'text-orange-600 bg-orange-50 border-orange-200',
  D: 'text-red-600 bg-red-50 border-red-200',
};

function prettyKey(key: string) {
  return key.replace(/^(customer\.[^.]+\.|business\.)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function customerFromKey(key: string) {
  const m = key.match(/^customer\.(.+)\./); return m ? m[1] : null;
}

const ACTION_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  auto_reminders_sent: { icon: <Bell size={13} />,         color: 'bg-blue-100 text-blue-700',    label: 'Auto Reminders' },
  anomaly_alert:       { icon: <TrendingDown size={13} />, color: 'bg-red-100 text-red-700',      label: 'Sales Anomaly' },
  anomaly_spike:       { icon: <TrendingUp size={13} />,   color: 'bg-green-100 text-green-700',  label: 'Sales Spike' },
  goal_alert:          { icon: <CircleDot size={13} />,    color: 'bg-orange-100 text-orange-700',label: 'Goal Alert' },
  payment_commitment:  { icon: <CheckCircle2 size={13} />, color: 'bg-purple-100 text-purple-700',label: 'Commitment' },
  morning_push:        { icon: <Clock size={13} />,        color: 'bg-indigo-100 text-indigo-700',label: 'Morning Brief' },
  weekly_digest:       { icon: <BarChart2 size={13} />,    color: 'bg-teal-100 text-teal-700',    label: 'Weekly Digest' },
};

type Section = 'overview' | 'customers' | 'activity' | 'calendar' | 'patterns';

export function IntelligenceTab({ bunkId }: Props) {
  const [memories, setMemories]     = useState<AgentMemory[]>([]);
  const [customers, setCustomers]   = useState<CustomerRow[]>([]);
  const [activities, setActivities] = useState<BotActivity[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [section, setSection]       = useState<Section>('overview');

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    const [memRes, custRes, actRes] = await Promise.all([
      supabase.from('agent_memory').select('id,key,value,mem_type,source,updated_at')
        .eq('bunk_id', bunkId).order('updated_at', { ascending: false }).limit(120),
      supabase.from('customers').select('id,name,balance,last_payment,phone')
        .eq('bunk_id', bunkId).gt('balance', 0).order('balance', { ascending: false }).limit(60),
      supabase.from('bot_activity_log').select('action,detail,result,created_at')
        .eq('bunk_id', bunkId).order('created_at', { ascending: false }).limit(30),
    ]);
    if (memRes.data) setMemories(memRes.data as AgentMemory[]);
    if (custRes.data) setCustomers(custRes.data as CustomerRow[]);
    if (actRes.data) setActivities(actRes.data as BotActivity[]);
    setLoading(false); setRefreshing(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  // Subscribe to real-time bot activity
  useEffect(() => {
    const channel = supabase.channel(`bot-activity-${bunkId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bot_activity_log', filter: `bunk_id=eq.${bunkId}` },
        payload => setActivities(prev => [payload.new as BotActivity, ...prev].slice(0, 30)))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bunkId]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 size={28} className="animate-spin mr-3" />
      <span className="text-sm">Loading AI intelligence…</span>
    </div>
  );

  const memsByType = memories.reduce<{ customers: AgentMemory[]; business: AgentMemory[]; alerts: AgentMemory[] }>(
    (acc, m) => {
      if (m.mem_type === 'alert') acc.alerts.push(m);
      else if (m.key.startsWith('customer.')) acc.customers.push(m);
      else acc.business.push(m);
      return acc;
    }, { customers: [], business: [], alerts: [] }
  );

  const rankedCustomers = customers.map(c => ({ ...c, ...computeRisk(c) }));
  const criticalCount   = rankedCustomers.filter(c => c.risk === 'critical').length;
  const totalOwed       = customers.reduce((s, c) => s + c.balance, 0);
  const overdue30       = customers.filter(c => daysSince(c.last_payment) >= 30);

  // Payment calendar predictions from memory
  const calendarPreds = memsByType.customers
    .filter(m => m.key.includes('.payment_cycle'))
    .map(m => {
      const custName = customerFromKey(m.key);
      const cust = customers.find(c => c.name === custName);
      if (!cust || cust.balance <= 0 || !cust.last_payment) return null;
      const cycleMatch = m.value.match(/(\d+)/);
      if (!cycleMatch) return null;
      const cycleDays = parseInt(cycleMatch[1]);
      const expectedMs = new Date(cust.last_payment).getTime() + cycleDays * 86400000;
      const daysUntil = Math.round((expectedMs - Date.now()) / 86400000);
      if (daysUntil < -5 || daysUntil > 14) return null;
      return { name: cust.name, balance: cust.balance, daysUntil, cycleDays, expectedDate: new Date(expectedMs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) };
    }).filter(Boolean).sort((a, b) => a!.daysUntil - b!.daysUntil) as { name: string; balance: number; daysUntil: number; cycleDays: number; expectedDate: string }[];

  const SECTIONS: { id: Section; label: string; badge?: number }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'customers', label: 'Customers', badge: criticalCount > 0 ? criticalCount : undefined },
    { id: 'activity',  label: 'Bot Activity', badge: activities.length > 0 ? activities.length : undefined },
    { id: 'calendar',  label: 'Pay Calendar', badge: calendarPreds.filter(p => p.daysUntil <= 3).length || undefined },
    { id: 'patterns',  label: 'Patterns' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-md">
            <Brain size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">AI Intelligence</h1>
            <p className="text-xs text-gray-500">{memories.length} facts · {activities.length} autonomous actions · {customers.length} customers</p>
          </div>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-indigo-300 bg-white transition">
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Section nav — scrollable on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${section === s.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
            {s.label}
            {s.badge ? <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${section === s.id ? 'bg-white/30 text-white' : 'bg-red-500 text-white'}`}>{s.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ────────────────────────────────────────────────────── */}
      {section === 'overview' && (
        <div className="space-y-4">
          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Outstanding', value: inr(totalOwed), sub: `${customers.length} customers`, color: '' },
              { label: 'Critical Risk', value: String(criticalCount), sub: `+${rankedCustomers.filter(c=>c.risk==='high').length} high`, color: criticalCount > 0 ? 'bg-red-50 border-red-200' : '' },
              { label: 'Overdue 30d+', value: String(overdue30.length), sub: inr(overdue30.reduce((s,c)=>s+c.balance,0)) + ' pending', color: overdue30.length > 0 ? 'bg-orange-50 border-orange-200' : '' },
              { label: 'AI Facts Learned', value: String(memories.length), sub: `${memsByType.alerts.length} active alerts`, color: 'bg-indigo-50 border-indigo-200' },
            ].map((kpi, i) => (
              <div key={i} className={`rounded-xl border p-4 ${kpi.color || 'bg-white border-gray-200'}`}>
                <p className="text-xs text-gray-500 mb-0.5">{kpi.label}</p>
                <p className={`text-xl font-black ${i === 3 ? 'text-indigo-600' : i === 1 && criticalCount > 0 ? 'text-red-600' : i === 2 && overdue30.length > 0 ? 'text-orange-600' : 'text-gray-900'}`}>{kpi.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Active alerts from agent memory */}
          {memsByType.alerts.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
                <ShieldAlert size={15} className="text-red-600" />
                <h3 className="text-sm font-semibold text-red-700">Active AI Alerts</h3>
                <span className="ml-auto bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">{memsByType.alerts.length}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {memsByType.alerts.map(m => (
                  <div key={m.id} className="px-4 py-3 flex items-start gap-3">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700">{customerFromKey(m.key) || prettyKey(m.key)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{m.value}</p>
                    </div>
                    <p className="text-xs text-gray-400 shrink-0">{new Date(m.updated_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Latest bot action */}
          {activities.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Bot size={15} className="text-indigo-500" />
                <h3 className="text-sm font-semibold text-gray-700">Latest Agent Action</h3>
                <button onClick={() => setSection('activity')} className="ml-auto flex items-center gap-0.5 text-xs text-indigo-600 hover:underline">
                  See all <ChevronRight size={12} />
                </button>
              </div>
              {(() => {
                const latest = activities[0];
                const meta = ACTION_META[latest.action] || { icon: <Zap size={13}/>, color: 'bg-gray-100 text-gray-600', label: latest.action };
                return (
                  <div className="px-4 py-4 flex items-start gap-3">
                    <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium shrink-0 ${meta.color}`}>
                      {meta.icon} {meta.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">{latest.detail}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(latest.created_at).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* At-risk preview */}
          {rankedCustomers.filter(c => c.risk !== 'low').length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Activity size={15} className="text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-700">Customers Needing Attention</h3>
                <button onClick={() => setSection('customers')} className="ml-auto flex items-center gap-0.5 text-xs text-indigo-600 hover:underline">
                  View all <ChevronRight size={12} />
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {rankedCustomers.filter(c => c.risk !== 'low').slice(0, 5).map(c => {
                  const s = RISK[c.risk];
                  return (
                    <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border shrink-0 ${GRADE[c.grade]}`}>{c.grade}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                            <div className={`h-full ${s.bar} rounded-full`} style={{ width: `${c.score}%` }} />
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${s.badge}`}>{s.label}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">{inr(c.balance)}</p>
                        <p className="text-xs text-gray-400">{daysSince(c.last_payment) === 9999 ? 'Never' : `${daysSince(c.last_payment)}d ago`}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {memories.length === 0 && activities.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <Sparkles size={36} className="text-indigo-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">AI is warming up</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Record a few transactions via WhatsApp. The AI will start learning your business and filling this dashboard automatically.</p>
            </div>
          )}
        </div>
      )}

      {/* ── CUSTOMERS ─────────────────────────────────────────────────── */}
      {section === 'customers' && (
        <div className="space-y-3">
          {customers.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Users size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No customers with outstanding balances.</p>
            </div>
          ) : rankedCustomers.map(c => {
            const s = RISK[c.risk];
            const custMems = memsByType.customers.filter(m => customerFromKey(m.key) === c.name);
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border shrink-0 ${GRADE[c.grade]}`}>{c.grade}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900 text-sm">{c.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badge}`}>{s.label}</span>
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span>Score: <b className="text-gray-700">{c.score}/100</b></span>
                        <span>Last paid: <b className="text-gray-700">{daysSince(c.last_payment) === 9999 ? 'Never' : `${daysSince(c.last_payment)}d ago`}</b></span>
                        {c.phone && <span className="text-green-600">📱 Has phone</span>}
                      </div>
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${s.bar} transition-all`} style={{ width: `${c.score}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-black text-gray-900">{inr(c.balance)}</p>
                      <p className="text-xs text-gray-400">outstanding</p>
                    </div>
                  </div>
                  {custMems.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                      {custMems.map(m => (
                        <div key={m.id} className="flex items-start gap-2">
                          <Brain size={11} className="text-indigo-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-gray-500">
                            <span className="font-medium text-gray-600">{prettyKey(m.key)}:</span> {m.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── BOT ACTIVITY ──────────────────────────────────────────────── */}
      {section === 'activity' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </div>
            <p className="text-xs text-gray-500 font-medium">Live feed — updates in real-time as the agent acts</p>
          </div>

          {activities.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Bot size={32} className="text-indigo-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">No autonomous actions yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">The bot logs every automated action here — reminders it sends, anomalies it detects, briefings it delivers. Create the <code className="bg-gray-100 px-1 rounded">bot_activity_log</code> table in Supabase to activate this.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {activities.map((a, i) => {
                  const meta = ACTION_META[a.action] || { icon: <Zap size={13}/>, color: 'bg-gray-100 text-gray-600', label: a.action.replace(/_/g, ' ') };
                  return (
                    <div key={i} className="px-4 py-3.5 flex items-start gap-3">
                      <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium shrink-0 mt-0.5 ${meta.color}`}>
                        {meta.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-semibold text-gray-700">{meta.label}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${a.result === 'ok' || a.result?.includes('sent') ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>{a.result}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{a.detail}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(a.created_at).toLocaleString('en-IN', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PAYMENT CALENDAR ──────────────────────────────────────────── */}
      {section === 'calendar' && (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
            <CalendarClock size={18} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-indigo-800">AI Payment Predictions</p>
              <p className="text-xs text-indigo-600 mt-0.5">Based on each customer's historical payment cycle. The bot learns from every payment recorded.</p>
            </div>
          </div>

          {calendarPreds.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <CalendarClock size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">No predictions yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Payment predictions appear after the AI learns customer payment cycles. This happens automatically after a few payments are recorded.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <CalendarClock size={15} className="text-indigo-500" />
                <h3 className="text-sm font-semibold text-gray-700">Expected Payments — Next 14 Days</h3>
                <span className="ml-auto text-xs text-gray-400">
                  {inr(calendarPreds.filter(p => p.daysUntil >= 0 && p.daysUntil <= 7).reduce((s, p) => s + p.balance, 0))} this week
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {calendarPreds.map((p, i) => {
                  const isOverdue = p.daysUntil < 0;
                  const isToday   = p.daysUntil === 0;
                  const isSoon    = p.daysUntil > 0 && p.daysUntil <= 3;
                  const icon = isOverdue ? '🔴' : isToday ? '⚡' : isSoon ? '🟡' : '🟢';
                  const dayLabel = isOverdue ? `${Math.abs(p.daysUntil)}d overdue` : isToday ? 'TODAY' : `in ${p.daysUntil}d (${p.expectedDate})`;
                  return (
                    <div key={i} className={`px-4 py-3.5 flex items-center gap-3 ${isOverdue ? 'bg-red-50/40' : isToday ? 'bg-yellow-50/40' : ''}`}>
                      <span className="text-base shrink-0">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-500">Expected: <b className={isOverdue ? 'text-red-600' : isToday ? 'text-yellow-700' : 'text-gray-700'}>{dayLabel}</b> · pays every ~{p.cycleDays}d</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900 shrink-0">{inr(p.balance)}</p>
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-500">{calendarPreds.length} predictions</p>
                <p className="text-xs font-semibold text-indigo-600">
                  {inr(calendarPreds.reduce((s, p) => s + p.balance, 0))} total expected
                </p>
              </div>
            </div>
          )}

          {/* Overdue without predictions */}
          {overdue30.filter(c => !calendarPreds.find(p => p.name === c.name)).length > 0 && (
            <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
              <div className="px-4 py-3 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
                <AlertTriangle size={15} className="text-orange-600" />
                <h3 className="text-sm font-semibold text-orange-700">Overdue — No Pattern Data</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {overdue30.filter(c => !calendarPreds.find(p => p.name === c.name)).slice(0, 8).map(c => (
                  <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-sm">🔴</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-500">{daysSince(c.last_payment) === 9999 ? 'Never paid' : `${daysSince(c.last_payment)} days overdue`}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{inr(c.balance)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PATTERNS ──────────────────────────────────────────────────── */}
      {section === 'patterns' && (
        <div className="space-y-4">
          {memsByType.business.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                <BarChart2 size={15} className="text-indigo-600" />
                <h3 className="text-sm font-semibold text-indigo-700">Business Intelligence</h3>
                <span className="ml-auto text-xs text-indigo-400">{memsByType.business.length} facts</span>
              </div>
              <div className="divide-y divide-gray-100">
                {memsByType.business.map(m => (
                  <div key={m.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <Zap size={12} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700">{prettyKey(m.key)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{m.value}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${m.mem_type === 'pattern' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>{m.mem_type}</span>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(m.updated_at).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {memsByType.customers.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                <Users size={15} className="text-blue-600" />
                <h3 className="text-sm font-semibold text-blue-700">Customer Patterns</h3>
                <span className="ml-auto text-xs text-blue-400">{memsByType.customers.length} facts</span>
              </div>
              <div className="divide-y divide-gray-100">
                {memsByType.customers.map(m => (
                  <div key={m.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Star size={12} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-600">{customerFromKey(m.key)}</p>
                      <p className="text-xs text-gray-500 mt-0.5"><span className="text-gray-400">{prettyKey(m.key)}:</span> {m.value}</p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${m.mem_type === 'alert' ? 'bg-red-100 text-red-600' : m.mem_type === 'pattern' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>{m.mem_type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {memories.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Brain size={32} className="text-indigo-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">No patterns learned yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">After 5–10 transactions via WhatsApp, the AI automatically learns patterns and fills this section.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
