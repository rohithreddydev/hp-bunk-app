// ═══════════════════════════════════════════════════════════════════════════
// Smart Biz AI — Kirana Store Module
// Orange theme — ki_ Supabase tables
// Features: batch tracking, FMCG categories, daily sales, supplier ledger,
//           customer credit, opening/closing stock, expense tracking
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Truck, Receipt,
  Plus, Edit2, Trash2, X, Search, AlertTriangle, CheckCircle2,
  Loader2, TrendingUp, TrendingDown, Wallet, BarChart3,
  Settings as SettingsIcon, LogOut, FileText, Calendar, BookOpen,
  ChevronRight, DollarSign, CreditCard, ArrowUpRight, ArrowDownLeft,
  Brain, Download,
} from 'lucide-react';
import { SettingsTab } from './SettingsTab';
import { IntelligenceTab } from './IntelligenceTab';
import { supabase } from './supabase';
import { getTodayIST, formatISTDate } from './utils';

function inr(n: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);
}

const CATEGORIES = [
  'Rice & Dal', 'Oil & Ghee', 'Spices & Masala', 'FMCG / Packaged',
  'Beverages', 'Snacks', 'Dairy Products', 'Fresh Produce',
  'Cleaning & Hygiene', 'Personal Care', 'Other',
];
const UNITS = ['kg', 'gram', 'litre', 'ml', 'piece', 'pack', 'bundle', 'dozen', 'box', 'sachet'];
const PAYMENT_MODES = ['cash', 'upi', 'card', 'credit'];
const EXPENSE_CATEGORIES = ['Rent', 'Electricity', 'Staff Salary', 'Transport', 'Wastage', 'Marketing', 'Other'];

interface Product {
  id: string; bunk_id: string; name: string; brand: string; category: string;
  unit: string; selling_price: number; purchase_price: number; mrp: number;
  current_stock: number; reorder_level: number; is_active: boolean; created_at: string;
}
interface Customer {
  id: string; bunk_id: string; name: string; phone: string; address: string;
  credit_limit: number; outstanding_amount: number; is_active: boolean; created_at: string;
  last_payment_date?: string;
}
interface Supplier {
  id: string; bunk_id: string; name: string; phone: string; company: string;
  outstanding_amount: number; is_active: boolean;
}
interface Sale {
  id: string; bunk_id: string; customer_id: string | null; customer_name: string;
  sale_date: string; total_amount: number; payment_mode: string; payment_status: string;
  notes: string; created_at: string;
}
interface Purchase {
  id: string; bunk_id: string; supplier_id: string | null; supplier_name: string;
  invoice_number: string; purchase_date: string; total_amount: number;
  payment_mode: string; notes: string; created_at: string;
}
interface Expense {
  id: string; bunk_id: string; category: string; description: string;
  amount: number; expense_date: string; payment_mode: string; notes: string; created_at: string;
}
interface CartItem { product: Product; quantity: number; price: number; }
interface LedgerEntry { date: string; type: 'sale' | 'payment'; amount: number; label: string; mode?: string; running_balance?: number; }

type Tab = 'dashboard' | 'inventory' | 'sales' | 'customers' | 'suppliers' | 'purchases' | 'expenses' | 'reports' | 'intelligence' | 'settings';

export function KiranaApp({ bunkId, onLogout, user }: { bunkId: string; onLogout: () => void; user: { name: string; email: string; role: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
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
    const [p, c, su, sa, pu, ex] = await Promise.all([
      supabase.from('ki_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('ki_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('ki_suppliers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('ki_sales').select('*').eq('bunk_id', bunkId).order('sale_date', { ascending: false }).limit(200),
      supabase.from('ki_purchases').select('*').eq('bunk_id', bunkId).order('purchase_date', { ascending: false }).limit(100),
      supabase.from('ki_expenses').select('*').eq('bunk_id', bunkId).order('expense_date', { ascending: false }).limit(200),
    ]);
    if (p.data) setProducts(p.data as Product[]);
    if (c.data) setCustomers(c.data as Customer[]);
    if (su.data) setSuppliers(su.data as Supplier[]);
    if (sa.data) setSales(sa.data as Sale[]);
    if (pu.data) setPurchases(pu.data as Purchase[]);
    if (ex.data) setExpenses(ex.data as Expense[]);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const today = getTodayIST();
  const todaySales = sales.filter(s => s.sale_date === today);
  const todaySalesTotal = todaySales.reduce((a, s) => a + s.total_amount, 0);
  const todayCashSales = todaySales.filter(s => s.payment_mode === 'cash').reduce((a, s) => a + s.total_amount, 0);
  const todayCreditSales = todaySales.filter(s => s.payment_mode === 'credit').reduce((a, s) => a + s.total_amount, 0);
  const todayExpenses = expenses.filter(e => e.expense_date === today).reduce((a, e) => a + e.amount, 0);
  const lowStock = products.filter(p => p.current_stock <= p.reorder_level);
  const totalCreditOutstanding = customers.reduce((a, c) => a + c.outstanding_amount, 0);
  const stockValue = products.reduce((a, p) => a + p.current_stock * p.purchase_price, 0);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'inventory', label: 'Stock', icon: <Package size={16} /> },
    { id: 'sales', label: 'Sales / Billing', icon: <ShoppingCart size={16} /> },
    { id: 'customers', label: 'Customers', icon: <Users size={16} /> },
    { id: 'suppliers', label: 'Suppliers', icon: <Truck size={16} /> },
    { id: 'purchases', label: 'Purchases', icon: <BarChart3 size={16} /> },
    { id: 'expenses', label: 'Expenses', icon: <Receipt size={16} /> },
    { id: 'reports', label: 'Reports', icon: <FileText size={16} /> },
    { id: 'intelligence', label: 'AI Insights', icon: <Brain size={14} /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-orange-600 text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <span className="text-2xl">🛒</span>
        <div>
          <h1 className="font-bold text-lg leading-tight">Kirana Store</h1>
          <p className="text-orange-200 text-xs">Smart Biz AI</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-orange-200">Stock Value</div>
            <div className="text-sm font-bold">{inr(stockValue)}</div>
          </div>
          <button onClick={onLogout} className="p-2 rounded-lg hover:bg-white/20 transition" title="Sign Out">
            <LogOut size={20} />
          </button>
        </div>
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
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="p-4 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-orange-600" size={32} /></div>
        ) : (
          <>
            {activeTab === 'dashboard' && <KiDashboard todaySalesTotal={todaySalesTotal} todayCashSales={todayCashSales} todayCreditSales={todayCreditSales} todayExpenses={todayExpenses} lowStock={lowStock} stockValue={stockValue} totalCreditOutstanding={totalCreditOutstanding} recentSales={sales.slice(0, 8)} />}
            {activeTab === 'inventory' && <KiInventory bunkId={bunkId} products={products} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'sales' && <KiSales bunkId={bunkId} products={products} customers={customers} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'customers' && <KiCustomers bunkId={bunkId} customers={customers} sales={sales} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'suppliers' && <KiSuppliers bunkId={bunkId} suppliers={suppliers} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'purchases' && <KiPurchases bunkId={bunkId} purchases={purchases} suppliers={suppliers} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'expenses' && <KiExpenses bunkId={bunkId} expenses={expenses} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'reports' && <KiReports bunkId={bunkId} />}
            {user.role === 'owner' && activeTab === 'intelligence' && <IntelligenceTab bunkId={bunkId} />}
            {activeTab === 'settings' && <SettingsTab bunkId={bunkId} user={user} onLogout={onLogout} />}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function KiDashboard({ todaySalesTotal, todayCashSales, todayCreditSales, todayExpenses, lowStock, stockValue, totalCreditOutstanding, recentSales }: {
  todaySalesTotal: number; todayCashSales: number; todayCreditSales: number; todayExpenses: number;
  lowStock: Product[]; stockValue: number; totalCreditOutstanding: number; recentSales: Sale[];
}) {
  const netProfit = todaySalesTotal - todayExpenses;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Today's Sales", value: inr(todaySalesTotal), sub: `Cash: ${inr(todayCashSales)}`, color: 'bg-green-50 border-green-200 text-green-700', icon: <TrendingUp size={18} /> },
          { label: "Credit Given Today", value: inr(todayCreditSales), sub: `Total outstanding: ${inr(totalCreditOutstanding)}`, color: 'bg-orange-50 border-orange-200 text-orange-700', icon: <Wallet size={18} /> },
          { label: "Today's Expenses", value: inr(todayExpenses), sub: `Net: ${inr(netProfit)}`, color: 'bg-red-50 border-red-200 text-red-700', icon: <TrendingDown size={18} /> },
          { label: "Stock Value", value: inr(stockValue), sub: `${lowStock.length} items low`, color: 'bg-blue-50 border-blue-200 text-blue-700', icon: <Package size={18} /> },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-3 ${k.color}`}>
            <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium opacity-80">{k.label}</span>{k.icon}</div>
            <p className="text-lg font-bold">{k.value}</p>
            <p className="text-xs opacity-70 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-500" /> Low Stock Alert ({lowStock.length})
          </h2>
          {lowStock.length === 0 ? <p className="text-gray-400 text-sm">All products well-stocked.</p> : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {lowStock.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div><p className="text-sm font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-400">{p.brand} · {p.category}</p></div>
                  <div className="text-right">
                    <span className={`text-sm font-semibold ${p.current_stock <= 0 ? 'text-red-600' : 'text-yellow-600'}`}>{p.current_stock} {p.unit}</span>
                    <p className="text-xs text-gray-400">min: {p.reorder_level}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ShoppingCart size={16} className="text-orange-600" /> Recent Sales
          </h2>
          {recentSales.length === 0 ? <p className="text-gray-400 text-sm">No sales recorded yet.</p> : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {recentSales.map(s => (
                <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div><p className="text-sm font-medium text-gray-800">{s.customer_name || 'Walk-in'}</p><p className="text-xs text-gray-400">{formatISTDate(s.sale_date)} · {s.payment_mode}</p></div>
                  <span className={`text-sm font-semibold ${s.payment_mode === 'credit' ? 'text-orange-600' : 'text-green-600'}`}>{inr(s.total_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Inventory ─────────────────────────────────────────────────────────────────
interface ProdForm { name: string; brand: string; category: string; unit: string; mrp: number; selling_price: number; purchase_price: number; current_stock: number; reorder_level: number; }
const defaultPF = (): ProdForm => ({ name: '', brand: '', category: CATEGORIES[0], unit: UNITS[0], mrp: 0, selling_price: 0, purchase_price: 0, current_stock: 0, reorder_level: 5 });

function KiInventory({ bunkId, products, onRefresh, showToast }: { bunkId: string; products: Product[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProdForm>(defaultPF());
  const [saving, setSaving] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustMode, setAdjustMode] = useState<'add' | 'remove'>('add');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('Physical count');
  const [adjustSaving, setAdjustSaving] = useState(false);
  // BUG-FIX: Replace browser confirm() with React state modal (confirm() is blocked on mobile PWA)
  const [confirmState, setConfirmState] = useState<{ msg: string; onYes: () => void } | null>(null);
  const showConfirm = (msg: string, onYes: () => void) => setConfirmState({ msg, onYes });

  async function handleAdjust() {
    if (!adjustProduct || !adjustQty) return;
    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty <= 0) { showToast('Enter a valid quantity', 'error'); return; }
    setAdjustSaving(true);
    const { data: fresh } = await supabase.from('ki_products').select('current_stock').eq('id', adjustProduct.id).eq('bunk_id', bunkId).single();
    const base = Number(fresh?.current_stock || 0);
    const newStock = adjustMode === 'add' ? base + qty : Math.max(0, base - qty);
    const { error } = await supabase.from('ki_products').update({ current_stock: newStock }).eq('id', adjustProduct.id).eq('bunk_id', bunkId);
    setAdjustSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(`Stock adjusted: ${adjustProduct.name} → ${newStock} ${adjustProduct.unit}`);
    setAdjustProduct(null); setAdjustQty(''); setAdjustReason('Physical count'); onRefresh();
  }

  const filtered = products.filter(p => {
    const match = p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand || '').toLowerCase().includes(search.toLowerCase());
    return match && (catFilter === 'All' || p.category === catFilter);
  });

  function openAdd() { setEditing(null); setForm(defaultPF()); setShowModal(true); }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, brand: p.brand || '', category: p.category, unit: p.unit, mrp: p.mrp, selling_price: p.selling_price, purchase_price: p.purchase_price, current_stock: p.current_stock, reorder_level: p.reorder_level });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Product name required', 'error'); return; }
    if (form.selling_price <= 0) { showToast('Selling price must be > 0', 'error'); return; }
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId, is_active: true };
    const { error } = editing ? await supabase.from('ki_products').update(payload).eq('id', editing.id).eq('bunk_id', bunkId) : await supabase.from('ki_products').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editing ? 'Product updated' : 'Product added');
    setShowModal(false); onRefresh();
  }

  function handleDelete(p: Product) {
    // BUG-FIX: use React modal instead of browser confirm() — confirm() is blocked on mobile PWA/fullscreen
    showConfirm(`Remove "${p.name}" from inventory?`, async () => {
      const { error } = await supabase.from('ki_products').update({ is_active: false }).eq('id', p.id).eq('bunk_id', bunkId);
      if (error) { showToast(error.message, 'error'); return; }
      showToast('Product removed'); onRefresh();
    });
  }

  const setF = (k: keyof ProdForm, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">
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
                <th className="px-4 py-3 text-right">MRP</th>
                <th className="px-4 py-3 text-right">Selling</th>
                <th className="px-4 py-3 text-right">Purchase</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-gray-400">No products found.</td></tr>}
              {filtered.map(p => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-400">{p.brand || '—'} · {p.unit}</p></td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{p.category}</td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">{inr(p.mrp)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">{inr(p.selling_price)}</td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">{inr(p.purchase_price)}</td>
                  <td className="px-4 py-3 text-right"><span className={`font-semibold ${p.current_stock <= p.reorder_level ? 'text-red-600' : 'text-gray-800'}`}>{p.current_stock} {p.unit}</span></td>
                  <td className="px-4 py-3 text-center">{p.current_stock <= p.reorder_level ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Low</span> : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">OK</span>}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setAdjustProduct(p); setAdjustMode('add'); setAdjustQty(''); }} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-200">± Adjust</button>
                      <button onClick={() => openEdit(p)} className="text-orange-600 hover:text-orange-800"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(p)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BUG-FIX: React-based confirm modal — replaces browser confirm() which is blocked on mobile PWA */}
      {confirmState && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-2 text-red-600 mb-3">
              <AlertTriangle size={22} />
              <h3 className="font-bold text-gray-900">Confirm</h3>
            </div>
            <p className="text-gray-700 mb-6 text-sm">{confirmState.msg}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmState(null)} className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition text-sm">Cancel</button>
              <button onClick={() => { const fn = confirmState.onYes; setConfirmState(null); fn(); }} className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      {adjustProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Adjust Stock — {adjustProduct.name}</h2>
              <button onClick={() => setAdjustProduct(null)}><X size={20} /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-500">Current stock: <span className="font-bold text-gray-800">{adjustProduct.current_stock} {adjustProduct.unit}</span></p>
              <div className="flex gap-2">
                <button onClick={() => setAdjustMode('add')} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${adjustMode === 'add' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-600'}`}>+ Add</button>
                <button onClick={() => setAdjustMode('remove')} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${adjustMode === 'remove' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-600'}`}>− Remove</button>
              </div>
              <div><label className="text-xs text-gray-500 mb-1 block">Quantity ({adjustProduct.unit}) *</label><input type="number" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="e.g. 20" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Reason</label>
                <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {['Physical count', 'Supplier delivery', 'Damage / Wastage', 'Transfer in', 'Transfer out', 'Other'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setAdjustProduct(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdjust} disabled={adjustSaving} className={`flex-1 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2 ${adjustMode === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {adjustSaving && <Loader2 size={14} className="animate-spin" />}{adjustSaving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white"><h2 className="text-lg font-semibold">{editing ? 'Edit Product' : 'Add Product'}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Product Name *</label><input value={form.name} onChange={e => setF('name', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Brand / Company</label><input value={form.brand} onChange={e => setF('brand', e.target.value)} placeholder="e.g., Aashirvaad, Amul" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Category</label><select value={form.category} onChange={e => setF('category', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Unit</label><select value={form.unit} onChange={e => setF('unit', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">{UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">MRP (₹)</label><input type="number" value={form.mrp} onChange={e => setF('mrp', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Selling Price (₹) *</label><input type="number" value={form.selling_price} onChange={e => setF('selling_price', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Purchase Price (₹)</label><input type="number" value={form.purchase_price} onChange={e => setF('purchase_price', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Current Stock</label><input type="number" value={form.current_stock} onChange={e => setF('current_stock', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Reorder Level</label><input type="number" value={form.reorder_level} onChange={e => setF('reorder_level', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sales / Billing ────────────────────────────────────────────────────────────
function KiSales({ bunkId, products, customers, onRefresh, showToast }: { bunkId: string; products: Product[]; customers: Customer[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [saleDate, setSaleDate] = useState(getTodayIST());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand || '').toLowerCase().includes(search.toLowerCase()));

  function addToCart(p: Product) {
    setCart(c => {
      const ex = c.find(i => i.product.id === p.id);
      if (ex) return c.map(i => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...c, { product: p, quantity: 1, price: p.selling_price }];
    });
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) { setCart(c => c.filter(i => i.product.id !== id)); return; }
    setCart(c => c.map(i => i.product.id === id ? { ...i, quantity: qty } : i));
  }

  function updatePrice(id: string, price: number) {
    setCart(c => c.map(i => i.product.id === id ? { ...i, price: price > 0 ? price : i.price } : i));
  }

  const total = cart.reduce((a, i) => a + i.price * i.quantity, 0);
  const selectedCustomer = customers.find(c => c.id === customerId);

  async function handleSell() {
    if (cart.length === 0) { showToast('Cart is empty', 'error'); return; }
    if (paymentMode === 'credit' && !customerId) { showToast('Select a customer for credit sale', 'error'); return; }
    setSaving(true);
    const customerName = selectedCustomer?.name || 'Walk-in';
    const { data: sale, error: sErr } = await supabase.from('ki_sales').insert({
      bunk_id: bunkId, customer_id: customerId || null, customer_name: customerName,
      sale_date: saleDate, total_amount: total, payment_mode: paymentMode,
      payment_status: paymentMode === 'credit' ? 'credit' : 'paid', notes,
    }).select().single();
    if (sErr || !sale) { showToast(sErr?.message || 'Sale failed', 'error'); setSaving(false); return; }

    await supabase.from('ki_sale_items').insert(cart.map(i => ({
      sale_id: sale.id, bunk_id: bunkId, product_id: i.product.id,
      product_name: i.product.name, quantity: i.quantity, unit_price: i.price, total_price: i.price * i.quantity,
    })));
    // BUG-FIX: read fresh stock from DB to prevent race-condition overwrites; also add bunk_id guard
    for (const i of cart) {
      const { data: freshProd } = await supabase.from('ki_products').select('current_stock').eq('id', i.product.id).eq('bunk_id', bunkId).single();
      const newStock = Math.max(0, Number(freshProd?.current_stock || 0) - i.quantity);
      await supabase.from('ki_products').update({ current_stock: newStock }).eq('id', i.product.id).eq('bunk_id', bunkId);
    }
    if (paymentMode === 'credit' && customerId) {
      const { data: freshCust } = await supabase.from('ki_customers').select('outstanding_amount').eq('id', customerId).eq('bunk_id', bunkId).maybeSingle();
      const base = freshCust ? Number(freshCust.outstanding_amount) : (Number(selectedCustomer?.outstanding_amount) || 0);
      await supabase.from('ki_customers').update({ outstanding_amount: base + total }).eq('id', customerId).eq('bunk_id', bunkId);
    }
    showToast('Sale recorded!');
    setCart([]); setCustomerId(''); setNotes(''); setSaleDate(getTodayIST());
    setSaving(false); onRefresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products to add…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: 380, overflowY: 'auto' }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase sticky top-0">
                <tr><th className="px-4 py-2 text-left">Product</th><th className="px-4 py-2 text-right">Price</th><th className="px-4 py-2 text-right">Stock</th><th className="px-4 py-2"></th></tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-sm">No products found. Add products in Stock tab.</td></tr>}
                {filteredProducts.map(p => (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-orange-50">
                    <td className="px-4 py-2"><p className="font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-400">{p.brand || p.category}</p></td>
                    <td className="px-4 py-2 text-right text-gray-700">{inr(p.selling_price)}</td>
                    <td className="px-4 py-2 text-right text-gray-500 text-xs">{p.current_stock} {p.unit}</td>
                    <td className="px-4 py-2 text-right"><button onClick={() => addToCart(p)} disabled={p.current_stock <= 0} className="bg-orange-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-orange-700 disabled:opacity-40"><Plus size={12} className="inline" /> Add</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 h-fit">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2"><ShoppingCart size={16} className="text-orange-600" /> Cart</h2>
        {cart.length === 0 ? <p className="text-gray-400 text-sm py-4 text-center">Add items from the product list</p> : (
          <div className="space-y-2 max-h-44 overflow-y-auto">
            {cart.map(i => (
              <div key={i.product.id} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{i.product.name}</p>
                  <input type="number" value={i.price} onChange={e => updatePrice(i.product.id, parseFloat(e.target.value))} className="text-xs text-orange-600 w-16 border-none outline-none bg-transparent" title="Edit price" />
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(i.product.id, i.quantity - 1)} className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100 text-xs">−</button>
                  <span className="w-7 text-center text-sm font-medium">{i.quantity}</span>
                  <button onClick={() => updateQty(i.product.id, i.quantity + 1)} className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100 text-xs">+</button>
                </div>
                <span className="text-sm font-semibold text-gray-800 w-14 text-right">{inr(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>
        )}
        {cart.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between text-base font-bold"><span>Total</span><span className="text-orange-600">{inr(total)}</span></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Customer</label>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Walk-in Customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.outstanding_amount > 0 ? ` (₹${c.outstanding_amount} due)` : ''}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label>
              <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <button onClick={handleSell} disabled={saving} className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Processing…' : `Complete Sale · ${inr(total)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Customers ──────────────────────────────────────────────────────────────────
interface CustForm { name: string; phone: string; address: string; credit_limit: number; }
const defaultCF = (): CustForm => ({ name: '', phone: '', address: '', credit_limit: 0 });

function agingBadge(lastDate: string | null | undefined) {
  const d = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : 999;
  if (d < 8) return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{d}d</span>;
  if (d < 31) return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{d}d</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">{d === 999 ? 'new' : d + 'd'}</span>;
}

const CUST_PAGE_SIZE = 10;

function KiCustomers({ bunkId, customers, sales, onRefresh, showToast }: { bunkId: string; customers: Customer[]; sales: Sale[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [search, setSearch] = useState('');
  const [custPage, setCustPage] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustForm>(defaultCF());
  const [saving, setSaving] = useState(false);
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [ledgerCust, setLedgerCust] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [payingId, setPayingId] = useState('');

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  function openAdd() { setEditing(null); setForm(defaultCF()); setShowModal(true); }
  function openEdit(c: Customer) { setEditing(c); setForm({ name: c.name, phone: c.phone, address: c.address || '', credit_limit: c.credit_limit || 0 }); setShowModal(true); }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Customer name required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId, is_active: true };
    const { error } = editing ? await supabase.from('ki_customers').update(payload).eq('id', editing.id).eq('bunk_id', bunkId) : await supabase.from('ki_customers').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editing ? 'Customer updated' : 'Customer added');
    setShowModal(false); onRefresh();
  }

  async function handlePayment(c: Customer) {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    setPayingId(c.id);
    await supabase.from('ki_payments').insert({ bunk_id: bunkId, customer_id: c.id, customer_name: c.name, amount, payment_mode: payMode, payment_date: getTodayIST() });
    const { data: freshC } = await supabase.from('ki_customers').select('outstanding_amount').eq('id', c.id).eq('bunk_id', bunkId).maybeSingle();
    const base = freshC ? Number(freshC.outstanding_amount) : Number(c.outstanding_amount);
    const { error } = await supabase.from('ki_customers').update({ outstanding_amount: Math.max(0, base - amount) }).eq('id', c.id).eq('bunk_id', bunkId);
    if (error) { showToast(error.message, 'error'); setPayingId(''); return; }
    showToast(`Payment of ${inr(amount)} recorded`);
    setSelectedCust(null); setPayAmount(''); setPayingId(''); onRefresh();
  }

  const creditCustomers = customers.filter(c => c.outstanding_amount > 0);
  const totalOutstanding = customers.reduce((a, c) => a + c.outstanding_amount, 0);

  return (
    <div className="space-y-4">
      {totalOutstanding > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-orange-700">Total Credit Outstanding</p>
            <p className="text-xs text-orange-600">{creditCustomers.length} customers with dues</p>
          </div>
          <span className="text-xl font-bold text-orange-700">{inr(totalOutstanding)}</span>
        </div>
      )}

      <div className="flex gap-3 items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-right">Credit Limit</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-center">Aging</th><th className="px-4 py-3 text-center">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">No customers found.</td></tr>}
              {filtered.slice(custPage * CUST_PAGE_SIZE, (custPage + 1) * CUST_PAGE_SIZE).map(c => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{c.credit_limit > 0 ? inr(c.credit_limit) : '—'}</td>
                  <td className="px-4 py-3 text-right"><span className={`font-semibold ${c.outstanding_amount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{inr(c.outstanding_amount)}</span></td>
                  <td className="px-4 py-3 text-center">{agingBadge(c.last_payment_date)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setLedgerCust(c)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-200">Ledger</button>
                      {c.outstanding_amount > 0 && (
                        <button onClick={() => setSelectedCust(c)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200">Pay</button>
                      )}
                      <button onClick={() => openEdit(c)} className="text-orange-600 hover:text-orange-800"><Edit2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > CUST_PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
            <span>{custPage * CUST_PAGE_SIZE + 1}–{Math.min((custPage + 1) * CUST_PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-2">
              <button disabled={custPage === 0} onClick={() => setCustPage(p => p - 1)} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Prev</button>
              <button disabled={(custPage + 1) * CUST_PAGE_SIZE >= filtered.length} onClick={() => setCustPage(p => p + 1)} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {ledgerCust && <KiLedgerModal bunkId={bunkId} customer={ledgerCust} onClose={() => setLedgerCust(null)} />}

      {selectedCust && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">Record Payment — {selectedCust.name}</h2><button onClick={() => setSelectedCust(null)}><X size={20} /></button></div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600">Outstanding: <span className="font-bold text-orange-600">{inr(selectedCust.outstanding_amount)}</span></p>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Amount (₹) *</label><input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Enter amount" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label><select value={payMode} onChange={e => setPayMode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{['cash', 'upi', 'card'].map(m => <option key={m}>{m}</option>)}</select></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setSelectedCust(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={() => handlePayment(selectedCust)} disabled={!!payingId} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60">{payingId ? 'Saving…' : 'Record Payment'}</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">{editing ? 'Edit Customer' : 'Add Customer'}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="p-5 space-y-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Address</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Credit Limit (₹, 0 = unlimited)</label><input type="number" value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Suppliers ──────────────────────────────────────────────────────────────────
interface SupForm { name: string; phone: string; company: string; }
const defaultSF = (): SupForm => ({ name: '', phone: '', company: '' });

function KiSuppliers({ bunkId, suppliers, onRefresh, showToast }: { bunkId: string; suppliers: Supplier[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupForm>(defaultSF());
  const [saving, setSaving] = useState(false);

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.company || '').toLowerCase().includes(search.toLowerCase()));
  const totalDue = suppliers.reduce((a, s) => a + s.outstanding_amount, 0);

  function openAdd() { setEditing(null); setForm(defaultSF()); setShowModal(true); }
  function openEdit(s: Supplier) { setEditing(s); setForm({ name: s.name, phone: s.phone || '', company: s.company || '' }); setShowModal(true); }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Supplier name required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId, is_active: true };
    const { error } = editing ? await supabase.from('ki_suppliers').update(payload).eq('id', editing.id).eq('bunk_id', bunkId) : await supabase.from('ki_suppliers').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editing ? 'Supplier updated' : 'Supplier added');
    setShowModal(false); onRefresh();
  }

  return (
    <div className="space-y-4">
      {totalDue > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
          <div><p className="text-sm font-semibold text-red-700">Total Supplier Dues</p><p className="text-xs text-red-600">Amount you owe suppliers</p></div>
          <span className="text-xl font-bold text-red-700">{inr(totalDue)}</span>
        </div>
      )}
      <div className="flex gap-3 items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">
          <Plus size={16} /> Add Supplier
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Company</th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-right">Due</th><th className="px-4 py-3 text-center">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">No suppliers found.</td></tr>}
              {filtered.map(s => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.company || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.phone || '—'}</td>
                  <td className="px-4 py-3 text-right"><span className={`font-semibold ${s.outstanding_amount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{inr(s.outstanding_amount)}</span></td>
                  <td className="px-4 py-3 text-center"><button onClick={() => openEdit(s)} className="text-orange-600 hover:text-orange-800"><Edit2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">{editing ? 'Edit Supplier' : 'Add Supplier'}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="p-5 space-y-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Company / Brand</label><input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="e.g., HUL, ITC, Nestlé" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Purchases ──────────────────────────────────────────────────────────────────
interface PurchForm { supplier_id: string; supplier_name: string; invoice_number: string; purchase_date: string; total_amount: number; payment_mode: string; notes: string; }
const defaultPurchF = (): PurchForm => ({ supplier_id: '', supplier_name: '', invoice_number: '', purchase_date: getTodayIST(), total_amount: 0, payment_mode: 'credit', notes: '' });

function KiPurchases({ bunkId, purchases, suppliers, onRefresh, showToast }: { bunkId: string; purchases: Purchase[]; suppliers: Supplier[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<PurchForm>(defaultPurchF());
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (form.total_amount <= 0) { showToast('Amount required', 'error'); return; }
    if (!form.supplier_name.trim()) { showToast('Supplier required', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('ki_purchases').insert({ ...form, bunk_id: bunkId });
    if (!error && form.payment_mode === 'credit' && form.supplier_id) {
      // BUG-FIX: read fresh outstanding_amount from DB (avoid stale in-memory value) + add bunk_id guard
      const { data: freshSup } = await supabase.from('ki_suppliers').select('outstanding_amount').eq('id', form.supplier_id).eq('bunk_id', bunkId).single();
      const base = freshSup ? Number(freshSup.outstanding_amount || 0) : 0;
      await supabase.from('ki_suppliers').update({ outstanding_amount: base + form.total_amount }).eq('id', form.supplier_id).eq('bunk_id', bunkId);
    }
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Purchase recorded'); setShowModal(false); setForm(defaultPurchF()); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700"><Plus size={16} /> Add Purchase</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Supplier</th><th className="px-4 py-3 text-left">Invoice</th><th className="px-4 py-3 text-left">Mode</th><th className="px-4 py-3 text-right">Amount</th></tr>
            </thead>
            <tbody>
              {purchases.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">No purchases yet.</td></tr>}
              {purchases.map(p => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{formatISTDate(p.purchase_date)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.supplier_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.invoice_number || '—'}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${p.payment_mode === 'credit' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{p.payment_mode}</span></td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{inr(p.total_amount)}</td>
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
              <div><label className="text-xs text-gray-500 mb-1 block">Supplier</label>
                <select value={form.supplier_id} onChange={e => { const s = suppliers.find(s => s.id === e.target.value); setForm(f => ({ ...f, supplier_id: e.target.value, supplier_name: s?.name || '' })); }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select supplier or type name</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.company ? ` (${s.company})` : ''}</option>)}
                </select>
              </div>
              {!form.supplier_id && <div><label className="text-xs text-gray-500 mb-1 block">Or type supplier name</label><input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>}
              <div><label className="text-xs text-gray-500 mb-1 block">Invoice Number</label><input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Total Amount (₹) *</label><input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label><select value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{['cash', 'credit', 'upi', 'card'].map(m => <option key={m}>{m}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
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

function KiExpenses({ bunkId, expenses, onRefresh, showToast }: { bunkId: string; expenses: Expense[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ExpForm>(defaultEF());
  const [saving, setSaving] = useState(false);
  const today = getTodayIST();
  const todayTotal = expenses.filter(e => e.expense_date === today).reduce((a, e) => a + e.amount, 0);

  async function handleSave() {
    if (!form.description.trim() || form.amount <= 0) { showToast('Description and amount required', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('ki_expenses').insert({ ...form, bunk_id: bunkId });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Expense recorded'); setShowModal(false); setForm(defaultEF()); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2">
          <p className="text-xs text-red-600">Today's Expenses</p>
          <p className="text-lg font-bold text-red-700">{inr(todayTotal)}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700"><Plus size={16} /> Add Expense</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-left">Mode</th><th className="px-4 py-3 text-right">Amount</th></tr>
            </thead>
            <tbody>
              {expenses.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">No expenses recorded.</td></tr>}
              {expenses.map(e => (
                <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{formatISTDate(e.expense_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{e.category}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{e.description}</td>
                  <td className="px-4 py-3 text-gray-600">{e.payment_mode}</td>
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
              <div><label className="text-xs text-gray-500 mb-1 block">Description *</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label><input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label><select value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{['cash', 'upi', 'card'].map(m => <option key={m}>{m}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Customer Ledger Modal ─────────────────────────────────────────────────────
function KiLedgerModal({ bunkId, customer, onClose }: { bunkId: string; customer: Customer; onClose: () => void }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: salesData }, { data: paymentsData }] = await Promise.all([
        supabase.from('ki_sales').select('sale_date, total_amount, payment_mode').eq('customer_id', customer.id).eq('bunk_id', bunkId),
        supabase.from('ki_payments').select('payment_date, amount, payment_mode').eq('customer_id', customer.id).eq('bunk_id', bunkId),
      ]);
      const all: LedgerEntry[] = [
        ...(salesData || []).map(s => ({ date: s.sale_date, type: 'sale' as const, amount: s.total_amount, label: 'Sale', mode: s.payment_mode })),
        ...(paymentsData || []).map(p => ({ date: p.payment_date, type: 'payment' as const, amount: p.amount, label: 'Payment', mode: p.payment_mode })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      let bal = 0;
      all.forEach(e => {
        bal += (e.type === 'sale' && e.mode === 'credit') ? e.amount : e.type === 'payment' ? -e.amount : 0;
        e.running_balance = bal;
      });
      setEntries(all); setLoading(false);
    }
    load();
  }, [bunkId, customer.id]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{customer.name} — Ledger</h2>
            <p className="text-xs text-gray-500">Outstanding: <span className="font-semibold text-orange-600">{inr(customer.outstanding_amount)}</span></p>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-orange-600" size={24} /></div> : entries.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No transactions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Balance</th></tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-600 text-xs">{e.date}</td>
                    <td className="px-3 py-2">
                      {e.type === 'sale'
                        ? <span className="flex items-center gap-1 text-red-600 text-xs"><ArrowUpRight size={11} />Sale{e.mode === 'credit' ? ' (cr)' : ''}</span>
                        : <span className="flex items-center gap-1 text-green-600 text-xs"><ArrowDownLeft size={11} />Payment</span>}
                    </td>
                    <td className={`px-3 py-2 text-right font-medium text-sm ${e.type === 'payment' ? 'text-green-600' : 'text-red-600'}`}>
                      {e.type === 'payment' ? '-' : '+'}{inr(e.amount)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800 text-sm">{inr(e.running_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl text-right">
          <span className="text-sm text-gray-600">Outstanding: </span>
          <span className="font-bold text-orange-600 text-base">{inr(customer.outstanding_amount)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Reports Tab ───────────────────────────────────────────────────────────────
function KiReports({ bunkId }: { bunkId: string }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [data, setData]   = useState<{
    totalSales: number; cashSales: number; creditSales: number; upiSales: number;
    totalExp: number; totalCollections: number; grossProfit: number;
    topProducts: { name: string; qty: number; rev: number }[];
    topCustomers: { name: string; outstanding_amount: number }[];
    expenseBreakdown: { category: string; total: number }[];
    txCount: number;
    sales: { sale_date: string; customer_name: string; total_amount: number; payment_mode: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadReport() {
    setLoading(true);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const toDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    const [{ data: sales }, { data: expenses }, { data: payments }, { data: saleItems }, { data: products }, { data: topCusts }] = await Promise.all([
      supabase.from('ki_sales').select('sale_date, customer_name, total_amount, payment_mode').eq('bunk_id', bunkId).gte('sale_date', fromDate).lt('sale_date', toDate),
      supabase.from('ki_expenses').select('amount, category').eq('bunk_id', bunkId).gte('expense_date', fromDate).lt('expense_date', toDate),
      supabase.from('ki_payments').select('amount').eq('bunk_id', bunkId).gte('payment_date', fromDate).lt('payment_date', toDate),
      supabase.from('ki_sale_items').select('product_name, quantity, total_price, product_id').eq('bunk_id', bunkId),
      supabase.from('ki_products').select('id, purchase_price').eq('bunk_id', bunkId),
      supabase.from('ki_customers').select('name, outstanding_amount').eq('bunk_id', bunkId).order('outstanding_amount', { ascending: false }).limit(5),
    ]);

    const totalSales       = (sales || []).reduce((a: number, s: { total_amount: number }) => a + s.total_amount, 0);
    const cashSales        = (sales || []).filter((s: { payment_mode: string }) => s.payment_mode === 'cash').reduce((a: number, s: { total_amount: number }) => a + s.total_amount, 0);
    const creditSales      = (sales || []).filter((s: { payment_mode: string }) => s.payment_mode === 'credit').reduce((a: number, s: { total_amount: number }) => a + s.total_amount, 0);
    const upiSales         = (sales || []).filter((s: { payment_mode: string }) => s.payment_mode === 'upi').reduce((a: number, s: { total_amount: number }) => a + s.total_amount, 0);
    const totalExp         = (expenses || []).reduce((a: number, e: { amount: number }) => a + e.amount, 0);
    const totalCollections = (payments || []).reduce((a: number, p: { amount: number }) => a + p.amount, 0);

    const purchMap: Record<string, number> = {};
    (products || []).forEach((p: { id: string; purchase_price: number }) => { purchMap[p.id] = p.purchase_price; });
    let revenue = 0, cost = 0;
    (saleItems || []).forEach((i: { total_price: number; quantity: number; product_id: string }) => {
      revenue += i.total_price; cost += i.quantity * (purchMap[i.product_id] || 0);
    });

    const prodMap: Record<string, { qty: number; rev: number }> = {};
    (saleItems || []).forEach((i: { product_name: string; quantity: number; total_price: number }) => {
      if (!prodMap[i.product_name]) prodMap[i.product_name] = { qty: 0, rev: 0 };
      prodMap[i.product_name].qty += i.quantity;
      prodMap[i.product_name].rev += i.total_price;
    });
    const topProducts = Object.entries(prodMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.rev - a.rev).slice(0, 5);

    const expMap: Record<string, number> = {};
    (expenses || []).forEach((e: { category: string; amount: number }) => { expMap[e.category] = (expMap[e.category] || 0) + e.amount; });
    const expenseBreakdown = Object.entries(expMap).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);

    setData({ totalSales, cashSales, creditSales, upiSales, totalExp, totalCollections, grossProfit: revenue - cost, topProducts, topCustomers: (topCusts || []).filter((c: { outstanding_amount: number }) => c.outstanding_amount > 0), expenseBreakdown, txCount: (sales || []).length, sales: (sales || []) as { sale_date: string; customer_name: string; total_amount: number; payment_mode: string }[] });
    setLoading(false);
  }

  useEffect(() => { loadReport(); }, [month, year]);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ['Date', 'Customer', 'Amount', 'Mode'],
      ...(data.sales || []).map((s: { sale_date: string; customer_name: string; total_amount: number; payment_mode: string }) => [s.sale_date, s.customer_name || '-', s.total_amount, s.payment_mode || '-'])
    ];
    const csv = rows.map(r => r.map(String).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `kirana-report-${year}-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2">
          <Calendar size={16} className="text-orange-600" />
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="text-sm border-none outline-none bg-transparent">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-16 text-sm border-none outline-none bg-transparent text-center" />
        </div>
        <button onClick={loadReport} disabled={loading} className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-700 disabled:opacity-60">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}{loading ? 'Loading…' : 'Load'}
        </button>
        {data && (
          <button onClick={handleExportCSV} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-orange-600" size={32} /></div>}

      {data && !loading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Sales', value: inr(data.totalSales), sub: `${data.txCount} bills`, color: 'bg-green-50 border-green-200 text-green-700', icon: <TrendingUp size={18} /> },
              { label: 'Cash + UPI', value: inr(data.cashSales + data.upiSales), sub: `Credit: ${inr(data.creditSales)}`, color: 'bg-blue-50 border-blue-200 text-blue-700', icon: <DollarSign size={18} /> },
              { label: 'Collections', value: inr(data.totalCollections), sub: 'Credit recovered', color: 'bg-purple-50 border-purple-200 text-purple-700', icon: <CreditCard size={18} /> },
              { label: 'Expenses', value: inr(data.totalExp), sub: `Gross profit: ${inr(data.grossProfit)}`, color: 'bg-red-50 border-red-200 text-red-700', icon: <TrendingDown size={18} /> },
            ].map(k => (
              <div key={k.label} className={`rounded-xl border p-3 ${k.color}`}>
                <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium opacity-80">{k.label}</span>{k.icon}</div>
                <p className="text-lg font-bold">{k.value}</p>
                <p className="text-xs opacity-70 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><TrendingUp size={15} className="text-green-600" /> Top Products</h3>
              {data.topProducts.length === 0 ? <p className="text-gray-400 text-sm">No sales this period.</p> : (
                <div className="space-y-2">
                  {data.topProducts.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm"><span className="font-medium text-gray-800 truncate">{p.name}</span><span className="text-green-600 font-semibold">{inr(p.rev)}</span></div>
                        <div className="h-1.5 bg-gray-100 rounded-full mt-1"><div className="h-1.5 bg-green-500 rounded-full" style={{ width: `${Math.min(100, (p.rev / (data.topProducts[0]?.rev || 1)) * 100)}%` }} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Users size={15} className="text-orange-600" /> Top Customers (Outstanding)</h3>
              {data.topCustomers.length === 0 ? <p className="text-gray-400 text-sm">No outstanding balances.</p> : (
                <div className="space-y-2">
                  {data.topCustomers.map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-2"><span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span><span className="text-sm font-medium text-gray-800">{c.name}</span></div>
                      <span className="font-semibold text-orange-600 text-sm">{inr(c.outstanding_amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {data.expenseBreakdown.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 lg:col-span-2">
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Receipt size={15} className="text-red-500" /> Expense Breakdown</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {data.expenseBreakdown.map(e => (
                    <div key={e.category} className="bg-red-50 rounded-lg p-3">
                      <p className="text-xs text-red-600 font-medium truncate">{e.category}</p>
                      <p className="text-base font-bold text-red-700">{inr(e.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
