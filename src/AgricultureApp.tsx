import { useState, useEffect, useCallback } from 'react';
import { LogOut, Plus, Trash2, Search, RefreshCw, AlertTriangle, TrendingUp, Package, Users, ShoppingCart, FileText, BarChart2, Settings, Brain, Download } from 'lucide-react';
import { supabase } from './supabase';
import { getTodayIST } from './utils';
import { SettingsTab } from './SettingsTab';
import { IntelligenceTab } from './IntelligenceTab';

// ── Types ──────────────────────────────────────────────────────────────────
interface AgProduct { id: string; bunk_id: string; name: string; category: string; unit: string; purchase_rate: number; selling_rate: number; stock_qty: number; low_stock_at: number; hsn_code: string; created_at: string; }
interface AgCustomer { id: string; bunk_id: string; name: string; phone: string; village: string; land_area: string; credit_limit: number; outstanding_amount: number; is_active: boolean; last_payment_date: string | null; created_at: string; }
interface AgSale { id: string; bunk_id: string; date: string; customer_id: string | null; customer_name: string; items: { name: string; qty: number; unit: string; rate: number; total: number }[]; subtotal: number; discount: number; total: number; payment_mode: string; notes: string; created_at: string; }
interface AgPayment { id: string; bunk_id: string; customer_id: string | null; customer_name: string; amount: number; payment_mode: string; payment_date: string; notes: string | null; created_at: string; }
interface AgPurchase { id: string; bunk_id: string; date: string; supplier_name: string; product_name: string; category: string; quantity: number; unit: string; rate_per_unit: number; total_amount: number; payment_mode: string; notes: string | null; created_at: string; }
interface AgExpense { id: string; bunk_id: string; date: string; category: string; amount: number; description: string; payment_mode: string; created_at: string; }

// ── Helpers ────────────────────────────────────────────────────────────────
function inr(n: number) { return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`; }
function getCurrentSeason() {
  const m = new Date().getMonth() + 1;
  const yr = new Date().getFullYear();
  if (m >= 6 && m <= 10) return { label: 'Kharif', emoji: '🌾', start: `${yr}-06-01`, end: `${yr}-10-31` };
  if (m >= 11) return { label: 'Rabi', emoji: '🌿', start: `${yr}-11-01`, end: `${yr + 1}-03-31` };
  if (m <= 3) return { label: 'Rabi', emoji: '🌿', start: `${yr - 1}-11-01`, end: `${yr}-03-31` };
  return { label: 'Zaid', emoji: '☀️', start: `${yr}-04-01`, end: `${yr}-05-31` };
}

const CATEGORIES = ['Seeds', 'Fertilizer', 'Pesticide', 'Herbicide', 'Bio-product', 'Tool', 'Other'];
const EXPENSE_CATS = ['Rent', 'Labour', 'Transport', 'Electricity', 'Packaging', 'Other'];

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-xl ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
      {msg}
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────
function Header({ onLogout, user, tab, setTab }: { onLogout: () => void; user: { name: string; email: string; role: string }; tab: string; setTab: (t: string) => void }) {
  const tabs = [
    { id: 'dashboard', icon: <BarChart2 size={14} />, label: 'Dashboard' },
    { id: 'inventory', icon: <Package size={14} />, label: 'Inventory' },
    { id: 'sales', icon: <ShoppingCart size={14} />, label: 'Sales' },
    { id: 'farmers', icon: <Users size={14} />, label: 'Farmers' },
    { id: 'purchases', icon: <TrendingUp size={14} />, label: 'Purchases' },
    { id: 'expenses', icon: <FileText size={14} />, label: 'Expenses' },
    { id: 'reports', icon: <BarChart2 size={14} />, label: 'Reports' },
    { id: 'intelligence', icon: <Brain size={14} />, label: 'AI Insights' },
    { id: 'settings', icon: <Settings size={14} />, label: 'Settings' },
  ];
  return (
    <div className="bg-green-700 text-white sticky top-0 z-40 shadow-lg">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="font-bold text-lg leading-tight">🌾 Smart Biz AI</h1>
          <p className="text-green-200 text-xs">{user.name}</p>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1 bg-green-800 hover:bg-green-900 px-3 py-1.5 rounded-lg text-xs font-medium transition">
          <LogOut size={13} /> Logout
        </button>
      </div>
      <div className="overflow-x-auto scrollbar-none">
        <div className="flex min-w-max px-2 pb-1 gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-t-lg text-xs font-medium whitespace-nowrap transition ${tab === t.id ? 'bg-white text-green-700' : 'text-green-100 hover:bg-green-600'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function AgDashboard({ bunkId, products, customers, onRefresh }: { bunkId: string; products: AgProduct[]; customers: AgCustomer[]; onRefresh: () => void }) {
  const [todaySales, setTodaySales] = useState(0);
  const [todayCash, setTodayCash] = useState(0);
  const [todayCredit, setTodayCredit] = useState(0);
  const [loading, setLoading] = useState(true);
  const season = getCurrentSeason();

  useEffect(() => {
    async function load() {
      const today = getTodayIST();
      const { data: s } = await supabase.from('ag_sales').select('total, payment_mode').eq('bunk_id', bunkId).eq('date', today);
      setTodaySales((s || []).reduce((a, r) => a + Number(r.total || 0), 0));
      setTodayCash((s || []).filter(r => r.payment_mode !== 'credit').reduce((a, r) => a + Number(r.total || 0), 0));
      setTodayCredit((s || []).filter(r => r.payment_mode === 'credit').reduce((a, r) => a + Number(r.total || 0), 0));
      setLoading(false);
    }
    load();
  }, [bunkId]);

  const activeCustomers = customers.filter(c => c.is_active !== false);
  const totalOutstanding = activeCustomers.reduce((a, c) => a + Number(c.outstanding_amount || 0), 0);
  const lowStock = products.filter(p => Number(p.stock_qty) <= Number(p.low_stock_at || 0));
  const stockValue = products.reduce((a, p) => a + Number(p.stock_qty || 0) * Number(p.purchase_rate || 0), 0);

  const overdueMs = 30 * 24 * 60 * 60 * 1000;
  const overdueCustomers = activeCustomers.filter(c =>
    (c.outstanding_amount || 0) > 0 &&
    (!c.last_payment_date || Date.now() - new Date(c.last_payment_date).getTime() > overdueMs)
  );
  const overdueTotal = overdueCustomers.reduce((a, c) => a + Number(c.outstanding_amount || 0), 0);

  const seasonStart = new Date(season.start);
  const seasonEnd = new Date(season.end);
  const today = new Date();
  const daysIntoSeason = Math.max(0, Math.floor((today.getTime() - seasonStart.getTime()) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, Math.floor((seasonEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">Today — {getTodayIST()}</h2>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">{season.emoji} {season.label}</span>
            <p className="text-xs text-gray-400 mt-0.5">Day {daysIntoSeason} · {daysRemaining}d left</p>
          </div>
          <button onClick={onRefresh} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><RefreshCw size={15} /></button>
        </div>
      </div>

      {loading ? <div className="text-center py-8 text-gray-400 text-sm">Loading…</div> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Today Sales', value: inr(todaySales), color: 'text-green-600', sub: `Cash: ${inr(todayCash)}` },
              { label: 'Credit Today', value: inr(todayCredit), color: 'text-amber-600', sub: 'on credit' },
              { label: 'Total Outstanding', value: inr(totalOutstanding), color: 'text-red-600', sub: `${activeCustomers.filter(c => (c.outstanding_amount || 0) > 0).length} farmers` },
              { label: 'Products', value: String(products.length), color: 'text-blue-600', sub: `${lowStock.length} low stock` },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">📦 Inventory Value</p>
              <p className="text-xl font-bold text-green-700 mt-0.5">{inr(stockValue)}</p>
              <p className="text-xs text-gray-400 mt-0.5">at purchase rate</p>
            </div>
            <Package size={28} className="text-green-200" />
          </div>

          {lowStock.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={15} className="text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">Low Stock — {lowStock.length} items</span>
              </div>
              <div className="space-y-1">
                {lowStock.slice(0, 6).map(p => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="text-amber-700">{p.name} <span className="text-gray-400">({p.category})</span></span>
                    <span className="font-semibold text-amber-800">{p.stock_qty} {p.unit}</span>
                  </div>
                ))}
                {lowStock.length > 6 && <p className="text-xs text-amber-600">+{lowStock.length - 6} more items below reorder level</p>}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-700 mb-2">Top Outstanding Farmers</p>
            {activeCustomers.filter(c => (c.outstanding_amount || 0) > 0).sort((a, b) => b.outstanding_amount - a.outstanding_amount).slice(0, 5).map(c => (
              <div key={c.id} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.village || 'No village'}{c.land_area ? ` · ${c.land_area}` : ''}</p>
                </div>
                <span className="text-sm font-semibold text-red-600">{inr(c.outstanding_amount)}</span>
              </div>
            ))}
            {!activeCustomers.filter(c => (c.outstanding_amount || 0) > 0).length && (
              <p className="text-sm text-gray-400 py-2">✅ No outstanding dues</p>
            )}
          </div>

          {overdueCustomers.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={15} className="text-red-600" />
                <span className="text-sm font-semibold text-red-800">⚠️ {overdueCustomers.length} farmer{overdueCustomers.length > 1 ? 's' : ''} overdue 30+ days — {inr(overdueTotal)} pending</span>
              </div>
              <div className="space-y-1">
                {overdueCustomers.slice(0, 5).map(c => (
                  <div key={c.id} className="flex justify-between text-xs">
                    <span className="text-red-700">{c.name}{c.village ? ` (${c.village})` : ''}</span>
                    <span className="font-semibold text-red-800">{inr(c.outstanding_amount)}</span>
                  </div>
                ))}
                {overdueCustomers.length > 5 && <p className="text-xs text-red-500">+{overdueCustomers.length - 5} more</p>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Inventory ──────────────────────────────────────────────────────────────
function AgInventory({ bunkId, products, onRefresh, showToast }: { bunkId: string; products: AgProduct[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ msg: string; onYes: () => void } | null>(null);
  const [adjustModal, setAdjustModal] = useState<AgProduct | null>(null);
  const [adjustType, setAdjustType] = useState<'+' | '-'>('+');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('Physical count');
  const [adjustSaving, setAdjustSaving] = useState(false);
  const blank = { name: '', category: 'Fertilizer', unit: 'bag', purchase_rate: '', selling_rate: '', stock_qty: '', low_stock_at: '5', hsn_code: '' };
  const [form, setForm] = useState(blank);
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleAdjust() {
    if (!adjustModal) return;
    const qty = parseFloat(adjustQty) || 0;
    if (qty <= 0) return;
    setAdjustSaving(true);
    const { data: fresh } = await supabase.from('ag_products').select('stock_qty').eq('id', adjustModal.id).eq('bunk_id', bunkId).maybeSingle();
    const current = fresh ? Number(fresh.stock_qty) : Number(adjustModal.stock_qty);
    const newQty = adjustType === '+' ? current + qty : Math.max(0, current - qty);
    const { error } = await supabase.from('ag_products').update({ stock_qty: newQty }).eq('id', adjustModal.id).eq('bunk_id', bunkId);
    setAdjustSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(`Stock updated: ${adjustType}${qty} (${adjustReason})`);
    setAdjustModal(null); setAdjustQty(''); onRefresh();
  }

  const filtered = products.filter(p =>
    (catFilter === 'All' || p.category === catFilter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSave() {
    if (!form.name.trim()) { showToast('Enter product name', 'error'); return; }
    setSaving(true);
    const payload = {
      bunk_id: bunkId, name: form.name.trim(), category: form.category, unit: form.unit,
      purchase_rate: parseFloat(form.purchase_rate) || 0,
      selling_rate: parseFloat(form.selling_rate) || 0,
      stock_qty: parseFloat(form.stock_qty) || 0,
      low_stock_at: parseFloat(form.low_stock_at) || 5,
      hsn_code: form.hsn_code || '',
    };
    const { error } = editId
      ? await supabase.from('ag_products').update(payload).eq('id', editId).eq('bunk_id', bunkId)
      : await supabase.from('ag_products').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editId ? 'Product updated' : 'Product added');
    setShowForm(false); setEditId(null); setForm(blank); onRefresh();
  }

  function handleDelete(p: AgProduct) {
    setConfirmModal({
      msg: `Delete "${p.name}"?`,
      onYes: async () => {
        const { error } = await supabase.from('ag_products').delete().eq('id', p.id).eq('bunk_id', bunkId);
        if (error) { showToast(error.message, 'error'); return; }
        showToast('Deleted'); onRefresh();
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[140px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400">
          <option>All</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(blank); }} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition">
          <Plus size={14} /> Add
        </button>
      </div>

      {showForm && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-green-800">{editId ? 'Edit Product' : 'Add Product'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Product Name *</label><input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g., Urea 50kg, Paddy Seeds" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Category</label>
              <select value={form.category} onChange={e => setF('category', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-500 mb-1 block">Unit</label>
              <select value={form.unit} onChange={e => setF('unit', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400">
                {['bag', 'kg', 'litre', 'bottle', 'piece', 'packet'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-500 mb-1 block">Purchase Rate (₹)</label><input type="number" min="0" value={form.purchase_rate} onChange={e => setF('purchase_rate', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Selling Rate (₹)</label><input type="number" min="0" value={form.selling_rate} onChange={e => setF('selling_rate', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Current Stock</label><input type="number" min="0" value={form.stock_qty} onChange={e => setF('stock_qty', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Reorder Alert At</label><input type="number" min="0" value={form.low_stock_at} onChange={e => setF('low_stock_at', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" /></div>
            <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">HSN Code (optional)</label><input value={form.hsn_code} onChange={e => setF('hsn_code', e.target.value)} placeholder="e.g., 3102 for fertilizers" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition">{saving ? 'Saving…' : (editId ? 'Update' : 'Add Product')}</button>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(blank); }} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-green-50 text-gray-600 text-xs uppercase sticky top-0">
              <tr><th className="px-4 py-2 text-left">Product</th><th className="px-4 py-2 text-center">Cat.</th><th className="px-4 py-2 text-right">Stock</th><th className="px-4 py-2 text-right">Buy ₹</th><th className="px-4 py-2 text-right">Sell ₹</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No products. Add above.</td></tr>}
              {filtered.map(p => {
                const low = Number(p.stock_qty) <= Number(p.low_stock_at || 0);
                return (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-green-50">
                    <td className="px-4 py-2"><p className="font-medium text-gray-800">{p.name}</p>{p.hsn_code && <p className="text-xs text-gray-400">HSN: {p.hsn_code}</p>}</td>
                    <td className="px-4 py-2 text-center"><span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">{p.category}</span></td>
                    <td className="px-4 py-2 text-right"><span className={low ? 'text-red-600 font-semibold' : 'text-gray-700'}>{p.stock_qty} {p.unit}</span>{low && <span className="ml-1">⚠️</span>}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{inr(p.purchase_rate)}</td>
                    <td className="px-4 py-2 text-right font-medium">{inr(p.selling_rate)}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button onClick={() => { setAdjustModal(p); setAdjustType('+'); setAdjustQty(''); setAdjustReason('Physical count'); }} className="text-green-600 hover:text-green-800 p-1 text-xs font-medium border border-green-200 rounded px-1.5 mr-1">±</button>
                      <button onClick={() => { setEditId(p.id); setForm({ name: p.name, category: p.category, unit: p.unit, purchase_rate: String(p.purchase_rate), selling_rate: String(p.selling_rate), stock_qty: String(p.stock_qty), low_stock_at: String(p.low_stock_at), hsn_code: p.hsn_code || '' }); setShowForm(true); }} className="text-blue-500 hover:text-blue-700 p-1">✏️</button>
                      <button onClick={() => handleDelete(p)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400 text-right">{filtered.length} of {products.length} products</p>
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4">
            <p className="text-gray-800 mb-4">{confirmModal.msg}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={() => { confirmModal.onYes(); setConfirmModal(null); }} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {adjustModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-bold text-gray-800">Adjust Stock — {adjustModal.name}</h3>
            <p className="text-sm text-gray-500">Current: <strong>{adjustModal.stock_qty} {adjustModal.unit}</strong></p>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Adjust Type</label>
              <div className="flex gap-2">
                <button onClick={() => setAdjustType('+')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${adjustType === '+' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>+ Add</button>
                <button onClick={() => setAdjustType('-')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${adjustType === '-' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>- Remove</button>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
              <input type="number" min="0.1" step="0.1" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} autoFocus placeholder="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Reason</label>
              <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400">
                {['Damage', 'Expired', 'Physical count', 'Other'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            {adjustQty && parseFloat(adjustQty) > 0 && (
              <p className="text-xs text-gray-500">New stock: <strong>{adjustType === '+' ? Number(adjustModal.stock_qty) + parseFloat(adjustQty) : Math.max(0, Number(adjustModal.stock_qty) - parseFloat(adjustQty))} {adjustModal.unit}</strong></p>
            )}
            <div className="flex gap-2">
              <button onClick={handleAdjust} disabled={adjustSaving} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 transition">{adjustSaving ? 'Saving…' : 'Apply Adjustment'}</button>
              <button onClick={() => setAdjustModal(null)} className="border border-gray-300 text-gray-600 px-4 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sales ──────────────────────────────────────────────────────────────────
interface CartItem { product: AgProduct; quantity: number; unit_price: number; }

function AgSales({ bunkId, products, customers, onRefresh, showToast }: { bunkId: string; products: AgProduct[]; customers: AgCustomer[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [view, setView] = useState<'pos' | 'history'>('pos');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'credit'>('cash');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [saleDate, setSaleDate] = useState(getTodayIST());
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<AgSale[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  function addToCart(p: AgProduct) {
    setCart(prev => {
      const ex = prev.find(i => i.product.id === p.id);
      if (ex) return prev.map(i => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product: p, quantity: 1, unit_price: p.selling_rate }];
    });
  }

  const subtotal = cart.reduce((a, i) => a + i.quantity * i.unit_price, 0);
  const total = Math.max(0, subtotal - discount);

  async function handleSell() {
    if (!cart.length) { showToast('Add items to cart', 'error'); return; }
    if (paymentMode === 'credit' && !customerId) { showToast('Select a farmer for credit sale', 'error'); return; }
    setSaving(true);

    const items = cart.map(i => ({ name: i.product.name, qty: i.quantity, unit: i.product.unit, rate: i.unit_price, total: i.quantity * i.unit_price }));
    const custName = customerId ? (customers.find(c => c.id === customerId)?.name || 'Unknown') : 'Walk-in';

    const { error } = await supabase.from('ag_sales').insert({
      bunk_id: bunkId, date: saleDate, customer_id: customerId || null, customer_name: custName,
      items, subtotal, discount, total, payment_mode: paymentMode, notes: notes || null,
    });
    if (error) { showToast(error.message, 'error'); setSaving(false); return; }

    // Update stock (fresh read to avoid race condition)
    const { data: freshStocks } = await supabase.from('ag_products').select('id, stock_qty').in('id', cart.map(i => i.product.id)).eq('bunk_id', bunkId);
    const stockMap: Record<string, number> = {};
    freshStocks?.forEach(s => { stockMap[s.id] = Number(s.stock_qty); });
    for (const item of cart) {
      const fresh = stockMap[item.product.id] ?? Number(item.product.stock_qty);
      await supabase.from('ag_products').update({ stock_qty: Math.max(0, fresh - item.quantity) }).eq('id', item.product.id).eq('bunk_id', bunkId);
    }

    // Update customer outstanding on credit sale (fresh read)
    if (paymentMode === 'credit' && customerId) {
      const { data: freshCust } = await supabase.from('ag_customers').select('outstanding_amount').eq('id', customerId).eq('bunk_id', bunkId).maybeSingle();
      const base = freshCust ? Number(freshCust.outstanding_amount) : (Number(customers.find(c => c.id === customerId)?.outstanding_amount) || 0);
      await supabase.from('ag_customers').update({ outstanding_amount: base + total }).eq('id', customerId).eq('bunk_id', bunkId);
    }

    showToast('Sale recorded!');
    setCart([]); setDiscount(0); setNotes(''); setCustomerId(''); setPaymentMode('cash'); setSaleDate(getTodayIST());
    setSaving(false); onRefresh();
  }

  useEffect(() => {
    if (view === 'history') {
      setHistLoading(true);
      supabase.from('ag_sales').select('*').eq('bunk_id', bunkId).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(50).then(({ data }) => { setHistory(data || []); setHistLoading(false); });
    }
  }, [view, bunkId]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200">
        {(['pos', 'history'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === v ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {v === 'pos' ? '🛒 New Sale' : '📋 History'}
          </button>
        ))}
      </div>

      {view === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search seeds, fertilizer, pesticide…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-green-50 text-gray-600 text-xs uppercase sticky top-0">
                    <tr><th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2 text-center">Cat.</th><th className="px-3 py-2 text-right">Stock</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2"></th></tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-sm">No products. Add from Inventory tab.</td></tr>}
                    {filteredProducts.map(p => (
                      <tr key={p.id} className="border-t border-gray-100 hover:bg-green-50">
                        <td className="px-3 py-2 font-medium text-gray-800">{p.name}</td>
                        <td className="px-3 py-2 text-center text-xs text-gray-500">{p.category}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{p.stock_qty} {p.unit}</td>
                        <td className="px-3 py-2 text-right">{inr(p.selling_rate)}/{p.unit}</td>
                        <td className="px-3 py-2 text-right"><button onClick={() => addToCart(p)} disabled={p.stock_qty <= 0} className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-40"><Plus size={11} className="inline" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h3 className="font-semibold text-gray-800">Cart</h3>
              {cart.length === 0 && <p className="text-gray-400 text-sm py-2">No items yet</p>}
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{item.product.name}</p>
                    <p className="text-xs text-gray-400">{inr(item.unit_price)}/{item.product.unit}</p>
                  </div>
                  <input type="number" min="0.1" step="0.1" value={item.quantity}
                    onChange={e => setCart(prev => prev.map(i => i.product.id === item.product.id ? { ...i, quantity: parseFloat(e.target.value) || 0 } : i))}
                    className="w-16 border border-gray-200 rounded px-2 py-1 text-xs text-right" />
                  <span className="text-xs font-medium w-16 text-right">{inr(item.quantity * item.unit_price)}</span>
                  <button onClick={() => setCart(prev => prev.filter(i => i.product.id !== item.product.id))} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                </div>
              ))}

              {cart.length > 0 && (
                <>
                  <div className="border-t pt-2 space-y-1.5">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>{inr(subtotal)}</span></div>
                    <div className="flex items-center gap-2"><span className="text-sm text-gray-500 flex-1">Discount</span><input type="number" min="0" value={discount || ''} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-right" /></div>
                    <div className="flex justify-between font-bold text-base"><span>Total</span><span className="text-green-600">{inr(total)}</span></div>
                  </div>

                  <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>

                  <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label>
                    <div className="flex gap-1">
                      {(['cash', 'upi', 'credit'] as const).map(m => (
                        <button key={m} onClick={() => setPaymentMode(m)} className={`flex-1 py-1.5 text-xs rounded-lg font-medium capitalize transition ${paymentMode === m ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{m}</button>
                      ))}
                    </div>
                  </div>

                  {paymentMode === 'credit' && (
                    <div><label className="text-xs text-gray-500 mb-1 block">Select Farmer *</label>
                      <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400">
                        <option value="">Select farmer…</option>
                        {customers.filter(c => c.is_active !== false).map(c => <option key={c.id} value={c.id}>{c.name}{c.village ? ` — ${c.village}` : ''}</option>)}
                      </select>
                    </div>
                  )}

                  <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., for paddy crop, Kharif season" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>

                  <button onClick={handleSell} disabled={saving} className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-semibold text-sm transition disabled:opacity-50">
                    {saving ? 'Saving…' : `Record Sale — ${inr(total)}`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {histLoading ? <p className="text-center py-8 text-gray-400 text-sm">Loading…</p> : (
            <div className="divide-y divide-gray-100">
              {history.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No sales yet</p>}
              {history.map(s => (
                <div key={s.id} className="px-4 py-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.customer_name}</p>
                      <p className="text-xs text-gray-400">{s.date} · {s.items?.length || 0} item(s)</p>
                      {s.items?.length > 0 && <p className="text-xs text-gray-500 mt-0.5">{s.items.slice(0, 3).map(i => `${i.qty} ${i.unit} ${i.name}`).join(', ')}{s.items.length > 3 ? '…' : ''}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-800">{inr(s.total)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.payment_mode === 'credit' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{s.payment_mode}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function agingBadge(lastDate: string | null | undefined) {
  const d = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : 999;
  if (d < 8) return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{d}d</span>;
  if (d < 31) return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{d}d</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">{d === 999 ? 'new' : d + 'd'}</span>;
}

const CUST_PAGE_SIZE = 10;

// ── Farmers ────────────────────────────────────────────────────────────────
function AgFarmers({ bunkId, customers, onRefresh, showToast }: { bunkId: string; customers: AgCustomer[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [view, setView] = useState<'list' | 'payments'>('list');
  const [custPage, setCustPage] = useState(0);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [payModal, setPayModal] = useState<AgCustomer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [payNote, setPayNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [payments, setPayments] = useState<AgPayment[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ msg: string; onYes: () => void } | null>(null);
  const [ledgerCustomer, setLedgerCustomer] = useState<AgCustomer | null>(null);
  const [ledgerSales, setLedgerSales] = useState<AgSale[]>([]);
  const [ledgerPayments, setLedgerPayments] = useState<AgPayment[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const blank = { name: '', phone: '', village: '', land_area: '', credit_limit: '0' };
  const [form, setForm] = useState(blank);
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function openLedger(c: AgCustomer) {
    setLedgerCustomer(c);
    setLedgerLoading(true);
    const [salesRes, payRes] = await Promise.all([
      supabase.from('ag_sales').select('*').eq('bunk_id', bunkId).eq('customer_id', c.id).order('date', { ascending: false }).limit(20),
      supabase.from('ag_payments').select('*').eq('bunk_id', bunkId).eq('customer_id', c.id).order('payment_date', { ascending: false }).limit(20),
    ]);
    setLedgerSales(salesRes.data || []);
    setLedgerPayments(payRes.data || []);
    setLedgerLoading(false);
  }

  const active = customers.filter(c => c.is_active !== false);
  const filtered = active.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.village || '').toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => (b.outstanding_amount || 0) - (a.outstanding_amount || 0));

  async function handleSave() {
    if (!form.name.trim()) { showToast('Enter farmer name', 'error'); return; }
    setSaving(true);
    const payload = { bunk_id: bunkId, name: form.name.trim(), phone: form.phone.trim(), village: form.village.trim(), land_area: form.land_area.trim(), credit_limit: parseFloat(form.credit_limit) || 0, is_active: true };
    const { error } = editId
      ? await supabase.from('ag_customers').update(payload).eq('id', editId).eq('bunk_id', bunkId)
      : await supabase.from('ag_customers').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editId ? 'Farmer updated' : 'Farmer added');
    setShowForm(false); setEditId(null); setForm(blank); onRefresh();
  }

  async function handlePayment() {
    if (!payModal) return;
    const amt = parseFloat(payAmount) || 0;
    if (amt <= 0) { showToast('Enter valid amount', 'error'); return; }
    setSaving(true);
    const today = getTodayIST();
    const { error } = await supabase.from('ag_payments').insert({ bunk_id: bunkId, customer_id: payModal.id, customer_name: payModal.name, amount: amt, payment_mode: payMode, payment_date: today, notes: payNote || null });
    if (error) { showToast(error.message, 'error'); setSaving(false); return; }
    const { data: fresh } = await supabase.from('ag_customers').select('outstanding_amount').eq('id', payModal.id).eq('bunk_id', bunkId).maybeSingle();
    const base = fresh ? Number(fresh.outstanding_amount) : Number(payModal.outstanding_amount);
    await supabase.from('ag_customers').update({ outstanding_amount: Math.max(0, base - amt), last_payment_date: today }).eq('id', payModal.id).eq('bunk_id', bunkId);
    setSaving(false);
    showToast(`Payment of ${inr(amt)} recorded`);
    setPayModal(null); setPayAmount(''); setPayNote(''); onRefresh();
  }

  function deactivateFarmer(c: AgCustomer) {
    setConfirmModal({
      msg: `Deactivate "${c.name}"? They will be hidden from the list.`,
      onYes: async () => {
        await supabase.from('ag_customers').update({ is_active: false }).eq('id', c.id).eq('bunk_id', bunkId);
        showToast('Farmer deactivated'); onRefresh();
      },
    });
  }

  useEffect(() => {
    if (view === 'payments') {
      supabase.from('ag_payments').select('*').eq('bunk_id', bunkId).order('payment_date', { ascending: false }).limit(60).then(({ data }) => setPayments(data || []));
    }
  }, [view, bunkId]);

  const totalOutstanding = active.reduce((a, c) => a + Number(c.outstanding_amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200">
        {(['list', 'payments'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === v ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'}`}>
            {v === 'list' ? '👨‍🌾 Farmers' : '💳 Payments'}
          </button>
        ))}
      </div>

      {view === 'list' && (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or village…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <button onClick={() => { setShowForm(true); setEditId(null); setForm(blank); }} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition">
              <Plus size={14} /> Add
            </button>
          </div>

          {showForm && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-green-800">{editId ? 'Edit Farmer' : 'Add Farmer'}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Name *</label><input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Farmer name" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Phone</label><input value={form.phone} onChange={e => setF('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Village</label><input value={form.village} onChange={e => setF('village', e.target.value)} placeholder="Village name" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Land Area</label><input value={form.land_area} onChange={e => setF('land_area', e.target.value)} placeholder="e.g., 5 acres" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Credit Limit (₹)</label><input type="number" min="0" value={form.credit_limit} onChange={e => setF('credit_limit', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : (editId ? 'Update' : 'Add Farmer')}</button>
                <button onClick={() => { setShowForm(false); setEditId(null); }} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex justify-between items-center">
            <span className="text-sm text-amber-800 font-medium">Total Outstanding</span>
            <span className="text-base font-bold text-red-600">{inr(totalOutstanding)}</span>
          </div>

          <div className="space-y-2">
            {filtered.length === 0 && <div className="text-center py-8 text-gray-400 text-sm">No farmers found</div>}
            {filtered.slice(custPage * CUST_PAGE_SIZE, (custPage + 1) * CUST_PAGE_SIZE).map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-500">{[c.village, c.land_area, c.phone].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className={`font-bold text-base ${(c.outstanding_amount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{inr(c.outstanding_amount || 0)}</p>
                    {(c.outstanding_amount || 0) > 0 && agingBadge(c.last_payment_date)}
                    {(c.credit_limit || 0) > 0 && <p className="text-xs text-gray-400">Limit: {inr(c.credit_limit)}</p>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button onClick={() => { setEditId(c.id); setForm({ name: c.name, phone: c.phone || '', village: c.village || '', land_area: c.land_area || '', credit_limit: String(c.credit_limit || 0) }); setShowForm(true); }} className="border border-gray-200 text-gray-600 px-3 py-1 rounded-lg text-xs hover:bg-gray-50">✏️ Edit</button>
                  {(c.outstanding_amount || 0) > 0 && <button onClick={() => { setPayModal(c); setPayAmount(''); setPayNote(''); }} className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded-lg text-xs font-medium">💳 Collect Payment</button>}
                  <button onClick={() => openLedger(c)} className="border border-blue-200 text-blue-600 px-3 py-1 rounded-lg text-xs hover:bg-blue-50">📒 View Ledger</button>
                  <button onClick={() => deactivateFarmer(c)} className="border border-red-200 text-red-500 px-3 py-1 rounded-lg text-xs hover:bg-red-50">Deactivate</button>
                </div>
              </div>
            ))}
          </div>
          {filtered.length > CUST_PAGE_SIZE && (
            <div className="flex items-center justify-between px-1 py-2 text-sm text-gray-600">
              <span>{custPage * CUST_PAGE_SIZE + 1}–{Math.min((custPage + 1) * CUST_PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div className="flex gap-2">
                <button disabled={custPage === 0} onClick={() => setCustPage(p => p - 1)} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Prev</button>
                <button disabled={(custPage + 1) * CUST_PAGE_SIZE >= filtered.length} onClick={() => setCustPage(p => p + 1)} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          )}

          {payModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
                <h3 className="font-bold text-gray-800">Collect Payment — {payModal.name}</h3>
                <p className="text-sm text-red-600 font-medium">Outstanding: {inr(payModal.outstanding_amount)}</p>
                <div><label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label><input type="number" min="0" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0" autoFocus className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label>
                  <div className="flex gap-1 flex-wrap">
                    {['cash', 'upi', 'bank_transfer', 'cheque'].map(m => (
                      <button key={m} onClick={() => setPayMode(m)} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${payMode === m ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{m.replace('_', ' ')}</button>
                    ))}
                  </div>
                </div>
                <div><label className="text-xs text-gray-500 mb-1 block">Note</label><input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="e.g., after harvest, advance" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div className="flex gap-2">
                  <button onClick={handlePayment} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Record Payment'}</button>
                  <button onClick={() => setPayModal(null)} className="border border-gray-300 text-gray-600 px-4 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {ledgerCustomer && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-gray-100 flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-800">📒 Ledger — {ledgerCustomer.name}</h3>
                    <p className="text-xs text-gray-500">{[ledgerCustomer.village, ledgerCustomer.phone].filter(Boolean).join(' · ')}</p>
                  </div>
                  <button onClick={() => setLedgerCustomer(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
                </div>
                <div className="overflow-y-auto flex-1 p-4">
                  {ledgerLoading ? (
                    <p className="text-center py-8 text-gray-400 text-sm">Loading…</p>
                  ) : (() => {
                    const totalSold = ledgerSales.reduce((a, s) => a + Number(s.total || 0), 0);
                    const totalPaid = ledgerPayments.reduce((a, p) => a + Number(p.amount || 0), 0);
                    const balance = totalSold - totalPaid;
                    type LedgerEntry = { date: string; type: 'sale' | 'payment'; label: string; amount: number; mode: string; id: string; };
                    const entries: LedgerEntry[] = [
                      ...ledgerSales.map(s => ({ date: s.date, type: 'sale' as const, label: `Sale: ${s.items?.length || 0} item(s)${s.items?.length ? ' — ' + s.items.slice(0, 2).map(i => i.name).join(', ') : ''}`, amount: s.total, mode: s.payment_mode, id: s.id })),
                      ...ledgerPayments.map(p => ({ date: p.payment_date, type: 'payment' as const, label: `Payment received`, amount: p.amount, mode: p.payment_mode, id: p.id })),
                    ].sort((a, b) => b.date.localeCompare(a.date));
                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-red-50 rounded-lg p-2.5 text-center"><p className="text-xs text-gray-500">Total Sold</p><p className="font-bold text-red-600 text-sm">{inr(totalSold)}</p></div>
                          <div className="bg-green-50 rounded-lg p-2.5 text-center"><p className="text-xs text-gray-500">Total Paid</p><p className="font-bold text-green-600 text-sm">{inr(totalPaid)}</p></div>
                          <div className="bg-amber-50 rounded-lg p-2.5 text-center"><p className="text-xs text-gray-500">Balance</p><p className="font-bold text-amber-700 text-sm">{inr(balance)}</p></div>
                        </div>
                        {entries.length === 0 && <p className="text-center py-6 text-gray-400 text-sm">No transactions yet</p>}
                        {entries.map(e => (
                          <div key={e.id} className={`flex justify-between items-start p-3 rounded-xl ${e.type === 'sale' ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
                            <div>
                              <p className="text-xs font-semibold text-gray-700">{e.label}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{e.date} · {e.mode}</p>
                            </div>
                            <span className={`text-sm font-bold ${e.type === 'sale' ? 'text-red-600' : 'text-green-600'}`}>
                              {e.type === 'sale' ? '-' : '+'}{inr(e.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div className="p-4 border-t border-gray-100">
                  <button onClick={() => setLedgerCustomer(null)} className="w-full border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50">Close</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {view === 'payments' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {payments.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No payments yet</p>}
            {payments.map(p => (
              <div key={p.id} className="flex justify-between items-center px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.customer_name}</p>
                  <p className="text-xs text-gray-400">{p.payment_date} · {p.payment_mode}{p.notes ? ` · ${p.notes}` : ''}</p>
                </div>
                <span className="text-sm font-bold text-green-600">{inr(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4">
            <p className="text-gray-800 mb-4">{confirmModal.msg}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={() => { confirmModal.onYes(); setConfirmModal(null); }} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Purchases ──────────────────────────────────────────────────────────────
function AgPurchases({ bunkId, onRefresh, showToast }: { bunkId: string; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [purchases, setPurchases] = useState<AgPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const blank = { date: getTodayIST(), supplier_name: '', product_name: '', category: 'Fertilizer', quantity: '', unit: 'bag', rate_per_unit: '', payment_mode: 'cash', notes: '' };
  const [form, setForm] = useState(blank);
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const total = (parseFloat(form.quantity) || 0) * (parseFloat(form.rate_per_unit) || 0);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('ag_purchases').select('*').eq('bunk_id', bunkId).order('date', { ascending: false }).limit(60);
    setPurchases(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [bunkId]);

  async function handleSave() {
    if (!form.product_name.trim() || !form.supplier_name.trim()) { showToast('Enter supplier and product name', 'error'); return; }
    const qty = parseFloat(form.quantity) || 0;
    const rate = parseFloat(form.rate_per_unit) || 0;
    if (!qty || !rate) { showToast('Enter quantity and rate', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('ag_purchases').insert({ bunk_id: bunkId, date: form.date, supplier_name: form.supplier_name.trim(), product_name: form.product_name.trim(), category: form.category, quantity: qty, unit: form.unit, rate_per_unit: rate, total_amount: qty * rate, payment_mode: form.payment_mode, notes: form.notes || null });
    if (error) { showToast(error.message, 'error'); setSaving(false); return; }
    // Auto-update matching product stock
    const { data: prod } = await supabase.from('ag_products').select('id, stock_qty').eq('bunk_id', bunkId).ilike('name', `%${form.product_name.trim().split(' ')[0]}%`).limit(1).maybeSingle();
    if (prod) await supabase.from('ag_products').update({ stock_qty: Number(prod.stock_qty) + qty }).eq('id', prod.id).eq('bunk_id', bunkId);
    setSaving(false);
    showToast('Purchase recorded' + (prod ? ' — stock updated' : ''));
    setShowForm(false); setForm(blank); load(); onRefresh();
  }

  const totalValue = purchases.reduce((a, p) => a + p.total_amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="font-semibold text-gray-800">Stock Purchases</h2><p className="text-xs text-gray-500">Total: {inr(totalValue)}</p></div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition"><Plus size={14} /> Add</button>
      </div>

      {showForm && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-green-800">Record Purchase</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={form.date} onChange={e => setF('date', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Category</label><select value={form.category} onChange={e => setF('category', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Product Name *</label><input value={form.product_name} onChange={e => setF('product_name', e.target.value)} placeholder="e.g., Urea 50kg" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Supplier / Company *</label><input value={form.supplier_name} onChange={e => setF('supplier_name', e.target.value)} placeholder="Distributor name" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Qty *</label><input type="number" min="0" value={form.quantity} onChange={e => setF('quantity', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Unit</label><select value={form.unit} onChange={e => setF('unit', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">{['bag', 'kg', 'litre', 'bottle', 'piece'].map(u => <option key={u}>{u}</option>)}</select></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Rate/Unit (₹) *</label><input type="number" min="0" value={form.rate_per_unit} onChange={e => setF('rate_per_unit', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Total</label><div className="border border-gray-200 bg-green-50 rounded-lg px-3 py-2 text-sm font-bold text-green-700">{inr(total)}</div></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Payment</label><select value={form.payment_mode} onChange={e => setF('payment_mode', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"><option value="cash">Cash</option><option value="upi">UPI</option><option value="credit">Credit</option><option value="bank_transfer">Bank Transfer</option></select></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={form.notes} onChange={e => setF('notes', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Record'}</button>
            <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? <p className="text-center py-8 text-gray-400 text-sm">Loading…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-green-50 text-gray-600 text-xs uppercase">
                <tr><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Product</th><th className="px-4 py-2 text-left">Supplier</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-right">Mode</th></tr>
              </thead>
              <tbody>
                {purchases.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No purchases yet</td></tr>}
                {purchases.map(p => (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-green-50">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{p.date}</td>
                    <td className="px-4 py-2"><p className="font-medium text-gray-800">{p.product_name}</p><p className="text-xs text-gray-400">{p.category}</p></td>
                    <td className="px-4 py-2 text-gray-600">{p.supplier_name}</td>
                    <td className="px-4 py-2 text-right">{p.quantity} {p.unit}</td>
                    <td className="px-4 py-2 text-right font-semibold">{inr(p.total_amount)}</td>
                    <td className="px-4 py-2 text-right text-xs text-gray-500">{p.payment_mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Expenses ───────────────────────────────────────────────────────────────
function AgExpenses({ bunkId, onRefresh, showToast }: { bunkId: string; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [expenses, setExpenses] = useState<AgExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const blank = { date: getTodayIST(), category: 'Other', amount: '', description: '', payment_mode: 'cash' };
  const [form, setForm] = useState(blank);
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('ag_expenses').select('*').eq('bunk_id', bunkId).order('date', { ascending: false }).limit(60);
    setExpenses(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [bunkId]);

  async function handleSave() {
    const amt = parseFloat(form.amount) || 0;
    if (!amt) { showToast('Enter amount', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('ag_expenses').insert({ bunk_id: bunkId, date: form.date, category: form.category, amount: amt, description: form.description || '', payment_mode: form.payment_mode });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Expense saved'); setShowForm(false); setForm(blank); load(); onRefresh();
  }

  const totalExp = expenses.reduce((a, e) => a + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="font-semibold text-gray-800">Expenses</h2><p className="text-xs text-gray-500">Total: {inr(totalExp)}</p></div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition"><Plus size={14} /> Add</button>
      </div>

      {showForm && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={form.date} onChange={e => setF('date', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Category</label><select value={form.category} onChange={e => setF('category', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">{EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label><input type="number" min="0" value={form.amount} onChange={e => setF('amount', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Payment</label><select value={form.payment_mode} onChange={e => setF('payment_mode', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank</option></select></div>
            <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Description</label><input value={form.description} onChange={e => setF('description', e.target.value)} placeholder="e.g., Labour charges, Transport" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <p className="text-center py-8 text-gray-400 text-sm">Loading…</p> : (
          <div className="divide-y divide-gray-100">
            {expenses.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No expenses yet</p>}
            {expenses.map(e => (
              <div key={e.id} className="flex justify-between items-center px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{e.description || e.category}</p>
                  <p className="text-xs text-gray-400">{e.date} · {e.category} · {e.payment_mode}</p>
                </div>
                <span className="text-sm font-bold text-red-600">{inr(e.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reports ────────────────────────────────────────────────────────────────
function AgReports({ bunkId }: { bunkId: string }) {
  const [period, setPeriod] = useState<'today' | 'month' | 'season'>('today');
  const [reportData, setReportData] = useState<{ sales: number; cash: number; credit: number; expenses: number; payments: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const season = getCurrentSeason();

  const loadReport = useCallback(async () => {
    setLoading(true);
    const today = getTodayIST();
    let start = today, end = today;
    if (period === 'month') {
      const d = new Date();
      start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      end = today;
    } else if (period === 'season') {
      start = season.start;
      end = today < season.end ? today : season.end;
    }

    const [salesRes, expRes, payRes] = await Promise.all([
      supabase.from('ag_sales').select('total, payment_mode').eq('bunk_id', bunkId).gte('date', start).lte('date', end),
      supabase.from('ag_expenses').select('amount').eq('bunk_id', bunkId).gte('date', start).lte('date', end),
      supabase.from('ag_payments').select('amount').eq('bunk_id', bunkId).gte('payment_date', start).lte('payment_date', end),
    ]);

    const s = salesRes.data || [];
    const totalSales = s.reduce((a, r) => a + Number(r.total || 0), 0);
    const cashSales = s.filter(r => r.payment_mode !== 'credit').reduce((a, r) => a + Number(r.total || 0), 0);
    const creditSales = s.filter(r => r.payment_mode === 'credit').reduce((a, r) => a + Number(r.total || 0), 0);
    const totalExp = (expRes.data || []).reduce((a, e) => a + Number(e.amount || 0), 0);
    const totalPay = (payRes.data || []).reduce((a, p) => a + Number(p.amount || 0), 0);
    setReportData({ sales: totalSales, cash: cashSales, credit: creditSales, expenses: totalExp, payments: totalPay });
    setLoading(false);
  }, [bunkId, period, season.start, season.end]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const periodLabel = period === 'today' ? `Today (${getTodayIST()})` : period === 'month' ? 'This Month' : `${season.emoji} ${season.label} Season`;

  function handleExportCSV() {
    if (!reportData) return;
    const rows = [
      ['Metric', 'Value'],
      ['Period', periodLabel],
      ['Total Sales', reportData.sales],
      ['Cash / UPI Sales', reportData.cash],
      ['Credit Sales', reportData.credit],
      ['Payments Received', reportData.payments],
      ['Expenses', reportData.expenses],
      ['Net (Cash basis)', reportData.cash + reportData.payments - reportData.expenses],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `agriculture-report-${period}.csv`; a.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        {(['today', 'month', 'season'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`flex-1 py-2 text-sm font-medium rounded-lg transition capitalize ${period === p ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {p === 'season' ? `${season.emoji} Season` : p}
          </button>
        ))}
        {reportData && <button onClick={handleExportCSV} className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-50"><Download size={14} /></button>}
      </div>

      {loading ? <div className="text-center py-8 text-gray-400 text-sm">Loading…</div> : reportData && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800">{periodLabel}</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Sales', value: inr(reportData.sales), color: 'text-green-600' },
              { label: 'Cash / UPI', value: inr(reportData.cash), color: 'text-emerald-600' },
              { label: 'Credit Sales', value: inr(reportData.credit), color: 'text-amber-600' },
              { label: 'Payments In', value: inr(reportData.payments), color: 'text-blue-600' },
              { label: 'Expenses', value: inr(reportData.expenses), color: 'text-red-600' },
              { label: 'Net (Cash basis)', value: inr(reportData.cash + reportData.payments - reportData.expenses), color: 'text-purple-600' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 space-y-1">
            <p className="font-semibold">📊 {periodLabel} Summary</p>
            <p>Cash + UPI collected: <strong>{inr(reportData.cash)}</strong></p>
            <p>Farmer payments received: <strong>{inr(reportData.payments)}</strong></p>
            <p>Expenses paid: <strong>{inr(reportData.expenses)}</strong></p>
            <p className="font-bold text-green-700 border-t border-green-200 pt-1 mt-1">Net in hand: {inr(reportData.cash + reportData.payments - reportData.expenses)}</p>
            <p className="text-xs text-gray-500">Credit sales of {inr(reportData.credit)} still outstanding from farmers.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────
function AgSettings({ bunkId, onLogout, showToast }: { bunkId: string; onLogout: () => void; showToast: (m: string, t?: 'success' | 'error') => void }) {
  const [bunkName, setBunkName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('bunks').select('name, owner_phone').eq('id', bunkId).maybeSingle().then(({ data }) => {
      if (data) { setBunkName(data.name || ''); setPhone(data.owner_phone || ''); }
    });
  }, [bunkId]);

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase.from('bunks').update({ name: bunkName }).eq('id', bunkId);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Settings saved');
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <h2 className="font-semibold text-gray-800">Shop Settings</h2>
        <div><label className="text-xs text-gray-500 mb-1 block">Shop Name</label><input value={bunkName} onChange={e => setBunkName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
        <div><label className="text-xs text-gray-500 mb-1 block">Owner Phone (read-only)</label><input value={phone} disabled className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" /></div>
        <button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition">{saving ? 'Saving…' : 'Save Changes'}</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-3">WhatsApp Bot Commands</h3>
        <div className="space-y-1.5 text-xs text-gray-600">
          {[
            ['Ramu ne 5 bag urea liya 2500', 'Credit sale to farmer'],
            ['Ramu ne 3000 diya', 'Payment received'],
            ['100 bag DAP vacchindi', 'Add stock'],
            ['urea stock', 'Check product stock'],
            ['low stock', 'See all low-stock items'],
            ['today report', "Today's summary"],
            ['season report', 'Kharif / Rabi season P&L'],
            ['farmers', 'List farmers with dues'],
            ['Ramu balance', "Farmer's outstanding"],
            ['expense 500 labour', 'Log an expense'],
            ['overdue 30 days', 'Farmers overdue 30+ days'],
          ].map(([cmd, desc]) => (
            <div key={cmd} className="flex justify-between gap-2">
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">{cmd}</code>
              <span className="text-gray-400 text-right">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onLogout} className="w-full border border-red-200 text-red-600 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition">Logout</button>
    </div>
  );
}

// ── Onboarding Wizard ──────────────────────────────────────────────────────
interface OnboardingProduct { name: string; unit: string; category: string; purchase_rate: number; selling_rate: number; stock_qty: number; included: boolean; }
interface OnboardingFarmer { name: string; phone: string; village: string; outstanding: number; included: boolean; }

const ONBOARDING_FERTILIZERS: OnboardingProduct[] = [
  { name: 'Urea 50kg', unit: 'bag', category: 'Fertilizer', purchase_rate: 240, selling_rate: 266, stock_qty: 0, included: true },
  { name: 'DAP 50kg', unit: 'bag', category: 'Fertilizer', purchase_rate: 1200, selling_rate: 1350, stock_qty: 0, included: true },
  { name: 'MOP 50kg', unit: 'bag', category: 'Fertilizer', purchase_rate: 700, selling_rate: 800, stock_qty: 0, included: true },
  { name: 'NPK 50kg', unit: 'bag', category: 'Fertilizer', purchase_rate: 1100, selling_rate: 1250, stock_qty: 0, included: true },
  { name: 'SSP 50kg', unit: 'bag', category: 'Fertilizer', purchase_rate: 320, selling_rate: 380, stock_qty: 0, included: true },
  { name: 'Zinc Sulphate 5kg', unit: 'bag', category: 'Fertilizer', purchase_rate: 180, selling_rate: 220, stock_qty: 0, included: true },
  { name: 'Boron 1kg', unit: 'packet', category: 'Fertilizer', purchase_rate: 120, selling_rate: 150, stock_qty: 0, included: true },
];
const ONBOARDING_SEEDS: OnboardingProduct[] = [
  { name: 'Paddy Seeds (BPT) 5kg', unit: 'packet', category: 'Seeds', purchase_rate: 200, selling_rate: 250, stock_qty: 0, included: true },
  { name: 'Cotton Seeds 450g', unit: 'packet', category: 'Seeds', purchase_rate: 750, selling_rate: 900, stock_qty: 0, included: true },
  { name: 'Maize Seeds 5kg', unit: 'packet', category: 'Seeds', purchase_rate: 350, selling_rate: 420, stock_qty: 0, included: true },
  { name: 'Groundnut Seeds 10kg', unit: 'kg', category: 'Seeds', purchase_rate: 80, selling_rate: 100, stock_qty: 0, included: true },
  { name: 'Chilli Seeds 100g', unit: 'packet', category: 'Seeds', purchase_rate: 150, selling_rate: 200, stock_qty: 0, included: true },
  { name: 'Tomato Seeds 50g', unit: 'packet', category: 'Seeds', purchase_rate: 80, selling_rate: 110, stock_qty: 0, included: true },
  { name: 'Sunflower Seeds 5kg', unit: 'packet', category: 'Seeds', purchase_rate: 300, selling_rate: 380, stock_qty: 0, included: true },
];
const ONBOARDING_PESTICIDES: OnboardingProduct[] = [
  { name: 'Chlorpyrifos 500ml', unit: 'bottle', category: 'Pesticide', purchase_rate: 180, selling_rate: 220, stock_qty: 0, included: true },
  { name: 'Imidacloprid 100ml', unit: 'bottle', category: 'Pesticide', purchase_rate: 150, selling_rate: 190, stock_qty: 0, included: true },
  { name: 'Profenofos 1L', unit: 'bottle', category: 'Pesticide', purchase_rate: 350, selling_rate: 420, stock_qty: 0, included: true },
  { name: 'Acephate 75g', unit: 'packet', category: 'Pesticide', purchase_rate: 80, selling_rate: 100, stock_qty: 0, included: true },
  { name: 'Pendimethalin 1L', unit: 'bottle', category: 'Herbicide', purchase_rate: 280, selling_rate: 340, stock_qty: 0, included: true },
  { name: '2,4-D 500ml', unit: 'bottle', category: 'Herbicide', purchase_rate: 120, selling_rate: 150, stock_qty: 0, included: true },
  { name: 'Glyphosate 1L', unit: 'bottle', category: 'Herbicide', purchase_rate: 200, selling_rate: 250, stock_qty: 0, included: true },
];
const ONBOARDING_OTHERS: OnboardingProduct[] = [
  { name: 'Neemicide 1L', unit: 'bottle', category: 'Bio-product', purchase_rate: 150, selling_rate: 190, stock_qty: 0, included: true },
  { name: 'Trichoderma 500g', unit: 'packet', category: 'Bio-product', purchase_rate: 80, selling_rate: 100, stock_qty: 0, included: true },
  { name: 'Sprayer Hand 16L', unit: 'piece', category: 'Tool', purchase_rate: 800, selling_rate: 1000, stock_qty: 0, included: true },
  { name: 'PP Bags 100nos', unit: 'piece', category: 'Other', purchase_rate: 150, selling_rate: 200, stock_qty: 0, included: true },
];

function ProductTable({ rows, setRows }: { rows: OnboardingProduct[]; setRows: (r: OnboardingProduct[]) => void }) {
  const [customRow, setCustomRow] = useState({ name: '', unit: 'bag', category: 'Other', purchase_rate: '', selling_rate: '', stock_qty: '' });

  function updateRow(i: number, field: keyof OnboardingProduct, val: string | number | boolean) {
    const updated = rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    setRows(updated);
  }

  function addCustom() {
    if (!customRow.name.trim()) return;
    setRows([...rows, {
      name: customRow.name.trim(),
      unit: customRow.unit,
      category: customRow.category,
      purchase_rate: parseFloat(customRow.purchase_rate) || 0,
      selling_rate: parseFloat(customRow.selling_rate) || 0,
      stock_qty: parseFloat(customRow.stock_qty) || 0,
      included: true,
    }]);
    setCustomRow({ name: '', unit: 'bag', category: 'Other', purchase_rate: '', selling_rate: '', stock_qty: '' });
  }

  const stockValue = rows.filter(r => r.included).reduce((a, r) => a + r.stock_qty * r.purchase_rate, 0);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-green-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-2 py-2 text-center w-8">Inc.</th>
              <th className="px-2 py-2 text-left">Product</th>
              <th className="px-2 py-2 text-right w-20">Qty</th>
              <th className="px-2 py-2 text-right w-20">Buy ₹</th>
              <th className="px-2 py-2 text-right w-20">Sell ₹</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-t border-gray-100 ${r.included ? '' : 'opacity-40'}`}>
                <td className="px-2 py-1.5 text-center">
                  <input type="checkbox" checked={r.included} onChange={e => updateRow(i, 'included', e.target.checked)} className="accent-green-600" />
                </td>
                <td className="px-2 py-1.5">
                  <input value={r.name} onChange={e => updateRow(i, 'name', e.target.value)} className="w-full border-0 text-xs text-gray-800 font-medium bg-transparent focus:outline-none focus:ring-1 focus:ring-green-400 rounded px-1" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="0" value={r.stock_qty || ''} onChange={e => updateRow(i, 'stock_qty', parseFloat(e.target.value) || 0)} placeholder="0" className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-400" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="0" value={r.purchase_rate || ''} onChange={e => updateRow(i, 'purchase_rate', parseFloat(e.target.value) || 0)} className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-400" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="0" value={r.selling_rate || ''} onChange={e => updateRow(i, 'selling_rate', parseFloat(e.target.value) || 0)} className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-400" />
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-green-200 bg-green-50">
              <td className="px-2 py-1.5 text-center text-green-500 font-bold">+</td>
              <td className="px-2 py-1.5">
                <input value={customRow.name} onChange={e => setCustomRow(c => ({ ...c, name: e.target.value }))} placeholder="Add custom…" className="w-full border border-green-300 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
              </td>
              <td className="px-2 py-1.5">
                <input type="number" min="0" value={customRow.stock_qty} onChange={e => setCustomRow(c => ({ ...c, stock_qty: e.target.value }))} placeholder="0" className="w-full border border-green-300 rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-400" />
              </td>
              <td className="px-2 py-1.5">
                <input type="number" min="0" value={customRow.purchase_rate} onChange={e => setCustomRow(c => ({ ...c, purchase_rate: e.target.value }))} placeholder="0" className="w-full border border-green-300 rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-400" />
              </td>
              <td className="px-2 py-1.5">
                <div className="flex gap-1">
                  <input type="number" min="0" value={customRow.selling_rate} onChange={e => setCustomRow(c => ({ ...c, selling_rate: e.target.value }))} placeholder="0" className="w-full border border-green-300 rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-400" />
                  <button onClick={addCustom} className="bg-green-600 text-white px-1.5 rounded text-xs hover:bg-green-700">Add</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-green-700 font-medium text-right">Total inventory value: {inr(stockValue)}</p>
    </div>
  );
}

function AgricultureOnboarding({ bunkId, onComplete }: { bunkId: string; onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 7;
  const [fertilizers, setFertilizers] = useState<OnboardingProduct[]>(ONBOARDING_FERTILIZERS.map(r => ({ ...r })));
  const [seeds, setSeeds] = useState<OnboardingProduct[]>(ONBOARDING_SEEDS.map(r => ({ ...r })));
  const [pesticides, setPesticides] = useState<OnboardingProduct[]>(ONBOARDING_PESTICIDES.map(r => ({ ...r })));
  const [others, setOthers] = useState<OnboardingProduct[]>(ONBOARDING_OTHERS.map(r => ({ ...r })));
  const [farmers, setFarmers] = useState<OnboardingFarmer[]>([
    { name: '', phone: '', village: '', outstanding: 0, included: true },
    { name: '', phone: '', village: '', outstanding: 0, included: true },
    { name: '', phone: '', village: '', outstanding: 0, included: true },
    { name: '', phone: '', village: '', outstanding: 0, included: true },
    { name: '', phone: '', village: '', outstanding: 0, included: true },
  ]);
  const [saving, setSaving] = useState(false);

  const allProducts = [...fertilizers, ...seeds, ...pesticides, ...others];
  const includedProducts = allProducts.filter(p => p.included);
  const includedFarmers = farmers.filter(f => f.included && f.name.trim());

  const countByCategory = (cat: string) => includedProducts.filter(p => p.category === cat).length;
  const totalInventoryValue = includedProducts.reduce((a, p) => a + p.stock_qty * p.purchase_rate, 0);

  function updateFarmer(i: number, field: keyof OnboardingFarmer, val: string | number | boolean) {
    setFarmers(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: val } : f));
  }

  async function handleLaunch() {
    setSaving(true);
    try {
      if (includedProducts.length > 0) {
        const productRows = includedProducts.map(p => ({
          bunk_id: bunkId,
          name: p.name,
          category: p.category,
          unit: p.unit,
          purchase_rate: p.purchase_rate,
          selling_rate: p.selling_rate,
          stock_qty: p.stock_qty,
          low_stock_at: 5,
          hsn_code: '',
        }));
        await supabase.from('ag_products').insert(productRows);
      }
      if (includedFarmers.length > 0) {
        const farmerRows = includedFarmers.map(f => ({
          bunk_id: bunkId,
          name: f.name.trim(),
          phone: f.phone.trim(),
          village: f.village.trim(),
          land_area: '',
          credit_limit: 0,
          outstanding_amount: f.outstanding || 0,
          is_active: true,
        }));
        await supabase.from('ag_customers').insert(farmerRows);
      }
      onComplete();
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-green-50 flex flex-col">
      <div className="bg-green-700 text-white px-4 py-4 shadow">
        <h1 className="font-bold text-lg">🌾 Agro Shop AI</h1>
        <p className="text-green-200 text-xs mt-0.5">Store Setup</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-green-700 font-semibold">Step {step} of {TOTAL_STEPS}</span>
            <div className="flex-1 bg-green-200 rounded-full h-1.5">
              <div className="bg-green-600 h-1.5 rounded-full transition-all" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
            </div>
          </div>

          {step === 1 && (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm space-y-4">
              <div className="text-6xl">🌾</div>
              <h2 className="text-2xl font-bold text-gray-800">Welcome to Agro Shop AI</h2>
              <p className="text-gray-500">Let's set up your store in 5 minutes. We'll add your inventory, farmers, and you're ready to go.</p>
              <button onClick={() => setStep(2)} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold text-base transition mt-4">
                Let's Start →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Fertilizers</h2>
                <p className="text-sm text-gray-500">Toggle items you stock, fill in quantities and rates.</p>
              </div>
              <ProductTable rows={fertilizers} setRows={setFertilizers} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Seeds</h2>
                <p className="text-sm text-gray-500">Select seeds you carry and add stock details.</p>
              </div>
              <ProductTable rows={seeds} setRows={setSeeds} />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Pesticides & Herbicides</h2>
                <p className="text-sm text-gray-500">Add the pesticides and herbicides you stock.</p>
              </div>
              <ProductTable rows={pesticides} setRows={setPesticides} />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Other Items</h2>
                <p className="text-sm text-gray-500">Bio-products, tools, and any other items.</p>
              </div>
              <ProductTable rows={others} setRows={setOthers} />
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Add Your Regular Farmers</h2>
                <p className="text-sm text-gray-500">Add up to 5 farmers. You can add more later.</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-green-50 text-gray-600 uppercase">
                    <tr>
                      <th className="px-2 py-2 text-center w-8">Inc.</th>
                      <th className="px-2 py-2 text-left">Name</th>
                      <th className="px-2 py-2 text-left">Phone</th>
                      <th className="px-2 py-2 text-left">Village</th>
                      <th className="px-2 py-2 text-right">Outstanding ₹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {farmers.map((f, i) => (
                      <tr key={i} className={`border-t border-gray-100 ${f.included ? '' : 'opacity-40'}`}>
                        <td className="px-2 py-1.5 text-center">
                          <input type="checkbox" checked={f.included} onChange={e => updateFarmer(i, 'included', e.target.checked)} className="accent-green-600" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={f.name} onChange={e => updateFarmer(i, 'name', e.target.value)} placeholder="Farmer name" className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={f.phone} onChange={e => updateFarmer(i, 'phone', e.target.value)} placeholder="Phone" className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={f.village} onChange={e => updateFarmer(i, 'village', e.target.value)} placeholder="Village" className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-400" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="0" value={f.outstanding || ''} onChange={e => updateFarmer(i, 'outstanding', parseFloat(e.target.value) || 0)} placeholder="0" className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-400" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Summary & Launch</h2>
                <p className="text-sm text-gray-500">Review what will be added to your store.</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Total products</span>
                    <span className="font-bold text-green-700">{includedProducts.length}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-gray-500">Fertilizers</span>
                    <span className="text-xs font-medium">{countByCategory('Fertilizer')}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-gray-500">Seeds</span>
                    <span className="text-xs font-medium">{countByCategory('Seeds')}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-gray-500">Pesticides</span>
                    <span className="text-xs font-medium">{countByCategory('Pesticide')}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-gray-500">Herbicides</span>
                    <span className="text-xs font-medium">{countByCategory('Herbicide')}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-gray-500">Bio-products & Others</span>
                    <span className="text-xs font-medium">{countByCategory('Bio-product') + countByCategory('Tool') + countByCategory('Other')}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-gray-100">
                    <span className="text-sm text-gray-600">Inventory value (at purchase rate)</span>
                    <span className="font-bold text-green-700">{inr(totalInventoryValue)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-gray-100">
                    <span className="text-sm text-gray-600">Farmers to add</span>
                    <span className="font-bold text-green-700">{includedFarmers.length}</span>
                  </div>
                </div>
              </div>
              <button onClick={handleLaunch} disabled={saving} className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-bold text-base transition">
                {saving ? 'Setting up your store…' : '🚀 Launch My Store'}
              </button>
            </div>
          )}

          {step > 1 && (
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(s => s - 1)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                ← Back
              </button>
              {step < TOTAL_STEPS && (
                <button onClick={() => setStep(s => s + 1)} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                  Next →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export function AgricultureApp({ bunkId, onLogout, user }: { bunkId: string; onLogout: () => void; user: { name?: string; phone?: string } }) {
  const [tab, setTab] = useState('dashboard');
  const [products, setProducts] = useState<AgProduct[]>([]);
  const [customers, setCustomers] = useState<AgCustomer[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    if (!bunkId) return;
    const key = `agOnboardingDone_${bunkId}`;
    if (localStorage.getItem(key)) return;
    supabase.from('ag_products').select('id').eq('bunk_id', bunkId).limit(1)
      .then(({ data }) => {
        if (!data || data.length === 0) setShowOnboarding(true);
      });
  }, [bunkId]);

  useEffect(() => {
    if (!bunkId) return;
    supabase.from('ag_products').select('*').eq('bunk_id', bunkId).order('category').order('name').then(({ data }) => setProducts(data || []));
    supabase.from('ag_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name').then(({ data }) => setCustomers(data || []));
  }, [bunkId, refreshKey]);

  if (showOnboarding) {
    return (
      <AgricultureOnboarding
        bunkId={bunkId}
        onComplete={() => {
          localStorage.setItem(`agOnboardingDone_${bunkId}`, '1');
          setShowOnboarding(false);
          refresh();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onLogout={onLogout} user={user} tab={tab} setTab={setTab} />
      <div className="max-w-4xl mx-auto px-4 py-4">
        {tab === 'dashboard' && <AgDashboard bunkId={bunkId} products={products} customers={customers} onRefresh={refresh} />}
        {tab === 'inventory' && <AgInventory bunkId={bunkId} products={products} onRefresh={refresh} showToast={showToast} />}
        {tab === 'sales' && <AgSales bunkId={bunkId} products={products} customers={customers} onRefresh={refresh} showToast={showToast} />}
        {tab === 'farmers' && <AgFarmers bunkId={bunkId} customers={customers} onRefresh={refresh} showToast={showToast} />}
        {tab === 'purchases' && <AgPurchases bunkId={bunkId} onRefresh={refresh} showToast={showToast} />}
        {tab === 'expenses' && <AgExpenses bunkId={bunkId} onRefresh={refresh} showToast={showToast} />}
        {tab === 'reports' && <AgReports bunkId={bunkId} />}
        {tab === 'intelligence' && <IntelligenceTab bunkId={bunkId} />}
        {tab === 'settings' && <AgSettings bunkId={bunkId} onLogout={onLogout} showToast={showToast} />}
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
