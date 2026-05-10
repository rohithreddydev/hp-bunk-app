// ═══════════════════════════════════════════════════════════════════════════
// FuelDesk AI — Other Store Module (OtherApp)
// Supports: hardware, restaurant, textile, auto_parts, agriculture,
//           stationery, general
// Indigo color theme — gen_ Supabase tables
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Truck, Receipt,
  BarChart3, Store, Plus, Edit2, Trash2, X, Search, AlertTriangle,
  CheckCircle2, ChevronDown, Loader2, TrendingUp, TrendingDown,
  Wallet, DollarSign, Calendar, Filter,
} from 'lucide-react';
import { supabase } from './supabase';
import { getTodayIST, formatISTDate } from './utils';

// ─── Currency helper ─────────────────────────────────────────────────────────
function inr(n: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);
}

// ─── Biz config ───────────────────────────────────────────────────────────────
interface BizConfig {
  emoji: string;
  name: string;
  categories: string[];
  units: string[];
  customerLabel: string;
}

const BIZ_CONFIG: Record<string, BizConfig> = {
  hardware: {
    emoji: '🔧', name: 'Hardware Store',
    categories: ['Tools', 'Pipe & Fittings', 'Paint', 'Electrical', 'Plumbing', 'Safety', 'Fasteners', 'Other'],
    units: ['piece', 'meter', 'kg', 'box', 'set', 'roll', 'pack'],
    customerLabel: 'Customer',
  },
  restaurant: {
    emoji: '🍽️', name: 'Restaurant',
    categories: ['Food', 'Beverages', 'Snacks', 'Desserts', 'Starters', 'Main Course', 'Other'],
    units: ['plate', 'piece', 'glass', 'bottle', 'kg', 'litre', 'pack'],
    customerLabel: 'Guest',
  },
  textile: {
    emoji: '👕', name: 'Textile Store',
    categories: ['Cotton', 'Silk', 'Synthetic', 'Wool', 'Denim', 'Linen', 'Accessories', 'Ready-made', 'Other'],
    units: ['meter', 'piece', 'set', 'dozen', 'kg'],
    customerLabel: 'Customer',
  },
  auto_parts: {
    emoji: '🚗', name: 'Auto Parts',
    categories: ['Engine Parts', 'Electrical', 'Body Parts', 'Tyres', 'Battery', 'Filters', 'Oils & Lubricants', 'Accessories', 'Other'],
    units: ['piece', 'set', 'litre', 'kg', 'box'],
    customerLabel: 'Customer',
  },
  agriculture: {
    emoji: '🌾', name: 'Agriculture Store',
    categories: ['Seeds', 'Fertilizers', 'Pesticides', 'Herbicides', 'Equipment', 'Tools', 'Irrigation', 'Other'],
    units: ['kg', 'litre', 'packet', 'bag', 'piece', 'set'],
    customerLabel: 'Farmer',
  },
  stationery: {
    emoji: '📚', name: 'Stationery Store',
    categories: ['Books', 'Pens & Pencils', 'Paper', 'Files & Folders', 'Art Supplies', 'Office Supplies', 'School Supplies', 'Other'],
    units: ['piece', 'pack', 'box', 'dozen', 'ream', 'set'],
    customerLabel: 'Customer',
  },
  general: {
    emoji: '📦', name: 'General Store',
    categories: ['Category A', 'Category B', 'Category C', 'Other'],
    units: ['piece', 'kg', 'litre', 'box', 'pack', 'set'],
    customerLabel: 'Customer',
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  bunk_id: string;
  name: string;
  brand: string;
  category: string;
  unit: string;
  gst_percent: number;
  hsn_code: string;
  mrp: number;
  selling_price: number;
  wholesale_price: number;
  purchase_price: number;
  current_stock: number;
  reorder_level: number;
  is_active: boolean;
  created_at: string;
}

interface Supplier {
  id: string;
  bunk_id: string;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  outstanding_amount: number;
  is_active: boolean;
  created_at: string;
}

interface Purchase {
  id: string;
  bunk_id: string;
  supplier_id: string | null;
  invoice_number: string;
  purchase_date: string;
  subtotal: number;
  gst_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_status: string;
  paid_amount: number;
  notes: string;
  created_at: string;
  gen_suppliers?: { name: string } | null;
}

interface PurchaseItem {
  product_id: string;
  quantity: number;
  purchase_price: number;
  gst_percent: number;
  total_amount: number;
}

interface Customer {
  id: string;
  bunk_id: string;
  name: string;
  phone: string;
  address: string;
  customer_type: string;
  gstin: string;
  credit_limit: number;
  outstanding_amount: number;
  total_purchases: number;
  is_active: boolean;
  created_at: string;
}

interface Sale {
  id: string;
  bunk_id: string;
  customer_id: string | null;
  customer_name: string;
  sale_date: string;
  subtotal: number;
  gst_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  payment_mode: string;
  payment_status: string;
  notes: string;
  entered_via: string;
  created_at: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  selling_price: number;
  gst_percent: number;
  discount_percent: number;
}

interface Expense {
  id: string;
  bunk_id: string;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  payment_mode: string;
  notes: string;
  created_at: string;
}

type Tab = 'dashboard' | 'inventory' | 'sales' | 'customers' | 'purchases' | 'expenses' | 'reports' | 'suppliers';

const GST_OPTIONS = [0, 5, 12, 18, 28];
const PAYMENT_MODES = ['cash', 'upi', 'card', 'bank_transfer', 'credit'];
const EXPENSE_CATEGORIES = ['Rent', 'Electricity', 'Staff Salary', 'Transport', 'Repairs', 'Marketing', 'Taxes', 'Other'];

// ─── Main Component ───────────────────────────────────────────────────────────
export function OtherApp({ bunkId, bizType }: { bunkId: string; bizType: string }) {
  const config = BIZ_CONFIG[bizType] ?? BIZ_CONFIG['general'];
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // ─ shared state ─
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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

  // ─ data fetch ─
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [p, s, c, sa, pu, ex] = await Promise.all([
      supabase.from('gen_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('gen_suppliers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('gen_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('gen_sales').select('*').eq('bunk_id', bunkId).order('sale_date', { ascending: false }).limit(200),
      supabase.from('gen_purchases').select('*, gen_suppliers(name)').eq('bunk_id', bunkId).order('purchase_date', { ascending: false }).limit(100),
      supabase.from('gen_expenses').select('*').eq('bunk_id', bunkId).order('expense_date', { ascending: false }).limit(200),
    ]);
    if (p.data) setProducts(p.data as Product[]);
    if (s.data) setSuppliers(s.data as Supplier[]);
    if (c.data) setCustomers(c.data as Customer[]);
    if (sa.data) setSales(sa.data as Sale[]);
    if (pu.data) setPurchases(pu.data as Purchase[]);
    if (ex.data) setExpenses(ex.data as Expense[]);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─ derived ─
  const today = getTodayIST();
  const todaySalesTotal = sales.filter(s => s.sale_date === today).reduce((a, s) => a + s.total_amount, 0);
  const todayExpensesTotal = expenses.filter(e => e.expense_date === today).reduce((a, e) => a + e.amount, 0);
  const lowStockItems = products.filter(p => p.current_stock <= p.reorder_level);
  const totalOutstanding = customers.reduce((a, c) => a + c.outstanding_amount, 0);
  const recentSales = sales.slice(0, 10);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'inventory', label: 'Inventory', icon: <Package size={16} /> },
    { id: 'sales', label: 'Sales / POS', icon: <ShoppingCart size={16} /> },
    { id: 'customers', label: config.customerLabel + 's', icon: <Users size={16} /> },
    { id: 'purchases', label: 'Purchases', icon: <Truck size={16} /> },
    { id: 'expenses', label: 'Expenses', icon: <Receipt size={16} /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 size={16} /> },
    { id: 'suppliers', label: 'Suppliers', icon: <Store size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-indigo-600 text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <span className="text-2xl">{config.emoji}</span>
        <div>
          <h1 className="font-bold text-lg leading-tight">{config.name}</h1>
          <p className="text-indigo-200 text-xs">FuelDesk AI</p>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Tab Bar */}
      <nav className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex min-w-max">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="p-4 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardTab
                todaySalesTotal={todaySalesTotal}
                todayExpensesTotal={todayExpensesTotal}
                lowStockItems={lowStockItems}
                totalOutstanding={totalOutstanding}
                recentSales={recentSales}
              />
            )}
            {activeTab === 'inventory' && (
              <InventoryTab
                bunkId={bunkId}
                products={products}
                config={config}
                onRefresh={fetchAll}
                showToast={showToast}
              />
            )}
            {activeTab === 'sales' && (
              <SalesTab
                bunkId={bunkId}
                products={products}
                customers={customers}
                config={config}
                onRefresh={fetchAll}
                showToast={showToast}
              />
            )}
            {activeTab === 'customers' && (
              <CustomersTab
                bunkId={bunkId}
                customers={customers}
                config={config}
                onRefresh={fetchAll}
                showToast={showToast}
              />
            )}
            {activeTab === 'purchases' && (
              <PurchasesTab
                bunkId={bunkId}
                products={products}
                suppliers={suppliers}
                purchases={purchases}
                config={config}
                onRefresh={fetchAll}
                showToast={showToast}
              />
            )}
            {activeTab === 'expenses' && (
              <ExpensesTab
                bunkId={bunkId}
                expenses={expenses}
                onRefresh={fetchAll}
                showToast={showToast}
              />
            )}
            {activeTab === 'reports' && (
              <ReportsTab
                bunkId={bunkId}
                sales={sales}
                purchases={purchases}
                expenses={expenses}
              />
            )}
            {activeTab === 'suppliers' && (
              <SuppliersTab
                bunkId={bunkId}
                suppliers={suppliers}
                onRefresh={fetchAll}
                showToast={showToast}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════
function DashboardTab({
  todaySalesTotal,
  todayExpensesTotal,
  lowStockItems,
  totalOutstanding,
  recentSales,
}: {
  todaySalesTotal: number;
  todayExpensesTotal: number;
  lowStockItems: Product[];
  totalOutstanding: number;
  recentSales: Sale[];
}) {
  const kpis = [
    { label: "Today's Sales", value: inr(todaySalesTotal), icon: <TrendingUp size={20} />, color: 'bg-green-50 text-green-700 border-green-200' },
    { label: "Today's Expenses", value: inr(todayExpensesTotal), icon: <TrendingDown size={20} />, color: 'bg-red-50 text-red-700 border-red-200' },
    { label: 'Low Stock Items', value: String(lowStockItems.length), icon: <AlertTriangle size={20} />, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { label: 'Total Outstanding', value: inr(totalOutstanding), icon: <Wallet size={20} />, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.color}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium opacity-80">{k.label}</span>
              {k.icon}
            </div>
            <p className="text-xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low stock */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-500" /> Low Stock Alert
          </h2>
          {lowStockItems.length === 0 ? (
            <p className="text-gray-400 text-sm">All products are well-stocked.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lowStockItems.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.category}</p>
                  </div>
                  <span className={`text-sm font-semibold ${p.current_stock <= 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                    {p.current_stock} {p.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent sales */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ShoppingCart size={16} className="text-indigo-600" /> Recent Sales
          </h2>
          {recentSales.length === 0 ? (
            <p className="text-gray-400 text-sm">No sales yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentSales.map(s => (
                <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.customer_name}</p>
                    <p className="text-xs text-gray-400">{formatISTDate(s.sale_date)} · {s.payment_mode}</p>
                  </div>
                  <span className={`text-sm font-semibold ${s.payment_status === 'credit' ? 'text-orange-600' : 'text-green-600'}`}>
                    {inr(s.total_amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INVENTORY TAB
// ═══════════════════════════════════════════════════════════════════════════
interface ProductForm {
  name: string; brand: string; category: string; unit: string;
  gst_percent: number; hsn_code: string; mrp: number; selling_price: number;
  wholesale_price: number; purchase_price: number; current_stock: number;
  reorder_level: number;
}

const defaultProductForm = (config: BizConfig): ProductForm => ({
  name: '', brand: '', category: config.categories[0], unit: config.units[0],
  gst_percent: 18, hsn_code: '', mrp: 0, selling_price: 0,
  wholesale_price: 0, purchase_price: 0, current_stock: 0, reorder_level: 5,
});

function InventoryTab({ bunkId, products, config, onRefresh, showToast }: {
  bunkId: string; products: Product[]; config: BizConfig;
  onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(defaultProductForm(config));
  const [saving, setSaving] = useState(false);

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase());
    const matchesCat = catFilter === 'All' || p.category === catFilter;
    return matchesSearch && matchesCat;
  });

  function openAdd() {
    setEditing(null);
    setForm(defaultProductForm(config));
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name, brand: p.brand, category: p.category, unit: p.unit,
      gst_percent: p.gst_percent, hsn_code: p.hsn_code, mrp: p.mrp,
      selling_price: p.selling_price, wholesale_price: p.wholesale_price,
      purchase_price: p.purchase_price, current_stock: p.current_stock,
      reorder_level: p.reorder_level,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Product name is required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId };
    const { error } = editing
      ? await supabase.from('gen_products').update(payload).eq('id', editing.id)
      : await supabase.from('gen_products').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editing ? 'Product updated' : 'Product added');
    setShowModal(false);
    onRefresh();
  }

  async function handleDelete(p: Product) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    const { error } = await supabase.from('gen_products').update({ is_active: false }).eq('id', p.id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Product removed');
    onRefresh();
  }

  const setF = (k: keyof ProductForm, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <select
            value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="All">All Categories</option>
            {config.categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">MRP</th>
                <th className="px-4 py-3 text-right">Selling</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">GST%</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No products found.</td></tr>
              )}
              {filtered.map(p => {
                const isLow = p.current_stock <= p.reorder_level;
                const isOut = p.current_stock <= 0;
                return (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{p.name}</p>
                      {p.brand && <p className="text-xs text-gray-400">{p.brand}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.category}</td>
                    <td className="px-4 py-3 text-right">{inr(p.mrp)}</td>
                    <td className="px-4 py-3 text-right font-medium">{inr(p.selling_price)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-green-600'}`}>
                        {p.current_stock} {p.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{p.gst_percent}%</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openEdit(p)} className="text-indigo-600 hover:text-indigo-800"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(p)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      {showModal && (
        <Modal title={editing ? 'Edit Product' : 'Add Product'} onClose={() => setShowModal(false)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Product Name *</label>
              <input value={form.name} onChange={e => setF('name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="e.g. PVC Pipe 1 inch" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Brand</label>
              <input value={form.brand} onChange={e => setF('brand', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Brand name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Category</label>
              <select value={form.category} onChange={e => setF('category', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {config.categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Unit</label>
              <select value={form.unit} onChange={e => setF('unit', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {config.units.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">GST %</label>
              <select value={form.gst_percent} onChange={e => setF('gst_percent', Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {GST_OPTIONS.map(g => <option key={g} value={g}>{g}%</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">HSN Code</label>
              <input value={form.hsn_code} onChange={e => setF('hsn_code', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">MRP (₹)</label>
              <input type="number" value={form.mrp || ''} onChange={e => setF('mrp', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" min="0" step="0.01" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Selling Price (₹)</label>
              <input type="number" value={form.selling_price || ''} onChange={e => setF('selling_price', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" min="0" step="0.01" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Wholesale Price (₹)</label>
              <input type="number" value={form.wholesale_price || ''} onChange={e => setF('wholesale_price', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" min="0" step="0.01" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Purchase Price (₹)</label>
              <input type="number" value={form.purchase_price || ''} onChange={e => setF('purchase_price', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" min="0" step="0.01" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Current Stock</label>
              <input type="number" value={form.current_stock || ''} onChange={e => setF('current_stock', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" min="0" step="0.001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Reorder Level</label>
              <input type="number" value={form.reorder_level || ''} onChange={e => setF('reorder_level', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" min="0" step="0.001" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowModal(false)} className="border border-gray-300 text-gray-600 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : (editing ? 'Save Changes' : 'Add Product')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SALES / POS TAB
// ═══════════════════════════════════════════════════════════════════════════
function SalesTab({ bunkId, products, customers, config, onRefresh, showToast }: {
  bunkId: string; products: Product[]; customers: Customer[];
  config: BizConfig; onRefresh: () => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isWholesale = selectedCustomer?.customer_type === 'wholesale';

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category.toLowerCase().includes(productSearch.toLowerCase())
  );

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        return prev.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        product,
        quantity: 1,
        selling_price: isWholesale && product.wholesale_price > 0 ? product.wholesale_price : product.selling_price,
        gst_percent: product.gst_percent,
        discount_percent: 0,
      }];
    });
    setProductSearch('');
  }

  function updateCartQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart(prev => prev.filter(c => c.product.id !== productId));
    } else {
      setCart(prev => prev.map(c => c.product.id === productId ? { ...c, quantity: qty } : c));
    }
  }

  function updateCartPrice(productId: string, price: number) {
    setCart(prev => prev.map(c => c.product.id === productId ? { ...c, selling_price: price } : c));
  }

  function updateCartDiscount(productId: string, disc: number) {
    setCart(prev => prev.map(c => c.product.id === productId ? { ...c, discount_percent: disc } : c));
  }

  const subtotal = cart.reduce((a, c) => a + c.quantity * c.selling_price, 0);
  const gstAmount = cart.reduce((a, c) => {
    const lineTotal = c.quantity * c.selling_price * (1 - c.discount_percent / 100);
    return a + lineTotal * (c.gst_percent / 100);
  }, 0);
  const discountAmount = cart.reduce((a, c) => a + c.quantity * c.selling_price * (c.discount_percent / 100), 0);
  const totalAmount = subtotal - discountAmount + gstAmount;

  useEffect(() => { setPaidAmount(totalAmount); }, [totalAmount]);

  async function handleCheckout() {
    if (cart.length === 0) { showToast('Cart is empty', 'error'); return; }
    setSaving(true);

    const paymentStatus =
      paidAmount >= totalAmount ? 'paid' :
      paidAmount > 0 ? 'partial' : 'credit';

    const { data: saleData, error: saleErr } = await supabase.from('gen_sales').insert({
      bunk_id: bunkId,
      customer_id: selectedCustomer?.id ?? null,
      customer_name: selectedCustomer?.name ?? 'Walk-in',
      sale_date: getTodayIST(),
      subtotal,
      gst_amount: gstAmount,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      payment_mode: paymentMode,
      payment_status: paymentStatus,
      notes,
      entered_via: 'webapp',
    }).select('id').single();

    if (saleErr || !saleData) {
      showToast(saleErr?.message ?? 'Failed to create sale', 'error');
      setSaving(false);
      return;
    }

    const saleId = saleData.id;
    const items = cart.map(c => ({
      bunk_id: bunkId,
      sale_id: saleId,
      product_id: c.product.id,
      product_name: c.product.name,
      quantity: c.quantity,
      unit: c.product.unit,
      mrp: c.product.mrp,
      selling_price: c.selling_price,
      gst_percent: c.gst_percent,
      discount_percent: c.discount_percent,
      total_amount: c.quantity * c.selling_price * (1 - c.discount_percent / 100),
    }));

    const { error: itemsErr } = await supabase.from('gen_sale_items').insert(items);
    if (itemsErr) { showToast(itemsErr.message, 'error'); setSaving(false); return; }

    // Update customer outstanding if credit
    if (selectedCustomer && paymentStatus !== 'paid') {
      const creditAmount = totalAmount - paidAmount;
      await supabase.from('gen_customers').update({
        outstanding_amount: selectedCustomer.outstanding_amount + creditAmount,
        total_purchases: selectedCustomer.total_purchases + totalAmount,
      }).eq('id', selectedCustomer.id);
    } else if (selectedCustomer) {
      await supabase.from('gen_customers').update({
        total_purchases: selectedCustomer.total_purchases + totalAmount,
      }).eq('id', selectedCustomer.id);
    }

    showToast('Sale saved successfully!');
    setCart([]);
    setSelectedCustomer(null);
    setNotes('');
    setPaidAmount(0);
    setPaymentMode('cash');
    setSaving(false);
    onRefresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: product search */}
      <div className="lg:col-span-2 space-y-4">
        {/* Customer selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-xs font-medium text-gray-600 mb-0.5">{config.customerLabel} (optional)</label>
          <select
            value={selectedCustomer?.id ?? ''}
            onChange={e => {
              const c = customers.find(c => c.id === e.target.value) ?? null;
              setSelectedCustomer(c);
              if (c) {
                setCart(prev => prev.map(item => ({
                  ...item,
                  selling_price: c.customer_type === 'wholesale' && item.product.wholesale_price > 0
                    ? item.product.wholesale_price : item.product.selling_price,
                })));
              }
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1"
          >
            <option value="">Walk-in / Cash Customer</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `· ${c.phone}` : ''} {c.outstanding_amount > 0 ? `· Due: ${inr(c.outstanding_amount)}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Product search */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-xs font-medium text-gray-600 mb-0.5">Add Products</label>
          <div className="relative mt-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="Search by name or category…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          {productSearch && (
            <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
              {filteredProducts.length === 0 && (
                <p className="text-sm text-gray-400 p-3">No products found.</p>
              )}
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-indigo-50 transition-colors"
                >
                  <span>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-gray-400 ml-2 text-xs">{p.category}</span>
                  </span>
                  <span className={`text-xs font-medium ${p.current_stock <= p.reorder_level ? 'text-yellow-600' : 'text-gray-500'}`}>
                    {p.current_stock} {p.unit} · {inr(isWholesale && p.wholesale_price > 0 ? p.wholesale_price : p.selling_price)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        {cart.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-700 mb-3">Cart ({cart.length} items)</h3>
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.product.id} className="grid grid-cols-12 gap-2 items-center text-sm">
                  <div className="col-span-4">
                    <p className="font-medium text-gray-800 truncate">{item.product.name}</p>
                    <p className="text-xs text-gray-400">{item.product.unit}</p>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number" min="0.001" step="0.001"
                      value={item.quantity}
                      onChange={e => updateCartQty(item.product.id, Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 text-center py-1"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number" min="0" step="0.01"
                      value={item.selling_price}
                      onChange={e => updateCartPrice(item.product.id, Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 py-1"
                    />
                  </div>
                  <div className="col-span-2 text-right font-medium text-gray-800">
                    {inr(item.quantity * item.selling_price * (1 - item.discount_percent / 100))}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => setCart(prev => prev.filter(c => c.product.id !== item.product.id))}
                      className="text-red-400 hover:text-red-600">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: Bill & payment */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h3 className="font-semibold text-gray-700">Bill Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span><span>{inr(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Discount</span><span>- {inr(discountAmount)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>GST</span><span>+ {inr(gstAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-800 text-base border-t pt-2">
              <span>Total</span><span>{inr(totalAmount)}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">Payment Mode</label>
            <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1">
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">Paid Amount (₹)</label>
            <input type="number" value={paidAmount || ''} onChange={e => setPaidAmount(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1" min="0" step="0.01" />
          </div>
          {paidAmount < totalAmount && totalAmount > 0 && (
            <p className="text-xs text-orange-600 font-medium">
              Credit: {inr(totalAmount - paidAmount)}
            </p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1 resize-none" rows={2} placeholder="Optional notes…" />
          </div>
          <button
            onClick={handleCheckout}
            disabled={saving || cart.length === 0}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {saving ? 'Saving…' : 'Checkout'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMERS TAB
// ═══════════════════════════════════════════════════════════════════════════
interface CustomerForm {
  name: string; phone: string; address: string;
  customer_type: string; gstin: string; credit_limit: number;
}

const defaultCustomerForm = (): CustomerForm => ({
  name: '', phone: '', address: '', customer_type: 'retail', gstin: '', credit_limit: 0,
});

function CustomersTab({ bunkId, customers, config, onRefresh, showToast }: {
  bunkId: string; customers: Customer[]; config: BizConfig;
  onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(defaultCustomerForm());
  const [saving, setSaving] = useState(false);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  function openAdd() { setEditing(null); setForm(defaultCustomerForm()); setShowModal(true); }
  function openEdit(c: Customer) {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, address: c.address, customer_type: c.customer_type, gstin: c.gstin, credit_limit: c.credit_limit });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId };
    const { error } = editing
      ? await supabase.from('gen_customers').update(payload).eq('id', editing.id)
      : await supabase.from('gen_customers').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editing ? `${config.customerLabel} updated` : `${config.customerLabel} added`);
    setShowModal(false);
    onRefresh();
  }

  async function handleDelete(c: Customer) {
    if (!confirm(`Remove "${c.name}"?`)) return;
    const { error } = await supabase.from('gen_customers').update({ is_active: false }).eq('id', c.id);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(`${config.customerLabel} removed`);
    onRefresh();
  }

  const setF = (k: keyof CustomerForm, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${config.customerLabel.toLowerCase()}s…`}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus size={16} /> Add {config.customerLabel}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">{config.customerLabel}</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Outstanding</th>
              <th className="px-4 py-3 text-right">Total Purchases</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No {config.customerLabel.toLowerCase()}s found.</td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{c.name}</p>
                  {c.address && <p className="text-xs text-gray-400 truncate max-w-xs">{c.address}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    c.customer_type === 'wholesale' ? 'bg-blue-100 text-blue-700' :
                    c.customer_type === 'credit' ? 'bg-orange-100 text-orange-700' :
                    'bg-green-100 text-green-700'
                  }`}>{c.customer_type}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={c.outstanding_amount > 0 ? 'text-orange-600 font-semibold' : 'text-gray-400'}>
                    {inr(c.outstanding_amount)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{inr(c.total_purchases)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => openEdit(c)} className="text-indigo-600 hover:text-indigo-800"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(c)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? `Edit ${config.customerLabel}` : `Add ${config.customerLabel}`} onClose={() => setShowModal(false)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Name *</label>
              <input value={form.name} onChange={e => setF('name', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Phone</label>
              <input value={form.phone} onChange={e => setF('phone', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Type</label>
              <select value={form.customer_type} onChange={e => setF('customer_type', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
                <option value="credit">Credit</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Address</label>
              <textarea value={form.address} onChange={e => setF('address', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" rows={2} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">GSTIN</label>
              <input value={form.gstin} onChange={e => setF('gstin', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Credit Limit (₹)</label>
              <input type="number" value={form.credit_limit || ''} onChange={e => setF('credit_limit', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" min="0" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowModal(false)} className="border border-gray-300 text-gray-600 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : (editing ? 'Save' : 'Add')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PURCHASES TAB
// ═══════════════════════════════════════════════════════════════════════════
function PurchasesTab({ bunkId, products, suppliers, purchases, config, onRefresh, showToast }: {
  bunkId: string; products: Product[]; suppliers: Supplier[]; purchases: Purchase[];
  config: BizConfig; onRefresh: () => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier_id: '',
    invoice_number: '',
    purchase_date: getTodayIST(),
    payment_status: 'unpaid',
    paid_amount: 0,
    notes: '',
  });
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);

  function addItem() {
    if (products.length === 0) return;
    setPurchaseItems(prev => [...prev, {
      product_id: products[0].id,
      quantity: 1,
      purchase_price: products[0].purchase_price,
      gst_percent: products[0].gst_percent,
      total_amount: products[0].purchase_price,
    }]);
  }

  function updateItem(idx: number, key: keyof PurchaseItem, value: string | number) {
    setPurchaseItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [key]: value };
      if (key === 'product_id') {
        const p = products.find(p => p.id === value);
        if (p) {
          updated.purchase_price = p.purchase_price;
          updated.gst_percent = p.gst_percent;
        }
      }
      updated.total_amount = updated.quantity * updated.purchase_price * (1 + updated.gst_percent / 100);
      return updated;
    }));
  }

  function removeItem(idx: number) {
    setPurchaseItems(prev => prev.filter((_, i) => i !== idx));
  }

  const subtotal = purchaseItems.reduce((a, i) => a + i.quantity * i.purchase_price, 0);
  const gstAmount = purchaseItems.reduce((a, i) => a + i.quantity * i.purchase_price * (i.gst_percent / 100), 0);
  const totalAmount = subtotal + gstAmount;

  async function handleSave() {
    if (purchaseItems.length === 0) { showToast('Add at least one item', 'error'); return; }
    setSaving(true);

    const { data: purData, error: purErr } = await supabase.from('gen_purchases').insert({
      bunk_id: bunkId,
      supplier_id: form.supplier_id || null,
      invoice_number: form.invoice_number,
      purchase_date: form.purchase_date,
      subtotal,
      gst_amount: gstAmount,
      discount_amount: 0,
      total_amount: totalAmount,
      payment_status: form.payment_status,
      paid_amount: form.paid_amount,
      notes: form.notes,
    }).select('id').single();

    if (purErr || !purData) {
      showToast(purErr?.message ?? 'Failed', 'error');
      setSaving(false);
      return;
    }

    const items = purchaseItems.map(i => ({
      bunk_id: bunkId,
      purchase_id: purData.id,
      product_id: i.product_id,
      quantity: i.quantity,
      purchase_price: i.purchase_price,
      gst_percent: i.gst_percent,
      total_amount: i.total_amount,
    }));

    const { error: itemsErr } = await supabase.from('gen_purchase_items').insert(items);
    if (itemsErr) { showToast(itemsErr.message, 'error'); setSaving(false); return; }

    // Update supplier outstanding if unpaid
    if (form.supplier_id && form.payment_status !== 'paid') {
      const sup = suppliers.find(s => s.id === form.supplier_id);
      if (sup) {
        const unpaid = totalAmount - form.paid_amount;
        await supabase.from('gen_suppliers').update({
          outstanding_amount: sup.outstanding_amount + unpaid,
        }).eq('id', form.supplier_id);
      }
    }

    showToast('Purchase saved!');
    setShowModal(false);
    setPurchaseItems([]);
    setForm({ supplier_id: '', invoice_number: '', purchase_date: getTodayIST(), payment_status: 'unpaid', paid_amount: 0, notes: '' });
    setSaving(false);
    onRefresh();
  }

  const setF = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-700">Purchases</h2>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus size={16} /> New Purchase
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Supplier</th>
              <th className="px-4 py-3 text-left">Invoice</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">No purchases yet.</td></tr>
            )}
            {purchases.map(p => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{formatISTDate(p.purchase_date)}</td>
                <td className="px-4 py-3 text-gray-800">{p.gen_suppliers?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{p.invoice_number || '—'}</td>
                <td className="px-4 py-3 text-right font-medium">{inr(p.total_amount)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    p.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}>{p.payment_status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="New Purchase" onClose={() => setShowModal(false)} wide>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Supplier</label>
              <select value={form.supplier_id} onChange={e => setF('supplier_id', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1">
                <option value="">-- Select Supplier --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Invoice Number</label>
              <input value={form.invoice_number} onChange={e => setF('invoice_number', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Purchase Date</label>
              <input type="date" value={form.purchase_date} onChange={e => setF('purchase_date', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Payment Status</label>
              <select value={form.payment_status} onChange={e => setF('payment_status', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1">
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Paid Amount (₹)</label>
              <input type="number" value={form.paid_amount || ''} onChange={e => setF('paid_amount', Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1" min="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Notes</label>
              <input value={form.notes} onChange={e => setF('notes', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
            </div>
          </div>

          {/* Items */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Items</label>
              <button onClick={addItem} className="text-indigo-600 text-sm font-medium flex items-center gap-1 hover:underline">
                <Plus size={14} /> Add Item
              </button>
            </div>
            {purchaseItems.length === 0 && (
              <p className="text-sm text-gray-400 py-2">No items added yet.</p>
            )}
            {purchaseItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center mb-2 text-sm">
                <div className="col-span-5">
                  <select value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 py-1.5">
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 py-1.5 text-center" min="0.001" step="0.001" placeholder="Qty" />
                </div>
                <div className="col-span-2">
                  <input type="number" value={item.purchase_price} onChange={e => updateItem(idx, 'purchase_price', Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 py-1.5" min="0" step="0.01" placeholder="Rate" />
                </div>
                <div className="col-span-2 text-right font-medium text-gray-700">{inr(item.total_amount)}</div>
                <div className="col-span-1 flex justify-end">
                  <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                </div>
              </div>
            ))}
            {purchaseItems.length > 0 && (
              <div className="flex justify-end gap-6 mt-3 pt-3 border-t text-sm">
                <span className="text-gray-500">Subtotal: <strong>{inr(subtotal)}</strong></span>
                <span className="text-gray-500">GST: <strong>{inr(gstAmount)}</strong></span>
                <span className="text-gray-800 font-bold">Total: {inr(totalAmount)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowModal(false)} className="border border-gray-300 text-gray-600 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save Purchase'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPENSES TAB
// ═══════════════════════════════════════════════════════════════════════════
interface ExpenseForm {
  category: string; description: string; amount: number;
  expense_date: string; payment_mode: string; notes: string;
}

const defaultExpenseForm = (): ExpenseForm => ({
  category: 'Other', description: '', amount: 0,
  expense_date: getTodayIST(), payment_mode: 'cash', notes: '',
});

function ExpensesTab({ bunkId, expenses, onRefresh, showToast }: {
  bunkId: string; expenses: Expense[];
  onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(defaultExpenseForm());
  const [saving, setSaving] = useState(false);

  const setF = (k: keyof ExpenseForm, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (form.amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('gen_expenses').insert({ ...form, bunk_id: bunkId });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Expense saved');
    setShowModal(false);
    setForm(defaultExpenseForm());
    onRefresh();
  }

  async function handleDelete(e: Expense) {
    if (!confirm('Delete this expense?')) return;
    await supabase.from('gen_expenses').delete().eq('id', e.id);
    showToast('Expense deleted');
    onRefresh();
  }

  const totalThisMonth = expenses
    .filter(e => e.expense_date.startsWith(getTodayIST().substring(0, 7)))
    .reduce((a, e) => a + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-700">Expenses</h2>
          <p className="text-sm text-gray-400">This month: <strong className="text-gray-700">{inr(totalThisMonth)}</strong></p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus size={16} /> Add Expense
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-left">Mode</th>
              <th className="px-4 py-3 text-center">Del</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No expenses recorded.</td></tr>
            )}
            {expenses.map(e => (
              <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{formatISTDate(e.expense_date)}</td>
                <td className="px-4 py-3 text-gray-800">{e.category}</td>
                <td className="px-4 py-3 text-gray-500">{e.description || '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-red-600">{inr(e.amount)}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{e.payment_mode}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleDelete(e)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Add Expense" onClose={() => setShowModal(false)}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Category</label>
              <select value={form.category} onChange={e => setF('category', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1">
                {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Amount (₹) *</label>
              <input type="number" value={form.amount || ''} onChange={e => setF('amount', Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1" min="0" step="0.01" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Description</label>
              <input value={form.description} onChange={e => setF('description', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Date</label>
              <input type="date" value={form.expense_date} onChange={e => setF('expense_date', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Payment Mode</label>
              <select value={form.payment_mode} onChange={e => setF('payment_mode', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1">
                {PAYMENT_MODES.slice(0, 4).map(m => <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Notes</label>
              <input value={form.notes} onChange={e => setF('notes', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowModal(false)} className="border border-gray-300 text-gray-600 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save Expense'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS TAB
// ═══════════════════════════════════════════════════════════════════════════
function ReportsTab({ bunkId, sales, purchases, expenses }: {
  bunkId: string; sales: Sale[]; purchases: Purchase[]; expenses: Expense[];
}) {
  const currentMonth = getTodayIST().substring(0, 7);
  const [month, setMonth] = useState(currentMonth);

  const mSales = sales.filter(s => s.sale_date.startsWith(month));
  const mPurchases = purchases.filter(p => p.purchase_date.startsWith(month));
  const mExpenses = expenses.filter(e => e.expense_date.startsWith(month));

  const totalSales = mSales.reduce((a, s) => a + s.total_amount, 0);
  const cashCollected = mSales.reduce((a, s) => a + s.paid_amount, 0);
  const totalExpenses = mExpenses.reduce((a, e) => a + e.amount, 0);
  const totalPurchases = mPurchases.reduce((a, p) => a + p.total_amount, 0);
  const netProfit = totalSales - totalExpenses - totalPurchases;

  // Expense breakdown by category
  const expenseBreakdown: Record<string, number> = {};
  mExpenses.forEach(e => {
    expenseBreakdown[e.category] = (expenseBreakdown[e.category] ?? 0) + e.amount;
  });
  const expenseEntries = Object.entries(expenseBreakdown).sort((a, b) => b[1] - a[1]);

  const kpis = [
    { label: 'Total Sales', value: inr(totalSales), color: 'text-green-600', icon: <TrendingUp size={18} /> },
    { label: 'Cash Collected', value: inr(cashCollected), color: 'text-blue-600', icon: <DollarSign size={18} /> },
    { label: 'Total Expenses', value: inr(totalExpenses), color: 'text-red-600', icon: <TrendingDown size={18} /> },
    { label: 'Total Purchases', value: inr(totalPurchases), color: 'text-orange-600', icon: <Truck size={18} /> },
    { label: 'Net Profit', value: inr(netProfit), color: netProfit >= 0 ? 'text-green-700' : 'text-red-700', icon: <BarChart3 size={18} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calendar size={18} className="text-indigo-600" />
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <span className="text-gray-500 text-sm">{mSales.length} sales · {mExpenses.length} expenses</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1 text-gray-500">
              {k.icon}
              <span className="text-xs font-medium">{k.label}</span>
            </div>
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Expense Breakdown</h3>
          {expenseEntries.length === 0 ? (
            <p className="text-gray-400 text-sm">No expenses this month.</p>
          ) : (
            <div className="space-y-2">
              {expenseEntries.map(([cat, amt]) => (
                <div key={cat} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{cat}</span>
                      <span className="font-medium text-red-600">{inr(amt)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-400 rounded-full"
                        style={{ width: `${totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent sales summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Sales This Month ({mSales.length})</h3>
          {mSales.length === 0 ? (
            <p className="text-gray-400 text-sm">No sales this month.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {mSales.slice(0, 20).map(s => (
                <div key={s.id} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0 text-sm">
                  <div>
                    <p className="text-gray-800 font-medium">{s.customer_name}</p>
                    <p className="text-xs text-gray-400">{formatISTDate(s.sale_date)}</p>
                  </div>
                  <span className={`font-semibold ${s.payment_status === 'credit' ? 'text-orange-600' : 'text-green-600'}`}>
                    {inr(s.total_amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPPLIERS TAB
// ═══════════════════════════════════════════════════════════════════════════
interface SupplierForm {
  name: string; contact_name: string; phone: string;
  email: string; address: string; gstin: string;
}

const defaultSupplierForm = (): SupplierForm => ({
  name: '', contact_name: '', phone: '', email: '', address: '', gstin: '',
});

function SuppliersTab({ bunkId, suppliers, onRefresh, showToast }: {
  bunkId: string; suppliers: Supplier[];
  onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(defaultSupplierForm());
  const [saving, setSaving] = useState(false);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search)
  );

  function openAdd() { setEditing(null); setForm(defaultSupplierForm()); setShowModal(true); }
  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({ name: s.name, contact_name: s.contact_name, phone: s.phone, email: s.email, address: s.address, gstin: s.gstin });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Supplier name is required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId };
    const { error } = editing
      ? await supabase.from('gen_suppliers').update(payload).eq('id', editing.id)
      : await supabase.from('gen_suppliers').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editing ? 'Supplier updated' : 'Supplier added');
    setShowModal(false);
    onRefresh();
  }

  async function handleDelete(s: Supplier) {
    if (!confirm(`Remove "${s.name}"?`)) return;
    await supabase.from('gen_suppliers').update({ is_active: false }).eq('id', s.id);
    showToast('Supplier removed');
    onRefresh();
  }

  const setF = (k: keyof SupplierForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus size={16} /> Add Supplier
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Supplier</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-right">Outstanding</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">No suppliers found.</td></tr>
            )}
            {filtered.map(s => (
              <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{s.name}</p>
                  {s.gstin && <p className="text-xs text-gray-400">GSTIN: {s.gstin}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">{s.contact_name || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{s.phone || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <span className={s.outstanding_amount > 0 ? 'text-orange-600 font-semibold' : 'text-gray-400'}>
                    {inr(s.outstanding_amount)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => openEdit(s)} className="text-indigo-600 hover:text-indigo-800"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(s)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Edit Supplier' : 'Add Supplier'} onClose={() => setShowModal(false)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Company Name *</label>
              <input value={form.name} onChange={e => setF('name', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Contact Person</label>
              <input value={form.contact_name} onChange={e => setF('contact_name', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Phone</label>
              <input value={form.phone} onChange={e => setF('phone', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Email</label>
              <input type="email" value={form.email} onChange={e => setF('email', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-0.5">GSTIN</label>
              <input value={form.gstin} onChange={e => setF('gstin', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-0.5">Address</label>
              <textarea value={form.address} onChange={e => setF('address', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none mt-1" rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowModal(false)} className="border border-gray-300 text-gray-600 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : (editing ? 'Save' : 'Add Supplier')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED: Modal wrapper
// ═══════════════════════════════════════════════════════════════════════════
function Modal({ title, children, onClose, wide }: {
  title: string; children: React.ReactNode; onClose: () => void; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Tailwind class helpers (used inline above as string literals)
// .label   → "block text-xs font-medium text-gray-600 mb-0.5"
// .input   → "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
// .btn-primary   → "bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
// .btn-secondary → "border border-gray-300 text-gray-600 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
// These need to be configured as Tailwind component classes in index.css or used inline.
// For portability the actual class strings are repeated inline in JSX above,
// so the component renders correctly without any additional CSS configuration.
