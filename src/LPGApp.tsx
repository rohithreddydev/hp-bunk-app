// ═══════════════════════════════════════════════════════════════════════════
// Smart Biz AI — LPG Gas Agency Module
// Blue/orange theme — lpg_ Supabase tables
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Package, Truck, Users, Receipt, FileText,
  Plus, Edit2, Trash2, X, Search, AlertTriangle, CheckCircle2,
  Loader2, TrendingUp, TrendingDown, Wallet, CreditCard,
  Settings as SettingsIcon, LogOut, RefreshCw, ArrowDownToLine,
} from 'lucide-react';
import { SettingsTab } from './SettingsTab';
import { supabase } from './supabase';
import { getTodayIST } from './utils';

function inr(n: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0);
}
function fmtDate(d: string) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
}

const CYLINDER_TYPES = ['domestic_14kg', 'commercial_19kg', 'commercial_47kg', 'domestic_5kg'];
const CYLINDER_LABELS: Record<string, string> = {
  domestic_14kg: '14kg Domestic',
  commercial_19kg: '19kg Commercial',
  commercial_47kg: '47kg Commercial',
  domestic_5kg: '5kg Domestic',
};
const PAYMENT_MODES = ['cash', 'upi', 'bank_transfer', 'cheque', 'credit'];
const EXPENSE_CATEGORIES = ['Staff Salary', 'Vehicle Fuel', 'Vehicle Maintenance', 'Rent', 'Electricity', 'Loading/Unloading', 'Other'];
const BUSINESS_TYPES = ['hotel', 'restaurant', 'factory', 'bakery', 'canteen', 'other'];

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Stock { id: string; bunk_id: string; cylinder_type: string; filled_count: number; empty_count: number; damaged_count: number; updated_at: string; }
interface Allocation { id: string; bunk_id: string; date: string; cylinder_type: string; filled_received: number; empties_returned: number; notes: string | null; created_at: string; }
interface DeliveryBoy { id: string; bunk_id: string; name: string; phone: string | null; is_active: boolean; created_at: string; }
interface Delivery { id: string; bunk_id: string; date: string; delivery_boy_id: string | null; delivery_boy_name: string; cylinder_type: string; cylinders_dispatched: number; cylinders_delivered: number; empties_collected: number; cash_collected: number; notes: string | null; created_at: string; }
interface CommercialCustomer { id: string; bunk_id: string; name: string; phone: string | null; address: string | null; business_type: string; cylinder_type: string; security_deposit: number; credit_limit: number; outstanding_amount: number; is_active: boolean; last_payment_date: string | null; created_at: string; }
interface CommercialSale { id: string; bunk_id: string; customer_id: string | null; customer_name: string; date: string; cylinder_type: string; quantity: number; rate_per_cylinder: number; total_amount: number; payment_status: string; notes: string | null; created_at: string; }
interface CommercialPayment { id: string; bunk_id: string; customer_id: string | null; customer_name: string; amount: number; payment_mode: string; payment_date: string; notes: string | null; created_at: string; }
interface Expense { id: string; bunk_id: string; date: string; category: string; description: string | null; amount: number; payment_mode: string; created_at: string; }

type Tab = 'dashboard' | 'stock' | 'deliveries' | 'commercial' | 'expenses' | 'reports' | 'settings';

// ─── Main Component ────────────────────────────────────────────────────────────
export function LPGApp({ bunkId, onLogout, user }: { bunkId: string; onLogout: () => void; user: { name: string; email: string; role: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [stock, setStock] = useState<Stock[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [customers, setCustomers] = useState<CommercialCustomer[]>([]);
  const [sales, setSales] = useState<CommercialSale[]>([]);
  const [payments, setPayments] = useState<CommercialPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [st, al, db, del, cu, sa, pa, ex] = await Promise.all([
      supabase.from('lpg_stock').select('*').eq('bunk_id', bunkId),
      supabase.from('lpg_allocations').select('*').eq('bunk_id', bunkId).order('date', { ascending: false }).limit(100),
      supabase.from('lpg_delivery_boys').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('lpg_deliveries').select('*').eq('bunk_id', bunkId).order('date', { ascending: false }).limit(200),
      supabase.from('lpg_commercial_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('lpg_commercial_sales').select('*').eq('bunk_id', bunkId).order('date', { ascending: false }).limit(200),
      supabase.from('lpg_commercial_payments').select('*').eq('bunk_id', bunkId).order('payment_date', { ascending: false }).limit(200),
      supabase.from('lpg_expenses').select('*').eq('bunk_id', bunkId).order('date', { ascending: false }).limit(200),
    ]);
    if (st.data) setStock(st.data as Stock[]);
    if (al.data) setAllocations(al.data as Allocation[]);
    if (db.data) setDeliveryBoys(db.data as DeliveryBoy[]);
    if (del.data) setDeliveries(del.data as Delivery[]);
    if (cu.data) setCustomers(cu.data as CommercialCustomer[]);
    if (sa.data) setSales(sa.data as CommercialSale[]);
    if (pa.data) setPayments(pa.data as CommercialPayment[]);
    if (ex.data) setExpenses(ex.data as Expense[]);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const today = getTodayIST();
  const todayDeliveries = deliveries.filter(d => d.date === today);
  const todayCashCollected = todayDeliveries.reduce((a, d) => a + d.cash_collected, 0);
  const todayCylindersDelivered = todayDeliveries.reduce((a, d) => a + d.cylinders_delivered, 0);
  const todayExpTotal = expenses.filter(e => e.date === today).reduce((a, e) => a + e.amount, 0);
  const totalOutstanding = customers.reduce((a, c) => a + (c.outstanding_amount || 0), 0);
  const totalFilled = stock.reduce((a, s) => a + s.filled_count, 0);
  const totalEmpty = stock.reduce((a, s) => a + s.empty_count, 0);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'stock', label: 'Stock & Alloc', icon: <Package size={16} /> },
    { id: 'deliveries', label: 'Deliveries', icon: <Truck size={16} /> },
    { id: 'commercial', label: 'Commercial', icon: <Users size={16} /> },
    { id: 'expenses', label: 'Expenses', icon: <Receipt size={16} /> },
    { id: 'reports', label: 'Reports', icon: <FileText size={16} /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <span className="text-2xl">🔵</span>
        <div>
          <h1 className="font-bold text-lg leading-tight">LPG Gas Agency</h1>
          <p className="text-blue-200 text-xs">Smart Biz AI</p>
        </div>
        <button onClick={onLogout} className="ml-auto p-2 rounded-lg hover:bg-white/20 transition" title="Sign Out">
          <LogOut size={20} />
        </button>
      </header>

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      <nav className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex min-w-max">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="p-4 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-blue-700" size={32} /></div>
        ) : (
          <>
            {activeTab === 'dashboard' && <LPGDashboard stock={stock} todayCashCollected={todayCashCollected} todayCylindersDelivered={todayCylindersDelivered} todayExpTotal={todayExpTotal} totalOutstanding={totalOutstanding} totalFilled={totalFilled} totalEmpty={totalEmpty} recentDeliveries={deliveries.slice(0, 8)} deliveryBoys={deliveryBoys} />}
            {activeTab === 'stock' && <LPGStock bunkId={bunkId} stock={stock} allocations={allocations} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'deliveries' && <LPGDeliveries bunkId={bunkId} deliveries={deliveries} deliveryBoys={deliveryBoys} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'commercial' && <LPGCommercial bunkId={bunkId} customers={customers} sales={sales} payments={payments} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'expenses' && <LPGExpenses bunkId={bunkId} expenses={expenses} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'reports' && <LPGReports deliveries={deliveries} allocations={allocations} sales={sales} payments={payments} expenses={expenses} customers={customers} stock={stock} />}
            {activeTab === 'settings' && <SettingsTab bunkId={bunkId} user={user} onLogout={onLogout} />}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function LPGDashboard({ stock, todayCashCollected, todayCylindersDelivered, todayExpTotal, totalOutstanding, totalFilled, totalEmpty, recentDeliveries, deliveryBoys }: {
  stock: Stock[]; todayCashCollected: number; todayCylindersDelivered: number; todayExpTotal: number;
  totalOutstanding: number; totalFilled: number; totalEmpty: number; recentDeliveries: Delivery[]; deliveryBoys: DeliveryBoy[];
}) {
  const kpis = [
    { label: "Today's Cash Collected", value: inr(todayCashCollected), icon: <TrendingUp size={20} />, color: 'bg-green-50 text-green-700 border-green-200' },
    { label: 'Cylinders Delivered Today', value: String(todayCylindersDelivered), icon: <Truck size={20} />, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: "Today's Expenses", value: inr(todayExpTotal), icon: <TrendingDown size={20} />, color: 'bg-red-50 text-red-700 border-red-200' },
    { label: 'Commercial Outstanding', value: inr(totalOutstanding), icon: <Wallet size={20} />, color: 'bg-orange-50 text-orange-700 border-orange-200' },
    { label: 'Filled Cylinders', value: String(totalFilled), icon: <Package size={20} />, color: totalFilled < 20 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200' },
    { label: 'Empty Cylinders', value: String(totalEmpty), icon: <ArrowDownToLine size={20} />, color: 'bg-gray-50 text-gray-600 border-gray-200' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.color}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium opacity-80 leading-tight">{k.label}</span>{k.icon}
            </div>
            <p className="text-xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Stock cards */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Package size={16} className="text-blue-600" /> Cylinder Stock</h2>
        {stock.length === 0 ? (
          <p className="text-gray-400 text-sm">No stock data yet. Update via Stock & Alloc tab.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stock.map(s => (
              <div key={s.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <p className="text-sm font-semibold text-gray-700 mb-2">{CYLINDER_LABELS[s.cylinder_type] || s.cylinder_type}</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-green-700">Filled</span><span className="font-semibold text-green-700">{s.filled_count}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Empty</span><span className="font-semibold">{s.empty_count}</span></div>
                  <div className="flex justify-between"><span className="text-red-500">Damaged</span><span className="font-semibold text-red-500">{s.damaged_count}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent deliveries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Truck size={16} className="text-blue-600" /> Recent Deliveries</h2>
          {recentDeliveries.length === 0 ? <p className="text-gray-400 text-sm">No deliveries recorded yet.</p> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentDeliveries.map(d => (
                <div key={d.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{d.delivery_boy_name}</p>
                    <p className="text-xs text-gray-400">{fmtDate(d.date)} · {CYLINDER_LABELS[d.cylinder_type] || d.cylinder_type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-700">{inr(d.cash_collected)}</p>
                    <p className="text-xs text-gray-400">{d.cylinders_delivered} delivered</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><CheckCircle2 size={16} className="text-green-600" /> Delivery Boys ({deliveryBoys.length})</h2>
          {deliveryBoys.length === 0 ? <p className="text-gray-400 text-sm">No delivery boys added yet.</p> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {deliveryBoys.map(b => (
                <div key={b.id} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                    {b.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{b.name}</p>
                    {b.phone && <p className="text-xs text-gray-400">{b.phone}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stock & Allocations ────────────────────────────────────────────────────────
function LPGStock({ bunkId, stock, allocations, onRefresh, showToast }: {
  bunkId: string; stock: Stock[]; allocations: Allocation[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ cylinder_type: 'domestic_14kg', filled_received: '', empties_returned: '', notes: '' });

  const handleAddAlloc = async () => {
    const filled = parseInt(form.filled_received) || 0;
    const empties = parseInt(form.empties_returned) || 0;
    if (!filled && !empties) { showToast('Enter filled received or empties returned', 'error'); return; }
    setSaving(true);

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const { error: allocErr } = await supabase.from('lpg_allocations').insert({
      bunk_id: bunkId, date: today, cylinder_type: form.cylinder_type,
      filled_received: filled, empties_returned: empties, notes: form.notes || null,
    });
    if (allocErr) { showToast(allocErr.message, 'error'); setSaving(false); return; }

    // Update stock
    const existing = stock.find(s => s.cylinder_type === form.cylinder_type);
    if (existing) {
      await supabase.from('lpg_stock').update({
        filled_count: existing.filled_count + filled,
        empty_count: Math.max(0, existing.empty_count - empties),
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('lpg_stock').insert({ bunk_id: bunkId, cylinder_type: form.cylinder_type, filled_count: filled, empty_count: 0, damaged_count: 0 });
    }

    setSaving(false);
    showToast('Allocation recorded');
    setShowForm(false);
    setForm({ cylinder_type: 'domestic_14kg', filled_received: '', empties_returned: '', notes: '' });
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Stock cards */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700">Current Stock</h2>
          <button onClick={onRefresh} className="p-2 text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
        </div>
        {stock.length === 0 ? (
          <p className="text-gray-400 text-sm">No stock yet. Record an allocation to initialise.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stock.map(s => (
              <div key={s.id} className="border border-blue-100 rounded-xl p-4 bg-blue-50">
                <p className="text-sm font-semibold text-blue-800 mb-3">{CYLINDER_LABELS[s.cylinder_type] || s.cylinder_type}</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-700 font-medium">Filled</span>
                    <span className="text-lg font-bold text-green-700">{s.filled_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Empty</span>
                    <span className="text-lg font-bold text-gray-700">{s.empty_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-red-500">Damaged</span>
                    <span className="text-base font-semibold text-red-500">{s.damaged_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Allocation form */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700">Record Allocation</h2>
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-800">
            <Plus size={14} />{showForm ? 'Cancel' : 'New Allocation'}
          </button>
        </div>

        {showForm && (
          <div className="border border-blue-100 rounded-xl p-4 bg-blue-50 space-y-3 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Cylinder Type</label>
                <select value={form.cylinder_type} onChange={e => setForm(f => ({ ...f, cylinder_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CYLINDER_TYPES.map(t => <option key={t} value={t}>{CYLINDER_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Filled Received</label>
                <input type="number" value={form.filled_received} onChange={e => setForm(f => ({ ...f, filled_received: e.target.value }))}
                  placeholder="e.g. 50" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Empties Returned</label>
                <input type="number" value={form.empties_returned} onChange={e => setForm(f => ({ ...f, empties_returned: e.target.value }))}
                  placeholder="e.g. 45" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any notes" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <button onClick={handleAddAlloc} disabled={saving} className="flex items-center gap-1.5 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Saving…' : 'Record Allocation'}
            </button>
          </div>
        )}

        {/* Allocation history */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-xs text-gray-500">
              <th className="text-left py-2 pr-4">Date</th>
              <th className="text-left py-2 pr-4">Type</th>
              <th className="text-right py-2 pr-4">Filled Received</th>
              <th className="text-right py-2 pr-4">Empties Returned</th>
              <th className="text-left py-2">Notes</th>
            </tr></thead>
            <tbody>
              {allocations.slice(0, 30).map(a => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-4 text-gray-600">{fmtDate(a.date)}</td>
                  <td className="py-2 pr-4 text-gray-700">{CYLINDER_LABELS[a.cylinder_type] || a.cylinder_type}</td>
                  <td className="py-2 pr-4 text-right font-semibold text-green-700">{a.filled_received}</td>
                  <td className="py-2 pr-4 text-right text-gray-500">{a.empties_returned}</td>
                  <td className="py-2 text-gray-400 text-xs">{a.notes || '—'}</td>
                </tr>
              ))}
              {allocations.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400 text-sm">No allocations recorded yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Deliveries ────────────────────────────────────────────────────────────────
function LPGDeliveries({ bunkId, deliveries, deliveryBoys, onRefresh, showToast }: {
  bunkId: string; deliveries: Delivery[]; deliveryBoys: DeliveryBoy[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ delivery_boy_id: '', delivery_boy_name: '', cylinder_type: 'domestic_14kg', cylinders_dispatched: '', cylinders_delivered: '', empties_collected: '', cash_collected: '', notes: '' });

  const filtered = deliveries.filter(d =>
    !search || d.delivery_boy_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    const boyName = form.delivery_boy_id
      ? (deliveryBoys.find(b => b.id === form.delivery_boy_id)?.name || form.delivery_boy_name)
      : form.delivery_boy_name.trim();
    if (!boyName) { showToast('Select or enter delivery boy name', 'error'); return; }
    const dispatched = parseInt(form.cylinders_dispatched) || 0;
    const delivered = parseInt(form.cylinders_delivered) || 0;
    const empties = parseInt(form.empties_collected) || 0;
    const cash = parseFloat(form.cash_collected) || 0;
    if (!dispatched) { showToast('Enter cylinders dispatched', 'error'); return; }

    setSaving(true);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Auto-create delivery boy if new name
    let boyId = form.delivery_boy_id || null;
    if (!boyId && boyName) {
      const { data: nb } = await supabase.from('lpg_delivery_boys').insert({ bunk_id: bunkId, name: boyName }).select('id').single();
      boyId = nb?.id || null;
    }

    const { error } = await supabase.from('lpg_deliveries').insert({
      bunk_id: bunkId, date: today, delivery_boy_id: boyId, delivery_boy_name: boyName,
      cylinder_type: form.cylinder_type, cylinders_dispatched: dispatched,
      cylinders_delivered: delivered || dispatched, empties_collected: empties,
      cash_collected: cash, notes: form.notes || null,
    });
    if (error) { showToast(error.message, 'error'); setSaving(false); return; }

    setSaving(false);
    showToast('Delivery entry recorded');
    setShowForm(false);
    setForm({ delivery_boy_id: '', delivery_boy_name: '', cylinder_type: 'domestic_14kg', cylinders_dispatched: '', cylinders_delivered: '', empties_collected: '', cash_collected: '', notes: '' });
    onRefresh();
  };

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const todayDeliveries = deliveries.filter(d => d.date === today);
  const todayCash = todayDeliveries.reduce((a, d) => a + d.cash_collected, 0);
  const todayCyls = todayDeliveries.reduce((a, d) => a + d.cylinders_delivered, 0);

  return (
    <div className="space-y-6">
      {/* Today summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-xs text-green-600 mb-1">Today's Cash</p>
          <p className="text-xl font-bold text-green-700">{inr(todayCash)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-xs text-blue-600 mb-1">Delivered Today</p>
          <p className="text-xl font-bold text-blue-700">{todayCyls}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Delivery Boys</p>
          <p className="text-xl font-bold text-gray-700">{todayDeliveries.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700">Delivery Records</h2>
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-800">
            <Plus size={14} />{showForm ? 'Cancel' : 'New Entry'}
          </button>
        </div>

        {showForm && (
          <div className="border border-blue-100 rounded-xl p-4 bg-blue-50 space-y-3 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Delivery Boy</label>
                <select value={form.delivery_boy_id} onChange={e => setForm(f => ({ ...f, delivery_boy_id: e.target.value, delivery_boy_name: '' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— New Name —</option>
                  {deliveryBoys.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              {!form.delivery_boy_id && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">New Boy Name</label>
                  <input value={form.delivery_boy_name} onChange={e => setForm(f => ({ ...f, delivery_boy_name: e.target.value }))}
                    placeholder="Enter name" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Cylinder Type</label>
                <select value={form.cylinder_type} onChange={e => setForm(f => ({ ...f, cylinder_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CYLINDER_TYPES.map(t => <option key={t} value={t}>{CYLINDER_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Dispatched</label>
                <input type="number" value={form.cylinders_dispatched} onChange={e => setForm(f => ({ ...f, cylinders_dispatched: e.target.value }))}
                  placeholder="e.g. 20" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Delivered (leave blank = same as dispatched)</label>
                <input type="number" value={form.cylinders_delivered} onChange={e => setForm(f => ({ ...f, cylinders_delivered: e.target.value }))}
                  placeholder="e.g. 20" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Empties Collected</label>
                <input type="number" value={form.empties_collected} onChange={e => setForm(f => ({ ...f, empties_collected: e.target.value }))}
                  placeholder="e.g. 18" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Cash Collected (₹)</label>
                <input type="number" value={form.cash_collected} onChange={e => setForm(f => ({ ...f, cash_collected: e.target.value }))}
                  placeholder="e.g. 18000" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any notes" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <button onClick={handleAdd} disabled={saving} className="flex items-center gap-1.5 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Saving…' : 'Record Delivery'}
            </button>
          </div>
        )}

        <div className="mb-3">
          <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by delivery boy…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-xs text-gray-500">
              <th className="text-left py-2 pr-3">Date</th>
              <th className="text-left py-2 pr-3">Delivery Boy</th>
              <th className="text-left py-2 pr-3">Type</th>
              <th className="text-right py-2 pr-3">Dispatched</th>
              <th className="text-right py-2 pr-3">Delivered</th>
              <th className="text-right py-2 pr-3">Empties</th>
              <th className="text-right py-2">Cash</th>
            </tr></thead>
            <tbody>
              {filtered.slice(0, 50).map(d => (
                <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-3 text-gray-500">{fmtDate(d.date)}</td>
                  <td className="py-2 pr-3 font-medium text-gray-800">{d.delivery_boy_name}</td>
                  <td className="py-2 pr-3 text-gray-500 text-xs">{CYLINDER_LABELS[d.cylinder_type] || d.cylinder_type}</td>
                  <td className="py-2 pr-3 text-right text-gray-600">{d.cylinders_dispatched}</td>
                  <td className="py-2 pr-3 text-right text-blue-700 font-semibold">{d.cylinders_delivered}</td>
                  <td className="py-2 pr-3 text-right text-gray-500">{d.empties_collected}</td>
                  <td className="py-2 text-right font-semibold text-green-700">{inr(d.cash_collected)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-gray-400 text-sm">No deliveries recorded</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Commercial Customers ──────────────────────────────────────────────────────
function LPGCommercial({ bunkId, customers, sales, payments, onRefresh, showToast }: {
  bunkId: string; customers: CommercialCustomer[]; sales: CommercialSale[]; payments: CommercialPayment[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [view, setView] = useState<'customers' | 'sales' | 'payments'>('customers');
  const [showCustForm, setShowCustForm] = useState(false);
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [custForm, setCustForm] = useState({ name: '', phone: '', address: '', business_type: 'hotel', cylinder_type: 'commercial_19kg', credit_limit: '' });
  const [saleForm, setSaleForm] = useState({ customer_id: '', customer_name: '', cylinder_type: 'commercial_19kg', quantity: '', rate_per_cylinder: '', payment_status: 'credit', notes: '' });
  const [payForm, setPayForm] = useState({ customer_id: '', customer_name: '', amount: '', payment_mode: 'cash', notes: '' });

  const filteredCust = customers.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));

  const handleAddCust = async () => {
    if (!custForm.name.trim()) { showToast('Enter customer name', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('lpg_commercial_customers').insert({
      bunk_id: bunkId, name: custForm.name.trim(), phone: custForm.phone || null,
      address: custForm.address || null, business_type: custForm.business_type,
      cylinder_type: custForm.cylinder_type, credit_limit: parseFloat(custForm.credit_limit) || 0,
    });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Customer added');
    setShowCustForm(false);
    setCustForm({ name: '', phone: '', address: '', business_type: 'hotel', cylinder_type: 'commercial_19kg', credit_limit: '' });
    onRefresh();
  };

  const handleAddSale = async () => {
    const custName = saleForm.customer_id ? (customers.find(c => c.id === saleForm.customer_id)?.name || '') : saleForm.customer_name.trim();
    if (!custName) { showToast('Select or enter customer', 'error'); return; }
    const qty = parseInt(saleForm.quantity) || 0;
    const rate = parseFloat(saleForm.rate_per_cylinder) || 0;
    if (!qty || !rate) { showToast('Enter quantity and rate', 'error'); return; }
    setSaving(true);
    const total = qty * rate;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const { error } = await supabase.from('lpg_commercial_sales').insert({
      bunk_id: bunkId, customer_id: saleForm.customer_id || null, customer_name: custName,
      date: today, cylinder_type: saleForm.cylinder_type, quantity: qty,
      rate_per_cylinder: rate, total_amount: total, payment_status: saleForm.payment_status,
      notes: saleForm.notes || null,
    });
    if (!error && saleForm.customer_id && saleForm.payment_status === 'credit') {
      const cust = customers.find(c => c.id === saleForm.customer_id);
      if (cust) await supabase.from('lpg_commercial_customers').update({ outstanding_amount: (cust.outstanding_amount || 0) + total }).eq('id', cust.id);
    }
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Sale recorded');
    setShowSaleForm(false);
    setSaleForm({ customer_id: '', customer_name: '', cylinder_type: 'commercial_19kg', quantity: '', rate_per_cylinder: '', payment_status: 'credit', notes: '' });
    onRefresh();
  };

  const handleAddPayment = async () => {
    const custName = payForm.customer_id ? (customers.find(c => c.id === payForm.customer_id)?.name || '') : payForm.customer_name.trim();
    if (!custName) { showToast('Select or enter customer', 'error'); return; }
    const amount = parseFloat(payForm.amount) || 0;
    if (!amount) { showToast('Enter payment amount', 'error'); return; }
    setSaving(true);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const { error } = await supabase.from('lpg_commercial_payments').insert({
      bunk_id: bunkId, customer_id: payForm.customer_id || null, customer_name: custName,
      amount, payment_mode: payForm.payment_mode, payment_date: today, notes: payForm.notes || null,
    });
    if (!error && payForm.customer_id) {
      const cust = customers.find(c => c.id === payForm.customer_id);
      if (cust) await supabase.from('lpg_commercial_customers').update({ outstanding_amount: Math.max(0, (cust.outstanding_amount || 0) - amount), last_payment_date: today }).eq('id', cust.id);
    }
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Payment recorded');
    setShowPayForm(false);
    setPayForm({ customer_id: '', customer_name: '', amount: '', payment_mode: 'cash', notes: '' });
    onRefresh();
  };

  const totalOutstanding = customers.reduce((a, c) => a + (c.outstanding_amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {(['customers', 'sales', 'payments'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${view === v ? 'bg-blue-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
            {v}
          </button>
        ))}
        <div className="ml-auto text-sm text-orange-700 font-semibold">Outstanding: {inr(totalOutstanding)}</div>
      </div>

      {view === 'customers' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">Commercial Customers</h2>
            <button onClick={() => setShowCustForm(v => !v)} className="flex items-center gap-1.5 bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-800">
              <Plus size={14} />{showCustForm ? 'Cancel' : 'Add Customer'}
            </button>
          </div>
          {showCustForm && (
            <div className="border border-blue-100 rounded-xl p-4 bg-blue-50 space-y-3 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Name', key: 'name', placeholder: 'Hotel / Restaurant name' },
                  { label: 'Phone', key: 'phone', placeholder: '9xxxxxxxxx' },
                  { label: 'Address', key: 'address', placeholder: 'Address' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                    <input value={(custForm as any)[f.key]} onChange={e => setCustForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Business Type</label>
                  <select value={custForm.business_type} onChange={e => setCustForm(f => ({ ...f, business_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Default Cylinder Type</label>
                  <select value={custForm.cylinder_type} onChange={e => setCustForm(f => ({ ...f, cylinder_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {CYLINDER_TYPES.map(t => <option key={t} value={t}>{CYLINDER_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Credit Limit (₹)</label>
                  <input type="number" value={custForm.credit_limit} onChange={e => setCustForm(f => ({ ...f, credit_limit: e.target.value }))}
                    placeholder="e.g. 50000" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <button onClick={handleAddCust} disabled={saving} className="flex items-center gap-1.5 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{saving ? 'Saving…' : 'Add Customer'}
              </button>
            </div>
          )}
          <div className="mb-3"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div></div>
          <div className="space-y-2">
            {filteredCust.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition">
                <div>
                  <p className="font-semibold text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.business_type} · {CYLINDER_LABELS[c.cylinder_type] || c.cylinder_type}{c.phone ? ` · ${c.phone}` : ''}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${c.outstanding_amount > 0 ? 'text-orange-600' : 'text-green-600'}`}>{inr(c.outstanding_amount)}</p>
                  <p className="text-xs text-gray-400">outstanding</p>
                </div>
              </div>
            ))}
            {filteredCust.length === 0 && <p className="text-center text-gray-400 text-sm py-6">No customers yet</p>}
          </div>
        </div>
      )}

      {view === 'sales' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">Commercial Sales</h2>
            <button onClick={() => setShowSaleForm(v => !v)} className="flex items-center gap-1.5 bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-800">
              <Plus size={14} />{showSaleForm ? 'Cancel' : 'New Sale'}
            </button>
          </div>
          {showSaleForm && (
            <div className="border border-blue-100 rounded-xl p-4 bg-blue-50 space-y-3 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Customer</label>
                  <select value={saleForm.customer_id} onChange={e => setSaleForm(f => ({ ...f, customer_id: e.target.value, customer_name: '' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— New Customer —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {!saleForm.customer_id && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Customer Name</label>
                    <input value={saleForm.customer_name} onChange={e => setSaleForm(f => ({ ...f, customer_name: e.target.value }))}
                      placeholder="Name" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Cylinder Type</label>
                  <select value={saleForm.cylinder_type} onChange={e => setSaleForm(f => ({ ...f, cylinder_type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {CYLINDER_TYPES.map(t => <option key={t} value={t}>{CYLINDER_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
                  <input type="number" value={saleForm.quantity} onChange={e => setSaleForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder="e.g. 5" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Rate per Cylinder (₹)</label>
                  <input type="number" value={saleForm.rate_per_cylinder} onChange={e => setSaleForm(f => ({ ...f, rate_per_cylinder: e.target.value }))}
                    placeholder="e.g. 1800" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {saleForm.quantity && saleForm.rate_per_cylinder && (
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                    Total: {inr((parseInt(saleForm.quantity) || 0) * (parseFloat(saleForm.rate_per_cylinder) || 0))}
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Payment Status</label>
                  <select value={saleForm.payment_status} onChange={e => setSaleForm(f => ({ ...f, payment_status: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="credit">Credit</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
              <button onClick={handleAddSale} disabled={saving} className="flex items-center gap-1.5 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{saving ? 'Saving…' : 'Record Sale'}
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="text-left py-2 pr-3">Date</th><th className="text-left py-2 pr-3">Customer</th>
                <th className="text-left py-2 pr-3">Type</th><th className="text-right py-2 pr-3">Qty</th>
                <th className="text-right py-2 pr-3">Rate</th><th className="text-right py-2 pr-3">Total</th>
                <th className="text-left py-2">Status</th>
              </tr></thead>
              <tbody>
                {sales.slice(0, 50).map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-3 text-gray-500">{fmtDate(s.date)}</td>
                    <td className="py-2 pr-3 font-medium text-gray-800">{s.customer_name}</td>
                    <td className="py-2 pr-3 text-xs text-gray-500">{CYLINDER_LABELS[s.cylinder_type] || s.cylinder_type}</td>
                    <td className="py-2 pr-3 text-right text-gray-700">{s.quantity}</td>
                    <td className="py-2 pr-3 text-right text-gray-500">{inr(s.rate_per_cylinder)}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-blue-700">{inr(s.total_amount)}</td>
                    <td className="py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{s.payment_status}</span></td>
                  </tr>
                ))}
                {sales.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-gray-400 text-sm">No sales yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'payments' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">Commercial Payments</h2>
            <button onClick={() => setShowPayForm(v => !v)} className="flex items-center gap-1.5 bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-800">
              <Plus size={14} />{showPayForm ? 'Cancel' : 'Record Payment'}
            </button>
          </div>
          {showPayForm && (
            <div className="border border-blue-100 rounded-xl p-4 bg-blue-50 space-y-3 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Customer</label>
                  <select value={payForm.customer_id} onChange={e => setPayForm(f => ({ ...f, customer_id: e.target.value, customer_name: '' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Select or type —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {inr(c.outstanding_amount)}</option>)}
                  </select>
                </div>
                {!payForm.customer_id && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Customer Name</label>
                    <input value={payForm.customer_name} onChange={e => setPayForm(f => ({ ...f, customer_name: e.target.value }))}
                      placeholder="Name" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Amount (₹)</label>
                  <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="e.g. 10000" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Payment Mode</label>
                  <select value={payForm.payment_mode} onChange={e => setPayForm(f => ({ ...f, payment_mode: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={handleAddPayment} disabled={saving} className="flex items-center gap-1.5 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}{saving ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="text-left py-2 pr-3">Date</th><th className="text-left py-2 pr-3">Customer</th>
                <th className="text-right py-2 pr-3">Amount</th><th className="text-left py-2">Mode</th>
              </tr></thead>
              <tbody>
                {payments.slice(0, 50).map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-3 text-gray-500">{fmtDate(p.payment_date)}</td>
                    <td className="py-2 pr-3 font-medium text-gray-800">{p.customer_name}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-green-700">{inr(p.amount)}</td>
                    <td className="py-2 text-xs text-gray-500 capitalize">{p.payment_mode}</td>
                  </tr>
                ))}
                {payments.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-400 text-sm">No payments yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Expenses ──────────────────────────────────────────────────────────────────
function LPGExpenses({ bunkId, expenses, onRefresh, showToast }: {
  bunkId: string; expenses: Expense[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: 'Staff Salary', description: '', amount: '', payment_mode: 'cash' });

  const handleAdd = async () => {
    const amount = parseFloat(form.amount) || 0;
    if (!amount) { showToast('Enter amount', 'error'); return; }
    setSaving(true);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const { error } = await supabase.from('lpg_expenses').insert({
      bunk_id: bunkId, date: today, category: form.category,
      description: form.description || null, amount, payment_mode: form.payment_mode,
    });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Expense recorded');
    setShowForm(false);
    setForm({ category: 'Staff Salary', description: '', amount: '', payment_mode: 'cash' });
    onRefresh();
  };

  const todayTotal = expenses.filter(e => e.date === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })).reduce((a, e) => a + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
        <div><p className="text-xs text-red-500">Today's Expenses</p><p className="text-2xl font-bold text-red-700">{inr(todayTotal)}</p></div>
        <TrendingDown size={32} className="text-red-300" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700">Expenses</h2>
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-800">
            <Plus size={14} />{showForm ? 'Cancel' : 'Add Expense'}
          </button>
        </div>

        {showForm && (
          <div className="border border-blue-100 rounded-xl p-4 bg-blue-50 space-y-3 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Amount (₹)</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="e.g. 500" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional details" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Payment Mode</label>
                <select value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {PAYMENT_MODES.filter(m => m !== 'credit').map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <button onClick={handleAdd} disabled={saving} className="flex items-center gap-1.5 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{saving ? 'Saving…' : 'Add Expense'}
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-xs text-gray-500">
              <th className="text-left py-2 pr-3">Date</th><th className="text-left py-2 pr-3">Category</th>
              <th className="text-left py-2 pr-3">Description</th><th className="text-right py-2 pr-3">Amount</th>
              <th className="text-left py-2">Mode</th>
            </tr></thead>
            <tbody>
              {expenses.slice(0, 50).map(e => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-3 text-gray-500">{fmtDate(e.date)}</td>
                  <td className="py-2 pr-3 text-gray-700">{e.category}</td>
                  <td className="py-2 pr-3 text-gray-400 text-xs">{e.description || '—'}</td>
                  <td className="py-2 pr-3 text-right font-semibold text-red-600">{inr(e.amount)}</td>
                  <td className="py-2 text-xs text-gray-400 capitalize">{e.payment_mode}</td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400 text-sm">No expenses recorded</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Reports ───────────────────────────────────────────────────────────────────
function LPGReports({ deliveries, allocations, sales, payments, expenses, customers, stock }: {
  deliveries: Delivery[]; allocations: Allocation[]; sales: CommercialSale[]; payments: CommercialPayment[];
  expenses: Expense[]; customers: CommercialCustomer[]; stock: Stock[];
}) {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const filterByPeriod = <T extends { date?: string; created_at?: string; payment_date?: string }>(arr: T[], dateKey: keyof T): T[] => {
    return arr.filter(item => {
      const d = item[dateKey] as string;
      if (!d) return false;
      const itemDate = new Date(d);
      if (period === 'today') return d.startsWith(todayStr);
      if (period === 'week') {
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
        return itemDate >= weekAgo;
      }
      return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
    });
  };

  const pDeliveries = filterByPeriod(deliveries, 'date');
  const pAllocations = filterByPeriod(allocations, 'date');
  const pSales = filterByPeriod(sales, 'date');
  const pPayments = filterByPeriod(payments, 'payment_date');
  const pExpenses = filterByPeriod(expenses, 'date');

  const totalCash = pDeliveries.reduce((a, d) => a + d.cash_collected, 0);
  const totalDelivered = pDeliveries.reduce((a, d) => a + d.cylinders_delivered, 0);
  const totalFilled = pAllocations.reduce((a, a2) => a + a2.filled_received, 0);
  const totalSalesAmt = pSales.reduce((a, s) => a + s.total_amount, 0);
  const totalCollected = pPayments.reduce((a, p) => a + p.amount, 0);
  const totalExpenses = pExpenses.reduce((a, e) => a + e.amount, 0);

  const currentFilled = stock.reduce((a, s) => a + s.filled_count, 0);
  const currentEmpty = stock.reduce((a, s) => a + s.empty_count, 0);
  const totalOutstanding = customers.reduce((a, c) => a + (c.outstanding_amount || 0), 0);

  const periodLabel = period === 'today' ? 'Today' : period === 'week' ? 'Last 7 Days' : 'This Month';

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(['today', 'week', 'month'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${period === p ? 'bg-blue-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: `Cash Collected (${periodLabel})`, value: inr(totalCash), color: 'bg-green-50 text-green-700 border-green-200' },
          { label: `Cylinders Delivered (${periodLabel})`, value: String(totalDelivered), color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: `Allocation Received (${periodLabel})`, value: String(totalFilled), color: 'bg-purple-50 text-purple-700 border-purple-200' },
          { label: `Expenses (${periodLabel})`, value: inr(totalExpenses), color: 'bg-red-50 text-red-700 border-red-200' },
          { label: `Commercial Sales (${periodLabel})`, value: inr(totalSalesAmt), color: 'bg-orange-50 text-orange-700 border-orange-200' },
          { label: `Commercial Collections (${periodLabel})`, value: inr(totalCollected), color: 'bg-teal-50 text-teal-700 border-teal-200' },
          { label: 'Current Filled Stock', value: String(currentFilled), color: 'bg-green-50 text-green-700 border-green-200' },
          { label: 'Total Commercial Outstanding', value: inr(totalOutstanding), color: totalOutstanding > 0 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-50 text-gray-500 border-gray-200' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.color}`}>
            <p className="text-xs font-medium opacity-80 mb-1">{k.label}</p>
            <p className="text-xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Per-boy summary */}
      {pDeliveries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Delivery Boy Summary — {periodLabel}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 text-xs text-gray-500">
                <th className="text-left py-2 pr-3">Delivery Boy</th>
                <th className="text-right py-2 pr-3">Entries</th>
                <th className="text-right py-2 pr-3">Cylinders</th>
                <th className="text-right py-2">Cash</th>
              </tr></thead>
              <tbody>
                {Object.entries(
                  pDeliveries.reduce((acc, d) => {
                    if (!acc[d.delivery_boy_name]) acc[d.delivery_boy_name] = { entries: 0, cylinders: 0, cash: 0 };
                    acc[d.delivery_boy_name].entries++;
                    acc[d.delivery_boy_name].cylinders += d.cylinders_delivered;
                    acc[d.delivery_boy_name].cash += d.cash_collected;
                    return acc;
                  }, {} as Record<string, { entries: number; cylinders: number; cash: number }>)
                ).map(([name, data]) => (
                  <tr key={name} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-3 font-medium text-gray-800">{name}</td>
                    <td className="py-2 pr-3 text-right text-gray-500">{data.entries}</td>
                    <td className="py-2 pr-3 text-right text-blue-700 font-semibold">{data.cylinders}</td>
                    <td className="py-2 text-right font-semibold text-green-700">{inr(data.cash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Outstanding customers */}
      {customers.filter(c => c.outstanding_amount > 0).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Commercial Outstanding</h2>
          <div className="space-y-2">
            {customers.filter(c => c.outstanding_amount > 0).sort((a, b) => b.outstanding_amount - a.outstanding_amount).map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 border border-orange-100 rounded-xl bg-orange-50">
                <div>
                  <p className="font-semibold text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.business_type}{c.last_payment_date ? ` · Last paid ${fmtDate(c.last_payment_date)}` : ''}</p>
                </div>
                <p className="text-orange-700 font-bold">{inr(c.outstanding_amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
