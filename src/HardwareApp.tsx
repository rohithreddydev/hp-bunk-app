// ═══════════════════════════════════════════════════════════════════════════
// Smart Biz AI — Hardware Store Module (v2)
// Blue theme — hw_ Supabase tables
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Truck, Receipt,
  Plus, Edit2, Trash2, X, Search, AlertTriangle, CheckCircle2,
  Loader2, TrendingUp, TrendingDown, Wallet, CreditCard,
  Settings as SettingsIcon, LogOut, ChevronDown, ChevronUp,
  FileText, Clock, RefreshCw, Brain, Download,
} from 'lucide-react';
import { SettingsTab } from './SettingsTab';
import { IntelligenceTab } from './IntelligenceTab';
import { supabase } from './supabase';
import { getTodayIST } from './utils';

function inr(n: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0);
}
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'; }

const CATEGORIES = ['Cement & Concrete', 'Steel & Iron', 'Plumbing', 'Electrical', 'Paint', 'Tools', 'Pipe & Fittings', 'Fasteners', 'Safety', 'Sanitary', 'Tiles & Flooring', 'Other'];
const UNITS = ['bag', 'kg', 'ton', 'piece', 'meter', 'foot', 'box', 'set', 'roll', 'pack', 'litre', 'brass'];
const PAYMENT_MODES = ['cash', 'upi', 'card', 'bank_transfer', 'credit', 'cheque'];
const EXPENSE_CATEGORIES = ['Rent', 'Electricity', 'Staff Salary', 'Transport', 'Loading/Unloading', 'Repairs', 'Marketing', 'Other'];

interface Product {
  id: string; bunk_id: string; name: string; brand: string; category: string;
  unit: string; selling_price: number; purchase_price: number; mrp: number;
  current_stock: number; reorder_level: number; is_active: boolean; created_at: string;
}
interface Customer {
  id: string; bunk_id: string; name: string; phone: string; address: string;
  credit_limit: number; outstanding_amount: number; is_active: boolean;
  last_payment_date: string | null; created_at: string;
}
interface Sale {
  id: string; bunk_id: string; customer_id: string | null; customer_name: string;
  sale_date: string; total_amount: number; payment_mode: string; payment_status: string;
  notes: string; site_delivery: boolean; delivery_address: string;
  labour_charges: number; transport_charges: number; discount_amount: number; created_at: string;
}
interface Payment {
  id: string; bunk_id: string; customer_id: string | null; customer_name: string;
  amount: number; payment_mode: string; payment_date: string;
  cheque_number: string | null; cheque_bank: string | null; cheque_date: string | null;
  cheque_status: string; notes: string | null; created_at: string;
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

type Tab = 'dashboard' | 'inventory' | 'sales' | 'customers' | 'purchases' | 'expenses' | 'reports' | 'intelligence' | 'settings';

// ─── HardwareOnboarding wizard ─────────────────────────────────────────────────
interface OnboardItem {
  name: string; brand: string; category: string; unit: string;
  purchase_price: number; selling_price: number; reorder_level: number;
  stock_qty: number; included: boolean;
}
interface OnboardCustomer { name: string; phone: string; outstanding: number; }

const ONBOARD_STEPS = ['Welcome', 'Cement & Concrete', 'Steel & Iron', 'Plumbing & Pipes', 'Electrical & Paints', 'Top Customers', 'Summary & Launch'];

const CEMENT_ITEMS: Omit<OnboardItem, 'included' | 'stock_qty'>[] = [
  { name: 'OPC Cement 50kg', brand: 'ACC/Ultratech', category: 'Cement & Concrete', unit: 'bag', purchase_price: 310, selling_price: 340, reorder_level: 20 },
  { name: 'PPC Cement 50kg', brand: 'Dalmia/Shree', category: 'Cement & Concrete', unit: 'bag', purchase_price: 295, selling_price: 325, reorder_level: 20 },
  { name: 'White Cement 5kg', brand: 'JK White', category: 'Cement & Concrete', unit: 'bag', purchase_price: 150, selling_price: 180, reorder_level: 10 },
  { name: 'M-Sand (Gravel)', brand: '', category: 'Cement & Concrete', unit: 'brass', purchase_price: 900, selling_price: 1100, reorder_level: 2 },
  { name: 'River Sand', brand: '', category: 'Cement & Concrete', unit: 'brass', purchase_price: 1400, selling_price: 1700, reorder_level: 2 },
  { name: 'Red Bricks (1000 nos)', brand: '', category: 'Cement & Concrete', unit: 'piece', purchase_price: 5500, selling_price: 6500, reorder_level: 5 },
];
const STEEL_ITEMS: Omit<OnboardItem, 'included' | 'stock_qty'>[] = [
  { name: 'TMT Saria 8mm (bundle)', brand: 'Jsw/Vizag', category: 'Steel & Iron', unit: 'ton', purchase_price: 54000, selling_price: 58000, reorder_level: 2 },
  { name: 'TMT Saria 10mm (bundle)', brand: 'Jsw/Vizag', category: 'Steel & Iron', unit: 'ton', purchase_price: 54000, selling_price: 58000, reorder_level: 2 },
  { name: 'TMT Saria 12mm (bundle)', brand: 'Jsw/Vizag', category: 'Steel & Iron', unit: 'ton', purchase_price: 53500, selling_price: 57500, reorder_level: 1 },
  { name: 'MS Square Pipe 25×25mm (6m)', brand: '', category: 'Steel & Iron', unit: 'piece', purchase_price: 350, selling_price: 420, reorder_level: 10 },
  { name: 'MS Flat Bar 25mm (6m)', brand: '', category: 'Steel & Iron', unit: 'piece', purchase_price: 280, selling_price: 340, reorder_level: 10 },
  { name: 'GI Wire 16 gauge (kg)', brand: '', category: 'Steel & Iron', unit: 'kg', purchase_price: 62, selling_price: 75, reorder_level: 50 },
];
const PLUMBING_ITEMS: Omit<OnboardItem, 'included' | 'stock_qty'>[] = [
  { name: 'PVC Pipe 3/4" (3m)', brand: 'Ashirvad/Finolex', category: 'Plumbing', unit: 'piece', purchase_price: 65, selling_price: 80, reorder_level: 20 },
  { name: 'PVC Pipe 1" (3m)', brand: 'Ashirvad/Finolex', category: 'Plumbing', unit: 'piece', purchase_price: 95, selling_price: 120, reorder_level: 20 },
  { name: 'CPVC Pipe 1/2" (3m)', brand: 'Astral', category: 'Plumbing', unit: 'piece', purchase_price: 120, selling_price: 150, reorder_level: 10 },
  { name: 'PVC Ball Valve 3/4"', brand: '', category: 'Plumbing', unit: 'piece', purchase_price: 40, selling_price: 55, reorder_level: 20 },
  { name: 'Water Tank 500L', brand: 'Sintex', category: 'Plumbing', unit: 'piece', purchase_price: 1500, selling_price: 1850, reorder_level: 2 },
];
const ELECTRICAL_ITEMS: Omit<OnboardItem, 'included' | 'stock_qty'>[] = [
  { name: 'Wire 2.5mm (90m roll)', brand: 'Polycab/Finolex', category: 'Electrical', unit: 'roll', purchase_price: 1200, selling_price: 1450, reorder_level: 3 },
  { name: 'Wire 4mm (90m roll)', brand: 'Polycab/Finolex', category: 'Electrical', unit: 'roll', purchase_price: 1800, selling_price: 2100, reorder_level: 2 },
  { name: 'MCB 32A Single Pole', brand: 'Havells/Schneider', category: 'Electrical', unit: 'piece', purchase_price: 85, selling_price: 110, reorder_level: 10 },
  { name: 'Interior Paint 20L', brand: 'Asian/Berger', category: 'Paint', unit: 'piece', purchase_price: 1400, selling_price: 1700, reorder_level: 3 },
  { name: 'Exterior Emulsion 20L', brand: 'Asian/Berger', category: 'Paint', unit: 'piece', purchase_price: 1800, selling_price: 2200, reorder_level: 2 },
  { name: 'Primer 4L', brand: '', category: 'Paint', unit: 'piece', purchase_price: 320, selling_price: 400, reorder_level: 5 },
];

function toOnboardItems(base: Omit<OnboardItem, 'included' | 'stock_qty'>[]): OnboardItem[] {
  return base.map(b => ({ ...b, included: true, stock_qty: 0 }));
}

function OnboardItemTable({ items, onChange }: { items: OnboardItem[]; onChange: (items: OnboardItem[]) => void }) {
  function update(i: number, field: keyof OnboardItem, value: string | number | boolean) {
    const next = items.map((item, idx) => idx === i ? { ...item, [field]: value } : item);
    onChange(next);
  }
  function addCustom() {
    onChange([...items, { name: '', brand: '', category: items[0]?.category || 'Other', unit: 'piece', purchase_price: 0, selling_price: 0, reorder_level: 5, stock_qty: 0, included: true }]);
  }
  const inventoryValue = items.filter(it => it.included).reduce((a, it) => a + Number(it.stock_qty || 0) * Number(it.purchase_price || 0), 0);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-500 uppercase">
              <th className="px-2 py-2 text-center w-8"></th>
              <th className="px-2 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-right w-20">Stock</th>
              <th className="px-2 py-2 text-right w-24">Buy ₹</th>
              <th className="px-2 py-2 text-right w-24">Sell ₹</th>
              <th className="px-2 py-2 text-left w-20">Unit</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className={`border-t border-gray-100 ${item.included ? '' : 'opacity-40'}`}>
                <td className="px-2 py-1.5 text-center">
                  <input type="checkbox" checked={item.included} onChange={e => update(i, 'included', e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                </td>
                <td className="px-2 py-1.5">
                  <input value={item.name} onChange={e => update(i, 'name', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-[140px]" placeholder="Product name" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="0" value={item.stock_qty || ''} onChange={e => update(i, 'stock_qty', parseFloat(e.target.value) || 0)} placeholder="0" className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="0" value={item.purchase_price || ''} onChange={e => update(i, 'purchase_price', parseFloat(e.target.value) || 0)} placeholder="0" className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" min="0" value={item.selling_price || ''} onChange={e => update(i, 'selling_price', parseFloat(e.target.value) || 0)} placeholder="0" className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </td>
                <td className="px-2 py-1.5">
                  <select value={item.unit} onChange={e => update(i, 'unit', e.target.value)} className="w-full border border-gray-200 rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400">
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={addCustom} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
        <Plus size={12} /> Add custom item
      </button>
      {inventoryValue > 0 && (
        <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-800 font-medium">
          Inventory value: {inr(inventoryValue)}
        </div>
      )}
    </div>
  );
}

function HardwareOnboarding({ bunkId, onComplete }: { bunkId: string; onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [cementItems, setCementItems] = useState<OnboardItem[]>(() => toOnboardItems(CEMENT_ITEMS));
  const [steelItems, setSteelItems] = useState<OnboardItem[]>(() => toOnboardItems(STEEL_ITEMS));
  const [plumbingItems, setPlumbingItems] = useState<OnboardItem[]>(() => toOnboardItems(PLUMBING_ITEMS));
  const [electricalItems, setElectricalItems] = useState<OnboardItem[]>(() => toOnboardItems(ELECTRICAL_ITEMS));

  const [onboardCustomers, setOnboardCustomers] = useState<OnboardCustomer[]>([
    { name: '', phone: '', outstanding: 0 },
    { name: '', phone: '', outstanding: 0 },
    { name: '', phone: '', outstanding: 0 },
    { name: '', phone: '', outstanding: 0 },
    { name: '', phone: '', outstanding: 0 },
  ]);

  const allItems = [...cementItems, ...steelItems, ...plumbingItems, ...electricalItems];
  const includedItems = allItems.filter(it => it.included && it.name.trim());
  const validCustomers = onboardCustomers.filter(c => c.name.trim());

  const totalInventoryValue = includedItems.reduce((a, it) => a + Number(it.stock_qty || 0) * Number(it.purchase_price || 0), 0);

  const categoryBreakdown = includedItems.reduce<Record<string, number>>((acc, it) => {
    acc[it.category] = (acc[it.category] || 0) + 1;
    return acc;
  }, {});

  function updateCustomer(i: number, field: keyof OnboardCustomer, value: string | number) {
    setOnboardCustomers(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  }

  async function handleLaunch() {
    if (saving) return;
    setSaving(true);
    try {
      if (includedItems.length > 0) {
        const products = includedItems.map(it => ({
          bunk_id: bunkId,
          name: it.name.trim(),
          brand: it.brand || '',
          category: it.category,
          unit: it.unit,
          purchase_price: Number(it.purchase_price) || 0,
          selling_price: Number(it.selling_price) || 0,
          mrp: Number(it.selling_price) || 0,
          current_stock: Number(it.stock_qty) || 0,
          reorder_level: Number(it.reorder_level) || 5,
          is_active: true,
        }));
        const { error } = await supabase.from('hw_products').insert(products);
        if (error) throw error;
      }
      if (validCustomers.length > 0) {
        const custRows = validCustomers.map(c => ({
          bunk_id: bunkId,
          name: c.name.trim(),
          phone: c.phone.trim() || null,
          address: null,
          credit_limit: 0,
          outstanding_amount: Number(c.outstanding) || 0,
          is_active: true,
        }));
        const { error } = await supabase.from('hw_customers').insert(custRows);
        if (error) throw error;
      }
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Setup failed. Please try again.';
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col">
      {/* Progress bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            {ONBOARD_STEPS.map((label, i) => (
              <div key={i} className="flex flex-col items-center flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i + 1 < step ? 'bg-blue-600 text-white' : i + 1 === step ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-gray-200 text-gray-500'}`}>
                  {i + 1 < step ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                {i < ONBOARD_STEPS.length - 1 && <div className={`hidden sm:block absolute h-0.5 ${i + 1 < step ? 'bg-blue-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500 hidden sm:flex">
            {ONBOARD_STEPS.map((label, i) => (
              <span key={i} className={`flex-1 text-center ${i + 1 === step ? 'text-blue-600 font-medium' : ''}`}>{label}</span>
            ))}
          </div>
          <p className="text-xs text-gray-500 sm:hidden text-center">Step {step} of {ONBOARD_STEPS.length}: <span className="text-blue-600 font-medium">{ONBOARD_STEPS[step - 1]}</span></p>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="p-8 text-center space-y-5">
              <div className="text-5xl mb-2">🔧</div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome to Hardware Store AI</h1>
              <p className="text-gray-600 text-base leading-relaxed max-w-md mx-auto">
                Let's set up your store in 5 minutes. Add your inventory, top customers, and you're ready to record sales!
              </p>
              <button onClick={() => setStep(2)} className="mt-4 bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors shadow-md">
                Get Started →
              </button>
            </div>
          )}

          {/* Step 2: Cement & Concrete */}
          {step === 2 && (
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Cement & Concrete</h2>
                <p className="text-sm text-gray-500 mt-1">Check items you stock. Fill current quantity, adjust prices if needed.</p>
              </div>
              <OnboardItemTable items={cementItems} onChange={setCementItems} />
            </div>
          )}

          {/* Step 3: Steel & Iron */}
          {step === 3 && (
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Steel & Iron</h2>
                <p className="text-sm text-gray-500 mt-1">Check items you stock. Fill current quantity, adjust prices if needed.</p>
              </div>
              <OnboardItemTable items={steelItems} onChange={setSteelItems} />
            </div>
          )}

          {/* Step 4: Plumbing & Pipes */}
          {step === 4 && (
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Plumbing & Pipes</h2>
                <p className="text-sm text-gray-500 mt-1">Check items you stock. Fill current quantity, adjust prices if needed.</p>
              </div>
              <OnboardItemTable items={plumbingItems} onChange={setPlumbingItems} />
            </div>
          )}

          {/* Step 5: Electrical & Paints */}
          {step === 5 && (
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Electrical & Paints</h2>
                <p className="text-sm text-gray-500 mt-1">Check items you stock. Fill current quantity, adjust prices if needed.</p>
              </div>
              <OnboardItemTable items={electricalItems} onChange={setElectricalItems} />
            </div>
          )}

          {/* Step 6: Top Customers */}
          {step === 6 && (
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add your regular customers (credit parties)</h2>
                <p className="text-sm text-gray-500 mt-1">Add contractors, builders, or anyone who buys on credit.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 uppercase">
                      <th className="px-2 py-2 text-left">Name</th>
                      <th className="px-2 py-2 text-left w-32">Phone</th>
                      <th className="px-2 py-2 text-right w-32">Outstanding (₹ owed)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onboardCustomers.map((c, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-2">
                          <input value={c.name} onChange={e => updateCustomer(i, 'name', e.target.value)} placeholder="Customer name" className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </td>
                        <td className="px-2 py-2">
                          <input value={c.phone} onChange={e => updateCustomer(i, 'phone', e.target.value)} placeholder="Phone" className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </td>
                        <td className="px-2 py-2">
                          <input type="number" min="0" value={c.outstanding || ''} onChange={e => updateCustomer(i, 'outstanding', parseFloat(e.target.value) || 0)} placeholder="0" className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setOnboardCustomers(prev => [...prev, { name: '', phone: '', outstanding: 0 }])} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                <Plus size={12} /> Add more rows
              </button>
            </div>
          )}

          {/* Step 7: Summary & Launch */}
          {step === 7 && (
            <div className="p-6 space-y-5">
              <h2 className="text-xl font-bold text-gray-900">Summary & Launch</h2>
              <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Package size={18} className="text-blue-600" />
                  <span className="font-semibold text-gray-800">{includedItems.length} products ready</span>
                </div>
                {Object.entries(categoryBreakdown).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between pl-6 text-sm text-gray-600">
                    <span>{cat}</span>
                    <span className="font-medium">{count} items</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-blue-100">
                  <span className="text-sm font-semibold text-blue-800">Total inventory value</span>
                  <span className="text-sm font-bold text-blue-800">{inr(totalInventoryValue)}</span>
                </div>
              </div>
              {validCustomers.length > 0 && (
                <div className="bg-orange-50 rounded-xl p-4 flex items-center gap-3">
                  <Users size={18} className="text-orange-600" />
                  <span className="font-semibold text-gray-800">{validCustomers.length} customer{validCustomers.length > 1 ? 's' : ''} to add</span>
                </div>
              )}
              <button onClick={handleLaunch} disabled={saving} className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2 shadow-md">
                {saving ? <><Loader2 size={18} className="animate-spin" /> Setting up…</> : '🚀 Launch Store'}
              </button>
            </div>
          )}

          {/* Navigation */}
          {step > 1 && (
            <div className="flex items-center justify-between px-6 pb-6 pt-2 border-t border-gray-100">
              <button onClick={() => setStep(s => s - 1)} disabled={saving} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm font-medium disabled:opacity-40">
                ← Back
              </button>
              {step < 7 && (
                <button onClick={() => setStep(s => s + 1)} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
                  Next →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function HardwareApp({ bunkId, onLogout, user }: { bunkId: string; onLogout: () => void; user: { name: string; email: string; role: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  // BUG-FIX: Replace browser confirm() with React state modal (confirm() is blocked on mobile PWA)
  const [confirmState, setConfirmState] = useState<{ msg: string; onYes: () => void } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const showConfirm = (msg: string, onYes: () => void) => setConfirmState({ msg, onYes });

  useEffect(() => {
    if (!bunkId) return;
    const key = `hwOnboardingDone_${bunkId}`;
    if (localStorage.getItem(key)) return;
    supabase.from('hw_products').select('id').eq('bunk_id', bunkId).eq('is_active', true).limit(1)
      .then(({ data }) => {
        if (!data || data.length === 0) setShowOnboarding(true);
      });
  }, [bunkId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [p, c, sa, pay, pu, ex] = await Promise.all([
      supabase.from('hw_products').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('hw_customers').select('*').eq('bunk_id', bunkId).eq('is_active', true).order('name'),
      supabase.from('hw_sales').select('*').eq('bunk_id', bunkId).order('sale_date', { ascending: false }).limit(300),
      supabase.from('hw_payments').select('*').eq('bunk_id', bunkId).order('payment_date', { ascending: false }).limit(200),
      supabase.from('hw_purchases').select('*').eq('bunk_id', bunkId).order('purchase_date', { ascending: false }).limit(100),
      supabase.from('hw_expenses').select('*').eq('bunk_id', bunkId).order('expense_date', { ascending: false }).limit(200),
    ]);
    if (p.data) setProducts(p.data as Product[]);
    if (c.data) setCustomers(c.data as Customer[]);
    if (sa.data) setSales(sa.data as Sale[]);
    if (pay.data) setPayments(pay.data as Payment[]);
    if (pu.data) setPurchases(pu.data as Purchase[]);
    if (ex.data) setExpenses(ex.data as Expense[]);
    setLoading(false);
  }, [bunkId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const ch = supabase
      .channel(`hw-rt-${bunkId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hw_sales',     filter: `bunk_id=eq.${bunkId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hw_expenses',  filter: `bunk_id=eq.${bunkId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hw_customers', filter: `bunk_id=eq.${bunkId}` }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bunkId, fetchAll]);

  const today = getTodayIST();
  const todaySalesTotal = sales.filter(s => s.sale_date === today).reduce((a, s) => a + s.total_amount, 0);
  const todayExpenses = expenses.filter(e => e.expense_date === today).reduce((a, e) => a + e.amount, 0);
  const todayCollections = payments.filter(p => p.payment_date === today).reduce((a, p) => a + p.amount, 0);
  const lowStock = products.filter(p => p.current_stock <= p.reorder_level);
  const totalCreditOutstanding = customers.reduce((a, c) => a + (c.outstanding_amount || 0), 0);
  const pendingCheques = payments.filter(p => p.payment_mode === 'cheque' && p.cheque_status === 'received').length;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'inventory', label: 'Inventory', icon: <Package size={16} /> },
    { id: 'sales', label: 'Sales / POS', icon: <ShoppingCart size={16} /> },
    { id: 'customers', label: 'Customers', icon: <Users size={16} /> },
    { id: 'purchases', label: 'Purchases', icon: <Truck size={16} /> },
    { id: 'expenses', label: 'Expenses', icon: <Receipt size={16} /> },
    { id: 'reports', label: 'Reports', icon: <FileText size={16} /> },
    { id: 'intelligence', label: 'AI Insights', icon: <Brain size={16} /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon size={16} /> },
  ];

  if (showOnboarding) {
    return (
      <HardwareOnboarding
        bunkId={bunkId}
        onComplete={() => {
          localStorage.setItem(`hwOnboardingDone_${bunkId}`, '1');
          setShowOnboarding(false);
          fetchAll();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center gap-3 shadow-md">
        <span className="text-2xl">🔧</span>
        <div>
          <h1 className="font-bold text-lg leading-tight">Hardware Store</h1>
          <p className="text-blue-200 text-xs">Smart Biz AI</p>
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

      {/* BUG-FIX: React-based confirm modal — replaces browser confirm() which is blocked on mobile PWA */}
      {confirmState && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-2 text-red-600 mb-3">
              <AlertTriangle size={22} />
              <h3 className="font-bold text-gray-900">Confirm</h3>
            </div>
            <p className="text-gray-700 mb-6 text-sm">{confirmState.msg}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmState(null)}
                className="px-4 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-xl transition text-sm">
                Cancel
              </button>
              <button onClick={() => { const fn = confirmState.onYes; setConfirmState(null); fn(); }}
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition text-sm">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex min-w-max">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="p-4 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
        ) : (
          <>
            {activeTab === 'dashboard' && <HwDashboard todaySalesTotal={todaySalesTotal} todayExpenses={todayExpenses} todayCollections={todayCollections} lowStock={lowStock} recentSales={sales.slice(0, 8)} totalProducts={products.length} totalCreditOutstanding={totalCreditOutstanding} pendingCheques={pendingCheques} customers={customers} products={products} />}
            {activeTab === 'inventory' && <HwInventory bunkId={bunkId} products={products} onRefresh={fetchAll} showToast={showToast} showConfirm={showConfirm} isOwner={user?.role === 'owner'} />}
            {activeTab === 'sales' && <HwSales bunkId={bunkId} products={products} customers={customers} sales={sales} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'customers' && <HwCustomers bunkId={bunkId} customers={customers} payments={payments} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'purchases' && <HwPurchases bunkId={bunkId} purchases={purchases} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'expenses' && <HwExpenses bunkId={bunkId} expenses={expenses} onRefresh={fetchAll} showToast={showToast} />}
            {activeTab === 'reports' && <HwReports bunkId={bunkId} sales={sales} expenses={expenses} payments={payments} customers={customers} />}
            {activeTab === 'intelligence' && <IntelligenceTab bunkId={bunkId} />}
            {activeTab === 'settings' && <SettingsTab bunkId={bunkId} user={user} onLogout={onLogout} />}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
function HwDashboard({ todaySalesTotal, todayExpenses, todayCollections, lowStock, recentSales, totalProducts, totalCreditOutstanding, pendingCheques, customers, products }: {
  todaySalesTotal: number; todayExpenses: number; todayCollections: number; lowStock: Product[]; recentSales: Sale[];
  totalProducts: number; totalCreditOutstanding: number; pendingCheques: number; customers: Customer[]; products: Product[];
}) {
  const overdueCustomers = customers.filter(c => {
    if (!c.outstanding_amount) return false;
    if (!c.last_payment_date) return true;
    const days = Math.floor((Date.now() - new Date(c.last_payment_date).getTime()) / 86400000);
    return days > 30;
  });
  const overdueCount = overdueCustomers.length;
  const overdueAmount = overdueCustomers.reduce((a, c) => a + (c.outstanding_amount || 0), 0);

  const inventoryValue = products.reduce((a, p) => a + Number(p.current_stock || 0) * Number(p.purchase_price || 0), 0);

  const kpis = [
    { label: "Today's Sales", value: inr(todaySalesTotal), icon: <TrendingUp size={20} />, color: 'bg-green-50 text-green-700 border-green-200' },
    { label: "Collections Today", value: inr(todayCollections), icon: <CreditCard size={20} />, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: "Today's Expenses", value: inr(todayExpenses), icon: <TrendingDown size={20} />, color: 'bg-red-50 text-red-700 border-red-200' },
    { label: 'Credit Outstanding', value: inr(totalCreditOutstanding), icon: <Wallet size={20} />, color: 'bg-orange-50 text-orange-700 border-orange-200' },
    { label: 'Low Stock Items', value: String(lowStock.length), icon: <AlertTriangle size={20} />, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { label: 'Overdue Parties', value: String(overdueCount), icon: <Clock size={20} />, color: overdueCount > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-500 border-gray-200' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.color}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium opacity-80 leading-tight">{k.label}</span>{k.icon}
            </div>
            <p className="text-xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
        <div className="rounded-xl border p-4 bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-3">
          <Package size={20} className="shrink-0" />
          <div>
            <p className="text-xs font-medium opacity-80">Inventory Value</p>
            <p className="text-xl font-bold">{inr(inventoryValue)}</p>
            <p className="text-xs opacity-70">at purchase cost · {totalProducts} products</p>
          </div>
        </div>
      </div>
      {overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {overdueCount} customer{overdueCount > 1 ? 's' : ''} overdue 30+ days — {inr(overdueAmount)} pending. Contact them today.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-yellow-500" /> Low Stock Alert</h2>
          {lowStock.length === 0 ? <p className="text-gray-400 text-sm">All products well-stocked.</p> : (
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
          <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><ShoppingCart size={16} className="text-blue-600" /> Recent Sales</h2>
          {recentSales.length === 0 ? <p className="text-gray-400 text-sm">No sales yet.</p> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentSales.map(s => (
                <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <div><p className="text-sm font-medium text-gray-800">{s.customer_name || 'Walk-in'}</p><p className="text-xs text-gray-400">{fmtDate(s.sale_date)} · {s.payment_mode}</p></div>
                  <span className={`text-sm font-semibold ${s.payment_mode === 'credit' ? 'text-orange-600' : 'text-green-600'}`}>{inr(s.total_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><CheckCircle2 size={16} className="text-green-600" /> Daily Checklist</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { done: todaySalesTotal > 0, text: "Record today's sales" },
            { done: todayCollections > 0, text: "Record today's collections" },
            { done: lowStock.length === 0, text: `Reorder low stock items${lowStock.length > 0 ? ` (${lowStock.length})` : ''}` },
            { done: overdueCount === 0, text: `Follow up overdue parties${overdueCount > 0 ? ` (${overdueCount})` : ''}` },
            { done: pendingCheques === 0, text: `${pendingCheques > 0 ? `${pendingCheques} pending cheques — check deposit` : 'No pending cheques'}` },
            { done: todayExpenses > 0, text: "Log today's expenses" },
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
interface ProdForm {
  name: string; brand: string; category: string; unit: string;
  mrp: number; selling_price: number; purchase_price: number;
  current_stock: number; reorder_level: number;
}
const defaultPF = (): ProdForm => ({ name: '', brand: '', category: CATEGORIES[0], unit: UNITS[0], mrp: 0, selling_price: 0, purchase_price: 0, current_stock: 0, reorder_level: 5 });

function HwInventory({ bunkId, products, onRefresh, showToast, showConfirm, isOwner }: { bunkId: string; products: Product[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; showConfirm: (msg: string, onYes: () => void) => void; isOwner: boolean }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProdForm>(defaultPF());
  const [saving, setSaving] = useState(false);
  const [adjustProd, setAdjustProd] = useState<Product | null>(null);
  const [adjQty, setAdjQty] = useState('');
  const [adjType, setAdjType] = useState<'add' | 'remove'>('add');
  const [adjNote, setAdjNote] = useState('');
  const [adjSaving, setAdjSaving] = useState(false);

  const filtered = products.filter(p => {
    const s = p.name.toLowerCase().includes(search.toLowerCase()) || p.brand?.toLowerCase().includes(search.toLowerCase());
    return s && (catFilter === 'All' || p.category === catFilter);
  });

  function openAdd() { setEditing(null); setForm(defaultPF()); setShowModal(true); }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, brand: p.brand || '', category: p.category, unit: p.unit, mrp: p.mrp || 0, selling_price: p.selling_price, purchase_price: p.purchase_price || 0, current_stock: p.current_stock, reorder_level: p.reorder_level || 5 });
    setShowModal(true);
  }
  function openAdjust(p: Product) { setAdjustProd(p); setAdjQty(''); setAdjType('add'); setAdjNote(''); }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Product name required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId, is_active: true };
    const { error } = editing
      ? await supabase.from('hw_products').update(payload).eq('id', editing.id).eq('bunk_id', bunkId)
      : await supabase.from('hw_products').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editing ? 'Product updated' : 'Product added');
    setShowModal(false); onRefresh();
  }

  async function handleDelete(p: Product) {
    // BUG-FIX: use React modal instead of browser confirm() — confirm() is blocked on mobile PWA/fullscreen
    showConfirm(`Delete "${p.name}" from inventory?`, async () => {
      const { error } = await supabase.from('hw_products').update({ is_active: false }).eq('id', p.id).eq('bunk_id', bunkId);
      if (error) { showToast(error.message, 'error'); return; }
      showToast('Product removed'); onRefresh();
    });
  }

  async function handleAdjust() {
    if (!adjustProd) return;
    const qty = parseFloat(adjQty);
    if (!(qty > 0)) { showToast('Enter a valid quantity', 'error'); return; }
    setAdjSaving(true);
    const delta = adjType === 'add' ? qty : -qty;
    // Fresh DB read to avoid stale state race condition
    const { data: fresh, error: fetchErr } = await supabase
      .from('hw_products').select('current_stock').eq('id', adjustProd.id).eq('bunk_id', bunkId).single();
    if (fetchErr || !fresh) { showToast('Could not verify current stock', 'error'); setAdjSaving(false); return; }
    const newStock = Math.max(0, Number(fresh.current_stock) + delta);
    const { error } = await supabase.from('hw_products').update({ current_stock: newStock }).eq('id', adjustProd.id).eq('bunk_id', bunkId);
    setAdjSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    if (adjNote.trim()) {
      await supabase.from('hw_stock_adjustments').insert({
        bunk_id: bunkId, product_id: adjustProd.id, product_name: adjustProd.name,
        adj_type: adjType, quantity: qty, notes: adjNote.trim(), adj_date: getTodayIST(),
      });
    }
    showToast(`${adjustProd.name}: stock → ${newStock} ${adjustProd.unit}`);
    setAdjustProd(null); onRefresh();
  }

  const setF = (k: keyof ProdForm, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Buy / Sell</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">No products found.</td></tr>}
              {filtered.map(p => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-400">{p.brand} · {p.unit}</p></td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{p.category}</td>
                  <td className="px-4 py-3 text-right text-xs"><span className="text-gray-500">{inr(p.purchase_price)}</span> / <span className="font-medium text-gray-800">{inr(p.selling_price)}</span></td>
                  <td className="px-4 py-3 text-right"><span className={`font-semibold ${p.current_stock <= p.reorder_level ? 'text-red-600' : 'text-gray-800'}`}>{p.current_stock}</span></td>
                  <td className="px-4 py-3 text-center">{p.current_stock <= p.reorder_level ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Low</span> : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">OK</span>}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openAdjust(p)} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium hover:bg-blue-100" title="Adjust Stock"><RefreshCw size={12} /></button>
                      <button onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800 p-1"><Edit2 size={14} /></button>
                      {isOwner && <button onClick={() => handleDelete(p)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={14} /></button>}
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
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">{editing ? 'Edit Product' : 'Add Product'}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">Product Name *</label><input value={form.name} onChange={e => setF('name', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Brand</label><input value={form.brand} onChange={e => setF('brand', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Category</label><select value={form.category} onChange={e => setF('category', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Unit</label><select value={form.unit} onChange={e => setF('unit', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">{UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">MRP (₹)</label><input type="number" min="0" value={form.mrp} onChange={e => setF('mrp', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Purchase Price (₹)</label><input type="number" min="0" value={form.purchase_price} onChange={e => setF('purchase_price', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Selling Price (₹)</label><input type="number" min="0" value={form.selling_price} onChange={e => setF('selling_price', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Current Stock</label><input type="number" min="0" value={form.current_stock} onChange={e => setF('current_stock', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Reorder Level</label><input type="number" min="0" value={form.reorder_level} onChange={e => setF('reorder_level', parseFloat(e.target.value) || 0)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {adjustProd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">Adjust Stock</h2><button onClick={() => setAdjustProd(null)}><X size={20} /></button></div>
            <div className="p-5 space-y-3">
              <p className="text-sm font-medium text-gray-800">{adjustProd.name}</p>
              <p className="text-sm text-gray-500">Current: <span className="font-semibold text-gray-800">{adjustProd.current_stock} {adjustProd.unit}</span></p>
              <div className="flex gap-2">
                <button onClick={() => setAdjType('add')} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${adjType === 'add' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 text-gray-700'}`}>+ Add Stock</button>
                <button onClick={() => setAdjType('remove')} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${adjType === 'remove' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-700'}`}>- Remove Stock</button>
              </div>
              <div><label className="text-xs text-gray-500 mb-1 block">Quantity ({adjustProd.unit}) *</label><input type="number" value={adjQty} onChange={e => setAdjQty(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Reason (optional)</label><input value={adjNote} onChange={e => setAdjNote(e.target.value)} placeholder="e.g. delivery from supplier, damaged goods…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              {adjQty && parseFloat(adjQty) > 0 && (
                <p className="text-sm text-gray-600">New stock: <span className="font-semibold">{Math.max(0, Number(adjustProd.current_stock) + (adjType === 'add' ? parseFloat(adjQty) : -parseFloat(adjQty)))} {adjustProd.unit}</span></p>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setAdjustProd(null)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdjust} disabled={adjSaving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {adjSaving && <Loader2 size={14} className="animate-spin" />}{adjSaving ? 'Saving…' : 'Update Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sales / POS ───────────────────────────────────────────────────────────────
function HwSales({ bunkId, products, customers, sales, onRefresh, showToast }: {
  bunkId: string; products: Product[]; customers: Customer[]; sales: Sale[];
  onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [view, setView] = useState<'pos' | 'history'>('pos');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('Walk-in');
  const [customerId, setCustomerId] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [saleDate, setSaleDate] = useState(getTodayIST());
  const [notes, setNotes] = useState('');
  const [siteDelivery, setSiteDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [labourCharges, setLabourCharges] = useState(0);
  const [transportCharges, setTransportCharges] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [histSearch, setHistSearch] = useState('');
  const [histMode, setHistMode] = useState('all');

  const filteredProducts = useMemo(() => products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const filteredSales = useMemo(() => sales.filter(s => {
    const q = histSearch.toLowerCase();
    const matchQ = !q || s.customer_name?.toLowerCase().includes(q) || s.notes?.toLowerCase().includes(q);
    const matchMode = histMode === 'all' || s.payment_mode === histMode;
    return matchQ && matchMode;
  }), [sales, histSearch, histMode]);

  function addToCart(p: Product) {
    setCart(c => {
      const ex = c.find(i => i.product.id === p.id);
      if (ex) return c.map(i => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...c, { product: p, quantity: 1, price: p.selling_price }];
    });
  }
  function updateQty(id: string, qty: number) {
    if (qty <= 0) { setCart(c => c.filter(i => i.product.id !== id)); return; }
    const prod = products.find(p => p.id === id);
    if (prod && qty > prod.current_stock) { showToast(`Only ${prod.current_stock} ${prod.unit} in stock`, 'error'); return; }
    setCart(c => c.map(i => i.product.id === id ? { ...i, quantity: qty } : i));
  }
  function updatePrice(id: string, price: number) {
    if (price < 0) return;
    setCart(c => c.map(i => i.product.id === id ? { ...i, price } : i));
  }

  const subtotal = cart.reduce((a, i) => a + i.price * i.quantity, 0);
  const total = subtotal + labourCharges + transportCharges - discount;

  async function handleSell() {
    if (cart.length === 0) { showToast('Cart is empty', 'error'); return; }
    if (!(total > 0)) { showToast('Total must be greater than 0', 'error'); return; }
    if (paymentMode === 'credit' && customerId) {
      const cust = customers.find(c => c.id === customerId);
      if (cust && cust.credit_limit > 0 && (Number(cust.outstanding_amount) + total) > cust.credit_limit) {
        showToast(`Credit limit exceeded (limit: ${inr(cust.credit_limit)}, current due: ${inr(cust.outstanding_amount)})`, 'error');
        return;
      }
    }
    setSaving(true);
    const name = customerId ? customers.find(c => c.id === customerId)?.name || customerName : customerName;
    const { data: sale, error: sErr } = await supabase.from('hw_sales').insert({
      bunk_id: bunkId, customer_id: customerId || null, customer_name: name,
      sale_date: saleDate, total_amount: total, payment_mode: paymentMode,
      payment_status: paymentMode === 'credit' ? 'credit' : 'paid', notes,
      site_delivery: siteDelivery, delivery_address: deliveryAddress || null,
      labour_charges: labourCharges, transport_charges: transportCharges, discount_amount: discount,
    }).select().single();
    if (sErr || !sale) { showToast(sErr?.message || 'Sale failed', 'error'); setSaving(false); return; }

    const { error: itemsErr } = await supabase.from('hw_sale_items').insert(cart.map(i => ({
      sale_id: sale.id, bunk_id: bunkId, product_id: i.product.id,
      product_name: i.product.name, quantity: i.quantity, unit_price: i.price,
      total_price: i.price * i.quantity,
    })));
    if (itemsErr) {
      showToast('Sale saved but item details failed to record — check connectivity.', 'error');
      setSaving(false); onRefresh(); return;
    }

    // Batch-read fresh stock to avoid stale-state race condition
    const { data: freshStocks } = await supabase.from('hw_products')
      .select('id, current_stock').in('id', cart.map(i => i.product.id)).eq('bunk_id', bunkId);
    const stockMap: Record<string, number> = {};
    freshStocks?.forEach(s => { stockMap[s.id] = Number(s.current_stock); });
    for (const i of cart) {
      const freshStock = stockMap[i.product.id] ?? i.product.current_stock;
      await supabase.from('hw_products').update({ current_stock: Math.max(0, freshStock - i.quantity) }).eq('id', i.product.id).eq('bunk_id', bunkId);
    }

    if (paymentMode === 'credit' && customerId) {
      // Fresh DB read to avoid stale-state race condition on concurrent credit sales
      const { data: freshCust } = await supabase.from('hw_customers').select('outstanding_amount').eq('id', customerId).eq('bunk_id', bunkId).maybeSingle();
      const baseOutstanding = freshCust ? Number(freshCust.outstanding_amount) : (Number(customers.find(c => c.id === customerId)?.outstanding_amount) || 0);
      const { error: custErr } = await supabase.from('hw_customers').update({ outstanding_amount: baseOutstanding + total }).eq('id', customerId).eq('bunk_id', bunkId);
      if (custErr) showToast('Sale recorded but credit outstanding not updated — refresh the page.', 'error');
    }

    showToast('Sale recorded!');
    setCart([]); setCustomerName('Walk-in'); setCustomerId(''); setNotes('');
    setSiteDelivery(false); setDeliveryAddress(''); setLabourCharges(0); setTransportCharges(0); setDiscount(0);
    setPaymentMode('cash'); setSaleDate(getTodayIST());
    setSaving(false); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-200">
        {(['pos', 'history'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === v ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {v === 'pos' ? '🛒 New Sale (POS)' : '📋 Sales History'}
          </button>
        ))}
      </div>

      {view === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products to add…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase sticky top-0">
                    <tr><th className="px-4 py-2 text-left">Product</th><th className="px-4 py-2 text-right">Price</th><th className="px-4 py-2 text-right">Stock</th><th className="px-4 py-2"></th></tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(p => (
                      <tr key={p.id} className="border-t border-gray-100 hover:bg-blue-50">
                        <td className="px-4 py-2"><p className="font-medium text-gray-800">{p.name}</p><p className="text-xs text-gray-400">{p.category}</p></td>
                        <td className="px-4 py-2 text-right">{inr(p.selling_price)}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{p.current_stock} {p.unit}</td>
                        <td className="px-4 py-2 text-right"><button onClick={() => addToCart(p)} disabled={p.current_stock <= 0} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40"><Plus size={12} className="inline" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 h-fit">
            <h2 className="font-semibold text-gray-800">Cart</h2>
            {cart.length === 0 ? <p className="text-gray-400 text-sm">No items added.</p> : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {cart.map(i => (
                  <div key={i.product.id} className="py-1.5 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-800 flex-1 truncate">{i.product.name}</p>
                      <button onClick={() => setCart(c => c.filter(x => x.product.id !== i.product.id))} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(i.product.id, i.quantity - 1)} className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100">-</button>
                        <span className="w-8 text-center text-sm font-medium">{i.quantity}</span>
                        <button onClick={() => updateQty(i.product.id, i.quantity + 1)} className="w-6 h-6 rounded border flex items-center justify-center text-gray-600 hover:bg-gray-100">+</button>
                      </div>
                      <input type="number" value={i.price} onChange={e => updatePrice(i.product.id, parseFloat(e.target.value) || 0)} className="w-20 border border-gray-200 rounded px-2 py-0.5 text-xs text-right" title="Unit price" />
                      <span className="text-sm font-semibold text-gray-800 ml-auto">{inr(i.price * i.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20 shrink-0">Labour ₹</span>
                <input type="number" value={labourCharges || ''} onChange={e => setLabourCharges(parseFloat(e.target.value) || 0)} placeholder="0" className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20 shrink-0">Transport ₹</span>
                <input type="number" value={transportCharges || ''} onChange={e => setTransportCharges(parseFloat(e.target.value) || 0)} placeholder="0" className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20 shrink-0">Discount ₹</span>
                <input type="number" value={discount || ''} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} placeholder="0" className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
              </div>
              <div className="flex justify-between font-bold text-base"><span>Total</span><span>{inr(total)}</span></div>

              <div><label className="text-xs text-gray-500 mb-1 block">Customer</label>
                <select value={customerId} onChange={e => { setCustomerId(e.target.value); if (!e.target.value) setCustomerName('Walk-in'); }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Walk-in Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.outstanding_amount > 0 ? ` (₹${Math.round(c.outstanding_amount / 1000)}k due)` : ''}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {PAYMENT_MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={siteDelivery} onChange={e => setSiteDelivery(e.target.checked)} className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700">Site Delivery</span>
              </label>
              {siteDelivery && (
                <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="Delivery address / site name…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              )}
              <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <button onClick={handleSell} disabled={saving || cart.length === 0} className="mt-1 w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}{saving ? 'Processing…' : 'Complete Sale'}
            </button>
          </div>
        </div>
      )}

      {view === 'history' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={histSearch} onChange={e => setHistSearch(e.target.value)} placeholder="Search by customer or note…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <select value={histMode} onChange={e => setHistMode(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="all">All Modes</option>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Customer</th><th className="px-4 py-3 text-left">Mode</th><th className="px-4 py-3 text-left">Notes</th><th className="px-4 py-3 text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {filteredSales.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">No sales found.</td></tr>}
                  {filteredSales.slice(0, 100).map(s => (
                    <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{fmtDate(s.sale_date)}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{s.customer_name || 'Walk-in'}{s.site_delivery && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Delivery</span>}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.payment_mode === 'credit' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{s.payment_mode}</span></td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-32 truncate">{s.notes || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{inr(s.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {filteredSales.length > 100 && <p className="text-center text-sm text-gray-400">Showing 100 of {filteredSales.length} records</p>}
        </div>
      )}
    </div>
  );
}

// ─── Customers ─────────────────────────────────────────────────────────────────
interface CustForm { name: string; phone: string; address: string; credit_limit: number; }
const defaultCF = (): CustForm => ({ name: '', phone: '', address: '', credit_limit: 0 });

function agingBadge(lastDate: string | null | undefined) {
  const d = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : 999;
  if (d < 8) return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{d}d</span>;
  if (d < 31) return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{d}d</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">{d === 999 ? 'new' : d + 'd'}</span>;
}

const CUST_PAGE_SIZE = 10;

function HwCustomers({ bunkId, customers, payments, onRefresh, showToast }: {
  bunkId: string; customers: Customer[]; payments: Payment[];
  onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'outstanding' | 'overdue'>('all');
  const [custPage, setCustPage] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustForm>(defaultCF());
  const [saving, setSaving] = useState(false);
  const [payModal, setPayModal] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeBank, setChequeBank] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [payingSaving, setPayingSaving] = useState(false);
  const [showCheques, setShowCheques] = useState(false);
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [ledgerData, setLedgerData] = useState<{ sales: Sale[]; payments: Payment[] }>({ sales: [], payments: [] });
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const pendingCheques = payments.filter(p => p.payment_mode === 'cheque' && p.cheque_status === 'received');

  function daysSincePayment(c: Customer) {
    if (!c.last_payment_date) return c.outstanding_amount > 0 ? 9999 : 0;
    return Math.floor((Date.now() - new Date(c.last_payment_date).getTime()) / 86400000);
  }

  const filtered = useMemo(() => customers.filter(c => {
    const q = search.toLowerCase();
    const matchQ = !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q);
    const days = daysSincePayment(c);
    if (filter === 'outstanding') return matchQ && c.outstanding_amount > 0;
    if (filter === 'overdue') return matchQ && c.outstanding_amount > 0 && days > 30;
    return matchQ;
  }).sort((a, b) => (b.outstanding_amount || 0) - (a.outstanding_amount || 0)), [customers, search, filter]);

  function openAdd() { setEditing(null); setForm(defaultCF()); setShowModal(true); }
  function openEdit(c: Customer) { setEditing(c); setForm({ name: c.name, phone: c.phone || '', address: c.address || '', credit_limit: c.credit_limit || 0 }); setShowModal(true); }
  function openPay(c: Customer) { setPayModal(c); setPayAmount(''); setPayMode('cash'); setChequeNo(''); setChequeBank(''); setChequeDate(''); }

  async function openLedger(c: Customer) {
    setLedgerCustomer(c);
    setLedgerData({ sales: [], payments: [] });
    setLedgerLoading(true);
    const [salesRes, paymentsRes] = await Promise.all([
      supabase.from('hw_sales').select('*').eq('bunk_id', bunkId).eq('customer_id', c.id).order('sale_date', { ascending: false }).limit(20),
      supabase.from('hw_payments').select('*').eq('bunk_id', bunkId).eq('customer_id', c.id).order('payment_date', { ascending: false }).limit(20),
    ]);
    setLedgerData({ sales: (salesRes.data as Sale[]) || [], payments: (paymentsRes.data as Payment[]) || [] });
    setLedgerLoading(false);
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Customer name required', 'error'); return; }
    setSaving(true);
    const payload = { ...form, bunk_id: bunkId, is_active: true };
    const { error } = editing
      ? await supabase.from('hw_customers').update(payload).eq('id', editing.id).eq('bunk_id', bunkId)
      : await supabase.from('hw_customers').insert(payload);
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast(editing ? 'Customer updated' : 'Customer added');
    setShowModal(false); onRefresh();
  }

  async function handleCollectPayment() {
    if (!payModal) return;
    const amt = parseFloat(payAmount);
    if (!(amt > 0)) { showToast('Enter a valid amount', 'error'); return; }
    if (amt > Number(payModal.outstanding_amount) + 0.01) {
      showToast(`Amount (${inr(amt)}) exceeds outstanding (${inr(payModal.outstanding_amount)})`, 'error');
      return;
    }
    setPayingSaving(true);
    const today = getTodayIST();

    const payRecord: Record<string, unknown> = {
      bunk_id: bunkId, customer_id: payModal.id, customer_name: payModal.name,
      amount: amt, payment_mode: payMode, payment_date: today,
    };
    if (payMode === 'cheque') {
      payRecord.cheque_number = chequeNo || null;
      payRecord.cheque_bank = chequeBank || null;
      payRecord.cheque_date = chequeDate || null;
      payRecord.cheque_status = 'received';
    }

    const { error: pErr } = await supabase.from('hw_payments').insert(payRecord);
    if (pErr) { showToast(pErr.message, 'error'); setPayingSaving(false); return; }

    // Fresh read to avoid stale outstanding from modal state
    const { data: freshPayCust } = await supabase.from('hw_customers').select('outstanding_amount').eq('id', payModal.id).eq('bunk_id', bunkId).maybeSingle();
    const baseOutstanding = freshPayCust ? Number(freshPayCust.outstanding_amount) : Number(payModal.outstanding_amount);
    const newOutstanding = Math.max(0, baseOutstanding - amt);
    await supabase.from('hw_customers').update({ outstanding_amount: newOutstanding, last_payment_date: today }).eq('id', payModal.id).eq('bunk_id', bunkId);

    setPayingSaving(false);
    showToast(`${payMode === 'cheque' ? '📋 Cheque' : '✅ Payment'} of ${inr(amt)} recorded from ${payModal.name}`);
    setPayModal(null); onRefresh();
  }

  async function updateChequeStatus(payId: string, status: 'cleared' | 'bounced') {
    const { error } = await supabase.from('hw_payments').update({ cheque_status: status }).eq('id', payId).eq('bunk_id', bunkId);
    if (error) { showToast(error.message, 'error'); return; }
    if (status === 'bounced') {
      const pmt = pendingCheques.find(p => p.id === payId);
      if (pmt?.customer_id) {
        const cust = customers.find(c => c.id === pmt.customer_id);
        if (cust) {
          const { data: freshBounceCust } = await supabase.from('hw_customers').select('outstanding_amount').eq('id', cust.id).eq('bunk_id', bunkId).maybeSingle();
          const baseAmt = freshBounceCust ? Number(freshBounceCust.outstanding_amount) : Number(cust.outstanding_amount);
          const { error: custErr } = await supabase.from('hw_customers')
            .update({ outstanding_amount: baseAmt + pmt.amount })
            .eq('id', cust.id).eq('bunk_id', bunkId);
          if (custErr) {
            showToast(`Cheque marked bounced but outstanding restore failed: ${custErr.message}`, 'error');
            return;
          }
        }
      }
    }
    showToast(`Cheque marked as ${status}`); onRefresh();
  }

  const totalOutstanding = customers.filter(c => c.outstanding_amount > 0).reduce((a, c) => a + c.outstanding_amount, 0);
  const overdueCount = customers.filter(c => c.outstanding_amount > 0 && daysSincePayment(c) > 30).length;

  return (
    <div className="space-y-4">
      {/* Cheque Register */}
      {pendingCheques.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <button onClick={() => setShowCheques(v => !v)} className="flex items-center justify-between w-full">
            <h3 className="font-semibold text-yellow-800 flex items-center gap-2">
              <CreditCard size={16} /> {pendingCheques.length} Pending Cheque{pendingCheques.length > 1 ? 's' : ''} — Total: {inr(pendingCheques.reduce((a, p) => a + p.amount, 0))}
            </h3>
            {showCheques ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showCheques && (
            <div className="mt-3 space-y-2">
              {pendingCheques.map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-yellow-100">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{p.customer_name}</p>
                    <p className="text-xs text-gray-500">
                      {inr(p.amount)} · {p.cheque_bank || 'Unknown bank'}{p.cheque_number ? ` · #${p.cheque_number}` : ''}
                      {p.cheque_date ? ` · Due: ${fmtDate(p.cheque_date)}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => updateChequeStatus(p.id, 'cleared')} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium hover:bg-green-200">Cleared</button>
                    <button onClick={() => updateChequeStatus(p.id, 'bounced')} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-medium hover:bg-red-200">Bounced</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex gap-1">
            {(['all', 'outstanding', 'overdue'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 text-xs rounded-lg font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f === 'all' ? 'All' : f === 'outstanding' ? `Due (${customers.filter(c => c.outstanding_amount > 0).length})` : `Overdue 30d (${overdueCount})`}
              </button>
            ))}
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {totalOutstanding > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-orange-700 font-medium">Total Outstanding</span>
          <span className="text-base font-bold text-orange-700">{inr(totalOutstanding)}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Phone</th><th className="px-4 py-3 text-right">Limit</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-center">Last Pay</th><th className="px-4 py-3 text-center">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">No customers found.</td></tr>}
              {filtered.slice(custPage * CUST_PAGE_SIZE, (custPage + 1) * CUST_PAGE_SIZE).map(c => {
                const days = daysSincePayment(c);
                const isOverdue = c.outstanding_amount > 0 && days > 30;
                return (
                  <tr key={c.id} className={`border-t border-gray-100 hover:bg-gray-50 ${isOverdue ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3"><p className="font-medium text-gray-800">{c.name}</p><p className="text-xs text-gray-400">{c.address || ''}</p></td>
                    <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">{inr(c.credit_limit || 0)}</td>
                    <td className="px-4 py-3 text-right"><span className={`font-semibold ${c.outstanding_amount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{inr(c.outstanding_amount)}</span></td>
                    <td className="px-4 py-3 text-center">{agingBadge(c.last_payment_date)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {c.outstanding_amount > 0 && (
                          <button onClick={() => openPay(c)} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium hover:bg-orange-200">Collect</button>
                        )}
                        <button onClick={() => openLedger(c)} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium hover:bg-blue-100 flex items-center gap-1"><FileText size={11} /> Ledger</button>
                        <button onClick={() => openEdit(c)} className="text-blue-600 hover:text-blue-800"><Edit2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > CUST_PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
            <span>{custPage * CUST_PAGE_SIZE + 1}–{Math.min((custPage + 1) * CUST_PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div className="flex gap-2">
              <button disabled={custPage === 0} onClick={() => setCustPage(p => p - 1)} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Prev</button>
              <button disabled={(custPage + 1) * CUST_PAGE_SIZE >= filtered.length} onClick={() => setCustPage(p => p + 1)} className="px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">{editing ? 'Edit Customer' : 'Add Customer'}</h2><button onClick={() => setShowModal(false)}><X size={20} /></button></div>
            <div className="p-5 space-y-3">
              <div><label className="text-xs text-gray-500 mb-1 block">Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Address / Site</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Credit Limit (₹)</label><input type="number" value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
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
              <div><label className="text-xs text-gray-500 mb-1 block">Amount Received (₹) *</label><input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label>
                <select value={payMode} onChange={e => setPayMode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {['cash', 'upi', 'bank_transfer', 'card', 'cheque'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              {payMode === 'cheque' && (
                <>
                  <div><label className="text-xs text-gray-500 mb-1 block">Cheque Number</label><input value={chequeNo} onChange={e => setChequeNo(e.target.value)} placeholder="001234" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Bank Name</label><input value={chequeBank} onChange={e => setChequeBank(e.target.value)} placeholder="SBI / HDFC / etc." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Cheque Date</label><input type="date" value={chequeDate} onChange={e => setChequeDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                  <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2">⚠️ Cheque will be marked as "Received" until you confirm it's cleared or bounced.</p>
                </>
              )}
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

      {ledgerCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b shrink-0">
              <div>
                <h2 className="text-lg font-semibold">{ledgerCustomer.name} — Ledger</h2>
                {ledgerCustomer.phone && <p className="text-xs text-gray-400">{ledgerCustomer.phone}</p>}
              </div>
              <button onClick={() => setLedgerCustomer(null)}><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {ledgerLoading ? (
                <div className="flex justify-center items-center h-32"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
              ) : (() => {
                const saleEntries = ledgerData.sales.map(s => ({
                  date: s.sale_date, type: 'Sale' as const,
                  description: `Sale · ${s.payment_mode}${s.notes ? ` · ${s.notes}` : ''}`,
                  debit: s.total_amount, credit: 0, id: s.id,
                }));
                const paymentEntries = ledgerData.payments.map(p => ({
                  date: p.payment_date, type: 'Payment' as const,
                  description: `Payment · ${p.payment_mode}${p.cheque_number ? ` #${p.cheque_number}` : ''}`,
                  debit: 0, credit: p.amount, id: p.id,
                }));
                const combined = [...saleEntries, ...paymentEntries].sort((a, b) => b.date.localeCompare(a.date));
                const totalSold = saleEntries.reduce((a, e) => a + e.debit, 0);
                const totalPaid = paymentEntries.reduce((a, e) => a + e.credit, 0);
                return (
                  <div className="space-y-3">
                    {combined.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No transactions found.</p>}
                    {combined.map(entry => (
                      <div key={entry.id} className={`flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0`}>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entry.type === 'Sale' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                            {entry.type}
                          </span>
                          <div>
                            <p className="text-sm text-gray-700">{entry.description}</p>
                            <p className="text-xs text-gray-400">{fmtDate(entry.date)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {entry.debit > 0 && <p className="text-sm font-semibold text-orange-600">{inr(entry.debit)}</p>}
                          {entry.credit > 0 && <p className="text-sm font-semibold text-green-600">−{inr(entry.credit)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            {!ledgerLoading && (
              <div className="border-t p-4 bg-gray-50 rounded-b-2xl grid grid-cols-3 gap-4 shrink-0">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Total Sold</p>
                  <p className="font-bold text-orange-600">{inr(ledgerData.sales.reduce((a, s) => a + s.total_amount, 0))}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Total Paid</p>
                  <p className="font-bold text-green-600">{inr(ledgerData.payments.reduce((a, p) => a + p.amount, 0))}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Balance</p>
                  <p className={`font-bold ${(ledgerData.sales.reduce((a, s) => a + s.total_amount, 0) - ledgerData.payments.reduce((a, p) => a + p.amount, 0)) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {inr(ledgerData.sales.reduce((a, s) => a + s.total_amount, 0) - ledgerData.payments.reduce((a, p) => a + p.amount, 0))}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Purchases ─────────────────────────────────────────────────────────────────
interface PurchForm { supplier_name: string; invoice_number: string; purchase_date: string; total_amount: number; notes: string; }
const defaultPurchF = (): PurchForm => ({ supplier_name: '', invoice_number: '', purchase_date: getTodayIST(), total_amount: 0, notes: '' });

function HwPurchases({ bunkId, purchases, onRefresh, showToast }: { bunkId: string; purchases: Purchase[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<PurchForm>(defaultPurchF());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = purchases.filter(p => {
    const q = search.toLowerCase();
    return !q || p.supplier_name.toLowerCase().includes(q) || (p.invoice_number || '').toLowerCase().includes(q);
  });

  const monthTotal = purchases.filter(p => p.purchase_date >= getTodayIST().slice(0, 7) + '-01').reduce((a, p) => a + p.total_amount, 0);

  async function handleSave() {
    if (!form.supplier_name.trim() || !(form.total_amount > 0)) { showToast('Supplier name and amount required', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('hw_purchases').insert({ ...form, bunk_id: bunkId });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Purchase added'); setShowModal(false); setForm(defaultPurchF()); onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search supplier…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {monthTotal > 0 && <span className="text-sm text-gray-500">This month: <span className="font-semibold text-gray-700">{inr(monthTotal)}</span></span>}
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"><Plus size={16} /> Add Purchase</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Supplier</th><th className="px-4 py-3 text-left">Invoice</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-left">Notes</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">No purchases yet.</td></tr>}
              {filtered.map(p => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{fmtDate(p.purchase_date)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.supplier_name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.invoice_number || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{inr(p.total_amount)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.notes || '—'}</td>
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
              <div><label className="text-xs text-gray-500 mb-1 block">Supplier Name *</label><input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Invoice / Challan Number</label><input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Total Amount (₹) *</label><input type="number" value={form.total_amount || ''} onChange={e => setForm(f => ({ ...f, total_amount: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Notes (items received)</label><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. 200 bags OPC 53, 100kg TMT 12mm" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Expenses ──────────────────────────────────────────────────────────────────
interface ExpForm { category: string; description: string; amount: number; expense_date: string; payment_mode: string; notes: string; }
const defaultEF = (): ExpForm => ({ category: EXPENSE_CATEGORIES[0], description: '', amount: 0, expense_date: getTodayIST(), payment_mode: 'cash', notes: '' });

function HwExpenses({ bunkId, expenses, onRefresh, showToast }: { bunkId: string; expenses: Expense[]; onRefresh: () => void; showToast: (m: string, t?: 'success' | 'error') => void; }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ExpForm>(defaultEF());
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.description.trim() || !(form.amount > 0)) { showToast('Description and amount required', 'error'); return; }
    setSaving(true);
    const { error } = await supabase.from('hw_expenses').insert({ ...form, bunk_id: bunkId });
    setSaving(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Expense added'); setShowModal(false); setForm(defaultEF()); onRefresh();
  }

  const monthTotal = expenses.filter(e => e.expense_date >= getTodayIST().slice(0, 7) + '-01').reduce((a, e) => a + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {monthTotal > 0 && <span className="text-sm text-gray-500">This month: <span className="font-semibold text-gray-700">{inr(monthTotal)}</span></span>}
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 ml-auto"><Plus size={16} /> Add Expense</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Description</th><th className="px-4 py-3 text-left">Payment</th><th className="px-4 py-3 text-right">Amount</th></tr>
            </thead>
            <tbody>
              {expenses.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">No expenses recorded.</td></tr>}
              {expenses.slice(0, 100).map(e => (
                <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{fmtDate(e.expense_date)}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{e.category}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{e.description}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{e.payment_mode}</td>
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
              <div><label className="text-xs text-gray-500 mb-1 block">Description *</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label><input type="number" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Date</label><input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Payment Mode</label><select value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">{['cash', 'upi', 'bank_transfer', 'card'].map(m => <option key={m}>{m}</option>)}</select></div>
              <div><label className="text-xs text-gray-500 mb-1 block">Notes</label><input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────────
function HwReports({ bunkId, sales, expenses, payments, customers }: {
  bunkId: string; sales: Sale[]; expenses: Expense[]; payments: Payment[]; customers: Customer[];
}) {
  const today = getTodayIST();
  const [reportMonth, setReportMonth] = useState(today.slice(0, 7));

  const mStart = reportMonth + '-01';
  const mEnd = new Date(new Date(mStart).getFullYear(), new Date(mStart).getMonth() + 1, 0).toISOString().split('T')[0];

  const mSales = sales.filter(s => s.sale_date >= mStart && s.sale_date <= mEnd);
  const mExp = expenses.filter(e => e.expense_date >= mStart && e.expense_date <= mEnd);
  const mPay = payments.filter(p => p.payment_date >= mStart && p.payment_date <= mEnd);

  const totalSales = mSales.reduce((a, s) => a + s.total_amount, 0);
  const cashSales = mSales.filter(s => s.payment_mode === 'cash').reduce((a, s) => a + s.total_amount, 0);
  const creditSales = mSales.filter(s => s.payment_mode === 'credit').reduce((a, s) => a + s.total_amount, 0);
  const totalExp = mExp.reduce((a, e) => a + e.amount, 0);
  const totalCollected = mPay.reduce((a, p) => a + p.amount, 0);
  const chequeCollected = mPay.filter(p => p.payment_mode === 'cheque').reduce((a, p) => a + p.amount, 0);

  const totalOutstanding = customers.filter(c => c.outstanding_amount > 0).reduce((a, c) => a + c.outstanding_amount, 0);
  const overdueCustomers = customers.filter(c => {
    if (!c.outstanding_amount) return false;
    const days = c.last_payment_date ? Math.floor((Date.now() - new Date(c.last_payment_date).getTime()) / 86400000) : 9999;
    return days > 30;
  });

  const expByCategory: Record<string, number> = {};
  mExp.forEach(e => { expByCategory[e.category] = (expByCategory[e.category] || 0) + e.amount; });

  function handleExportCSV() {
    const rows = [
      ['Type', 'Date', 'Amount', 'Mode', 'Customer/Category'],
      ...mSales.map(s => ['Sale', s.sale_date, s.total_amount, s.payment_mode, s.customer_name || '']),
      ...mExp.map(e => ['Expense', e.expense_date, e.amount, '', e.category]),
      ...mPay.map(p => ['Payment', p.payment_date, p.amount, p.payment_mode, p.customer_name || '']),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `hardware-report-${reportMonth}.csv`; a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="font-semibold text-gray-800 text-lg">Monthly Report</h2>
        <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <button onClick={handleExportCSV} className="ml-auto flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* P&L Summary */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="font-semibold text-gray-700 border-b pb-2">Profit & Loss — {new Date(mStart).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Total Sales</span><span className="font-semibold text-gray-800">{inr(totalSales)}</span></div>
            <div className="flex justify-between pl-4 text-xs"><span className="text-gray-500">↳ Cash Sales</span><span>{inr(cashSales)}</span></div>
            <div className="flex justify-between pl-4 text-xs"><span className="text-gray-500">↳ Credit Sales</span><span>{inr(creditSales)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Collections Received</span><span className="font-semibold text-blue-700">{inr(totalCollected)}</span></div>
            {chequeCollected > 0 && <div className="flex justify-between pl-4 text-xs"><span className="text-gray-500">↳ Via Cheque</span><span>{inr(chequeCollected)}</span></div>}
            <div className="border-t my-1" />
            <div className="flex justify-between"><span className="text-gray-600">Total Expenses</span><span className="font-semibold text-red-600">{inr(totalExp)}</span></div>
            <div className="border-t my-1" />
            <div className="flex justify-between text-base font-bold">
              <span>Net Profit</span>
              <span className={totalSales - totalExp >= 0 ? 'text-green-600' : 'text-red-600'}>{inr(totalSales - totalExp)}</span>
            </div>
          </div>
        </div>

        {/* Outstanding Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="font-semibold text-gray-700 border-b pb-2">Outstanding Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Total Outstanding</span><span className="font-bold text-orange-600">{inr(totalOutstanding)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Parties with dues</span><span className="font-semibold">{customers.filter(c => c.outstanding_amount > 0).length}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Overdue 30+ days</span><span className={`font-bold ${overdueCustomers.length > 0 ? 'text-red-600' : 'text-gray-500'}`}>{overdueCustomers.length}</span></div>
          </div>
          {overdueCustomers.length > 0 && (
            <div className="border-t pt-2 space-y-1 max-h-40 overflow-y-auto">
              {overdueCustomers.slice(0, 8).map(c => (
                <div key={c.id} className="flex justify-between text-xs">
                  <span className="text-gray-700 truncate mr-2">{c.name}</span>
                  <span className="font-semibold text-orange-600 shrink-0">{inr(c.outstanding_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expense Breakdown */}
      {Object.keys(expByCategory).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-700 mb-3 border-b pb-2">Expense Breakdown</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(expByCategory).sort(([, a], [, b]) => b - a).map(([cat, amt]) => (
              <div key={cat} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">{cat}</p>
                <p className="font-semibold text-gray-800">{inr(amt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
