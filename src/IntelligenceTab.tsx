// ═══════════════════════════════════════════════════════════════════════════
// Smart Biz AI — Intelligence Tab
// Shows agent memory, customer risk cards, business patterns, AI alerts
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Clock, Users, Zap, Target, BarChart2, RefreshCw, Loader2,
  ArrowUpRight, Star, ShieldAlert, Activity, Sparkles, ChevronRight,
} from 'lucide-react';
import { supabase } from './supabase';

interface Props {
  bunkId: string;
}

interface AgentMemory {
  id: string;
  key: string;
  value: string;
  mem_type: string;
  source: string;
  updated_at: string;
}

interface CustomerRisk {
  id: string;
  name: string;
  balance: number;
  last_payment: string | null;
  daysSincePay: number;
  grade: 'A' | 'B' | 'C' | 'D';
  risk: 'low' | 'medium' | 'high' | 'critical';
  creditScore: number;
}

function inr(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function computeRisk(c: { balance: number; last_payment: string | null }): { grade: 'A' | 'B' | 'C' | 'D'; risk: 'low' | 'medium' | 'high' | 'critical'; score: number; daysSince: number } {
  const daysSince = c.last_payment
    ? Math.floor((Date.now() - new Date(c.last_payment).getTime()) / 86400000)
    : 999;
  let score = 100;
  if (daysSince > 60) score -= 50;
  else if (daysSince > 30) score -= 30;
  else if (daysSince > 15) score -= 15;
  if (c.balance > 100000) score -= 20;
  else if (c.balance > 50000) score -= 10;
  else if (c.balance > 20000) score -= 5;
  score = Math.max(0, Math.min(100, score));
  const grade: 'A' | 'B' | 'C' | 'D' = score >= 75 ? 'A' : score >= 50 ? 'B' : score >= 30 ? 'C' : 'D';
  const risk: 'low' | 'medium' | 'high' | 'critical' = score >= 75 ? 'low' : score >= 50 ? 'medium' : score >= 30 ? 'high' : 'critical';
  return { grade, risk, score, daysSince };
}

const RISK_STYLES = {
  low:      { badge: 'bg-green-100 text-green-700',  bar: 'bg-green-500',  label: 'Low Risk' },
  medium:   { badge: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-400', label: 'Medium Risk' },
  high:     { badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500', label: 'High Risk' },
  critical: { badge: 'bg-red-100 text-red-700',       bar: 'bg-red-600',    label: 'Critical' },
};

const GRADE_STYLES = {
  A: 'text-green-600 bg-green-50 border-green-200',
  B: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  C: 'text-orange-600 bg-orange-50 border-orange-200',
  D: 'text-red-600 bg-red-50 border-red-200',
};

function groupMemories(memories: AgentMemory[]) {
  const customers: AgentMemory[] = [];
  const business: AgentMemory[] = [];
  const alerts: AgentMemory[] = [];
  for (const m of memories) {
    if (m.mem_type === 'alert') alerts.push(m);
    else if (m.key.startsWith('customer.')) customers.push(m);
    else business.push(m);
  }
  return { customers, business, alerts };
}

function prettyKey(key: string) {
  return key.replace(/^(customer\.[^.]+\.|business\.)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function customerFromKey(key: string) {
  const m = key.match(/^customer\.(.+)\./);
  return m ? m[1] : null;
}

export function IntelligenceTab({ bunkId }: Props) {
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [customers, setCustomers] = useState<CustomerRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<'overview' | 'customers' | 'patterns'>('overview');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const [memRes, custRes] = await Promise.all([
      supabase
        .from('agent_memory')
        .select('id,key,value,mem_type,source,updated_at')
        .eq('bunk_id', bunkId)
        .order('updated_at', { ascending: false })
        .limit(100),
      supabase
        .from('customers')
        .select('id,name,balance,last_payment')
        .eq('bunk_id', bunkId)
        .gt('balance', 0)
        .order('balance', { ascending: false })
        .limit(50),
    ]);

    if (memRes.data) setMemories(memRes.data as AgentMemory[]);
    if (custRes.data) {
      setCustomers(custRes.data.map(c => {
        const r = computeRisk(c);
        return {
          id: c.id,
          name: c.name,
          balance: c.balance || 0,
          last_payment: c.last_payment,
          daysSincePay: r.daysSince,
          grade: r.grade,
          risk: r.risk,
          creditScore: r.score,
        };
      }));
    }
    setLoading(false);
    setRefreshing(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={28} className="animate-spin mr-3" />
        <span className="text-sm">Loading intelligence data…</span>
      </div>
    );
  }

  const { customers: custMems, business: bizMems, alerts: alertMems } = groupMemories(memories);
  const criticalCount = customers.filter(c => c.risk === 'critical').length;
  const highCount = customers.filter(c => c.risk === 'high').length;
  const totalOutstanding = customers.reduce((s, c) => s + c.balance, 0);
  const overdueCustomers = customers.filter(c => c.daysSincePay >= 30);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow">
            <Brain size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">AI Intelligence</h1>
            <p className="text-xs text-gray-500">{memories.length} learned facts · {customers.length} customers tracked</p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition px-3 py-1.5 rounded-lg border border-gray-200 hover:border-indigo-300 bg-white"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Section pills */}
      <div className="flex gap-2">
        {(['overview', 'customers', 'patterns'] as const).map(s => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeSection === s ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}
          >
            {s === 'overview' ? 'Overview' : s === 'customers' ? `Customers${criticalCount > 0 ? ` (${criticalCount}⚠)` : ''}` : 'Patterns'}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {activeSection === 'overview' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Outstanding</p>
              <p className="text-xl font-black text-gray-900">{inr(totalOutstanding)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{customers.length} customers</p>
            </div>
            <div className={`rounded-xl border p-4 ${criticalCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <p className="text-xs text-gray-500 mb-1">Critical Risk</p>
              <p className={`text-xl font-black ${criticalCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{criticalCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">+ {highCount} high risk</p>
            </div>
            <div className={`rounded-xl border p-4 ${overdueCustomers.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
              <p className="text-xs text-gray-500 mb-1">Overdue 30d+</p>
              <p className={`text-xl font-black ${overdueCustomers.length > 0 ? 'text-orange-600' : 'text-gray-900'}`}>{overdueCustomers.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">{inr(overdueCustomers.reduce((s, c) => s + c.balance, 0))} pending</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">AI Facts Learned</p>
              <p className="text-xl font-black text-indigo-600">{memories.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">{alertMems.length} active alerts</p>
            </div>
          </div>

          {/* Active alerts */}
          {alertMems.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
                <ShieldAlert size={15} className="text-red-600" />
                <h3 className="text-sm font-semibold text-red-700">Active Alerts</h3>
                <span className="ml-auto text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">{alertMems.length}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {alertMems.map(m => (
                  <div key={m.id} className="px-4 py-3 flex items-start gap-3">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700">{customerFromKey(m.key) || prettyKey(m.key)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{m.value}</p>
                    </div>
                    <p className="text-xs text-gray-400 shrink-0">{new Date(m.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top at-risk customers preview */}
          {customers.filter(c => c.risk !== 'low').length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Activity size={15} className="text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-700">Customers Needing Attention</h3>
                <button onClick={() => setActiveSection('customers')} className="ml-auto flex items-center gap-0.5 text-xs text-indigo-600 hover:underline">
                  View all <ChevronRight size={12} />
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {customers.filter(c => c.risk !== 'low').slice(0, 5).map(c => {
                  const s = RISK_STYLES[c.risk];
                  return (
                    <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border ${GRADE_STYLES[c.grade]}`}>{c.grade}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                            <div className={`h-full ${s.bar} rounded-full`} style={{ width: `${c.creditScore}%` }} />
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${s.badge}`}>{s.label}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">{inr(c.balance)}</p>
                        <p className="text-xs text-gray-400">{c.daysSincePay === 999 ? 'Never paid' : `${c.daysSincePay}d ago`}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {memories.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Sparkles size={32} className="text-indigo-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">AI is learning your business</p>
              <p className="text-xs text-gray-400 mt-1">Patterns appear here after the bot processes a few transactions. Try recording a credit sale or payment via WhatsApp.</p>
            </div>
          )}
        </div>
      )}

      {/* ── CUSTOMERS ── */}
      {activeSection === 'customers' && (
        <div className="space-y-3">
          {customers.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Users size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No customers with outstanding balances.</p>
            </div>
          ) : (
            customers.map(c => {
              const s = RISK_STYLES[c.risk];
              const custMemList = custMems.filter(m => customerFromKey(m.key) === c.name);
              return (
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border shrink-0 ${GRADE_STYLES[c.grade]}`}>{c.grade}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900 text-sm">{c.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badge}`}>{s.label}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                          <span>Score: <b className="text-gray-700">{c.creditScore}/100</b></span>
                          <span>Last paid: <b className="text-gray-700">{c.daysSincePay === 999 ? 'Never' : `${c.daysSincePay} days ago`}</b></span>
                        </div>
                        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${s.bar} rounded-full transition-all`} style={{ width: `${c.creditScore}%` }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-black text-gray-900">{inr(c.balance)}</p>
                        <p className="text-xs text-gray-400">outstanding</p>
                      </div>
                    </div>

                    {/* AI learned facts for this customer */}
                    {custMemList.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                        {custMemList.map(m => (
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
            })
          )}
        </div>
      )}

      {/* ── PATTERNS ── */}
      {activeSection === 'patterns' && (
        <div className="space-y-4">
          {/* Business patterns */}
          {bizMems.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                <BarChart2 size={15} className="text-indigo-600" />
                <h3 className="text-sm font-semibold text-indigo-700">Business Intelligence</h3>
                <span className="ml-auto text-xs text-indigo-500">{bizMems.length} patterns</span>
              </div>
              <div className="divide-y divide-gray-100">
                {bizMems.map(m => (
                  <div key={m.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <Zap size={12} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700">{prettyKey(m.key)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{m.value}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${m.mem_type === 'pattern' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                        {m.mem_type}
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(m.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer patterns */}
          {custMems.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                <Users size={15} className="text-blue-600" />
                <h3 className="text-sm font-semibold text-blue-700">Customer Patterns</h3>
                <span className="ml-auto text-xs text-blue-500">{custMems.length} facts</span>
              </div>
              <div className="divide-y divide-gray-100">
                {custMems.map(m => (
                  <div key={m.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Star size={12} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-600">{customerFromKey(m.key)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className="text-gray-400">{prettyKey(m.key)}:</span> {m.value}
                      </p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${m.mem_type === 'alert' ? 'bg-red-100 text-red-600' : m.mem_type === 'pattern' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                      {m.mem_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {memories.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Brain size={32} className="text-indigo-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">No patterns learned yet</p>
              <p className="text-xs text-gray-400 mt-1">The AI learns from every WhatsApp transaction. After 5–10 credit sales, patterns appear here automatically.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
