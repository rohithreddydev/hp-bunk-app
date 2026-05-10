import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard, Package, Users, ShoppingCart, Receipt, TrendingUp,
  Plus, Search, X, ChevronDown, ChevronUp, ArrowLeft, Edit2, Trash2,
  CheckCircle, AlertCircle, LogOut, Menu, Truck, BarChart3, BookOpen,
  IndianRupee, RefreshCw, Filter, ChevronRight, Boxes, Tag, Bell,
  Minus, Save, Download, Phone, MapPin, CreditCard, Calendar,
  ShoppingBag, Star, Settings, User, AlertTriangle, Eye, EyeOff
} from 'lucide-react';
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KiranaProduct {
  id: string;
  bunk_id: string;
  name: string;
  category: string;
  unit: string;
  purchase_rate: number;
  selling_rate: number;
  current_stock: number;
  min_stock_alert: number;
  barcode?: string;
  hsn_code?: string;
  gst_rate: number;
  is_active: boolean;
  entered_via: string;
  created_at: string;
}

interface KiranaCustomer {
  id: string;
  bunk_id: string;
  name: string;
  phone?: string;
  address?: string;
  credit_limit: number;
  portal_pin?: string;
  portal_access: boolean;
  notify_on_credit: boolean;
  status: string;
  created_at: string;
}

interface KiranaTransaction {
  id: string;
  bunk_id: string;
  customer_id?: string;
  type: string;
  date: string;
  amount: number;
  payment_mode: string;
  items?: CartItem[];
  notes?: string;
  entered_via: string;
  created_at: string;
  kirana_customers?: { name: string; phone?: string };
}

interface KiranaStockMovement {
  id: string;
  bunk_id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  rate: number;
  amount: number;
  supplier?: string;
  invoice_number?: string;
  payment_mode: string;
  date: string;
  notes?: string;
}

interface KiranaExpense {
  id: string;
  bunk_id: string;
  date: string;
  category: string;
  amount: number;
  description?: string;
  vendor?: string;
  payment_mode: string;
  created_at: string;
}

interface KiranaSupplier {
  id: string;
  bunk_id: string;
  name: string;
  phone?: string;
  categories_supplied?: string;
  outstanding_balance: number;
  notes?: string;
  created_at: string;
}

interface CartItem {
  product_id: string;
  name: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

interface DailySummary {
  cashSales: number;
  upiSales: number;
  creditSales: number;
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  txCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCT_CATEGORIES = [
  'Grains', 'Pulses', 'Oil & Ghee', 'Spices', 'Snacks', 'Dairy',
  'Beverages', 'Personal Care', 'Cleaning', 'Tobacco', 'Other'
];

const UNITS = ['kg', 'g', 'litre', 'ml', 'packet', 'piece', 'dozen', 'box', 'bundle'];

const EXPENSE_CATEGORIES = [
  'Rent', 'Salaries', 'Electricity', 'Transportation', 'Packaging',
  'Maintenance', 'Bank Charges', 'Miscellaneous'
];

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Credit'];

const GST_RATES = [0, 5, 12, 18, 28];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTodayIST = () => {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return ist.toISOString().slice(0, 10);
};

const fmtCurrency = (n: number) =>
  '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) => {
  if (!d) return '—';
  try {
    return new Date(d + (d.length === 10 ? 'T00:00:00+05:30' : '')).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return d; }
};

// ─── Toast ────────────────────────────────────────────────────────────────────

const Toast = ({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) => (
  <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs w-[90vw] ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
    {type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
    <span className="flex-1">{msg}</span>
    <button onClick={onClose}><X size={14} /></button>
  </div>
);

// ─── Modal ────────────────────────────────────────────────────────────────────

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 bg-black/60 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
    <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
      <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex justify-between items-center z-10">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100"><X size={20} /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

// ─── Form Field ───────────────────────────────────────────────────────────────

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    {children}
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none disabled:bg-gray-50 ${props.className || ''}`} />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) => (
  <select {...props} className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white ${props.className || ''}`} />
);

const Btn = ({ variant = 'primary', size = 'md', loading, children, ...props }: { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'sm' | 'md'; loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const base = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800',
    secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-gray-600 hover:bg-gray-100'
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm' };
  return (
    <button {...props} disabled={props.disabled || loading} className={`${base} ${variants[variant]} ${sizes[size]} ${props.className || ''}`}>
      {loading ? <RefreshCw size={14} className="animate-spin" /> : null}
      {children}
    </button>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) => (
  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <div className={`p-1.5 rounded-lg ${color}`}><Icon size={14} className="text-white" /></div>
    </div>
    <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
  </div>
);

// ─── KiranaApp ────────────────────────────────────────────────────────────────

interface KiranaAppProps {
  bunkId: string;
  bunkName: string;
  userRole: string;
  onLogout: () => void;
}

type NavTab = 'dashboard' | 'inventory' | 'sales' | 'customers' | 'expenses' | 'reports' | 'suppliers';

export const KiranaApp: React.FC<KiranaAppProps> = ({ bunkId, bunkName, userRole, onLogout }) => {
  const [tab, setTab] = useState<NavTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const isOwner = userRole === 'owner';

  const navItems: { id: NavTab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'sales', label: 'New Sale', icon: ShoppingCart },
    { id: 'customers', label: 'Khata', icon: Users },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'reports', label: 'Reports', icon: TrendingUp },
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
  ];

  return (
    <div className="flex h-[100dvh] bg-gray-50 font-sans text-gray-900">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Mobile overlay */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-60 bg-green-950 text-white flex flex-col shadow-2xl z-30 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="p-5 border-b border-green-900/50 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 text-green-400 mb-0.5">
              <ShoppingBag size={18} className="shrink-0" />
              <span className="font-black text-lg text-white tracking-tight truncate max-w-[130px]">{bunkName}</span>
            </div>
            <p className="text-green-400 text-xs">🛒 Kirana Module</p>
          </div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}><X size={22} /></button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setTab(id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === id ? 'bg-green-700 text-white' : 'text-green-200 hover:bg-green-900/50'}`}>
              <Icon size={18} className="shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-green-900/50">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-green-300 hover:bg-green-900/50 transition-all">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">{navItems.find(n => n.id === tab)?.label}</h1>
            <p className="text-xs text-gray-500">{getTodayIST()}</p>
          </div>
          <div className="text-xs text-gray-400 hidden sm:block">
            {userRole === 'owner' ? '👑 Owner' : '🧑 Supervisor'}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {tab === 'dashboard' && <DashboardTab bunkId={bunkId} showToast={showToast} />}
          {tab === 'inventory' && <InventoryTab bunkId={bunkId} showToast={showToast} isOwner={isOwner} />}
          {tab === 'sales' && <SalesTab bunkId={bunkId} showToast={showToast} onDone={() => setTab('dashboard')} />}
          {tab === 'customers' && <CustomersTab bunkId={bunkId} showToast={showToast} isOwner={isOwner} />}
          {tab === 'expenses' && <ExpensesTab bunkId={bunkId} showToast={showToast} isOwner={isOwner} />}
          {tab === 'reports' && <ReportsTab bunkId={bunkId} showToast={showToast} />}
          {tab === 'suppliers' && <SuppliersTab bunkId={bunkId} showToast={showToast} isOwner={isOwner} />}
        </main>
      </div>
    </div>
  );
};

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

const DashboardTab: React.FC<{ bunkId: string; showToast: (m: string, t?: 'success' | 'error') => void }> = ({ bunkId, showToast }) => {
  const [summary, setSummary] = useState<DailySummary>({ cashSales: 0, upiSales: 0, creditSales: 0, totalSales: 0, totalExpenses: 0, netProfit: 0, txCount: 0 });
  const [recentTx, setRecentTx] = useState<KiranaTransaction[]>([]);
  const [lowStock, setLowStock] = useState<KiranaProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const today = getTodayIST();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [txRes, expRes, stockRes] = await Promise.all([
        supabase.from('kirana_transactions').select('*, kirana_customers(name,phone)').eq('bunk_id', bunkId).eq('date', today).order('created_at', { ascending: false }),
        supabase.from('kirana_expenses').select('amount').eq('bunk_id', bunkId).eq('date', today),
        supabase.from('kirana_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).filter('current_stock', 'lte', 'min_stock_alert').limit(5)
      ]);

      const txs: KiranaTransaction[] = txRes.data || [];
      setRecentTx(txs.slice(0, 8));

      const cashSales = txs.filter(t => t.type === 'cash_sale').reduce((s, t) => s + t.amount, 0);
      const upiSales = txs.filter(t => t.type === 'upi_sale').reduce((s, t) => s + t.amount, 0);
      const creditSales = txs.filter(t => t.type === 'credit_sale').reduce((s, t) => s + t.amount, 0);
      const totalSales = cashSales + upiSales + creditSales;
      const totalExpenses = (expRes.data || []).reduce((s: number, e: { amount: number }) => s + e.amount, 0);

      setSummary({ cashSales, upiSales, creditSales, totalSales, totalExpenses, netProfit: totalSales - totalExpenses, txCount: txs.length });

      // Low stock: manually filter since lte with column ref is tricky
      const allProducts = await supabase.from('kirana_products').select('*').eq('bunk_id', bunkId).eq('is_active', true);
      const low = (allProducts.data || []).filter((p: KiranaProduct) => p.current_stock <= p.min_stock_alert).slice(0, 5);
      setLowStock(low);
    } catch (e) {
      showToast('Failed to load dashboard', 'error');
    } finally { setLoading(false); }
  }, [bunkId, today, showToast]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center h-40"><RefreshCw size={24} className="animate-spin text-green-600" /></div>;

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Today's Overview — {fmtDate(today)}</p>
        <Btn variant="ghost" size="sm" onClick={load}><RefreshCw size={14} />Refresh</Btn>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Sales" value={fmtCurrency(summary.totalSales)} icon={IndianRupee} color="bg-green-600" />
        <StatCard label="Net Profit" value={fmtCurrency(summary.netProfit)} icon={TrendingUp} color="bg-blue-600" />
        <StatCard label="Cash Sales" value={fmtCurrency(summary.cashSales)} icon={ShoppingBag} color="bg-emerald-600" />
        <StatCard label="UPI Sales" value={fmtCurrency(summary.upiSales)} icon={CreditCard} color="bg-violet-600" />
        <StatCard label="Credit Given" value={fmtCurrency(summary.creditSales)} icon={BookOpen} color="bg-orange-500" />
        <StatCard label="Expenses" value={fmtCurrency(summary.totalExpenses)} icon={Receipt} color="bg-red-500" />
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} className="text-orange-600" />
            <span className="text-sm font-semibold text-orange-800">Low Stock Alert</span>
          </div>
          <div className="space-y-2">
            {lowStock.map(p => (
              <div key={p.id} className="flex justify-between items-center text-sm">
                <span className="text-orange-900 font-medium">{p.name}</span>
                <span className="text-orange-700 font-bold">{p.current_stock} {p.unit} left</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Recent Transactions</p>
        {recentTx.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <ShoppingCart size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No sales today yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTx.map(tx => (
              <div key={tx.id} className="bg-white rounded-xl p-3 border border-gray-100 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {tx.kirana_customers?.name || (tx.type === 'payment' ? 'Payment Received' : 'Walk-in Customer')}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{tx.type.replace('_', ' ')} · {tx.payment_mode}</p>
                </div>
                <span className={`text-sm font-bold ${tx.type === 'payment' ? 'text-green-600' : tx.type === 'credit_sale' ? 'text-orange-600' : 'text-gray-900'}`}>
                  {tx.type === 'payment' ? '+' : ''}{fmtCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Inventory Tab ────────────────────────────────────────────────────────────

const InventoryTab: React.FC<{ bunkId: string; showToast: (m: string, t?: 'success' | 'error') => void; isOwner: boolean }> = ({ bunkId, showToast, isOwner }) => {
  const [products, setProducts] = useState<KiranaProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KiranaProduct | null>(null);
  const [showPurchase, setShowPurchase] = useState<KiranaProduct | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('kirana_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name');
    setProducts(data || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let p = products;
    if (catFilter !== 'All') p = p.filter(x => x.category === catFilter);
    if (search) p = p.filter(x => x.name.toLowerCase().includes(search.toLowerCase()));
    return p;
  }, [products, catFilter, search]);

  const handleDelete = async (p: KiranaProduct) => {
    if (!window.confirm(`Deactivate "${p.name}"?`)) return;
    await supabase.from('kirana_products').update({ is_active: false }).eq('id', p.id);
    showToast('Product deactivated');
    load();
  };

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {isOwner && <Btn onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} />Add</Btn>}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {['All', ...PRODUCT_CATEGORIES].map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${catFilter === c ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {c}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-10"><RefreshCw size={24} className="animate-spin text-green-600" /></div> : (
        <div className="space-y-2">
          {filtered.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">No products found</p>}
          {filtered.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{p.category}</span>
                    {p.current_stock <= p.min_stock_alert && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle size={10} />Low
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                    <span>Stock: <strong className="text-gray-800">{p.current_stock} {p.unit}</strong></span>
                    <span>Buy: <strong>{fmtCurrency(p.purchase_rate)}</strong></span>
                    <span>Sell: <strong className="text-green-700">{fmtCurrency(p.selling_rate)}</strong></span>
                    {p.gst_rate > 0 && <span>GST: {p.gst_rate}%</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setShowPurchase(p)} className="p-2 rounded-lg hover:bg-green-50 text-green-600" title="Add Stock">
                    <Plus size={15} />
                  </button>
                  {isOwner && (
                    <>
                      <button onClick={() => { setEditing(p); setShowForm(true); }} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"><Edit2 size={15} /></button>
                      <button onClick={() => handleDelete(p)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <ProductForm bunkId={bunkId} product={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); showToast(editing ? 'Product updated' : 'Product added'); }} />}
      {showPurchase && <PurchaseStockForm bunkId={bunkId} product={showPurchase} onClose={() => setShowPurchase(null)} onSaved={() => { setShowPurchase(null); load(); showToast('Stock updated'); }} />}
    </div>
  );
};

// ─── Product Form ─────────────────────────────────────────────────────────────

const ProductForm: React.FC<{ bunkId: string; product: KiranaProduct | null; onClose: () => void; onSaved: () => void }> = ({ bunkId, product, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: product?.name || '',
    category: product?.category || 'General',
    unit: product?.unit || 'kg',
    purchase_rate: String(product?.purchase_rate || ''),
    selling_rate: String(product?.selling_rate || ''),
    current_stock: String(product?.current_stock || '0'),
    min_stock_alert: String(product?.min_stock_alert || '2'),
    barcode: product?.barcode || '',
    hsn_code: product?.hsn_code || '',
    gst_rate: String(product?.gst_rate || '0'),
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      bunk_id: bunkId,
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      purchase_rate: parseFloat(form.purchase_rate) || 0,
      selling_rate: parseFloat(form.selling_rate) || 0,
      current_stock: parseFloat(form.current_stock) || 0,
      min_stock_alert: parseFloat(form.min_stock_alert) || 2,
      barcode: form.barcode || null,
      hsn_code: form.hsn_code || null,
      gst_rate: parseFloat(form.gst_rate) || 0,
      entered_via: 'webapp',
    };
    if (product) {
      await supabase.from('kirana_products').update(payload).eq('id', product.id);
    } else {
      await supabase.from('kirana_products').insert(payload);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Modal title={product ? 'Edit Product' : 'Add Product'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Product Name *">
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Basmati Rice" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.category} onChange={e => set('category', e.target.value)}>
              {PRODUCT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Unit">
            <Select value={form.unit} onChange={e => set('unit', e.target.value)}>
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </Select>
          </Field>
          <Field label="Purchase Rate (₹)">
            <Input type="number" value={form.purchase_rate} onChange={e => set('purchase_rate', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Selling Rate (₹)">
            <Input type="number" value={form.selling_rate} onChange={e => set('selling_rate', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Current Stock">
            <Input type="number" value={form.current_stock} onChange={e => set('current_stock', e.target.value)} />
          </Field>
          <Field label="Min Stock Alert">
            <Input type="number" value={form.min_stock_alert} onChange={e => set('min_stock_alert', e.target.value)} />
          </Field>
          <Field label="GST Rate (%)">
            <Select value={form.gst_rate} onChange={e => set('gst_rate', e.target.value)}>
              {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
            </Select>
          </Field>
          <Field label="HSN Code">
            <Input value={form.hsn_code} onChange={e => set('hsn_code', e.target.value)} placeholder="Optional" />
          </Field>
        </div>
        <Field label="Barcode">
          <Input value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="Optional" />
        </Field>
        <div className="flex gap-2 pt-2">
          <Btn variant="secondary" onClick={onClose} className="flex-1">Cancel</Btn>
          <Btn onClick={handleSave} loading={saving} className="flex-1">{product ? 'Update' : 'Add Product'}</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── Purchase Stock Form ──────────────────────────────────────────────────────

const PurchaseStockForm: React.FC<{ bunkId: string; product: KiranaProduct; onClose: () => void; onSaved: () => void }> = ({ bunkId, product, onClose, onSaved }) => {
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState(String(product.purchase_rate));
  const [supplier, setSupplier] = useState('');
  const [invoice, setInvoice] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [date, setDate] = useState(getTodayIST());
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const q = parseFloat(qty);
    if (!q || q <= 0) return;
    setSaving(true);
    await supabase.from('kirana_stock_movements').insert({
      bunk_id: bunkId,
      product_id: product.id,
      movement_type: 'purchase',
      quantity: q,
      rate: parseFloat(rate) || product.purchase_rate,
      amount: q * (parseFloat(rate) || product.purchase_rate),
      supplier: supplier || null,
      invoice_number: invoice || null,
      payment_mode: payMode,
      date,
      entered_via: 'webapp',
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal title={`Add Stock — ${product.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-green-50 rounded-lg p-3 text-sm">
          <span className="text-green-800">Current stock: <strong>{product.current_stock} {product.unit}</strong></span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Quantity (${product.unit}) *`}>
            <Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" autoFocus />
          </Field>
          <Field label="Purchase Rate (₹)">
            <Input type="number" value={rate} onChange={e => setRate(e.target.value)} />
          </Field>
          <Field label="Supplier">
            <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Invoice No">
            <Input value={invoice} onChange={e => setInvoice(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Payment Mode">
            <Select value={payMode} onChange={e => setPayMode(e.target.value)}>
              {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
        </div>
        {qty && parseFloat(qty) > 0 && (
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
            Total Amount: <strong>{fmtCurrency(parseFloat(qty) * (parseFloat(rate) || 0))}</strong>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Btn variant="secondary" onClick={onClose} className="flex-1">Cancel</Btn>
          <Btn onClick={handleSave} loading={saving} className="flex-1">Add Stock</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── Sales Tab ────────────────────────────────────────────────────────────────

const SalesTab: React.FC<{ bunkId: string; showToast: (m: string, t?: 'success' | 'error') => void; onDone: () => void }> = ({ bunkId, showToast, onDone }) => {
  const [products, setProducts] = useState<KiranaProduct[]>([]);
  const [customers, setCustomers] = useState<KiranaCustomer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [saleType, setSaleType] = useState<'cash_sale' | 'upi_sale' | 'credit_sale'>('cash_sale');
  const [date, setDate] = useState(getTodayIST());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [pd, cd] = await Promise.all([
        supabase.from('kirana_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
        supabase.from('kirana_customers').select('*').eq('bunk_id', bunkId).eq('status', 'Active').order('name')
      ]);
      setProducts(pd.data || []);
      setCustomers(cd.data || []);
    };
    load();
  }, [bunkId]);

  const filteredProducts = useMemo(() =>
    products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) && p.current_stock > 0),
    [products, productSearch]
  );

  const addToCart = (p: KiranaProduct) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === p.id);
      if (existing) return prev.map(i => i.product_id === p.id ? { ...i, qty: i.qty + 1, amount: (i.qty + 1) * i.rate } : i);
      return [...prev, { product_id: p.id, name: p.name, qty: 1, unit: p.unit, rate: p.selling_rate, amount: p.selling_rate }];
    });
    setProductSearch('');
  };

  const updateCartQty = (productId: string, qty: number) => {
    if (qty <= 0) { setCart(prev => prev.filter(i => i.product_id !== productId)); return; }
    setCart(prev => prev.map(i => i.product_id === productId ? { ...i, qty, amount: qty * i.rate } : i));
  };

  const updateCartRate = (productId: string, rate: number) => {
    setCart(prev => prev.map(i => i.product_id === productId ? { ...i, rate, amount: i.qty * rate } : i));
  };

  const total = cart.reduce((s, i) => s + i.amount, 0);

  const handleSave = async () => {
    if (cart.length === 0) return showToast('Add items to cart', 'error');
    if (saleType === 'credit_sale' && !customerId) return showToast('Select customer for credit sale', 'error');
    setSaving(true);

    const paymentMode = saleType === 'cash_sale' ? 'Cash' : saleType === 'upi_sale' ? 'UPI' : 'Credit';

    const { error } = await supabase.from('kirana_transactions').insert({
      bunk_id: bunkId,
      customer_id: customerId || null,
      type: saleType,
      date,
      amount: total,
      payment_mode: paymentMode,
      items: cart,
      notes: notes || null,
      entered_via: 'webapp',
    });

    if (error) { showToast('Failed to save sale', 'error'); setSaving(false); return; }

    // Deduct stock
    for (const item of cart) {
      await supabase.from('kirana_stock_movements').insert({
        bunk_id: bunkId,
        product_id: item.product_id,
        movement_type: 'sale',
        quantity: -item.qty,
        rate: item.rate,
        amount: item.amount,
        payment_mode: paymentMode,
        date,
        entered_via: 'webapp',
      });
    }

    showToast(`Sale of ${fmtCurrency(total)} saved!`);
    setSaving(false);
    setCart([]);
    setCustomerId('');
    setNotes('');
    onDone();
  };

  return (
    <div className="p-4 space-y-4 max-w-xl mx-auto">
      {/* Sale type */}
      <div className="grid grid-cols-3 gap-2">
        {([['cash_sale', '💵 Cash'], ['upi_sale', '📱 UPI'], ['credit_sale', '📖 Credit']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setSaleType(v)}
            className={`py-2.5 rounded-xl text-sm font-medium transition-all ${saleType === v ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Customer (for credit) */}
      {saleType === 'credit_sale' && (
        <Field label="Customer *">
          <Select value={customerId} onChange={e => setCustomerId(e.target.value)}>
            <option value="">— Select customer —</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>)}
          </Select>
        </Field>
      )}
      {saleType !== 'credit_sale' && (
        <Field label="Customer (optional)">
          <Select value={customerId} onChange={e => setCustomerId(e.target.value)}>
            <option value="">— Walk-in —</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      )}

      {/* Product search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input placeholder="Search & add products..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-9" />
        {productSearch && filteredProducts.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto">
            {filteredProducts.map(p => (
              <button key={p.id} onClick={() => addToCart(p)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-green-50 text-sm border-b last:border-0">
                <div className="text-left">
                  <p className="font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.current_stock} {p.unit} in stock</p>
                </div>
                <span className="font-bold text-green-700">{fmtCurrency(p.selling_rate)}</span>
              </button>
            ))}
          </div>
        )}
        {productSearch && filteredProducts.length === 0 && (
          <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 p-4 text-center text-sm text-gray-400">
            No products found (or out of stock)
          </div>
        )}
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">Cart ({cart.length} items)</div>
          <div className="divide-y divide-gray-50">
            {cart.map(item => (
              <div key={item.product_id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900 flex-1 pr-2">{item.name}</p>
                  <button onClick={() => setCart(c => c.filter(i => i.product_id !== item.product_id))} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg">
                    <button onClick={() => updateCartQty(item.product_id, item.qty - 1)} className="p-1.5 hover:bg-gray-200 rounded-lg"><Minus size={12} /></button>
                    <input type="number" value={item.qty} onChange={e => updateCartQty(item.product_id, parseFloat(e.target.value) || 0)}
                      className="w-14 text-center text-sm font-medium bg-transparent outline-none" />
                    <button onClick={() => updateCartQty(item.product_id, item.qty + 1)} className="p-1.5 hover:bg-gray-200 rounded-lg"><Plus size={12} /></button>
                  </div>
                  <span className="text-xs text-gray-500">{item.unit} ×</span>
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-xs text-gray-500">₹</span>
                    <input type="number" value={item.rate} onChange={e => updateCartRate(item.product_id, parseFloat(e.target.value) || 0)}
                      className="w-20 text-sm border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-green-500" />
                  </div>
                  <span className="text-sm font-bold text-gray-900 ml-auto">{fmtCurrency(item.amount)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 bg-green-50 border-t border-green-100 flex justify-between items-center">
            <span className="text-sm font-semibold text-green-900">Total</span>
            <span className="text-lg font-black text-green-700">{fmtCurrency(total)}</span>
          </div>
        </div>
      )}

      {cart.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
            <Field label="Notes">
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
            </Field>
          </div>
          <Btn onClick={handleSave} loading={saving} className="w-full py-3 text-base">
            <CheckCircle size={18} /> Save Sale — {fmtCurrency(total)}
          </Btn>
        </>
      )}

      {cart.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Search and add products above</p>
        </div>
      )}
    </div>
  );
};

// ─── Customers Tab ────────────────────────────────────────────────────────────

const CustomersTab: React.FC<{ bunkId: string; showToast: (m: string, t?: 'success' | 'error') => void; isOwner: boolean }> = ({ bunkId, showToast, isOwner }) => {
  const [customers, setCustomers] = useState<KiranaCustomer[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KiranaCustomer | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedTxs, setExpandedTxs] = useState<KiranaTransaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [showPayment, setShowPayment] = useState<KiranaCustomer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: custs } = await supabase.from('kirana_customers').select('*').eq('bunk_id', bunkId).order('name');
    setCustomers(custs || []);

    // Compute balance for each customer
    if (custs && custs.length > 0) {
      const ids = custs.map((c: KiranaCustomer) => c.id);
      const { data: txs } = await supabase.from('kirana_transactions').select('customer_id,type,amount').eq('bunk_id', bunkId).in('customer_id', ids);
      const bal: Record<string, number> = {};
      for (const tx of (txs || [])) {
        if (!bal[tx.customer_id]) bal[tx.customer_id] = 0;
        if (tx.type === 'credit_sale' || tx.type === 'opening_balance') bal[tx.customer_id] += tx.amount;
        if (tx.type === 'payment') bal[tx.customer_id] -= tx.amount;
      }
      setBalances(bal);
    }
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = async (cId: string) => {
    if (expanded === cId) { setExpanded(null); return; }
    setExpanded(cId);
    setLoadingTxs(true);
    const { data } = await supabase.from('kirana_transactions').select('*').eq('bunk_id', bunkId).eq('customer_id', cId).order('date', { ascending: false }).limit(20);
    setExpandedTxs(data || []);
    setLoadingTxs(false);
  };

  const filtered = useMemo(() =>
    customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)),
    [customers, search]
  );

  const totalOutstanding = useMemo(() => Object.values(balances).reduce((s, b) => s + Math.max(0, b), 0), [balances]);

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
        <p className="text-xs text-orange-600 font-medium">Total Outstanding</p>
        <p className="text-2xl font-black text-orange-700">{fmtCurrency(totalOutstanding)}</p>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Btn onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} />Add</Btn>
      </div>

      {loading ? <div className="flex justify-center py-10"><RefreshCw size={24} className="animate-spin text-green-600" /></div> : (
        <div className="space-y-2">
          {filtered.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">No customers found</p>}
          {filtered.map(c => {
            const bal = balances[c.id] || 0;
            const isExpanded = expanded === c.id;
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => toggleExpand(c.id)}>
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <span className="text-green-800 font-bold text-sm">{c.name[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                      {c.status === 'Blocked' && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Blocked</span>}
                    </div>
                    {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${bal > 0 ? 'text-red-600' : bal < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                      {bal > 0 ? `Due: ${fmtCurrency(bal)}` : bal < 0 ? `Advance: ${fmtCurrency(-bal)}` : '₹0 Clear'}
                    </p>
                    <p className="text-xs text-gray-400">Limit: {fmtCurrency(c.credit_limit)}</p>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-3 pb-3">
                    <div className="flex gap-2 py-2">
                      <Btn size="sm" onClick={() => setShowPayment(c)}><IndianRupee size={13} />Record Payment</Btn>
                      {isOwner && <Btn size="sm" variant="secondary" onClick={() => { setEditing(c); setShowForm(true); }}><Edit2 size={13} />Edit</Btn>}
                    </div>
                    {loadingTxs ? <div className="flex justify-center py-4"><RefreshCw size={16} className="animate-spin text-gray-400" /></div> : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {expandedTxs.length === 0 && <p className="text-xs text-gray-400 text-center py-3">No transactions</p>}
                        {expandedTxs.map(tx => (
                          <div key={tx.id} className="flex justify-between items-center text-xs py-1.5 border-b border-gray-50 last:border-0">
                            <div>
                              <p className="text-gray-700 capitalize">{tx.type.replace('_', ' ')}</p>
                              <p className="text-gray-400">{fmtDate(tx.date)}</p>
                            </div>
                            <span className={`font-semibold ${tx.type === 'payment' ? 'text-green-600' : 'text-red-600'}`}>
                              {tx.type === 'payment' ? '-' : '+'}{fmtCurrency(tx.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && <CustomerForm bunkId={bunkId} customer={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); showToast(editing ? 'Customer updated' : 'Customer added'); }} />}
      {showPayment && <PaymentForm bunkId={bunkId} customer={showPayment} balance={balances[showPayment.id] || 0} onClose={() => setShowPayment(null)} onSaved={() => { setShowPayment(null); load(); showToast('Payment recorded'); }} />}
    </div>
  );
};

// ─── Customer Form ────────────────────────────────────────────────────────────

const CustomerForm: React.FC<{ bunkId: string; customer: KiranaCustomer | null; onClose: () => void; onSaved: () => void }> = ({ bunkId, customer, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    address: customer?.address || '',
    credit_limit: String(customer?.credit_limit || 5000),
    status: customer?.status || 'Active',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { bunk_id: bunkId, name: form.name.trim(), phone: form.phone || null, address: form.address || null, credit_limit: parseFloat(form.credit_limit) || 5000, status: form.status };
    if (customer) await supabase.from('kirana_customers').update(payload).eq('id', customer.id);
    else await supabase.from('kirana_customers').insert(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal title={customer ? 'Edit Customer' : 'Add Customer'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Name *"><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Customer name" /></Field>
        <Field label="Phone"><Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="10-digit mobile" /></Field>
        <Field label="Address"><Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Optional" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Credit Limit (₹)"><Input type="number" value={form.credit_limit} onChange={e => set('credit_limit', e.target.value)} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={e => set('status', e.target.value)}>
              <option>Active</option><option>Blocked</option>
            </Select>
          </Field>
        </div>
        <div className="flex gap-2 pt-2">
          <Btn variant="secondary" onClick={onClose} className="flex-1">Cancel</Btn>
          <Btn onClick={handleSave} loading={saving} className="flex-1">{customer ? 'Update' : 'Add Customer'}</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── Payment Form ─────────────────────────────────────────────────────────────

const PaymentForm: React.FC<{ bunkId: string; customer: KiranaCustomer; balance: number; onClose: () => void; onSaved: () => void }> = ({ bunkId, customer, balance, onClose, onSaved }) => {
  const [amount, setAmount] = useState(String(Math.max(0, balance)));
  const [payMode, setPayMode] = useState('Cash');
  const [date, setDate] = useState(getTodayIST());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const a = parseFloat(amount);
    if (!a || a <= 0) return;
    setSaving(true);
    await supabase.from('kirana_transactions').insert({
      bunk_id: bunkId, customer_id: customer.id, type: 'payment',
      date, amount: a, payment_mode: payMode, notes: notes || null, entered_via: 'webapp'
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal title={`Payment — ${customer.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-orange-50 rounded-lg p-3 text-sm">
          Outstanding: <strong className="text-orange-700">{fmtCurrency(balance)}</strong>
        </div>
        <Field label="Amount (₹) *"><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mode">
            <Select value={payMode} onChange={e => setPayMode(e.target.value)}>
              {PAYMENT_MODES.filter(m => m !== 'Credit').map(m => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Notes"><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" /></Field>
        <div className="flex gap-2 pt-2">
          <Btn variant="secondary" onClick={onClose} className="flex-1">Cancel</Btn>
          <Btn onClick={handleSave} loading={saving} className="flex-1">Record Payment</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── Expenses Tab ─────────────────────────────────────────────────────────────

const ExpensesTab: React.FC<{ bunkId: string; showToast: (m: string, t?: 'success' | 'error') => void; isOwner: boolean }> = ({ bunkId, showToast, isOwner }) => {
  const [expenses, setExpenses] = useState<KiranaExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [dateFrom, setDateFrom] = useState(getTodayIST());
  const [dateTo, setDateTo] = useState(getTodayIST());

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('kirana_expenses').select('*').eq('bunk_id', bunkId).gte('date', dateFrom).lte('date', dateTo).order('date', { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  }, [bunkId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense?')) return;
    await supabase.from('kirana_expenses').delete().eq('id', id);
    showToast('Expense deleted');
    load();
  };

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex gap-2 items-end">
        <Field label="From">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </Field>
        <Btn onClick={() => setShowForm(true)} className="shrink-0"><Plus size={16} />Add</Btn>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
        <p className="text-xs text-red-600 font-medium">Total Expenses</p>
        <p className="text-2xl font-black text-red-700">{fmtCurrency(total)}</p>
      </div>

      {loading ? <div className="flex justify-center py-8"><RefreshCw size={22} className="animate-spin text-green-600" /></div> : (
        <div className="space-y-2">
          {expenses.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No expenses in this period</p>}
          {expenses.map(e => (
            <div key={e.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm">{e.category}</p>
                  {e.vendor && <span className="text-xs text-gray-500">{e.vendor}</span>}
                </div>
                <p className="text-xs text-gray-400">{fmtDate(e.date)} · {e.payment_mode}</p>
                {e.description && <p className="text-xs text-gray-500 mt-0.5">{e.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-red-600">{fmtCurrency(e.amount)}</span>
                {isOwner && <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <ExpenseForm bunkId={bunkId} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); showToast('Expense added'); }} />}
    </div>
  );
};

// ─── Expense Form ─────────────────────────────────────────────────────────────

const ExpenseForm: React.FC<{ bunkId: string; onClose: () => void; onSaved: () => void }> = ({ bunkId, onClose, onSaved }) => {
  const [form, setForm] = useState({ category: 'Miscellaneous', amount: '', description: '', vendor: '', payment_mode: 'Cash', date: getTodayIST() });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    setSaving(true);
    await supabase.from('kirana_expenses').insert({ bunk_id: bunkId, ...form, amount: parseFloat(form.amount) });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal title="Add Expense" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.category} onChange={e => set('category', e.target.value)}>
              {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Amount (₹) *"><Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" /></Field>
          <Field label="Vendor"><Input value={form.vendor} onChange={e => set('vendor', e.target.value)} placeholder="Optional" /></Field>
          <Field label="Payment Mode">
            <Select value={form.payment_mode} onChange={e => set('payment_mode', e.target.value)}>
              {PAYMENT_MODES.filter(m => m !== 'Credit').map(m => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={e => set('date', e.target.value)} /></Field>
        </div>
        <Field label="Description"><Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional" /></Field>
        <div className="flex gap-2 pt-2">
          <Btn variant="secondary" onClick={onClose} className="flex-1">Cancel</Btn>
          <Btn onClick={handleSave} loading={saving} className="flex-1">Add Expense</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── Reports Tab ──────────────────────────────────────────────────────────────

const ReportsTab: React.FC<{ bunkId: string; showToast: (m: string, t?: 'success' | 'error') => void }> = ({ bunkId, showToast }) => {
  const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const ist = new Date(now);
  const defaultFrom = new Date(ist.getFullYear(), ist.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = ist.toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [report, setReport] = useState<{ cashSales: number; upiSales: number; creditSales: number; payments: number; expenses: number; totalSales: number; netProfit: number; txCount: number; topProducts: { name: string; qty: number; revenue: number }[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    const [txRes, expRes] = await Promise.all([
      supabase.from('kirana_transactions').select('type,amount,items').eq('bunk_id', bunkId).gte('date', dateFrom).lte('date', dateTo),
      supabase.from('kirana_expenses').select('amount').eq('bunk_id', bunkId).gte('date', dateFrom).lte('date', dateTo)
    ]);

    const txs = txRes.data || [];
    const exps = expRes.data || [];

    const cashSales = txs.filter(t => t.type === 'cash_sale').reduce((s: number, t: { amount: number }) => s + t.amount, 0);
    const upiSales = txs.filter(t => t.type === 'upi_sale').reduce((s: number, t: { amount: number }) => s + t.amount, 0);
    const creditSales = txs.filter(t => t.type === 'credit_sale').reduce((s: number, t: { amount: number }) => s + t.amount, 0);
    const payments = txs.filter(t => t.type === 'payment').reduce((s: number, t: { amount: number }) => s + t.amount, 0);
    const totalSales = cashSales + upiSales + creditSales;
    const expenses = exps.reduce((s: number, e: { amount: number }) => s + e.amount, 0);

    // Top products from items JSONB
    const productMap: Record<string, { qty: number; revenue: number }> = {};
    for (const tx of txs) {
      if (tx.items && Array.isArray(tx.items)) {
        for (const item of tx.items) {
          if (!productMap[item.name]) productMap[item.name] = { qty: 0, revenue: 0 };
          productMap[item.name].qty += item.qty || 0;
          productMap[item.name].revenue += item.amount || 0;
        }
      }
    }
    const topProducts = Object.entries(productMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    setReport({ cashSales, upiSales, creditSales, payments, totalSales, expenses, netProfit: totalSales - expenses, txCount: txs.length, topProducts });
    setLoading(false);
  };

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">
      <div className="flex gap-2 items-end flex-wrap">
        <Field label="From"><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></Field>
        <Field label="To"><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></Field>
        <Btn onClick={generate} loading={loading} className="shrink-0"><BarChart3 size={16} />Generate</Btn>
      </div>

      {loading && <div className="flex justify-center py-10"><RefreshCw size={24} className="animate-spin text-green-600" /></div>}

      {report && !loading && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b"><p className="font-semibold text-sm text-gray-700">Sales Summary</p></div>
            <div className="divide-y divide-gray-50">
              {[
                ['Cash Sales', report.cashSales, 'text-green-700'],
                ['UPI Sales', report.upiSales, 'text-violet-700'],
                ['Credit Sales', report.creditSales, 'text-orange-600'],
                ['Total Sales', report.totalSales, 'text-gray-900 font-bold'],
                ['Payments Received', report.payments, 'text-green-600'],
                ['Total Expenses', report.expenses, 'text-red-600'],
                ['Net Profit', report.netProfit, report.netProfit >= 0 ? 'text-green-700 font-bold' : 'text-red-700 font-bold'],
              ].map(([label, value, cls]) => (
                <div key={label as string} className="flex justify-between items-center px-4 py-3 text-sm">
                  <span className="text-gray-600">{label}</span>
                  <span className={String(cls)}>{fmtCurrency(Number(value))}</span>
                </div>
              ))}
            </div>
          </div>

          {report.topProducts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b"><p className="font-semibold text-sm text-gray-700">Top Products</p></div>
              <div className="divide-y divide-gray-50">
                {report.topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="w-5 h-5 rounded-full bg-green-100 text-green-800 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="flex-1 text-gray-800">{p.name}</span>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{fmtCurrency(p.revenue)}</p>
                      <p className="text-xs text-gray-400">{p.qty.toFixed(2)} qty sold</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!report && !loading && (
        <div className="text-center py-12 text-gray-400">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select date range and tap Generate</p>
        </div>
      )}
    </div>
  );
};

// ─── Suppliers Tab ────────────────────────────────────────────────────────────

const SuppliersTab: React.FC<{ bunkId: string; showToast: (m: string, t?: 'success' | 'error') => void; isOwner: boolean }> = ({ bunkId, showToast, isOwner }) => {
  const [suppliers, setSuppliers] = useState<KiranaSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KiranaSupplier | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('kirana_suppliers').select('*').eq('bunk_id', bunkId).order('name');
    setSuppliers(data || []);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const totalDue = suppliers.reduce((s, sup) => s + sup.outstanding_balance, 0);

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
          <p className="text-xs text-blue-600">Total Due to Suppliers</p>
          <p className="text-xl font-black text-blue-700">{fmtCurrency(totalDue)}</p>
        </div>
        {isOwner && <Btn onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} />Add</Btn>}
      </div>

      {loading ? <div className="flex justify-center py-8"><RefreshCw size={22} className="animate-spin text-green-600" /></div> : (
        <div className="space-y-2">
          {suppliers.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No suppliers yet</p>}
          {suppliers.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-blue-800 font-bold text-sm">{s.name[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                {s.phone && <p className="text-xs text-gray-500">{s.phone}</p>}
                {s.categories_supplied && <p className="text-xs text-gray-400">{s.categories_supplied}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-bold ${s.outstanding_balance > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {s.outstanding_balance > 0 ? `Due: ${fmtCurrency(s.outstanding_balance)}` : 'Clear'}
                </p>
              </div>
              {isOwner && (
                <button onClick={() => { setEditing(s); setShowForm(true); }} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"><Edit2 size={14} /></button>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && <SupplierForm bunkId={bunkId} supplier={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); showToast(editing ? 'Supplier updated' : 'Supplier added'); }} />}
    </div>
  );
};

// ─── Supplier Form ────────────────────────────────────────────────────────────

const SupplierForm: React.FC<{ bunkId: string; supplier: KiranaSupplier | null; onClose: () => void; onSaved: () => void }> = ({ bunkId, supplier, onClose, onSaved }) => {
  const [form, setForm] = useState({ name: supplier?.name || '', phone: supplier?.phone || '', categories_supplied: supplier?.categories_supplied || '', outstanding_balance: String(supplier?.outstanding_balance || '0'), notes: supplier?.notes || '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { bunk_id: bunkId, name: form.name.trim(), phone: form.phone || null, categories_supplied: form.categories_supplied || null, outstanding_balance: parseFloat(form.outstanding_balance) || 0, notes: form.notes || null };
    if (supplier) await supabase.from('kirana_suppliers').update(payload).eq('id', supplier.id);
    else await supabase.from('kirana_suppliers').insert(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal title={supplier ? 'Edit Supplier' : 'Add Supplier'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Name *"><Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Supplier name" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
          <Field label="Outstanding (₹)"><Input type="number" value={form.outstanding_balance} onChange={e => set('outstanding_balance', e.target.value)} /></Field>
        </div>
        <Field label="Categories Supplied"><Input value={form.categories_supplied} onChange={e => set('categories_supplied', e.target.value)} placeholder="e.g. Grains, Pulses" /></Field>
        <Field label="Notes"><Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional" /></Field>
        <div className="flex gap-2 pt-2">
          <Btn variant="secondary" onClick={onClose} className="flex-1">Cancel</Btn>
          <Btn onClick={handleSave} loading={saving} className="flex-1">{supplier ? 'Update' : 'Add Supplier'}</Btn>
        </div>
      </div>
    </Modal>
  );
};

export default KiranaApp;
