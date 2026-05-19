// ═══════════════════════════════════════════════════════════════════════════
// Smart Biz AI — Intelligence Tab  v3.0  (BREAKTHROUGH EDITION)
// 6 sections: Overview · Financial Health · Customers · Bot Activity · Pay Calendar · Patterns
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, AlertTriangle, Users, Zap, BarChart2, RefreshCw, Loader2,
  ShieldAlert, Activity, Sparkles, ChevronRight, Star,
  CalendarClock, TrendingDown, TrendingUp, Bot, Clock, CheckCircle2,
  CircleDot, Bell, DollarSign, PieChart, Package, Award, ArrowUpRight, ArrowDownRight,
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

// ── Financial Health types ────────────────────────────────────────────────
interface FinancialHealth {
  revenue30:      number;
  expenses30:     number;
  grossProfit:    number;
  grossMarginPct: number;
  avgDailySales:  number;
  totalOutstanding: number;
  dso:            number;
  creditPct:      number;
  stockValue:     number;
  revenueGrowthPct: number;
  healthScore:    number;
  healthGrade:    'A' | 'B' | 'C' | 'D' | 'F';
  stockAlerts:    { name: string; daysLeft: number; stock: number; unit: string }[];
  expenseByCategory: Record<string, number>;
}

// Industry benchmarks (mirrors backend STORE_BENCHMARKS)
const BENCHMARKS: Record<string, { gross_margin_pct: number; dso_days: number; label: string }> = {
  fuel:       { gross_margin_pct: 3,  dso_days: 15,  label: 'Fuel Station'    },
  kirana:     { gross_margin_pct: 15, dso_days: 10,  label: 'Kirana Store'    },
  medical:    { gross_margin_pct: 22, dso_days: 7,   label: 'Medical Shop'    },
  hardware:   { gross_margin_pct: 28, dso_days: 30,  label: 'Hardware Store'  },
  restaurant: { gross_margin_pct: 65, dso_days: 0,   label: 'Restaurant'      },
  textile:    { gross_margin_pct: 45, dso_days: 15,  label: 'Textile Shop'    },
  auto_parts: { gross_margin_pct: 32, dso_days: 30,  label: 'Auto Parts'      },
  agriculture:{ gross_margin_pct: 20, dso_days: 30,  label: 'Agriculture'     },
  stationery: { gross_margin_pct: 32, dso_days: 15,  label: 'Stationery'      },
  cement:     { gross_margin_pct: 10, dso_days: 45,  label: 'Cement Depot'    },
  electrical: { gross_margin_pct: 28, dso_days: 30,  label: 'Electrical'      },
  general:    { gross_margin_pct: 20, dso_days: 30,  label: 'General Store'   },
};

const PREFIX_MAP: Record<string, string> = {
  kirana: 'ki', medical: 'med', hardware: 'hw', restaurant: 'rst',
  auto_parts: 'ap', agriculture: 'ag', textile: 'tx', stationery: 'st',
  cement: 'cem', electrical: 'elec', general: 'gen',
};

async function computeFinancialHealth(bunkId: string, bizType: string): Promise<FinancialHealth> {
  const now = Date.now();
  const since    = new Date(now - 30 * 86400000).toISOString().substring(0, 10);
  const priorEnd = since;
  const priorStart = new Date(now - 60 * 86400000).toISOString().substring(0, 10);
  const bench = BENCHMARKS[bizType] || BENCHMARKS.general;
  const prefix = PREFIX_MAP[bizType];

  let revenue30 = 0, revenuePrior = 0, creditRevenue = 0, expenses30 = 0;
  const expenseByCategory: Record<string, number> = {};
  let stockValue = 0;
  const stockAlerts: { name: string; daysLeft: number; stock: number; unit: string }[] = [];

  if (bizType === 'fuel' || !prefix) {
    // Fuel store: use transactions + expenses tables
    const [txRes, expRes, priorTxRes] = await Promise.all([
      supabase.from('transactions').select('type, amount, payment_mode').eq('bunk_id', bunkId).gte('date', since),
      supabase.from('expenses').select('amount, category').eq('bunk_id', bunkId).gte('date', since),
      supabase.from('transactions').select('type, amount').eq('bunk_id', bunkId).gte('date', priorStart).lt('date', priorEnd),
    ]);
    (txRes.data || []).forEach((t: any) => {
      if (t.type === 'credit_sale' || t.type === 'cash_sale') {
        revenue30 += Number(t.amount || 0);
        if (t.type === 'credit_sale') creditRevenue += Number(t.amount || 0);
      }
    });
    (priorTxRes.data || []).forEach((t: any) => {
      if (t.type === 'credit_sale' || t.type === 'cash_sale') revenuePrior += Number(t.amount || 0);
    });
    (expRes.data || []).forEach((e: any) => {
      expenses30 += Number(e.amount || 0);
      const cat = e.category || 'General';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(e.amount || 0);
    });
  } else {
    // Non-fuel: use {prefix}_sales + {prefix}_expenses + {prefix}_products
    const [salesRes, expRes, prodRes, saleVelRes, priorSalesRes] = await Promise.all([
      supabase.from(`${prefix}_sales`).select('total_amount, payment_mode').eq('bunk_id', bunkId).gte('sale_date', since),
      supabase.from(`${prefix}_expenses`).select('amount, category').eq('bunk_id', bunkId).gte('exp_date', since),
      supabase.from(`${prefix}_products`).select('name, price, stock_qty, unit').eq('bunk_id', bunkId).eq('is_active', true).limit(100),
      supabase.from(`${prefix}_sales`).select('product_name, qty, sale_date').eq('bunk_id', bunkId).gte('sale_date', since),
      supabase.from(`${prefix}_sales`).select('total_amount').eq('bunk_id', bunkId).gte('sale_date', priorStart).lt('sale_date', priorEnd),
    ]);

    (salesRes.data || []).forEach((s: any) => {
      revenue30 += Number(s.total_amount || 0);
      if ((s.payment_mode || '').toLowerCase() === 'credit') creditRevenue += Number(s.total_amount || 0);
    });
    (priorSalesRes.data || []).forEach((s: any) => { revenuePrior += Number(s.total_amount || 0); });
    (expRes.data || []).forEach((e: any) => {
      expenses30 += Number(e.amount || 0);
      const cat = e.category || 'General';
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(e.amount || 0);
    });

    // Stock value + stockout prediction
    const velocity: Record<string, { qty: number; days: Set<string> }> = {};
    (saleVelRes.data || []).forEach((s: any) => {
      if (!s.product_name) return;
      if (!velocity[s.product_name]) velocity[s.product_name] = { qty: 0, days: new Set() };
      velocity[s.product_name].qty += Number(s.qty || 1);
      velocity[s.product_name].days.add((s.sale_date || '').substring(0, 10));
    });

    (prodRes.data || []).forEach((p: any) => {
      stockValue += Number(p.stock_qty || 0) * Number(p.price || 0);
      const v = velocity[p.name];
      if (v && v.days.size > 0) {
        const daily = v.qty / v.days.size;
        const stock = Number(p.stock_qty || 0);
        const daysLeft = daily > 0 ? Math.round(stock / daily) : null;
        if (daysLeft !== null && daysLeft <= 10) {
          stockAlerts.push({ name: p.name, daysLeft, stock, unit: p.unit || 'pcs' });
        }
      }
    });
    stockAlerts.sort((a, b) => a.daysLeft - b.daysLeft);
  }

  // Compute derived metrics
  const grossProfit = revenue30 - expenses30;
  const grossMarginPct = revenue30 > 0 ? Math.round(grossProfit / revenue30 * 1000) / 10 : 0;
  const avgDailySales = Math.round(revenue30 / 30);
  const creditPct = revenue30 > 0 ? Math.round(creditRevenue / revenue30 * 100) : 0;

  // Health score components (mirrors backend)
  const marginScore = bench.gross_margin_pct > 0
    ? Math.min(100, Math.round(grossMarginPct / bench.gross_margin_pct * 85)) : 50;
  const revenueGrowthPct = revenuePrior > 0
    ? Math.round(((revenue30 - revenuePrior) / revenuePrior) * 100) : 0;
  const growthScore = Math.min(100, Math.max(0, 50 + revenueGrowthPct * 0.5));
  const liquidityScore = expenses30 > 0 ? Math.min(100, Math.round((revenue30 - creditRevenue) / expenses30 * 70)) : 70;

  const healthScore = Math.round(marginScore * 0.40 + growthScore * 0.30 + liquidityScore * 0.30);
  const grade = healthScore >= 80 ? 'A' : healthScore >= 65 ? 'B' : healthScore >= 50 ? 'C' : healthScore >= 35 ? 'D' : 'F';

  // Outstanding (reuse customers data already fetched elsewhere — will be passed in)
  const { data: custData } = await supabase.from(
    bizType === 'fuel' ? 'customers' : `${prefix}_customers`
  ).select('outstanding_amount').eq('bunk_id', bunkId).gt('outstanding_amount', 0);
  const totalOutstanding = (custData || []).reduce((s: number, c: any) => s + Number(c.outstanding_amount || 0), 0);
  const dso = avgDailySales > 0 ? Math.round(totalOutstanding / avgDailySales) : 0;

  return {
    revenue30, expenses30, grossProfit, grossMarginPct,
    avgDailySales, totalOutstanding, dso, creditPct, stockValue,
    revenueGrowthPct, healthScore, healthGrade: grade as 'A'|'B'|'C'|'D'|'F',
    stockAlerts, expenseByCategory,
  };
}

type Section = 'overview' | 'finance' | 'customers' | 'activity' | 'calendar' | 'patterns';

export function IntelligenceTab({ bunkId }: Props) {
  const [memories, setMemories]       = useState<AgentMemory[]>([]);
  const [customers, setCustomers]     = useState<CustomerRow[]>([]);
  const [activities, setActivities]   = useState<BotActivity[]>([]);
  const [finance, setFinance]         = useState<FinancialHealth | null>(null);
  const [financeLoading, setFLoading] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [section, setSection]         = useState<Section>('overview');

  // Stable bizType — read once on mount to avoid localStorage reads on every render
  const [bizType] = useState<string>(() => localStorage.getItem('app_biz_type') || 'fuel');

  const loadFinance = useCallback(async () => {
    setFLoading(true);
    try {
      const fh = await computeFinancialHealth(bunkId, bizType);
      setFinance(fh);
    } catch (e) {
      console.error('Financial health load failed', e);
    }
    setFLoading(false);
  }, [bunkId, bizType]);

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

  useEffect(() => { load(); loadFinance(); }, [load, loadFinance]);

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

  const stockBadge = finance?.stockAlerts.filter(s => s.daysLeft <= 3).length || undefined;
  const SECTIONS: { id: Section; label: string; badge?: number }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'finance',   label: '💰 Financial Health', badge: stockBadge },
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

      {/* ── FINANCIAL HEALTH (BREAKTHROUGH SECTION) ────────────────────── */}
      {section === 'finance' && (
        <div className="space-y-4">
          {/* Refresh button */}
          <div className="flex justify-end">
            <button onClick={loadFinance} disabled={financeLoading}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50">
              <RefreshCw size={13} className={financeLoading ? 'animate-spin' : ''} />
              {financeLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {financeLoading && !finance ? (
            <div className="flex items-center justify-center h-40 text-gray-400">
              <Loader2 size={24} className="animate-spin mr-2" />
              <span className="text-sm">Computing financial health from live data…</span>
            </div>
          ) : finance ? (() => {
            const bench = BENCHMARKS[bizType] || BENCHMARKS.general;
            const marginOk = finance.grossMarginPct >= bench.gross_margin_pct;
            const dsoOk = bench.dso_days === 0 || finance.dso <= bench.dso_days;
            const scoreColor = finance.healthScore >= 80 ? 'text-green-600' : finance.healthScore >= 65 ? 'text-yellow-600' : finance.healthScore >= 50 ? 'text-orange-500' : 'text-red-600';
            const scoreBg = finance.healthScore >= 80 ? 'from-green-50 to-emerald-50 border-green-200' : finance.healthScore >= 65 ? 'from-yellow-50 to-amber-50 border-yellow-200' : finance.healthScore >= 50 ? 'from-orange-50 to-yellow-50 border-orange-200' : 'from-red-50 to-pink-50 border-red-200';
            return (
              <>
                {/* Health Score Hero Card */}
                <div className={`bg-gradient-to-br ${scoreBg} border rounded-2xl p-5 flex items-center gap-4`}>
                  <div className="text-center shrink-0">
                    <div className={`text-5xl font-black ${scoreColor}`}>{finance.healthScore}</div>
                    <div className={`text-xs font-bold mt-0.5 ${scoreColor}`}>/ 100</div>
                    <div className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-bold ${scoreColor} bg-white/60`}>Grade {finance.healthGrade}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Award size={16} className={scoreColor} />
                      <span className="font-bold text-gray-800">Business Health Score</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{bench.label} · Last 30 days</p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${finance.healthScore >= 80 ? 'bg-green-500' : finance.healthScore >= 65 ? 'bg-yellow-400' : finance.healthScore >= 50 ? 'bg-orange-400' : 'bg-red-500'}`}
                        style={{ width: `${finance.healthScore}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1"><span>Critical</span><span>Excellent</span></div>
                  </div>
                </div>

                {/* P&L Summary Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-1.5 text-gray-500 text-xs"><DollarSign size={13} />Revenue (30d)</div>
                    <div className="text-xl font-bold text-gray-800">{inr(finance.revenue30)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{inr(finance.avgDailySales)}/day avg</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-1.5 text-gray-500 text-xs"><BarChart2 size={13} />Gross Profit</div>
                    <div className={`text-xl font-bold ${finance.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{inr(finance.grossProfit)}</div>
                    <div className="flex items-center gap-1 text-xs mt-0.5">
                      <span className={marginOk ? 'text-green-600' : 'text-orange-500'}>{finance.grossMarginPct}% margin</span>
                      {marginOk ? <ArrowUpRight size={11} className="text-green-500" /> : <ArrowDownRight size={11} className="text-orange-500" />}
                      <span className="text-gray-400">bench {bench.gross_margin_pct}%</span>
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-1.5 text-gray-500 text-xs"><AlertTriangle size={13} />Outstanding</div>
                    <div className="text-xl font-bold text-red-600">{inr(finance.totalOutstanding)}</div>
                    <div className="flex items-center gap-1 text-xs mt-0.5">
                      <span className={dsoOk ? 'text-green-600' : 'text-orange-500'}>DSO: {finance.dso}d</span>
                      {!dsoOk && <span className="text-gray-400">(target &lt;{bench.dso_days}d)</span>}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-1.5 text-gray-500 text-xs"><PieChart size={13} />Cash vs Credit</div>
                    <div className="text-xl font-bold text-gray-800">{100 - finance.creditPct}%</div>
                    <div className="text-xs text-gray-500 mt-0.5">cash · {finance.creditPct}% credit</div>
                  </div>
                </div>

                {/* Expense Breakdown */}
                {Object.keys(finance.expenseByCategory).length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-3 text-gray-700 font-semibold text-sm"><Zap size={14} />Expense Breakdown</div>
                    <div className="space-y-2">
                      {Object.entries(finance.expenseByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                        const pct = finance.expenses30 > 0 ? Math.round(amt / finance.expenses30 * 100) : 0;
                        return (
                          <div key={cat}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-600">{cat}</span>
                              <span className="font-medium text-gray-800">{inr(amt)} <span className="text-gray-400">({pct}%)</span></span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full"><div className="h-1.5 bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} /></div>
                          </div>
                        );
                      })}
                      <div className="border-t pt-2 mt-1 flex justify-between text-xs font-bold text-gray-700">
                        <span>Total Expenses</span><span>{inr(finance.expenses30)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stock Alerts */}
                {finance.stockAlerts.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-3 text-gray-700 font-semibold text-sm">
                      <Package size={14} />Stock Alerts
                      <span className="ml-auto text-xs text-gray-400">Based on 30-day velocity</span>
                    </div>
                    <div className="space-y-2">
                      {finance.stockAlerts.slice(0, 8).map(s => (
                        <div key={s.name} className={`flex items-center justify-between p-2.5 rounded-lg ${s.daysLeft <= 3 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                          <div>
                            <div className="text-sm font-semibold text-gray-800">{s.name}</div>
                            <div className="text-xs text-gray-500">{s.stock} {s.unit} remaining</div>
                          </div>
                          <div className={`text-right text-xs font-bold ${s.daysLeft <= 3 ? 'text-red-600' : 'text-yellow-600'}`}>
                            {s.daysLeft <= 3 ? '🚨' : '⚠️'} {s.daysLeft}d left
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Benchmark Comparison */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-3 text-indigo-700 font-semibold text-sm"><Star size={14} />vs Industry Benchmark ({bench.label})</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`p-2 rounded-lg ${marginOk ? 'bg-green-100' : 'bg-orange-100'}`}>
                      <div className="font-medium">Gross Margin</div>
                      <div>Yours: <strong>{finance.grossMarginPct}%</strong></div>
                      <div className="text-gray-500">Bench: {bench.gross_margin_pct}% {marginOk ? '✅' : '⚠️'}</div>
                    </div>
                    {bench.dso_days > 0 && (
                      <div className={`p-2 rounded-lg ${dsoOk ? 'bg-green-100' : 'bg-orange-100'}`}>
                        <div className="font-medium">Collection Speed</div>
                        <div>DSO: <strong>{finance.dso}d</strong></div>
                        <div className="text-gray-500">Target: &lt;{bench.dso_days}d {dsoOk ? '✅' : '⚠️'}</div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-indigo-500 mt-3">💡 Type <strong>"p&l"</strong> or <strong>"credit risk"</strong> in WhatsApp for full AI analysis</p>
                </div>
              </>
            );
          })() : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <PieChart size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-500">No financial data yet</p>
              <p className="text-xs text-gray-400 mt-1">Record sales via WhatsApp to see your financial health score.</p>
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
