import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, ShoppingCart, Users, Truck, BarChart3, Receipt, Settings,
  Plus, Search, AlertTriangle, TrendingUp, RefreshCw,
  CheckCircle2, MapPin, Phone, X, ChevronRight, Building2,
  ArrowUpRight, Loader2, Layers, LogOut,
  Zap, Trophy, Banknote, ChevronLeft, Brain, Download,
} from 'lucide-react';
import { SettingsTab } from './SettingsTab';
import { IntelligenceTab } from './IntelligenceTab';
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
interface CementFinancials {
  id: string; bunk_id: string; cash_in_hand: number;
  bank_accounts: { bank_name: string; balance: number }[];
  updated_at: string;
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
// today is computed inline via getTodayIST() to avoid stale date across midnight

// ── Onboarding Wizard ────────────────────────────────────────────────────────
interface WizardRow {
  id: string;
  included: boolean;
  name: string;
  brand: string;
  stock: string;
  unit: string;
  cp: string;
  sp: string;
  product_type: string;
  grade?: string;
  diameter_mm?: number | null;
}
interface BankAccount { bank_name: string; balance: string; }

function makeRow(overrides: Partial<WizardRow>): WizardRow {
  return {
    id: Math.random().toString(36).slice(2),
    included: true,
    name: '',
    brand: '',
    stock: '',
    unit: 'bag',
    cp: '',
    sp: '',
    product_type: 'other',
    grade: '',
    diameter_mm: null,
    ...overrides,
  };
}

const WIZARD_STEPS = [
  { label: 'Welcome', icon: '👋' },
  { label: 'Cement', icon: '🧱' },
  { label: 'Steel & Wire', icon: '🔩' },
  { label: 'Sand & Masonry', icon: '🏗️' },
  { label: 'Other Materials', icon: '📦' },
  { label: 'Bank & Cash', icon: '💰' },
  { label: 'Summary', icon: '✅' },
];

const DEFAULT_CEMENT_ROWS: WizardRow[] = [
  makeRow({ name: 'OPC 43 Cement', brand: 'Ultratech', unit: 'bag', product_type: 'cement', grade: 'OPC43' }),
  makeRow({ name: 'OPC 53 Cement', brand: 'Ultratech', unit: 'bag', product_type: 'cement', grade: 'OPC53' }),
  makeRow({ name: 'PPC Cement', brand: 'ACC', unit: 'bag', product_type: 'cement', grade: 'PPC' }),
  makeRow({ name: 'White Cement', brand: 'JK White', unit: 'bag', product_type: 'cement' }),
  makeRow({ name: 'PSC / Slag Cement', brand: '', unit: 'bag', product_type: 'cement', grade: 'PSC' }),
];

const DEFAULT_STEEL_ROWS: WizardRow[] = [
  makeRow({ name: 'TMT 8mm', brand: 'TATA Tiscon', unit: 'kg', product_type: 'steel_tmt', grade: 'Fe500', diameter_mm: 8 }),
  makeRow({ name: 'TMT 10mm', brand: 'TATA Tiscon', unit: 'kg', product_type: 'steel_tmt', grade: 'Fe500', diameter_mm: 10 }),
  makeRow({ name: 'TMT 12mm', brand: 'TATA Tiscon', unit: 'kg', product_type: 'steel_tmt', grade: 'Fe500', diameter_mm: 12 }),
  makeRow({ name: 'TMT 16mm', brand: 'TATA Tiscon', unit: 'kg', product_type: 'steel_tmt', grade: 'Fe500', diameter_mm: 16 }),
  makeRow({ name: 'TMT 20mm', brand: 'TATA Tiscon', unit: 'kg', product_type: 'steel_tmt', grade: 'Fe500', diameter_mm: 20 }),
  makeRow({ name: 'TMT 25mm', brand: 'TATA Tiscon', unit: 'kg', product_type: 'steel_tmt', grade: 'Fe500', diameter_mm: 25 }),
  makeRow({ name: 'Binding Wire', brand: '', unit: 'kg', product_type: 'binding_wire' }),
];

const DEFAULT_AGGREGATE_ROWS: WizardRow[] = [
  makeRow({ name: '20mm Jelly / Aggregate', brand: '', unit: 'brass', product_type: 'aggregate' }),
  makeRow({ name: '12mm Chips', brand: '', unit: 'brass', product_type: 'aggregate' }),
  makeRow({ name: 'M-Sand', brand: '', unit: 'brass', product_type: 'sand' }),
  makeRow({ name: 'River Sand', brand: '', unit: 'brass', product_type: 'sand' }),
  makeRow({ name: 'Plaster Sand', brand: '', unit: 'brass', product_type: 'sand' }),
  makeRow({ name: 'Red Bricks', brand: '', unit: 'thousand', product_type: 'brick' }),
  makeRow({ name: 'AAC Blocks 600×200×200', brand: '', unit: 'piece', product_type: 'block' }),
  makeRow({ name: 'Hollow Blocks 400×200×200', brand: '', unit: 'piece', product_type: 'block' }),
  makeRow({ name: 'Fly Ash Bricks', brand: '', unit: 'piece', product_type: 'brick' }),
];

const DEFAULT_OTHER_ROWS: WizardRow[] = [
  makeRow({ name: 'Tiles', brand: '', unit: 'sqft', product_type: 'tile' }),
  makeRow({ name: 'Plywood 18mm', brand: '', unit: 'sheet', product_type: 'other' }),
  makeRow({ name: 'Shuttering Ply', brand: '', unit: 'sheet', product_type: 'other' }),
  makeRow({ name: 'Waterproofing Compound', brand: '', unit: 'kg', product_type: 'waterproofing' }),
  makeRow({ name: 'Admixture / Plasticizer', brand: '', unit: 'ltr', product_type: 'admixture' }),
  makeRow({ name: 'Primer / Putty', brand: '', unit: 'kg', product_type: 'other' }),
];

function WizardInventoryTable({ rows, onChange }: { rows: WizardRow[]; onChange: (rows: WizardRow[]) => void }) {
  const update = (id: string, key: keyof WizardRow, value: any) => {
    onChange(rows.map(r => r.id === id ? { ...r, [key]: value } : r));
  };
  const toggle = (id: string) => {
    onChange(rows.map(r => r.id === id ? { ...r, included: !r.included } : r));
  };
  const addCustom = () => {
    onChange([...rows, makeRow({ included: true })]);
  };
  const removeRow = (id: string) => {
    onChange(rows.filter(r => r.id !== id));
  };

  const stockValue = rows.filter(r => r.included).reduce((sum, r) => sum + (Number(r.stock || 0) * Number(r.cp || 0)), 0);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-orange-50 text-xs text-gray-500">
              <th className="w-10 px-3 py-2 text-center">✓</th>
              <th className="px-2 py-2 text-left font-medium">Name</th>
              <th className="px-2 py-2 text-left font-medium w-28">Brand</th>
              <th className="px-2 py-2 text-left font-medium w-20">Stock</th>
              <th className="px-2 py-2 text-left font-medium w-16">Unit</th>
              <th className="px-2 py-2 text-left font-medium w-24">CP ₹</th>
              <th className="px-2 py-2 text-left font-medium w-24">SP ₹</th>
              <th className="w-8 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const dim = !row.included;
              return (
                <tr
                  key={row.id}
                  className={`border-t transition-colors ${dim ? 'bg-gray-50 opacity-50' : 'bg-white hover:bg-orange-50/30'}`}
                >
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => toggle(row.id)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                        row.included ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-300 bg-white text-gray-300'
                      }`}
                    >
                      {row.included ? '✓' : '○'}
                    </button>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      disabled={dim}
                      value={row.name}
                      onChange={e => update(row.id, 'name', e.target.value)}
                      className="w-full border border-transparent rounded px-1.5 py-1 focus:border-orange-300 focus:outline-none text-xs bg-transparent disabled:cursor-not-allowed"
                      placeholder="Product name"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      disabled={dim}
                      value={row.brand}
                      onChange={e => update(row.id, 'brand', e.target.value)}
                      className="w-full border border-transparent rounded px-1.5 py-1 focus:border-orange-300 focus:outline-none text-xs bg-transparent disabled:cursor-not-allowed"
                      placeholder="Brand"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      disabled={dim}
                      type="number"
                      value={row.stock}
                      onChange={e => update(row.id, 'stock', e.target.value)}
                      className="w-full border border-transparent rounded px-1.5 py-1 focus:border-orange-300 focus:outline-none text-xs bg-transparent disabled:cursor-not-allowed"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      disabled={dim}
                      value={row.unit}
                      onChange={e => update(row.id, 'unit', e.target.value)}
                      className="w-full border border-transparent rounded px-1.5 py-1 focus:border-orange-300 focus:outline-none text-xs bg-transparent disabled:cursor-not-allowed"
                      placeholder="unit"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      disabled={dim}
                      type="number"
                      value={row.cp}
                      onChange={e => update(row.id, 'cp', e.target.value)}
                      className="w-full border border-transparent rounded px-1.5 py-1 focus:border-orange-300 focus:outline-none text-xs bg-transparent disabled:cursor-not-allowed"
                      placeholder="₹0"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      disabled={dim}
                      type="number"
                      value={row.sp}
                      onChange={e => update(row.id, 'sp', e.target.value)}
                      className="w-full border border-transparent rounded px-1.5 py-1 focus:border-orange-300 focus:outline-none text-xs bg-transparent disabled:cursor-not-allowed"
                      placeholder="₹0"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addCustom}
          className="flex items-center gap-1.5 text-orange-600 text-sm font-medium hover:text-orange-700"
        >
          <Plus size={14} /> Add custom item
        </button>
        {stockValue > 0 && (
          <div className="text-sm text-gray-600 bg-orange-50 px-3 py-1 rounded-lg">
            Stock value: <strong className="text-orange-700">{inr(stockValue)}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

function CementOnboarding({ bunkId, onComplete }: { bunkId: string; onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [cementRows, setCementRows] = useState<WizardRow[]>(DEFAULT_CEMENT_ROWS.map(r => ({ ...r, id: Math.random().toString(36).slice(2) })));
  const [steelRows, setSteelRows] = useState<WizardRow[]>(DEFAULT_STEEL_ROWS.map(r => ({ ...r, id: Math.random().toString(36).slice(2) })));
  const [aggregateRows, setAggregateRows] = useState<WizardRow[]>(DEFAULT_AGGREGATE_ROWS.map(r => ({ ...r, id: Math.random().toString(36).slice(2) })));
  const [otherRows, setOtherRows] = useState<WizardRow[]>(DEFAULT_OTHER_ROWS.map(r => ({ ...r, id: Math.random().toString(36).slice(2) })));
  const [cashInHand, setCashInHand] = useState('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([{ bank_name: '', balance: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalSteps = WIZARD_STEPS.length - 1; // 0-indexed last step = 6

  const addBank = () => {
    if (bankAccounts.length < 5) setBankAccounts(b => [...b, { bank_name: '', balance: '' }]);
  };
  const updateBank = (idx: number, key: keyof BankAccount, val: string) => {
    setBankAccounts(b => b.map((a, i) => i === idx ? { ...a, [key]: val } : a));
  };
  const removeBank = (idx: number) => setBankAccounts(b => b.filter((_, i) => i !== idx));

  const totalBankBalance = bankAccounts.reduce((s, a) => s + Number(a.balance || 0), 0);
  const totalFinancials = Number(cashInHand || 0) + totalBankBalance;

  const allRows = [...cementRows, ...steelRows, ...aggregateRows, ...otherRows];
  const includedRows = allRows.filter(r => r.included && r.name.trim());

  const summaryByCategory = [
    { label: '🧱 Cement', rows: cementRows.filter(r => r.included && r.name.trim()) },
    { label: '🔩 Steel & Wire', rows: steelRows.filter(r => r.included && r.name.trim()) },
    { label: '🏗️ Sand & Masonry', rows: aggregateRows.filter(r => r.included && r.name.trim()) },
    { label: '📦 Other Materials', rows: otherRows.filter(r => r.included && r.name.trim()) },
  ];

  const totalInventoryValue = includedRows.reduce((s, r) => s + Number(r.stock || 0) * Number(r.cp || 0), 0);
  const netWorth = totalInventoryValue + totalFinancials;

  const handleLaunch = async () => {
    setSaving(true);
    setError('');
    try {
      if (includedRows.length > 0) {
        const productsPayload = includedRows.map(r => ({
          bunk_id: bunkId,
          name: r.name.trim(),
          brand: r.brand || null,
          product_type: r.product_type,
          grade: r.grade || null,
          diameter_mm: r.diameter_mm || null,
          unit: r.unit || 'piece',
          gst_percent: 18,
          mrp: Number(r.sp || 0),
          selling_price: Number(r.sp || 0),
          wholesale_price: Math.round(Number(r.sp || 0) * 0.95 * 100) / 100,
          purchase_price: Number(r.cp || 0),
          current_stock: Number(r.stock || 0),
          reorder_level: 10,
          is_active: true,
          hsn_code: null,
          weight_per_unit: r.diameter_mm ? (STEEL_WEIGHT[r.diameter_mm] || null) : null,
        }));
        const { error: prodError } = await supabase.from('cement_products').insert(productsPayload);
        if (prodError) throw new Error(prodError.message);
      }

      const validBanks = bankAccounts.filter(a => a.bank_name.trim());
      await supabase.from('cement_financials').upsert({
        bunk_id: bunkId,
        cash_in_hand: Number(cashInHand || 0),
        bank_accounts: validBanks.map(a => ({ bank_name: a.bank_name, balance: Number(a.balance || 0) })),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'bunk_id' });

      localStorage.setItem(`cement_onboarded_${bunkId}`, '1');
      onComplete();
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const progressPct = step === 0 ? 0 : Math.round((step / (WIZARD_STEPS.length - 1)) * 100);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-orange-50 to-amber-50 z-50 overflow-y-auto">
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="bg-orange-600 text-white px-4 py-3 flex items-center gap-3">
          <Layers size={22} />
          <div>
            <div className="font-bold text-lg leading-tight">CementDesk AI</div>
            <div className="text-orange-100 text-xs">Store Setup</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-orange-200">Step {step + 1} of {WIZARD_STEPS.length}</div>
            <div className="text-xs font-semibold">{WIZARD_STEPS[step].icon} {WIZARD_STEPS[step].label}</div>
          </div>
        </div>

        {/* Progress bar */}
        {step > 0 && (
          <div className="bg-white px-4 py-2 border-b">
            <div className="flex items-center gap-1 mb-1.5">
              {WIZARD_STEPS.slice(1).map((s, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${i + 1 <= step ? 'bg-orange-500' : 'bg-gray-200'}`}
                />
              ))}
            </div>
            <div className="text-xs text-gray-400 text-right">{progressPct}% complete</div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full">

          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
              <div className="text-6xl">🏗️</div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome to CementDesk!</h1>
                <p className="text-gray-500 text-base max-w-sm mx-auto">Let's set up your store. Takes about 5 minutes to get started.</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 max-w-xs">
                {[
                  { icon: '🧱', label: 'Add your inventory' },
                  { icon: '💰', label: 'Set up financials' },
                  { icon: '🚀', label: 'Launch your store' },
                ].map(item => (
                  <div key={item.label} className="flex flex-col items-center gap-2 bg-white rounded-xl p-3 shadow-sm border border-orange-100">
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-xs text-center leading-tight">{item.label}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep(1)}
                className="bg-orange-600 text-white px-8 py-3.5 rounded-xl font-bold text-base hover:bg-orange-700 transition shadow-md flex items-center gap-2"
              >
                Let's Get Started <ChevronRight size={20} />
              </button>
            </div>
          )}

          {/* Step 1 — Cement */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">🧱 Cement Stock</h2>
                <p className="text-sm text-gray-500 mt-1">Toggle on the products you carry. Fill in current stock and prices.</p>
              </div>
              <WizardInventoryTable rows={cementRows} onChange={setCementRows} />
            </div>
          )}

          {/* Step 2 — Steel */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">🔩 Steel / TMT + Binding Wire</h2>
                <p className="text-sm text-gray-500 mt-1">Toggle on the steel items you carry.</p>
              </div>
              <WizardInventoryTable rows={steelRows} onChange={setSteelRows} />
            </div>
          )}

          {/* Step 3 — Sand, Aggregate & Masonry */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">🏗️ Sand, Aggregate & Masonry</h2>
                <p className="text-sm text-gray-500 mt-1">Select the materials you stock.</p>
              </div>
              <WizardInventoryTable rows={aggregateRows} onChange={setAggregateRows} />
            </div>
          )}

          {/* Step 4 — Other Materials */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">📦 Other Materials</h2>
                <p className="text-sm text-gray-500 mt-1">Add tiles, plywoods, waterproofing or any other items you sell.</p>
              </div>
              <WizardInventoryTable rows={otherRows} onChange={setOtherRows} />
            </div>
          )}

          {/* Step 5 — Bank & Cash */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-800">💰 Bank & Cash Details</h2>
                <p className="text-sm text-gray-500 mt-1">These are used to calculate your total business net worth.</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Banknote size={16} className="text-orange-500" /> Cash in Hand
                </label>
                <input
                  type="number"
                  value={cashInHand}
                  onChange={e => setCashInHand(e.target.value)}
                  placeholder="₹0"
                  className="w-full border rounded-xl px-4 py-3 text-lg font-semibold focus:ring-2 focus:ring-orange-300 focus:outline-none"
                />
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Building2 size={16} className="text-orange-500" /> Bank Accounts
                  </label>
                  {bankAccounts.length < 5 && (
                    <button onClick={addBank} className="text-xs text-orange-600 font-medium flex items-center gap-1 hover:text-orange-700">
                      <Plus size={12} /> Add Bank
                    </button>
                  )}
                </div>

                {bankAccounts.map((acc, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      value={acc.bank_name}
                      onChange={e => updateBank(idx, 'bank_name', e.target.value)}
                      placeholder="Bank name (e.g. SBI)"
                      className="flex-1 border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-200 focus:outline-none"
                    />
                    <input
                      type="number"
                      value={acc.balance}
                      onChange={e => updateBank(idx, 'balance', e.target.value)}
                      placeholder="₹0"
                      className="w-32 border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-200 focus:outline-none"
                    />
                    {bankAccounts.length > 1 && (
                      <button onClick={() => removeBank(idx)} className="text-gray-400 hover:text-red-400">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}

                {totalFinancials > 0 && (
                  <div className="bg-orange-50 rounded-lg px-4 py-3 mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Cash in hand</span>
                      <span className="font-medium">{inr(Number(cashInHand || 0))}</span>
                    </div>
                    {bankAccounts.filter(a => a.bank_name.trim()).map((a, i) => (
                      <div key={i} className="flex justify-between text-sm mt-1">
                        <span className="text-gray-600">{a.bank_name}</span>
                        <span className="font-medium">{inr(Number(a.balance || 0))}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-bold text-orange-700 border-t border-orange-200 pt-2 mt-2">
                      <span>Total Financial Assets</span>
                      <span>{inr(totalFinancials)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 6 — Summary */}
          {step === 6 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-800">✅ Summary & Launch</h2>
                <p className="text-sm text-gray-500 mt-1">Review your store setup before launching.</p>
              </div>

              {/* Inventory breakdown */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <h3 className="font-semibold text-gray-700 text-sm">Inventory Summary</h3>
                {summaryByCategory.map(cat => (
                  cat.rows.length > 0 && (
                    <div key={cat.label} className="flex justify-between py-1.5 border-b last:border-0 text-sm">
                      <span className="text-gray-600">{cat.label} <span className="text-gray-400">({cat.rows.length} items)</span></span>
                      <span className="font-semibold text-gray-800">{inr(cat.rows.reduce((s, r) => s + Number(r.stock || 0) * Number(r.cp || 0), 0))}</span>
                    </div>
                  )
                ))}
                {includedRows.length === 0 && (
                  <p className="text-sm text-gray-400">No inventory items added yet.</p>
                )}
                <div className="flex justify-between text-sm font-bold text-gray-800 pt-1">
                  <span>Total Inventory Value</span>
                  <span>{inr(totalInventoryValue)}</span>
                </div>
              </div>

              {/* Financial assets */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                <h3 className="font-semibold text-gray-700 text-sm">Financial Assets</h3>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cash in hand</span>
                  <span className="font-medium">{inr(Number(cashInHand || 0))}</span>
                </div>
                {bankAccounts.filter(a => a.bank_name.trim()).map((a, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">{a.bank_name}</span>
                    <span className="font-medium">{inr(Number(a.balance || 0))}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold text-gray-800 border-t pt-2">
                  <span>Total Financial Assets</span>
                  <span>{inr(totalFinancials)}</span>
                </div>
              </div>

              {/* Net Worth */}
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy size={20} />
                  <span className="font-semibold">Business Net Worth</span>
                </div>
                <div className="text-3xl font-bold">{inr(netWorth)}</div>
                <div className="text-orange-100 text-xs mt-1">Inventory ({inr(totalInventoryValue)}) + Financial Assets ({inr(totalFinancials)})</div>
              </div>

              {/* Tip */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3">
                <span className="text-yellow-500 text-lg">⚠️</span>
                <p className="text-sm text-yellow-800">Rates change often — update prices whenever you get a new batch to keep your net worth accurate.</p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={handleLaunch}
                disabled={saving}
                className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
              >
                {saving ? <Loader2 size={20} className="animate-spin" /> : '🚀'}
                {saving ? 'Setting up your store…' : 'Launch Dashboard'}
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        {step > 0 && (
          <div className="sticky bottom-0 bg-white border-t px-4 py-3 flex items-center justify-between gap-3">
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              className="flex items-center gap-1.5 text-gray-600 hover:text-gray-800 font-medium text-sm px-4 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition"
            >
              <ChevronLeft size={16} /> Back
            </button>

            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              className="text-gray-400 text-xs hover:text-gray-600 underline"
              style={{ display: step < 6 ? 'block' : 'none' }}
            >
              {/* handled below */}
            </button>

            {step < 6 ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="text-gray-400 text-xs hover:text-gray-600 underline"
                >
                  Skip this category
                </button>
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="flex items-center gap-1.5 bg-orange-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-orange-700 transition"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Rate Update Banner ────────────────────────────────────────────────────────
function RateUpdateBanner({ bunkId, productsCount }: { bunkId: string; productsCount: number }) {
  const storageKey = `cement_rates_updated_${bunkId}`;
  const [visible, setVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [edits, setEdits] = useState<Record<string, { sp: string; cp: string }>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (productsCount === 0) return;
    const stored = localStorage.getItem(storageKey);
    if (!stored) { setVisible(true); return; }
    const diff = Date.now() - new Date(stored).getTime();
    if (diff > 7 * 24 * 60 * 60 * 1000) setVisible(true);
  }, [storageKey, productsCount]);

  const openModal = async () => {
    const { data } = await supabase.from('cement_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('product_type').order('name');
    const prods = data || [];
    setProducts(prods);
    const initEdits: Record<string, { sp: string; cp: string }> = {};
    prods.forEach(p => { initEdits[p.id] = { sp: String(p.selling_price), cp: String(p.purchase_price) }; });
    setEdits(initEdits);
    setShowModal(true);
  };

  const saveRates = async () => {
    setSaving(true);
    const updates = products.map(p => {
      const e = edits[p.id] || {};
      const sp = Number(e.sp || p.selling_price);
      const cp = Number(e.cp || p.purchase_price);
      return supabase.from('cement_products').update({ selling_price: sp, purchase_price: cp, mrp: sp, wholesale_price: Math.round(sp * 0.95 * 100) / 100 }).eq('id', p.id);
    });
    await Promise.all(updates);
    localStorage.setItem(storageKey, new Date().toISOString());
    setSaving(false);
    setShowModal(false);
    setVisible(false);
    setToast('Rates updated successfully!');
    setTimeout(() => setToast(''), 3000);
  };

  if (!visible) return toast ? (
    <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium z-50 flex items-center gap-2">
      <CheckCircle2 size={16} /> {toast}
    </div>
  ) : null;

  return (
    <>
      {toast && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium z-50 flex items-center gap-2">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-3 mb-4">
        <Zap size={18} className="text-amber-600 shrink-0" />
        <div className="flex-1 text-sm text-amber-800">
          <span className="font-semibold">Market rates may have changed.</span> Tap to update prices.
        </div>
        <button
          onClick={openModal}
          className="bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-600 transition shrink-0"
        >
          Update Rates
        </button>
        <button onClick={() => setVisible(false)} className="text-amber-500 hover:text-amber-700 shrink-0">
          <X size={16} />
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b">
              <div>
                <h3 className="font-bold text-gray-800">Update Product Rates</h3>
                <p className="text-xs text-gray-400 mt-0.5">{products.length} products</p>
              </div>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Product</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 w-28">Selling Price (SP)</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 w-28">Purchase Price (CP)</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className="border-t hover:bg-orange-50/40">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-800 text-sm">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.brand || ''} · {p.unit}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          value={edits[p.id]?.sp ?? p.selling_price}
                          onChange={e => setEdits(prev => ({ ...prev, [p.id]: { ...prev[p.id], sp: e.target.value } }))}
                          className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="number"
                          value={edits[p.id]?.cp ?? p.purchase_price}
                          onChange={e => setEdits(prev => ({ ...prev, [p.id]: { ...prev[p.id], cp: e.target.value } }))}
                          className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-5 border-t">
              <button
                onClick={saveRates}
                disabled={saving}
                className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Save All Rates
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function CementApp({ bunkId, onLogout, user }: { bunkId: string; onLogout: () => void; user: { name: string; email: string; role: string } }) {
  const [tab, setTab] = useState<'dashboard' | 'inventory' | 'sales' | 'customers' | 'deliveries' | 'purchases' | 'expenses' | 'reports' | 'suppliers' | 'intelligence' | 'settings'>('dashboard');
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [productsCount, setProductsCount] = useState(0);

  useEffect(() => {
    const onboardedKey = `cement_onboarded_${bunkId}`;
    const alreadyOnboarded = localStorage.getItem(onboardedKey);
    if (alreadyOnboarded) {
      setShowOnboarding(false);
      return;
    }
    supabase.from('cement_products').select('id', { count: 'exact', head: true }).eq('bunk_id', bunkId).then(({ count }) => {
      if ((count || 0) === 0) {
        setShowOnboarding(true);
      } else {
        localStorage.setItem(onboardedKey, '1');
        setProductsCount(count || 0);
        setShowOnboarding(false);
      }
    });
  }, [bunkId]);

  useEffect(() => {
    if (showOnboarding === false) {
      supabase.from('cement_products').select('id', { count: 'exact', head: true }).eq('bunk_id', bunkId).then(({ count }) => {
        setProductsCount(count || 0);
      });
    }
  }, [showOnboarding, bunkId]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

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
    { id: 'intelligence', label: 'AI Insights', icon: Brain },
    { id: 'settings',   label: 'Settings',    icon: Settings },
  ] as const;

  // Waiting for first-run check
  if (showOnboarding === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-500" size={36} />
      </div>
    );
  }

  if (showOnboarding) {
    return <CementOnboarding bunkId={bunkId} onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-orange-600 text-white px-4 py-3 flex items-center gap-3 shadow">
        <Layers size={22} />
        <div>
          <div className="font-bold text-lg leading-tight">CementDesk AI</div>
          <div className="text-orange-100 text-xs">Building Materials Store</div>
        </div>
        <button onClick={onLogout} className="ml-auto p-2 rounded-lg hover:bg-white/20 transition" title="Sign Out">
          <LogOut size={20} />
        </button>
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
        <RateUpdateBanner bunkId={bunkId} productsCount={productsCount} />
        {tab === 'dashboard'  && <DashboardTab bunkId={bunkId} />}
        {tab === 'inventory'  && <InventoryTab bunkId={bunkId} />}
        {tab === 'sales'      && <SalesTab bunkId={bunkId} />}
        {tab === 'customers'  && <CustomersTab bunkId={bunkId} />}
        {tab === 'deliveries' && <DeliveriesTab bunkId={bunkId} />}
        {tab === 'purchases'  && <PurchasesTab bunkId={bunkId} />}
        {tab === 'expenses'   && <ExpensesTab bunkId={bunkId} />}
        {tab === 'reports'    && <ReportsTab bunkId={bunkId} />}
        {tab === 'suppliers'  && <SuppliersTab bunkId={bunkId} />}
        {tab === 'intelligence' && <IntelligenceTab bunkId={bunkId} />}
        {tab === 'settings'   && <SettingsTab bunkId={bunkId} user={user} onLogout={onLogout} />}
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
  const [financials, setFinancials] = useState<CementFinancials | null>(null);
  const [inventoryValue, setInventoryValue] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const [salesRes, expRes, delRes, prodRes, custRes, finRes] = await Promise.all([
      supabase.from('cement_sales').select('total_amount').eq('bunk_id', bunkId).eq('sale_date', getTodayIST()),
      supabase.from('cement_expenses').select('amount').eq('bunk_id', bunkId).eq('expense_date', getTodayIST()),
      supabase.from('cement_deliveries').select('*').eq('bunk_id', bunkId).neq('status', 'delivered').order('delivery_date', { ascending: true }),
      supabase.from('cement_products').select('*').eq('bunk_id', bunkId).eq('is_active', true),
      supabase.from('cement_customers').select('outstanding_amount').eq('bunk_id', bunkId).eq('is_active', true),
      supabase.from('cement_financials').select('*').eq('bunk_id', bunkId).maybeSingle(),
    ]);
    const todaySales = (salesRes.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const todayExpenses = (expRes.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const pendingDeliveries = (delRes.data || []).length;
    const products = prodRes.data || [];
    const lowStockItems = products.filter(p => Number(p.current_stock) <= Number(p.reorder_level));
    const outstandingTotal = (custRes.data || []).reduce((s, r) => s + Number(r.outstanding_amount || 0), 0);
    const stockVal = products.reduce((s, p) => s + Number(p.current_stock || 0) * Number(p.purchase_price || 0), 0);
    setStats({ todaySales, todayExpenses, pendingDeliveries, lowStockCount: lowStockItems.length, outstandingTotal });
    setLowStock(lowStockItems.slice(0, 5));
    setPendingDels((delRes.data || []).slice(0, 5) as Delivery[]);
    setInventoryValue(stockVal);
    if (finRes.data) setFinancials(finRes.data as CementFinancials);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { load(); }, [load]);

  const cashInHand = Number(financials?.cash_in_hand || 0);
  const bankTotal = (financials?.bank_accounts || []).reduce((s, a) => s + Number(a.balance || 0), 0);
  const financialAssets = cashInHand + bankTotal;
  const netWorth = inventoryValue + financialAssets;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Today — {formatISTDate(getTodayIST())}</h2>
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

      {/* Net Worth Card */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 text-white shadow">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={18} />
              <span className="font-semibold text-sm">Business Net Worth</span>
            </div>
            <div className="text-3xl font-bold">{inr(netWorth)}</div>
          </div>
          <div className="text-right text-sm space-y-1">
            <div className="text-orange-100">
              <span className="opacity-80">Inventory</span>
              <div className="font-semibold text-white">{inr(inventoryValue)}</div>
            </div>
            <div className="text-orange-100">
              <span className="opacity-80">Financial Assets</span>
              <div className="font-semibold text-white">{inr(financialAssets)}</div>
            </div>
          </div>
        </div>
        {financials && (financials.cash_in_hand > 0 || (financials.bank_accounts || []).length > 0) && (
          <div className="mt-3 pt-3 border-t border-orange-400/40 flex flex-wrap gap-3 text-xs text-orange-100">
            {financials.cash_in_hand > 0 && (
              <span>Cash: <strong className="text-white">{inr(cashInHand)}</strong></span>
            )}
            {(financials.bank_accounts || []).filter(a => a.bank_name).map((a, i) => (
              <span key={i}>{a.bank_name}: <strong className="text-white">{inr(Number(a.balance || 0))}</strong></span>
            ))}
          </div>
        )}
      </div>

      {/* Overdue Delivery Warning */}
      {(() => {
        const overdueDeliveries = pendingDels.filter(d => d.delivery_date < getTodayIST() && d.status !== 'delivered');
        return overdueDeliveries.length > 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
            <span className="text-sm text-red-700 font-medium">
              {overdueDeliveries.length} overdue deliver{overdueDeliveries.length > 1 ? 'ies' : 'y'} — customer{overdueDeliveries.length > 1 ? 's' : ''}: {overdueDeliveries.map(d => d.customer_name || 'Unknown').join(', ')}
            </span>
          </div>
        ) : null;
      })()}

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
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3"><CheckCircle2 size={16} className="text-green-600" /><h3 className="font-semibold text-gray-700">Today's Checklist</h3></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { done: stats.todaySales > 0, text: "Record today's sales" },
            { done: stats.lowStockCount === 0, text: `Reorder low stock${stats.lowStockCount > 0 ? ` (${stats.lowStockCount} items)` : ''}` },
            { done: stats.pendingDeliveries === 0, text: `Dispatch pending deliveries${stats.pendingDeliveries > 0 ? ` (${stats.pendingDeliveries})` : ''}` },
            { done: stats.outstandingTotal === 0, text: `Collect outstanding${stats.outstandingTotal > 0 ? ` (${inr(stats.outstandingTotal)})` : ''}` },
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
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustMode, setAdjustMode] = useState<'add' | 'remove'>('add');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('Physical count correction');
  const [adjustSaving, setAdjustSaving] = useState(false);

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
            <div key={p.id} className={`bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow ${isLow ? 'border-yellow-300' : 'border-gray-100'}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1" onClick={() => openForm(p)}>
                  <div className="font-semibold text-gray-800">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {p.brand} {p.grade ? `· ${p.grade}` : ''} {p.diameter_mm ? `· ${p.diameter_mm}mm` : ''} · GST {p.gst_percent}%
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <div className={`font-bold text-lg ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{p.current_stock} <span className="text-sm font-normal text-gray-400">{p.unit}</span></div>
                  {isLow && <div className="text-xs text-red-500">⚠ Low Stock</div>}
                  <button onClick={e => { e.stopPropagation(); setAdjustProduct(p); setAdjustMode('add'); setAdjustQty(''); setAdjustReason('Physical count correction'); }}
                    className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded font-medium hover:bg-orange-100">± Adjust</button>
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

      {/* Stock Adjustment Modal */}
      {adjustProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Adjust Stock</h3>
              <button onClick={() => setAdjustProduct(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-600">{adjustProduct.name} <span className="text-gray-400">— current: <strong>{adjustProduct.current_stock} {adjustProduct.unit}</strong></span></p>
            <div className="flex gap-2">
              {(['add', 'remove'] as const).map(m => (
                <button key={m} onClick={() => setAdjustMode(m)} className={`flex-1 py-2 rounded-lg text-sm font-medium ${adjustMode === m ? (m === 'add' ? 'bg-green-600 text-white' : 'bg-red-500 text-white') : 'bg-gray-100 text-gray-600'}`}>{m === 'add' ? '+ Add Stock' : '− Remove Stock'}</button>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Quantity ({adjustProduct.unit}) *</label>
              <input type="number" min="0.001" step="any" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Reason</label>
              <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                {['Physical count correction', 'Supplier delivery', 'Damage/Breakage', 'Transfer in', 'Transfer out', 'Other'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <button disabled={adjustSaving || !adjustQty || Number(adjustQty) <= 0} onClick={async () => {
              const qty = Number(adjustQty);
              if (!qty || qty <= 0) return;
              setAdjustSaving(true);
              const { data: fresh } = await supabase.from('cement_products').select('current_stock').eq('id', adjustProduct.id).eq('bunk_id', bunkId).maybeSingle();
              const base = Number(fresh?.current_stock ?? adjustProduct.current_stock);
              const newStock = adjustMode === 'add' ? base + qty : Math.max(0, base - qty);
              await supabase.from('cement_products').update({ current_stock: newStock }).eq('id', adjustProduct.id);
              setAdjustSaving(false);
              setAdjustProduct(null);
              load();
            }} className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {adjustSaving && <Loader2 size={16} className="animate-spin" />}
              Confirm Adjustment
            </button>
          </div>
        </div>
      )}

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
      customer_name: selCustomer?.name || 'Walk-in', sale_date: getTodayIST(),
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
interface LedgerEntry { date: string; type: 'sale' | 'payment'; amount: number; label: string; status?: string; mode?: string; }

function CustomerLedgerModal({ bunkId, customer, onClose }: { bunkId: string; customer: Customer; onClose: () => void }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [salesRes, paymentsRes] = await Promise.all([
        supabase.from('cement_sales').select('id,sale_date,total_amount,paid_amount,payment_status').eq('bunk_id', bunkId).eq('customer_id', customer.id).order('sale_date', { ascending: true }),
        supabase.from('cement_customer_payments').select('id,payment_date,amount,payment_mode').eq('bunk_id', bunkId).eq('customer_id', customer.id).order('payment_date', { ascending: true }),
      ]);
      const rows: LedgerEntry[] = [
        ...(salesRes.data || []).map(s => ({ date: s.sale_date, type: 'sale' as const, amount: Number(s.total_amount), label: 'Sale', status: s.payment_status })),
        ...(paymentsRes.data || []).map(p => ({ date: p.payment_date, type: 'payment' as const, amount: Number(p.amount), label: 'Payment', mode: p.payment_mode })),
      ];
      rows.sort((a, b) => a.date.localeCompare(b.date));
      setEntries(rows);
      setLoading(false);
    })();
  }, [bunkId, customer.id]);

  let running = 0;
  const rowsWithBalance = entries.map(e => {
    if (e.type === 'sale') running += e.amount;
    else running = Math.max(0, running - e.amount);
    return { ...e, balance: running };
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-bold text-gray-800">{customer.name}</h2>
            <p className="text-xs text-gray-500 capitalize">{customer.customer_type} · Outstanding: <span className="text-red-600 font-semibold">{inr(customer.outstanding_amount)}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-orange-500" size={24} /></div>}
          {!loading && rowsWithBalance.length === 0 && <p className="text-center text-gray-400 py-8">No transactions yet</p>}
          {!loading && rowsWithBalance.length > 0 && (
            <div className="space-y-1">
              <div className="grid grid-cols-4 gap-1 text-xs font-medium text-gray-500 pb-2 border-b">
                <span>Date</span><span>Transaction</span><span className="text-right">Amount</span><span className="text-right">Balance</span>
              </div>
              {rowsWithBalance.map((e, i) => (
                <div key={i} className={`grid grid-cols-4 gap-1 py-2 border-b last:border-0 text-sm ${e.type === 'payment' ? 'bg-green-50 rounded' : ''}`}>
                  <span className="text-xs text-gray-500">{formatISTDate(e.date)}</span>
                  <span className={`text-xs font-medium ${e.type === 'payment' ? 'text-green-700' : 'text-gray-700'}`}>
                    {e.type === 'payment' ? `✅ Payment (${e.mode})` : `📦 Sale (${e.status})`}
                  </span>
                  <span className={`text-right text-xs font-semibold ${e.type === 'payment' ? 'text-green-600' : 'text-orange-600'}`}>
                    {e.type === 'payment' ? '-' : '+'}{inr(e.amount)}
                  </span>
                  <span className="text-right text-xs font-bold text-gray-700">{inr(e.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function agingBadge(lastDate: string | null | undefined) {
  const d = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : 999;
  if (d < 8) return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{d}d</span>;
  if (d < 31) return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{d}d</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">{d === 999 ? 'new' : d + 'd'}</span>;
}

const CUST_PAGE_SIZE = 10;

function CustomersTab({ bunkId }: { bunkId: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [custPage, setCustPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', customer_type: 'retail', gstin: '', credit_limit: 0 });
  const [saving, setSaving] = useState(false);
  const [payModal, setPayModal] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [payingSaving, setPayingSaving] = useState(false);
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);

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

  const handleCollectPayment = async () => {
    if (!payModal) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    setPayingSaving(true);
    await supabase.from('cement_customer_payments').insert({
      bunk_id: bunkId, customer_id: payModal.id,
      amount: amt, payment_mode: payMode, payment_date: getTodayIST(),
    });
    const { data: fresh } = await supabase.from('cement_customers').select('outstanding_amount').eq('id', payModal.id).eq('bunk_id', bunkId).maybeSingle();
    const base = fresh ? Number(fresh.outstanding_amount) : Number(payModal.outstanding_amount);
    await supabase.from('cement_customers').update({ outstanding_amount: Math.max(0, base - amt) }).eq('id', payModal.id);
    setPayingSaving(false);
    setPayModal(null); setPayAmount(''); load();
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
        {filtered.slice(custPage * CUST_PAGE_SIZE, (custPage + 1) * CUST_PAGE_SIZE).map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm">
            <div className="flex justify-between items-start">
              <div className="flex-1 cursor-pointer" onClick={() => { setEditing(c); setForm({ name: c.name, phone: c.phone || '', address: c.address || '', customer_type: c.customer_type, gstin: c.gstin || '', credit_limit: c.credit_limit }); setShowForm(true); }}>
                <div className="font-medium text-gray-800">{c.name}</div>
                <div className="text-xs text-gray-400 mt-0.5 capitalize">{c.customer_type} {c.phone ? `· ${c.phone}` : ''}</div>
              </div>
              <div className="text-right flex flex-col items-end gap-1.5">
                {c.outstanding_amount > 0 && <div className="text-sm font-bold text-red-600">{inr(c.outstanding_amount)}</div>}
                {c.outstanding_amount > 0 && agingBadge(c.last_payment_date)}
                <div className="text-xs text-gray-400">Total: {inr(c.total_purchases)}</div>
                <div className="flex gap-1.5">
                  <button onClick={() => setLedgerCustomer(c)} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-lg hover:bg-gray-200 font-medium">Ledger</button>
                  {c.outstanding_amount > 0 && <button onClick={() => { setPayModal(c); setPayAmount(''); setPayMode('cash'); }} className="bg-orange-500 text-white text-xs px-3 py-1 rounded-lg hover:bg-orange-600 font-medium">Collect</button>}
                </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-10 text-gray-400">No customers found</div>}
      </div>
      {filtered.length > CUST_PAGE_SIZE && (
        <div className="flex items-center justify-between px-1 py-2 text-sm text-gray-600">
          <span>{custPage * CUST_PAGE_SIZE + 1}–{Math.min((custPage + 1) * CUST_PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex gap-2">
            <button disabled={custPage === 0} onClick={() => setCustPage(p => p - 1)} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <button disabled={(custPage + 1) * CUST_PAGE_SIZE >= filtered.length} onClick={() => setCustPage(p => p + 1)} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}

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
      {payModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Collect Payment</h3>
              <button onClick={() => setPayModal(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-600">Customer: <span className="font-semibold">{payModal.name}</span></p>
            <p className="text-sm text-red-600 font-medium">Outstanding: {inr(payModal.outstanding_amount)}</p>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Amount Received (₹) *</label><input type="number" min="1" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none" autoFocus /></div>
            <div><label className="text-xs font-medium text-gray-600 mb-1 block">Payment Mode</label><select value={payMode} onChange={e => setPayMode(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">{['cash','upi','card','cheque'].map(m => <option key={m}>{m}</option>)}</select></div>
            <button onClick={handleCollectPayment} disabled={payingSaving} className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {payingSaving && <Loader2 size={16} className="animate-spin" />}Confirm Payment
            </button>
          </div>
        </div>
      )}
      {ledgerCustomer && <CustomerLedgerModal bunkId={bunkId} customer={ledgerCustomer} onClose={() => setLedgerCustomer(null)} />}
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
  const [form, setForm] = useState({ customer_id: '', customer_name: '', delivery_date: getTodayIST(), site_address: '', vehicle_number: '', driver_name: '', driver_phone: '', status: 'pending', notes: '' });
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
        <button onClick={() => { setForm({ customer_id: '', customer_name: '', delivery_date: getTodayIST(), site_address: '', vehicle_number: '', driver_name: '', driver_phone: '', status: 'pending', notes: '' }); setShowForm(true); }}
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
  const [form, setForm] = useState({ supplier_id: '', invoice_number: '', purchase_date: getTodayIST(), vehicle_number: '', payment_status: 'unpaid', paid_amount: 0, notes: '' });
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
        <button onClick={() => { setForm({ supplier_id: '', invoice_number: '', purchase_date: getTodayIST(), vehicle_number: '', payment_status: 'unpaid', paid_amount: 0, notes: '' }); setItems([]); setShowForm(true); }}
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
  const [form, setForm] = useState({ category: 'other', description: '', amount: '', expense_date: getTodayIST(), payment_mode: 'cash', notes: '' });
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
        <button onClick={() => { setForm({ category: 'other', description: '', amount: '', expense_date: getTodayIST(), payment_mode: 'cash', notes: '' }); setShowForm(true); }}
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
  const currentMonth = getTodayIST().substring(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState<any[]>([]);

  const handleExportCSV = () => {
    const sales = salesData;
    if (!sales || sales.length === 0) { return; }
    const headers = ['Date', 'Customer', 'Amount', 'Status', 'Mode'];
    const rows = (sales as any[]).map(s => [
      s.sale_date || s.created_at?.substring(0,10) || '',
      s.customer_name || '-',
      s.total_amount || 0,
      s.payment_status || s.delivery_status || '-',
      s.payment_mode || '-'
    ]);
    const csv = [headers, ...rows].map(r => r.map(String).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cement-report-${new Date().toISOString().substring(0,7)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  const loadReport = useCallback(async () => {
    setLoading(true);
    const from = `${month}-01`;
    const to = `${month}-31`;
    const [sales, exp, pur, prod, cust, topCust] = await Promise.all([
      supabase.from('cement_sales').select('id, total_amount, paid_amount, payment_status, sale_date').eq('bunk_id', bunkId).gte('sale_date', from).lte('sale_date', to),
      supabase.from('cement_expenses').select('amount, category').eq('bunk_id', bunkId).gte('expense_date', from).lte('expense_date', to),
      supabase.from('cement_purchases').select('total_amount').eq('bunk_id', bunkId).gte('purchase_date', from).lte('purchase_date', to),
      supabase.from('cement_products').select('name, current_stock, purchase_price, product_type').eq('bunk_id', bunkId).eq('is_active', true),
      supabase.from('cement_customers').select('outstanding_amount').eq('bunk_id', bunkId).eq('is_active', true),
      supabase.from('cement_customers').select('name, customer_type, outstanding_amount').eq('bunk_id', bunkId).eq('is_active', true).gt('outstanding_amount', 0).order('outstanding_amount', { ascending: false }).limit(5),
    ]);

    const totalSales = (sales.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const totalPaid = (sales.data || []).reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    const cashCollected = (sales.data || []).filter(r => r.payment_status === 'paid').reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const creditGiven = totalSales - cashCollected;
    const totalExp = (exp.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalPurchases = (pur.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const totalOutstanding = (cust.data || []).reduce((s, r) => s + Number(r.outstanding_amount || 0), 0);
    const stockValue = (prod.data || []).reduce((s, p) => s + Number(p.current_stock || 0) * Number(p.purchase_price || 0), 0);

    const expByCategory: Record<string, number> = {};
    (exp.data || []).forEach(e => { expByCategory[e.category] = (expByCategory[e.category] || 0) + Number(e.amount || 0); });

    const salesByDay: Record<string, number> = {};
    (sales.data || []).forEach(s => { salesByDay[s.sale_date] = (salesByDay[s.sale_date] || 0) + Number(s.total_amount || 0); });

    // Top products from sale_items
    let topProducts: { name: string; qty: number; revenue: number }[] = [];
    const saleIds = (sales.data || []).map(s => s.id);
    if (saleIds.length > 0) {
      const { data: items } = await supabase.from('cement_sale_items').select('product_name, quantity, total_amount').in('sale_id', saleIds);
      const grouped: Record<string, { qty: number; revenue: number }> = {};
      (items || []).forEach(i => {
        if (!grouped[i.product_name]) grouped[i.product_name] = { qty: 0, revenue: 0 };
        grouped[i.product_name].qty += Number(i.quantity || 0);
        grouped[i.product_name].revenue += Number(i.total_amount || 0);
      });
      topProducts = Object.entries(grouped).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
    }

    setReport({ totalSales, totalPaid, cashCollected, creditGiven, totalExp, totalPurchases, totalOutstanding, stockValue, expByCategory, salesByDay, salesCount: (sales.data || []).length, topCustomers: topCust.data || [], topProducts });
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

          {/* Cash vs Credit split */}
          {report.cashCollected + report.creditGiven > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm">Cash vs Credit Split</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-green-700 font-medium">💵 Cash Sales</span><span className="font-bold text-green-700">{inr(report.cashCollected)}</span></div>
                <div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full" style={{ width: `${report.totalSales > 0 ? (report.cashCollected / report.totalSales) * 100 : 0}%` }} /></div>
                <div className="flex justify-between text-sm"><span className="text-orange-600 font-medium">📝 Credit Sales</span><span className="font-bold text-orange-600">{inr(report.creditGiven)}</span></div>
                <div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-orange-400 h-2 rounded-full" style={{ width: `${report.totalSales > 0 ? (report.creditGiven / report.totalSales) * 100 : 0}%` }} /></div>
              </div>
            </div>
          )}

          {/* Top Products */}
          {report.topProducts?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm">🏆 Top Products by Revenue</h3>
              {report.topProducts.map((p: { name: string; qty: number; revenue: number }, i: number) => (
                <div key={i} className="flex justify-between items-center py-1.5 border-b last:border-0 text-sm">
                  <div><span className="font-medium text-orange-600 mr-1">{i + 1}.</span><span className="text-gray-800">{p.name}</span><span className="text-xs text-gray-400 ml-1">({p.qty.toFixed(1)} units)</span></div>
                  <span className="font-bold text-gray-700">{inr(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Top Customers by Outstanding */}
          {report.topCustomers?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm">🔴 Top 5 by Outstanding</h3>
              {report.topCustomers.map((c: { name: string; customer_type: string; outstanding_amount: number }, i: number) => (
                <div key={i} className="flex justify-between items-center py-1.5 border-b last:border-0 text-sm">
                  <div><span className="font-medium text-gray-500 mr-1">{i + 1}.</span><span className="text-gray-800">{c.name}</span><span className="text-xs text-gray-400 ml-1 capitalize">({c.customer_type})</span></div>
                  <span className="font-bold text-red-600">{inr(c.outstanding_amount)}</span>
                </div>
              ))}
            </div>
          )}
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
