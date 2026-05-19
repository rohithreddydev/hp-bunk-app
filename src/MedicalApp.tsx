import { useState, useEffect, useCallback } from 'react';
import {
  Package, Users, ShoppingCart, TrendingUp, Plus, Search,
  AlertTriangle, CheckCircle, X, Save, ArrowLeft, ChevronRight,
  DollarSign, Calendar, Pill, FileText, Truck, BarChart2,
  Clock, Tag, RefreshCw, Receipt, BookOpen, ArrowUpRight, ArrowDownLeft,
  Settings as SettingsIcon, LogOut, Brain, Download,
} from 'lucide-react';
import { supabase } from './supabase';
import { SettingsTab } from './SettingsTab';
import { IntelligenceTab } from './IntelligenceTab';

interface MedProduct {
  id: string;
  bunk_id: string;
  name: string;
  generic_name: string;
  brand: string;
  category: string;
  unit: string;
  form: string;
  strength: string;
  selling_price: number;
  purchase_price: number;
  mrp: number;
  current_stock: number;
  reorder_level: number;
  batch_number: string;
  expiry_date: string;
  hsn_code: string;
  requires_prescription: boolean;
  is_active: boolean;
}

interface MedCustomer {
  id: string;
  bunk_id: string;
  name: string;
  phone: string;
  address: string;
  customer_type: string;
  outstanding_amount: number;
  credit_limit: number;
  is_active: boolean;
  last_payment_date?: string;
}

interface MedSale {
  id: string;
  bunk_id: string;
  customer_id: string | null;
  customer_name: string;
  sale_date: string;
  total_amount: number;
  discount_amount: number;
  payment_mode: string;
  payment_status: string;
  prescription_ref: string;
  notes: string;
  created_at: string;
}

interface MedSaleItem {
  product_id: string;
  product_name: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface CartItem extends MedSaleItem {
  mrp: number;
}

interface MedPurchase {
  id: string;
  bunk_id: string;
  supplier_name: string;
  invoice_number: string;
  purchase_date: string;
  total_amount: number;
  notes: string;
  created_at: string;
}

interface MedExpense {
  id: string;
  bunk_id: string;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  payment_mode: string;
  notes: string;
}

interface LedgerEntry {
  date: string;
  type: 'sale' | 'payment';
  amount: number;
  label: string;
  mode?: string;
  running_balance?: number;
}

interface DashboardStats {
  todaySales: number;
  todayCash: number;
  todayCredit: number;
  todayExpenses: number;
  totalOutstanding: number;
  expiryAlerts: number;
  lowStockCount: number;
  stockValue: number;
}

const MED_CATEGORIES = [
  'Tablets & Capsules', 'Syrups & Liquids', 'Injections', 'Topical & Creams',
  'Surgical & Disposables', 'Vitamins & Supplements', 'Ayurvedic & Herbal',
  'OTC Products', 'Baby Care', 'Diagnostics'
];

const MED_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Inhaler', 'Gel', 'Powder', 'Suspension', 'Lotion'];
const MED_UNITS = ['strip', 'bottle', 'tube', 'vial', 'box', 'piece', 'pack', 'sachet'];
const CUSTOMER_TYPES = ['Retail', 'Doctor', 'Hospital', 'Clinic', 'Wholesale'];
const EXPENSE_CATS = ['Rent', 'Salaries', 'Electricity', 'License Fees', 'Cold Storage', 'Packaging', 'Transport', 'Other'];
const PAYMENT_MODES = ['cash', 'upi', 'card', 'credit'];

function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function daysToExpiry(expiryDate: string): number {
  const exp = new Date(expiryDate);
  const today = new Date();
  today.setHours(0,0,0,0);
  return Math.floor((exp.getTime() - today.getTime()) / (1000*60*60*24));
}

function expiryColor(days: number): string {
  if (days < 0) return 'text-red-600 bg-red-100';
  if (days <= 30) return 'text-orange-600 bg-orange-100';
  if (days <= 90) return 'text-yellow-600 bg-yellow-100';
  return 'text-green-600 bg-green-100';
}

function agingBadge(lastDate: string | null | undefined) {
  const d = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : 999;
  if (d < 8) return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{d}d</span>;
  if (d < 31) return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{d}d</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">{d === 999 ? 'new' : d+'d'}</span>;
}

function MedLedgerModal({ bunkId, customer, onClose }: { bunkId: string; customer: MedCustomer; onClose: () => void }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [salesRes, payRes] = await Promise.all([
        supabase.from('med_sales').select('sale_date,total_amount,payment_mode').eq('bunk_id', bunkId).eq('customer_id', customer.id).order('sale_date'),
        supabase.from('med_payments').select('payment_date,amount,payment_mode').eq('bunk_id', bunkId).eq('customer_id', customer.id).order('payment_date'),
      ]);
      const all: LedgerEntry[] = [
        ...(salesRes.data || []).map(s => ({ date: s.sale_date, type: 'sale' as const, amount: Number(s.total_amount), label: 'Sale', mode: s.payment_mode })),
        ...(payRes.data || []).map(p => ({ date: p.payment_date, type: 'payment' as const, amount: Number(p.amount), label: 'Payment', mode: p.payment_mode })),
      ].sort((a, b) => a.date.localeCompare(b.date));
      let bal = 0;
      for (const e of all) {
        bal = e.type === 'sale' ? bal + e.amount : Math.max(0, bal - e.amount);
        e.running_balance = bal;
      }
      setEntries(all);
      setLoading(false);
    })();
  }, [bunkId, customer.id]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-700 flex items-center gap-2"><BookOpen className="w-4 h-4 text-teal-600" /> Ledger — {customer.name}</h3>
            <div className="text-xs text-orange-600 mt-0.5">Outstanding: ₹{Number(customer.outstanding_amount).toFixed(0)}</div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : entries.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No transactions yet</div>
          ) : (
            <div className="space-y-1">
              {entries.map((e, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                  <div className={`p-1.5 rounded-full ${e.type === 'sale' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                    {e.type === 'sale' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700">{e.label}</div>
                    <div className="text-xs text-gray-400">{e.date}{e.mode && ` • ${e.mode}`}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${e.type === 'sale' ? 'text-orange-600' : 'text-green-600'}`}>
                      {e.type === 'sale' ? '+' : '-'}₹{e.amount.toFixed(0)}
                    </div>
                    <div className="text-xs text-gray-500">Bal: ₹{(e.running_balance || 0).toFixed(0)}</div>
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

function MedReports({ bunkId }: { bunkId: string }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<{
    totalSales: number; totalExpenses: number; profit: number; creditCollected: number;
    topMeds: { name: string; qty: number; revenue: number }[];
    expirySummary: { expired: number; within30: number; within90: number };
    expenseBreakdown: { category: string; amount: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const toDate = new Date(year, month, 0);
    const to = `${year}-${String(month).padStart(2,'0')}-${String(toDate.getDate()).padStart(2,'0')}`;

    const [salesRes, itemsRes, expRes, payRes, prodRes] = await Promise.all([
      supabase.from('med_sales').select('sale_date,customer_name,total_amount,payment_mode').eq('bunk_id', bunkId).gte('sale_date', from).lte('sale_date', to),
      supabase.from('med_sale_items').select('product_name,quantity,total_price').eq('bunk_id', bunkId).gte('created_at', from).lte('created_at', to + 'T23:59:59'),
      supabase.from('med_expenses').select('category,amount').eq('bunk_id', bunkId).gte('expense_date', from).lte('expense_date', to),
      supabase.from('med_payments').select('amount').eq('bunk_id', bunkId).gte('payment_date', from).lte('payment_date', to),
      supabase.from('med_products').select('expiry_date').eq('bunk_id', bunkId).eq('is_active', true),
    ]);

    const sales = salesRes.data || [];
    const items = itemsRes.data || [];
    const exps = expRes.data || [];
    const pays = payRes.data || [];
    const prods = prodRes.data || [];

    setSales(sales);

    const totalSales = sales.reduce((a, x) => a + Number(x.total_amount), 0);
    const totalExpenses = exps.reduce((a, x) => a + Number(x.amount), 0);
    const creditCollected = pays.reduce((a, x) => a + Number(x.amount), 0);
    const profit = totalSales - totalExpenses;

    const medMap: Record<string, { qty: number; revenue: number }> = {};
    for (const it of items) {
      if (!medMap[it.product_name]) medMap[it.product_name] = { qty: 0, revenue: 0 };
      medMap[it.product_name].qty += Number(it.quantity);
      medMap[it.product_name].revenue += Number(it.total_price);
    }
    const topMeds = Object.entries(medMap).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expirySummary = prods.filter(p => p.expiry_date).reduce((acc, p) => {
      const days = Math.floor((new Date(p.expiry_date).getTime() - today.getTime()) / 86400000);
      if (days < 0) acc.expired++;
      else if (days <= 30) acc.within30++;
      else if (days <= 90) acc.within90++;
      return acc;
    }, { expired: 0, within30: 0, within90: 0 });

    const expCats: Record<string, number> = {};
    for (const e of exps) { expCats[e.category] = (expCats[e.category] || 0) + Number(e.amount); }
    const expenseBreakdown = Object.entries(expCats).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);

    setData({ totalSales, totalExpenses, profit, creditCollected, topMeds, expirySummary, expenseBreakdown });
    setLoading(false);
  }, [bunkId, month, year]);

  useEffect(() => { load(); }, [load]);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const handleExportCSV = () => {
    if (!sales || sales.length === 0) return;
    const headers = ['Date', 'Customer', 'Amount', 'Mode'];
    const rows = sales.map((s: any) => [s.sale_date || s.created_at?.substring(0,10), s.customer_name || '-', s.total_amount || s.amount || 0, s.payment_mode || '-']);
    const csv = [headers, ...rows].map(r => r.map(String).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `medical-report.csv`; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none">
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none">
          {[now.getFullYear()-1, now.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={load} className="p-2 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100"><RefreshCw className="w-4 h-4" /></button>
        <button onClick={handleExportCSV} disabled={!sales.length} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm disabled:opacity-40"><Download className="w-4 h-4" /> Export CSV</button>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : !data ? null : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-teal-500">
              <div className="text-xs text-gray-500 mb-1">Total Sales</div>
              <div className="text-2xl font-bold text-teal-700">₹{data.totalSales.toFixed(0)}</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-500">
              <div className="text-xs text-gray-500 mb-1">Expenses</div>
              <div className="text-2xl font-bold text-red-700">₹{data.totalExpenses.toFixed(0)}</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500">
              <div className="text-xs text-gray-500 mb-1">Profit</div>
              <div className={`text-2xl font-bold ${data.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>₹{data.profit.toFixed(0)}</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
              <div className="text-xs text-gray-500 mb-1">Credit Collected</div>
              <div className="text-2xl font-bold text-blue-700">₹{data.creditCollected.toFixed(0)}</div>
            </div>
          </div>

          {(data.expirySummary.expired > 0 || data.expirySummary.within30 > 0 || data.expirySummary.within90 > 0) && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-teal-600" /> Expiry Status</h3>
              <div className="flex gap-3 flex-wrap">
                {data.expirySummary.expired > 0 && <span className="px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-sm font-medium">{data.expirySummary.expired} Expired</span>}
                {data.expirySummary.within30 > 0 && <span className="px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 text-sm font-medium">{data.expirySummary.within30} Expiring &lt;30d</span>}
                {data.expirySummary.within90 > 0 && <span className="px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700 text-sm font-medium">{data.expirySummary.within90} Expiring &lt;90d</span>}
              </div>
            </div>
          )}

          {data.topMeds.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-teal-600" /> Top Medicines</h3>
              <div className="space-y-2">
                {data.topMeds.map((m, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-5">{i+1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="font-medium text-gray-700 truncate">{m.name}</span>
                        <span className="font-semibold text-teal-700 ml-2">₹{m.revenue.toFixed(0)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (m.revenue / (data.topMeds[0]?.revenue || 1)) * 100)}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 w-14 text-right">{m.qty} sold</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.expenseBreakdown.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-teal-600" /> Expense Breakdown</h3>
              <div className="space-y-1">
                {data.expenseBreakdown.map((e, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 border-b last:border-0">
                    <span className="text-sm text-gray-600">{e.category}</span>
                    <span className="font-semibold text-red-600">₹{e.amount.toFixed(0)}</span>
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

export function MedicalApp({ bunkId, onLogout, user }: { bunkId: string; onLogout: () => void; user: { name: string; email: string; role: string } }) {
  const [tab, setTab] = useState<'dashboard'|'inventory'|'sales'|'customers'|'purchases'|'expenses'|'expiry'|'reports'|'intelligence'|'settings'>('dashboard');
  const [products, setProducts] = useState<MedProduct[]>([]);
  const [customers, setCustomers] = useState<MedCustomer[]>([]);
  const [sales, setSales] = useState<MedSale[]>([]);
  const [purchases, setPurchases] = useState<MedPurchase[]>([]);
  const [expenses, setExpenses] = useState<MedExpense[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ todaySales:0, todayCash:0, todayCredit:0, todayExpenses:0, totalOutstanding:0, expiryAlerts:0, lowStockCount:0, stockValue:0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<{type:'success'|'error', text:string}|null>(null);
  // BUG-FIX: Replace browser confirm() with React state modal (confirm() is blocked on mobile PWA)
  const [confirmState, setConfirmState] = useState<{ msg: string; onYes: () => void } | null>(null);
  const showConfirm = (message: string, onYes: () => void) => setConfirmState({ msg: message, onYes });
  const [saving, setSaving] = useState(false);
  const [ledgerCust, setLedgerCust] = useState<MedCustomer|null>(null);
  const [adjustProduct, setAdjustProduct] = useState<MedProduct|null>(null);
  const [adjustMode, setAdjustMode] = useState<'add'|'remove'>('add');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('Physical count');
  const [adjustSaving, setAdjustSaving] = useState(false);

  // inventory form
  const [showProductForm, setShowProductForm] = useState(false);
  const [editProduct, setEditProduct] = useState<MedProduct|null>(null);
  const [productForm, setProductForm] = useState({ name:'', generic_name:'', brand:'', category:'Tablets & Capsules', unit:'strip', form:'Tablet', strength:'', selling_price:'', purchase_price:'', mrp:'', current_stock:'', reorder_level:'10', batch_number:'', expiry_date:'', hsn_code:'', requires_prescription:false });

  // sales / billing
  const [showBilling, setShowBilling] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartSearch, setCartSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<MedCustomer|null>(null);
  const [billingMode, setBillingMode] = useState('cash');
  const [billingDiscount, setBillingDiscount] = useState('0');
  const [prescriptionRef, setPrescriptionRef] = useState('');
  const [savingBill, setSavingBill] = useState(false);

  // customer form
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name:'', phone:'', address:'', customer_type:'Retail', credit_limit:'0' });
  const [showPaymentModal, setShowPaymentModal] = useState<MedCustomer|null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [custSearch, setCustSearch] = useState('');
  const [custPage, setCustPage] = useState(0);
  const CUST_PAGE_SIZE = 10;

  // purchase form
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({ supplier_name:'', invoice_number:'', purchase_date: todayDate(), total_amount:'', notes:'' });

  // expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category:'Rent', description:'', amount:'', expense_date: todayDate(), payment_mode:'cash', notes:'' });

  const flash = (type: 'success'|'error', text: string) => {
    setMsg({type, text});
    setTimeout(() => setMsg(null), 3500);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const today = todayDate();
    const [prodRes, custRes, saleRes, purRes, expRes] = await Promise.all([
      supabase.from('med_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('med_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('med_sales').select('*').eq('bunk_id', bunkId).order('created_at', { ascending: false }).limit(200),
      supabase.from('med_purchases').select('*').eq('bunk_id', bunkId).order('purchase_date', { ascending: false }).limit(100),
      supabase.from('med_expenses').select('*').eq('bunk_id', bunkId).order('expense_date', { ascending: false }).limit(100),
    ]);
    const p = prodRes.data || [];
    const c = custRes.data || [];
    const s = saleRes.data || [];
    const pur = purRes.data || [];
    const exp = expRes.data || [];

    setProducts(p);
    setCustomers(c);
    setSales(s);
    setPurchases(pur);
    setExpenses(exp);

    const todaySales = s.filter(x => x.sale_date === today);
    const todayCash = todaySales.filter(x => x.payment_mode !== 'credit').reduce((a,x) => a + Number(x.total_amount), 0);
    const todayCredit = todaySales.filter(x => x.payment_mode === 'credit').reduce((a,x) => a + Number(x.total_amount), 0);
    const todayExp = exp.filter(x => x.expense_date === today).reduce((a,x) => a + Number(x.amount), 0);
    const totalOutstanding = c.reduce((a,x) => a + Number(x.outstanding_amount || 0), 0);
    const expiryAlerts = p.filter(x => x.expiry_date && daysToExpiry(x.expiry_date) <= 60).length;
    const lowStockCount = p.filter(x => Number(x.current_stock) <= Number(x.reorder_level)).length;
    const stockValue = p.reduce((a,x) => a + Number(x.current_stock) * Number(x.purchase_price), 0);

    setStats({ todaySales: todayCash + todayCredit, todayCash, todayCredit, todayExpenses: todayExp, totalOutstanding, expiryAlerts, lowStockCount, stockValue });
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Product CRUD ──────────────────────────────────────────────────────────
  const openNewProduct = () => {
    setEditProduct(null);
    setProductForm({ name:'', generic_name:'', brand:'', category:'Tablets & Capsules', unit:'strip', form:'Tablet', strength:'', selling_price:'', purchase_price:'', mrp:'', current_stock:'', reorder_level:'10', batch_number:'', expiry_date:'', hsn_code:'', requires_prescription:false });
    setShowProductForm(true);
  };

  const openEditProduct = (p: MedProduct) => {
    setEditProduct(p);
    setProductForm({ name:p.name, generic_name:p.generic_name||'', brand:p.brand||'', category:p.category, unit:p.unit, form:p.form||'Tablet', strength:p.strength||'', selling_price:String(p.selling_price), purchase_price:String(p.purchase_price), mrp:String(p.mrp), current_stock:String(p.current_stock), reorder_level:String(p.reorder_level), batch_number:p.batch_number||'', expiry_date:p.expiry_date||'', hsn_code:p.hsn_code||'', requires_prescription:p.requires_prescription||false });
    setShowProductForm(true);
  };

  const saveProduct = async () => {
    if (!productForm.name.trim()) return flash('error', 'Medicine name is required');
    if (!productForm.selling_price) return flash('error', 'Selling price is required');
    setSaving(true);
    const payload = {
      bunk_id: bunkId,
      name: productForm.name.trim(),
      generic_name: productForm.generic_name.trim(),
      brand: productForm.brand.trim(),
      category: productForm.category,
      unit: productForm.unit,
      form: productForm.form,
      strength: productForm.strength.trim(),
      selling_price: parseFloat(productForm.selling_price) || 0,
      purchase_price: parseFloat(productForm.purchase_price) || 0,
      mrp: parseFloat(productForm.mrp) || 0,
      current_stock: parseFloat(productForm.current_stock) || 0,
      reorder_level: parseFloat(productForm.reorder_level) || 10,
      batch_number: productForm.batch_number.trim(),
      expiry_date: productForm.expiry_date || null,
      hsn_code: productForm.hsn_code.trim(),
      requires_prescription: productForm.requires_prescription,
      is_active: true,
    };
    if (editProduct) {
      // BUG-FIX: add bunk_id guard to prevent cross-tenant update
      const { error } = await supabase.from('med_products').update(payload).eq('id', editProduct.id).eq('bunk_id', bunkId);
      setSaving(false);
      if (error) return flash('error', error.message);
      flash('success', 'Medicine updated');
    } else {
      const { error } = await supabase.from('med_products').insert(payload);
      setSaving(false);
      if (error) return flash('error', error.message);
      flash('success', 'Medicine added');
    }
    setShowProductForm(false);
    loadAll();
  };

  const deleteProduct = (id: string, name: string) => {
    // BUG-FIX: use React modal instead of no-confirm delete; also add bunk_id guard
    showConfirm(`Remove "${name}" from inventory?`, async () => {
      const { error } = await supabase.from('med_products').update({ is_active: false }).eq('id', id).eq('bunk_id', bunkId);
      if (error) return flash('error', error.message);
      flash('success', 'Medicine removed');
      loadAll();
    });
  };

  // ── Billing ───────────────────────────────────────────────────────────────
  const addToCart = (p: MedProduct) => {
    setCart(prev => {
      const exists = prev.find(x => x.product_id === p.id);
      if (exists) return prev.map(x => x.product_id === p.id ? { ...x, quantity: x.quantity+1, total_price: (x.quantity+1)*x.unit_price } : x);
      return [...prev, { product_id:p.id, product_name:p.name, batch_number:p.batch_number||'', expiry_date:p.expiry_date||'', quantity:1, unit_price:p.selling_price, mrp:p.mrp, total_price:p.selling_price }];
    });
  };

  const updateCartItem = (productId: string, field: 'quantity'|'unit_price', value: number) => {
    setCart(prev => prev.map(x => {
      if (x.product_id !== productId) return x;
      const q = field === 'quantity' ? value : x.quantity;
      const p = field === 'unit_price' ? value : x.unit_price;
      return { ...x, [field]: value, total_price: q * p };
    }));
  };

  const cartTotal = cart.reduce((a,x) => a + x.total_price, 0);
  const discount = parseFloat(billingDiscount) || 0;
  const billFinal = Math.max(0, cartTotal - discount);

  const saveBill = async () => {
    if (!cart.length) return flash('error', 'Cart is empty');
    if (billingMode === 'credit' && !selectedCustomer) return flash('error', 'Select a customer for credit sale');
    if (billingMode === 'credit' && selectedCustomer) {
      const newOutstanding = Number(selectedCustomer.outstanding_amount) + billFinal;
      if (selectedCustomer.credit_limit > 0 && newOutstanding > selectedCustomer.credit_limit) {
        return flash('error', `Credit limit exceeded! Limit: ₹${selectedCustomer.credit_limit}, Would be: ₹${newOutstanding.toFixed(0)}`);
      }
    }
    setSavingBill(true);
    const { data: saleData, error: saleErr } = await supabase.from('med_sales').insert({
      bunk_id: bunkId,
      customer_id: selectedCustomer?.id || null,
      customer_name: selectedCustomer?.name || 'Walk-in',
      sale_date: todayDate(),
      total_amount: billFinal,
      discount_amount: discount,
      payment_mode: billingMode,
      payment_status: billingMode === 'credit' ? 'pending' : 'paid',
      prescription_ref: prescriptionRef,
    }).select().single();
    if (saleErr || !saleData) { setSavingBill(false); return flash('error', saleErr?.message || 'Sale failed'); }

    const items = cart.map(x => ({ sale_id: saleData.id, bunk_id: bunkId, product_id: x.product_id, product_name: x.product_name, batch_number: x.batch_number, expiry_date: x.expiry_date||null, quantity: x.quantity, unit_price: x.unit_price, total_price: x.total_price }));
    await supabase.from('med_sale_items').insert(items);

    // BUG-FIX: read fresh stock from DB to prevent race-condition overwrites; also add bunk_id guard
    for (const item of cart) {
      const { data: freshProd } = await supabase.from('med_products').select('current_stock').eq('id', item.product_id).eq('bunk_id', bunkId).single();
      const newStock = Math.max(0, Number(freshProd?.current_stock || 0) - item.quantity);
      await supabase.from('med_products').update({ current_stock: newStock }).eq('id', item.product_id).eq('bunk_id', bunkId);
    }

    if (billingMode === 'credit' && selectedCustomer) {
      const { data: freshCust } = await supabase.from('med_customers').select('outstanding_amount').eq('id', selectedCustomer.id).eq('bunk_id', bunkId).maybeSingle();
      const base = freshCust ? Number(freshCust.outstanding_amount) : Number(selectedCustomer.outstanding_amount);
      await supabase.from('med_customers').update({ outstanding_amount: base + billFinal }).eq('id', selectedCustomer.id).eq('bunk_id', bunkId);
    }

    setSavingBill(false);
    flash('success', `Bill saved ₹${billFinal.toFixed(2)}`);
    setCart([]); setSelectedCustomer(null); setBillingMode('cash'); setBillingDiscount('0'); setPrescriptionRef('');
    setShowBilling(false);
    loadAll();
  };

  // ── Customer CRUD ─────────────────────────────────────────────────────────
  const saveCustomer = async () => {
    if (!customerForm.name.trim()) return flash('error', 'Customer name required');
    const { error } = await supabase.from('med_customers').insert({
      bunk_id: bunkId, name: customerForm.name.trim(), phone: customerForm.phone.trim(),
      address: customerForm.address.trim(), customer_type: customerForm.customer_type,
      credit_limit: parseFloat(customerForm.credit_limit) || 0, outstanding_amount: 0, is_active: true,
    });
    if (error) return flash('error', error.message);
    flash('success', 'Customer added');
    setShowCustomerForm(false);
    setCustomerForm({ name:'', phone:'', address:'', customer_type:'Retail', credit_limit:'0' });
    loadAll();
  };

  const recordPayment = async () => {
    if (!showPaymentModal) return;
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) return flash('error', 'Enter valid amount');
    await supabase.from('med_payments').insert({
      bunk_id: bunkId, customer_id: showPaymentModal.id, customer_name: showPaymentModal.name,
      amount: amt, payment_mode: paymentMode, payment_date: todayDate(),
    });
    const { data: freshC } = await supabase.from('med_customers').select('outstanding_amount').eq('id', showPaymentModal.id).eq('bunk_id', bunkId).maybeSingle();
    const base = freshC ? Number(freshC.outstanding_amount) : Number(showPaymentModal.outstanding_amount);
    const { error } = await supabase.from('med_customers').update({ outstanding_amount: Math.max(0, base - amt) }).eq('id', showPaymentModal.id).eq('bunk_id', bunkId);
    if (error) return flash('error', error.message);
    flash('success', `Payment of ₹${amt} recorded`);
    setShowPaymentModal(null); setPaymentAmount(''); setPaymentMode('cash');
    loadAll();
  };

  // ── Purchase ──────────────────────────────────────────────────────────────
  const savePurchase = async () => {
    if (!purchaseForm.supplier_name.trim()) return flash('error', 'Supplier name required');
    if (!purchaseForm.total_amount) return flash('error', 'Amount required');
    const { error } = await supabase.from('med_purchases').insert({ bunk_id: bunkId, ...purchaseForm, total_amount: parseFloat(purchaseForm.total_amount) });
    if (error) return flash('error', error.message);
    flash('success', 'Purchase saved');
    setShowPurchaseForm(false);
    setPurchaseForm({ supplier_name:'', invoice_number:'', purchase_date: todayDate(), total_amount:'', notes:'' });
    loadAll();
  };

  // ── Expense ───────────────────────────────────────────────────────────────
  const saveExpense = async () => {
    if (!expenseForm.description.trim()) return flash('error', 'Description required');
    if (!expenseForm.amount) return flash('error', 'Amount required');
    const { error } = await supabase.from('med_expenses').insert({ bunk_id: bunkId, ...expenseForm, amount: parseFloat(expenseForm.amount) });
    if (error) return flash('error', error.message);
    flash('success', 'Expense saved');
    setShowExpenseForm(false);
    setExpenseForm({ category:'Rent', description:'', amount:'', expense_date: todayDate(), payment_mode:'cash', notes:'' });
    loadAll();
  };

  const handleAdjust = async () => {
    if (!adjustProduct) return;
    const qty = parseFloat(adjustQty);
    if (!qty || qty <= 0) return flash('error', 'Enter valid quantity');
    setAdjustSaving(true);
    const { data: fresh } = await supabase.from('med_products').select('current_stock').eq('id', adjustProduct.id).eq('bunk_id', bunkId).single();
    const base = Number(fresh?.current_stock || 0);
    const newStock = adjustMode === 'add' ? base + qty : Math.max(0, base - qty);
    const { error } = await supabase.from('med_products').update({ current_stock: newStock }).eq('id', adjustProduct.id).eq('bunk_id', bunkId);
    setAdjustSaving(false);
    if (error) return flash('error', error.message);
    flash('success', `Stock ${adjustMode === 'add' ? 'added' : 'removed'}: ${qty}`);
    setAdjustProduct(null); setAdjustQty('');
    loadAll();
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.generic_name||'').toLowerCase().includes(search.toLowerCase()) || (p.brand||'').toLowerCase().includes(search.toLowerCase()));
  const expiryProducts = products.filter(p => p.expiry_date).sort((a,b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
  const cartSearchProducts = products.filter(p => p.name.toLowerCase().includes(cartSearch.toLowerCase()) || (p.generic_name||'').toLowerCase().includes(cartSearch.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-teal-700 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Pill className="w-6 h-6" />
          <div>
            <div className="font-bold text-lg">Medical Shop</div>
            <div className="text-teal-200 text-xs">Stock: ₹{stats.stockValue.toFixed(0)} | Expiry Alerts: {stats.expiryAlerts}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={loadAll} className="p-2 rounded-full hover:bg-teal-600">
            <RefreshCw className="w-5 h-5" />
          </button>
          <button onClick={onLogout} className="p-2 rounded-lg hover:bg-white/20 transition" title="Sign Out">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Flash message */}
      {msg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${msg.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {msg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b flex overflow-x-auto text-sm font-medium">
        {([
          ['dashboard','Dashboard',BarChart2],
          ['inventory','Inventory',Package],
          ['sales','Billing',ShoppingCart],
          ['customers','Customers',Users],
          ['purchases','Purchases',Truck],
          ['expenses','Expenses',DollarSign],
          ['expiry','Expiry Tracker',Clock],
          ['reports','Reports',FileText],
          ['intelligence','AI Insights',Brain],
          ['settings','Settings',SettingsIcon],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key as typeof tab)}
            className={`flex items-center gap-1.5 px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${tab === key ? 'border-teal-600 text-teal-700 bg-teal-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" />{label}
            {key === 'expiry' && stats.expiryAlerts > 0 && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{stats.expiryAlerts}</span>}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-6xl mx-auto">

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-teal-500">
                <div className="text-xs text-gray-500 mb-1">Today's Sales</div>
                <div className="text-2xl font-bold text-teal-700">₹{stats.todaySales.toFixed(0)}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500">
                <div className="text-xs text-gray-500 mb-1">Cash Received</div>
                <div className="text-2xl font-bold text-green-700">₹{stats.todayCash.toFixed(0)}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-orange-500">
                <div className="text-xs text-gray-500 mb-1">Credit Sales</div>
                <div className="text-2xl font-bold text-orange-700">₹{stats.todayCredit.toFixed(0)}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-500">
                <div className="text-xs text-gray-500 mb-1">Today's Expenses</div>
                <div className="text-2xl font-bold text-red-700">₹{stats.todayExpenses.toFixed(0)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-purple-500">
                <div className="text-xs text-gray-500 mb-1">Credit Outstanding</div>
                <div className="text-2xl font-bold text-purple-700">₹{stats.totalOutstanding.toFixed(0)}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-400">
                <div className="text-xs text-gray-500 mb-1">Expiry Alerts</div>
                <div className="text-2xl font-bold text-red-600">{stats.expiryAlerts}</div>
                <div className="text-xs text-gray-400">within 60 days</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-yellow-500">
                <div className="text-xs text-gray-500 mb-1">Low Stock Items</div>
                <div className="text-2xl font-bold text-yellow-700">{stats.lowStockCount}</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
                <div className="text-xs text-gray-500 mb-1">Stock Value</div>
                <div className="text-2xl font-bold text-blue-700">₹{stats.stockValue.toFixed(0)}</div>
              </div>
            </div>

            {/* Daily Checklist */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-teal-600" />Daily Checklist</h3>
              <div className="space-y-2">
                {[
                  { done: stats.expiryAlerts === 0, text: 'Check medicines expiring within 60 days', action: () => setTab('expiry') },
                  { done: stats.lowStockCount === 0, text: 'Reorder low-stock medicines', action: () => { setTab('inventory'); setSearch(''); } },
                  { done: stats.todaySales > 0, text: 'Record today\'s sales', action: () => setShowBilling(true) },
                  { done: stats.totalOutstanding === 0, text: `Collect outstanding payments (₹${stats.totalOutstanding.toFixed(0)})`, action: () => setTab('customers') },
                ].map((item, i) => (
                  <div key={i} onClick={item.action} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${item.done ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                      {item.done ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    </div>
                    <span className={`text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.text}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                  </div>
                ))}
              </div>
            </div>

            {/* Recent sales */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-3">Recent Sales</h3>
              <div className="divide-y">
                {sales.slice(0, 8).map(s => (
                  <div key={s.id} className="py-2 flex justify-between text-sm">
                    <div>
                      <span className="font-medium">{s.customer_name}</span>
                      <span className="text-gray-400 ml-2">{s.sale_date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${s.payment_mode === 'credit' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{s.payment_mode}</span>
                      <span className="font-semibold">₹{Number(s.total_amount).toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── INVENTORY ── */}
        {tab === 'inventory' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, generic, brand..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
              </div>
              <button onClick={openNewProduct} className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-teal-700">
                <Plus className="w-4 h-4" /> Add Medicine
              </button>
            </div>
            {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> : (
              <div className="grid gap-2">
                {filteredProducts.map(p => {
                  const days = p.expiry_date ? daysToExpiry(p.expiry_date) : 999;
                  const lowStock = p.current_stock <= p.reorder_level;
                  return (
                    <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm border flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800 text-sm">{p.name}</span>
                          {p.strength && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{p.strength}</span>}
                          {p.requires_prescription && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Rx</span>}
                          <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded">{p.form}</span>
                        </div>
                        {p.generic_name && <div className="text-xs text-gray-500 mt-0.5">Generic: {p.generic_name}</div>}
                        {p.brand && <div className="text-xs text-gray-400">Brand: {p.brand}</div>}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-gray-500">MRP: ₹{p.mrp}</span>
                          <span className="text-xs text-teal-700 font-medium">Sell: ₹{p.selling_price}</span>
                          <span className={`text-xs font-medium ${lowStock ? 'text-red-600' : 'text-gray-600'}`}>Stock: {p.current_stock} {p.unit}</span>
                          {p.expiry_date && <span className={`text-xs px-1.5 py-0.5 rounded-full ${expiryColor(days)}`}>Exp: {new Date(p.expiry_date).toLocaleDateString('en-IN', {month:'short', year:'numeric'})}</span>}
                        </div>
                        {p.batch_number && <div className="text-xs text-gray-400 mt-0.5">Batch: {p.batch_number}</div>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => addToCart(p)} className="p-1.5 bg-teal-100 text-teal-700 rounded hover:bg-teal-200"><ShoppingCart className="w-4 h-4" /></button>
                        <button onClick={() => openEditProduct(p)} className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"><FileText className="w-4 h-4" /></button>
                        <button onClick={() => deleteProduct(p.id, p.name)} className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200"><X className="w-4 h-4" /></button>
                        <button onClick={() => { setAdjustProduct(p); setAdjustMode('add'); setAdjustQty(''); setAdjustReason('Physical count'); }} className="p-1.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-xs font-bold leading-none">±</button>
                      </div>
                    </div>
                  );
                })}
                {!filteredProducts.length && <div className="text-center py-10 text-gray-400">No medicines found</div>}
              </div>
            )}
          </div>
        )}

        {/* ── SALES / BILLING ── */}
        {tab === 'sales' && !showBilling && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-gray-700">Sales History</h2>
              <button onClick={() => setShowBilling(true)} className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-teal-700">
                <Receipt className="w-4 h-4" /> New Bill
              </button>
            </div>
            <div className="space-y-2">
              {sales.map(s => (
                <div key={s.id} className="bg-white rounded-xl p-3 shadow-sm flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm">{s.customer_name}</div>
                    <div className="text-xs text-gray-400">{s.sale_date} {s.prescription_ref && `| Rx: ${s.prescription_ref}`}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-teal-700">₹{Number(s.total_amount).toFixed(2)}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.payment_mode === 'credit' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{s.payment_mode}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── BILLING FORM ── */}
        {tab === 'sales' && showBilling && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => { setShowBilling(false); setCart([]); }} className="p-1 hover:bg-gray-200 rounded"><ArrowLeft className="w-5 h-5" /></button>
              <h2 className="font-semibold text-gray-700 text-lg">New Bill</h2>
            </div>

            {/* Product search */}
            <div className="bg-white rounded-xl p-3 shadow-sm">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input value={cartSearch} onChange={e => setCartSearch(e.target.value)} placeholder="Search medicine to add..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
              </div>
              {cartSearch && (
                <div className="max-h-48 overflow-y-auto divide-y border rounded-lg">
                  {cartSearchProducts.slice(0, 10).map(p => (
                    <div key={p.id} onClick={() => { addToCart(p); setCartSearch(''); }} className="px-3 py-2 hover:bg-teal-50 cursor-pointer flex justify-between text-sm">
                      <div>
                        <span className="font-medium">{p.name}</span>
                        {p.strength && <span className="text-gray-500 ml-1 text-xs">{p.strength}</span>}
                        {p.requires_prescription && <span className="text-xs text-red-600 ml-1">Rx</span>}
                        <div className="text-xs text-gray-400">{p.generic_name} | Stock: {p.current_stock} {p.unit}</div>
                      </div>
                      <span className="font-semibold text-teal-700">₹{p.selling_price}</span>
                    </div>
                  ))}
                  {!cartSearchProducts.length && <div className="px-3 py-2 text-gray-400 text-sm">No medicines found</div>}
                </div>
              )}
            </div>

            {/* Cart */}
            {cart.length > 0 && (
              <div className="bg-white rounded-xl p-3 shadow-sm">
                <h3 className="font-medium text-gray-700 mb-2">Cart ({cart.length} items)</h3>
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.product_id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <div className="flex-1 text-sm font-medium">{item.product_name}</div>
                      <input type="number" value={item.quantity} min={1} onChange={e => updateCartItem(item.product_id, 'quantity', parseFloat(e.target.value)||1)}
                        className="w-16 border rounded px-1 py-0.5 text-sm text-center" />
                      <span className="text-gray-400 text-xs">×</span>
                      <input type="number" value={item.unit_price} min={0} onChange={e => updateCartItem(item.product_id, 'unit_price', parseFloat(e.target.value)||0)}
                        className="w-20 border rounded px-1 py-0.5 text-sm text-center" />
                      <span className="font-medium w-20 text-right text-sm">₹{item.total_price.toFixed(2)}</span>
                      <button onClick={() => setCart(prev => prev.filter(x => x.product_id !== item.product_id))} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Billing options */}
            <div className="bg-white rounded-xl p-3 shadow-sm space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Customer (optional)</label>
                <select value={selectedCustomer?.id || ''} onChange={e => setSelectedCustomer(customers.find(c => c.id === e.target.value)||null)}
                  className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none">
                  <option value="">Walk-in Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} — Bal: ₹{c.outstanding_amount}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Payment Mode</label>
                  <select value={billingMode} onChange={e => setBillingMode(e.target.value)} className="w-full mt-1 border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none">
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Discount (₹)</label>
                  <input type="number" value={billingDiscount} onChange={e => setBillingDiscount(e.target.value)} className="w-full mt-1 border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Prescription Ref</label>
                  <input type="text" value={prescriptionRef} onChange={e => setPrescriptionRef(e.target.value)} placeholder="Dr. / Ref #" className="w-full mt-1 border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
                </div>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <div>
                  <div className="text-sm text-gray-500">Subtotal: ₹{cartTotal.toFixed(2)} {discount > 0 && `— Discount: ₹${discount.toFixed(2)}`}</div>
                  <div className="text-xl font-bold text-teal-700">Total: ₹{billFinal.toFixed(2)}</div>
                </div>
                <button onClick={saveBill} disabled={savingBill || !cart.length} className="bg-teal-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50">
                  {savingBill ? 'Saving...' : 'Save Bill'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CUSTOMERS ── */}
        {tab === 'customers' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-gray-700">Customers</h2>
                <div className="text-xs text-gray-400">Total Outstanding: ₹{stats.totalOutstanding.toFixed(0)}</div>
              </div>
              <button onClick={() => setShowCustomerForm(true)} className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-teal-700">
                <Plus className="w-4 h-4" /> Add Customer
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input value={custSearch} onChange={e => { setCustSearch(e.target.value); setCustPage(0); }} placeholder="Search customers…" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
            </div>
            {showCustomerForm && (
              <div className="bg-white rounded-xl p-4 shadow-sm border space-y-3">
                <h3 className="font-semibold text-gray-700">New Customer</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-500">Name *</label><input value={customerForm.name} onChange={e => setCustomerForm(f=>({...f, name:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                  <div><label className="text-xs text-gray-500">Phone</label><input value={customerForm.phone} onChange={e => setCustomerForm(f=>({...f, phone:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                  <div><label className="text-xs text-gray-500">Customer Type</label>
                    <select value={customerForm.customer_type} onChange={e => setCustomerForm(f=>({...f, customer_type:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none">
                      {CUSTOMER_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs text-gray-500">Credit Limit (₹)</label><input type="number" value={customerForm.credit_limit} onChange={e => setCustomerForm(f=>({...f, credit_limit:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500">Address</label><input value={customerForm.address} onChange={e => setCustomerForm(f=>({...f, address:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveCustomer} className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-teal-700">Save</button>
                  <button onClick={() => setShowCustomerForm(false)} className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
                </div>
              </div>
            )}
            {(() => {
              const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch));
              const pagedCustomers = filteredCustomers.slice(custPage * CUST_PAGE_SIZE, (custPage + 1) * CUST_PAGE_SIZE);
              return (
                <>
                  {pagedCustomers.map(c => (
                    <div key={c.id} className="bg-white rounded-xl p-3 shadow-sm flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-sm">{c.name}</div>
                        <div className="text-xs text-gray-500">{c.phone} | {c.customer_type}</div>
                        {Number(c.outstanding_amount) > 0 && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-medium text-orange-600">Outstanding: ₹{Number(c.outstanding_amount).toFixed(0)}</span>
                            {agingBadge(c.last_payment_date)}
                          </div>
                        )}
                        {Number(c.credit_limit) > 0 && <div className="text-xs text-gray-400">Limit: ₹{c.credit_limit}</div>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setLedgerCust(c)} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-medium hover:bg-blue-200">Ledger</button>
                        {Number(c.outstanding_amount) > 0 && (
                          <button onClick={() => setShowPaymentModal(c)} className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-200">Collect</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredCustomers.length > CUST_PAGE_SIZE && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white rounded-xl">
                      <span className="text-xs text-gray-500">{filteredCustomers.length} total · showing {custPage * CUST_PAGE_SIZE + 1}–{Math.min((custPage + 1) * CUST_PAGE_SIZE, filteredCustomers.length)}</span>
                      <div className="flex gap-2">
                        <button onClick={() => setCustPage(p => Math.max(0, p - 1))} disabled={custPage === 0} className="px-3 py-1 text-xs border rounded disabled:opacity-40">Prev</button>
                        <button onClick={() => setCustPage(p => p + 1)} disabled={(custPage + 1) * CUST_PAGE_SIZE >= filteredCustomers.length} className="px-3 py-1 text-xs border rounded disabled:opacity-40">Next</button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* ── PURCHASES ── */}
        {tab === 'purchases' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-gray-700">Purchases</h2>
              <button onClick={() => setShowPurchaseForm(true)} className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-teal-700">
                <Plus className="w-4 h-4" /> Add Purchase
              </button>
            </div>
            {showPurchaseForm && (
              <div className="bg-white rounded-xl p-4 shadow-sm border space-y-3">
                <h3 className="font-semibold text-gray-700">New Purchase</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-500">Supplier *</label><input value={purchaseForm.supplier_name} onChange={e => setPurchaseForm(f=>({...f, supplier_name:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                  <div><label className="text-xs text-gray-500">Invoice #</label><input value={purchaseForm.invoice_number} onChange={e => setPurchaseForm(f=>({...f, invoice_number:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                  <div><label className="text-xs text-gray-500">Date</label><input type="date" value={purchaseForm.purchase_date} onChange={e => setPurchaseForm(f=>({...f, purchase_date:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                  <div><label className="text-xs text-gray-500">Amount *</label><input type="number" value={purchaseForm.total_amount} onChange={e => setPurchaseForm(f=>({...f, total_amount:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><input value={purchaseForm.notes} onChange={e => setPurchaseForm(f=>({...f, notes:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={savePurchase} className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-teal-700">Save</button>
                  <button onClick={() => setShowPurchaseForm(false)} className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {purchases.map(p => (
                <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm flex justify-between">
                  <div>
                    <div className="font-medium text-sm">{p.supplier_name}</div>
                    <div className="text-xs text-gray-400">{p.purchase_date} {p.invoice_number && `| Inv: ${p.invoice_number}`}</div>
                    {p.notes && <div className="text-xs text-gray-400">{p.notes}</div>}
                  </div>
                  <div className="font-bold text-teal-700">₹{Number(p.total_amount).toFixed(0)}</div>
                </div>
              ))}
              {!purchases.length && <div className="text-center py-10 text-gray-400">No purchases yet</div>}
            </div>
          </div>
        )}

        {/* ── EXPENSES ── */}
        {tab === 'expenses' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-gray-700">Expenses</h2>
              <button onClick={() => setShowExpenseForm(true)} className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-teal-700">
                <Plus className="w-4 h-4" /> Add Expense
              </button>
            </div>
            {showExpenseForm && (
              <div className="bg-white rounded-xl p-4 shadow-sm border space-y-3">
                <h3 className="font-semibold text-gray-700">New Expense</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-500">Category</label>
                    <select value={expenseForm.category} onChange={e => setExpenseForm(f=>({...f, category:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none">
                      {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label className="text-xs text-gray-500">Amount *</label><input type="number" value={expenseForm.amount} onChange={e => setExpenseForm(f=>({...f, amount:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                  <div><label className="text-xs text-gray-500">Date</label><input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm(f=>({...f, expense_date:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                  <div><label className="text-xs text-gray-500">Payment Mode</label>
                    <select value={expenseForm.payment_mode} onChange={e => setExpenseForm(f=>({...f, payment_mode:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none">
                      {['cash','upi','card'].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2"><label className="text-xs text-gray-500">Description *</label><input value={expenseForm.description} onChange={e => setExpenseForm(f=>({...f, description:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveExpense} className="bg-teal-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-teal-700">Save</button>
                  <button onClick={() => setShowExpenseForm(false)} className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {expenses.map(e => (
                <div key={e.id} className="bg-white rounded-xl p-3 shadow-sm flex justify-between">
                  <div>
                    <div className="font-medium text-sm">{e.description}</div>
                    <div className="text-xs text-gray-400">{e.expense_date} | {e.category} | {e.payment_mode}</div>
                  </div>
                  <div className="font-bold text-red-600">₹{Number(e.amount).toFixed(0)}</div>
                </div>
              ))}
              {!expenses.length && <div className="text-center py-10 text-gray-400">No expenses yet</div>}
            </div>
          </div>
        )}

        {/* ── EXPIRY TRACKER ── */}
        {tab === 'expiry' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-600" />
              <h2 className="font-semibold text-gray-700">Expiry Tracker</h2>
            </div>
            {[
              { label: 'Expired', filter: (d: number) => d < 0, color: 'red' },
              { label: 'Expiring in 30 days', filter: (d: number) => d >= 0 && d <= 30, color: 'orange' },
              { label: 'Expiring in 31–90 days', filter: (d: number) => d > 30 && d <= 90, color: 'yellow' },
              { label: 'Safe (>90 days)', filter: (d: number) => d > 90, color: 'green' },
            ].map(group => {
              const items = expiryProducts.filter(p => group.filter(daysToExpiry(p.expiry_date)));
              if (!items.length) return null;
              return (
                <div key={group.label} className="bg-white rounded-xl p-4 shadow-sm">
                  <h3 className={`font-semibold mb-2 text-${group.color}-700`}>{group.label} ({items.length})</h3>
                  <div className="space-y-1">
                    {items.map(p => {
                      const days = daysToExpiry(p.expiry_date);
                      return (
                        <div key={p.id} className="flex justify-between items-center py-1 border-b last:border-0 text-sm">
                          <div>
                            <span className="font-medium">{p.name}</span>
                            {p.strength && <span className="text-gray-500 ml-1 text-xs">{p.strength}</span>}
                            {p.batch_number && <span className="text-gray-400 ml-1 text-xs">Batch: {p.batch_number}</span>}
                          </div>
                          <div className="text-right">
                            <div className={`text-xs px-2 py-0.5 rounded-full ${expiryColor(days)}`}>
                              {days < 0 ? `${Math.abs(days)}d ago` : `${days}d left`}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">Stock: {p.current_stock}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {!expiryProducts.length && <div className="text-center py-10 text-gray-400">No medicines with expiry dates</div>}
          </div>
        )}

        {tab === 'reports' && <MedReports bunkId={bunkId} />}

        {tab === 'intelligence' && <IntelligenceTab bunkId={bunkId} />}

        {tab === 'settings' && <SettingsTab bunkId={bunkId} user={user} onLogout={onLogout} />}

      </div>

      {/* BUG-FIX: React-based confirm modal — replaces browser confirm() which is blocked on mobile PWA */}
      {confirmState && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-2 text-red-600 mb-3">
              <AlertTriangle className="w-5 h-5" />
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

      {/* ── PRODUCT FORM MODAL ── */}
      {showProductForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-700">{editProduct ? 'Edit Medicine' : 'Add Medicine'}</h3>
              <button onClick={() => setShowProductForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><label className="text-xs text-gray-500">Medicine/Brand Name *</label><input value={productForm.name} onChange={e => setProductForm(f=>({...f, name:e.target.value}))} placeholder="e.g. Crocin 500mg" className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Generic Name</label><input value={productForm.generic_name} onChange={e => setProductForm(f=>({...f, generic_name:e.target.value}))} placeholder="e.g. Paracetamol" className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                <div><label className="text-xs text-gray-500">Brand/Manufacturer</label><input value={productForm.brand} onChange={e => setProductForm(f=>({...f, brand:e.target.value}))} placeholder="e.g. GSK" className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                <div><label className="text-xs text-gray-500">Strength/Dosage</label><input value={productForm.strength} onChange={e => setProductForm(f=>({...f, strength:e.target.value}))} placeholder="e.g. 500mg, 5ml" className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                <div><label className="text-xs text-gray-500">Form</label>
                  <select value={productForm.form} onChange={e => setProductForm(f=>({...f, form:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none">
                    {MED_FORMS.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Category</label>
                  <select value={productForm.category} onChange={e => setProductForm(f=>({...f, category:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none">
                    {MED_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Unit</label>
                  <select value={productForm.unit} onChange={e => setProductForm(f=>({...f, unit:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none">
                    {MED_UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Selling Price *</label><input type="number" value={productForm.selling_price} onChange={e => setProductForm(f=>({...f, selling_price:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                <div><label className="text-xs text-gray-500">Purchase Price</label><input type="number" value={productForm.purchase_price} onChange={e => setProductForm(f=>({...f, purchase_price:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                <div><label className="text-xs text-gray-500">MRP</label><input type="number" value={productForm.mrp} onChange={e => setProductForm(f=>({...f, mrp:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                <div><label className="text-xs text-gray-500">Current Stock</label><input type="number" value={productForm.current_stock} onChange={e => setProductForm(f=>({...f, current_stock:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                <div><label className="text-xs text-gray-500">Reorder Level</label><input type="number" value={productForm.reorder_level} onChange={e => setProductForm(f=>({...f, reorder_level:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                <div><label className="text-xs text-gray-500">Batch Number</label><input value={productForm.batch_number} onChange={e => setProductForm(f=>({...f, batch_number:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                <div><label className="text-xs text-gray-500">Expiry Date</label><input type="month" value={productForm.expiry_date ? productForm.expiry_date.substring(0,7) : ''} onChange={e => setProductForm(f=>({...f, expiry_date: e.target.value ? e.target.value+'-01' : ''}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
                <div><label className="text-xs text-gray-500">HSN Code</label><input value={productForm.hsn_code} onChange={e => setProductForm(f=>({...f, hsn_code:e.target.value}))} className="w-full border rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={productForm.requires_prescription} onChange={e => setProductForm(f=>({...f, requires_prescription:e.target.checked}))} className="rounded" />
                Requires Prescription (Rx)
              </label>
            </div>
            <div className="p-4 border-t flex gap-2">
              <button onClick={saveProduct} disabled={saving} className="flex-1 bg-teal-600 text-white py-2 rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-60 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setShowProductForm(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── STOCK ADJUSTMENT MODAL ── */}
      {adjustProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-700">Adjust Stock</h3>
              <button onClick={() => setAdjustProduct(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="text-sm text-gray-600 mb-4"><span className="font-semibold">{adjustProduct.name}</span> — Current: {adjustProduct.current_stock} {adjustProduct.unit}</div>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setAdjustMode('add')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${adjustMode === 'add' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>+ Add</button>
              <button onClick={() => setAdjustMode('remove')} className={`flex-1 py-2 rounded-lg text-sm font-medium ${adjustMode === 'remove' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>− Remove</button>
            </div>
            <div className="space-y-2">
              <div><label className="text-xs text-gray-500">Quantity *</label>
                <input type="number" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} min={0} placeholder="0" className="w-full border rounded-lg px-3 py-2 mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" />
              </div>
              <div><label className="text-xs text-gray-500">Reason</label>
                <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)} className="w-full border rounded-lg px-3 py-2 mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none">
                  {['Physical count','Dispensing error','Damage','Expired return','Supplier return','Opening stock'].map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleAdjust} disabled={adjustSaving} className="flex-1 bg-teal-600 text-white py-2 rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50">
                {adjustSaving ? 'Saving...' : 'Apply Adjustment'}
              </button>
              <button onClick={() => setAdjustProduct(null)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LEDGER MODAL ── */}
      {ledgerCust && <MedLedgerModal bunkId={bunkId} customer={ledgerCust} onClose={() => setLedgerCust(null)} />}

      {/* ── PAYMENT MODAL ── */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-700">Collect Payment</h3>
              <button onClick={() => setShowPaymentModal(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="text-sm text-gray-600 mb-1">Customer: <span className="font-semibold">{showPaymentModal.name}</span></div>
            <div className="text-sm text-orange-600 mb-4">Outstanding: ₹{Number(showPaymentModal.outstanding_amount).toFixed(0)}</div>
            <div className="space-y-2">
              <div><label className="text-xs text-gray-500">Amount Received *</label>
                <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="Enter amount" className="w-full border rounded-lg px-3 py-2 mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none" />
              </div>
              <div><label className="text-xs text-gray-500">Payment Mode</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full border rounded-lg px-3 py-2 mt-0.5 focus:ring-2 focus:ring-teal-500 focus:outline-none">
                  {['cash','upi','card'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={recordPayment} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 flex items-center justify-center gap-2">
                <TrendingUp className="w-4 h-4" /> Record
              </button>
              <button onClick={() => setShowPaymentModal(null)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
