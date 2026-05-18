// ═══════════════════════════════════════════════════════════════════════════
// FuelDesk AI — Auto Parts Module
// Slate theme — ap_ Supabase tables
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Truck, Receipt,
  Plus, Edit2, Trash2, X, Search, AlertTriangle, CheckCircle2, Loader2,
  TrendingUp, TrendingDown, Wallet, Car, BarChart2,
  Settings as SettingsIcon, LogOut, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { SettingsTab } from './SettingsTab';
import { supabase } from './supabase';
import { getTodayIST, formatISTDate } from './utils';

function inr(n: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);
}

const CATEGORIES = ['Engine Parts', 'Electrical', 'Body Parts', 'Tyres', 'Battery', 'Filters', 'Oils & Lubricants', 'Accessories'];
const UNITS = ['piece', 'set', 'litre', 'kg', 'box'];
const PAYMENT_MODES = ['cash', 'upi', 'card', 'bank_transfer', 'credit'];
const EXPENSE_CATEGORIES = ['Rent', 'Electricity', 'Staff Salary', 'Transport', 'Repairs', 'Marketing', 'Other'];
const ADJUST_REASONS = ['Damage/Expired', 'Physical count', 'Supplier return', 'Other'];

interface Product {
  id: string; bunk_id: string; name: string; brand: string; category: string;
  unit: string; selling_price: number; purchase_price: number; mrp: number;
  current_stock: number; reorder_level: number; is_active: boolean; created_at: string;
}
interface Customer {
  id: string; bunk_id: string; name: string; phone: string; address: string;
  vehicle_number: string; vehicle_model: string;
  credit_limit: number; outstanding_amount: number; is_active: boolean; created_at: string;
}
interface Sale {
  id: string; bunk_id: string; customer_id: string | null; customer_name: string;
  vehicle_number: string; sale_date: string; total_amount: number;
  labour_charges: number; payment_mode: string; payment_status: string;
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
interface ApPayment { amount: number; payment_date: string; }

type Tab = 'dashboard' | 'inventory' | 'sales' | 'customers' | 'purchases' | 'expenses' | 'reports' | 'settings';

// ─── Onboarding Wizard ─────────────────────────────────────────────────────────
interface OnboardingProduct {
  name: string; brand: string; category: string; unit: string;
  purchase_price: number; selling_price: number; reorder_level: number;
  checked: boolean; current_stock: number;
}
interface OnboardingCustomer {
  name: string; phone: string; vehicle_number: string; vehicle_model: string; outstanding_amount: number;
}

const STEP2_PRODUCTS: Omit<OnboardingProduct, 'checked' | 'current_stock'>[] = [
  { name: 'Engine Oil 1L (20W-40)', brand: 'Castrol/Shell', category: 'Oils & Lubricants', unit: 'litre', purchase_price: 180, selling_price: 230, reorder_level: 10 },
  { name: 'Engine Oil 900ml (4T)', brand: 'HP/SERVO', category: 'Oils & Lubricants', unit: 'piece', purchase_price: 140, selling_price: 180, reorder_level: 10 },
  { name: 'Gear Oil 120ml', brand: 'HP/SERVO', category: 'Oils & Lubricants', unit: 'piece', purchase_price: 40, selling_price: 55, reorder_level: 20 },
  { name: 'Oil Filter (Universal)', brand: 'Bosch', category: 'Filters', unit: 'piece', purchase_price: 90, selling_price: 130, reorder_level: 10 },
  { name: 'Air Filter (Universal)', brand: 'Bosch', category: 'Filters', unit: 'piece', purchase_price: 120, selling_price: 160, reorder_level: 5 },
  { name: 'Coolant 1L', brand: 'Prestone', category: 'Oils & Lubricants', unit: 'piece', purchase_price: 120, selling_price: 160, reorder_level: 5 },
];
const STEP3_PRODUCTS: Omit<OnboardingProduct, 'checked' | 'current_stock'>[] = [
  { name: 'Brake Pad Set (Front)', brand: 'TVS/Bosch', category: 'Engine Parts', unit: 'set', purchase_price: 280, selling_price: 380, reorder_level: 5 },
  { name: 'Brake Shoe Set (Rear)', brand: 'TVS/Bosch', category: 'Engine Parts', unit: 'set', purchase_price: 180, selling_price: 250, reorder_level: 5 },
  { name: 'Brake Disc (Front)', brand: '', category: 'Engine Parts', unit: 'piece', purchase_price: 450, selling_price: 600, reorder_level: 3 },
  { name: 'Shock Absorber (Front)', brand: 'Gabriel', category: 'Engine Parts', unit: 'piece', purchase_price: 600, selling_price: 800, reorder_level: 2 },
  { name: 'Shock Absorber (Rear)', brand: 'Gabriel', category: 'Engine Parts', unit: 'piece', purchase_price: 500, selling_price: 680, reorder_level: 2 },
  { name: 'Clutch Plate Set', brand: '', category: 'Engine Parts', unit: 'set', purchase_price: 350, selling_price: 480, reorder_level: 3 },
];
const STEP4_PRODUCTS: Omit<OnboardingProduct, 'checked' | 'current_stock'>[] = [
  { name: 'Battery 12V 35AH', brand: 'Exide/Amara Raja', category: 'Battery', unit: 'piece', purchase_price: 2200, selling_price: 2800, reorder_level: 2 },
  { name: 'Battery 12V 65AH', brand: 'Exide/Amara Raja', category: 'Battery', unit: 'piece', purchase_price: 4500, selling_price: 5500, reorder_level: 1 },
  { name: 'Headlight Bulb H4', brand: 'Philips/Osram', category: 'Electrical', unit: 'piece', purchase_price: 80, selling_price: 120, reorder_level: 10 },
  { name: 'LED Headlight Bulb H4', brand: 'Philips', category: 'Electrical', unit: 'piece', purchase_price: 250, selling_price: 380, reorder_level: 5 },
  { name: 'Spark Plug', brand: 'NGK/Bosch', category: 'Engine Parts', unit: 'piece', purchase_price: 60, selling_price: 90, reorder_level: 20 },
  { name: 'Fuse Set (Assorted)', brand: '', category: 'Electrical', unit: 'set', purchase_price: 30, selling_price: 50, reorder_level: 20 },
];
const STEP5_PRODUCTS: Omit<OnboardingProduct, 'checked' | 'current_stock'>[] = [
  { name: 'Tyre 90/90-10 (2-wheeler)', brand: 'MRF/CEAT', category: 'Tyres', unit: 'piece', purchase_price: 900, selling_price: 1200, reorder_level: 3 },
  { name: 'Tyre 185/65R15 (Car)', brand: 'MRF/CEAT', category: 'Tyres', unit: 'piece', purchase_price: 3200, selling_price: 4000, reorder_level: 2 },
  { name: 'Drive Chain (2-wheeler)', brand: '', category: 'Engine Parts', unit: 'piece', purchase_price: 180, selling_price: 250, reorder_level: 5 },
  { name: 'Drive Belt (Scooter)', brand: '', category: 'Engine Parts', unit: 'piece', purchase_price: 250, selling_price: 350, reorder_level: 3 },
  { name: 'Wiper Blade (Pair)', brand: 'Bosch', category: 'Accessories', unit: 'set', purchase_price: 220, selling_price: 320, reorder_level: 3 },
  { name: 'Mirror Assembly (LH)', brand: '', category: 'Body Parts', unit: 'piece', purchase_price: 180, selling_price: 280, reorder_level: 3 },
];

function initProducts(base: Omit<OnboardingProduct, 'checked' | 'current_stock'>[]): OnboardingProduct[] {
  return base.map(p => ({ ...p, checked: true, current_stock: 0 }));
}

function OnboardingProductTable({
  products, onChange,
}: {
  products: OnboardingProduct[];
  onChange: (updated: OnboardingProduct[]) => void;
}) {
  const inventoryValue = products
    .filter(p => p.checked)
    .reduce((a, p) => a + p.current_stock * p.purchase_price, 0);

  function update(idx: number, field: keyof OnboardingProduct, val: string | number | boolean) {
    const copy = [...products];
    copy[idx] = { ...copy[idx], [field]: val };
    onChange(copy);
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-center w-8"></th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Brand</th>
              <th className="px-3 py-2 text-right w-20">Stock</th>
              <th className="px-3 py-2 text-right w-24">Buy ₹</th>
              <th className="px-3 py-2 text-right w-24">Sell ₹</th>
              <th className="px-3 py-2 text-left w-16">Unit</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={i} className={`border-t border-gray-100 ${!p.checked ? 'opacity-40' : ''}`}>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={p.checked} onChange={e => update(i, 'checked', e.target.checked)} className="accent-slate-700" />
                </td>
                <td className="px-3 py-2 font-medium text-gray-800">{p.name}</td>
                <td className="px-3 py-2 text-gray-500">
                  <input value={p.brand} onChange={e => update(i, 'brand', e.target.value)} className="w-full border border-gray-200 rounded px-1 py-0.5 text-xs" />
                </td>
                <td className="px-3 py-2 text-right">
                  <input type="number" value={p.current_stock} onChange={e => update(i, 'current_stock', parseFloat(e.target.value) || 0)} className="w-16 border border-gray-200 rounded px-1 py-0.5 text-xs text-right" />
                </td>
                <td className="px-3 py-2 text-right">
                  <input type="number" value={p.purchase_price} onChange={e => update(i, 'purchase_price', parseFloat(e.target.value) || 0)} className="w-20 border border-gray-200 rounded px-1 py-0.5 text-xs text-right" />
                </td>
                <td className="px-3 py-2 text-right">
                  <input type="number" value={p.selling_price} onChange={e => update(i, 'selling_price', parseFloat(e.target.value) || 0)} className="w-20 border border-gray-200 rounded px-1 py-0.5 text-xs text-right" />
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">{p.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-600 font-medium">
        Inventory value: {inr(inventoryValue)} (at purchase cost)
      </p>
    </div>
  );
}

function AutoPartsOnboarding({ bunkId, onComplete }: { bunkId: string; onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [step2Products, setStep2Products] = useState<OnboardingProduct[]>(initProducts(STEP2_PRODUCTS));
  const [step3Products, setStep3Products] = useState<OnboardingProduct[]>(initProducts(STEP3_PRODUCTS));
  const [step4Products, setStep4Products] = useState<OnboardingProduct[]>(initProducts(STEP4_PRODUCTS));
  const [step5Products, setStep5Products] = useState<OnboardingProduct[]>(initProducts(STEP5_PRODUCTS));
  const [customers, setCustomers] = useState<OnboardingCustomer[]>(
    Array.from({ length: 5 }, () => ({ name: '', phone: '', vehicle_number: '', vehicle_model: '', outstanding_amount: 0 }))
  );

  const allProducts = [...step2Products, ...step3Products, ...step4Products, ...step5Products];
  const selectedProducts = allProducts.filter(p => p.checked);
  const totalInventoryValue = selectedProducts.reduce((a, p) => a + p.current_stock * p.purchase_price, 0);
  const selectedCustomers = customers.filter(c => c.name.trim().length > 0);
  const categoriesSet = new Set(selectedProducts.map(p => p.category));

  async function handleLaunch() {
    setSaving(true);
    if (selectedProducts.length > 0) {
      await supabase.from('ap_products').insert(
        selectedProducts.map(p => ({
          bunk_id: bunkId,
          name: p.name, brand: p.brand, category: p.category, unit: p.unit,
          purchase_price: p.purchase_price, selling_price: p.selling_price,
          mrp: p.selling_price, current_stock: p.current_stock,
          reorder_level: p.reorder_level, is_active: true,
        }))
      );
    }
    if (selectedCustomers.length > 0) {
      await supabase.from('ap_customers').insert(
        selectedCustomers.map(c => ({
          bunk_id: bunkId,
          name: c.name, phone: c.phone,
          vehicle_number: c.vehicle_number, vehicle_model: c.vehicle_model,
          address: '', credit_limit: 0,
          outstanding_amount: c.outstanding_amount || 0,
          is_active: true,
        }))
      );
    }
    setSaving(false);
    onComplete();
  }

  const stepTitles = [
    '🚗 Welcome to Auto Parts AI',
    '🛢️ Engine Parts & Oils',
    '🔧 Brakes & Suspension',
    '⚡ Electrical & Battery',
    '🛞 Tyres, Belts & Others',
    '👥 Regular Customers',
    '🚀 Summary & Launch',
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4">
        {/* Header */}
        <div className="bg-slate-700 text-white rounded-t-2xl px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold">{stepTitles[step - 1]}</h2>
            <span className="text-slate-300 text-sm">Step {step} / 7</span>
          </div>
          <div className="w-full bg-slate-600 rounded-full h-1.5">
            <div className="bg-white rounded-full h-1.5 transition-all" style={{ width: `${(step / 7) * 100}%` }} />
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {step === 1 && (
            <div className="text-center space-y-4 py-6">
              <p className="text-5xl">🚗</p>
              <p className="text-gray-600 text-base max-w-md mx-auto">
                Set up your shop in 5 minutes. Add your parts inventory, regular customers, and start billing!
              </p>
              <button onClick={() => setStep(2)} className="mt-4 inline-flex items-center gap-2 bg-slate-700 text-white px-8 py-3 rounded-xl font-semibold hover:bg-slate-800">
                Let's Start <ChevronRight size={18} />
              </button>
            </div>
          )}
          {step === 2 && (
            <OnboardingProductTable products={step2Products} onChange={setStep2Products} />
          )}
          {step === 3 && (
            <OnboardingProductTable products={step3Products} onChange={setStep3Products} />
          )}
          {step === 4 && (
            <OnboardingProductTable products={step4Products} onChange={setStep4Products} />
          )}
          {step === 5 && (
            <OnboardingProductTable products={step5Products} onChange={setStep5Products} />
          )}
          {step === 6 && (
            <div>
              <p className="text-xs text-gray-500 mb-3">Add garage owners, fleet operators, or regular credit customers.</p>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Phone</th>
                      <th className="px-3 py-2 text-left">Vehicle No.</th>
                      <th className="px-3 py-2 text-left">Vehicle Model</th>
                      <th className="px-3 py-2 text-right">Outstanding (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-1.5"><input value={c.name} onChange={e => { const copy = [...customers]; copy[i] = { ...copy[i], name: e.target.value }; setCustomers(copy); }} className="w-full border border-gray-200 rounded px-2 py-1 text-xs" placeholder="Name" /></td>
                        <td className="px-2 py-1.5"><input value={c.phone} onChange={e => { const copy = [...customers]; copy[i] = { ...copy[i], phone: e.target.value }; setCustomers(copy); }} className="w-full border border-gray-200 rounded px-2 py-1 text-xs" placeholder="Phone" /></td>
                        <td className="px-2 py-1.5"><input value={c.vehicle_number} onChange={e => { const copy = [...customers]; copy[i] = { ...copy[i], vehicle_number: e.target.value }; setCustomers(copy); }} className="w-full border border-gray-200 rounded px-2 py-1 text-xs" placeholder="TS01AB1234" /></td>
                        <td className="px-2 py-1.5"><input value={c.vehicle_model} onChange={e => { const copy = [...customers]; copy[i] = { ...copy[i], vehicle_model: e.target.value }; setCustomers(copy); }} className="w-full border border-gray-200 rounded px-2 py-1 text-xs" placeholder="Activa" /></td>
                        <td className="px-2 py-1.5"><input type="number" value={c.outstanding_amount} onChange={e => { const copy = [...customers]; copy[i] = { ...copy[i], outstanding_amount: parseFloat(e.target.value) || 0 }; setCustomers(copy); }} className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-right" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {step === 7 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Total Parts Selected</p>
                  <p className="text-2xl font-bold text-slate-700">{selectedProducts.length}</p>
                  <p className="text-xs text-slate-400">across {categoriesSet.size} categories</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <p className="text-xs text-green-600 mb-1">Inventory Value</p>
                  <p className="text-2xl font-bold text-green-700">{inr(totalInventoryValue)}</p>
                  <p className="text-xs text-green-400">at purchase cost</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <p className="text-xs text-blue-500 mb-1">Customers to Add</p>
                  <p className="text-2xl font-bold text-blue-700">{selectedCustomers.length}</p>
                </div>
              </div>
              <button onClick={handleLaunch} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-slate-700 text-white py-3 rounded-xl font-bold text-base hover:bg-slate-800 disabled:opacity-60">
                {saving ? <Loader2 size={18} className="animate-spin" /> : '🚀'}{saving ? 'Setting up…' : 'Launch Auto Parts Store'}
              </button>
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step > 1 && step < 7 && (
          <div className="flex justify-between px-6 pb-5">
            <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <ChevronLeft size={16} /> Back
            </button>
            <button onClick={() => setStep(s => s + 1)} className="flex items-center gap-1.5 bg-slate-700 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-800">
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
        {step === 1 && <div className="pb-2" />}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function AutoPartsApp({ bunkId, onLogout, user }: { bunkId: string; onLogout: () => void; user: { name: string; email: string; role: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [apPayments, setApPayments] = useState<ApPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [p, c, sa, pu, ex, pay] = await Promise.all([
      supabase.from('ap_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('ap_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('ap_sales').select('*').eq('bunk_id', bunkId).order('sale_date', { ascending: false }).limit(200),
      supabase.from('ap_purchases').select('*').eq('bunk_id', bunkId).order('purchase_date', { ascending: false }).limit(100),
      supabase.from('ap_expenses').select('*').eq('bunk_id', bunkId).order('expense_date', { ascending: false }).limit(200),
      supabase.from('ap_payments').select('amount,payment_date').eq('bunk_id', bunkId).order('payment_date', { ascending: false }).limit(100),
    ]);
    if (p.data) setProducts(p.data as Product[]);
    if (c.data) setCustomers(c.data as Customer[]);
    if (sa.data) setSales(sa.data as Sale[]);
    if (pu.data) setPurchases(pu.data as Purchase[]);
    if (ex.data) setExpenses(ex.data as Expense[]);
    if (pay.data) setApPayments(pay.data as ApPayment[]);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // First-run detection
  useEffect(() => {
    if (!bunkId) return;
    const key = `apOnboardingDone_${bunkId}`;
    if (localStorage.getItem(key)) return;
    supabase.from('ap_products').select('id').eq('bunk_id', bunkId).eq('is_active', true).limit(1)
      .then(({ data }) => { if (!data || data.length === 0) setShowOnboarding(true); });
  }, [bunkId]);

  const today = getTodayIST();
  const todaySales = sales.filter(s => s.sale_date === today);
  const todaySalesTotal = todaySales.reduce((a, s) => a + s.total_amount, 0);
  const todayExpenses = expenses.filter(e => e.expense_date === today).reduce((a, e) => a + e.amount, 0);
  const lowStock = products.filter(p => p.current_stock <= p.reorder_level);
  const totalCreditOutstanding = customers.reduce((a, c) => a + (c.outstanding_amount || 0), 0);
  const todayCollections = apPayments.filter(p => p.payment_date === today).reduce((a, p) => a + p.amount, 0);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'inventory', label: 'Inventory', icon: <Package size={16} /> },
    { id: 'sales', label: 'Sales / POS', icon: <ShoppingCart size={16} /> },
    { id: 'customers', label: 'Customers', icon: <Users size={16} /> },
    { id: 'purchases', label: 'Purchases', icon: <Truck size={16} /> },
    { id: 'expenses', label: 'Expenses', icon: <Receipt size={16} /> },
    { id: 'reports', label: 'Reports', icon: <BarChart2 size={16} /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon size={16} /> },
  ];

  if (showOnboarding) {
    return (
      <AutoPartsOnboarding
        bunkId={bunkId}
        onComplete={() => {
          localStorage.setItem(`apOnboardingDone_${bunkId}`, '1');
          setShowOnboarding(false);
          fetchAll();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-700 text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <span className="text-2xl">🚗</span>
        <div>
          <h1 className="font-bold text-lg leading-tight">Auto Parts</h1>
          <p className="text-slate-300 text-xs">FuelDesk AI</p>
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
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-slate-700 text-slate-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="p-4 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-slate-700" size={32} /></div>
        ) : (
          <>
            {activeTab === 'dashboard' && <ApDashboard todaySalesTotal={todaySalesTotal} todaySalesCount={todaySales.length} todayExpenses={todayExpenses} lowStock={lowStock} recentSales={sales.slice(0, 8)} totalProducts={products.length} totalCreditOutstanding={totalCreditOutstanding} products={products} todayCollections={todayCollections} />}
            {activeTab === 'inventory' && <ApInventory bunkId={bunkId} products={products} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'sales' && <ApSales bunkId={bunkId} products={products} customers={customers} sales={sales} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'customers' && <ApCustomers bunkId={bunkId} customers={customers} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'purchases' && <ApPurchases bunkId={bunkId} purchases={purchases} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'expenses' && <ApExpenses bunkId={bunkId} expenses={expenses} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'reports' && <ApReports bunkId={bunkId} />}
            {activeTab === 'settings' && <SettingsTab bunkId={bunkId} user={user} onLogout={onLogout} />}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function ApDashboard({ todaySalesTotal, todaySalesCount, todayExpenses, lowStock, recentSales, totalProducts, totalCreditOutstanding, products, todayCollections }: {
  todaySalesTotal: number; todaySalesCount: number; todayExpenses: number; lowStock: Product[]; recentSales: Sale[];
  totalProducts: number; totalCreditOutstanding: number; products: Product[]; todayCollections: number;
}) {
  const inventoryValue = products.reduce((a, p) => a + p.current_stock * p.purchase_price, 0);

  const kpis = [
    { label: "Today's Sales", value: inr(todaySalesTotal), icon: <TrendingUp size={20} />, color: 'bg-green-50 text-green-700 border-green-200' },
    { label: "Today's Orders", value: String(todaySalesCount), icon: <Car size={20} />, color: 'bg-slate-50 text-slate-700 border-slate-200' },
    { label: "Today's Expenses", value: inr(todayExpenses), icon: <TrendingDown size={20} />, color: 'bg-red-50 text-red-700 border-red-200' },
    { label: 'Low Stock Items', value: String(lowStock.length), icon: <AlertTriangle size={20} />, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { label: 'Total Parts', value: String(totalProducts), icon: <Package size={20} />, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'Credit Outstanding', value: inr(totalCreditOutstanding), icon: <Wallet size={20} />, color: 'bg-orange-50 text-orange-700 border-orange-200' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.color}`}>
            <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium opacity-80">{k.label}</span>{k.icon}</div>
            <p className="text-xl font-bold">{k.value}</p>
          </div>
        ))}
        {/* Inventory Value card */}
        <div className="rounded-xl border p-4 bg-purple-50 text-purple-700 border-purple-200">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium opacity-80">Inventory Value</span><Package size={20} /></div>
          <p className="text-xl font-bold">{inr(inventoryValue)}</p>
          <p className="text-xs opacity-60 mt-0.5">at purchase cost</p>
        </div>
        {/* Collections Today card */}
        <div className="rounded-xl border p-4 bg-teal-50 text-teal-700 border-teal-200">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium opacity-80">Collections Today</span><Wallet size={20} /></div>
          <p className="text-xl font-bold">{inr(todayCollections)}</p>
          <p className="text-xs opacity-60 mt-0.5">credit payments received</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-yellow-500" /> Low Stock Alert</h2>
          {lowStock.length === 0 ? <p className="text-gray-400 text-sm">All products well-stocked.</p> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lowStock.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div><p className="text-sm font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-400">{p.brand} · {p.category}</p></div>
                  <span className={`text-sm font-semibold ${p.current_stock <= 0 ? 'text-red-600' : 'text-yellow-600'}`}>{p.current_stock} {p.unit}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Car size={16} className="text-slate-600" /> Recent Service Records</h2>
          {recentSales.length === 0 ? <p className="text-gray-400 text-sm">No sales yet.</p> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentSales.map(s => (
                <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.customer_name || 'Walk-in'}</p>
                    <p className="text-xs text-gray-400">{s.vehicle_number && <span className="mr-1">{s.vehicle_number} ·</span>}{formatISTDate(s.sale_date)}</p>
                  </div>
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
            { done: lowStock.length === 0, text: `Reorder low stock parts${lowStock.length > 0 ? ` (${lowStock.length} items)` : ''}` },
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

// ─── Inventory ─────────────────────────────────────────────────────────────────
interface AProdForm { name: string; brand: string; category: string; unit: string; mrp: number; selling_price: number; purchase_price: number; current_stock: number; reorder_level: number; }
const defaultAPF = (): AProdForm => ({ name: '', brand: '', category: CATEGORIES[0], unit: UNITS[0], mrp: 0, selling_price: 0, purchase_price: 0, current_stock: 0, reorder_level: 3 });

interface AdjustModal { product: Product; }

function ApInventory({ bunkId, products, onRefresh, showToast }: { bunkId: string; products: Product[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<AProdForm>(defaultAPF());
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ msg: string; onYes: () => void } | null>(null);
  const [adjustModal, setAdjustModal] = useState<AdjustModal | null>(null);
  const [adjustMode, setAdjustMode] = useState<'add' | 'remove'>('add');
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState(ADJUST_REASONS[0]);
  const [adjustSaving, setAdjustSaving] = useState(false);

  const filtered = products.filter(p => {
    const s = p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase());
    return s && (catFilter === 'All' || p.category === catFilter);
  });

  function openAdd() { setEditing(null); setForm(defaultAPF()); setShowModal(true); }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, brand: p.brand, category: p.category, unit: p.unit, mrp: p.mrp, selling_price: p.selling_price, purchase_price: p.purchase_price, current_stock: p.current_stock, reorder_level: p.reorder_level });
    setShowModal(true);
  }
  function openAdjust(p: Product) {
    setAdjustModal({ product: p });
    setAdjustMode('add');
    setAdjustQty(0);
    setAdjustReason(ADJUST_REASONS[0]);
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Product name required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId, is_active: true };
    const { error } = editing ? await supabase.from('ap_products').update(payload).eq('id', editing.id).eq('bunk_id', bunkId) : await supabase.from('ap_products').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editing ? 'Part updated' : 'Part added'); setShowModal(false); onRefresh();
  }

  function handleDelete(p: Product) {
    setConfirmModal({
      msg: `Delete "${p.name}"?`,
      onYes: async () => {
        const { error } = await supabase.from('ap_products').update({ is_active: false }).eq('id', p.id).eq('bunk_id', bunkId);
        if (error) { showToast(error.message, 'error'); return; }
        showToast('Part removed'); onRefresh();
      },
    });
  }

  async function handleAdjust() {
    if (!adjustModal) return;
    if (adjustQty <= 0) { showToast('Enter a valid quantity', 'error'); return; }
    setAdjustSaving(true);
    const { data: fresh } = await supabase.from('ap_products').select('current_stock').eq('id', adjustModal.product.id).eq('bunk_id', bunkId).maybeSingle();
    const currentStock = fresh ? Number(fresh.current_stock) : adjustModal.product.current_stock;
    const newStock = adjustMode === 'add' ? currentStock + adjustQty : Math.max(0, currentStock - adjustQty);
    const { error } = await supabase.from('ap_products').update({ current_stock: newStock }).eq('id', adjustModal.product.id).eq('bunk_id', bunkId);
    setAdjustSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(`Stock adjusted: ${adjustModal.product.name} → ${newStock} ${adjustModal.product.unit}`);
    setAdjustModal(null);
    onRefresh();
  }

  const setF = (k: keyof AProdForm, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parts…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2">
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800"><Plus size={16} /> Add Part</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Part</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-right">Selling</th><th className="px-4 py-3 text-right">Stock</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">No parts found.</td></tr>}
              {filtered.map(p => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-400">{p.brand} · {p.unit}</p></td>
                  <td className="px-4 py-3 text-gray-600">{p.category}</td>
                  <td className="px-4 py-3 text-right font-medium">{inr(p.selling_price)}</td>
                  <td className="px-4 py-3 text-right"><span className={`font-semibold ${p.current_stock <= p.reorder_level ? 'text-red-600' : 'text-gray-800'}`}>{p.current_stock}</span></td>
                  <td className="px-4 py-3 text-center">{p.current_stock <= p.reorder_level ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Low</span> : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">OK</span>}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openAdjust(p)} title="Adjust Stock" className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium hover:bg-slate-200">±</button>
                      <button onClick={() => openEdit(p)} className="text-slate-600 hover:text-slate-800"><Edit2 size={14} /></button>
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
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">{editing ? 'Edit Part' : 'Add Part'}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Part Name *</label><input value={form.name} onChange={e => setF('name', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Brand</label><input value={form.brand} onChange={e => setF('brand', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Category</label><select value={form.category} onChange={e => setF('category', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Unit</label><select value={form.unit} onChange={e => setF('unit', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Selling Price (₹)</label><input type="number" value={form.selling_price} onChange={e => setF('selling_price', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Purchase Price (₹)</label><input type="number" value={form.purchase_price} onChange={e => setF('purchase_price', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">MRP (₹)</label><input type="number" value={form.mrp} onChange={e => setF('mrp', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Current Stock</label><input type="number" value={form.current_stock} onChange={e => setF('current_stock', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Reorder Level</label><input type="number" value={form.reorder_level} onChange={e => setF('reorder_level', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-slate-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Adjust Stock</h2>
              <button onClick={() => setAdjustModal(null)}><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm font-medium text-gray-800">{adjustModal.product.name}</p>
              <p className="text-xs text-gray-500">Current stock: <span className="font-semibold text-gray-800">{adjustModal.product.current_stock} {adjustModal.product.unit}</span></p>
              <div className="flex gap-2">
                <button onClick={() => setAdjustMode('add')} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${adjustMode === 'add' ? 'bg-green-600 text-white border-green-600' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}>+ Add</button>
                <button onClick={() => setAdjustMode('remove')} className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${adjustMode === 'remove' ? 'bg-red-600 text-white border-red-600' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}>- Remove</button>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
                <input type="number" value={adjustQty} onChange={e => setAdjustQty(parseFloat(e.target.value) || 0)} min={0} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Reason</label>
                <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {ADJUST_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              {adjustQty > 0 && (
                <p className="text-xs text-gray-500">
                  New stock will be: <span className="font-semibold text-gray-800">
                    {adjustMode === 'add' ? adjustModal.product.current_stock + adjustQty : Math.max(0, adjustModal.product.current_stock - adjustQty)} {adjustModal.product.unit}
                  </span>
                </p>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setAdjustModal(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdjust} disabled={adjustSaving} className="flex-1 bg-slate-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2">
                {adjustSaving && <Loader2 size={14} className="animate-spin" />}{adjustSaving ? 'Saving…' : 'Apply'}
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

// ─── Sales / POS ───────────────────────────────────────────────────────────────
function ApSales({ bunkId, products, customers, sales, onRefresh, showToast }: {
  bunkId: string; products: Product[]; customers: Customer[]; sales: Sale[];
  onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [salesView, setSalesView] = useState<'pos' | 'history'>('pos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [labourCharges, setLabourCharges] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [saleDate, setSaleDate] = useState(getTodayIST());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase()));
  const historySales = sales.slice(0, 50);
  const filteredHistory = historySearch.trim()
    ? historySales.filter(s =>
        s.customer_name.toLowerCase().includes(historySearch.toLowerCase()) ||
        (s.vehicle_number || '').toLowerCase().includes(historySearch.toLowerCase())
      )
    : historySales;

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

  const partsTotal = cart.reduce((a, i) => a + i.price * i.quantity, 0);
  const total = partsTotal + labourCharges;

  async function handleSell() {
    if (cart.length === 0 && labourCharges === 0) { showToast('Cart is empty', 'error'); return; }
    setSaving(true);
    const cust = customers.find(c => c.id === customerId);
    const { data: sale, error } = await supabase.from('ap_sales').insert({
      bunk_id: bunkId, customer_id: customerId || null,
      customer_name: cust?.name || 'Walk-in', vehicle_number: vehicleNumber,
      sale_date: saleDate, total_amount: total, labour_charges: labourCharges,
      payment_mode: paymentMode, payment_status: paymentMode === 'credit' ? 'credit' : 'paid', notes,
    }).select().single();
    if (error || !sale) { showToast(error?.message || 'Sale failed', 'error'); setSaving(false); return; }
    if (cart.length > 0) {
      await supabase.from('ap_sale_items').insert(cart.map(i => ({
        sale_id: sale.id, bunk_id: bunkId, product_id: i.product.id,
        product_name: i.product.name, quantity: i.quantity, unit_price: i.price, total_price: i.price * i.quantity,
      })));
      for (const i of cart) {
        const { data: freshProd } = await supabase.from('ap_products').select('current_stock').eq('id', i.product.id).eq('bunk_id', bunkId).maybeSingle();
        const freshStock = freshProd ? Number(freshProd.current_stock) : Number(i.product.current_stock);
        await supabase.from('ap_products').update({ current_stock: Math.max(0, freshStock - i.quantity) }).eq('id', i.product.id).eq('bunk_id', bunkId);
      }
    }
    if (paymentMode === 'credit' && customerId) {
      const { data: freshCust } = await supabase.from('ap_customers').select('outstanding_amount').eq('id', customerId).eq('bunk_id', bunkId).maybeSingle();
      const base = freshCust ? Number(freshCust.outstanding_amount) : (Number(customers.find(c => c.id === customerId)?.outstanding_amount) || 0);
      await supabase.from('ap_customers').update({ outstanding_amount: base + total }).eq('id', customerId).eq('bunk_id', bunkId);
    }
    showToast('Sale recorded!');
    setCart([]); setCustomerId(''); setVehicleNumber(''); setLabourCharges(0); setNotes(''); setSaleDate(getTodayIST());
    setSaving(false); onRefresh();
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-2">
        <button onClick={() => setSalesView('pos')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${salesView === 'pos' ? 'bg-slate-700 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
          🛒 New Sale
        </button>
        <button onClick={() => setSalesView('history')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${salesView === 'history' ? 'bg-slate-700 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
          📋 History
        </button>
      </div>

      {salesView === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parts…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500" />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase sticky top-0">
                    <tr><th className="px-4 py-2 text-left">Part</th><th className="px-4 py-2 text-right">Price</th><th className="px-4 py-2 text-right">Stock</th><th className="px-4 py-2"></th></tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(p => (
                      <tr key={p.id} className="border-t border-gray-100 hover:bg-slate-50">
                        <td className="px-4 py-2"><p className="font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-400">{p.brand} · {p.category}</p></td>
                        <td className="px-4 py-2 text-right">{inr(p.selling_price)}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{p.current_stock} {p.unit}</td>
                        <td className="px-4 py-2 text-right"><button onClick={() => addToCart(p)} disabled={p.current_stock <= 0} className="bg-slate-700 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-40"><Plus size={12} className="inline" /> Add</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4 h-fit">
            <h2 className="font-semibold text-gray-800">Cart</h2>
            {cart.length === 0 && labourCharges === 0 ? <p className="text-gray-400 text-sm">No items added.</p> : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {cart.map(i => (
                  <div key={i.product.id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800 truncate">{i.product.name}</p><p className="text-xs text-gray-400">{inr(i.price)} ea</p></div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(i.product.id, i.quantity - 1)} className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100">-</button>
                      <span className="w-6 text-center text-sm">{i.quantity}</span>
                      <button onClick={() => updateQty(i.product.id, i.quantity + 1)} className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100">+</button>
                    </div>
                    <span className="text-sm font-semibold">{inr(i.price * i.quantity)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Parts Total</span><span>{inr(partsTotal)}</span></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Labour Charges (₹)</label><input type="number" value={labourCharges} onChange={e => setLabourCharges(parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div className="flex justify-between text-base font-bold"><span>Total</span><span>{inr(total)}</span></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Customer</label>
                <select value={customerId} onChange={e => { setCustomerId(e.target.value); const c = customers.find(cu => cu.id === e.target.value); if (c) setVehicleNumber(c.vehicle_number || ''); }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Walk-in</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.vehicle_number ? `(${c.vehicle_number})` : ''}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-gray-500 mb-1 block">Vehicle Number</label><input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="e.g. TS01AB1234" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label><select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <button onClick={handleSell} disabled={saving || (cart.length === 0 && labourCharges === 0)} className="mt-2 w-full bg-slate-700 text-white py-2.5 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Processing…' : 'Complete Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {salesView === 'history' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Search by customer or vehicle…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Vehicle</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Labour</th>
                    <th className="px-4 py-3 text-center">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">No sales found.</td></tr>}
                  {filteredHistory.map(s => (
                    <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{formatISTDate(s.sale_date)}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{s.customer_name || 'Walk-in'}</td>
                      <td className="px-4 py-3 text-gray-600">{s.vehicle_number || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{inr(s.total_amount)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{s.labour_charges > 0 ? inr(s.labour_charges) : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.payment_mode === 'credit' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{s.payment_mode}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Customers ─────────────────────────────────────────────────────────────────
interface ACustForm { name: string; phone: string; address: string; vehicle_number: string; vehicle_model: string; credit_limit: number; }
const defaultACF = (): ACustForm => ({ name: '', phone: '', address: '', vehicle_number: '', vehicle_model: '', credit_limit: 0 });

function ApCustomers({ bunkId, customers, onRefresh, showToast }: { bunkId: string; customers: Customer[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<ACustForm>(defaultACF());
  const [saving, setSaving] = useState(false);
  const [payModal, setPayModal] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [payingSaving, setPayingSaving] = useState(false);

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || (c.vehicle_number || '').toLowerCase().includes(search.toLowerCase()));

  function openAdd() { setEditing(null); setForm(defaultACF()); setShowModal(true); }
  function openEdit(c: Customer) { setEditing(c); setForm({ name: c.name, phone: c.phone, address: c.address, vehicle_number: c.vehicle_number || '', vehicle_model: c.vehicle_model || '', credit_limit: c.credit_limit || 0 }); setShowModal(true); }
  function openPay(c: Customer) { setPayModal(c); setPayAmount(''); setPayMode('cash'); }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Name required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId, is_active: true };
    const { error } = editing ? await supabase.from('ap_customers').update(payload).eq('id', editing.id) : await supabase.from('ap_customers').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editing ? 'Customer updated' : 'Customer added'); setShowModal(false); onRefresh();
  }

  async function handleCollectPayment() {
    if (!payModal) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
    setPayingSaving(true);
    await supabase.from('ap_payments').insert({
      bunk_id: bunkId, customer_id: payModal.id, customer_name: payModal.name,
      amount: amt, payment_mode: payMode, payment_date: getTodayIST(),
    });
    const { data: freshC } = await supabase.from('ap_customers').select('outstanding_amount').eq('id', payModal.id).eq('bunk_id', bunkId).maybeSingle();
    const base = freshC ? Number(freshC.outstanding_amount) : Number(payModal.outstanding_amount);
    const { error } = await supabase.from('ap_customers').update({ outstanding_amount: Math.max(0, base - amt) }).eq('id', payModal.id).eq('bunk_id', bunkId);
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or vehicle…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500" />
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800"><Plus size={16} /> Add Customer</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-left">Vehicle</th><th className="px-4 py-3 text-right">Credit Limit</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-center">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">No customers found.</td></tr>}
              {filtered.map(c => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.vehicle_number ? <span>{c.vehicle_number}<span className="text-gray-400 ml-1">({c.vehicle_model || 'N/A'})</span></span> : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{inr(c.credit_limit || 0)}</td>
                  <td className="px-4 py-3 text-right"><span className={`font-semibold ${c.outstanding_amount > 0 ? 'text-orange-600' : 'text-gray-500'}`}>{inr(c.outstanding_amount)}</span></td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {c.outstanding_amount > 0 && (
                        <button onClick={() => openPay(c)} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium hover:bg-orange-200">Collect</button>
                      )}
                      <button onClick={() => openEdit(c)} className="text-slate-600 hover:text-slate-800"><Edit2 size={14} /></button>
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
              <div><label className="text-xs text-gray-500 mb-1 block">Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Address</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Vehicle Number</label><input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="TS01AB1234" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Vehicle Model</label><input value={form.vehicle_model} onChange={e => setForm(f => ({ ...f, vehicle_model: e.target.value }))} placeholder="e.g. Activa, Pulsar" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Credit Limit (₹)</label><input type="number" value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-slate-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
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
              <div><label className="text-xs text-gray-500 mb-1 block">Amount Received (₹) *</label><input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" /></div>
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

// ─── Purchases ─────────────────────────────────────────────────────────────────
function ApPurchases({ bunkId, purchases, onRefresh, showToast }: { bunkId: string; purchases: Purchase[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ supplier_name: '', invoice_number: '', purchase_date: getTodayIST(), total_amount: 0, notes: '' });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.supplier_name.trim() || form.total_amount <= 0) { showToast('Supplier and amount required', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('ap_purchases').insert({ ...form, bunk_id: bunkId });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Purchase added'); setShowModal(false); setForm({ supplier_name: '', invoice_number: '', purchase_date: getTodayIST(), total_amount: 0, notes: '' }); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800"><Plus size={16} /> Add Purchase</button></div>
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
              <div><label className="text-xs text-gray-500 mb-1 block">Supplier *</label><input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Invoice #</label><input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label><input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-slate-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Expenses ──────────────────────────────────────────────────────────────────
function ApExpenses({ bunkId, expenses, onRefresh, showToast }: { bunkId: string; expenses: Expense[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ category: EXPENSE_CATEGORIES[0], description: '', amount: 0, expense_date: getTodayIST(), payment_mode: 'cash', notes: '' });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.description.trim() || form.amount <= 0) { showToast('Description and amount required', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('ap_expenses').insert({ ...form, bunk_id: bunkId });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Expense added'); setShowModal(false); setForm({ category: EXPENSE_CATEGORIES[0], description: '', amount: 0, expense_date: getTodayIST(), payment_mode: 'cash', notes: '' }); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800"><Plus size={16} /> Add Expense</button></div>
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
              <div><label className="text-xs text-gray-500 mb-1 block">Description *</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label><input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label><select value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}</select></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-slate-700 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reports ───────────────────────────────────────────────────────────────────
interface ReportSale {
  id: string; total_amount: number; labour_charges: number; payment_mode: string;
  customer_id: string | null; customer_name: string; sale_date: string;
}
interface ReportExpense { amount: number; expense_date: string; }
interface ReportPayment { amount: number; payment_date: string; }
interface ReportSaleItem { product_name: string; total_price: number; quantity: number; }
interface TopCustomer { customer_name: string; total: number; }
interface TopPart { product_name: string; revenue: number; qty: number; }

type ReportPeriod = 'today' | 'month' | 'custom';

function ApReports({ bunkId }: { bunkId: string }) {
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const [customFrom, setCustomFrom] = useState(getTodayIST());
  const [customTo, setCustomTo] = useState(getTodayIST());
  const [loading, setLoading] = useState(false);

  const [reportSales, setReportSales] = useState<ReportSale[]>([]);
  const [reportExpenses, setReportExpenses] = useState<ReportExpense[]>([]);
  const [reportPayments, setReportPayments] = useState<ReportPayment[]>([]);
  const [topParts, setTopParts] = useState<TopPart[]>([]);

  const today = getTodayIST();
  const monthStart = today.substring(0, 8) + '01';

  const fromDate = period === 'today' ? today : period === 'month' ? monthStart : customFrom;
  const toDate = period === 'today' ? today : period === 'month' ? today : customTo;

  const loadReport = useCallback(async () => {
    setLoading(true);
    const [salesRes, expRes, payRes] = await Promise.all([
      supabase.from('ap_sales').select('id,total_amount,labour_charges,payment_mode,customer_id,customer_name,sale_date')
        .eq('bunk_id', bunkId).gte('sale_date', fromDate).lte('sale_date', toDate),
      supabase.from('ap_expenses').select('amount,expense_date')
        .eq('bunk_id', bunkId).gte('expense_date', fromDate).lte('expense_date', toDate),
      supabase.from('ap_payments').select('amount,payment_date')
        .eq('bunk_id', bunkId).gte('payment_date', fromDate).lte('payment_date', toDate),
    ]);
    if (salesRes.data) setReportSales(salesRes.data as ReportSale[]);
    if (expRes.data) setReportExpenses(expRes.data as ReportExpense[]);
    if (payRes.data) setReportPayments(payRes.data as ReportPayment[]);

    // Top parts by revenue
    if (salesRes.data && salesRes.data.length > 0) {
      const saleIds = (salesRes.data as ReportSale[]).map(s => s.id);
      const itemsRes = await supabase.from('ap_sale_items').select('product_name,total_price,quantity').in('sale_id', saleIds);
      if (itemsRes.data) {
        const map: Record<string, TopPart> = {};
        (itemsRes.data as ReportSaleItem[]).forEach(item => {
          if (!map[item.product_name]) map[item.product_name] = { product_name: item.product_name, revenue: 0, qty: 0 };
          map[item.product_name].revenue += item.total_price;
          map[item.product_name].qty += item.quantity;
        });
        setTopParts(Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5));
      }
    } else {
      setTopParts([]);
    }

    setLoading(false);
  }, [bunkId, fromDate, toDate]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const totalRevenue = reportSales.reduce((a, s) => a + s.total_amount, 0);
  const labourRevenue = reportSales.reduce((a, s) => a + (s.labour_charges || 0), 0);
  const cashCollections = reportSales.filter(s => s.payment_mode !== 'credit').reduce((a, s) => a + s.total_amount, 0)
    + reportPayments.reduce((a, p) => a + p.amount, 0);
  const creditSales = reportSales.filter(s => s.payment_mode === 'credit').reduce((a, s) => a + s.total_amount, 0);
  const totalExpenses = reportExpenses.reduce((a, e) => a + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  // Top 5 customers by sales value
  const custMap: Record<string, TopCustomer> = {};
  reportSales.forEach(s => {
    const key = s.customer_name || 'Walk-in';
    if (!custMap[key]) custMap[key] = { customer_name: key, total: 0 };
    custMap[key].total += s.total_amount;
  });
  const topCustomers = Object.values(custMap).sort((a, b) => b.total - a.total).slice(0, 5);

  const kpiCards = [
    { label: 'Total Sales Revenue', value: inr(totalRevenue), color: 'bg-green-50 text-green-700 border-green-200' },
    { label: 'Cash Collections', value: inr(cashCollections), color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'Credit Sales (Given)', value: inr(creditSales), color: 'bg-orange-50 text-orange-700 border-orange-200' },
    { label: 'Labour Revenue', value: inr(labourRevenue), color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { label: 'Total Expenses', value: inr(totalExpenses), color: 'bg-red-50 text-red-700 border-red-200' },
    { label: 'Net Profit', value: inr(netProfit), color: netProfit >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200' },
  ];

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          {(['today', 'month', 'custom'] as ReportPeriod[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === p ? 'bg-slate-700 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {p === 'today' ? 'Today' : p === 'month' ? 'This Month' : 'Custom Range'}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex gap-2 items-center">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        )}
        {loading && <Loader2 size={16} className="animate-spin text-slate-500 ml-2" />}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.color}`}>
            <p className="text-xs font-medium opacity-70 mb-1">{k.label}</p>
            <p className="text-xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 customers */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Users size={16} className="text-slate-600" /> Top Customers by Sales</h3>
          {topCustomers.length === 0 ? <p className="text-gray-400 text-sm">No sales in this period.</p> : (
            <div className="space-y-2">
              {topCustomers.map((c, i) => (
                <div key={c.customer_name} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs flex items-center justify-center font-medium">{i + 1}</span>
                    <span className="text-sm text-gray-800">{c.customer_name}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{inr(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top 5 parts */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><Package size={16} className="text-slate-600" /> Top Parts Sold by Revenue</h3>
          {topParts.length === 0 ? <p className="text-gray-400 text-sm">No items sold in this period.</p> : (
            <div className="space-y-2">
              {topParts.map((p, i) => (
                <div key={p.product_name} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs flex items-center justify-center font-medium">{i + 1}</span>
                    <div>
                      <p className="text-sm text-gray-800">{p.product_name}</p>
                      <p className="text-xs text-gray-400">{p.qty} units sold</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{inr(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
