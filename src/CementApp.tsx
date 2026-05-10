import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, ShoppingCart, Users, Truck, BarChart3, Receipt, Settings,
  Plus, Search, AlertTriangle, TrendingUp, TrendingDown, RefreshCw,
  CheckCircle2, Clock, MapPin, Phone, X, ChevronRight, Building2,
  ArrowUpRight, ArrowDownRight, Loader2, Layers, DollarSign
} from 'lucide-react';
import { supabase } from './supabase';
import { getTodayIST, formatISTDate } from './utils';

// ── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: string; name: string; brand: string | null; product_type: string;
  grade: string | null; diameter_mm: number | null; weight_per_unit: number | null;
  unit: string; gst_percent: number; mrp: number; selling_price: number;
  wholesale_price: number; purchase_price: number; current_stock: number;
  reorder_level: number; hsn_code: string | null; is_active: boolean;
}
interface Customer {
  id: string; name: string; phone: string | null; address: string | null;
  customer_type: string; gstin: string | null; credit_limit: number;
  outstanding_amount: number; total_purchases: number; is_active: boolean;
}
interface Supplier {
  id: string; name: string; contact_name: string | null; phone: string | null;
  gstin: string | null; outstanding_amount: number; is_active: boolean;
}
interface Delivery {
  id: string; sale_id: string | null; customer_name: string | null;
  delivery_date: string; site_address: string; vehicle_number: string | null;
  driver_name: string | null; driver_phone: string | null; status: string; notes: string | null;
}
interface Sale {
  id: string; customer_name: string | null; sale_date: string;
  total_amount: number; paid_amount: number; payment_mode: string;
  payment_status: string; delivery_required: boolean;
}
interface Expense {
  id: string; category: string; description: string | null;
  amount: number; expense_date: string; payment_mode: string;
}

// ── Constants ────────────────────────────────────────────────────────────────
const PRODUCT_TYPES = [
  { value: 'cement',        label: '🧱 Cement' },
  { value: 'steel_tmt',     label: '🔩 Steel TMT' },
  { value: 'binding_wire',  label: '🪢 Binding Wire' },
  { value: 'aggregate',     label: '🪨 Aggregate/Jelly' },
  { value: 'sand',          label: '🏖️ Sand/M-Sand' },
  { value: 'brick',         label: '🧱 Bricks' },
  { value: 'block',         label: '⬛ Blocks (AAC/Hollow)' },
  { value: 'tile',          label: '◻️ Tiles' },
  { value: 'waterproofing', label: '💧 Waterproofing' },
  { value: 'admixture',     label: '🧪 Admixture' },
  { value: 'other',         label: '📦 Other' },
];
const CEMENT_BRANDS = ['Ultratech', 'ACC', 'Dalmia', 'Ramco', 'India Cements', 'JSW Cement', 'Sanghi', 'Birla', 'Wonder', 'Other'];
const STEEL_BRANDS  = ['TATA Tiscon', 'JSW Neosteel', 'SAIL', 'Vizag Steel', 'Jindal', 'Kamdhenu', 'Shyam Steel', 'Other'];
const CEMENT_GRADES = ['OPC43', 'OPC53', 'PPC', 'PSC', 'SRC'];
const STEEL_GRADES  = ['Fe415', 'Fe500', 'Fe500D', 'Fe550', 'Fe550D', 'Fe600'];
const STEEL_DIAMETERS = [8, 10, 12, 16, 20, 25, 32];
const CUSTOMER_TYPES = ['retail', 'contractor', 'builder'];
const EXPENSE_CATS = ['rent', 'salary', 'electricity', 'vehicle_fuel', 'loading_labour', 'unloading_labour', 'maintenance', 'other'];
const PAYMENT_MODES = ['cash', 'upi', 'card', 'credit', 'cheque'];

// Steel weight per meter by diameter (D²/162 formula, kg/m)
const STEEL_WEIGHT: Record<number, number> = { 8: 0.395, 10: 0.617, 12: 0.888, 16: 1.578, 20: 2.466, 25: 3.853, 32: 6.313 };

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const today = getTodayIST();

// ── Main Component ───────────────────────────────────────────────────────────
export function CementApp({ bunkId }: { bunkId: string }) {
  const [tab, setTab] = useState<'dashboard' | 'inventory' | 'sales' | 'customers' | 'deliveries' | 'purchases' | 'expenses' | 'reports' | 'suppliers'>('dashboard');

  const tabs = [
    { id: 'dashboard',  label: 'Dashboard',   icon: BarChart3 },
    { id: 'inventory',  label: 'Inventory',   icon: Package },
    { id: 'sales',      label: 'Sales',       icon: ShoppingCart },
    { id: 'customers',  label: 'Customers',   icon: Users },
    { id: 'deliveries', label: 'Deliveries',  icon: Truck },
    { id: 'purchases',  label: 'Purchases',   icon: ArrowUpRight },
    { id: 'expenses',   label: 'Expenses',    icon: Receipt },
    { id: 'reports',    label: 'Reports',     icon: TrendingUp },
    { id: 'suppliers',  label: 'Suppliers',   icon: Building2 },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-orange-600 text-white px-4 py-3 flex items-center gap-3 shadow">
        <Layers size={22} />
        <div>
          <div className="font-bold text-lg leading-tight">CementDesk AI</div>
          <div className="text-orange-100 text-xs">Building Materials Store</div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white border-b overflow-x-auto">
        <div className="flex min-w-max">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={`flex flex-col items-center gap-0.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-6xl mx-auto">
        {tab === 'dashboard'  && <DashboardTab bunkId={bunkId} />}
        {tab === 'inventory'  && <InventoryTab bunkId={bunkId} />}
        {tab === 'sales'      && <SalesTab bunkId={bunkId} />}
        {tab === 'customers'  && <CustomersTab bunkId={bunkId} />}
        {tab === 'deliveries' && <DeliveriesTab bunkId={bunkId} />}
        {tab === 'purchases'  && <PurchasesTab bunkId={bunkId} />}
        {tab === 'expenses'   && <ExpensesTab bunkId={bunkId} />}
        {tab === 'reports'    && <ReportsTab bunkId={bunkId} />}
        {tab === 'suppliers'  && <SuppliersTab bunkId={bunkId} />}
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function DashboardTab({ bunkId }: { bunkId: string }) {
  const [stats, setStats] = useState({ todaySales: 0, todayExpenses: 0, pendingDeliveries: 0, lowStockCount: 0, outstandingTotal: 0 });
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [pendingDels, setPendingDels] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [salesRes, expRes, delRes, prodRes, custRes] = await Promise.all([
      supabase.from('cement_sales').select('total_amount').eq('bunk_id', bunkId).eq('sale_date', today),
      supabase.from('cement_expenses').select('amount').eq('bunk_id', bunkId).eq('expense_date', today),
      supabase.from('cement_deliveries').select('*').eq('bunk_id', bunkId).neq('status', 'delivered').order('delivery_date', { ascending: true }),
      supabase.from('cement_products').select('*').eq('bunk_id', bunkId).eq('is_active', true),
      supabase.from('cement_customers').select('outstanding_amount').eq('bunk_id', bunkId).eq('is_active', true),
    ]);
    const todaySales = (salesRes.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const todayExpenses = (expRes.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const pendingDeliveries = (delRes.data || []).length;
    const products = prodRes.data || [];
    const lowStockItems = products.filter(p => Number(p.current_stock) <= Number(p.reorder_level));
    const outstandingTotal = (custRes.data || []).reduce((s, r) => s + Number(r.outstanding_amount || 0), 0);
    setStats({ todaySales, todayExpenses, pendingDeliveries, lowStockCount: lowStockItems.length, outstandingTotal });
    setLowStock(lowStockItems.slice(0, 5));
    setPendingDels((delRes.data || []).slice(0, 5) as Delivery[]);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Today — {formatISTDate(today)}</h2>
        <button onClick={load} className="text-orange-600 hover:text-orange-800"><RefreshCw size={18} /></button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Today's Sales",    value: inr(stats.todaySales),    color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
          { label: "Today's Expenses", value: inr(stats.todayExpenses),  color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
          { label: 'Pending Deliveries', value: stats.pendingDeliveries, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
          { label: 'Low Stock Items',  value: stats.lowStockCount,       color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
          { label: 'Total Outstanding', value: inr(stats.outstandingTotal), color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border ${c.border} rounded-xl p-3`}>
            <div className="text-xs text-gray-500 mb-1">{c.label}</div>
            <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Low Stock Alert */}
        <div className="bg-white rounded-xl border border-yellow-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-yellow-600" />
            <h3 className="font-semibold text-gray-700">Low Stock Alert</h3>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-gray-400">All stocks are adequate</p>
          ) : lowStock.map(p => (
            <div key={p.id} className="flex justify-between py-1.5 border-b last:border-0 text-sm">
              <span className="text-gray-700">{p.name} {p.brand ? `(${p.brand})` : ''}</span>
              <span className="text-red-600 font-medium">{p.current_stock} {p.unit}</span>
            </div>
          ))}
        </div>

        {/* Pending Deliveries */}
        <div className="bg-white rounded-xl border border-orange-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck size={16} className="text-orange-600" />
            <h3 className="font-semibold text-gray-700">Pending Deliveries</h3>
          </div>
          {pendingDels.length === 0 ? (
            <p className="text-sm text-gray-400">No pending deliveries</p>
          ) : pendingDels.map(d => (
            <div key={d.id} className="py-1.5 border-b last:border-0">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-700">{d.customer_name || 'Unknown'}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.status === 'dispatched' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{d.status}</span>
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <MapPin size={10} /> {d.site_address}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Inventory ────────────────────────────────────────────────────────────────
function InventoryTab({ bunkId }: { bunkId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<any>({
    name: '', brand: '', product_type: 'cement', grade: '', diameter_mm: '', weight_per_unit: '',
    unit: 'bag', gst_percent: 28, mrp: '', selling_price: '', wholesale_price: '',
    purchase_price: '', current_stock: '', reorder_level: 10, hsn_code: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('cement_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('product_type').order('name');
    setProducts(data || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p =>
    (typeFilter === 'all' || p.product_type === typeFilter) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand || '').toLowerCase().includes(search.toLowerCase()))
  );

  const openForm = (p?: Product) => {
    if (p) {
      setEditing(p);
      setForm({ ...p, diameter_mm: p.diameter_mm || '', weight_per_unit: p.weight_per_unit || '' });
    } else {
      setEditing(null);
      setForm({ name: '', brand: '', product_type: 'cement', grade: '', diameter_mm: '', weight_per_unit: '', unit: 'bag', gst_percent: 28, mrp: '', selling_price: '', wholesale_price: '', purchase_price: '', current_stock: 0, reorder_level: 10, hsn_code: '' });
    }
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      bunk_id: bunkId, name: form.name.trim(), brand: form.brand || null,
      product_type: form.product_type, grade: form.grade || null,
      diameter_mm: form.diameter_mm ? Number(form.diameter_mm) : null,
      weight_per_unit: form.weight_per_unit ? Number(form.weight_per_unit) : null,
      unit: form.unit, gst_percent: Number(form.gst_percent),
      hsn_code: form.hsn_code || null, mrp: Number(form.mrp || 0),
      selling_price: Number(form.selling_price || 0), wholesale_price: Number(form.wholesale_price || 0),
      purchase_price: Number(form.purchase_price || 0), current_stock: Number(form.current_stock || 0),
      reorder_level: Number(form.reorder_level || 0), is_active: true,
    };
    if (editing) await supabase.from('cement_products').update(payload).eq('id', editing.id);
    else await supabase.from('cement_products').insert(payload);
    setSaving(false);
    setShowForm(false);
    load();
  };

  const typeGstDefaults: Record<string, { gst: number; hsn: string; unit: string }> = {
    cement: { gst: 28, hsn: '2523', unit: 'bag' },
    steel_tmt: { gst: 18, hsn: '7214', unit: 'kg' },
    binding_wire: { gst: 18, hsn: '7217', unit: 'kg' },
    aggregate: { gst: 5, hsn: '2517', unit: 'cft' },
    sand: { gst: 5, hsn: '2616', unit: 'cft' },
    brick: { gst: 5, hsn: '6901', unit: 'piece' },
    block: { gst: 5, hsn: '6810', unit: 'piece' },
    tile: { gst: 28, hsn: '6907', unit: 'sqft' },
  };

  const onTypeChange = (type: string) => {
    const d = typeGstDefaults[type] || { gst: 18, hsn: '', unit: 'piece' };
    setForm((f: any) => ({ ...f, product_type: type, gst_percent: d.gst, hsn_code: d.hsn, unit: d.unit }));
  };

  const getBrands = () => form.product_type === 'steel_tmt' || form.product_type === 'binding_wire' ? STEEL_BRANDS : CEMENT_BRANDS;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h2 className="font-bold text-gray-800 text-lg">Inventory ({products.length} products)</h2>
        <button onClick={() => openForm()} className="flex items-center gap-1.5 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">All Types</option>
          {PRODUCT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Steel Weight Calculator */}
      {typeFilter === 'steel_tmt' && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <h4 className="font-semibold text-orange-800 mb-2 text-sm">⚖️ Steel Weight Calculator (D²/162)</h4>
          <div className="grid grid-cols-4 gap-2 text-xs text-center">
            {STEEL_DIAMETERS.map(d => (
              <div key={d} className="bg-white rounded-lg p-2 border border-orange-100">
                <div className="font-bold text-orange-700">{d}mm</div>
                <div className="text-gray-500">{STEEL_WEIGHT[d]} kg/m</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {filtered.map(p => {
          const isLow = Number(p.current_stock) <= Number(p.reorder_level);
          return (
            <div key={p.id} className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-sm transition-shadow ${isLow ? 'border-yellow-300' : 'border-gray-100'}`}
              onClick={() => openForm(p)}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-gray-800">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {p.brand} {p.grade ? `· ${p.grade}` : ''} {p.diameter_mm ? `· ${p.diameter_mm}mm` : ''} · GST {p.gst_percent}%
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-lg ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{p.current_stock} <span className="text-sm font-normal text-gray-400">{p.unit}</span></div>
                  {isLow && <div className="text-xs text-red-500">⚠ Low Stock</div>}
                </div>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-gray-500">
                <span>Retail: <strong className="text-gray-700">{inr(p.selling_price)}</strong></span>
                <span>Wholesale: <strong className="text-gray-700">{inr(p.wholesale_price)}</strong></span>
                <span>Purchase: <strong className="text-gray-700">{inr(p.purchase_price)}</strong></span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-10 text-gray-400">No products found</div>}
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800">{editing ? 'Edit' : 'Add'} Product</h3>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="grid gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Product Type *</label>
                <select value={form.product_type} onChange={e => onTypeChange(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {PRODUCT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Product Name *</label>
                <input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="e.g. OPC 53 Cement, 12mm TMT Bar" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Brand</label>
                  <select value={form.brand} onChange={e => setForm((f: any) => ({ ...f, brand: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Select Brand</option>
                    {getBrands().map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Grade</label>
                  <select value={form.grade} onChange={e => setForm((f: any) => ({ ...f, grade: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Select Grade</option>
                    {(form.product_type === 'steel_tmt' ? STEEL_GRADES : CEMENT_GRADES).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              {form.product_type === 'steel_tmt' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Diameter (mm)</label>
                    <select value={form.diameter_mm} onChange={e => {
                      const d = Number(e.target.value);
                      setForm((f: any) => ({ ...f, diameter_mm: d, weight_per_unit: STEEL_WEIGHT[d] || '' }));
                    }} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="">Select</option>
                      {STEEL_DIAMETERS.map(d => <option key={d} value={d}>{d}mm</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Weight per meter (kg)</label>
                    <input type="number" value={form.weight_per_unit} onChange={e => setForm((f: any) => ({ ...f, weight_per_unit: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Unit</label>
                  <select value={form.unit} onChange={e => setForm((f: any) => ({ ...f, unit: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {['bag', 'kg', 'ton', 'piece', 'sqft', 'cft', 'meter', 'bundle'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">GST %</label>
                  <select value={form.gst_percent} onChange={e => setForm((f: any) => ({ ...f, gst_percent: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">HSN Code</label>
                  <input value={form.hsn_code} onChange={e => setForm((f: any) => ({ ...f, hsn_code: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[['mrp', 'MRP (₹)'], ['selling_price', 'Retail Price (₹)'], ['wholesale_price', 'Contractor Price (₹)'], ['purchase_price', 'Purchase Price (₹)']].map(([k, l]) => (
                  <div key={k}>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{l}</label>
                    <input type="number" value={(form as any)[k]} onChange={e => setForm((f: any) => ({ ...f, [k]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Current Stock</label>
                  <input type="number" value={form.current_stock} onChange={e => setForm((f: any) => ({ ...f, current_stock: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Reorder Level</label>
                  <input type="number" value={form.reorder_level} onChange={e => setForm((f: any) => ({ ...f, reorder_level: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            <button onClick={save} disabled={saving} className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {editing ? 'Update Product' : 'Add Product'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sales / POS ───────────────────────────────────────────────────────────────
function SalesTab({ bunkId }: { bunkId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPOS, setShowPOS] = useState(false);
  const [selCustomer, setSelCustomer] = useState<Customer | null>(null);
  const [custSearch, setCustSearch] = useState('');
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [payMode, setPayMode] = useState('cash');
  const [paidAmt, setPaidAmt] = useState('');
  const [delivReq, setDelivReq] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [p, c, s] = await Promise.all([
        supabase.from('cement_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).gt('current_stock', 0).order('product_type').order('name'),
        supabase.from('cement_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
        supabase.from('cement_sales').select('*').eq('bunk_id', bunkId).order('created_at', { ascending: false }).limit(30),
      ]);
      setProducts(p.data || []);
      setCustomers(c.data || []);
      setSales(s.data || []);
      setLoading(false);
    })();
  }, [bunkId, saleSuccess]);

  const isContractor = selCustomer && (selCustomer.customer_type === 'contractor' || selCustomer.customer_type === 'builder');

  const addToCart = (p: Product) => {
    const price = isContractor && p.wholesale_price > 0 ? p.wholesale_price : p.selling_price;
    setCartItems(prev => {
      const ex = prev.find(i => i.product_id === p.id);
      if (ex) return prev.map(i => i.product_id === p.id ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * i.price } : i);
      return [...prev, { product_id: p.id, product_name: p.name, unit: p.unit, mrp: p.mrp, price, gst_percent: p.gst_percent, qty: 1, total: price }];
    });
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) { setCartItems(prev => prev.filter(i => i.product_id !== id)); return; }
    setCartItems(prev => prev.map(i => i.product_id === id ? { ...i, qty, total: qty * i.price } : i));
  };

  const subtotal = cartItems.reduce((s, i) => s + i.total, 0);
  const gstAmt = cartItems.reduce((s, i) => s + (i.total * i.gst_percent / 100), 0);
  const total = subtotal + gstAmt;

  const checkout = async () => {
    if (cartItems.length === 0) return;
    setSaving(true);
    const paid = Number(paidAmt || (payMode === 'credit' ? 0 : total));
    const status = paid >= total ? 'paid' : paid === 0 ? 'credit' : 'partial';
    const { data: saleData, error } = await supabase.from('cement_sales').insert({
      bunk_id: bunkId, customer_id: selCustomer?.id || null,
      customer_name: selCustomer?.name || 'Walk-in', sale_date: today,
      subtotal, gst_amount: gstAmt, discount_amount: 0, total_amount: total,
      paid_amount: paid, payment_mode: payMode, payment_status: status,
      delivery_required: delivReq, notes: notes || null, entered_via: 'webapp',
    }).select().single();

    if (saleData && !error) {
      await supabase.from('cement_sale_items').insert(
        cartItems.map(i => ({
          bunk_id: bunkId, sale_id: saleData.id, product_id: i.product_id,
          product_name: i.product_name, quantity: i.qty, unit: i.unit,
          mrp: i.mrp, selling_price: i.price, gst_percent: i.gst_percent,
          discount_percent: 0, total_amount: i.total,
        }))
      );
      if (selCustomer) {
        const newOut = Number(selCustomer.outstanding_amount) + (total - paid);
        const newTotal = Number(selCustomer.total_purchases) + total;
        await supabase.from('cement_customers').update({ outstanding_amount: Math.max(0, newOut), total_purchases: newTotal }).eq('id', selCustomer.id);
      }
    }
    setSaving(false);
    setCartItems([]); setSelCustomer(null); setCustSearch(''); setPaidAmt('');
    setNotes(''); setDelivReq(false); setPayMode('cash'); setShowPOS(false);
    setSaleSuccess(s => !s);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;

  if (showPOS) return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => { setShowPOS(false); setCartItems([]); setSelCustomer(null); }} className="text-orange-600">← Back</button>
        <h2 className="font-bold text-gray-800">New Sale / Bill</h2>
      </div>

      {/* Customer Selection */}
      <div className="bg-white border rounded-xl p-4">
        <label className="text-xs font-medium text-gray-600 block mb-2">Customer (optional)</label>
        <input value={custSearch} onChange={e => setCustSearch(e.target.value)} placeholder="Search customer name…" className="w-full border rounded-lg px-3 py-2 text-sm" />
        {custSearch && !selCustomer && (
          <div className="mt-1 border rounded-lg overflow-hidden max-h-32 overflow-y-auto">
            {customers.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase())).map(c => (
              <button key={c.id} onClick={() => { setSelCustomer(c); setCustSearch(c.name); }} className="w-full text-left px-3 py-2 hover:bg-orange-50 text-sm">
                {c.name} <span className="text-xs text-gray-400">({c.customer_type})</span>
              </button>
            ))}
          </div>
        )}
        {selCustomer && (
          <div className="mt-2 flex items-center justify-between bg-orange-50 rounded-lg px-3 py-2 text-sm">
            <span className="font-medium text-orange-800">{selCustomer.name} <span className="text-xs text-orange-500 capitalize">({selCustomer.customer_type})</span></span>
            <button onClick={() => { setSelCustomer(null); setCustSearch(''); }} className="text-gray-400"><X size={14} /></button>
          </div>
        )}
        {isContractor && <div className="text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded">Contractor pricing applied automatically</div>}
      </div>

      {/* Products */}
      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold text-gray-700 mb-3 text-sm">Select Products</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {products.map(p => {
            const price = isContractor && p.wholesale_price > 0 ? p.wholesale_price : p.selling_price;
            const ci = cartItems.find(i => i.product_id === p.id);
            return (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-700">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.brand} · {inr(price)}/{p.unit} · Stock: {p.current_stock}</div>
                </div>
                {ci ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(p.id, ci.qty - 1)} className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-bold text-sm">−</button>
                    <span className="text-sm font-medium w-8 text-center">{ci.qty}</span>
                    <button onClick={() => updateQty(p.id, ci.qty + 1)} className="w-7 h-7 rounded-full bg-orange-500 text-white font-bold text-sm">+</button>
                  </div>
                ) : (
                  <button onClick={() => addToCart(p)} className="text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg">Add</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Cart Summary */}
      {cartItems.length > 0 && (
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-700 text-sm">Cart Summary</h3>
          {cartItems.map(i => (
            <div key={i.product_id} className="flex justify-between text-sm">
              <span>{i.product_name} × {i.qty} {i.unit}</span>
              <span className="font-medium">{inr(i.total)}</span>
            </div>
          ))}
          <div className="border-t pt-2 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
            <div className="flex justify-between text-gray-500"><span>GST</span><span>{inr(gstAmt)}</span></div>
            <div className="flex justify-between font-bold text-gray-800 text-base"><span>Total</span><span>{inr(total)}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Payment Mode</label>
              <select value={payMode} onChange={e => setPayMode(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Amount Paid (₹)</label>
              <input type="number" value={paidAmt} onChange={e => setPaidAmt(e.target.value)} placeholder={String(total.toFixed(0))} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={delivReq} onChange={e => setDelivReq(e.target.checked)} className="rounded" />
            Delivery required to site?
          </label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className="w-full border rounded-lg px-3 py-2 text-sm" />
          <button onClick={checkout} disabled={saving} className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />}
            Generate Bill — {inr(total)}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">Sales</h2>
        <button onClick={() => setShowPOS(true)} className="flex items-center gap-1.5 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">
          <Plus size={16} /> New Sale
        </button>
      </div>
      <div className="space-y-3">
        {sales.map(s => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-gray-800">{s.customer_name || 'Walk-in'}</div>
                <div className="text-xs text-gray-400 mt-0.5">{formatISTDate(s.sale_date)} · {s.payment_mode}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-800">{inr(s.total_amount)}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${s.payment_status === 'paid' ? 'bg-green-100 text-green-700' : s.payment_status === 'credit' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{s.payment_status}</span>
              </div>
            </div>
          </div>
        ))}
        {sales.length === 0 && <div className="text-center py-10 text-gray-400">No sales yet</div>}
      </div>
    </div>
  );
}

// ── Customers ────────────────────────────────────────────────────────────────
function CustomersTab({ bunkId }: { bunkId: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', customer_type: 'retail', gstin: '', credit_limit: 0 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('cement_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name');
    setCustomers(data || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const filtered = customers.filter(c =>
    (typeFilter === 'all' || c.customer_type === typeFilter) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search))
  );

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { bunk_id: bunkId, name: form.name.trim(), phone: form.phone || null, address: form.address || null, customer_type: form.customer_type, gstin: form.gstin || null, credit_limit: Number(form.credit_limit || 0), is_active: true };
    if (editing) await supabase.from('cement_customers').update(payload).eq('id', editing.id);
    else await supabase.from('cement_customers').insert({ ...payload, outstanding_amount: 0, total_purchases: 0 });
    setSaving(false); setShowForm(false); load();
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">Customers ({customers.length})</h2>
        <button onClick={() => { setEditing(null); setForm({ name: '', phone: '', address: '', customer_type: 'retail', gstin: '', credit_limit: 0 }); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-36">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="all">All</option>
          {CUSTOMER_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:shadow-sm"
            onClick={() => { setEditing(c); setForm({ name: c.name, phone: c.phone || '', address: c.address || '', customer_type: c.customer_type, gstin: c.gstin || '', credit_limit: c.credit_limit }); setShowForm(true); }}>
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-gray-800">{c.name}</div>
                <div className="text-xs text-gray-400 mt-0.5 capitalize">{c.customer_type} {c.phone ? `· ${c.phone}` : ''}</div>
              </div>
              <div className="text-right">
                {c.outstanding_amount > 0 && <div className="text-sm font-bold text-red-600">{inr(c.outstanding_amount)}</div>}
                <div className="text-xs text-gray-400">Total: {inr(c.total_purchases)}</div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-10 text-gray-400">No customers found</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800">{editing ? 'Edit' : 'Add'} Customer</h3>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="grid gap-3">
              {[['name', 'Full Name *', 'text'], ['phone', 'Phone', 'tel'], ['address', 'Address', 'text'], ['gstin', 'GSTIN (optional)', 'text']].map(([k, l, t]) => (
                <div key={k}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{l}</label>
                  <input type={t} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
                  <select value={form.customer_type} onChange={e => setForm(f => ({ ...f, customer_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {CUSTOMER_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Credit Limit (₹)</label>
                  <input type="number" value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <button onClick={save} disabled={saving} className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {editing ? 'Update' : 'Add Customer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Deliveries ────────────────────────────────────────────────────────────────
function DeliveriesTab({ bunkId }: { bunkId: string }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ customer_id: '', customer_name: '', delivery_date: today, site_address: '', vehicle_number: '', driver_name: '', driver_phone: '', status: 'pending', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, c] = await Promise.all([
      supabase.from('cement_deliveries').select('*').eq('bunk_id', bunkId).order('delivery_date', { ascending: false }).limit(50),
      supabase.from('cement_customers').select('id, name').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
    ]);
    setDeliveries(d.data || []);
    setCustomers(c.data || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const filtered = deliveries.filter(d => statusFilter === 'all' || d.status === statusFilter);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('cement_deliveries').update({ status }).eq('id', id);
    load();
  };

  const save = async () => {
    if (!form.site_address.trim()) return;
    setSaving(true);
    const cust = customers.find(c => c.id === form.customer_id);
    await supabase.from('cement_deliveries').insert({
      bunk_id: bunkId, customer_id: form.customer_id || null,
      customer_name: cust?.name || form.customer_name || null,
      delivery_date: form.delivery_date, site_address: form.site_address.trim(),
      vehicle_number: form.vehicle_number || null, driver_name: form.driver_name || null,
      driver_phone: form.driver_phone || null, status: form.status, notes: form.notes || null,
    });
    setSaving(false); setShowForm(false); load();
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    dispatched: 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">Deliveries</h2>
        <button onClick={() => { setForm({ customer_id: '', customer_name: '', delivery_date: today, site_address: '', vehicle_number: '', driver_name: '', driver_phone: '', status: 'pending', notes: '' }); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">
          <Plus size={16} /> Schedule Delivery
        </button>
      </div>

      <div className="flex gap-2">
        {['all', 'pending', 'dispatched', 'delivered'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(d => (
          <div key={d.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-gray-800">{d.customer_name || 'Unknown Customer'}</div>
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5"><MapPin size={10} />{d.site_address}</div>
                <div className="text-xs text-gray-400">{formatISTDate(d.delivery_date)}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[d.status] || 'bg-gray-100 text-gray-600'}`}>{d.status}</span>
            </div>

            {(d.vehicle_number || d.driver_name) && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 flex gap-4 text-xs text-gray-600">
                {d.vehicle_number && <span>🚛 {d.vehicle_number}</span>}
                {d.driver_name && <span>👤 {d.driver_name}</span>}
                {d.driver_phone && <span><Phone size={10} className="inline" /> {d.driver_phone}</span>}
              </div>
            )}

            {d.status !== 'delivered' && (
              <div className="flex gap-2">
                {d.status === 'pending' && (
                  <button onClick={() => updateStatus(d.id, 'dispatched')} className="flex-1 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-medium">Mark Dispatched</button>
                )}
                <button onClick={() => updateStatus(d.id, 'delivered')} className="flex-1 py-1.5 bg-green-600 text-white text-xs rounded-lg font-medium">Mark Delivered</button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-10 text-gray-400">No deliveries</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Schedule Delivery</h3>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="grid gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Customer</label>
                <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Walk-in / Other</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Site Address *</label>
                <input value={form.site_address} onChange={e => setForm(f => ({ ...f, site_address: e.target.value }))} placeholder="Construction site address" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Delivery Date</label>
                <input type="date" value={form.delivery_date} onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Vehicle No.</label>
                  <input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="AP09AB1234" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Driver Name</label>
                  <input value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Driver Phone</label>
                <input value={form.driver_phone} onChange={e => setForm(f => ({ ...f, driver_phone: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <button onClick={save} disabled={saving} className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              Schedule Delivery
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Purchases ────────────────────────────────────────────────────────────────
function PurchasesTab({ bunkId }: { bunkId: string }) {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', invoice_number: '', purchase_date: today, vehicle_number: '', payment_status: 'unpaid', paid_amount: 0, notes: '' });
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [pur, sup, prod] = await Promise.all([
      supabase.from('cement_purchases').select('*, cement_suppliers(name)').eq('bunk_id', bunkId).order('purchase_date', { ascending: false }).limit(30),
      supabase.from('cement_suppliers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('cement_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
    ]);
    setPurchases(pur.data || []);
    setSuppliers(sup.data || []);
    setProducts(prod.data || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const addItem = () => setItems(i => [...i, { product_id: '', quantity: 1, purchase_price: 0, gst_percent: 28 }]);
  const updateItem = (idx: number, key: string, val: any) => setItems(i => i.map((it, j) => j === idx ? { ...it, [key]: val } : it));
  const removeItem = (idx: number) => setItems(i => i.filter((_, j) => j !== idx));
  const total = items.reduce((s, i) => s + (Number(i.quantity || 0) * Number(i.purchase_price || 0)), 0);

  const save = async () => {
    if (items.length === 0 || items.some(i => !i.product_id)) return;
    setSaving(true);
    const gst = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.purchase_price || 0) * Number(i.gst_percent || 0) / 100, 0);
    const { data: pur } = await supabase.from('cement_purchases').insert({
      bunk_id: bunkId, supplier_id: form.supplier_id || null, invoice_number: form.invoice_number || null,
      purchase_date: form.purchase_date, vehicle_number: form.vehicle_number || null,
      subtotal: total, gst_amount: gst, discount_amount: 0, total_amount: total + gst,
      payment_status: form.payment_status, paid_amount: Number(form.paid_amount || 0), notes: form.notes || null,
    }).select().single();

    if (pur) {
      await supabase.from('cement_purchase_items').insert(items.map(i => {
        const p = products.find(pr => pr.id === i.product_id);
        return { bunk_id: bunkId, purchase_id: pur.id, product_id: i.product_id, quantity: Number(i.quantity), purchase_price: Number(i.purchase_price), gst_percent: Number(i.gst_percent), total_amount: Number(i.quantity) * Number(i.purchase_price) };
      }));
    }
    setSaving(false); setShowForm(false); setItems([]); load();
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">Purchases</h2>
        <button onClick={() => { setForm({ supplier_id: '', invoice_number: '', purchase_date: today, vehicle_number: '', payment_status: 'unpaid', paid_amount: 0, notes: '' }); setItems([]); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">
          <Plus size={16} /> New Purchase
        </button>
      </div>
      <div className="space-y-3">
        {purchases.map(p => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-gray-800">{(p.cement_suppliers || {}).name || 'Unknown Supplier'}</div>
                <div className="text-xs text-gray-400">{formatISTDate(p.purchase_date)} {p.invoice_number ? `· #${p.invoice_number}` : ''}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-800">{inr(p.total_amount)}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.payment_status}</span>
              </div>
            </div>
          </div>
        ))}
        {purchases.length === 0 && <div className="text-center py-10 text-gray-400">No purchases yet</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800">New Purchase</h3>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Supplier</label>
                  <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Invoice No.</label>
                  <input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Date</label>
                  <input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Vehicle No.</label>
                  <input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="AP09AB1234" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-sm text-gray-700">Items</h4>
                  <button onClick={addItem} className="text-xs text-orange-600 font-medium flex items-center gap-1"><Plus size={12} /> Add Item</button>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 mb-2 items-end">
                    <div className="col-span-2">
                      <select value={item.product_id} onChange={e => {
                        const p = products.find(pr => pr.id === e.target.value);
                        updateItem(idx, 'product_id', e.target.value);
                        if (p) { updateItem(idx, 'purchase_price', p.purchase_price); updateItem(idx, 'gst_percent', p.gst_percent); }
                      }} className="w-full border rounded-lg px-2 py-2 text-xs">
                        <option value="">Select Product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="Qty" className="border rounded-lg px-2 py-2 text-xs" />
                    <div className="flex gap-1">
                      <input type="number" value={item.purchase_price} onChange={e => updateItem(idx, 'purchase_price', e.target.value)} placeholder="Rate" className="flex-1 border rounded-lg px-2 py-2 text-xs" />
                      <button onClick={() => removeItem(idx)} className="text-red-400"><X size={14} /></button>
                    </div>
                  </div>
                ))}
                {items.length > 0 && <div className="text-sm font-bold text-right text-gray-800">Total: {inr(total)}</div>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Payment</label>
                  <select value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Paid Amount</label>
                  <input type="number" value={form.paid_amount} onChange={e => setForm(f => ({ ...f, paid_amount: Number(e.target.value) }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <button onClick={save} disabled={saving || items.length === 0} className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              Save Purchase
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Expenses ──────────────────────────────────────────────────────────────────
function ExpensesTab({ bunkId }: { bunkId: string }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: 'other', description: '', amount: '', expense_date: today, payment_mode: 'cash', notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('cement_expenses').select('*').eq('bunk_id', bunkId).order('expense_date', { ascending: false }).limit(50);
    setExpenses(data || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.amount || !Number(form.amount)) return;
    setSaving(true);
    await supabase.from('cement_expenses').insert({ bunk_id: bunkId, category: form.category, description: form.description || null, amount: Number(form.amount), expense_date: form.expense_date, payment_mode: form.payment_mode, notes: form.notes || null });
    setSaving(false); setShowForm(false); load();
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">Expenses</h2>
        <button onClick={() => { setForm({ category: 'other', description: '', amount: '', expense_date: today, payment_mode: 'cash', notes: '' }); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">
          <Plus size={16} /> Add Expense
        </button>
      </div>
      <div className="space-y-2">
        {expenses.map(e => (
          <div key={e.id} className="bg-white rounded-xl border border-gray-100 p-3 flex justify-between items-center">
            <div>
              <div className="text-sm font-medium text-gray-800 capitalize">{e.category.replace(/_/g, ' ')} {e.description ? `— ${e.description}` : ''}</div>
              <div className="text-xs text-gray-400">{formatISTDate(e.expense_date)} · {e.payment_mode}</div>
            </div>
            <div className="font-bold text-red-600">{inr(e.amount)}</div>
          </div>
        ))}
        {expenses.length === 0 && <div className="text-center py-10 text-gray-400">No expenses recorded</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Add Expense</h3>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="grid gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {EXPENSE_CATS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Amount (₹) *</label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Date</label>
                  <input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Payment Mode</label>
                <select value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <button onClick={save} disabled={saving} className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              Save Expense
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reports ───────────────────────────────────────────────────────────────────
function ReportsTab({ bunkId }: { bunkId: string }) {
  const currentMonth = today.substring(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    const from = `${month}-01`;
    const to = `${month}-31`;
    const [sales, exp, pur, prod, cust] = await Promise.all([
      supabase.from('cement_sales').select('total_amount, paid_amount, payment_status, sale_date').eq('bunk_id', bunkId).gte('sale_date', from).lte('sale_date', to),
      supabase.from('cement_expenses').select('amount, category').eq('bunk_id', bunkId).gte('expense_date', from).lte('expense_date', to),
      supabase.from('cement_purchases').select('total_amount').eq('bunk_id', bunkId).gte('purchase_date', from).lte('purchase_date', to),
      supabase.from('cement_products').select('name, current_stock, purchase_price, product_type').eq('bunk_id', bunkId).eq('is_active', true),
      supabase.from('cement_customers').select('outstanding_amount').eq('bunk_id', bunkId).eq('is_active', true),
    ]);

    const totalSales = (sales.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const totalPaid = (sales.data || []).reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const totalExp = (exp.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalPurchases = (pur.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const totalOutstanding = (cust.data || []).reduce((s, r) => s + Number(r.outstanding_amount || 0), 0);
    const stockValue = (prod.data || []).reduce((s, p) => s + Number(p.current_stock || 0) * Number(p.purchase_price || 0), 0);

    const expByCategory: Record<string, number> = {};
    (exp.data || []).forEach(e => { expByCategory[e.category] = (expByCategory[e.category] || 0) + Number(e.amount || 0); });

    const salesByDay: Record<string, number> = {};
    (sales.data || []).forEach(s => { salesByDay[s.sale_date] = (salesByDay[s.sale_date] || 0) + Number(s.total_amount || 0); });

    setReport({ totalSales, totalPaid, totalExp, totalPurchases, totalOutstanding, stockValue, expByCategory, salesByDay, salesCount: (sales.data || []).length });
    setLoading(false);
  }, [bunkId, month]);

  useEffect(() => { loadReport(); }, [loadReport]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="font-bold text-gray-800">Reports</h2>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm ml-auto" />
      </div>

      {loading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-orange-500" size={28} /></div>}

      {report && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: 'Total Sales', value: inr(report.totalSales), color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Cash Collected', value: inr(report.totalPaid), color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Total Expenses', value: inr(report.totalExp), color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Net Profit', value: inr(report.totalSales - report.totalExp), color: report.totalSales - report.totalExp >= 0 ? 'text-green-700' : 'text-red-700', bg: 'bg-gray-50' },
              { label: 'Stock Value', value: inr(report.stockValue), color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Outstanding', value: inr(report.totalOutstanding), color: 'text-orange-600', bg: 'bg-orange-50' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-xl p-3 border border-gray-100`}>
                <div className="text-xs text-gray-500 mb-1">{c.label}</div>
                <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">Expenses by Category</h3>
            {Object.entries(report.expByCategory).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between py-1.5 border-b last:border-0 text-sm">
                <span className="text-gray-600 capitalize">{cat.replace(/_/g, ' ')}</span>
                <span className="font-medium text-red-600">{inr(amt as number)}</span>
              </div>
            ))}
            {Object.keys(report.expByCategory).length === 0 && <p className="text-sm text-gray-400">No expenses this month</p>}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">Daily Sales ({report.salesCount} bills)</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {Object.entries(report.salesByDay).sort().map(([date, amt]) => (
                <div key={date} className="flex justify-between text-sm py-1">
                  <span className="text-gray-500">{formatISTDate(date)}</span>
                  <span className="font-medium text-gray-800">{inr(amt as number)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Suppliers ────────────────────────────────────────────────────────────────
function SuppliersTab({ bunkId }: { bunkId: string }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', email: '', address: '', gstin: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('cement_suppliers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name');
    setSuppliers(data || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { bunk_id: bunkId, name: form.name.trim(), contact_name: form.contact_name || null, phone: form.phone || null, email: form.email || null, address: form.address || null, gstin: form.gstin || null, is_active: true };
    if (editing) await supabase.from('cement_suppliers').update(payload).eq('id', editing.id);
    else await supabase.from('cement_suppliers').insert({ ...payload, outstanding_amount: 0 });
    setSaving(false); setShowForm(false); load();
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">Suppliers ({suppliers.length})</h2>
        <button onClick={() => { setEditing(null); setForm({ name: '', contact_name: '', phone: '', email: '', address: '', gstin: '' }); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700">
          <Plus size={16} /> Add Supplier
        </button>
      </div>
      <div className="space-y-3">
        {suppliers.map(s => (
          <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:shadow-sm"
            onClick={() => { setEditing(s); setForm({ name: s.name, contact_name: s.contact_name || '', phone: s.phone || '', email: '', address: '', gstin: s.gstin || '' }); setShowForm(true); }}>
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-gray-800">{s.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.contact_name || ''} {s.phone ? `· ${s.phone}` : ''}</div>
              </div>
              {s.outstanding_amount > 0 && <div className="text-sm font-bold text-red-600">{inr(s.outstanding_amount)}</div>}
            </div>
          </div>
        ))}
        {suppliers.length === 0 && <div className="text-center py-10 text-gray-400">No suppliers added</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800">{editing ? 'Edit' : 'Add'} Supplier</h3>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="grid gap-3">
              {[['name', 'Supplier Name *'], ['contact_name', 'Contact Person'], ['phone', 'Phone'], ['email', 'Email'], ['address', 'Address'], ['gstin', 'GSTIN']].map(([k, l]) => (
                <div key={k}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{l}</label>
                  <input value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              ))}
            </div>
            <button onClick={save} disabled={saving} className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {editing ? 'Update Supplier' : 'Add Supplier'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
