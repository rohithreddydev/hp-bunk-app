// ═══════════════════════════════════════════════════════════════════════════
// FuelDesk AI — Hardware Store Module (v2)
// Blue theme — hw_ Supabase tables
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Truck, Receipt,
  Plus, Edit2, Trash2, X, Search, AlertTriangle, CheckCircle2,
  Loader2, TrendingUp, TrendingDown, Wallet, CreditCard,
  Settings as SettingsIcon, LogOut, ChevronDown, ChevronUp,
  FileText, Clock, RefreshCw,
} from 'lucide-react';
import { SettingsTab } from './SettingsTab';
import { supabase } from './supabase';
import { getTodayIST } from './utils';

function inr(n: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0);
}
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'; }

const CATEGORIES = ['Cement & Concrete', 'Steel & Iron', 'Plumbing', 'Electrical', 'Paint', 'Tools', 'Pipe & Fittings', 'Fasteners', 'Safety', 'Sanitary', 'Tiles & Flooring', 'Other'];
const UNITS = ['bag', 'kg', 'ton', 'piece', 'meter', 'foot', 'box', 'set', 'roll', 'pack', 'litre', 'brass'];
const PAYMENT_MODES = ['cash', 'upi', 'card', 'bank_transfer', 'credit', 'cheque'];
const EXPENSE_CATEGORIES = ['Rent', 'Electricity', 'Staff Salary', 'Transport', 'Loading/Unloading', 'Repairs', 'Marketing', 'Other'];

interface Product {
  id: string; bunk_id: string; name: string; brand: string; category: string;
  unit: string; selling_price: number; purchase_price: number; mrp: number;
  current_stock: number; reorder_level: number; is_active: boolean; created_at: string;
}
interface Customer {
  id: string; bunk_id: string; name: string; phone: string; address: string;
  credit_limit: number; outstanding_amount: number; is_active: boolean;
  last_payment_date: string | null; created_at: string;
}
interface Sale {
  id: string; bunk_id: string; customer_id: string | null; customer_name: string;
  sale_date: string; total_amount: number; payment_mode: string; payment_status: string;
  notes: string; site_delivery: boolean; delivery_address: string;
  labour_charges: number; transport_charges: number; discount_amount: number; created_at: string;
}
interface Payment {
  id: string; bunk_id: string; customer_id: string | null; customer_name: string;
  amount: number; payment_mode: string; payment_date: string;
  cheque_number: string | null; cheque_bank: string | null; cheque_date: string | null;
  cheque_status: string; notes: string | null; created_at: string;
}
interface Purchase {
  id: string; bunk_id: string; supplier_name: string; invoice_number: string;
  purchase_date: string; total_amount: number; notes: string; created_at: string;
}
interface Expense {
  id: string; bunk_id: string; category: string; description: string;
  amount: number; expense_date: string; payment_mode: string; notes: string; created_at: string;
}
interface CartItem { product: Product; quantity: number; price: number; }

type Tab = 'dashboard' | 'inventory' | 'sales' | 'customers' | 'purchases' | 'expenses' | 'reports' | 'settings';

// ─── Main Component ────────────────────────────────────────────────────────────
export function HardwareApp({ bunkId, onLogout, user }: { bunkId: string; onLogout: () => void; user: { name: string; email: string; role: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [p, c, sa, pay, pu, ex] = await Promise.all([
      supabase.from('hw_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('hw_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('hw_sales').select('*').eq('bunk_id', bunkId).order('sale_date', { ascending: false }).limit(300),
      supabase.from('hw_payments').select('*').eq('bunk_id', bunkId).order('payment_date', { ascending: false }).limit(200),
      supabase.from('hw_purchases').select('*').eq('bunk_id', bunkId).order('purchase_date', { ascending: false }).limit(100),
      supabase.from('hw_expenses').select('*').eq('bunk_id', bunkId).order('expense_date', { ascending: false }).limit(200),
    ]);
    if (p.data) setProducts(p.data as Product[]);
    if (c.data) setCustomers(c.data as Customer[]);
    if (sa.data) setSales(sa.data as Sale[]);
    if (pay.data) setPayments(pay.data as Payment[]);
    if (pu.data) setPurchases(pu.data as Purchase[]);
    if (ex.data) setExpenses(ex.data as Expense[]);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const today = getTodayIST();
  const todaySalesTotal = sales.filter(s => s.sale_date === today).reduce((a, s) => a + s.total_amount, 0);
  const todayExpenses = expenses.filter(e => e.expense_date === today).reduce((a, e) => a + e.amount, 0);
  const todayCollections = payments.filter(p => p.payment_date === today).reduce((a, p) => a + p.amount, 0);
  const lowStock = products.filter(p => p.current_stock <= p.reorder_level);
  const totalCreditOutstanding = customers.reduce((a, c) => a + (c.outstanding_amount || 0), 0);
  const pendingCheques = payments.filter(p => p.payment_mode === 'cheque' && p.cheque_status === 'received').length;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'inventory', label: 'Inventory', icon: <Package size={16} /> },
    { id: 'sales', label: 'Sales / POS', icon: <ShoppingCart size={16} /> },
    { id: 'customers', label: 'Customers', icon: <Users size={16} /> },
    { id: 'purchases', label: 'Purchases', icon: <Truck size={16} /> },
    { id: 'expenses', label: 'Expenses', icon: <Receipt size={16} /> },
    { id: 'reports', label: 'Reports', icon: <FileText size={16} /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <span className="text-2xl">🔧</span>
        <div>
          <h1 className="font-bold text-lg leading-tight">Hardware Store</h1>
          <p className="text-blue-200 text-xs">FuelDesk AI</p>
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
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="p-4 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
        ) : (
          <>
            {activeTab === 'dashboard' && <HwDashboard todaySalesTotal={todaySalesTotal} todayExpenses={todayExpenses} todayCollections={todayCollections} lowStock={lowStock} recentSales={sales.slice(0, 8)} totalProducts={products.length} totalCreditOutstanding={totalCreditOutstanding} pendingCheques={pendingCheques} customers={customers} />}
            {activeTab === 'inventory' && <HwInventory bunkId={bunkId} products={products} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'sales' && <HwSales bunkId={bunkId} products={products} customers={customers} sales={sales} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'customers' && <HwCustomers bunkId={bunkId} customers={customers} payments={payments} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'purchases' && <HwPurchases bunkId={bunkId} purchases={purchases} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'expenses' && <HwExpenses bunkId={bunkId} expenses={expenses} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'reports' && <HwReports bunkId={bunkId} sales={sales} expenses={expenses} payments={payments} customers={customers} />}
            {activeTab === 'settings' && <SettingsTab bunkId={bunkId} user={user} onLogout={onLogout} />}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function HwDashboard({ todaySalesTotal, todayExpenses, todayCollections, lowStock, recentSales, totalProducts, totalCreditOutstanding, pendingCheques, customers }: {
  todaySalesTotal: number; todayExpenses: number; todayCollections: number; lowStock: Product[]; recentSales: Sale[];
  totalProducts: number; totalCreditOutstanding: number; pendingCheques: number; customers: Customer[];
}) {
  const overdueCount = customers.filter(c => {
    if (!c.outstanding_amount) return false;
    if (!c.last_payment_date) return true;
    const days = Math.floor((Date.now() - new Date(c.last_payment_date).getTime()) / 86400000);
    return days > 30;
  }).length;

  const kpis = [
    { label: "Today's Sales", value: inr(todaySalesTotal), icon: <TrendingUp size={20} />, color: 'bg-green-50 text-green-700 border-green-200' },
    { label: "Collections Today", value: inr(todayCollections), icon: <CreditCard size={20} />, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: "Today's Expenses", value: inr(todayExpenses), icon: <TrendingDown size={20} />, color: 'bg-red-50 text-red-700 border-red-200' },
    { label: 'Credit Outstanding', value: inr(totalCreditOutstanding), icon: <Wallet size={20} />, color: 'bg-orange-50 text-orange-700 border-orange-200' },
    { label: 'Low Stock Items', value: String(lowStock.length), icon: <AlertTriangle size={20} />, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { label: 'Overdue Parties', value: String(overdueCount), icon: <Clock size={20} />, color: overdueCount > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-500 border-gray-200' },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-yellow-500" /> Low Stock Alert</h2>
          {lowStock.length === 0 ? <p className="text-gray-400 text-sm">All products well-stocked.</p> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lowStock.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div><p className="text-sm font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-400">{p.category}</p></div>
                  <span className={`text-sm font-semibold ${p.current_stock <= 0 ? 'text-red-600' : 'text-yellow-600'}`}>{p.current_stock} {p.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><ShoppingCart size={16} className="text-blue-600" /> Recent Sales</h2>
          {recentSales.length === 0 ? <p className="text-gray-400 text-sm">No sales yet.</p> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentSales.map(s => (
                <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div><p className="text-sm font-medium text-gray-800">{s.customer_name || 'Walk-in'}</p><p className="text-xs text-gray-400">{fmtDate(s.sale_date)} · {s.payment_mode}</p></div>
                  <span className={`text-sm font-semibold ${s.payment_mode === 'credit' ? 'text-orange-600' : 'text-green-600'}`}>{inr(s.total_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><CheckCircle2 size={16} className="text-green-600" /> Daily Checklist</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { done: todaySalesTotal > 0, text: "Record today's sales" },
            { done: todayCollections > 0, text: "Record today's collections" },
            { done: lowStock.length === 0, text: `Reorder low stock items${lowStock.length > 0 ? ` (${lowStock.length})` : ''}` },
            { done: overdueCount === 0, text: `Follow up overdue parties${overdueCount > 0 ? ` (${overdueCount})` : ''}` },
            { done: pendingCheques === 0, text: `${pendingCheques > 0 ? `${pendingCheques} pending cheques — check deposit` : 'No pending cheques'}` },
            { done: todayExpenses > 0, text: "Log today's expenses" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${item.done ? 'bg-green-100' : 'bg-yellow-100'}`}>
                {item.done ? <CheckCircle2 size={12} className="text-green-600" /> : <AlertTriangle size={12} className="text-yellow-600" />}
              </div>
              <span className={`text-sm leading-tight ${item.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Inventory ─────────────────────────────────────────────────────────────────
interface ProdForm {
  name: string; brand: string; category: string; unit: string;
  mrp: number; selling_price: number; purchase_price: number;
  current_stock: number; reorder_level: number;
}
const defaultPF = (): ProdForm => ({ name: '', brand: '', category: CATEGORIES[0], unit: UNITS[0], mrp: 0, selling_price: 0, purchase_price: 0, current_stock: 0, reorder_level: 5 });

function HwInventory({ bunkId, products, onRefresh, showToast }: { bunkId: string; products: Product[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProdForm>(defaultPF());
  const [saving, setSaving] = useState(false);
  const [adjustProd, setAdjustProd] = useState<Product | null>(null);
  const [adjQty, setAdjQty] = useState('');
  const [adjType, setAdjType] = useState<'add' | 'remove'>('add');
  const [adjNote, setAdjNote] = useState('');
  const [adjSaving, setAdjSaving] = useState(false);

  const filtered = products.filter(p => {
    const s = p.name.toLowerCase().includes(search.toLowerCase()) || p.brand?.toLowerCase().includes(search.toLowerCase());
    return s && (catFilter === 'All' || p.category === catFilter);
  });

  function openAdd() { setEditing(null); setForm(defaultPF()); setShowModal(true); }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, brand: p.brand || '', category: p.category, unit: p.unit, mrp: p.mrp || 0, selling_price: p.selling_price, purchase_price: p.purchase_price || 0, current_stock: p.current_stock, reorder_level: p.reorder_level || 5 });
    setShowModal(true);
  }
  function openAdjust(p: Product) { setAdjustProd(p); setAdjQty(''); setAdjType('add'); setAdjNote(''); }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Product name required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId, is_active: true };
    const { error } = editing
      ? await supabase.from('hw_products').update(payload).eq('id', editing.id).eq('bunk_id', bunkId)
      : await supabase.from('hw_products').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editing ? 'Product updated' : 'Product added');
    setShowModal(false); onRefresh();
  }

  async function handleDelete(p: Product) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    const { error } = await supabase.from('hw_products').update({ is_active: false }).eq('id', p.id).eq('bunk_id', bunkId);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Product removed'); onRefresh();
  }

  async function handleAdjust() {
    if (!adjustProd) return;
    const qty = parseFloat(adjQty);
    if (!(qty > 0)) { showToast('Enter a valid quantity', 'error'); return; }
    setAdjSaving(true);
    const delta = adjType === 'add' ? qty : -qty;
    // Fresh DB read to avoid stale state race condition
    const { data: fresh, error: fetchErr } = await supabase
      .from('hw_products').select('current_stock').eq('id', adjustProd.id).eq('bunk_id', bunkId).single();
    if (fetchErr || !fresh) { showToast('Could not verify current stock', 'error'); setAdjSaving(false); return; }
    const newStock = Math.max(0, Number(fresh.current_stock) + delta);
    const { error } = await supabase.from('hw_products').update({ current_stock: newStock }).eq('id', adjustProd.id).eq('bunk_id', bunkId);
    setAdjSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    if (adjNote.trim()) {
      await supabase.from('hw_stock_adjustments').insert({
        bunk_id: bunkId, product_id: adjustProd.id, product_name: adjustProd.name,
        adj_type: adjType, quantity: qty, notes: adjNote.trim(), adj_date: getTodayIST(),
      });
    }
    showToast(`${adjustProd.name}: stock → ${newStock} ${adjustProd.unit}`);
    setAdjustProd(null); onRefresh();
  }

  const setF = (k: keyof ProdForm, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Buy / Sell</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">No products found.</td></tr>}
              {filtered.map(p => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-400">{p.brand} · {p.unit}</p></td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{p.category}</td>
                  <td className="px-4 py-3 text-right text-xs"><span className="text-gray-500">{inr(p.purchase_price)}</span> / <span className="font-medium text-gray-800">{inr(p.selling_price)}</span></td>
                  <td className="px-4 py-3 text-right"><span className={`font-semibold ${p.current_stock <= p.reorder_level ? 'text-red-600' : 'text-gray-800'}`}>{p.current_stock}</span></td>
                  <td className="px-4 py-3 text-center">{p.current_stock <= p.reorder_level ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Low</span> : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">OK</span>}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openAdjust(p)} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium hover:bg-blue-100" title="Adjust Stock"><RefreshCw size={12} /></button>
                      <button onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800 p-1"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(p)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">{editing ? 'Edit Product' : 'Add Product'}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Product Name *</label><input value={form.name} onChange={e => setF('name', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Brand</label><input value={form.brand} onChange={e => setF('brand', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Category</label><select value={form.category} onChange={e => setF('category', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Unit</label><select value={form.unit} onChange={e => setF('unit', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">{UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">MRP (₹)</label><input type="number" value={form.mrp} onChange={e => setF('mrp', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Purchase Price (₹)</label><input type="number" value={form.purchase_price} onChange={e => setF('purchase_price', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Selling Price (₹)</label><input type="number" value={form.selling_price} onChange={e => setF('selling_price', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Current Stock</label><input type="number" value={form.current_stock} onChange={e => setF('current_stock', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Reorder Level</label><input type="number" value={form.reorder_level} onChange={e => setF('reorder_level', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {adjustProd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">Adjust Stock</h2><button onClick={() => setAdjustProd(null)}><X size={20} /></button></div>
            <div className="p-5 space-y-3">
              <p className="text-sm font-medium text-gray-800">{adjustProd.name}</p>
              <p className="text-sm text-gray-500">Current: <span className="font-semibold text-gray-800">{adjustProd.current_stock} {adjustProd.unit}</span></p>
              <div className="flex gap-2">
                <button onClick={() => setAdjType('add')} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${adjType === 'add' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-700'}`}>+ Add Stock</button>
                <button onClick={() => setAdjType('remove')} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${adjType === 'remove' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-700'}`}>- Remove Stock</button>
              </div>
              <div><label className="text-xs text-gray-500 mb-1 block">Quantity ({adjustProd.unit}) *</label><input type="number" value={adjQty} onChange={e => setAdjQty(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Reason (optional)</label><input value={adjNote} onChange={e => setAdjNote(e.target.value)} placeholder="e.g. delivery from supplier, damaged goods…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              {adjQty && parseFloat(adjQty) > 0 && (
                <p className="text-sm text-gray-600">New stock: <span className="font-semibold">{Math.max(0, Number(adjustProd.current_stock) + (adjType === 'add' ? parseFloat(adjQty) : -parseFloat(adjQty)))} {adjustProd.unit}</span></p>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setAdjustProd(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdjust} disabled={adjSaving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {adjSaving && <Loader2 size={14} className="animate-spin" />}{adjSaving ? 'Saving…' : 'Update Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sales / POS ───────────────────────────────────────────────────────────────
function HwSales({ bunkId, products, customers, sales, onRefresh, showToast }: {
  bunkId: string; products: Product[]; customers: Customer[]; sales: Sale[];
  onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [view, setView] = useState<'pos' | 'history'>('pos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('Walk-in');
  const [customerId, setCustomerId] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [saleDate, setSaleDate] = useState(getTodayIST());
  const [notes, setNotes] = useState('');
  const [siteDelivery, setSiteDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [labourCharges, setLabourCharges] = useState(0);
  const [transportCharges, setTransportCharges] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [histSearch, setHistSearch] = useState('');
  const [histMode, setHistMode] = useState('all');

  const filteredProducts = useMemo(() => products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const filteredSales = useMemo(() => sales.filter(s => {
    const q = histSearch.toLowerCase();
    const matchQ = !q || s.customer_name?.toLowerCase().includes(q) || s.notes?.toLowerCase().includes(q);
    const matchMode = histMode === 'all' || s.payment_mode === histMode;
    return matchQ && matchMode;
  }), [sales, histSearch, histMode]);

  function addToCart(p: Product) {
    setCart(c => {
      const ex = c.find(i => i.product.id === p.id);
      if (ex) return c.map(i => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...c, { product: p, quantity: 1, price: p.selling_price }];
    });
  }
  function updateQty(id: string, qty: number) {
    if (qty <= 0) { setCart(c => c.filter(i => i.product.id !== id)); return; }
    const prod = products.find(p => p.id === id);
    if (prod && qty > prod.current_stock) { showToast(`Only ${prod.current_stock} ${prod.unit} in stock`, 'error'); return; }
    setCart(c => c.map(i => i.product.id === id ? { ...i, quantity: qty } : i));
  }
  function updatePrice(id: string, price: number) {
    if (price < 0) return;
    setCart(c => c.map(i => i.product.id === id ? { ...i, price } : i));
  }

  const subtotal = cart.reduce((a, i) => a + i.price * i.quantity, 0);
  const total = subtotal + labourCharges + transportCharges - discount;

  async function handleSell() {
    if (cart.length === 0) { showToast('Cart is empty', 'error'); return; }
    if (!(total > 0)) { showToast('Total must be greater than 0', 'error'); return; }
    if (paymentMode === 'credit' && customerId) {
      const cust = customers.find(c => c.id === customerId);
      if (cust && cust.credit_limit > 0 && (Number(cust.outstanding_amount) + total) > cust.credit_limit) {
        showToast(`Credit limit exceeded (limit: ${inr(cust.credit_limit)}, current due: ${inr(cust.outstanding_amount)})`, 'error');
        return;
      }
    }
    setSaving(true);
    const name = customerId ? customers.find(c => c.id === customerId)?.name || customerName : customerName;
    const { data: sale, error: sErr } = await supabase.from('hw_sales').insert({
      bunk_id: bunkId, customer_id: customerId || null, customer_name: name,
      sale_date: saleDate, total_amount: total, payment_mode: paymentMode,
      payment_status: paymentMode === 'credit' ? 'credit' : 'paid', notes,
      site_delivery: siteDelivery, delivery_address: deliveryAddress || null,
      labour_charges: labourCharges, transport_charges: transportCharges, discount_amount: discount,
    }).select().single();
    if (sErr || !sale) { showToast(sErr?.message || 'Sale failed', 'error'); setSaving(false); return; }

    const { error: itemsErr } = await supabase.from('hw_sale_items').insert(cart.map(i => ({
      sale_id: sale.id, bunk_id: bunkId, product_id: i.product.id,
      product_name: i.product.name, quantity: i.quantity, unit_price: i.price,
      total_price: i.price * i.quantity,
    })));
    if (itemsErr) {
      showToast('Sale saved but item details failed to record — check connectivity.', 'error');
      setSaving(false); onRefresh(); return;
    }

    // Batch-read fresh stock to avoid stale-state race condition
    const { data: freshStocks } = await supabase.from('hw_products')
      .select('id, current_stock').in('id', cart.map(i => i.product.id)).eq('bunk_id', bunkId);
    const stockMap: Record<string, number> = {};
    freshStocks?.forEach(s => { stockMap[s.id] = Number(s.current_stock); });
    for (const i of cart) {
      const freshStock = stockMap[i.product.id] ?? i.product.current_stock;
      await supabase.from('hw_products').update({ current_stock: Math.max(0, freshStock - i.quantity) }).eq('id', i.product.id).eq('bunk_id', bunkId);
    }

    if (paymentMode === 'credit' && customerId) {
      const cust = customers.find(c => c.id === customerId);
      if (cust) {
        const { error: custErr } = await supabase.from('hw_customers').update({ outstanding_amount: Number(cust.outstanding_amount) + total }).eq('id', customerId).eq('bunk_id', bunkId);
        if (custErr) showToast('Sale recorded but credit outstanding not updated — refresh the page.', 'error');
      }
    }

    showToast('Sale recorded!');
    setCart([]); setCustomerName('Walk-in'); setCustomerId(''); setNotes('');
    setSiteDelivery(false); setDeliveryAddress(''); setLabourCharges(0); setTransportCharges(0); setDiscount(0);
    setPaymentMode('cash');
    setSaving(false); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200">
        {(['pos', 'history'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === v ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {v === 'pos' ? '🛒 New Sale (POS)' : '📋 Sales History'}
          </button>
        ))}
      </div>

      {view === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products to add…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase sticky top-0">
                    <tr><th className="px-4 py-2 text-left">Product</th><th className="px-4 py-2 text-right">Price</th><th className="px-4 py-2 text-right">Stock</th><th className="px-4 py-2"></th></tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(p => (
                      <tr key={p.id} className="border-t border-gray-100 hover:bg-blue-50">
                        <td className="px-4 py-2"><p className="font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-400">{p.category}</p></td>
                        <td className="px-4 py-2 text-right">{inr(p.selling_price)}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{p.current_stock} {p.unit}</td>
                        <td className="px-4 py-2 text-right"><button onClick={() => addToCart(p)} disabled={p.current_stock <= 0} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40"><Plus size={12} className="inline" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 h-fit">
            <h2 className="font-semibold text-gray-800">Cart</h2>
            {cart.length === 0 ? <p className="text-gray-400 text-sm">No items added.</p> : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {cart.map(i => (
                  <div key={i.product.id} className="py-1.5 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-800 flex-1 truncate">{i.product.name}</p>
                      <button onClick={() => setCart(c => c.filter(x => x.product.id !== i.product.id))} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(i.product.id, i.quantity - 1)} className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100">-</button>
                        <span className="w-8 text-center text-sm font-medium">{i.quantity}</span>
                        <button onClick={() => updateQty(i.product.id, i.quantity + 1)} className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100">+</button>
                      </div>
                      <input type="number" value={i.price} onChange={e => updatePrice(i.product.id, parseFloat(e.target.value) || 0)} className="w-20 border border-gray-200 rounded px-2 py-0.5 text-xs text-right" title="Unit price" />
                      <span className="text-sm font-semibold text-gray-800 ml-auto">{inr(i.price * i.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20 shrink-0">Labour ₹</span>
                <input type="number" value={labourCharges || ''} onChange={e => setLabourCharges(parseFloat(e.target.value) || 0)} placeholder="0" className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20 shrink-0">Transport ₹</span>
                <input type="number" value={transportCharges || ''} onChange={e => setTransportCharges(parseFloat(e.target.value) || 0)} placeholder="0" className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20 shrink-0">Discount ₹</span>
                <input type="number" value={discount || ''} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} placeholder="0" className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
              </div>
              <div className="flex justify-between font-bold text-base"><span>Total</span><span>{inr(total)}</span></div>

              <div><label className="text-xs text-gray-500 mb-1 block">Customer</label>
                <select value={customerId} onChange={e => { setCustomerId(e.target.value); if (!e.target.value) setCustomerName('Walk-in'); }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Walk-in Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.outstanding_amount > 0 ? ` (₹${Math.round(c.outstanding_amount / 1000)}k due)` : ''}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={siteDelivery} onChange={e => setSiteDelivery(e.target.checked)} className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700">Site Delivery</span>
              </label>
              {siteDelivery && (
                <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Delivery address / site name…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              )}
              <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <button onClick={handleSell} disabled={saving || cart.length === 0} className="mt-1 w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Processing…' : 'Complete Sale'}
            </button>
          </div>
        </div>
      )}

      {view === 'history' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={histSearch} onChange={e => setHistSearch(e.target.value)} placeholder="Search by customer or note…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <select value={histMode} onChange={e => setHistMode(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="all">All Modes</option>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Customer</th><th className="px-4 py-3 text-left">Mode</th><th className="px-4 py-3 text-left">Notes</th><th className="px-4 py-3 text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {filteredSales.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">No sales found.</td></tr>}
                  {filteredSales.slice(0, 100).map(s => (
                    <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{fmtDate(s.sale_date)}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{s.customer_name || 'Walk-in'}{s.site_delivery && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Delivery</span>}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.payment_mode === 'credit' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{s.payment_mode}</span></td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-32 truncate">{s.notes || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{inr(s.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {filteredSales.length > 100 && <p className="text-center text-sm text-gray-400">Showing 100 of {filteredSales.length} records</p>}
        </div>
      )}
    </div>
  );
}

// ─── Customers ─────────────────────────────────────────────────────────────────
interface CustForm { name: string; phone: string; address: string; credit_limit: number; }
const defaultCF = (): CustForm => ({ name: '', phone: '', address: '', credit_limit: 0 });

function HwCustomers({ bunkId, customers, payments, onRefresh, showToast }: {
  bunkId: string; customers: Customer[]; payments: Payment[];
  onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'outstanding' | 'overdue'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustForm>(defaultCF());
  const [saving, setSaving] = useState(false);
  const [payModal, setPayModal] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeBank, setChequeBank] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [payingSaving, setPayingSaving] = useState(false);
  const [showCheques, setShowCheques] = useState(false);

  const pendingCheques = payments.filter(p => p.payment_mode === 'cheque' && p.cheque_status === 'received');

  function daysSincePayment(c: Customer) {
    if (!c.last_payment_date) return c.outstanding_amount > 0 ? 9999 : 0;
    return Math.floor((Date.now() - new Date(c.last_payment_date).getTime()) / 86400000);
  }

  const filtered = useMemo(() => customers.filter(c => {
    const q = search.toLowerCase();
    const matchQ = !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q);
    const days = daysSincePayment(c);
    if (filter === 'outstanding') return matchQ && c.outstanding_amount > 0;
    if (filter === 'overdue') return matchQ && c.outstanding_amount > 0 && days > 30;
    return matchQ;
  }).sort((a, b) => (b.outstanding_amount || 0) - (a.outstanding_amount || 0)), [customers, search, filter]);

  function openAdd() { setEditing(null); setForm(defaultCF()); setShowModal(true); }
  function openEdit(c: Customer) { setEditing(c); setForm({ name: c.name, phone: c.phone || '', address: c.address || '', credit_limit: c.credit_limit || 0 }); setShowModal(true); }
  function openPay(c: Customer) { setPayModal(c); setPayAmount(''); setPayMode('cash'); setChequeNo(''); setChequeBank(''); setChequeDate(''); }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Customer name required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId, is_active: true };
    const { error } = editing
      ? await supabase.from('hw_customers').update(payload).eq('id', editing.id).eq('bunk_id', bunkId)
      : await supabase.from('hw_customers').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editing ? 'Customer updated' : 'Customer added');
    setShowModal(false); onRefresh();
  }

  async function handleCollectPayment() {
    if (!payModal) return;
    const amt = parseFloat(payAmount);
    if (!(amt > 0)) { showToast('Enter a valid amount', 'error'); return; }
    if (amt > Number(payModal.outstanding_amount) + 0.01) {
      showToast(`Amount (${inr(amt)}) exceeds outstanding (${inr(payModal.outstanding_amount)})`, 'error');
      return;
    }
    setPayingSaving(true);
    const today = getTodayIST();

    const payRecord: Record<string, unknown> = {
      bunk_id: bunkId, customer_id: payModal.id, customer_name: payModal.name,
      amount: amt, payment_mode: payMode, payment_date: today,
    };
    if (payMode === 'cheque') {
      payRecord.cheque_number = chequeNo || null;
      payRecord.cheque_bank = chequeBank || null;
      payRecord.cheque_date = chequeDate || null;
      payRecord.cheque_status = 'received';
    }

    const { error: pErr } = await supabase.from('hw_payments').insert(payRecord);
    if (pErr) { showToast(pErr.message, 'error'); setPayingSaving(false); return; }

    const newOutstanding = Math.max(0, Number(payModal.outstanding_amount) - amt);
    await supabase.from('hw_customers').update({ outstanding_amount: newOutstanding, last_payment_date: today }).eq('id', payModal.id).eq('bunk_id', bunkId);

    setPayingSaving(false);
    showToast(`${payMode === 'cheque' ? '📋 Cheque' : '✅ Payment'} of ${inr(amt)} recorded from ${payModal.name}`);
    setPayModal(null); onRefresh();
  }

  async function updateChequeStatus(payId: string, status: 'cleared' | 'bounced') {
    const { error } = await supabase.from('hw_payments').update({ cheque_status: status }).eq('id', payId).eq('bunk_id', bunkId);
    if (error) { showToast(error.message, 'error'); return; }
    if (status === 'bounced') {
      const pmt = pendingCheques.find(p => p.id === payId);
      if (pmt?.customer_id) {
        const cust = customers.find(c => c.id === pmt.customer_id);
        if (cust) {
          const { error: custErr } = await supabase.from('hw_customers')
            .update({ outstanding_amount: Number(cust.outstanding_amount) + pmt.amount })
            .eq('id', cust.id).eq('bunk_id', bunkId);
          if (custErr) {
            showToast(`Cheque marked bounced but outstanding restore failed: ${custErr.message}`, 'error');
            return;
          }
        }
      }
    }
    showToast(`Cheque marked as ${status}`); onRefresh();
  }

  const totalOutstanding = customers.filter(c => c.outstanding_amount > 0).reduce((a, c) => a + c.outstanding_amount, 0);
  const overdueCount = customers.filter(c => c.outstanding_amount > 0 && daysSincePayment(c) > 30).length;

  return (
    <div className="space-y-4">
      {/* Cheque Register */}
      {pendingCheques.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <button onClick={() => setShowCheques(v => !v)} className="flex items-center justify-between w-full">
            <h3 className="font-semibold text-yellow-800 flex items-center gap-2">
              <CreditCard size={16} /> {pendingCheques.length} Pending Cheque{pendingCheques.length > 1 ? 's' : ''} — Total: {inr(pendingCheques.reduce((a, p) => a + p.amount, 0))}
            </h3>
            {showCheques ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showCheques && (
            <div className="mt-3 space-y-2">
              {pendingCheques.map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-yellow-100">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{p.customer_name}</p>
                    <p className="text-xs text-gray-500">
                      {inr(p.amount)} · {p.cheque_bank || 'Unknown bank'}{p.cheque_number ? ` · #${p.cheque_number}` : ''}
                      {p.cheque_date ? ` · Due: ${fmtDate(p.cheque_date)}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => updateChequeStatus(p.id, 'cleared')} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium hover:bg-green-200">Cleared</button>
                    <button onClick={() => updateChequeStatus(p.id, 'bounced')} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-medium hover:bg-red-200">Bounced</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex gap-1">
            {(['all', 'outstanding', 'overdue'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 text-xs rounded-lg font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f === 'all' ? 'All' : f === 'outstanding' ? `Due (${customers.filter(c => c.outstanding_amount > 0).length})` : `Overdue 30d (${overdueCount})`}
              </button>
            ))}
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {totalOutstanding > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-orange-700 font-medium">Total Outstanding</span>
          <span className="text-base font-bold text-orange-700">{inr(totalOutstanding)}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-right">Limit</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-center">Last Pay</th><th className="px-4 py-3 text-center">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">No customers found.</td></tr>}
              {filtered.map(c => {
                const days = daysSincePayment(c);
                const isOverdue = c.outstanding_amount > 0 && days > 30;
                return (
                  <tr key={c.id} className={`border-t border-gray-100 hover:bg-gray-50 ${isOverdue ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3"><p className="font-medium text-gray-800">{c.name}</p><p className="text-xs text-gray-400">{c.address || ''}</p></td>
                    <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">{inr(c.credit_limit || 0)}</td>
                    <td className="px-4 py-3 text-right"><span className={`font-semibold ${c.outstanding_amount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{inr(c.outstanding_amount)}</span></td>
                    <td className="px-4 py-3 text-center">
                      {c.last_payment_date ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                          {days}d ago{isOverdue ? ' ⚠️' : ''}
                        </span>
                      ) : c.outstanding_amount > 0 ? (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Never paid</span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {c.outstanding_amount > 0 && (
                          <button onClick={() => openPay(c)} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium hover:bg-orange-200">Collect</button>
                        )}
                        <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800"><Edit2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">{editing ? 'Edit Customer' : 'Add Customer'}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="p-5 space-y-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Address / Site</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Credit Limit (₹)</label><input type="number" value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {payModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">Collect Payment</h2><button onClick={() => setPayModal(null)}><X size={20} /></button></div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600">Customer: <span className="font-semibold text-gray-800">{payModal.name}</span></p>
              <p className="text-sm text-gray-600">Outstanding: <span className="font-semibold text-orange-600">{inr(payModal.outstanding_amount)}</span></p>
              <div><label className="text-xs text-gray-500 mb-1 block">Amount Received (₹) *</label><input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label>
                <select value={payMode} onChange={e => setPayMode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {['cash', 'upi', 'bank_transfer', 'card', 'cheque'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              {payMode === 'cheque' && (
                <>
                  <div><label className="text-xs text-gray-500 mb-1 block">Cheque Number</label><input value={chequeNo} onChange={e => setChequeNo(e.target.value)} placeholder="001234" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Bank Name</label><input value={chequeBank} onChange={e => setChequeBank(e.target.value)} placeholder="SBI / HDFC / etc." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Cheque Date</label><input type="date" value={chequeDate} onChange={e => setChequeDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                  <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2">⚠️ Cheque will be marked as "Received" until you confirm it's cleared or bounced.</p>
                </>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setPayModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleCollectPayment} disabled={payingSaving} className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {payingSaving && <Loader2 size={14} className="animate-spin" />}{payingSaving ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Purchases ─────────────────────────────────────────────────────────────────
interface PurchForm { supplier_name: string; invoice_number: string; purchase_date: string; total_amount: number; notes: string; }
const defaultPurchF = (): PurchForm => ({ supplier_name: '', invoice_number: '', purchase_date: getTodayIST(), total_amount: 0, notes: '' });

function HwPurchases({ bunkId, purchases, onRefresh, showToast }: { bunkId: string; purchases: Purchase[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<PurchForm>(defaultPurchF());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = purchases.filter(p => {
    const q = search.toLowerCase();
    return !q || p.supplier_name.toLowerCase().includes(q) || (p.invoice_number || '').toLowerCase().includes(q);
  });

  const monthTotal = purchases.filter(p => p.purchase_date >= getTodayIST().slice(0, 7) + '-01').reduce((a, p) => a + p.total_amount, 0);

  async function handleSave() {
    if (!form.supplier_name.trim() || !(form.total_amount > 0)) { showToast('Supplier name and amount required', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('hw_purchases').insert({ ...form, bunk_id: bunkId });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Purchase added'); setShowModal(false); setForm(defaultPurchF()); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search supplier…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {monthTotal > 0 && <span className="text-sm text-gray-500">This month: <span className="font-semibold text-gray-700">{inr(monthTotal)}</span></span>}
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"><Plus size={16} /> Add Purchase</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Supplier</th><th className="px-4 py-3 text-left">Invoice</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Notes</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">No purchases yet.</td></tr>}
              {filtered.map(p => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{fmtDate(p.purchase_date)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.supplier_name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.invoice_number || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{inr(p.total_amount)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">Add Purchase</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="p-5 space-y-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Supplier Name *</label><input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Invoice / Challan Number</label><input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Total Amount (₹) *</label><input type="number" value={form.total_amount || ''} onChange={e => setForm(f => ({ ...f, total_amount: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Notes (items received)</label><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. 200 bags OPC 53, 100kg TMT 12mm" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Expenses ──────────────────────────────────────────────────────────────────
interface ExpForm { category: string; description: string; amount: number; expense_date: string; payment_mode: string; notes: string; }
const defaultEF = (): ExpForm => ({ category: EXPENSE_CATEGORIES[0], description: '', amount: 0, expense_date: getTodayIST(), payment_mode: 'cash', notes: '' });

function HwExpenses({ bunkId, expenses, onRefresh, showToast }: { bunkId: string; expenses: Expense[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ExpForm>(defaultEF());
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.description.trim() || !(form.amount > 0)) { showToast('Description and amount required', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('hw_expenses').insert({ ...form, bunk_id: bunkId });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Expense added'); setShowModal(false); setForm(defaultEF()); onRefresh();
  }

  const monthTotal = expenses.filter(e => e.expense_date >= getTodayIST().slice(0, 7) + '-01').reduce((a, e) => a + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {monthTotal > 0 && <span className="text-sm text-gray-500">This month: <span className="font-semibold text-gray-700">{inr(monthTotal)}</span></span>}
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 ml-auto"><Plus size={16} /> Add Expense</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-left">Payment</th><th className="px-4 py-3 text-right">Amount</th></tr>
            </thead>
            <tbody>
              {expenses.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">No expenses recorded.</td></tr>}
              {expenses.slice(0, 100).map(e => (
                <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{fmtDate(e.expense_date)}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{e.category}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{e.description}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{e.payment_mode}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{inr(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">Add Expense</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="p-5 space-y-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Category</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Description *</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label><input type="number" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label><select value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{['cash', 'upi', 'bank_transfer', 'card'].map(m => <option key={m}>{m}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────────
function HwReports({ bunkId, sales, expenses, payments, customers }: {
  bunkId: string; sales: Sale[]; expenses: Expense[]; payments: Payment[]; customers: Customer[];
}) {
  const today = getTodayIST();
  const [reportMonth, setReportMonth] = useState(today.slice(0, 7));

  const mStart = reportMonth + '-01';
  const mEnd = new Date(new Date(mStart).getFullYear(), new Date(mStart).getMonth() + 1, 0).toISOString().split('T')[0];

  const mSales = sales.filter(s => s.sale_date >= mStart && s.sale_date <= mEnd);
  const mExp = expenses.filter(e => e.expense_date >= mStart && e.expense_date <= mEnd);
  const mPay = payments.filter(p => p.payment_date >= mStart && p.payment_date <= mEnd);

  const totalSales = mSales.reduce((a, s) => a + s.total_amount, 0);
  const cashSales = mSales.filter(s => s.payment_mode === 'cash').reduce((a, s) => a + s.total_amount, 0);
  const creditSales = mSales.filter(s => s.payment_mode === 'credit').reduce((a, s) => a + s.total_amount, 0);
  const totalExp = mExp.reduce((a, e) => a + e.amount, 0);
  const totalCollected = mPay.reduce((a, p) => a + p.amount, 0);
  const chequeCollected = mPay.filter(p => p.payment_mode === 'cheque').reduce((a, p) => a + p.amount, 0);

  const totalOutstanding = customers.filter(c => c.outstanding_amount > 0).reduce((a, c) => a + c.outstanding_amount, 0);
  const overdueCustomers = customers.filter(c => {
    if (!c.outstanding_amount) return false;
    const days = c.last_payment_date ? Math.floor((Date.now() - new Date(c.last_payment_date).getTime()) / 86400000) : 9999;
    return days > 30;
  });

  const expByCategory: Record<string, number> = {};
  mExp.forEach(e => { expByCategory[e.category] = (expByCategory[e.category] || 0) + e.amount; });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="font-semibold text-gray-800 text-lg">Monthly Report</h2>
        <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* P&L Summary */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="font-semibold text-gray-700 border-b pb-2">Profit & Loss — {new Date(mStart).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Total Sales</span><span className="font-semibold text-gray-800">{inr(totalSales)}</span></div>
            <div className="flex justify-between pl-4 text-xs"><span className="text-gray-500">↳ Cash Sales</span><span>{inr(cashSales)}</span></div>
            <div className="flex justify-between pl-4 text-xs"><span className="text-gray-500">↳ Credit Sales</span><span>{inr(creditSales)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Collections Received</span><span className="font-semibold text-blue-700">{inr(totalCollected)}</span></div>
            {chequeCollected > 0 && <div className="flex justify-between pl-4 text-xs"><span className="text-gray-500">↳ Via Cheque</span><span>{inr(chequeCollected)}</span></div>}
            <div className="border-t my-1" />
            <div className="flex justify-between"><span className="text-gray-600">Total Expenses</span><span className="font-semibold text-red-600">{inr(totalExp)}</span></div>
            <div className="border-t my-1" />
            <div className="flex justify-between text-base font-bold">
              <span>Net Profit</span>
              <span className={totalSales - totalExp >= 0 ? 'text-green-600' : 'text-red-600'}>{inr(totalSales - totalExp)}</span>
            </div>
          </div>
        </div>

        {/* Outstanding Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="font-semibold text-gray-700 border-b pb-2">Outstanding Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Total Outstanding</span><span className="font-bold text-orange-600">{inr(totalOutstanding)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Parties with dues</span><span className="font-semibold">{customers.filter(c => c.outstanding_amount > 0).length}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Overdue 30+ days</span><span className={`font-bold ${overdueCustomers.length > 0 ? 'text-red-600' : 'text-gray-500'}`}>{overdueCustomers.length}</span></div>
          </div>
          {overdueCustomers.length > 0 && (
            <div className="border-t pt-2 space-y-1 max-h-40 overflow-y-auto">
              {overdueCustomers.slice(0, 8).map(c => (
                <div key={c.id} className="flex justify-between text-xs">
                  <span className="text-gray-700 truncate mr-2">{c.name}</span>
                  <span className="font-semibold text-orange-600 shrink-0">{inr(c.outstanding_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expense Breakdown */}
      {Object.keys(expByCategory).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-3 border-b pb-2">Expense Breakdown</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(expByCategory).sort(([, a], [, b]) => b - a).map(([cat, amt]) => (
              <div key={cat} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">{cat}</p>
                <p className="font-semibold text-gray-800">{inr(amt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
