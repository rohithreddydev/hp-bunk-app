// ElectricalDesk AI — Full Electrical Store Webapp (v1.0)
// Tabs: Dashboard | Inventory | Sales (POS) | Customers | Projects | Purchases | Expenses | Reports | Suppliers

import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap, Package, ShoppingCart, Users, Briefcase, Truck,
  Receipt, BarChart3, Plus, X, Search, AlertTriangle,
  ChevronDown, ChevronRight, Loader2, CheckCircle2,
  TrendingUp, TrendingDown, DollarSign, Edit2, Home,
  AlertCircle, Filter, Settings, LogOut, BookOpen,
  ArrowUpRight, ArrowDownLeft, Download, Printer, MessageCircle,
} from 'lucide-react';
import { supabase } from './supabase';
import { getTodayIST } from './utils';
import { SettingsTab } from './SettingsTab';
import { GSTInvoice, type GSTInvoiceProps } from './components/GSTInvoice';
import { InboxTab } from './InboxTab';
import { CampaignsTab } from './CampaignsTab';

const VITE_WEBHOOK_URL = (import.meta as any).env?.VITE_WEBHOOK_URL || '';
const VITE_CRON_SECRET = (import.meta as any).env?.VITE_CRON_SECRET || '';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ElecProduct {
  id: string; bunk_id: string; name: string; brand?: string; category: string;
  spec?: string; unit: string; gst_percent: number; mrp: number;
  selling_price: number; wholesale_price: number; purchase_price: number;
  current_stock: number; reorder_level: number; hsn_code?: string;
  is_active: boolean; created_at: string;
}
interface ElecSupplier {
  id: string; bunk_id: string; name: string; contact_name?: string;
  phone?: string; email?: string; address?: string; gstin?: string;
  outstanding_amount: number; is_active: boolean;
}
interface ElecCustomer {
  id: string; bunk_id: string; name: string; phone?: string;
  address?: string; customer_type: string; gstin?: string;
  credit_limit: number; outstanding_amount: number;
  total_purchases: number; is_active: boolean;
}
interface ElecProject {
  id: string; bunk_id: string; customer_id?: string; name: string;
  location?: string; status: string; start_date: string; end_date?: string;
  estimated_amount: number; billed_amount: number; notes?: string;
  electrical_customers?: { name: string; phone?: string };
}
interface ElecProjectItem {
  id: string; project_id: string; product_name: string; quantity: number;
  unit?: string; rate: number; total_amount: number; issued_date: string; notes?: string;
}
interface ElecSale {
  id: string; bunk_id: string; customer_id?: string; customer_name?: string;
  sale_date: string; subtotal: number; gst_amount: number; discount_amount: number;
  total_amount: number; paid_amount: number; payment_mode: string;
  payment_status: string; notes?: string; created_at: string;
}
interface ElecSaleItem {
  product_id?: string; product_name: string; quantity: number; unit?: string;
  mrp: number; selling_price: number; gst_percent: number;
  discount_percent: number; total_amount: number;
}
interface ElecPurchase {
  id: string; bunk_id: string; supplier_id?: string; invoice_number?: string;
  purchase_date: string; total_amount: number; payment_status: string;
  paid_amount: number; notes?: string;
  electrical_suppliers?: { name: string };
}
interface ElecExpense {
  id: string; bunk_id: string; category: string; description?: string;
  amount: number; expense_date: string; payment_mode: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CATEGORIES = ['wire', 'switch', 'socket', 'bulb', 'fan', 'mcb', 'cable', 'conduit', 'panel', 'db', 'fuse', 'meter', 'plug', 'tape', 'other'];
const UNITS = ['piece', 'meter', 'box', 'coil', 'set', 'roll', 'kg'];
const GST_SLABS = [5, 12, 18, 28];
const CUST_TYPES = ['retail', 'contractor', 'wholesale'];
const EXP_CATS = ['rent', 'salary', 'electricity', 'transport', 'tools', 'maintenance', 'other'];
const PROJ_STATUS = ['active', 'completed', 'on_hold'];

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

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardTab({ bunkId }: { bunkId: string }) {
  const today = getTodayIST();
  const [stats, setStats] = useState({ todaySales: 0, todayCash: 0, todayCredit: 0, bills: 0, outstanding: 0, lowStock: 0, activeProjects: 0 });
  const [lowStock, setLowStock] = useState<ElecProduct[]>([]);
  const [projects, setProjects] = useState<ElecProject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sRes, pRes, cRes, prRes] = await Promise.all([
      supabase.from('electrical_sales').select('total_amount,payment_mode,payment_status').eq('bunk_id', bunkId).eq('sale_date', today),
      supabase.from('electrical_products').select('*').eq('bunk_id', bunkId).eq('is_active', true),
      supabase.from('electrical_customers').select('outstanding_amount').eq('bunk_id', bunkId).eq('is_active', true),
      supabase.from('electrical_projects').select('*, electrical_customers(name,phone)').eq('bunk_id', bunkId).eq('status', 'active').order('created_at', { ascending: false }).limit(5),
    ]);
    const sales = sRes.data || [];
    const prods = pRes.data as ElecProduct[] || [];
    const low = prods.filter(p => Number(p.current_stock) <= Number(p.reorder_level));
    const outstanding = (cRes.data || []).reduce((s, c) => s + c.outstanding_amount, 0);
    setLowStock(low);
    setProjects(prRes.data as ElecProject[] || []);
    setStats({
      todaySales: sales.reduce((s, r) => s + r.total_amount, 0),
      todayCash: sales.filter(r => r.payment_mode === 'cash').reduce((s, r) => s + r.total_amount, 0),
      todayCredit: sales.filter(r => r.payment_status === 'credit').reduce((s, r) => s + r.total_amount, 0),
      bills: sales.length, outstanding, lowStock: low.length,
      activeProjects: (prRes.data || []).length,
    });
    setLoading(false);
  }, [bunkId, today]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`elec-dash-rt-${bunkId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'electrical_sales',    filter: `bunk_id=eq.${bunkId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'electrical_expenses', filter: `bunk_id=eq.${bunkId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bunkId, load]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-yellow-500" size={28} /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp size={20} />} label="Today's Sales" value={fmt(stats.todaySales)} sub={`${stats.bills} bills`} color="border-green-500" />
        <StatCard icon={<DollarSign size={20} />} label="Outstanding" value={fmt(stats.outstanding)} color="border-orange-500" />
        <StatCard icon={<Briefcase size={20} />} label="Active Projects" value={String(stats.activeProjects)} color="border-blue-500" />
        <StatCard icon={<AlertTriangle size={20} />} label="Low Stock" value={String(stats.lowStock)} sub="items" color="border-red-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-red-500" /> Low Stock Items</h3>
          {lowStock.length === 0 ? <p className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 size={14} /> All stock adequate</p> : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {lowStock.map(p => (
                <div key={p.id} className="flex justify-between bg-red-50 rounded-lg px-3 py-2 text-sm">
                  <div><p className="font-medium">{p.name}</p><p className="text-xs text-gray-500">{p.brand ? `${p.brand} · ` : ''}{p.spec || p.category}</p></div>
                  <div className="text-right"><p className="font-bold text-red-600">{p.current_stock} {p.unit}</p><p className="text-xs text-gray-400">min: {p.reorder_level}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Briefcase size={16} className="text-blue-500" /> Active Projects</h3>
          {projects.length === 0 ? <p className="text-sm text-gray-400">No active projects</p> : (
            <div className="space-y-2">
              {projects.map(p => (
                <div key={p.id} className="bg-blue-50 rounded-lg px-3 py-2 text-sm">
                  <p className="font-medium text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-500">{(p as any).electrical_customers?.name || 'Unknown'} {p.location ? `· ${p.location}` : ''}</p>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-blue-600">Est: {fmt(p.estimated_amount)}</span>
                    <span className="text-xs text-green-600">Billed: {fmt(p.billed_amount)}</span>
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
  const [products, setProducts] = useState<ElecProduct[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ElecProduct | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('electrical_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name');
    setProducts(data as ElecProduct[] || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand || '').toLowerCase().includes(search.toLowerCase()) || (p.spec || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || p.category === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => { setEditing(null); setShowAdd(true); }} className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-600">
          <Plus size={16} /> Add Item
        </button>
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-yellow-500" /></div> : (
        <div className="space-y-2">
          {filtered.map(p => {
            const isLow = Number(p.current_stock) <= Number(p.reorder_level);
            return (
              <div key={p.id} className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{p.name}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{p.category}</span>
                    {p.brand && <span className="text-xs text-gray-400">{p.brand}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{p.spec || ''} · GST {p.gst_percent}% · MRP {fmt(p.mrp)} · Sell {fmt(p.selling_price)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`font-bold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{p.current_stock} {p.unit}</p>
                    {isLow && <p className="text-xs text-red-500">Low Stock</p>}
                  </div>
                  <button onClick={() => { setEditing(p); setShowAdd(true); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-gray-400 py-8">No items found</p>}
        </div>
      )}

      {showAdd && <ProductForm bunkId={bunkId} product={editing} onClose={() => setShowAdd(false)} onSave={load} />}
    </div>
  );
}

function ProductForm({ bunkId, product, onClose, onSave }: { bunkId: string; product: ElecProduct | null; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    name: product?.name || '', brand: product?.brand || '', category: product?.category || 'wire',
    spec: product?.spec || '', unit: product?.unit || 'piece', gst_percent: product?.gst_percent ?? 18,
    mrp: product?.mrp || 0, selling_price: product?.selling_price || 0,
    wholesale_price: product?.wholesale_price || 0, purchase_price: product?.purchase_price || 0,
    current_stock: product?.current_stock || 0, reorder_level: product?.reorder_level || 5, hsn_code: product?.hsn_code || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId, mrp: Number(form.mrp), selling_price: Number(form.selling_price), wholesale_price: Number(form.wholesale_price), purchase_price: Number(form.purchase_price), current_stock: Number(form.current_stock), reorder_level: Number(form.reorder_level), gst_percent: Number(form.gst_percent) };
    if (product) await supabase.from('electrical_products').update(payload).eq('id', product.id);
    else await supabase.from('electrical_products').insert(payload);
    setSaving(false); onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="font-bold text-lg">{product ? 'Edit Item' : 'Add Electrical Item'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs text-gray-500">Item Name *</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Finolex 2.5 sqmm Wire" /></div>
            <div><label className="text-xs text-gray-500">Brand</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Finolex, Anchor, Havells..." /></div>
            <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Spec / Rating</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.spec} onChange={e => set('spec', e.target.value)} placeholder="2.5sqmm, 6A, 18W..." /></div>
            <div><label className="text-xs text-gray-500">Unit</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.unit} onChange={e => set('unit', e.target.value)}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">GST %</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.gst_percent} onChange={e => set('gst_percent', e.target.value)}>{GST_SLABS.map(g => <option key={g} value={g}>{g}%</option>)}</select></div>
            <div><label className="text-xs text-gray-500">MRP (₹)</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.mrp} onChange={e => set('mrp', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Selling Price</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.selling_price} onChange={e => set('selling_price', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Wholesale Price</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.wholesale_price} onChange={e => set('wholesale_price', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Purchase Price</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.purchase_price} onChange={e => set('purchase_price', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Opening Stock</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.current_stock} onChange={e => set('current_stock', e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Reorder Level</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)} /></div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-yellow-500 text-white rounded-lg py-2 text-sm font-medium">
            {saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sales POS ────────────────────────────────────────────────────────────────
function SalesTab({ bunkId }: { bunkId: string }) {
  const today = getTodayIST();
  const [products, setProducts] = useState<ElecProduct[]>([]);
  const [customers, setCustomers] = useState<ElecCustomer[]>([]);
  const [sales, setSales] = useState<ElecSale[]>([]);
  const [cart, setCart] = useState<ElecSaleItem[]>([]);
  const [search, setSearch] = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [selectedCust, setSelectedCust] = useState<ElecCustomer | null>(null);
  const [payMode, setPayMode] = useState<'cash' | 'upi' | 'card' | 'credit'>('cash');
  const [discount, setDiscount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showBills, setShowBills] = useState(false);
  const [custPricing, setCustPricing] = useState<'retail' | 'wholesale'>('retail');
  const [invoiceProps, setInvoiceProps] = useState<GSTInvoiceProps | null>(null);

  useEffect(() => {
    (async () => {
      const [pRes, cRes, sRes] = await Promise.all([
        supabase.from('electrical_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).gt('current_stock', 0).order('name'),
        supabase.from('electrical_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
        supabase.from('electrical_sales').select('*').eq('bunk_id', bunkId).eq('sale_date', today).order('created_at', { ascending: false }),
      ]);
      setProducts(pRes.data as ElecProduct[] || []);
      setCustomers(cRes.data as ElecCustomer[] || []);
      setSales(sRes.data as ElecSale[] || []);
      setLoading(false);
    })();
  }, [bunkId, today]);

  const filteredProds = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand || '').toLowerCase().includes(search.toLowerCase()) || (p.spec || '').toLowerCase().includes(search.toLowerCase()));
  const filteredCusts = customers.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase()) || (c.phone || '').includes(custSearch));

  const addToCart = (p: ElecProduct) => {
    const price = custPricing === 'wholesale' && p.wholesale_price > 0 ? p.wholesale_price : p.selling_price;
    setCart(prev => {
      const ex = prev.find(i => i.product_id === p.id);
      if (ex) return prev.map(i => i.product_id === p.id ? { ...i, quantity: i.quantity + 1, total_amount: (i.quantity + 1) * i.selling_price } : i);
      return [...prev, { product_id: p.id, product_name: p.name, quantity: 1, unit: p.unit, mrp: p.mrp, selling_price: price, gst_percent: p.gst_percent, discount_percent: 0, total_amount: price }];
    });
  };

  const updateQty = (pid: string, qty: number) => {
    if (qty <= 0) { setCart(c => c.filter(i => i.product_id !== pid)); return; }
    setCart(c => c.map(i => i.product_id === pid ? { ...i, quantity: qty, total_amount: qty * i.selling_price } : i));
  };

  const subtotal = cart.reduce((s, i) => s + i.total_amount, 0);
  const gstAmt = cart.reduce((s, i) => s + (i.total_amount * i.gst_percent / (100 + i.gst_percent)), 0);
  const total = subtotal - discount;

  const openInvoice = async (s: ElecSale) => {
    const [itemsRes, storeRes] = await Promise.all([
      supabase.from('electrical_sale_items').select('*').eq('sale_id', s.id),
      supabase.from('bunks').select('name, gstin, address, phone').eq('id', bunkId).maybeSingle(),
    ]);
    const items = (itemsRes.data || []) as ElecSaleItem[];
    const store = storeRes.data as { name?: string; gstin?: string; address?: string; phone?: string } | null;
    setInvoiceProps({
      storeName: store?.name || 'Store',
      storeGSTIN: store?.gstin || undefined,
      storeAddress: store?.address || undefined,
      storePhone: store?.phone || undefined,
      invoiceNumber: `INV-${s.id.slice(-6).toUpperCase()}`,
      invoiceDate: s.sale_date,
      customerName: s.customer_name || (s.customer_id ? customers.find(c => c.id === s.customer_id)?.name : undefined) || 'Walk-in',
      customerGSTIN: s.customer_id ? customers.find(c => c.id === s.customer_id)?.gstin : undefined,
      customerAddress: s.customer_id ? customers.find(c => c.id === s.customer_id)?.address : undefined,
      items: items.map(i => ({
        description: i.product_name,
        qty: i.quantity,
        unit: i.unit || 'pcs',
        rate: i.selling_price,
        gstPct: i.gst_percent,
        amount: i.total_amount,
      })),
      paymentMode: s.payment_mode,
      notes: s.notes || undefined,
      onClose: () => setInvoiceProps(null),
    });
  };

  const checkout = async () => {
    if (!cart.length) return;
    setSaving(true);
    const { data: sale, error } = await supabase.from('electrical_sales').insert({
      bunk_id: bunkId, customer_id: selectedCust?.id || null,
      customer_name: selectedCust ? null : 'Walk-in', sale_date: today,
      subtotal, gst_amount: gstAmt, discount_amount: discount, total_amount: total,
      paid_amount: payMode === 'credit' ? 0 : total, payment_mode: payMode,
      payment_status: payMode === 'credit' ? 'credit' : 'paid', entered_via: 'webapp',
    }).select().single();

    if (!error && sale) {
      await supabase.from('electrical_sale_items').insert(cart.map(i => ({ ...i, sale_id: sale.id, bunk_id: bunkId })));
      if (selectedCust && payMode === 'credit') {
        await supabase.from('electrical_customers').update({ outstanding_amount: selectedCust.outstanding_amount + total, total_purchases: selectedCust.total_purchases + total }).eq('id', selectedCust.id);
      }
      setCart([]); setSelectedCust(null); setCustSearch(''); setDiscount(0); setPayMode('cash');
      setSales(p => [sale as ElecSale, ...p]);
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-yellow-500" size={28} /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="Search electrical items..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1">
            {(['retail', 'wholesale'] as const).map(t => (
              <button key={t} onClick={() => setCustPricing(t)} className={`px-3 py-2 text-xs font-medium rounded-lg border ${custPricing === t ? 'bg-yellow-500 text-white' : 'text-gray-600'}`}>{t}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
          {filteredProds.slice(0, 30).map(p => {
            const price = custPricing === 'wholesale' && p.wholesale_price > 0 ? p.wholesale_price : p.selling_price;
            return (
              <button key={p.id} onClick={() => addToCart(p)} className="text-left bg-white border rounded-xl p-3 hover:bg-yellow-50 hover:border-yellow-400 transition-colors">
                <p className="font-medium text-sm text-gray-800 truncate">{p.name}</p>
                <p className="text-xs text-gray-400">{p.brand || ''} {p.spec ? `· ${p.spec}` : ''}</p>
                <p className="text-sm font-bold text-yellow-600 mt-1">{fmt(price)}<span className="text-xs font-normal text-gray-400">/{p.unit}</span></p>
                <p className="text-xs text-gray-400">Stock: {p.current_stock} {p.unit}</p>
              </button>
            );
          })}
        </div>
        <button onClick={() => setShowBills(!showBills)} className="flex items-center gap-2 text-sm text-yellow-600 font-medium">
          {showBills ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Today's Bills ({sales.length})
        </button>
        {showBills && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {sales.map(s => (
              <div key={s.id} className="bg-white rounded-lg border px-4 py-2 flex justify-between items-center text-sm">
                <div><p className="font-medium">{s.customer_name || 'Walk-in'}</p><p className="text-xs text-gray-400">{s.payment_mode} · {s.payment_status}</p></div>
                <div className="flex items-center gap-2">
                  <p className="font-bold">{fmt(s.total_amount)}</p>
                  <button onClick={() => openInvoice(s)} title="Print Invoice" className="p-1.5 rounded-lg hover:bg-yellow-100 text-yellow-600 transition">
                    <Printer size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {invoiceProps && <GSTInvoice {...invoiceProps} />}
      </div>

      {/* Cart */}
      <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
        <h3 className="font-bold text-gray-800">Current Bill</h3>
        <div>
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Search customer / contractor..." value={custSearch} onChange={e => { setCustSearch(e.target.value); setSelectedCust(null); }} />
          {custSearch && !selectedCust && (
            <div className="border rounded-lg mt-1 max-h-32 overflow-y-auto">
              {filteredCusts.map(c => (
                <div key={c.id} className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm" onClick={() => { setSelectedCust(c); setCustSearch(c.name); setCustPricing(c.customer_type === 'wholesale' || c.customer_type === 'contractor' ? 'wholesale' : 'retail'); }}>
                  <p>{c.name} <span className="text-xs text-gray-400 capitalize">({c.customer_type})</span></p>
                  {c.outstanding_amount > 0 && <p className="text-xs text-red-500">Due: {fmt(c.outstanding_amount)}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 min-h-12 max-h-52 overflow-y-auto">
          {cart.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">Add items above</p> : cart.map(item => (
            <div key={item.product_id} className="flex items-center gap-2 text-sm">
              <div className="flex-1"><p className="font-medium text-xs truncate">{item.product_name}</p><p className="text-xs text-gray-400">{fmt(item.selling_price)}/{item.unit}</p></div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.product_id!, item.quantity - 1)} className="w-6 h-6 border rounded text-center">-</button>
                <span className="w-8 text-center text-xs">{item.quantity}</span>
                <button onClick={() => updateQty(item.product_id!, item.quantity + 1)} className="w-6 h-6 border rounded text-center">+</button>
              </div>
              <span className="text-xs font-bold w-16 text-right">{fmt(item.total_amount)}</span>
            </div>
          ))}
        </div>

        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmt(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">GST (incl.)</span><span>{fmt(gstAmt)}</span></div>
          <div className="flex items-center justify-between gap-2"><span className="text-gray-500">Discount</span><input type="number" className="w-20 border rounded px-2 py-0.5 text-xs text-right" value={discount} onChange={e => setDiscount(Number(e.target.value))} /></div>
          <div className="flex justify-between font-bold text-base"><span>Total</span><span>{fmt(total)}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['cash', 'upi', 'card', 'credit'] as const).map(m => (
            <button key={m} onClick={() => setPayMode(m)} className={`py-1.5 rounded-lg text-xs font-medium border ${payMode === m ? 'bg-yellow-500 text-white border-yellow-500' : 'text-gray-600'}`}>{m.toUpperCase()}</button>
          ))}
        </div>

        <button onClick={checkout} disabled={saving || !cart.length} className="w-full bg-green-600 text-white rounded-lg py-3 font-bold text-sm disabled:opacity-50">
          {saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : `Checkout — ${fmt(total)}`}
        </button>
      </div>
    </div>
  );
}

// ─── Customers Tab ────────────────────────────────────────────────────────────
function CustomersTab({ bunkId }: { bunkId: string }) {
  const [customers, setCustomers] = useState<ElecCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showPayment, setShowPayment] = useState<ElecCustomer | null>(null);
  const [ledgerCust, setLedgerCust] = useState<ElecCustomer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('electrical_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name');
    setCustomers(data as ElecCustomer[] || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search));

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-gray-400" /><input className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="Search customers / contractors..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus size={16} /> Add Customer</button>
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-yellow-500" /></div> : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800">{c.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${c.customer_type === 'contractor' ? 'bg-blue-100 text-blue-700' : c.customer_type === 'wholesale' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{c.customer_type}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{c.phone || 'No phone'}</p>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                {c.outstanding_amount > 0 ? (
                  <div className="text-right">
                    <p className="font-bold text-red-600">{fmt(c.outstanding_amount)}</p>
                    <button onClick={() => setShowPayment(c)} className="text-xs text-blue-600 underline">Collect</button>
                  </div>
                ) : <p className="text-xs text-green-600 font-medium">✓ Clear</p>}
                <button onClick={() => setLedgerCust(c)} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium hover:bg-blue-200 flex items-center gap-1 mt-1"><BookOpen size={10} />Ledger</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-gray-400 py-8">No customers found</p>}
        </div>
      )}

      {showAdd && <CustomerForm bunkId={bunkId} onClose={() => setShowAdd(false)} onSave={load} />}
      {showPayment && <CustPaymentForm bunkId={bunkId} customer={showPayment} onClose={() => setShowPayment(null)} onSave={load} />}
      {ledgerCust && <ElecLedgerModal bunkId={bunkId} customer={ledgerCust} onClose={() => setLedgerCust(null)} />}
    </div>
  );
}

function ElecLedgerModal({ bunkId, customer, onClose }: { bunkId: string; customer: ElecCustomer; onClose: () => void }) {
  interface LedgerRow { id: string; date: string; type: 'sale' | 'payment'; description: string; debit: number; credit: number; balance: number; }
  const [entries, setEntries] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [salesRes, paymentsRes] = await Promise.all([
        supabase.from('electrical_sales').select('id, sale_date, total_amount, payment_status').eq('bunk_id', bunkId).eq('customer_id', customer.id).order('sale_date'),
        supabase.from('electrical_customer_payments').select('id, payment_date, amount, payment_mode').eq('bunk_id', bunkId).eq('customer_id', customer.id).order('payment_date'),
      ]);
      const raw: { date: string; type: 'sale' | 'payment'; id: string; amount: number; mode: string }[] = [
        ...(salesRes.data || []).map((s: { id: string; sale_date: string; total_amount: number; payment_status: string }) => ({ date: s.sale_date, type: 'sale' as const, id: s.id, amount: s.total_amount, mode: s.payment_status })),
        ...(paymentsRes.data || []).map((p: { id: string; payment_date: string; amount: number; payment_mode: string }) => ({ date: p.payment_date, type: 'payment' as const, id: p.id, amount: p.amount, mode: p.payment_mode })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      let balance = 0;
      const ledger: LedgerRow[] = raw.map(r => {
        if (r.type === 'sale' && r.mode === 'credit') { balance += r.amount; return { id: r.id, date: r.date, type: 'sale', description: 'Credit Sale', debit: r.amount, credit: 0, balance }; }
        if (r.type === 'sale') { return { id: r.id, date: r.date, type: 'sale', description: 'Cash/UPI Sale', debit: 0, credit: 0, balance }; }
        balance -= r.amount; if (balance < 0) balance = 0;
        return { id: r.id, date: r.date, type: 'payment', description: `Payment (${r.mode})`, debit: 0, credit: r.amount, balance };
      });
      setEntries(ledger);
      setLoading(false);
    }
    load();
  }, [bunkId, customer.id]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div><h2 className="text-lg font-semibold">{customer.name} — Ledger</h2><p className="text-sm text-red-600">Outstanding: {fmt(customer.outstanding_amount)}</p></div>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? <div className="flex justify-center items-center h-32"><Loader2 className="animate-spin text-yellow-500" size={24} /></div> : entries.length === 0 ? <p className="text-center text-gray-400 py-12">No transactions found.</p> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase sticky top-0">
                <tr><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Description</th><th className="px-4 py-2 text-right text-red-600">Debit</th><th className="px-4 py-2 text-right text-green-600">Credit</th><th className="px-4 py-2 text-right">Balance</th></tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{e.date}</td>
                    <td className="px-4 py-2"><span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${e.type === 'sale' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{e.type === 'sale' ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}{e.description}</span></td>
                    <td className="px-4 py-2 text-right text-red-600 font-medium">{e.debit > 0 ? fmt(e.debit) : '—'}</td>
                    <td className="px-4 py-2 text-right text-green-600 font-medium">{e.credit > 0 ? fmt(e.credit) : '—'}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${e.balance > 0 ? 'text-red-600' : 'text-gray-500'}`}>{fmt(e.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-4 border-t flex justify-end"><button onClick={onClose} className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Close</button></div>
      </div>
    </div>
  );
}

function CustomerForm({ bunkId, onClose, onSave }: { bunkId: string; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', address: '', customer_type: 'retail', gstin: '', credit_limit: 0 });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await supabase.from('electrical_customers').insert({ ...form, bunk_id: bunkId, credit_limit: Number(form.credit_limit) });
    setSaving(false); onSave(); onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-5 border-b"><h2 className="font-bold text-lg">Add Customer</h2><button onClick={onClose}><X size={20} /></button></div>
        <div className="p-5 space-y-3">
          <div><label className="text-xs text-gray-500">Name *</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Type</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.customer_type} onChange={e => set('customer_type', e.target.value)}>{CUST_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">GSTIN (for B2B)</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.gstin} onChange={e => set('gstin', e.target.value)} /></div>
          <div><label className="text-xs text-gray-500">Credit Limit (₹)</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.credit_limit} onChange={e => set('credit_limit', e.target.value)} /></div>
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-yellow-500 text-white rounded-lg py-2 text-sm font-medium">{saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Add'}</button>
        </div>
      </div>
    </div>
  );
}

function CustPaymentForm({ bunkId, customer, onClose, onSave }: { bunkId: string; customer: ElecCustomer; onClose: () => void; onSave: () => void }) {
  const [amount, setAmount] = useState(customer.outstanding_amount);
  const [mode, setMode] = useState('cash');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    await supabase.from('electrical_customer_payments').insert({ bunk_id: bunkId, customer_id: customer.id, amount: Number(amount), payment_mode: mode, payment_date: getTodayIST() });
    await supabase.from('electrical_customers').update({ outstanding_amount: Math.max(0, customer.outstanding_amount - Number(amount)) }).eq('id', customer.id);
    setSaving(false); onSave(); onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm">
        <div className="flex justify-between items-center p-5 border-b"><h2 className="font-bold text-lg">Collect Payment</h2><button onClick={onClose}><X size={20} /></button></div>
        <div className="p-5 space-y-3">
          <p className="text-sm"><b>{customer.name}</b> — Due: <span className="text-red-600 font-bold">{fmt(customer.outstanding_amount)}</span></p>
          <div><label className="text-xs text-gray-500">Amount</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1" value={amount} onChange={e => setAmount(Number(e.target.value))} /></div>
          <div className="grid grid-cols-3 gap-2">{['cash', 'upi', 'card'].map(m => <button key={m} onClick={() => setMode(m)} className={`py-1.5 rounded-lg text-xs font-medium border ${mode === m ? 'bg-yellow-500 text-white' : ''}`}>{m.toUpperCase()}</button>)}</div>
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium">{saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Projects Tab ─────────────────────────────────────────────────────────────
function ProjectsTab({ bunkId }: { bunkId: string }) {
  const today = getTodayIST();
  const [projects, setProjects] = useState<ElecProject[]>([]);
  const [customers, setCustomers] = useState<ElecCustomer[]>([]);
  const [products, setProducts] = useState<ElecProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [projectItems, setProjectItems] = useState<Record<string, ElecProjectItem[]>>({});
  const [addMaterialFor, setAddMaterialFor] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', customer_id: '', location: '', estimated_amount: 0, start_date: today });
  const [matForm, setMatForm] = useState({ product_id: '', product_name: '', quantity: 1, unit: 'piece', rate: 0, notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, cRes, prRes] = await Promise.all([
      supabase.from('electrical_projects').select('*, electrical_customers(name,phone)').eq('bunk_id', bunkId).order('created_at', { ascending: false }),
      supabase.from('electrical_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('electrical_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
    ]);
    setProjects(pRes.data as ElecProject[] || []);
    setCustomers(cRes.data as ElecCustomer[] || []);
    setProducts(prRes.data as ElecProduct[] || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const loadItems = async (projectId: string) => {
    if (projectItems[projectId]) return;
    const { data } = await supabase.from('electrical_project_items').select('*').eq('project_id', projectId).order('issued_date');
    setProjectItems(p => ({ ...p, [projectId]: data as ElecProjectItem[] || [] }));
  };

  const saveProject = async () => {
    if (!form.name.trim()) return;
    await supabase.from('electrical_projects').insert({ ...form, bunk_id: bunkId, estimated_amount: Number(form.estimated_amount), customer_id: form.customer_id || null });
    setShowAdd(false); setForm({ name: '', customer_id: '', location: '', estimated_amount: 0, start_date: today }); load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('electrical_projects').update({ status, ...(status === 'completed' ? { end_date: today } : {}) }).eq('id', id);
    setProjects(p => p.map(pr => pr.id === id ? { ...pr, status } : pr));
  };

  const addMaterial = async (projectId: string) => {
    if (!matForm.product_name || !matForm.quantity) return;
    const total = Number(matForm.quantity) * Number(matForm.rate);
    await supabase.from('electrical_project_items').insert({ ...matForm, bunk_id: bunkId, project_id: projectId, quantity: Number(matForm.quantity), rate: Number(matForm.rate), total_amount: total, issued_date: today, product_id: matForm.product_id || null });
    await supabase.from('electrical_projects').update({ billed_amount: (projects.find(p => p.id === projectId)?.billed_amount || 0) + total }).eq('id', projectId);
    setMatForm({ product_id: '', product_name: '', quantity: 1, unit: 'piece', rate: 0, notes: '' });
    setAddMaterialFor(null);
    setProjectItems(p => ({ ...p, [projectId]: undefined as any }));
    load();
  };

  const statusColor = (s: string) => s === 'active' ? 'bg-green-100 text-green-700' : s === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-gray-800">Contractor Projects</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus size={16} /> New Project</button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs text-gray-500">Project Name *</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" placeholder="Ravi 3BHK Wiring - Kondapur" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500">Customer</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}><option value="">Walk-in / Unknown</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Location</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500">Estimated Value</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.estimated_amount} onChange={e => setForm(f => ({ ...f, estimated_amount: Number(e.target.value) }))} /></div>
            <div><label className="text-xs text-gray-500">Start Date</label><input type="date" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
          </div>
          <div className="flex gap-3"><button onClick={() => setShowAdd(false)} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button><button onClick={saveProject} className="flex-1 bg-yellow-500 text-white rounded-lg py-2 text-sm">Save Project</button></div>
        </div>
      )}

      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-yellow-500" /></div> : (
        <div className="space-y-3">
          {projects.map(p => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border">
              <div className="p-4 flex justify-between items-start cursor-pointer" onClick={() => { setExpanded(expanded === p.id ? null : p.id); if (expanded !== p.id) loadItems(p.id); }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800">{p.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>{p.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{(p as any).electrical_customers?.name || 'Unknown'} {p.location ? `· ${p.location}` : ''} · Started {p.start_date}</p>
                  <div className="flex gap-4 mt-1 text-xs">
                    <span className="text-gray-500">Est: <b>{fmt(p.estimated_amount)}</b></span>
                    <span className="text-blue-600">Billed: <b>{fmt(p.billed_amount)}</b></span>
                    <span className={p.billed_amount > p.estimated_amount ? 'text-red-500' : 'text-green-600'}>Remaining: <b>{fmt(p.estimated_amount - p.billed_amount)}</b></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select className="text-xs border rounded-lg px-2 py-1" value={p.status} onClick={e => e.stopPropagation()} onChange={e => updateStatus(p.id, e.target.value)}>{PROJ_STATUS.map(s => <option key={s} value={s}>{s}</option>)}</select>
                  {expanded === p.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
              </div>

              {expanded === p.id && (
                <div className="border-t px-4 pb-4">
                  <div className="flex justify-between items-center mt-3 mb-2">
                    <p className="text-xs font-semibold text-gray-500">MATERIALS ISSUED</p>
                    <button onClick={() => setAddMaterialFor(addMaterialFor === p.id ? null : p.id)} className="text-xs bg-yellow-500 text-white px-3 py-1 rounded-lg flex items-center gap-1"><Plus size={12} /> Add Material</button>
                  </div>
                  {addMaterialFor === p.id && (
                    <div className="bg-yellow-50 rounded-lg p-3 mb-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <select className="w-full border rounded-lg px-3 py-2 text-sm" value={matForm.product_id} onChange={e => {
                            const prod = products.find(pr => pr.id === e.target.value);
                            setMatForm(f => ({ ...f, product_id: e.target.value, product_name: prod?.name || '', unit: prod?.unit || 'piece', rate: prod?.selling_price || 0 }));
                          }}>
                            <option value="">Select item or type below</option>
                            {products.map(pr => <option key={pr.id} value={pr.id}>{pr.name} ({pr.current_stock} {pr.unit})</option>)}
                          </select>
                        </div>
                        {!matForm.product_id && <div className="col-span-2"><input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Item name (manual)" value={matForm.product_name} onChange={e => setMatForm(f => ({ ...f, product_name: e.target.value }))} /></div>}
                        <div><input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Quantity" value={matForm.quantity} onChange={e => setMatForm(f => ({ ...f, quantity: Number(e.target.value) }))} /></div>
                        <div><input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Rate (₹)" value={matForm.rate} onChange={e => setMatForm(f => ({ ...f, rate: Number(e.target.value) }))} /></div>
                      </div>
                      <p className="text-xs text-gray-500">Total: <b>{fmt(matForm.quantity * matForm.rate)}</b></p>
                      <div className="flex gap-2"><button onClick={() => setAddMaterialFor(null)} className="flex-1 border rounded-lg py-1.5 text-xs">Cancel</button><button onClick={() => addMaterial(p.id)} className="flex-1 bg-yellow-500 text-white rounded-lg py-1.5 text-xs">Add</button></div>
                    </div>
                  )}
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {(projectItems[p.id] || []).map(it => (
                      <div key={it.id} className="flex justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                        <span className="font-medium text-gray-700">{it.product_name}</span>
                        <span className="text-gray-500">{it.quantity} {it.unit} × {fmt(it.rate)}</span>
                        <span className="font-bold text-gray-800">{fmt(it.total_amount)}</span>
                        <span className="text-gray-400">{it.issued_date}</span>
                      </div>
                    ))}
                    {(projectItems[p.id] || []).length === 0 && <p className="text-xs text-gray-400 py-2">No materials issued yet</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
          {projects.length === 0 && <p className="text-center text-gray-400 py-8">No projects created</p>}
        </div>
      )}
    </div>
  );
}

// ─── Purchases Tab ────────────────────────────────────────────────────────────
function PurchasesTab({ bunkId }: { bunkId: string }) {
  const today = getTodayIST();
  const [purchases, setPurchases] = useState<ElecPurchase[]>([]);
  const [suppliers, setSuppliers] = useState<ElecSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', invoice_number: '', purchase_date: today, total_amount: 0, payment_status: 'unpaid', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, sRes] = await Promise.all([
      supabase.from('electrical_purchases').select('*, electrical_suppliers(name)').eq('bunk_id', bunkId).order('purchase_date', { ascending: false }).limit(50),
      supabase.from('electrical_suppliers').select('*').eq('bunk_id', bunkId).eq('is_active', true),
    ]);
    setPurchases(pRes.data as ElecPurchase[] || []);
    setSuppliers(sRes.data as ElecSupplier[] || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.total_amount) return;
    await supabase.from('electrical_purchases').insert({ ...form, bunk_id: bunkId, total_amount: Number(form.total_amount), supplier_id: form.supplier_id || null });
    setShowAdd(false); setForm({ supplier_id: '', invoice_number: '', purchase_date: today, total_amount: 0, payment_status: 'unpaid', notes: '' }); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-gray-800">Purchase History</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus size={16} /> New Purchase</button>
      </div>
      {showAdd && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Supplier</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}><option value="">Unknown</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Invoice No.</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500">Date</label><input type="date" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500">Total Amount</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: Number(e.target.value) }))} /></div>
            <div><label className="text-xs text-gray-500">Payment</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="partial">Partial</option></select></div>
          </div>
          <div className="flex gap-3"><button onClick={() => setShowAdd(false)} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button><button onClick={save} className="flex-1 bg-yellow-500 text-white rounded-lg py-2 text-sm">Save</button></div>
        </div>
      )}
      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-yellow-500" /></div> : (
        <div className="space-y-2">
          {purchases.map(p => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm p-4 flex justify-between">
              <div><p className="font-semibold">{(p as any).electrical_suppliers?.name || 'Unknown Supplier'}</p><p className="text-xs text-gray-500">Invoice: {p.invoice_number || '—'} · {p.purchase_date}</p></div>
              <div className="text-right"><p className="font-bold">{fmt(p.total_amount)}</p><span className={`text-xs px-2 py-0.5 rounded-full ${p.payment_status === 'paid' ? 'bg-green-100 text-green-700' : p.payment_status === 'partial' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{p.payment_status}</span></div>
            </div>
          ))}
          {purchases.length === 0 && <p className="text-center text-gray-400 py-8">No purchases yet</p>}
        </div>
      )}
    </div>
  );
}

// ─── Suppliers Tab ────────────────────────────────────────────────────────────
function SuppliersTab({ bunkId }: { bunkId: string }) {
  const [suppliers, setSuppliers] = useState<ElecSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', email: '', address: '', gstin: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('electrical_suppliers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name');
    setSuppliers(data as ElecSupplier[] || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name.trim()) return;
    await supabase.from('electrical_suppliers').insert({ ...form, bunk_id: bunkId });
    setShowAdd(false); setForm({ name: '', contact_name: '', phone: '', email: '', address: '', gstin: '' }); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-gray-800">Suppliers</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus size={16} /> Add Supplier</button>
      </div>
      {showAdd && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs text-gray-500">Name *</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500">Contact</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500">Phone</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500">GSTIN</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} /></div>
          </div>
          <div className="flex gap-3"><button onClick={() => setShowAdd(false)} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button><button onClick={save} className="flex-1 bg-yellow-500 text-white rounded-lg py-2 text-sm">Save</button></div>
        </div>
      )}
      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-yellow-500" /></div> : (
        <div className="space-y-2">
          {suppliers.map(s => (
            <div key={s.id} className="bg-white rounded-xl shadow-sm p-4 flex justify-between">
              <div><p className="font-semibold">{s.name}</p><p className="text-xs text-gray-500">{s.contact_name || ''} {s.phone ? `· ${s.phone}` : ''}</p>{s.gstin && <p className="text-xs text-gray-400">GSTIN: {s.gstin}</p>}</div>
              {s.outstanding_amount > 0 && <div className="text-right"><p className="text-red-600 font-bold text-sm">{fmt(s.outstanding_amount)}</p><p className="text-xs text-gray-400">outstanding</p></div>}
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
  const [expenses, setExpenses] = useState<ElecExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: 'other', description: '', amount: 0, expense_date: today, payment_mode: 'cash' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('electrical_expenses').select('*').eq('bunk_id', bunkId).order('expense_date', { ascending: false }).limit(60);
    setExpenses(data as ElecExpense[] || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    await supabase.from('electrical_expenses').insert({ ...form, bunk_id: bunkId, amount: Number(form.amount) });
    setShowAdd(false); setForm({ category: 'other', description: '', amount: 0, expense_date: today, payment_mode: 'cash' }); load();
  };

  const thisMonth = expenses.filter(e => e.expense_date.startsWith(today.slice(0, 7))).reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div><h2 className="font-bold text-gray-800">Expenses</h2><p className="text-xs text-gray-500">This month: <b>{fmt(thisMonth)}</b></p></div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium"><Plus size={16} /> Add</button>
      </div>
      {showAdd && (
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500">Category</label><select className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{EXP_CATS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="text-xs text-gray-500">Amount</label><input type="number" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
            <div><label className="text-xs text-gray-500">Description</label><input className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500">Date</label><input type="date" className="w-full border rounded-lg px-3 py-2 mt-1 text-sm" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} /></div>
          </div>
          <div className="flex gap-3"><button onClick={() => setShowAdd(false)} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button><button onClick={save} className="flex-1 bg-yellow-500 text-white rounded-lg py-2 text-sm">Save</button></div>
        </div>
      )}
      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-yellow-500" /></div> : (
        <div className="space-y-2">
          {expenses.map(e => (
            <div key={e.id} className="bg-white rounded-xl shadow-sm p-4 flex justify-between">
              <div><p className="font-medium capitalize">{e.category}</p><p className="text-xs text-gray-500">{e.description || '—'} · {e.expense_date}</p></div>
              <p className="font-bold">{fmt(e.amount)}</p>
            </div>
          ))}
          {expenses.length === 0 && <p className="text-center text-gray-400 py-8">No expenses</p>}
        </div>
      )}
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
function ReportsTab({ bunkId }: { bunkId: string }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<{ sales: number; cash: number; upi: number; credit: number; bills: number; expenses: number; purchases: number; outstanding: number; expBreakdown: { category: string; amount: number }[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const to   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
    const [sRes, eRes, pRes, cRes] = await Promise.all([
      supabase.from('electrical_sales').select('total_amount,payment_mode,payment_status').eq('bunk_id', bunkId).gte('sale_date', from).lte('sale_date', to),
      supabase.from('electrical_expenses').select('amount,category').eq('bunk_id', bunkId).gte('expense_date', from).lte('expense_date', to),
      supabase.from('electrical_purchases').select('total_amount').eq('bunk_id', bunkId).gte('purchase_date', from).lte('purchase_date', to),
      supabase.from('electrical_customers').select('outstanding_amount').eq('bunk_id', bunkId).eq('is_active', true),
    ]);
    const sales = sRes.data || [];
    const expData = eRes.data || [];
    const catMap: Record<string, number> = {};
    expData.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount); });
    const expBreakdown = Object.entries(catMap).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
    setData({
      sales: sales.reduce((s, r) => s + r.total_amount, 0),
      cash: sales.filter(r => r.payment_mode === 'cash').reduce((s, r) => s + r.total_amount, 0),
      upi: sales.filter(r => r.payment_mode === 'upi').reduce((s, r) => s + r.total_amount, 0),
      credit: sales.filter(r => r.payment_status === 'credit').reduce((s, r) => s + r.total_amount, 0),
      bills: sales.length,
      expenses: expData.reduce((s, e) => s + Number(e.amount), 0),
      purchases: (pRes.data || []).reduce((s, p) => s + p.total_amount, 0),
      outstanding: (cRes.data || []).reduce((s, c) => s + c.outstanding_amount, 0),
      expBreakdown,
    });
    setLoading(false);
  }, [bunkId, month, year]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

  function handleExportCSV() {
    if (!data) return;
    const rows: (string | number)[][] = [
      ['Metric', 'Value'],
      ['Total Sales', data.sales],
      ['Cash Sales', data.cash],
      ['UPI Sales', data.upi],
      ['Credit Sales', data.credit],
      ['Total Bills', data.bills],
      ['Total Expenses', data.expenses],
      ['Purchases', data.purchases],
      ['Net Profit', data.sales - data.expenses],
      ['Total Outstanding', data.outstanding],
      ...data.expBreakdown.map(e => [`Expense: ${e.category}`, e.amount]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `electrical-report-${year}-${String(month).padStart(2,'0')}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <BarChart3 size={20} className="text-yellow-600" />
        <h2 className="text-lg font-semibold text-gray-800">Monthly Reports</h2>
        <div className="flex gap-2 ml-auto flex-wrap">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {data && <button onClick={handleExportCSV} className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-1.5 rounded-xl text-sm font-medium hover:bg-gray-50"><Download size={14} /> Export CSV</button>}
        </div>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-yellow-500" /></div> : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<TrendingUp size={18} />} label="Total Sales" value={fmt(data.sales)} sub={`${data.bills} bills`} color="border-green-500" />
            <StatCard icon={<DollarSign size={18} />} label="Cash + UPI" value={fmt(data.cash + data.upi)} color="border-blue-500" />
            <StatCard icon={<AlertCircle size={18} />} label="Credit Sales" value={fmt(data.credit)} color="border-orange-500" />
            <StatCard icon={<TrendingDown size={18} />} label="Expenses" value={fmt(data.expenses)} color="border-red-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="font-bold text-gray-700 mb-1">Net Profit</p>
              <p className={`text-3xl font-bold ${data.sales - data.expenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(data.sales - data.expenses)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="font-bold text-gray-700 mb-1">Total Outstanding</p>
              <p className="text-3xl font-bold text-orange-600">{fmt(data.outstanding)}</p>
            </div>
          </div>
          {data.expBreakdown.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="font-semibold text-gray-700 mb-3">Expense Breakdown</p>
              <div className="space-y-2">
                {data.expBreakdown.map(e => (
                  <div key={e.category} className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">{e.category}</span>
                    <span className="font-semibold text-red-600">{fmt(e.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl shadow-sm p-4 grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">UPI Sales</p><p className="font-bold">{fmt(data.upi)}</p></div>
            <div><p className="text-gray-500">Purchases</p><p className="font-bold">{fmt(data.purchases)}</p></div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main ElectricalApp ───────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'sales', label: 'Sales', icon: ShoppingCart },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'projects', label: 'Projects', icon: Briefcase },
  { id: 'purchases', label: 'Purchases', icon: Truck },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'inbox', label: 'Inbox', icon: MessageCircle },
  { id: 'campaigns', label: 'Campaigns', icon: Receipt },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'suppliers', label: 'Suppliers', icon: Package },
];

export function ElectricalApp({
  bunkId,
  onLogout,
  user,
}: {
  bunkId: string;
  onLogout?: () => void;
  user?: { name?: string; email?: string; role?: string };
}) {
  const [tab, setTab] = useState('dashboard');
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 bg-yellow-500 rounded-xl flex items-center justify-center">
          <Zap size={18} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="font-bold text-gray-900 text-lg">ElectricalDesk AI</h1>
          <p className="text-xs text-gray-400">Electrical Store Assistant</p>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
      <div className="bg-white border-b overflow-x-auto">
        <div className="flex min-w-max px-2">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon size={15} />{t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-4 max-w-6xl mx-auto">
        {tab === 'dashboard'  && <DashboardTab bunkId={bunkId} />}
        {tab === 'inventory'  && <InventoryTab bunkId={bunkId} />}
        {tab === 'sales'      && <SalesTab bunkId={bunkId} />}
        {tab === 'customers'  && <CustomersTab bunkId={bunkId} />}
        {tab === 'projects'   && <ProjectsTab bunkId={bunkId} />}
        {tab === 'purchases'  && <PurchasesTab bunkId={bunkId} />}
        {tab === 'expenses'   && <ExpensesTab bunkId={bunkId} />}
        {tab === 'reports'    && <ReportsTab bunkId={bunkId} />}
        {tab === 'suppliers'  && <SuppliersTab bunkId={bunkId} />}
        {tab === 'inbox'      && <InboxTab bunkId={bunkId} webhookUrl={VITE_WEBHOOK_URL} cronSecret={VITE_CRON_SECRET} />}
        {tab === 'campaigns'  && <CampaignsTab bunkId={bunkId} storeTables={{ customers: 'electrical_customers' }} webhookUrl={VITE_WEBHOOK_URL} cronSecret={VITE_CRON_SECRET} />}
        {tab === 'settings'   && (
          <SettingsTab bunkId={bunkId} user={user ?? {}} onLogout={onLogout ?? (() => {})} />
        )}
      </div>
    </div>
  );
}
