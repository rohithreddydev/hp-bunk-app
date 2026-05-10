// MedicalDesk AI — Full Medical Store Webapp (v1.0)
// Tabs: Dashboard | Inventory | Sales (POS) | Customers | Purchases | Expenses | Reports | Suppliers

import React, { useState, useEffect, useCallback } from 'react';
import {
  Pill, Package, ShoppingCart, Users, Truck, Receipt,
  BarChart3, Plus, X, Search, AlertTriangle, ChevronDown,
  ChevronRight, Loader2, CheckCircle2, XCircle, Calendar,
  TrendingUp, TrendingDown, Clock, Edit2, Trash2, Filter,
  Download, Home, DollarSign, AlertCircle
} from 'lucide-react';
import { supabase } from './supabase';
import { getTodayIST, formatISTDate } from './App';

// ─── Types ───────────────────────────────────────────────────────────────────
interface MedProduct {
  id: string; bunk_id: string; name: string; generic_name?: string;
  manufacturer?: string; category: string; gst_percent: number;
  unit: string; mrp: number; selling_price: number; reorder_level: number;
  current_stock: number; schedule: string; requires_prescription: boolean;
  is_active: boolean; created_at: string;
}
interface MedBatch {
  id: string; bunk_id: string; product_id: string; batch_number: string;
  mfg_date?: string; expiry_date: string; quantity: number;
  purchase_price: number; mrp: number; selling_price: number;
  supplier_id?: string; created_at: string;
  medical_products?: { name: string; unit: string };
}
interface MedSupplier {
  id: string; bunk_id: string; name: string; contact_name?: string;
  phone?: string; email?: string; address?: string; drug_license?: string;
  gstin?: string; outstanding_amount: number; is_active: boolean;
}
interface MedCustomer {
  id: string; bunk_id: string; name: string; phone?: string;
  address?: string; doctor_name?: string; allergies?: string;
  credit_limit: number; outstanding_amount: number;
  total_purchases: number; is_active: boolean;
}
interface MedSale {
  id: string; bunk_id: string; customer_id?: string; customer_name?: string;
  doctor_name?: string; prescription_number?: string; sale_date: string;
  subtotal: number; gst_amount: number; discount_amount: number;
  total_amount: number; paid_amount: number; payment_mode: string;
  payment_status: string; notes?: string; created_at: string;
}
interface MedSaleItem {
  product_id: string; product_name: string; batch_id?: string;
  batch_number?: string; expiry_date?: string; quantity: number;
  mrp: number; selling_price: number; gst_percent: number;
  discount_percent: number; total_amount: number;
}
interface MedPurchase {
  id: string; bunk_id: string; supplier_id?: string; invoice_number?: string;
  purchase_date: string; subtotal: number; gst_amount: number;
  discount_amount: number; total_amount: number; payment_status: string;
  paid_amount: number; notes?: string; created_at: string;
  medical_suppliers?: { name: string };
}
interface MedExpense {
  id: string; bunk_id: string; category: string; description?: string;
  amount: number; expense_date: string; payment_mode: string; notes?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CATEGORIES = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'powder', 'device', 'other'];
const SCHEDULES = ['OTC', 'H', 'H1', 'X'];
const GST_SLABS = [0, 5, 12, 18];
const UNITS = ['strip', 'bottle', 'vial', 'tube', 'box', 'piece', 'sachet'];
const EXP_CATEGORIES = ['rent', 'salary', 'electricity', 'maintenance', 'license', 'drug_license_renewal', 'other'];

function daysUntilExpiry(dateStr: string): number {
  const exp = new Date(dateStr);
  const today = new Date(getTodayIST());
  return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${color}`}>
      <div className="flex items-center gap-3">
        <div className="text-gray-500">{icon}</div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-800">{value}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab({ bunkId }: { bunkId: string }) {
  const today = getTodayIST();
  const [stats, setStats] = useState({ todaySales: 0, todayCash: 0, todayUpi: 0, todayCredit: 0, todayBills: 0, expiringCount: 0, lowStockCount: 0, totalOutstanding: 0 });
  const [expiring, setExpiring] = useState<MedBatch[]>([]);
  const [lowStock, setLowStock] = useState<MedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [salesRes, batchRes, prodRes, custRes] = await Promise.all([
        supabase.from('medical_sales').select('total_amount,payment_mode,payment_status').eq('bunk_id', bunkId).eq('sale_date', today),
        supabase.from('medical_batches').select('*, medical_products(name,unit)').eq('bunk_id', bunkId).gt('quantity', 0).lte('expiry_date', new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)).order('expiry_date'),
        supabase.from('medical_products').select('*').eq('bunk_id', bunkId).eq('is_active', true),
        supabase.from('medical_customers').select('outstanding_amount').eq('bunk_id', bunkId).eq('is_active', true),
      ]);

      const sales = salesRes.data || [];
      const todaySales = sales.reduce((s, r) => s + r.total_amount, 0);
      const todayCash = sales.filter(r => r.payment_mode === 'cash').reduce((s, r) => s + r.total_amount, 0);
      const todayUpi = sales.filter(r => r.payment_mode === 'upi').reduce((s, r) => s + r.total_amount, 0);
      const todayCredit = sales.filter(r => r.payment_status === 'credit').reduce((s, r) => s + r.total_amount, 0);
      const expiringBatches = (batchRes.data || []) as MedBatch[];
      const products = prodRes.data as MedProduct[] || [];
      const low = products.filter(p => p.current_stock <= p.reorder_level);
      const totalOutstanding = (custRes.data || []).reduce((s, c) => s + c.outstanding_amount, 0);

      setExpiring(expiringBatches);
      setLowStock(low);
      setStats({ todaySales, todayCash, todayUpi, todayCredit, todayBills: sales.length, expiringCount: expiringBatches.length, lowStockCount: low.length, totalOutstanding });
      setLoading(false);
    })();
  }, [bunkId, today]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={28} /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp size={20} />} label="Today's Sales" value={fmt(stats.todaySales)} sub={`${stats.todayBills} bills`} color="border-green-500" />
        <StatCard icon={<DollarSign size={20} />} label="Cash" value={fmt(stats.todayCash)} color="border-blue-500" />
        <StatCard icon={<AlertTriangle size={20} />} label="Outstanding" value={fmt(stats.totalOutstanding)} color="border-orange-500" />
        <StatCard icon={<Package size={20} />} label="Low Stock" value={String(stats.lowStockCount)} sub="items" color="border-red-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expiry Alerts */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Clock size={16} className="text-orange-500" /> Expiry Alerts (90 days)</h3>
          {expiring.length === 0 ? (
            <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 size={14} /> No batches expiring soon</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {expiring.map(b => {
                const days = daysUntilExpiry(b.expiry_date);
                const color = days <= 0 ? 'text-red-600 bg-red-50' : days <= 30 ? 'text-orange-600 bg-orange-50' : 'text-yellow-600 bg-yellow-50';
                return (
                  <div key={b.id} className={`rounded-lg px-3 py-2 ${color} flex justify-between items-center text-sm`}>
                    <div>
                      <p className="font-medium">{(b as any).medical_products?.name || 'Unknown'}</p>
                      <p className="text-xs opacity-80">Batch: {b.batch_number} | Qty: {b.quantity}</p>
                    </div>
                    <div className="text-right text-xs font-medium">
                      <p>{days <= 0 ? 'EXPIRED' : `${days}d`}</p>
                      <p className="opacity-70">{b.expiry_date}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-red-500" /> Low Stock</h3>
          {lowStock.length === 0 ? (
            <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 size={14} /> All stock adequate</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lowStock.map(p => (
                <div key={p.id} className="flex justify-between items-center bg-red-50 rounded-lg px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{p.current_stock} {p.unit}</p>
                    <p className="text-xs text-gray-400">min: {p.reorder_level}</p>
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

// ─── Inventory Tab ────────────────────────────────────────────────────────────
function InventoryTab({ bunkId }: { bunkId: string }) {
  const [products, setProducts] = useState<MedProduct[]>([]);
  const [batches, setBatches] = useState<MedBatch[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MedProduct | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, bRes] = await Promise.all([
      supabase.from('medical_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('medical_batches').select('*').eq('bunk_id', bunkId).gt('quantity', 0).order('expiry_date'),
    ]);
    setProducts(pRes.data as MedProduct[] || []);
    setBatches(bRes.data as MedBatch[] || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.generic_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const productBatches = (productId: string) => batches.filter(b => b.product_id === productId);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="Search medicines..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { setSelectedProduct(null); setShowAddProduct(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> Add Medicine
        </button>
        <button onClick={() => setShowAddBatch(true)} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
          <Package size={16} /> Add Batch/Stock
        </button>
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div> : (
        <div className="space-y-2">
          {filtered.map(p => {
            const pb = productBatches(p.id);
            const nearExpiry = pb.filter(b => daysUntilExpiry(b.expiry_date) <= 30).length;
            const isLow = p.current_stock <= p.reorder_level;
            return (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">{p.name}</span>
                      {p.schedule !== 'OTC' && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Sch-{p.schedule}</span>}
                      {p.requires_prescription && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Rx</span>}
                      {nearExpiry > 0 && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">⚠️ {nearExpiry} expiring</span>}
                    </div>
                    <p className="text-xs text-gray-500">{p.generic_name || ''} · {p.category} · GST {p.gst_percent}%</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`font-bold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{p.current_stock} {p.unit}</p>
                      <p className="text-xs text-gray-500">MRP {fmt(p.mrp)}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={e => { e.stopPropagation(); setSelectedProduct(p); setShowAddProduct(true); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>
                    </div>
                    {expandedProduct === p.id ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  </div>
                </div>
                {expandedProduct === p.id && (
                  <div className="border-t px-4 pb-3">
                    <p className="text-xs font-semibold text-gray-500 mt-2 mb-2">BATCHES ({pb.length})</p>
                    {pb.length === 0 ? <p className="text-xs text-gray-400">No active batches</p> : (
                      <div className="space-y-1">
                        {pb.map(b => {
                          const days = daysUntilExpiry(b.expiry_date);
                          const exp = days <= 0 ? 'text-red-600' : days <= 30 ? 'text-orange-500' : 'text-green-600';
                          return (
                            <div key={b.id} className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                              <span className="text-gray-600">Batch: <b>{b.batch_number}</b></span>
                              <span className="text-gray-600">Qty: <b>{b.quantity}</b></span>
                              <span className={`font-medium ${exp}`}>Exp: {b.expiry_date} {days <= 0 ? '(EXPIRED)' : `(${days}d)`}</span>
                              <span className="text-gray-500">MRP {fmt(b.mrp)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-gray-400 py-8">No medicines found</p>}
        </div>
      )}

      {showAddProduct && <ProductForm bunkId={bunkId} product={selectedProduct} onClose={() => setShowAddProduct(false)} onSave={load} />}
      {showAddBatch && <BatchForm bunkId={bunkId} products={products} onClose={() => setShowAddBatch(false)} onSave={load} />}
    </div>
  );
}

function ProductForm({ bunkId, product, onClose, onSave }: { bunkId: string; product: MedProduct | null; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    name: product?.name || '', generic_name: product?.generic_name || '',
    manufacturer: product?.manufacturer || '', category: product?.category || 'tablet',
    hsn_code: '', gst_percent: product?.gst_percent ?? 12, unit: product?.unit || 'strip',
    mrp: product?.mrp || 0, selling_price: product?.selling_price || 0,
    reorder_level: product?.reorder_level || 10, schedule: product?.schedule || 'OTC',
    requires_prescription: product?.requires_prescription || false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId, mrp: Number(form.mrp), selling_price: Number(form.selling_price), reorder_level: Number(form.reorder_level), gst_percent: Number(form.gst_percent) };
    if (product) await supabase.from('medical_products').update(payload).eq('id', product.id);
    else await supabase.from('medical_products').insert(payload);
    setSaving(false); onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="font-bold text-lg">{product ? 'Edit Medicine' : 'Add Medicine'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs text-gray-500">Brand Name *</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="col-span-2"><label className="text-xs text-gray-500">Generic/Salt Name</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.generic_name} onChange={e => set('generic_name', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Manufacturer</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Unit</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.unit} onChange={e => set('unit', e.target.value)}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Schedule</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.schedule} onChange={e => set('schedule', e.target.value)}>{SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">MRP (₹)</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.mrp} onChange={e => set('mrp', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Selling Price (₹)</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">GST %</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.gst_percent} onChange={e => set('gst_percent', e.target.value)}>{GST_SLABS.map(g => <option key={g} value={g}>{g}%</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Reorder Level</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.requires_prescription} onChange={e => set('requires_prescription', e.target.checked)} className="rounded" />
            Requires Prescription (Rx)
          </label>
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchForm({ bunkId, products, onClose, onSave }: { bunkId: string; products: MedProduct[]; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ product_id: products[0]?.id || '', batch_number: '', mfg_date: '', expiry_date: '', quantity: 0, purchase_price: 0, mrp: 0, selling_price: 0 });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.product_id || !form.batch_number || !form.expiry_date || !form.quantity) return;
    setSaving(true);
    await supabase.from('medical_batches').insert({ ...form, bunk_id: bunkId, quantity: Number(form.quantity), purchase_price: Number(form.purchase_price), mrp: Number(form.mrp), selling_price: Number(form.selling_price) });
    setSaving(false); onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="font-bold text-lg">Add Batch / Stock In</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div><label className="text-xs text-gray-500">Medicine *</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.product_id} onChange={e => set('product_id', e.target.value)}>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Batch No. *</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.batch_number} onChange={e => set('batch_number', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Quantity *</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.quantity} onChange={e => set('quantity', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Mfg Date</label><input type="date" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.mfg_date} onChange={e => set('mfg_date', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Expiry Date *</label><input type="date" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Purchase Price</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">MRP</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.mrp} onChange={e => set('mrp', e.target.value)} /></div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium">
            {saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Add Stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sales POS Tab ────────────────────────────────────────────────────────────
function SalesTab({ bunkId }: { bunkId: string }) {
  const today = getTodayIST();
  const [products, setProducts] = useState<MedProduct[]>([]);
  const [customers, setCustomers] = useState<MedCustomer[]>([]);
  const [sales, setSales] = useState<MedSale[]>([]);
  const [cart, setCart] = useState<MedSaleItem[]>([]);
  const [search, setSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<MedCustomer | null>(null);
  const [doctorName, setDoctorName] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card' | 'credit'>('cash');
  const [discount, setDiscount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSales, setShowSales] = useState(false);

  useEffect(() => {
    (async () => {
      const [pRes, cRes, sRes] = await Promise.all([
        supabase.from('medical_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).gt('current_stock', 0).order('name'),
        supabase.from('medical_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
        supabase.from('medical_sales').select('*').eq('bunk_id', bunkId).eq('sale_date', today).order('created_at', { ascending: false }),
      ]);
      setProducts(pRes.data as MedProduct[] || []);
      setCustomers(cRes.data as MedCustomer[] || []);
      setSales(sRes.data as MedSale[] || []);
      setLoading(false);
    })();
  }, [bunkId, today]);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.generic_name || '').toLowerCase().includes(search.toLowerCase()));
  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone || '').includes(customerSearch));

  const addToCart = (product: MedProduct) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1, total_amount: (i.quantity + 1) * i.selling_price } : i);
      return [...prev, { product_id: product.id, product_name: product.name, quantity: 1, mrp: product.mrp, selling_price: product.selling_price, gst_percent: product.gst_percent, discount_percent: 0, total_amount: product.selling_price }];
    });
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { setCart(c => c.filter(i => i.product_id !== productId)); return; }
    setCart(c => c.map(i => i.product_id === productId ? { ...i, quantity: qty, total_amount: qty * i.selling_price } : i));
  };

  const subtotal = cart.reduce((s, i) => s + i.total_amount, 0);
  const gstAmount = cart.reduce((s, i) => s + (i.total_amount * i.gst_percent / 100), 0);
  const total = subtotal - discount;

  const checkout = async () => {
    if (cart.length === 0) return;
    setSaving(true);
    const { data: sale, error } = await supabase.from('medical_sales').insert({
      bunk_id: bunkId, customer_id: selectedCustomer?.id || null, customer_name: selectedCustomer ? null : 'Walk-in',
      doctor_name: doctorName || null, sale_date: today, subtotal, gst_amount: gstAmount,
      discount_amount: discount, total_amount: total, paid_amount: paymentMode === 'credit' ? 0 : total,
      payment_mode: paymentMode, payment_status: paymentMode === 'credit' ? 'credit' : 'paid', entered_via: 'webapp',
    }).select().single();

    if (!error && sale) {
      await supabase.from('medical_sale_items').insert(cart.map(i => ({ ...i, sale_id: sale.id, bunk_id: bunkId })));
      for (const item of cart) {
        const batch = await supabase.from('medical_batches').select('id,quantity').eq('product_id', item.product_id).eq('bunk_id', bunkId).gt('quantity', 0).order('expiry_date').limit(1).maybeSingle();
        if (batch.data) await supabase.from('medical_batches').update({ quantity: batch.data.quantity - item.quantity }).eq('id', batch.data.id);
      }
      if (selectedCustomer && paymentMode === 'credit') {
        await supabase.from('medical_customers').update({ outstanding_amount: selectedCustomer.outstanding_amount + total, total_purchases: selectedCustomer.total_purchases + total }).eq('id', selectedCustomer.id);
      }
      setCart([]); setSelectedCustomer(null); setDoctorName(''); setDiscount(0); setPaymentMode('cash');
      setSales(prev => [sale as MedSale, ...prev]);
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={28} /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Product Search */}
      <div className="lg:col-span-2 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="Search medicine to add to bill..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
          {filteredProducts.slice(0, 30).map(p => (
            <button key={p.id} onClick={() => addToCart(p)} className="text-left bg-white border rounded-xl p-3 hover:bg-blue-50 hover:border-blue-300 transition-colors">
              <p className="font-medium text-sm text-gray-800 truncate">{p.name}</p>
              <p className="text-xs text-gray-500">{p.category}</p>
              <p className="text-sm font-bold text-blue-600 mt-1">{fmt(p.selling_price)}</p>
              <p className="text-xs text-gray-400">Stock: {p.current_stock} {p.unit}</p>
            </button>
          ))}
        </div>

        {/* Today's Bills */}
        <button onClick={() => setShowSales(!showSales)} className="flex items-center gap-2 text-sm text-blue-600 font-medium">
          {showSales ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Today's Bills ({sales.length})
        </button>
        {showSales && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {sales.map(s => (
              <div key={s.id} className="bg-white rounded-lg border px-4 py-2 flex justify-between text-sm">
                <div>
                  <p className="font-medium">{s.customer_name || 'Walk-in'}</p>
                  <p className="text-xs text-gray-400">{s.payment_mode} · {s.payment_status}</p>
                </div>
                <p className="font-bold text-gray-800">{fmt(s.total_amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart / Bill */}
      <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
        <h3 className="font-bold text-gray-800">Current Bill</h3>
        {/* Customer */}
        <div>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Search customer (optional)" value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null); }} />
          {customerSearch && !selectedCustomer && (
            <div className="border rounded-lg mt-1 max-h-36 overflow-y-auto">
              {filteredCustomers.map(c => (
                <div key={c.id} className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm" onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.name); }}>
                  <p>{c.name}</p><p className="text-xs text-gray-400">{c.phone}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Doctor name (optional)" value={doctorName} onChange={e => setDoctorName(e.target.value)} />

        {/* Cart Items */}
        <div className="space-y-2 min-h-16 max-h-48 overflow-y-auto">
          {cart.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">Add medicines above</p> : cart.map(item => (
            <div key={item.product_id} className="flex items-center gap-2 text-sm">
              <div className="flex-1"><p className="font-medium text-xs truncate">{item.product_name}</p><p className="text-xs text-gray-400">{fmt(item.selling_price)} each</p></div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.product_id, item.quantity - 1)} className="w-6 h-6 border rounded text-center">-</button>
                <span className="w-6 text-center text-xs">{item.quantity}</span>
                <button onClick={() => updateQty(item.product_id, item.quantity + 1)} className="w-6 h-6 border rounded text-center">+</button>
              </div>
              <span className="text-xs font-bold w-16 text-right">{fmt(item.total_amount)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmt(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">GST</span><span>{fmt(gstAmount)}</span></div>
          <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Discount</span><input type="number" className="w-20 border rounded px-2 py-0.5 text-xs text-right" value={discount} onChange={e => setDiscount(Number(e.target.value))} /></div>
          <div className="flex justify-between font-bold text-base"><span>Total</span><span>{fmt(total)}</span></div>
        </div>

        {/* Payment Mode */}
        <div className="grid grid-cols-2 gap-2">
          {(['cash', 'upi', 'card', 'credit'] as const).map(m => (
            <button key={m} onClick={() => setPaymentMode(m)} className={`py-1.5 rounded-lg text-xs font-medium border ${paymentMode === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        <button onClick={checkout} disabled={saving || cart.length === 0} className="w-full bg-green-600 text-white rounded-lg py-3 font-bold text-sm disabled:opacity-50">
          {saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : `Checkout — ${fmt(total)}`}
        </button>
      </div>
    </div>
  );
}

// ─── Customers Tab ────────────────────────────────────────────────────────────
function CustomersTab({ bunkId }: { bunkId: string }) {
  const [customers, setCustomers] = useState<MedCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showPayment, setShowPayment] = useState<MedCustomer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('medical_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name');
    setCustomers(data as MedCustomer[] || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search));

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="Search patients..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus size={16} /> Add Patient</button>
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div> : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold text-gray-800">{c.name}</p>
                <p className="text-xs text-gray-500">{c.phone || 'No phone'} {c.doctor_name ? `· Dr. ${c.doctor_name}` : ''}</p>
                {c.allergies && <p className="text-xs text-red-500 mt-0.5">⚠️ Allergy: {c.allergies}</p>}
              </div>
              <div className="text-right">
                {c.outstanding_amount > 0 ? (
                  <div>
                    <p className="font-bold text-red-600">{fmt(c.outstanding_amount)}</p>
                    <p className="text-xs text-gray-400">outstanding</p>
                    <button onClick={() => setShowPayment(c)} className="text-xs text-blue-600 underline">Collect</button>
                  </div>
                ) : (
                  <p className="text-xs text-green-600 font-medium">✓ Clear</p>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-gray-400 py-8">No patients found</p>}
        </div>
      )}

      {showAdd && <CustomerForm bunkId={bunkId} onClose={() => setShowAdd(false)} onSave={load} />}
      {showPayment && <PaymentForm bunkId={bunkId} customer={showPayment} onClose={() => setShowPayment(null)} onSave={load} />}
    </div>
  );
}

function CustomerForm({ bunkId, onClose, onSave }: { bunkId: string; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', address: '', doctor_name: '', allergies: '', credit_limit: 0 });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await supabase.from('medical_customers').insert({ ...form, bunk_id: bunkId, credit_limit: Number(form.credit_limit) });
    setSaving(false); onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-5 border-b"><h2 className="font-bold text-lg">Add Patient</h2><button onClick={onClose}><X size={20} /></button></div>
        <div className="p-5 space-y-3">
          <div><label className="text-xs text-gray-500">Name *</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Doctor Name</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.doctor_name} onChange={e => set('doctor_name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Known Allergies</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" placeholder="e.g. Penicillin, Sulfa" value={form.allergies} onChange={e => set('allergies', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Credit Limit (₹)</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.credit_limit} onChange={e => set('credit_limit', e.target.value)} /></div>
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">{saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Add Patient'}</button>
        </div>
      </div>
    </div>
  );
}

function PaymentForm({ bunkId, customer, onClose, onSave }: { bunkId: string; customer: MedCustomer; onClose: () => void; onSave: () => void }) {
  const [amount, setAmount] = useState(customer.outstanding_amount);
  const [mode, setMode] = useState('cash');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!amount || amount <= 0) return;
    setSaving(true);
    await supabase.from('medical_customer_payments').insert({ bunk_id: bunkId, customer_id: customer.id, amount: Number(amount), payment_mode: mode, payment_date: getTodayIST() });
    await supabase.from('medical_customers').update({ outstanding_amount: Math.max(0, customer.outstanding_amount - Number(amount)) }).eq('id', customer.id);
    setSaving(false); onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm">
        <div className="flex justify-between items-center p-5 border-b"><h2 className="font-bold text-lg">Collect Payment</h2><button onClick={onClose}><X size={20} /></button></div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-600"><b>{customer.name}</b> — Outstanding: <span className="text-red-600 font-bold">{fmt(customer.outstanding_amount)}</span></p>
          <div><label className="text-xs text-gray-500">Amount</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1" value={amount} onChange={e => setAmount(Number(e.target.value))} /></div>
          <div><label className="text-xs text-gray-500">Mode</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {['cash', 'upi', 'card'].map(m => <button key={m} onClick={() => setMode(m)} className={`py-1.5 rounded-lg text-xs font-medium border ${mode === m ? 'bg-blue-600 text-white' : ''}`}>{m.toUpperCase()}</button>)}
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium">{saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Purchases Tab ────────────────────────────────────────────────────────────
function PurchasesTab({ bunkId }: { bunkId: string }) {
  const today = getTodayIST();
  const [purchases, setPurchases] = useState<MedPurchase[]>([]);
  const [suppliers, setSuppliers] = useState<MedSupplier[]>([]);
  const [products, setProducts] = useState<MedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', invoice_number: '', purchase_date: today, total_amount: 0, payment_status: 'unpaid', notes: '' });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, sRes, prRes] = await Promise.all([
      supabase.from('medical_purchases').select('*, medical_suppliers(name)').eq('bunk_id', bunkId).order('purchase_date', { ascending: false }).limit(50),
      supabase.from('medical_suppliers').select('*').eq('bunk_id', bunkId).eq('is_active', true),
      supabase.from('medical_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
    ]);
    setPurchases(pRes.data as MedPurchase[] || []);
    setSuppliers(sRes.data as MedSupplier[] || []);
    setProducts(prRes.data as MedProduct[] || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.total_amount) return;
    await supabase.from('medical_purchases').insert({ ...form, bunk_id: bunkId, total_amount: Number(form.total_amount), supplier_id: form.supplier_id || null });
    setShowAdd(false); setForm({ supplier_id: '', invoice_number: '', purchase_date: today, total_amount: 0, payment_status: 'unpaid', notes: '' }); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-gray-800">Purchase History</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus size={16} /> New Purchase</button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
          <h3 className="font-semibold text-gray-700">New Purchase Entry</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Supplier</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)}><option value="">Walk-in / Unknown</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Invoice No.</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Date</label><input type="date" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Total Amount</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.total_amount} onChange={e => set('total_amount', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Payment</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.payment_status} onChange={e => set('payment_status', e.target.value)}><option value="paid">Paid</option><option value="unpaid">Unpaid (Credit)</option><option value="partial">Partial</option></select></div>
            <div><label className="text-xs text-gray-500">Notes</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAdd(false)} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
            <button onClick={save} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">Save Purchase</button>
          </div>
        </div>
      )}

      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div> : (
        <div className="space-y-2">
          {purchases.map(p => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">{(p as any).medical_suppliers?.name || 'Unknown Supplier'}</p>
                <p className="text-xs text-gray-500">Invoice: {p.invoice_number || '—'} · {p.purchase_date}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800">{fmt(p.total_amount)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.payment_status === 'paid' ? 'bg-green-100 text-green-700' : p.payment_status === 'partial' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{p.payment_status}</span>
              </div>
            </div>
          ))}
          {purchases.length === 0 && <p className="text-center text-gray-400 py-8">No purchases recorded</p>}
        </div>
      )}
    </div>
  );
}

// ─── Suppliers Tab ────────────────────────────────────────────────────────────
function SuppliersTab({ bunkId }: { bunkId: string }) {
  const [suppliers, setSuppliers] = useState<MedSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', email: '', address: '', drug_license: '', gstin: '' });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('medical_suppliers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name');
    setSuppliers(data as MedSupplier[] || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name.trim()) return;
    await supabase.from('medical_suppliers').insert({ ...form, bunk_id: bunkId });
    setShowAdd(false); setForm({ name: '', contact_name: '', phone: '', email: '', address: '', drug_license: '', gstin: '' }); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-gray-800">Suppliers / Distributors</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus size={16} /> Add Supplier</button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs text-gray-500">Company Name *</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Contact Person</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Drug License No.</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.drug_license} onChange={e => set('drug_license', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">GSTIN</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.gstin} onChange={e => set('gstin', e.target.value)} /></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAdd(false)} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
            <button onClick={save} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">Save</button>
          </div>
        </div>
      )}

      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div> : (
        <div className="space-y-2">
          {suppliers.map(s => (
            <div key={s.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.contact_name || ''} {s.phone ? `· ${s.phone}` : ''}</p>
                  {s.drug_license && <p className="text-xs text-gray-400">DL: {s.drug_license}</p>}
                </div>
                {s.outstanding_amount > 0 && (
                  <div className="text-right">
                    <p className="text-red-600 font-bold text-sm">{fmt(s.outstanding_amount)}</p>
                    <p className="text-xs text-gray-400">outstanding</p>
                  </div>
                )}
              </div>
            </div>
          ))}
          {suppliers.length === 0 && <p className="text-center text-gray-400 py-8">No suppliers added</p>}
        </div>
      )}
    </div>
  );
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────
function ExpensesTab({ bunkId }: { bunkId: string }) {
  const today = getTodayIST();
  const [expenses, setExpenses] = useState<MedExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: 'other', description: '', amount: 0, expense_date: today, payment_mode: 'cash', notes: '' });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('medical_expenses').select('*').eq('bunk_id', bunkId).order('expense_date', { ascending: false }).limit(60);
    setExpenses(data as MedExpense[] || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    await supabase.from('medical_expenses').insert({ ...form, bunk_id: bunkId, amount: Number(form.amount) });
    setShowAdd(false); setForm({ category: 'other', description: '', amount: 0, expense_date: today, payment_mode: 'cash', notes: '' }); load();
  };

  const totalThisMonth = expenses.filter(e => e.expense_date.startsWith(today.slice(0, 7))).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-bold text-gray-800">Expenses</h2>
          <p className="text-xs text-gray-500">This month: <b>{fmt(totalThisMonth)}</b></p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus size={16} /> Add Expense</button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.category} onChange={e => set('category', e.target.value)}>{EXP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Amount</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Description</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.description} onChange={e => set('description', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Date</label><input type="date" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} /></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAdd(false)} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
            <button onClick={save} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">Save</button>
          </div>
        </div>
      )}

      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div> : (
        <div className="space-y-2">
          {expenses.map(e => (
            <div key={e.id} className="bg-white rounded-xl shadow-sm p-4 flex justify-between">
              <div>
                <p className="font-medium text-gray-800 capitalize">{e.category}</p>
                <p className="text-xs text-gray-500">{e.description || '—'} · {e.expense_date}</p>
              </div>
              <p className="font-bold text-gray-800">{fmt(e.amount)}</p>
            </div>
          ))}
          {expenses.length === 0 && <p className="text-center text-gray-400 py-8">No expenses recorded</p>}
        </div>
      )}
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
function ReportsTab({ bunkId }: { bunkId: string }) {
  const today = getTodayIST();
  const [range, setRange] = useState<'today' | 'week' | 'month'>('today');
  const [data, setData] = useState({ sales: 0, cash: 0, upi: 0, credit: 0, bills: 0, expenses: 0, purchases: 0 });
  const [loading, setLoading] = useState(false);
  const [expiryReport, setExpiryReport] = useState<MedBatch[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date(today);
    let from = today;
    if (range === 'week') { const d = new Date(now); d.setDate(d.getDate() - 6); from = d.toISOString().slice(0, 10); }
    if (range === 'month') { from = today.slice(0, 7) + '-01'; }

    const [sRes, eRes, pRes, bRes] = await Promise.all([
      supabase.from('medical_sales').select('total_amount,payment_mode,payment_status').eq('bunk_id', bunkId).gte('sale_date', from).lte('sale_date', today),
      supabase.from('medical_expenses').select('amount').eq('bunk_id', bunkId).gte('expense_date', from).lte('expense_date', today),
      supabase.from('medical_purchases').select('total_amount').eq('bunk_id', bunkId).gte('purchase_date', from).lte('purchase_date', today),
      supabase.from('medical_batches').select('*, medical_products(name,unit)').eq('bunk_id', bunkId).gt('quantity', 0).lte('expiry_date', new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)).order('expiry_date'),
    ]);

    const sales = sRes.data || [];
    setData({
      sales: sales.reduce((s, r) => s + r.total_amount, 0),
      cash: sales.filter(r => r.payment_mode === 'cash').reduce((s, r) => s + r.total_amount, 0),
      upi: sales.filter(r => r.payment_mode === 'upi').reduce((s, r) => s + r.total_amount, 0),
      credit: sales.filter(r => r.payment_status === 'credit').reduce((s, r) => s + r.total_amount, 0),
      bills: sales.length,
      expenses: (eRes.data || []).reduce((s, e) => s + e.amount, 0),
      purchases: (pRes.data || []).reduce((s, p) => s + p.total_amount, 0),
    });
    setExpiryReport(bRes.data as MedBatch[] || []);
    setLoading(false);
  }, [bunkId, today, range]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(['today', 'week', 'month'] as const).map(r => (
          <button key={r} onClick={() => setRange(r)} className={`px-4 py-2 rounded-lg text-sm font-medium border ${range === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}>
            {r === 'today' ? 'Today' : r === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard icon={<TrendingUp size={18} />} label="Total Sales" value={fmt(data.sales)} sub={`${data.bills} bills`} color="border-green-500" />
            <StatCard icon={<DollarSign size={18} />} label="Cash" value={fmt(data.cash)} color="border-blue-500" />
            <StatCard icon={<Receipt size={18} />} label="UPI" value={fmt(data.upi)} color="border-purple-500" />
            <StatCard icon={<AlertCircle size={18} />} label="Credit Sales" value={fmt(data.credit)} color="border-orange-500" />
            <StatCard icon={<TrendingDown size={18} />} label="Expenses" value={fmt(data.expenses)} color="border-red-500" />
            <StatCard icon={<Truck size={18} />} label="Purchases" value={fmt(data.purchases)} color="border-gray-400" />
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="font-bold text-gray-700 mb-1">Net Profit</p>
            <p className={`text-3xl font-bold ${data.sales - data.expenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(data.sales - data.expenses)}</p>
          </div>

          {expiryReport.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-semibold text-orange-600 mb-3 flex items-center gap-2"><Clock size={16} /> Expiring Within 60 Days</h3>
              <div className="space-y-2">
                {expiryReport.map(b => {
                  const days = daysUntilExpiry(b.expiry_date);
                  return (
                    <div key={b.id} className="flex justify-between text-sm border-b pb-1">
                      <span>{(b as any).medical_products?.name}</span>
                      <span className="text-gray-500">Batch: {b.batch_number} | Qty: {b.quantity}</span>
                      <span className={days <= 0 ? 'text-red-600 font-bold' : days <= 30 ? 'text-orange-500' : 'text-yellow-600'}>{days <= 0 ? 'EXPIRED' : `${days}d`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main MedicalApp ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'inventory', label: 'Inventory', icon: Pill },
  { id: 'sales', label: 'Sales', icon: ShoppingCart },
  { id: 'customers', label: 'Patients', icon: Users },
  { id: 'purchases', label: 'Purchases', icon: Truck },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'suppliers', label: 'Suppliers', icon: Package },
];

export function MedicalApp({ bunkId }: { bunkId: string }) {
  const [tab, setTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
          <Pill size={18} className="text-white" />
        </div>
        <div>
          <h1 className="font-bold text-gray-900 text-lg">MedicalDesk AI</h1>
          <p className="text-xs text-gray-400">Medical Store Assistant</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white border-b overflow-x-auto">
        <div className="flex min-w-max px-2">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon size={15} />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-6xl mx-auto">
        {tab === 'dashboard' && <DashboardTab bunkId={bunkId} />}
        {tab === 'inventory' && <InventoryTab bunkId={bunkId} />}
        {tab === 'sales' && <SalesTab bunkId={bunkId} />}
        {tab === 'customers' && <CustomersTab bunkId={bunkId} />}
        {tab === 'purchases' && <PurchasesTab bunkId={bunkId} />}
        {tab === 'expenses' && <ExpensesTab bunkId={bunkId} />}
        {tab === 'reports' && <ReportsTab bunkId={bunkId} />}
        {tab === 'suppliers' && <SuppliersTab bunkId={bunkId} />}
      </div>
    </div>
  );
}
