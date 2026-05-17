// ═══════════════════════════════════════════════════════════════════════════
// FuelDesk AI — Textile / Clothing Module
// Purple theme — tx_ Supabase tables
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Truck, Receipt,
  Plus, Edit2, Trash2, X, Search, AlertTriangle, CheckCircle2,
  Loader2, TrendingUp, TrendingDown, Wallet,
  Settings as SettingsIcon, LogOut,
} from 'lucide-react';
import { SettingsTab } from './SettingsTab';
import { supabase } from './supabase';
import { getTodayIST, formatISTDate } from './utils';

function inr(n: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);
}

const CATEGORIES = ['Sarees', 'Dress Material', 'Kurta Sets', 'Shirts', 'Pants & Trousers', 'Shawls & Dupattas', 'Innerwear', 'Kids Wear', 'Accessories', 'Other'];
const UNITS = ['metre', 'piece', 'set', 'dozen', 'roll'];
const PAYMENT_MODES = ['cash', 'upi', 'card', 'bank_transfer', 'credit'];
const EXPENSE_CATEGORIES = ['Rent', 'Electricity', 'Staff Salary', 'Transport', 'Repairs', 'Marketing', 'Other'];

interface Product {
  id: string; bunk_id: string; name: string; brand: string; category: string;
  unit: string; selling_price: number; purchase_price: number; mrp: number;
  current_stock: number; reorder_level: number; fabric_type: string; is_active: boolean; created_at: string;
}
interface Customer {
  id: string; bunk_id: string; name: string; phone: string; address: string;
  credit_limit: number; outstanding_amount: number; is_active: boolean; created_at: string;
}
interface Sale {
  id: string; bunk_id: string; customer_id: string | null; customer_name: string;
  sale_date: string; total_amount: number; payment_mode: string; payment_status: string;
  notes: string; created_at: string;
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

type Tab = 'dashboard' | 'inventory' | 'sales' | 'customers' | 'purchases' | 'expenses' | 'settings';

export function TextileApp({ bunkId, onLogout, user }: { bunkId: string; onLogout: () => void; user: { name: string; email: string; role: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
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
    const [p, c, sa, pu, ex] = await Promise.all([
      supabase.from('tx_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('tx_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('tx_sales').select('*').eq('bunk_id', bunkId).order('sale_date', { ascending: false }).limit(200),
      supabase.from('tx_purchases').select('*').eq('bunk_id', bunkId).order('purchase_date', { ascending: false }).limit(100),
      supabase.from('tx_expenses').select('*').eq('bunk_id', bunkId).order('expense_date', { ascending: false }).limit(200),
    ]);
    if (p.data) setProducts(p.data as Product[]);
    if (c.data) setCustomers(c.data as Customer[]);
    if (sa.data) setSales(sa.data as Sale[]);
    if (pu.data) setPurchases(pu.data as Purchase[]);
    if (ex.data) setExpenses(ex.data as Expense[]);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const today = getTodayIST();
  const todaySalesTotal = sales.filter(s => s.sale_date === today).reduce((a, s) => a + s.total_amount, 0);
  const todayExpenses = expenses.filter(e => e.expense_date === today).reduce((a, e) => a + e.amount, 0);
  const lowStock = products.filter(p => p.current_stock <= p.reorder_level);
  const totalCreditOutstanding = customers.reduce((a, c) => a + (c.outstanding_amount || 0), 0);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'inventory', label: 'Inventory', icon: <Package size={16} /> },
    { id: 'sales', label: 'Sales / POS', icon: <ShoppingCart size={16} /> },
    { id: 'customers', label: 'Customers', icon: <Users size={16} /> },
    { id: 'purchases', label: 'Purchases', icon: <Truck size={16} /> },
    { id: 'expenses', label: 'Expenses', icon: <Receipt size={16} /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-purple-700 text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <span className="text-2xl">👗</span>
        <div>
          <h1 className="font-bold text-lg leading-tight">Textile / Clothing</h1>
          <p className="text-purple-200 text-xs">FuelDesk AI</p>
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
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-purple-700 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="p-4 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-purple-700" size={32} /></div>
        ) : (
          <>
            {activeTab === 'dashboard' && <TxDashboard todaySalesTotal={todaySalesTotal} todayExpenses={todayExpenses} lowStock={lowStock} totalProducts={products.length} recentSales={sales.slice(0, 8)} totalCreditOutstanding={totalCreditOutstanding} />}
            {activeTab === 'inventory' && <TxInventory bunkId={bunkId} products={products} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'sales' && <TxSales bunkId={bunkId} products={products} customers={customers} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'customers' && <TxCustomers bunkId={bunkId} customers={customers} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'purchases' && <TxPurchases bunkId={bunkId} purchases={purchases} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'expenses' && <TxExpenses bunkId={bunkId} expenses={expenses} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'settings' && <SettingsTab bunkId={bunkId} user={user} onLogout={onLogout} />}
          </>
        )}
      </main>
    </div>
  );
}

function TxDashboard({ todaySalesTotal, todayExpenses, lowStock, totalProducts, recentSales, totalCreditOutstanding }: {
  todaySalesTotal: number; todayExpenses: number; lowStock: Product[]; totalProducts: number; recentSales: Sale[]; totalCreditOutstanding: number;
}) {
  const kpis = [
    { label: "Today's Sales", value: inr(todaySalesTotal), icon: <TrendingUp size={20} />, color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { label: "Today's Expenses", value: inr(todayExpenses), icon: <TrendingDown size={20} />, color: 'bg-red-50 text-red-700 border-red-200' },
    { label: 'Low Stock Items', value: String(lowStock.length), icon: <AlertTriangle size={20} />, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { label: 'Total Products', value: String(totalProducts), icon: <Package size={20} />, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'Credit Outstanding', value: inr(totalCreditOutstanding), icon: <Wallet size={20} />, color: 'bg-orange-50 text-orange-700 border-orange-200' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.color}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium opacity-80">{k.label}</span>{k.icon}
            </div>
            <p className="text-xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-yellow-500" /> Low Stock Alert</h2>
          {lowStock.length === 0 ? <p className="text-gray-400 text-sm">All items well-stocked.</p> : (
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
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><ShoppingCart size={16} className="text-purple-600" /> Recent Sales</h2>
          {recentSales.length === 0 ? <p className="text-gray-400 text-sm">No sales yet.</p> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
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
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><CheckCircle2 size={16} className="text-green-600" /> Today's Checklist</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { done: todaySalesTotal > 0, text: "Record today's sales" },
            { done: lowStock.length === 0, text: `Reorder low stock${lowStock.length > 0 ? ` (${lowStock.length} items)` : ''}` },
            { done: totalCreditOutstanding === 0, text: `Collect credit payments${totalCreditOutstanding > 0 ? ` (${inr(totalCreditOutstanding)} due)` : ''}` },
            { done: todayExpenses > 0, text: "Add today's expenses" },
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

interface ProdForm {
  name: string; brand: string; category: string; unit: string; fabric_type: string;
  mrp: number; selling_price: number; purchase_price: number;
  current_stock: number; reorder_level: number;
}
const defaultPF = (): ProdForm => ({ name: '', brand: '', category: CATEGORIES[0], unit: UNITS[0], fabric_type: '', mrp: 0, selling_price: 0, purchase_price: 0, current_stock: 0, reorder_level: 5 });

function TxInventory({ bunkId, products, onRefresh, showToast }: { bunkId: string; products: Product[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProdForm>(defaultPF());
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ msg: string; onYes: () => void } | null>(null);

  const filtered = products.filter(p => {
    const s = p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand || '').toLowerCase().includes(search.toLowerCase());
    return s && (catFilter === 'All' || p.category === catFilter);
  });

  function openAdd() { setEditing(null); setForm(defaultPF()); setShowModal(true); }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, brand: p.brand, category: p.category, unit: p.unit, fabric_type: p.fabric_type || '', mrp: p.mrp, selling_price: p.selling_price, purchase_price: p.purchase_price, current_stock: p.current_stock, reorder_level: p.reorder_level });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Item name required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId, is_active: true };
    const { error } = editing ? await supabase.from('tx_products').update(payload).eq('id', editing.id).eq('bunk_id', bunkId) : await supabase.from('tx_products').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editing ? 'Item updated' : 'Item added');
    setShowModal(false); onRefresh();
  }

  function handleDelete(p: Product) {
    setConfirmModal({
      msg: `Delete "${p.name}"?`,
      onYes: async () => {
        const { error } = await supabase.from('tx_products').update({ is_active: false }).eq('id', p.id).eq('bunk_id', bunkId);
        if (error) { showToast(error.message, 'error'); return; }
        showToast('Item removed'); onRefresh();
      },
    });
  }

  const setF = (k: keyof ProdForm, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400">
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-800 transition-colors">
          <Plus size={16} /> Add Item
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Fabric</th>
                <th className="px-4 py-3 text-right">Selling</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-400">No items found.</td></tr>}
              {filtered.map(p => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-400">{p.brand} · {p.unit}</p></td>
                  <td className="px-4 py-3 text-gray-600">{p.category}</td>
                  <td className="px-4 py-3 text-gray-600">{p.fabric_type || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">{inr(p.selling_price)}</td>
                  <td className="px-4 py-3 text-right"><span className={`font-semibold ${p.current_stock <= p.reorder_level ? 'text-red-600' : 'text-gray-800'}`}>{p.current_stock}</span></td>
                  <td className="px-4 py-3 text-center">{p.current_stock <= p.reorder_level ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Low Stock</span> : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">OK</span>}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(p)} className="text-purple-600 hover:text-purple-800"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(p)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
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
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">{editing ? 'Edit Item' : 'Add Item'}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Item Name *</label><input value={form.name} onChange={e => setF('name', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Brand / Design</label><input value={form.brand} onChange={e => setF('brand', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Category</label><select value={form.category} onChange={e => setF('category', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Unit</label><select value={form.unit} onChange={e => setF('unit', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">{UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Fabric Type</label><input value={form.fabric_type} onChange={e => setF('fabric_type', e.target.value)} placeholder="e.g., Cotton, Silk, Polyester" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">MRP (₹)</label><input type="number" value={form.mrp} onChange={e => setF('mrp', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Selling Price (₹)</label><input type="number" value={form.selling_price} onChange={e => setF('selling_price', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Purchase Price (₹)</label><input type="number" value={form.purchase_price} onChange={e => setF('purchase_price', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Current Stock</label><input type="number" value={form.current_stock} onChange={e => setF('current_stock', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Reorder Level</label><input type="number" value={form.reorder_level} onChange={e => setF('reorder_level', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-purple-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-800 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Saving…' : 'Save'}
              </button>
            </div>
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

function TxSales({ bunkId, products, customers, onRefresh, showToast }: { bunkId: string; products: Product[]; customers: Customer[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('Walk-in');
  const [customerId, setCustomerId] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [saleDate, setSaleDate] = useState(getTodayIST());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

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

  const total = cart.reduce((a, i) => a + i.price * i.quantity, 0);

  async function handleSell() {
    if (cart.length === 0) { showToast('Cart is empty', 'error'); return; }
    setSaving(true);
    const name = customerId ? customers.find(c => c.id === customerId)?.name || customerName : customerName;
    const { data: sale, error: sErr } = await supabase.from('tx_sales').insert({
      bunk_id: bunkId, customer_id: customerId || null, customer_name: name,
      sale_date: saleDate, total_amount: total, payment_mode: paymentMode,
      payment_status: paymentMode === 'credit' ? 'credit' : 'paid', notes,
    }).select().single();
    if (sErr || !sale) { showToast(sErr?.message || 'Sale failed', 'error'); setSaving(false); return; }
    await supabase.from('tx_sale_items').insert(cart.map(i => ({
      sale_id: sale.id, bunk_id: bunkId, product_id: i.product.id,
      product_name: i.product.name, quantity: i.quantity, unit_price: i.price,
      total_price: i.price * i.quantity,
    })));
    for (const i of cart) {
      await supabase.from('tx_products').update({ current_stock: i.product.current_stock - i.quantity }).eq('id', i.product.id);
    }
    if (paymentMode === 'credit' && customerId) {
      const { data: freshCust } = await supabase.from('tx_customers').select('outstanding_amount').eq('id', customerId).eq('bunk_id', bunkId).maybeSingle();
      const base = freshCust ? Number(freshCust.outstanding_amount) : (Number(customers.find(c => c.id === customerId)?.outstanding_amount) || 0);
      await supabase.from('tx_customers').update({ outstanding_amount: base + total }).eq('id', customerId).eq('bunk_id', bunkId);
    }
    showToast('Sale recorded!');
    setCart([]); setCustomerName('Walk-in'); setCustomerId(''); setNotes(''); setSaleDate(getTodayIST());
    setSaving(false); onRefresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items to add…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase sticky top-0">
                <tr><th className="px-4 py-2 text-left">Item</th><th className="px-4 py-2 text-right">Price</th><th className="px-4 py-2 text-right">Stock</th><th className="px-4 py-2"></th></tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-purple-50">
                    <td className="px-4 py-2"><p className="font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-400">{p.category}{p.fabric_type ? ` · ${p.fabric_type}` : ''}</p></td>
                    <td className="px-4 py-2 text-right">{inr(p.selling_price)}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{p.current_stock} {p.unit}</td>
                    <td className="px-4 py-2 text-right"><button onClick={() => addToCart(p)} disabled={p.current_stock <= 0} className="bg-purple-700 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-purple-800 disabled:opacity-40"><Plus size={12} className="inline" /> Add</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4 h-fit">
        <h2 className="font-semibold text-gray-800">Cart</h2>
        {cart.length === 0 ? <p className="text-gray-400 text-sm">No items added.</p> : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {cart.map(i => (
              <div key={i.product.id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{i.product.name}</p><p className="text-xs text-gray-400">{inr(i.price)} / {i.product.unit}</p></div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(i.product.id, i.quantity - 1)} className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100">-</button>
                  <span className="w-8 text-center text-sm font-medium">{i.quantity}</span>
                  <button onClick={() => updateQty(i.product.id, i.quantity + 1)} className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100">+</button>
                </div>
                <span className="text-sm font-semibold text-gray-800">{inr(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t pt-3">
          <div className="flex justify-between text-base font-bold mb-3"><span>Total</span><span>{inr(total)}</span></div>
          <div className="space-y-2">
            <div><label className="text-xs text-gray-500 mb-1 block">Customer</label>
              <select value={customerId} onChange={e => { setCustomerId(e.target.value); if (!e.target.value) setCustomerName('Walk-in'); }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Walk-in Customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label>
              <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
          </div>
          <button onClick={handleSell} disabled={saving || cart.length === 0} className="mt-3 w-full bg-purple-700 text-white py-2.5 rounded-lg font-medium hover:bg-purple-800 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Processing…' : 'Complete Sale'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CustForm { name: string; phone: string; address: string; credit_limit: number; }
const defaultCF = (): CustForm => ({ name: '', phone: '', address: '', credit_limit: 0 });

function TxCustomers({ bunkId, customers, onRefresh, showToast }: { bunkId: string; customers: Customer[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustForm>(defaultCF());
  const [saving, setSaving] = useState(false);
  const [payModal, setPayModal] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [payingSaving, setPayingSaving] = useState(false);

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  function openAdd() { setEditing(null); setForm(defaultCF()); setShowModal(true); }
  function openEdit(c: Customer) { setEditing(c); setForm({ name: c.name, phone: c.phone, address: c.address, credit_limit: c.credit_limit || 0 }); setShowModal(true); }
  function openPay(c: Customer) { setPayModal(c); setPayAmount(''); setPayMode('cash'); }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Customer name required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId, is_active: true };
    const { error } = editing ? await supabase.from('tx_customers').update(payload).eq('id', editing.id) : await supabase.from('tx_customers').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editing ? 'Customer updated' : 'Customer added');
    setShowModal(false); onRefresh();
  }

  async function handleCollectPayment() {
    if (!payModal) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    setPayingSaving(true);
    await supabase.from('tx_payments').insert({
      bunk_id: bunkId, customer_id: payModal.id, customer_name: payModal.name,
      amount: amt, payment_mode: payMode, payment_date: getTodayIST(),
    });
    const { data: freshC } = await supabase.from('tx_customers').select('outstanding_amount').eq('id', payModal.id).eq('bunk_id', bunkId).maybeSingle();
    const base = freshC ? Number(freshC.outstanding_amount) : Number(payModal.outstanding_amount);
    const { error } = await supabase.from('tx_customers').update({ outstanding_amount: Math.max(0, base - amt) }).eq('id', payModal.id).eq('bunk_id', bunkId);
    setPayingSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(`Payment of ${inr(amt)} collected from ${payModal.name}`);
    setPayModal(null); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-800">
          <Plus size={16} /> Add Customer
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-right">Credit Limit</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-center">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">No customers found.</td></tr>}
              {filtered.map(c => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium text-gray-800">{c.name}</p><p className="text-xs text-gray-400">{c.address || ''}</p></td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{inr(c.credit_limit || 0)}</td>
                  <td className="px-4 py-3 text-right"><span className={`font-semibold ${c.outstanding_amount > 0 ? 'text-orange-600' : 'text-gray-500'}`}>{inr(c.outstanding_amount)}</span></td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {c.outstanding_amount > 0 && (
                        <button onClick={() => openPay(c)} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium hover:bg-orange-200">Collect</button>
                      )}
                      <button onClick={() => openEdit(c)} className="text-purple-600 hover:text-purple-800"><Edit2 size={14} /></button>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">{editing ? 'Edit Customer' : 'Add Customer'}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="p-5 space-y-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Address</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Credit Limit (₹)</label><input type="number" value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-purple-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-800 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
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
              <div><label className="text-xs text-gray-500 mb-1 block">Amount Received (₹) *</label><input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label><select value={payMode} onChange={e => setPayMode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{['cash', 'upi', 'bank_transfer', 'card'].map(m => <option key={m}>{m}</option>)}</select></div>
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

interface PurchForm { supplier_name: string; invoice_number: string; purchase_date: string; total_amount: number; notes: string; }
const defaultPurchF = (): PurchForm => ({ supplier_name: '', invoice_number: '', purchase_date: getTodayIST(), total_amount: 0, notes: '' });

function TxPurchases({ bunkId, purchases, onRefresh, showToast }: { bunkId: string; purchases: Purchase[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<PurchForm>(defaultPurchF());
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.supplier_name.trim() || form.total_amount <= 0) { showToast('Supplier name and amount required', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('tx_purchases').insert({ ...form, bunk_id: bunkId });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Purchase added'); setShowModal(false); setForm(defaultPurchF()); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-800"><Plus size={16} /> Add Purchase</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Supplier</th><th className="px-4 py-3 text-left">Invoice</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Notes</th></tr>
            </thead>
            <tbody>
              {purchases.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">No purchases yet.</td></tr>}
              {purchases.map(p => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{formatISTDate(p.purchase_date)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.supplier_name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.invoice_number || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{inr(p.total_amount)}</td>
                  <td className="px-4 py-3 text-gray-500">{p.notes || '—'}</td>
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
              <div><label className="text-xs text-gray-500 mb-1 block">Supplier Name *</label><input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Invoice Number</label><input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Total Amount (₹) *</label><input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-purple-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-800 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ExpForm { category: string; description: string; amount: number; expense_date: string; payment_mode: string; notes: string; }
const defaultEF = (): ExpForm => ({ category: EXPENSE_CATEGORIES[0], description: '', amount: 0, expense_date: getTodayIST(), payment_mode: 'cash', notes: '' });

function TxExpenses({ bunkId, expenses, onRefresh, showToast }: { bunkId: string; expenses: Expense[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ExpForm>(defaultEF());
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.description.trim() || form.amount <= 0) { showToast('Description and amount required', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('tx_expenses').insert({ ...form, bunk_id: bunkId });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Expense added'); setShowModal(false); setForm(defaultEF()); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-800"><Plus size={16} /> Add Expense</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-left">Payment</th><th className="px-4 py-3 text-right">Amount</th></tr>
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
              <div><label className="text-xs text-gray-500 mb-1 block">Description *</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label><input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label><select value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-purple-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-800 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
