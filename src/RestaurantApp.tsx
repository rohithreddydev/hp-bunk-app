// ═══════════════════════════════════════════════════════════════════════════
// FuelDesk AI — Restaurant Module
// Red/orange theme — rst_ Supabase tables
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Truck, Receipt,
  Plus, Edit2, X, Search, AlertTriangle, CheckCircle2, Loader2,
  TrendingUp, TrendingDown, Wallet, FileText, BookOpen,
  ArrowUpRight, ArrowDownLeft, RefreshCw, BarChart2,
  Settings as SettingsIcon, LogOut,
} from 'lucide-react';
import { SettingsTab } from './SettingsTab';
import { supabase } from './supabase';
import { getTodayIST, formatISTDate } from './utils';

function inr(n: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);
}

const CATEGORIES = ['Food', 'Beverages', 'Snacks', 'Starters', 'Main Course', 'Desserts', 'Other'];
const ORDER_TYPES = ['Dine In', 'Takeaway', 'Delivery'];
const PAYMENT_MODES = ['cash', 'upi', 'card', 'credit'];
const EXPENSE_CATEGORIES = ['Ingredients', 'Rent', 'Electricity', 'Staff Salary', 'Gas/Fuel', 'Repairs', 'Other'];

interface MenuItem {
  id: string; bunk_id: string; name: string; category: string;
  price: number; description: string; is_available: boolean; created_at: string;
}
interface Customer {
  id: string; bunk_id: string; name: string; phone: string;
  credit_limit: number; outstanding_amount: number; is_active: boolean; created_at: string;
}
interface RstOrder {
  id: string; bunk_id: string; customer_id: string | null; customer_name: string;
  order_type: string; table_number: string; sale_date: string;
  total_amount: number; payment_mode: string; payment_status: string;
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
interface CartItem { item: MenuItem; quantity: number; }

interface RstLedgerEntry {
  date: string;
  type: 'order' | 'payment';
  amount: number;
  label: string;
  mode?: string;
  running_balance?: number;
}

type Tab = 'dashboard' | 'menu' | 'orders' | 'customers' | 'purchases' | 'expenses' | 'reports' | 'settings';

// ─── Main Component ────────────────────────────────────────────────────────────
export function RestaurantApp({ bunkId, onLogout, user }: { bunkId: string; onLogout: () => void; user: { name: string; email: string; role: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<RstOrder[]>([]);
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
    const [m, c, o, pu, ex] = await Promise.all([
      supabase.from('rst_menu_items').select('*').eq('bunk_id', bunkId).order('name'),
      supabase.from('rst_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('rst_orders').select('*').eq('bunk_id', bunkId).order('sale_date', { ascending: false }).limit(200),
      supabase.from('rst_purchases').select('*').eq('bunk_id', bunkId).order('purchase_date', { ascending: false }).limit(100),
      supabase.from('rst_expenses').select('*').eq('bunk_id', bunkId).order('expense_date', { ascending: false }).limit(200),
    ]);
    if (m.data) setMenuItems(m.data as MenuItem[]);
    if (c.data) setCustomers(c.data as Customer[]);
    if (o.data) setOrders(o.data as RstOrder[]);
    if (pu.data) setPurchases(pu.data as Purchase[]);
    if (ex.data) setExpenses(ex.data as Expense[]);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const today = getTodayIST();
  const todayOrders = orders.filter(o => o.sale_date === today);
  const todayRevenue = todayOrders.reduce((a, o) => a + o.total_amount, 0);
  const todayExpTotal = expenses.filter(e => e.expense_date === today).reduce((a, e) => a + e.amount, 0);
  const dineInCount = todayOrders.filter(o => o.order_type === 'Dine In').length;
  const takeawayCount = todayOrders.filter(o => o.order_type === 'Takeaway').length;
  const deliveryCount = todayOrders.filter(o => o.order_type === 'Delivery').length;
  const totalCreditOutstanding = customers.reduce((a, c) => a + (Number(c.outstanding_amount) || 0), 0);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'menu', label: 'Menu', icon: <Package size={16} /> },
    { id: 'orders', label: 'Orders / POS', icon: <ShoppingCart size={16} /> },
    { id: 'customers', label: 'Customers', icon: <Users size={16} /> },
    { id: 'purchases', label: 'Purchases', icon: <Truck size={16} /> },
    { id: 'expenses', label: 'Expenses', icon: <Receipt size={16} /> },
    { id: 'reports', label: 'Reports', icon: <BarChart2 size={16} /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-red-600 text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <span className="text-2xl">🍽️</span>
        <div>
          <h1 className="font-bold text-lg leading-tight">Restaurant</h1>
          <p className="text-red-200 text-xs">FuelDesk AI</p>
        </div>
        <button onClick={onLogout} className="ml-auto p-2 rounded-lg hover:bg-white/20 transition" title="Sign Out">
          <LogOut size={20} />
        </button>
      </header>

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      <nav className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex min-w-max">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="p-4 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-red-600" size={32} /></div>
        ) : (
          <>
            {activeTab === 'dashboard' && <RstDashboard todayRevenue={todayRevenue} todayOrdersCount={todayOrders.length} todayExpTotal={todayExpTotal} dineInCount={dineInCount} takeawayCount={takeawayCount} deliveryCount={deliveryCount} recentOrders={orders.slice(0, 8)} totalCreditOutstanding={totalCreditOutstanding} />}
            {activeTab === 'menu' && <RstMenu bunkId={bunkId} menuItems={menuItems} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'orders' && <RstOrders bunkId={bunkId} menuItems={menuItems} customers={customers} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'customers' && <RstCustomers bunkId={bunkId} customers={customers} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'purchases' && <RstPurchases bunkId={bunkId} purchases={purchases} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'expenses' && <RstExpenses bunkId={bunkId} expenses={expenses} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'reports' && <RstReports bunkId={bunkId} />}
            {activeTab === 'settings' && <SettingsTab bunkId={bunkId} user={user} onLogout={onLogout} />}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function RstDashboard({ todayRevenue, todayOrdersCount, todayExpTotal, dineInCount, takeawayCount, deliveryCount, recentOrders, totalCreditOutstanding }: {
  todayRevenue: number; todayOrdersCount: number; todayExpTotal: number;
  dineInCount: number; takeawayCount: number; deliveryCount: number; recentOrders: RstOrder[]; totalCreditOutstanding: number;
}) {
  const kpis = [
    { label: "Today's Revenue", value: inr(todayRevenue), icon: <TrendingUp size={20} />, color: 'bg-green-50 text-green-700 border-green-200' },
    { label: "Today's Orders", value: String(todayOrdersCount), icon: <ShoppingCart size={20} />, color: 'bg-orange-50 text-orange-700 border-orange-200' },
    { label: "Today's Expenses", value: inr(todayExpTotal), icon: <TrendingDown size={20} />, color: 'bg-red-50 text-red-700 border-red-200' },
    { label: 'Avg Order Value', value: inr(todayOrdersCount > 0 ? todayRevenue / todayOrdersCount : 0), icon: <Receipt size={20} />, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'Credit Outstanding', value: inr(totalCreditOutstanding), icon: <Wallet size={20} />, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.color}`}>
            <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium opacity-80">{k.label}</span>{k.icon}</div>
            <p className="text-xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-4">Today's Order Breakdown</h2>
          <div className="space-y-3">
            {[{ label: 'Dine In', count: dineInCount, color: 'bg-green-500' }, { label: 'Takeaway', count: takeawayCount, color: 'bg-orange-500' }, { label: 'Delivery', count: deliveryCount, color: 'bg-blue-500' }].map(row => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-20">{row.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3">
                  <div className={`${row.color} rounded-full h-3 transition-all`} style={{ width: `${todayOrdersCount > 0 ? (row.count / todayOrdersCount) * 100 : 0}%` }} />
                </div>
                <span className="text-sm font-semibold text-gray-800 w-6 text-right">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><ShoppingCart size={16} className="text-red-600" /> Recent Orders</h2>
          {recentOrders.length === 0 ? <p className="text-gray-400 text-sm">No orders yet.</p> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div><p className="text-sm font-medium text-gray-800">{o.customer_name || 'Guest'} <span className="text-xs text-gray-400">· {o.order_type}</span></p><p className="text-xs text-gray-400">{formatISTDate(o.sale_date)} · {o.payment_mode}</p></div>
                  <span className={`text-sm font-semibold ${o.payment_status === 'credit' ? 'text-orange-600' : 'text-green-600'}`}>{inr(o.total_amount)}</span>
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
            { done: todayOrdersCount > 0, text: "Record today's orders" },
            { done: todayExpTotal > 0, text: "Add today's expenses" },
            { done: totalCreditOutstanding === 0, text: `Collect credit payments${totalCreditOutstanding > 0 ? ` (${inr(totalCreditOutstanding)} due)` : ''}` },
            { done: (dineInCount + takeawayCount + deliveryCount) > 0, text: 'Check all order types covered' },
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

// ─── Menu Tab ──────────────────────────────────────────────────────────────────
interface MenuForm { name: string; category: string; price: number; description: string; is_available: boolean; }
const defaultMF = (): MenuForm => ({ name: '', category: CATEGORIES[0], price: 0, description: '', is_available: true });

function RstMenu({ bunkId, menuItems, onRefresh, showToast }: { bunkId: string; menuItems: MenuItem[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<MenuForm>(defaultMF());
  const [saving, setSaving] = useState(false);

  const filtered = menuItems.filter(i => {
    const s = i.name.toLowerCase().includes(search.toLowerCase());
    return s && (catFilter === 'All' || i.category === catFilter);
  });

  function openAdd() { setEditing(null); setForm(defaultMF()); setShowModal(true); }
  function openEdit(i: MenuItem) { setEditing(i); setForm({ name: i.name, category: i.category, price: i.price, description: i.description, is_available: i.is_available }); setShowModal(true); }

  async function toggleAvailability(item: MenuItem) {
    const { error } = await supabase.from('rst_menu_items').update({ is_available: !item.is_available }).eq('id', item.id).eq('bunk_id', bunkId);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(item.is_available ? 'Marked unavailable' : 'Marked available'); onRefresh();
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Item name required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId };
    const { error } = editing ? await supabase.from('rst_menu_items').update(payload).eq('id', editing.id).eq('bunk_id', bunkId) : await supabase.from('rst_menu_items').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editing ? 'Item updated' : 'Item added'); setShowModal(false); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2">
            <option value="All">All</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"><Plus size={16} /> Add Item</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && <p className="text-gray-400 text-sm col-span-3 text-center py-8">No menu items found.</p>}
        {filtered.map(item => (
          <div key={item.id} className={`bg-white rounded-xl border p-4 ${!item.is_available ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">{item.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{item.category}</p>
                {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
              </div>
              <span className="font-bold text-gray-800">{inr(item.price)}</span>
            </div>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <button onClick={() => toggleAvailability(item)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${item.is_available ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {item.is_available ? 'Available' : 'Unavailable'}
              </button>
              <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"><Edit2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">{editing ? 'Edit Item' : 'Add Menu Item'}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="p-5 space-y-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Item Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Category</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Price (₹) *</label><input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Description</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div className="flex items-center gap-3"><input type="checkbox" id="avail" checked={form.is_available} onChange={e => setForm(f => ({ ...f, is_available: e.target.checked }))} className="w-4 h-4 accent-red-600" /><label htmlFor="avail" className="text-sm text-gray-700">Available now</label></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Orders / POS ──────────────────────────────────────────────────────────────
function RstOrders({ bunkId, menuItems, customers, onRefresh, showToast }: { bunkId: string; menuItems: MenuItem[]; customers: Customer[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState('Dine In');
  const [tableNumber, setTableNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [saleDate, setSaleDate] = useState(getTodayIST());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');

  const available = menuItems.filter(i => i.is_available && i.name.toLowerCase().includes(search.toLowerCase()) && (catFilter === 'All' || i.category === catFilter));

  function addToCart(item: MenuItem) {
    setCart(c => {
      const ex = c.find(ci => ci.item.id === item.id);
      if (ex) return c.map(ci => ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      return [...c, { item, quantity: 1 }];
    });
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) { setCart(c => c.filter(ci => ci.item.id !== id)); return; }
    setCart(c => c.map(ci => ci.item.id === id ? { ...ci, quantity: qty } : ci));
  }

  const total = cart.reduce((a, ci) => a + ci.item.price * ci.quantity, 0);

  async function handleOrder() {
    if (cart.length === 0) { showToast('No items in order', 'error'); return; }
    setSaving(true);
    const cust = customerId ? customers.find(c => c.id === customerId) : null;
    const customerName = cust?.name || 'Guest';
    const { data: order, error } = await supabase.from('rst_orders').insert({
      bunk_id: bunkId, customer_id: customerId || null, customer_name: customerName,
      order_type: orderType, table_number: tableNumber, sale_date: saleDate,
      total_amount: total, payment_mode: paymentMode,
      payment_status: paymentMode === 'credit' ? 'credit' : 'paid', notes,
    }).select().single();
    if (error || !order) { showToast(error?.message || 'Order failed', 'error'); setSaving(false); return; }
    await supabase.from('rst_order_items').insert(cart.map(ci => ({
      order_id: order.id, bunk_id: bunkId, item_id: ci.item.id,
      item_name: ci.item.name, quantity: ci.quantity, unit_price: ci.item.price, total_price: ci.item.price * ci.quantity,
    })));
    if (paymentMode === 'credit' && cust) {
      const { data: freshCust } = await supabase.from('rst_customers').select('outstanding_amount').eq('id', cust.id).eq('bunk_id', bunkId).maybeSingle();
      const base = freshCust ? Number(freshCust.outstanding_amount) : Number(cust.outstanding_amount || 0);
      await supabase.from('rst_customers').update({ outstanding_amount: base + total }).eq('id', cust.id).eq('bunk_id', bunkId);
    }
    showToast('Order placed!');
    setCart([]); setTableNumber(''); setNotes(''); setSaleDate(getTodayIST());
    setSaving(false); onRefresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2">
            <option value="All">All</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {available.map(item => (
            <button key={item.id} onClick={() => addToCart(item)} className="bg-white rounded-xl border border-gray-200 p-3 text-left hover:border-red-300 hover:bg-red-50 transition-colors">
              <p className="font-medium text-gray-800 text-sm">{item.name}</p>
              <p className="text-xs text-gray-400">{item.category}</p>
              <p className="text-sm font-bold text-red-600 mt-1">{inr(item.price)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4 h-fit">
        <h2 className="font-semibold text-gray-800">Order</h2>
        {cart.length === 0 ? <p className="text-gray-400 text-sm">No items added.</p> : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {cart.map(ci => (
              <div key={ci.item.id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{ci.item.name}</p><p className="text-xs text-gray-400">{inr(ci.item.price)} each</p></div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(ci.item.id, ci.quantity - 1)} className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100">-</button>
                  <span className="w-6 text-center text-sm font-medium">{ci.quantity}</span>
                  <button onClick={() => updateQty(ci.item.id, ci.quantity + 1)} className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100">+</button>
                </div>
                <span className="text-sm font-semibold">{inr(ci.item.price * ci.quantity)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t pt-3 space-y-2">
          <div className="flex justify-between text-base font-bold mb-2"><span>Total</span><span>{inr(total)}</span></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Order Type</label>
            <select value={orderType} onChange={e => setOrderType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {ORDER_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {orderType === 'Dine In' && <div><label className="text-xs text-gray-500 mb-1 block">Table Number</label><input value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="e.g. T1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>}
          <div><label className="text-xs text-gray-500 mb-1 block">Customer (optional)</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Guest</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label>
            <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special instructions…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
          <button onClick={handleOrder} disabled={saving || cart.length === 0} className="mt-2 w-full bg-red-600 text-white py-2.5 rounded-lg font-medium hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Processing…' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Customers ─────────────────────────────────────────────────────────────────
function RstCustomers({ bunkId, customers, onRefresh, showToast }: { bunkId: string; customers: Customer[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', credit_limit: 0 });
  const [saving, setSaving] = useState(false);
  const [payModal, setPayModal] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [payingSaving, setPayingSaving] = useState(false);
  const [ledgerModal, setLedgerModal] = useState<Customer | null>(null);

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  async function handleSave() {
    if (!form.name.trim()) { showToast('Name required', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('rst_customers').insert({ name: form.name, phone: form.phone, credit_limit: form.credit_limit, bunk_id: bunkId, is_active: true });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Customer added'); setShowModal(false); setForm({ name: '', phone: '', credit_limit: 0 }); onRefresh();
  }

  async function handleCollectPayment() {
    if (!payModal) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    setPayingSaving(true);
    await supabase.from('rst_payments').insert({
      bunk_id: bunkId, customer_id: payModal.id, customer_name: payModal.name,
      amount: amt, payment_mode: payMode, payment_date: getTodayIST(),
    });
    const { data: freshC } = await supabase.from('rst_customers').select('outstanding_amount').eq('id', payModal.id).eq('bunk_id', bunkId).maybeSingle();
    const base = freshC ? Number(freshC.outstanding_amount) : Number(payModal.outstanding_amount);
    const { error } = await supabase.from('rst_customers').update({ outstanding_amount: Math.max(0, base - amt) }).eq('id', payModal.id).eq('bunk_id', bunkId);
    setPayingSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Payment collected'); setPayModal(null); setPayAmount(''); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400" />
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"><Plus size={16} /> Add Customer</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-gray-400">No customers found.</td></tr>}
              {filtered.map(c => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-right"><span className={`font-semibold ${c.outstanding_amount > 0 ? 'text-orange-600' : 'text-gray-500'}`}>{inr(c.outstanding_amount)}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setLedgerModal(c)} className="bg-blue-100 text-blue-700 text-xs px-3 py-1.5 rounded-lg hover:bg-blue-200 font-medium flex items-center gap-1"><BookOpen size={12} /> Ledger</button>
                      {c.outstanding_amount > 0 && <button onClick={() => { setPayModal(c); setPayAmount(''); setPayMode('cash'); }} className="bg-orange-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-orange-600 font-medium">Collect</button>}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">Add Customer</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="p-5 space-y-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Credit Limit (₹)</label><input type="number" min="0" value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: Number(e.target.value) }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">Collect Payment</h2><button onClick={() => setPayModal(null)}><X size={20} /></button></div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600">Customer: <span className="font-semibold">{payModal.name}</span></p>
              <p className="text-sm text-orange-600 font-medium">Outstanding: {inr(payModal.outstanding_amount)}</p>
              <div><label className="text-xs text-gray-500 mb-1 block">Amount Received (₹) *</label><input type="number" min="1" max={payModal.outstanding_amount} value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" placeholder="Enter amount" autoFocus /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label><select value={payMode} onChange={e => setPayMode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{['cash','upi','card','cheque'].map(m => <option key={m}>{m}</option>)}</select></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setPayModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleCollectPayment} disabled={payingSaving} className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-60">{payingSaving ? 'Saving…' : 'Confirm Payment'}</button>
            </div>
          </div>
        </div>
      )}
      {ledgerModal && <RstLedgerModal bunkId={bunkId} customer={ledgerModal} onClose={() => setLedgerModal(null)} />}
    </div>
  );
}

// ─── Purchases ─────────────────────────────────────────────────────────────────
function RstPurchases({ bunkId, purchases, onRefresh, showToast }: { bunkId: string; purchases: Purchase[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ supplier_name: '', invoice_number: '', purchase_date: getTodayIST(), total_amount: 0, notes: '' });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.supplier_name.trim() || form.total_amount <= 0) { showToast('Supplier and amount required', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('rst_purchases').insert({ ...form, bunk_id: bunkId });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Purchase added'); setShowModal(false); setForm({ supplier_name: '', invoice_number: '', purchase_date: getTodayIST(), total_amount: 0, notes: '' }); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"><Plus size={16} /> Add Purchase</button></div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Supplier</th><th className="px-4 py-3 text-left">Invoice</th><th className="px-4 py-3 text-right">Amount</th></tr>
            </thead>
            <tbody>
              {purchases.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-gray-400">No purchases yet.</td></tr>}
              {purchases.map(p => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{formatISTDate(p.purchase_date)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.supplier_name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.invoice_number || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold">{inr(p.total_amount)}</td>
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
              <div><label className="text-xs text-gray-500 mb-1 block">Supplier Name *</label><input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Invoice #</label><input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label><input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Expenses ──────────────────────────────────────────────────────────────────
function RstExpenses({ bunkId, expenses, onRefresh, showToast }: { bunkId: string; expenses: Expense[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ category: EXPENSE_CATEGORIES[0], description: '', amount: 0, expense_date: getTodayIST(), payment_mode: 'cash', notes: '' });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.description.trim() || form.amount <= 0) { showToast('Description and amount required', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('rst_expenses').insert({ ...form, bunk_id: bunkId });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Expense added'); setShowModal(false); setForm({ category: EXPENSE_CATEGORIES[0], description: '', amount: 0, expense_date: getTodayIST(), payment_mode: 'cash', notes: '' }); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"><Plus size={16} /> Add Expense</button></div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-right">Amount</th></tr>
            </thead>
            <tbody>
              {expenses.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-gray-400">No expenses recorded.</td></tr>}
              {expenses.map(e => (
                <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{formatISTDate(e.expense_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{e.category}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{e.description}</td>
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
              <div><label className="text-xs text-gray-500 mb-1 block">Description *</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label><input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label><select value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}</select></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ledger Modal ──────────────────────────────────────────────────────────────
function RstLedgerModal({ bunkId, customer, onClose }: { bunkId: string; customer: Customer; onClose: () => void }) {
  const [entries, setEntries] = useState<RstLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [ordersRes, payRes] = await Promise.all([
        supabase.from('rst_orders').select('sale_date,total_amount,payment_mode,order_type').eq('bunk_id', bunkId).eq('customer_id', customer.id).order('sale_date'),
        supabase.from('rst_payments').select('payment_date,amount,payment_mode').eq('bunk_id', bunkId).eq('customer_id', customer.id).order('payment_date'),
      ]);
      const all: RstLedgerEntry[] = [
        ...(ordersRes.data || []).map(o => ({ date: o.sale_date, type: 'order' as const, amount: Number(o.total_amount), label: o.order_type || 'Order', mode: o.payment_mode })),
        ...(payRes.data || []).map(p => ({ date: p.payment_date, type: 'payment' as const, amount: Number(p.amount), label: 'Payment', mode: p.payment_mode })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      let bal = 0;
      for (const e of all) {
        bal = e.type === 'order' ? bal + e.amount : Math.max(0, bal - e.amount);
        e.running_balance = bal;
      }
      setEntries(all);
      setLoading(false);
    })();
  }, [bunkId, customer.id]);

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2"><BookOpen size={18} className="text-red-600" /> Ledger — {customer.name}</h2>
            {Number(customer.outstanding_amount) > 0 && <p className="text-sm text-orange-600 mt-0.5">Outstanding: {inr(customer.outstanding_amount)}</p>}
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? <div className="text-center py-8 text-gray-400">Loading…</div> : entries.length === 0 ? (
            <p className="text-center py-8 text-gray-400">No transactions yet.</p>
          ) : (
            <div className="space-y-1.5">
              {entries.map((e, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50">
                  <div className={`p-1.5 rounded-full shrink-0 ${e.type === 'order' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                    {e.type === 'order' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700">{e.label}</div>
                    <div className="text-xs text-gray-400">{e.date}{e.mode && ` • ${e.mode}`}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-semibold ${e.type === 'order' ? 'text-orange-600' : 'text-green-600'}`}>
                      {e.type === 'order' ? '+' : '-'}{inr(e.amount)}
                    </div>
                    <div className="text-xs text-gray-500">Bal: {inr(e.running_balance || 0)}</div>
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

// ─── Reports ───────────────────────────────────────────────────────────────────
function RstReports({ bunkId }: { bunkId: string }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<{
    totalRev: number; totalExp: number; profit: number; creditCollected: number;
    orderCount: number; dineIn: number; takeaway: number;
    topItems: { name: string; qty: number; revenue: number }[];
    expenseBreakdown: { category: string; amount: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const toDate = new Date(year, month, 0);
    const to = `${year}-${String(month).padStart(2,'0')}-${String(toDate.getDate()).padStart(2,'0')}`;

    const [ordersRes, itemsRes, expRes, payRes] = await Promise.all([
      supabase.from('rst_orders').select('total_amount,payment_mode,order_type').eq('bunk_id', bunkId).gte('sale_date', from).lte('sale_date', to),
      supabase.from('rst_order_items').select('item_name,quantity,total_price').eq('bunk_id', bunkId).gte('created_at', from).lte('created_at', to + 'T23:59:59'),
      supabase.from('rst_expenses').select('category,amount').eq('bunk_id', bunkId).gte('expense_date', from).lte('expense_date', to),
      supabase.from('rst_payments').select('amount').eq('bunk_id', bunkId).gte('payment_date', from).lte('payment_date', to),
    ]);

    const orders = ordersRes.data || [];
    const items  = itemsRes.data || [];
    const exps   = expRes.data || [];
    const pays   = payRes.data || [];

    const totalRev        = orders.reduce((a, o) => a + Number(o.total_amount), 0);
    const totalExp        = exps.reduce((a, e) => a + Number(e.amount), 0);
    const creditCollected = pays.reduce((a, p) => a + Number(p.amount), 0);
    const profit          = totalRev - totalExp;
    const dineIn          = orders.filter(o => o.order_type === 'Dine In').length;
    const takeaway        = orders.filter(o => o.order_type === 'Takeaway').length;

    const itemMap: Record<string, { qty: number; revenue: number }> = {};
    for (const it of items) {
      if (!itemMap[it.item_name]) itemMap[it.item_name] = { qty: 0, revenue: 0 };
      itemMap[it.item_name].qty += Number(it.quantity);
      itemMap[it.item_name].revenue += Number(it.total_price);
    }
    const topItems = Object.entries(itemMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    const expCats: Record<string, number> = {};
    for (const e of exps) expCats[e.category] = (expCats[e.category] || 0) + Number(e.amount);
    const expenseBreakdown = Object.entries(expCats).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);

    setData({ totalRev, totalExp, profit, creditCollected, orderCount: orders.length, dineIn, takeaway, topItems, expenseBreakdown });
    setLoading(false);
  }, [bunkId, month, year]);

  useEffect(() => { load(); }, [load]);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {[now.getFullYear()-1, now.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={load} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><RefreshCw size={16} /></button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-red-600" size={28} /></div> : !data ? null : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Revenue', value: inr(data.totalRev), border: 'border-green-500', text: 'text-green-700' },
              { label: 'Expenses', value: inr(data.totalExp), border: 'border-red-500', text: 'text-red-700' },
              { label: 'Profit', value: inr(data.profit), border: 'border-blue-500', text: data.profit >= 0 ? 'text-green-700' : 'text-red-700' },
              { label: 'Credit Collected', value: inr(data.creditCollected), border: 'border-orange-500', text: 'text-orange-700' },
            ].map(k => (
              <div key={k.label} className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${k.border}`}>
                <div className="text-xs text-gray-500 mb-1">{k.label}</div>
                <div className={`text-2xl font-bold ${k.text}`}>{k.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-700 mb-3">Order Breakdown ({data.orderCount} orders)</h3>
            <div className="flex gap-4 text-sm flex-wrap">
              <span className="text-green-700 font-medium">🪑 Dine-in: {data.dineIn}</span>
              <span className="text-orange-700 font-medium">🥡 Takeaway: {data.takeaway}</span>
              <span className="text-blue-700 font-medium">📦 Delivery: {data.orderCount - data.dineIn - data.takeaway}</span>
            </div>
          </div>

          {data.topItems.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-red-600" /> Top Items</h3>
              <div className="space-y-2">
                {data.topItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-5">{i+1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="font-medium text-gray-700 truncate">{item.name}</span>
                        <span className="font-semibold text-red-600 ml-2">{inr(item.revenue)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (item.revenue / (data.topItems[0]?.revenue || 1)) * 100)}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 w-14 text-right">{item.qty} served</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.expenseBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FileText size={16} className="text-red-600" /> Expense Breakdown</h3>
              <div className="divide-y">
                {data.expenseBreakdown.map((e, i) => (
                  <div key={i} className="flex justify-between py-2 text-sm">
                    <span className="text-gray-600">{e.category}</span>
                    <span className="font-semibold text-red-600">{inr(e.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
