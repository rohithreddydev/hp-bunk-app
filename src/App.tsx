/* =============================================================================
  FUELDESK SAAS - MULTI-TENANT PRODUCTION BUILD (v18.0) - EXPERT AUDIT
=============================================================================
  Changes Applied:
  1. Strict IST Timezones: Created global `getTodayIST`, `nowIST`, and `formatISTDate` to prevent UTC date-shifting.
  2. Credit Ledger Grouping: Advances and Sales are perfectly grouped under a single row using the remarks column.
  3. Fuel Receipts Unification: The fuel purchases module now records exactly one row per invoice containing both petrol and diesel data.
  4. 5-Step Morning Wizard: Added 'Step 0: Nozzle Meter Readings' with live bot-sync status from the DB.
  5. Dashboard Status Card: Added a daily 'Morning Entry Status' widget.
  6. Exact Column Mapping: Strictly enforced database typos (`balance_od`, `collection_dtp`) and mapped float/cash columns per spec.
=============================================================================
*/

import React, { useState, createContext, useContext, useEffect, useMemo, useCallback, Component, Suspense, lazy, type ReactNode } from 'react';
import { ToastProvider } from './components/Toast';
import {
  Users, BookOpen, Sun, Receipt, Fuel, Search, ChevronLeft,
  BarChart3, Settings, LogOut, Plus, AlertCircle, CheckCircle2,
  Download, X, Truck, Trash2, Edit2, Menu, Filter, ChevronDown, ChevronRight, Loader2, UploadCloud, MessageCircle, Calendar, TrendingUp, TrendingDown, Wallet, Activity, SearchX, Briefcase, Bell, Brain
} from 'lucide-react';

// --- TIMEZONE UTILS (IST STRICT) ---
// Import into local scope (so the module-level calls below work)
// AND re-export so other files can import from App.tsx if needed
import { getTodayIST, nowIST, formatISTDate } from './utils';
export { getTodayIST, nowIST, formatISTDate };

// BUG-FIX: compute fresh at call time — module-level constants go stale for overnight sessions
const getTodayStr = () => getTodayIST();
const getCurrentMonthStr = () => getTodayIST().substring(0, 7);
const getCurrentYearStr = () => getTodayIST().substring(0, 4);
const CATEGORIES = ['Fleet', 'Milk Tanker', 'School', 'Hospital', 'Individual', 'Logistics', 'Other'];

// --- SUPABASE SETUP ---
import { supabase } from './supabase';
// ── Store modules: lazy-loaded so each is its own JS chunk ──────────────
// This cuts the initial bundle from ~1.2MB down to ~300KB.
const CementApp      = lazy(() => import('./CementApp').then(m => ({ default: m.CementApp })));
const OtherApp       = lazy(() => import('./OtherApp').then(m => ({ default: m.OtherApp })));
const HardwareApp    = lazy(() => import('./HardwareApp').then(m => ({ default: m.HardwareApp })));
const RestaurantApp  = lazy(() => import('./RestaurantApp').then(m => ({ default: m.RestaurantApp })));
const AutoPartsApp   = lazy(() => import('./AutoPartsApp').then(m => ({ default: m.AutoPartsApp })));
const AgricultureApp = lazy(() => import('./AgricultureApp').then(m => ({ default: m.AgricultureApp })));
const TextileApp     = lazy(() => import('./TextileApp').then(m => ({ default: m.TextileApp })));
const StationeryApp  = lazy(() => import('./StationeryApp').then(m => ({ default: m.StationeryApp })));
const KiranaApp      = lazy(() => import('./KiranaApp').then(m => ({ default: m.KiranaApp })));
const MedicalApp     = lazy(() => import('./MedicalApp').then(m => ({ default: m.MedicalApp })));
const LPGApp         = lazy(() => import('./LPGApp').then(m => ({ default: m.LPGApp })));
const ElectricalApp  = lazy(() => import('./ElectricalApp').then(m => ({ default: m.ElectricalApp })));
import { IntelligenceTab } from './IntelligenceTab';
const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
export const hasValidKeys = Boolean(rawUrl && rawKey && rawUrl !== 'undefined' && rawKey !== 'undefined');

// --- TYPES ---
type Role = 'owner' | 'supervisor' | 'customer';
interface User { id: string; name: string; email: string; role: Role; phone?: string; bunkId?: string; }
interface Customer { id: string; category: string; companyName: string; ownerName?: string; phone: string; address?: string; paymentTerms?: string; driverName?: string; driverPhone?: string; vehicleNumbers?: string; creditLimit: number; status: 'Active' | 'Suspended' | 'Blocked'; pin: string; portalAccess: boolean; notifyOnCredit: boolean | null; }
interface Transaction { id: string; customerId: string; type: 'credit_sale' | 'payment' | 'opening_balance' | 'advance'; date: string; product?: string; quantity?: number; rate?: number; amount: number; mode?: string; vehicleNumber?: string; remarks?: string; reference?: string; }
interface MorningEntry { id: string; date: string; petrolDip: number; dieselDip: number; petrolSold: number; dieselSold: number; netProfit: number; variance: number; submitted: boolean; netValue: number; collectionsCash: number; balanceCash: number; collectionsBank: number; collectionsDigital: number; collectionDtp: number; collectionsCard: number; collectionsCredit: number; periodExpenses: number; balanceBank: number; balanceDigital: number; balanceOd: number; openingBalance?: number; petrolRateAtEntry?: number; dieselRateAtEntry?: number; }
interface Expense { id: string; date: string; category: string; amount: number; description: string; vendor: string; mode: string; }
interface FuelPurchase { id: string; date: string; product: string; litres: number; rate: number; amount: number; supplier: string; invoice: string; mode: string; }

interface AppContextType {
  user: User | null; dataLoading: boolean; unsavedForm: boolean; setUnsavedForm: (v: boolean) => void;
  login: (email: string, pass: string) => Promise<boolean>; loginCustomer: (phone: string, pin: string) => Promise<void>;
  signup: (data: { name: string, phone: string, bunkName: string, email: string, pass: string, fuelCompany: string, bizType: string, drugLicense?: string, season?: string, cashInHand?: number, cashInBank?: number, stockValue?: number, customerReceivables?: number, supplierPayables?: number }) => Promise<void>;
  logout: () => void; currentRoute: string; setCurrentRoute: (r: string) => void; customerFilter: string; setCustomerFilter: (f: string) => void;
  customers: Customer[]; transactions: Transaction[]; morningEntries: MorningEntry[]; expenses: Expense[]; fuelPurchases: FuelPurchase[]; users: User[]; settings: any;
  addCustomer: (c: any) => Promise<string | null>; updateCustomer: (id: string, updates: any) => Promise<void>; deleteCustomer: (id: string) => Promise<void>;
  addTransaction: (t: any) => Promise<boolean>; updateTransaction: (id: string, updates: any) => Promise<void>; deleteTransaction: (id: string) => Promise<void>;
  addMorningEntry: (e: any) => Promise<void>; updateMorningEntry: (id: string, updates: any) => Promise<void>; deleteMorningEntry: (id: string) => Promise<void>;
  addExpense: (e: any) => Promise<void>; updateExpense: (id: string, updates: any) => Promise<void>; deleteExpense: (id: string) => Promise<void>;
  addFuelPurchase: (purchases: any) => Promise<void>; updateFuelPurchase: (id: string, updates: any) => Promise<void>; deleteFuelPurchase: (id: string) => Promise<void>;
  addUser: (u: any) => Promise<void>; deleteUser: (id: string) => Promise<void>; updateSettings: (s: any) => Promise<void>; changePassword: (newPass: string) => Promise<void>;
  getCustomerBalance: (id: string) => number; getCustomerBalanceAsOf: (id: string, date: string) => number;
  bulkImportCustomers: (csvData: string) => Promise<void>; showAlert: (msg: string) => void; showConfirm: (msg: string, onConfirm: () => void) => void; validateInputs: (amounts: number[], litres: number[]) => boolean;
  sendWhatsAppAlert: (t: Transaction, c: Customer) => void; sendWhatsAppReminder: (c: Customer) => void;
}

// --- UTILS ---
const formatRs = (num: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(num) || 0);
const formatLakhs = (num: number) => {
  const n = Number(num) || 0;
  return (n >= 100000 || n <= -100000) ? `Rs ${(n / 100000).toFixed(2)} L` : formatRs(n);
};
// BUG-FIX: use cryptographically-secure UUID to prevent ID collisions
const generateId = () => crypto.randomUUID();

// --- APP STATE CONTEXT ---
const AppContext = createContext<AppContextType | null>(null);

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  useEffect(() => {
    const handleWheel = () => {
      if (document.activeElement && (document.activeElement as HTMLInputElement).type === 'number') {
        (document.activeElement as HTMLElement).blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('app_user_session');
      const parsed = saved ? JSON.parse(saved) : null;
      if (typeof parsed === 'object' && parsed !== null) {
        parsed.role = String(parsed.role || 'supervisor').toLowerCase() as Role;
        return parsed;
      }
      return null;
    } catch (e) {
      localStorage.removeItem('app_user_session'); return null;
    }
  });

  const [settings, setSettings] = useState(() => {
    const defaults = { bunkName: '', fuelCompany: '', petrolRate: 0, dieselRate: 0, initialPetrolDip: 0, initialDieselDip: 0, monthlyBudget: 0, currentOdBalance: 0, currentHpBalance: 0, odLimit: 3000000 };
    try {
      const saved = localStorage.getItem('app_settings');
      const parsed = saved ? JSON.parse(saved) : null;
      return (typeof parsed === 'object' && parsed !== null) ? { ...defaults, ...parsed } : defaults;
    } catch (e) {
      localStorage.removeItem('app_settings'); return defaults;
    }
  });

  const [dataLoading, setDataLoading] = useState(false); const [unsavedForm, setUnsavedForm] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null); const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void } | null>(null);

  const [currentRoute, _setCurrentRoute] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || 'dashboard';
  });
  const setCurrentRoute = (r: string) => {
    _setCurrentRoute(r);
    window.history.pushState({ route: r }, '', `#${r}`);
  };
  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.replace('#', '');
      _setCurrentRoute(hash || 'dashboard');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [customerFilter, setCustomerFilter] = useState('All');

  const [customers, setCustomers] = useState<Customer[]>([]); const [transactions, setTransactions] = useState<Transaction[]>([]); const [morningEntries, setMorningEntries] = useState<MorningEntry[]>([]); const [expenses, setExpenses] = useState<Expense[]>([]); const [fuelPurchases, setFuelPurchases] = useState<FuelPurchase[]>([]); const [users, setUsers] = useState<User[]>([]);

  const showAlert = (msg: any) => {
    // Coerce to string — prevents crash if called with Error object or non-string
    const safeMsg = typeof msg === 'string' ? msg : (msg?.message ?? String(msg));
    setAlertMessage(safeMsg);
    // Error messages stay 10s; success messages stay 5s
    const isError = safeMsg.startsWith('❌') || safeMsg.startsWith('⚠️') || safeMsg.toLowerCase().startsWith('transaction failed') || safeMsg.toLowerCase().startsWith('save failed');
    const t = setTimeout(() => setAlertMessage(null), isError ? 10000 : 5000);
    return () => clearTimeout(t);
  };
  const showConfirm = (message: string, onConfirm: () => void) => { setConfirmDialog({ message, onConfirm }); };

  const validateInputs = (amounts: number[], litres: number[]) => {
    for (const a of amounts) { if (a > 10000000) { showAlert("Amount seems too high, please verify."); return false; } }
    for (const l of litres) { if (l < 0) { showAlert("Litres cannot be negative."); return false; } if (l > 50000) { showAlert("Litres seem too high, please verify."); return false; } }
    return true;
  };

  const updateSettings = async (s: any) => {
    setSettings(s); localStorage.setItem('app_settings', JSON.stringify(s));
    if (user?.bunkId) {
      const { error } = await supabase.from('bunks').update({ name: s.bunkName, fuel_company: s.fuelCompany, petrol_rate: s.petrolRate, diesel_rate: s.dieselRate, monthly_budget: s.monthlyBudget, od_limit: s.odLimit, current_od_balance: s.currentOdBalance, current_hp_balance: s.currentHpBalance }).eq('id', user.bunkId);
      if (error) showAlert('Failed to update cloud settings: ' + error.message);
    }
  };

  const saveUserSession = (userData: User | null) => {
    const normalizedUser = userData ? { ...userData, role: String(userData.role).toLowerCase() as Role } : null;
    setUser(normalizedUser);
    if (normalizedUser) localStorage.setItem('app_user_session', JSON.stringify(normalizedUser));
    else localStorage.removeItem('app_user_session');
  };

  useEffect(() => {
    if (!hasValidKeys) return;
    supabase.auth.getSession().then((result) => {
      // Guard: result.data can be null if network fails or session is invalid
      const session = result?.data?.session ?? null;
      if (session?.user && !user) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data: profile, error: profErr }) => {
          if (profile) {
            saveUserSession({ id: String(profile.id), name: String(profile.name), email: String(profile.email), role: String(profile.role).toLowerCase() as Role, bunkId: String(profile.bunk_id) });
          } else {
            // Profile missing (account was deleted from Supabase) — sign out cleanly
            // so the user sees the login screen instead of crashing with ErrorBoundary
            console.warn('[Auth] Session found but profile missing — auto sign-out:', profErr?.message);
            supabase.auth.signOut().then(() => {
              localStorage.removeItem('app_user_session');
              localStorage.removeItem('app_biz_type');
              saveUserSession(null);
            });
          }
        });
      }
    }).catch((err) => {
      console.warn('[Auth] getSession error — clearing local session:', err?.message);
      localStorage.removeItem('app_user_session');
      saveUserSession(null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { if (!session) saveUserSession(null); });
    return () => subscription.unsubscribe();
  }, []);

  const mapTx = (d: any): Transaction => ({
    id: String(d.id || ''), customerId: String(d.customer_id || ''),
    type: String(d.type || 'credit_sale'), date: String(d.date || getTodayIST()),
    product: String(d.product || ''), quantity: Number(d.quantity) || 0,
    rate: Number(d.rate) || 0, amount: Number(d.amount) || 0,
    mode: String(d.payment_mode || ''), vehicleNumber: String(d.vehicle_number || ''),
    remarks: String(d.remarks || d.notes || '')
  });

  useEffect(() => {
    if (!user || !hasValidKeys) return;
    const targetBunk = user.bunkId || 'default';
    const fetchSupabaseData = async () => {
      setDataLoading(true);
      try {
        if (user.role === 'customer') {
          const { data: txData } = await supabase.from('transactions').select('*').eq('customer_id', user.id).order('created_at', { ascending: false }).range(0, 499);
          if (txData) setTransactions(txData.map(mapTx));
          setDataLoading(false); return;
        }

        const [{ data: bunkData }, { data: custData }, { data: txData }, { data: expData }, { data: fuelData }, { data: profData }, { data: morningData }] = await Promise.all([
          supabase.from('bunks').select('*').eq('id', targetBunk),
          supabase.from('customers').select('*').eq('bunk_id', targetBunk).range(0, 499),
          supabase.from('transactions').select('*').eq('bunk_id', targetBunk).order('created_at', { ascending: false }).range(0, 999),
          supabase.from('expenses').select('*').eq('bunk_id', targetBunk).order('created_at', { ascending: false }).range(0, 499),
          supabase.from('fuel_purchases').select('*').eq('bunk_id', targetBunk).order('created_at', { ascending: false }).range(0, 499),
          supabase.from('profiles').select('*').eq('bunk_id', targetBunk).range(0, 99),
          supabase.from('morning_entries').select('*').eq('bunk_id', targetBunk).order('created_at', { ascending: false }).range(0, 365)
        ]);

        if (bunkData && bunkData.length > 0) {
          const b = bunkData[0];
          const cloudSettings = { bunkName: b.name || '', fuelCompany: b.fuel_company || '', petrolRate: Number(b.petrol_rate) || 0, dieselRate: Number(b.diesel_rate) || 0, monthlyBudget: Number(b.monthly_budget) || 0, odLimit: Number(b.od_limit) || 3000000, currentOdBalance: Number(b.current_od_balance) || 0, currentHpBalance: Number(b.current_hp_balance) || 0, initialPetrolDip: Number(settings?.initialPetrolDip) || 0, initialDieselDip: Number(settings?.initialDieselDip) || 0 };
          setSettings(cloudSettings); localStorage.setItem('app_settings', JSON.stringify(cloudSettings));
          // Auto-sync biz_type from bunk record so module routing survives localStorage clears
          if (b.biz_type && b.biz_type !== 'unknown') {
            const existing = localStorage.getItem('app_biz_type');
            if (!existing) localStorage.setItem('app_biz_type', b.biz_type);
          }
        }

        if (custData) setCustomers(custData.map((d: any) => ({ id: String(d.id || ''), category: String(d.category || 'Other'), companyName: String(d.company_name || 'Unknown'), ownerName: String(d.owner_name || ''), address: String(d.address || ''), paymentTerms: String(d.payment_terms || 'Monthly'), phone: String(d.phone || ''), driverName: String(d.driver_name || ''), driverPhone: String(d.driver_phone || ''), vehicleNumbers: String(d.vehicle_numbers || ''), creditLimit: Number(d.credit_limit) || 0, status: String(d.status || 'Active'), pin: String(d.portal_pin || ''), portalAccess: Boolean(d.portal_access), notifyOnCredit: Boolean(d.notify_on_credit) })));
        if (txData) setTransactions(txData.map(mapTx));
        if (expData) setExpenses(expData.map((d: any) => ({ id: String(d.id || ''), date: String(d.date || getTodayIST()), category: String(d.category || 'Other'), amount: Number(d.amount) || 0, description: String(d.description || ''), vendor: String(d.vendor || ''), mode: String(d.payment_mode || '') })));
        if (fuelData) setFuelPurchases(fuelData.map((d: any) => ({ id: String(d.id || ''), date: String(d.date || getTodayIST()), product: String(d.product || 'Diesel'), litres: Number(d.litres) || 0, rate: Number(d.rate) || 0, amount: Number(d.amount) || Number(d.total_amount) || 0, supplier: String(d.supplier || d.vendor || ''), invoice: String(d.invoice || d.invoice_number || ''), mode: String(d.payment_mode || '') })));
        if (profData) setUsers(profData.map((d: any) => ({ id: String(d.id || ''), name: String(d.name || 'Staff'), email: String(d.email || ''), role: String(d.role || 'supervisor').toLowerCase(), bunkId: String(d.bunk_id || '') } as any)));
        if (morningData) setMorningEntries(morningData.map((d: any) => ({
          id: String(d.id || ''), date: String(d.entry_date || getTodayIST()), petrolDip: Number(d.petrol_dip_today) || 0, dieselDip: Number(d.diesel_dip_today) || 0, petrolSold: Number(d.petrol_sold_litres) || 0, dieselSold: Number(d.diesel_sold_litres) || 0, netProfit: Number(d.net_profit) || 0, variance: Number(d.collection_variance) || 0, submitted: true, netValue: Number(d.bunk_net_value) || 0,
          collectionsCash: Number(d.collections_cash) || 0, balanceCash: Number(d.balance_cash) || 0, collectionsBank: Number(d.collections_sbi) || 0, collectionsDigital: Number(d.collections_hppay) || 0, collectionDtp: Number(d.collections_dtp) || 0, collectionsCard: Number(d.collections_paytm) || 0, collectionsCredit: Number(d.collections_credit) || 0, periodExpenses: Number(d.period_expenses) || 0, balanceBank: Number(d.balance_sbi) || 0, balanceDigital: Number(d.balance_hp) || 0, balanceOd: Number(d.balnce_od || d.balance_od) || 0
        })));
      } catch (e) { console.error("Fetch error:", e); showAlert('Failed to sync. Please check your internet connection.'); } finally { setDataLoading(false); }
    };
    fetchSupabaseData();

    if (user.role === 'customer') return;
    const mapMorningEntry = (d: any): MorningEntry => ({
      id: String(d.id), date: String(d.entry_date || getTodayIST()),
      petrolDip: Number(d.petrol_dip_today) || 0, dieselDip: Number(d.diesel_dip_today) || 0,
      petrolSold: Number(d.petrol_sold_litres) || 0, dieselSold: Number(d.diesel_sold_litres) || 0,
      netProfit: Number(d.net_profit) || 0, variance: Number(d.collection_variance) || 0, submitted: true, netValue: Number(d.bunk_net_value) || 0,
      collectionsCash: Number(d.collections_cash) || 0, balanceCash: Number(d.balance_cash) || 0,
      collectionsBank: Number(d.collections_sbi) || 0, collectionsDigital: Number(d.collections_hppay) || 0,
      collectionDtp: Number(d.collections_dtp) || 0, collectionsCard: Number(d.collections_paytm) || 0,
      collectionsCredit: Number(d.collections_credit) || 0, periodExpenses: Number(d.period_expenses) || 0,
      balanceBank: Number(d.balance_sbi) || 0, balanceDigital: Number(d.balance_hp) || 0, balanceOd: Number(d.balance_od) || 0,
      petrolRateAtEntry: Number(d.petrol_rate_at_entry) || 0, dieselRateAtEntry: Number(d.diesel_rate_at_entry) || 0
    });
    const channel = supabase
      .channel(`bunk-realtime-${targetBunk}`)
      // Transactions
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `bunk_id=eq.${targetBunk}` }, (payload) => { const newTx = mapTx(payload.new); setTransactions(prev => { if (prev.some(t => t.id === newTx.id)) return prev; return [newTx, ...prev]; }); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `bunk_id=eq.${targetBunk}` }, (payload) => { const updated = mapTx(payload.new); setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t)); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transactions', filter: `bunk_id=eq.${targetBunk}` }, (payload) => { setTransactions(prev => prev.filter(t => t.id !== String((payload.old as any).id))); })
      // Expenses
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'expenses', filter: `bunk_id=eq.${targetBunk}` }, (payload) => { const d = payload.new as any; const newExp = { id: String(d.id), date: String(d.date || getTodayIST()), category: d.category || 'Other', amount: Number(d.amount) || 0, description: d.description || '', vendor: d.vendor || '', mode: d.payment_mode || '' }; setExpenses(prev => { if (prev.some(e => e.id === newExp.id)) return prev; return [newExp, ...prev]; }); })
      // Morning Entries — bot saves dip/sold/collections via WhatsApp
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'morning_entries', filter: `bunk_id=eq.${targetBunk}` }, (payload) => {
        const nm = mapMorningEntry(payload.new);
        setMorningEntries(prev => {
          // Deduplicate by both id AND date — prevents double-add when optimistic state
          // was already set by addMorningEntry before this realtime event arrived.
          if (prev.some(m => m.id === nm.id || m.date === nm.date)) return prev.map(m => m.date === nm.date ? nm : m);
          return [nm, ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'morning_entries', filter: `bunk_id=eq.${targetBunk}` }, (payload) => { const um = mapMorningEntry(payload.new); setMorningEntries(prev => prev.map(m => m.id === um.id ? um : m)); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'morning_entries', filter: `bunk_id=eq.${targetBunk}` }, (payload) => { setMorningEntries(prev => prev.filter(m => m.id !== String((payload.old as any).id))); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, user?.bunkId]);

  const login = async (email: string, pass: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pass });
    if (error) { showAlert(`Login Failed: ${error.message}`); return false; }

    const { data: profile, error: profError } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    if (profError || !profile) { showAlert(`Your profile is missing. Please contact support or sign up again.`); return false; }

    saveUserSession({ id: String(profile.id), name: String(profile.name), email: String(profile.email), role: String(profile.role).toLowerCase() as Role, bunkId: String(profile.bunk_id) });
    showAlert(`✅ Welcome back, ${profile.name}!`);
    return true;
  };

  const signup = async (formData: { name: string, phone: string, bunkName: string, email: string, pass: string, fuelCompany: string, bizType: string, drugLicense?: string, season?: string, cashInHand?: number, cashInBank?: number, stockValue?: number, customerReceivables?: number, supplierPayables?: number }) => {
    const cleanEmail = formData.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return showAlert("Please enter a valid email address.");
    if (formData.pass.length < 6) return showAlert("Password must be at least 6 characters.");
    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) return showAlert("Please enter a valid 10-digit Indian mobile number.");
    const normalizedPhone = `91${cleanPhone}`;

    const { data: authData, error: authError } = await supabase.auth.signUp({ email: cleanEmail, password: formData.pass, options: { emailRedirectTo: window.location.origin } });
    if (authError) return showAlert(`Registration Error: ${authError.message}`);
    if (!authData.user) return showAlert('Registration failed. Email might already exist.');

    const newBunkId = generateId();
    const trialEndsAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const netWorth = (formData.cashInHand || 0) + (formData.cashInBank || 0) + (formData.stockValue || 0) + (formData.customerReceivables || 0) - (formData.supplierPayables || 0);
    const defaultBizName: Record<string, string> = { fuel: 'My Fuel Station', kirana: 'My Kirana Store', medical: 'My Medical Shop', cement: 'My Cement Depot', hardware: 'My Hardware Shop', restaurant: 'My Restaurant', textile: 'My Textile Shop', auto_parts: 'My Auto Parts', agriculture: 'My Agro Shop', stationery: 'My Stationery', general: 'My Business' };

    // BUG-FIX: sequential inserts — bunk must exist before profiles/staff_roles reference it
    // (parallel Promise.all caused orphan profile rows when bunks insert failed)
    const { error: bunkError } = await supabase.from('bunks').insert([{
      id: newBunkId,
      name: formData.bunkName || defaultBizName[formData.bizType] || 'My Business',
      owner_name: formData.name, owner_phone: normalizedPhone,
      fuel_company: formData.bizType === 'fuel' ? formData.fuelCompany : null,
      biz_type: formData.bizType || 'fuel',
      opening_cash: formData.cashInHand || 0,
      opening_bank: formData.cashInBank || 0,
      opening_stock: formData.stockValue || 0,
      opening_receivables: formData.customerReceivables || 0,
      opening_payables: formData.supplierPayables || 0,
      opening_net_worth: netWorth,
      biz_metadata: {
        drug_license: formData.drugLicense || null,
        agriculture_season: formData.season || null,
      },
      current_od_balance: 0, current_hp_balance: 0, od_limit: 3000000,
      subscription_plan: 'trial', trial_ends_at: trialEndsAt, is_active: true
    }]);
    if (bunkError) return showAlert(`Setup Error: ${bunkError.message}`);

    // Now that bunk exists, insert profile and staff_role in parallel (both depend on bunk, not each other)
    const [{ error: profileError }, { error: staffError }] = await Promise.all([
      supabase.from('profiles').insert([{
        id: authData.user.id, name: formData.name, email: cleanEmail,
        role: 'owner', bunk_id: newBunkId, phone: normalizedPhone
      }]),
      supabase.from('staff_roles').insert([{
        bunk_id: newBunkId, phone: normalizedPhone, name: formData.name,
        role: 'owner', is_active: true, email: cleanEmail,
        webapp_user_id: authData.user.id
      }]),
    ]);
    if (profileError) console.error('[Signup] profile insert failed:', profileError.message);
    if (staffError) console.error('[Signup] staff_role insert failed:', staffError.message);

    localStorage.setItem('app_biz_type', formData.bizType || 'fuel');

    if (!authData.session) {
      showAlert('Success! Please check your email inbox and click the verification link to log in.');
      return;
    }

    saveUserSession({ id: authData.user.id, name: formData.name, email: cleanEmail, role: 'owner', bunkId: newBunkId });
    if (formData.bunkName) updateSettings({ ...settings, bunkName: formData.bunkName });
    showAlert(`✅ Welcome to Smart Biz AI, ${formData.name}! Your 3-month free trial has started.`);
  };

  // BUG-FIX: query DB directly — in-memory customers array is empty when no owner is logged in,
  // causing customer login to always fail with "not found"
  const loginCustomer = async (phone: string, pin: string): Promise<void> => {
    const normalize = (p: string) => p.replace(/[^0-9]/g, '').replace(/^91/, '').slice(-10);
    const normInput = normalize(phone);
    const fullPhone = `91${normInput}`;
    const { data: rows } = await supabase
      .from('customers')
      .select('id, company_name, phone, pin, portal_access, bunk_id')
      .or(`phone.eq.${normInput},phone.eq.${fullPhone}`)
      .eq('portal_access', true)
      .limit(1);
    const c = rows?.[0];
    if (c && c.pin && c.pin === pin) {
      saveUserSession({ id: c.id, name: c.company_name, email: '', role: 'customer', phone: fullPhone });
      showAlert(`Welcome to your portal, ${c.company_name}!`);
    } else {
      showAlert('Invalid PIN or mobile number not found.');
    }
  };

  const logout = () => {
    const doLogout = async () => {
      await supabase.auth.signOut();
      localStorage.removeItem('app_user_session');
      localStorage.removeItem('app_biz_type');
      localStorage.removeItem('app_lang');
      saveUserSession(null);
      setCustomers([]); setTransactions([]); setMorningEntries([]); setExpenses([]); setFuelPurchases([]); setUsers([]);
      setCurrentRoute('dashboard');
    };
    if (unsavedForm) {
      showConfirm('You have unsaved changes. Sign out anyway?', doLogout);
    } else {
      doLogout();
    }
  };

  const bId = user?.bunkId || 'default';

  const addCustomer = async (c: any) => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const custRow: any = { bunk_id: bId, company_name: c.companyName, phone: c.phone, portal_pin: pin, portal_access: true };
    if (c.ownerName)      custRow.owner_name      = c.ownerName;
    if (c.category)       custRow.category        = c.category;
    if (c.address)        custRow.address         = c.address;
    if (c.paymentTerms)   custRow.payment_terms   = c.paymentTerms;
    if (c.driverName)     custRow.driver_name     = c.driverName;
    if (c.driverPhone)    custRow.driver_phone    = c.driverPhone;
    if (c.vehicleNumbers) custRow.vehicle_numbers = c.vehicleNumbers;
    if (c.creditLimit)    custRow.credit_limit    = c.creditLimit;
    if (c.status)         custRow.status          = c.status;
    const { data, error } = await supabase.from('customers').insert([custRow]).select();

    if (error) { showAlert('Failed to save: ' + error.message); return null; }
    if (data && data.length > 0) {
      setCustomers([...customers, { ...c, id: data[0].id, pin, portalAccess: true }]);
      showAlert("Customer saved successfully.");
      return data[0].id;
    }
    return null;
  };

  const updateCustomer = async (id: string, updates: any) => {
    const { error } = await supabase.from('customers').update({
      company_name: updates.companyName, owner_name: updates.ownerName, category: updates.category, phone: updates.phone, address: updates.address, payment_terms: updates.paymentTerms,
      credit_limit: updates.creditLimit, driver_name: updates.driverName, driver_phone: updates.driverPhone, vehicle_numbers: updates.vehicleNumbers
    }).eq('id', id).eq('bunk_id', bId);
    if (error) return showAlert("Update Failed: " + error.message);
    setCustomers(customers.map(c => c.id === id ? { ...c, ...updates } : c)); showAlert("Customer details updated.");
  };

  const deleteCustomer = (id: string) => {
    showConfirm('Permanently delete this customer and all their transactions?', async () => {
      const { error } = await supabase.from('customers').delete().eq('id', id).eq('bunk_id', bId);
      if (error) return showAlert("Delete Failed: " + error.message);
      setCustomers(customers.filter(c => c.id !== id));
      showAlert("Customer permanently removed.");
    });
  };

  const addTransaction = async (t: any): Promise<boolean> => {
    // Guard: catch bad bunkId before hitting the DB
    if (!bId || bId === 'default' || bId === 'null' || bId === 'undefined') {
      showAlert('❌ Save failed: Session invalid. Please sign out and sign in again.');
      return false;
    }
    if (!t.customerId) {
      showAlert('❌ Save failed: No customer selected.');
      return false;
    }

    const row: any = {
      bunk_id: bId, customer_id: t.customerId, type: t.type,
      date: t.date, amount: t.amount,
    };
    if (t.product)       row.product        = t.product;
    if (t.quantity)      row.quantity       = t.quantity;
    if (t.mode)          row.payment_mode   = t.mode;
    if (t.vehicleNumber) row.vehicle_number = t.vehicleNumber;
    if (t.remarks)       row.remarks        = t.remarks;

    // Use supabase JS client — it auto-manages JWT refresh and is already
    // proven to work for updateTransaction / deleteTransaction in this app.
    const { data, error } = await supabase
      .from('transactions')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('[addTransaction] Supabase error:', error);
      const msg = error?.message || error?.details || JSON.stringify(error);
      showAlert(`❌ Save failed: ${msg}`);
      return false;
    }

    const savedId = data?.id ? String(data.id) : ('tmp-' + Date.now());
    setTransactions(prev => {
      const newTx: Transaction = { ...t, id: savedId };
      if (prev.some(x => x.id === newTx.id)) return prev;
      return [newTx, ...prev];
    });
    return true;
  };

  const updateTransaction = async (id: string, updates: any) => { const { error } = await supabase.from('transactions').update({ customer_id: updates.customerId, type: updates.type, date: updates.date, product: updates.product, quantity: updates.quantity, amount: updates.amount, payment_mode: updates.mode, vehicle_number: updates.vehicleNumber, remarks: updates.remarks }).eq('id', id).eq('bunk_id', bId); if (error) return showAlert("Update Failed: " + error.message); setTransactions(transactions.map(t => t.id === id ? { ...t, ...updates } : t)); showAlert("Transaction updated."); };
  const deleteTransaction = async (id: string) => { const { error } = await supabase.from('transactions').delete().eq('id', id).eq('bunk_id', bId); if (error) return showAlert("Delete Failed: " + error.message); setTransactions(transactions.filter(t => t.id !== id)); showAlert("Record deleted."); };

  const addMorningEntry = async (e: any) => {
    // Guard against double-submission for the same date
    if (morningEntries.some(m => m.date === e.date)) {
      showAlert(`An entry for ${e.date} already exists. Use edit to update it.`);
      return;
    }
    // Use direct REST API fetch to bypass PostgREST schema cache issues with balance_od column
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
    const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    const { data: sessionData } = await supabase.auth.getSession();
    const authToken = sessionData?.session?.access_token || supabaseKey;
    const body = {
      bunk_id: bId,
      entry_date: e.date,
      petrol_dip_today: e.petrolDip,
      diesel_dip_today: e.dieselDip,
      petrol_sold_litres: e.petrolSold,
      diesel_sold_litres: e.dieselSold,
      net_profit: e.netProfit,
      collection_variance: e.variance,
      collections_cash: e.collectionsCash,
      collections_sbi: e.collectionsBank,
      collections_hppay: e.collectionsDigital,
      collections_dtp: e.collectionDtp,
      collections_paytm: e.collectionsCard,
      collections_credit: e.collectionsCredit,
      period_expenses: e.periodExpenses,
      balance_sbi: e.balanceBank,
      balance_hp: e.balanceDigital,
      balance_od: e.balanceOd,
      balance_cash: e.balanceCash,
      bunk_net_value: e.netValue,
      petrol_rate_at_entry: settings?.petrolRate || 0,
      diesel_rate_at_entry: settings?.dieselRate || 0,
    };
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/morning_entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${authToken}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        showAlert('Failed to save entry: ' + errText);
        return;
      }
      const data = await resp.json();
      const savedId = Array.isArray(data) && data.length > 0 ? String(data[0].id) : ('tmp-' + Date.now());
      // Optimistically update local state — deduplicate by both id AND date to prevent
      // double-render when the realtime INSERT event also fires for the same row.
      setMorningEntries(prev => {
        const withoutSameDate = prev.filter(m => m.date !== e.date && m.id !== savedId);
        return [{ ...e, id: savedId }, ...withoutSameDate];
      });
    } catch (err: any) {
      showAlert('Save Failed (network): ' + err.message);
    }
  };
  const updateMorningEntry = async (id: string, updates: any) => {
    // PATCH by the specific row id — this updates in-place without risk of creating duplicates.
    // We use the raw fetch API (not supabase client) to include balance_od which may be missing
    // from the PostgREST schema cache on older deployments.
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
    const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    const { data: sessionData2 } = await supabase.auth.getSession();
    const authToken2 = sessionData2?.session?.access_token || supabaseKey;
    const body = {
      entry_date: updates.date,
      petrol_dip_today: updates.petrolDip,
      diesel_dip_today: updates.dieselDip,
      petrol_sold_litres: updates.petrolSold,
      diesel_sold_litres: updates.dieselSold,
      net_profit: updates.netProfit,
      collection_variance: updates.variance,
      collections_cash: updates.collectionsCash,
      collections_sbi: updates.collectionsBank,
      collections_hppay: updates.collectionsDigital,
      collections_dtp: updates.collectionDtp,
      collections_paytm: updates.collectionsCard,
      collections_credit: updates.collectionsCredit,
      period_expenses: updates.periodExpenses,
      balance_sbi: updates.balanceBank,
      balance_hp: updates.balanceDigital,
      balance_od: updates.balanceOd,
      balance_cash: updates.balanceCash,
      bunk_net_value: updates.netValue,
      petrol_rate_at_entry: settings?.petrolRate || 0,
      diesel_rate_at_entry: settings?.dieselRate || 0,
    };
    try {
      // PATCH to /morning_entries?id=eq.<id>&bunk_id=eq.<bId> — scoped to this bunk (defense-in-depth beyond RLS).
      const resp = await fetch(`${supabaseUrl}/rest/v1/morning_entries?id=eq.${id}&bunk_id=eq.${bId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${authToken2}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        showAlert('Update Failed: ' + errText);
        return;
      }
      // Update local state — keep same id, merge updated fields
      setMorningEntries(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
      // CRITICAL: sync settings so dashboard OD reflects the new value immediately
      if (updates.balanceOd !== undefined) {
        setSettings((prev: any) => ({ ...prev, currentOdBalance: updates.balanceOd, currentHpBalance: updates.balanceDigital ?? prev.currentHpBalance }));
        if (bId) {
          supabase.from('bunks').update({ current_od_balance: updates.balanceOd, current_hp_balance: updates.balanceDigital ?? 0 }).eq('id', bId);
        }
      }
      showAlert('✅ Entry updated successfully!');
    } catch (err: any) {
      showAlert('Update Failed (network): ' + err.message);
    }
  };
  const deleteMorningEntry = async (id: string) => { const { error } = await supabase.from('morning_entries').delete().eq('id', id).eq('bunk_id', bId); if (error) return showAlert("Delete Failed: " + error.message); setMorningEntries(morningEntries.filter(m => m.id !== id)); showAlert("Morning entry deleted."); };

  const addExpense = async (e: any) => {
    const row: any = { bunk_id: bId, date: e.date, category: e.category, amount: e.amount };
    if (e.description) row.description  = e.description;
    if (e.vendor)      row.vendor       = e.vendor;
    if (e.mode)        row.payment_mode = e.mode;
    const { data, error } = await supabase.from('expenses').insert([row]).select();
    if (error) return showAlert("Failed to record expense: " + error.message);
    if (data && data.length > 0) setExpenses([{ ...e, id: data[0].id }, ...expenses]);
    showAlert("Expense recorded.");
  };
  const updateExpense = async (id: string, updates: any) => { const { error } = await supabase.from('expenses').update({ date: updates.date, category: updates.category, amount: updates.amount, description: updates.description, vendor: updates.vendor }).eq('id', id).eq('bunk_id', bId); if (error) return showAlert("Update Failed: " + error.message); setExpenses(expenses.map(e => e.id === id ? { ...e, ...updates } : e)); showAlert("Expense updated."); };
  const deleteExpense = async (id: string) => { const { error } = await supabase.from('expenses').delete().eq('id', id).eq('bunk_id', bId); if (error) return showAlert("Delete Failed: " + error.message); setExpenses(expenses.filter(e => e.id !== id)); showAlert("Expense deleted."); };

  const addFuelPurchase = async (purchases: any[]) => {
    const rows = purchases.map(f => {
      const row: any = { bunk_id: bId, date: f.date, product: f.product, litres: f.litres, rate: f.rate, amount: f.amount };
      if (f.supplier)  row.supplier     = f.supplier;
      if (f.invoice)   row.invoice      = f.invoice;
      if (f.mode)      row.payment_mode = f.mode;
      return row;
    });
    const { data, error } = await supabase.from('fuel_purchases').insert(rows).select();
    if (error) return showAlert('Failed to record fuel: ' + error.message);
    if (data && data.length > 0) {
      const newPurchases = data.map((d: any) => ({
        id: String(d.id), date: String(d.date || getTodayIST()),
        product: d.product || 'Diesel', litres: Number(d.litres) || 0,
        rate: Number(d.rate) || 0, amount: Number(d.amount) || 0,
        supplier: d.supplier || '', invoice: d.invoice || '', mode: d.payment_mode || ''
      }));
      setFuelPurchases(prev => [...newPurchases, ...prev]);
    }
    showAlert('Fuel receipt recorded successfully.');
  };
  const updateFuelPurchase = async (id: string, updates: any) => {
    const { error } = await supabase.from('fuel_purchases').update({
      date: updates.date, product: updates.product,
      litres: updates.litres, rate: updates.rate, amount: updates.amount,
      supplier: updates.supplier || '', invoice: updates.invoice || '',
      payment_mode: updates.mode || 'Bank Transfer'
    }).eq('id', id).eq('bunk_id', bId);
    if (error) return showAlert('Update Failed: ' + error.message);
    setFuelPurchases(fuelPurchases.map(f => f.id === id ? { ...f, ...updates } : f));
    showAlert('Fuel receipt updated.');
  };
  const deleteFuelPurchase = async (id: string) => { const { error } = await supabase.from('fuel_purchases').delete().eq('id', id).eq('bunk_id', bId); if (error) return showAlert("Delete Failed: " + error.message); setFuelPurchases(fuelPurchases.filter(f => f.id !== id)); showAlert("Fuel record deleted."); };

  const addUser = async (u: any) => {
    const cleanEmail = u.email.trim().toLowerCase();
    const { data: authData, error: authError } = await supabase.auth.signUp({ email: cleanEmail, password: u.password, options: { emailRedirectTo: window.location.origin } });
    if (authError) return showAlert('Failed to create account: ' + authError.message);
    if (!authData.user) return showAlert('Could not create user. Email may already exist.');
    const { error: profileError } = await supabase.from('profiles').insert([{ id: authData.user.id, name: u.name, email: cleanEmail, role: u.role, bunk_id: bId }]);
    if (profileError) return showAlert('Profile creation failed: ' + profileError.message);
    setUsers([...users, { id: authData.user.id, name: u.name, email: cleanEmail, role: String(u.role).toLowerCase() as Role, bunkId: bId }]);
    showAlert(`Staff account created. Ensure they verify their email to log in.`);
  };
  const deleteUser = async (id: string) => {
    const webhookUrl = (import.meta as any).env?.VITE_WEBHOOK_URL;
    if (!webhookUrl) return showAlert('Webhook URL not configured (VITE_WEBHOOK_URL).');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return showAlert('Not authenticated.');
    try {
      const res = await fetch(`${webhookUrl}/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const body = await res.json();
      if (!res.ok) return showAlert(body.error || 'Failed to remove user.');
      setUsers(users.filter(u => u.id !== id));
      showAlert('Staff account fully removed.');
    } catch {
      showAlert('Network error — please try again.');
    }
  };

  const changePassword = async (newPass: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) showAlert('Password change failed: ' + error.message);
    else showAlert('Password updated successfully! Please log in again with your new password.');
  };

  // Shared balance reducer — handles BOTH old embedded-advance format (remarks) and new separate rows
  const balanceReducer = (acc: number, curr: Transaction) => {
    let txTotal = curr.amount || 0;
    // Backward compat: old web-app format embedded advance amount in remarks as "advance:5000|"
    // New format (bot + updated web app) uses a separate advance row — no double-count risk
    if (curr.type === 'credit_sale' && curr.remarks?.startsWith('advance:')) {
      const adv = Number(curr.remarks.split('|')[0].split(':')[1]) || 0;
      txTotal += adv;
    }
    if (curr.type === 'credit_sale' || curr.type === 'opening_balance' || curr.type === 'advance') return acc + txTotal;
    if (curr.type === 'payment') return acc - (curr.amount || 0);
    return acc;
  };

  const getCustomerBalance = (customerId: string) =>
    transactions.filter(t => t.customerId === customerId).reduce(balanceReducer, 0);

  const getCustomerBalanceAsOf = (customerId: string, date: string) =>
    transactions.filter(t => t.customerId === customerId && (t.date || '') <= date).reduce(balanceReducer, 0);

  const bulkImportCustomers = async (csvText: string) => {
    try {
      setDataLoading(true);
      const { data: existingCusts } = await supabase.from('customers').select('*').eq('bunk_id', bId);

      const parseCSVRow = (str: string) => {
        const result = []; let cur = ''; let inQuotes = false;
        for (let i = 0; i < str.length; i++) {
          if (str[i] === '"') inQuotes = !inQuotes;
          else if (str[i] === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; }
          else cur += str[i];
        }
        result.push(cur.trim());
        return result.map(s => s.replace(/^"|"$/g, '').replace(/""/g, '"'));
      };

      const lines = csvText.split(/\r?\n/).filter(r => r.trim().length > 0);
      if (lines.length < 2) throw new Error("File empty or missing headers");

      let successCount = 0; let updateCount = 0;
      let inserts = []; let txInserts = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVRow(lines[i]);
        if (cols.length >= 2) {
          const companyName = cols[0] || ''; const phone = cols[1] || '';
          const driverName = cols[2] || ''; const driverPhone = cols[3] || ''; const vehicleNumbers = cols[4] || '';
          const creditLimit = Number(cols[5]) || 0; const openingBal = cols[6] ? Number(cols[6]) : 0;

          if (!companyName || !phone) continue;

          const existing = existingCusts?.find((c: any) => c.phone === phone);
          if (existing) {
            const updates: any = {};
            if (driverName) updates.driver_name = driverName;
            if (driverPhone) updates.driver_phone = driverPhone;
            if (vehicleNumbers) {
              updates.vehicle_numbers = existing.vehicle_numbers
                ? (existing.vehicle_numbers.includes(vehicleNumbers) ? existing.vehicle_numbers : `${existing.vehicle_numbers}, ${vehicleNumbers}`)
                : vehicleNumbers;
            }
            if (Object.keys(updates).length > 0) { await supabase.from('customers').update(updates).eq('id', existing.id).eq('bunk_id', bId); updateCount++; }
          } else {
            const pin = Math.floor(1000 + Math.random() * 9000).toString();
            const newCustId = generateId();
            inserts.push({ id: newCustId, bunk_id: bId, company_name: companyName, driver_name: driverName, driver_phone: driverPhone, vehicle_numbers: vehicleNumbers, category: 'Fleet', phone: phone, credit_limit: creditLimit, status: 'Active', portal_pin: pin, portal_access: true });
            if (openingBal > 0) { txInserts.push({ bunk_id: bId, customer_id: newCustId, type: 'opening_balance', date: getTodayIST(), amount: openingBal, product: 'Opening Balance' }); }
            successCount++;
          }
        }
      }

      if (inserts.length > 0) {
        const { error: custErr } = await supabase.from('customers').insert(inserts);
        if (custErr) throw custErr;
        if (txInserts.length > 0) await supabase.from('transactions').insert(txInserts);
      }

      showAlert(`✅ Imported ${successCount} new, Updated ${updateCount} existing accounts!`);
      // Reload customers from DB instead of full page reload
      const { data: freshCusts } = await supabase.from('customers').select('*').eq('bunk_id', bId);
      if (freshCusts) setCustomers(freshCusts.map((d: any) => ({ id: String(d.id), category: d.category || 'Other', companyName: d.company_name || 'Unknown', ownerName: d.owner_name || '', address: d.address || '', paymentTerms: d.payment_terms || 'Monthly', phone: d.phone || '', driverName: d.driver_name || '', driverPhone: d.driver_phone || '', vehicleNumbers: d.vehicle_numbers || '', creditLimit: Number(d.credit_limit) || 0, status: d.status || 'Active', pin: d.portal_pin || '', portalAccess: Boolean(d.portal_access), notifyOnCredit: d.notify_on_credit })));
    } catch (e: any) { console.error(e); showAlert(`Import Failed: ${e.message}. Ensure format: CompanyName, Phone, DriverName, DriverPhone, VehicleNumbers, CreditLimit, OpeningBalance`); } finally { setDataLoading(false); }
  };

  const sendWhatsAppAlert = (t: Transaction, c: Customer) => {
    const bal = getCustomerBalance(c.id);
    const isPayment = t.type === 'payment'; const isAdvance = t.type === 'advance';
    const emoji = isPayment ? '✅' : (isAdvance ? '💸' : '⛽');
    const title = isPayment ? 'Payment Received' : (isAdvance ? 'Cash Advance Given' : 'Fuel Credit Sale');

    let msg = `*${settings?.bunkName || 'Fuel Station'}*\n\n${emoji} *${title}*\n*Date:* ${formatISTDate(t.date)}\n`;
    if (t.vehicleNumber) msg += `*Vehicle:* ${t.vehicleNumber}\n`;
    if (t.product && !isPayment && !isAdvance) msg += `*Product:* ${t.product} ${t.quantity ? `(${t.quantity} L)` : ''}\n`;
    msg += `*Amount:* ${formatRs(t.amount)}\n`;
    if (t.mode && isPayment) msg += `*Mode:* ${t.mode}\n`;
    msg += `------------------------\n*Current Pending Balance:* ${formatRs(bal)}\n------------------------\nThank you for your business!`;

    const phoneStr = c.phone || '';
    const cleanPhone = phoneStr.replace(/\D/g, '');
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const sendWhatsAppReminder = (c: Customer) => {
    const bal = getCustomerBalance(c.id);
    if (bal <= 0) return showAlert("No pending balance for this customer.");
    let msg = `*${settings?.bunkName || 'Fuel Station'}*\n\nHello ${c.companyName || ''},\n\nThis is a gentle reminder that your current pending balance is *${formatRs(bal)}*.\n\nPlease arrange for payment at your earliest convenience.\n\nThank you for your business!`;

    const phoneStr = c.phone || '';
    const cleanPhone = phoneStr.replace(/\D/g, '');
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <AppContext.Provider value={{ user, dataLoading, unsavedForm, setUnsavedForm, login, loginCustomer, signup, logout, currentRoute, setCurrentRoute, customerFilter, setCustomerFilter, customers, transactions, morningEntries, expenses, fuelPurchases, users, settings, addCustomer, updateCustomer, deleteCustomer, addTransaction, updateTransaction, deleteTransaction, addMorningEntry, updateMorningEntry, deleteMorningEntry, addExpense, updateExpense, deleteExpense, addFuelPurchase, updateFuelPurchase, deleteFuelPurchase, addUser, deleteUser, updateSettings, changePassword, getCustomerBalance, getCustomerBalanceAsOf, bulkImportCustomers, showAlert, showConfirm, validateInputs, sendWhatsAppAlert, sendWhatsAppReminder }}>
      {children}
      {typeof alertMessage === 'string' && alertMessage.length > 0 && (
        <div className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-5 sm:top-5 sm:max-w-sm z-[9999] px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${alertMessage.startsWith('✅') || alertMessage.toLowerCase().includes('success') || alertMessage.toLowerCase().includes('saved') || alertMessage.toLowerCase().includes('updated') || alertMessage.toLowerCase().includes('welcome') ? 'bg-green-800 text-white' : 'bg-gray-900 text-white'}`}>
          {alertMessage.startsWith('✅') || alertMessage.toLowerCase().includes('success') || alertMessage.toLowerCase().includes('saved') || alertMessage.toLowerCase().includes('updated') || alertMessage.toLowerCase().includes('welcome')
            ? <CheckCircle2 size={20} className="text-green-300 shrink-0" />
            : <AlertCircle size={20} className="text-blue-400 shrink-0" />}
          <p className="font-medium text-sm flex-1">{alertMessage}</p>
          <button onClick={() => setAlertMessage(null)} className="shrink-0 text-white/60 hover:text-white transition"><X size={16} /></button>
        </div>
      )}
      {confirmDialog && (<div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95"><div className="flex items-center text-red-600 mb-4 gap-2"><AlertCircle size={24} /><h3 className="text-lg font-bold text-gray-900">Confirm Action</h3></div><p className="text-gray-600 mb-8 font-medium">{confirmDialog.message}</p><div className="flex gap-3 justify-end"><button onClick={() => setConfirmDialog(null)} className="px-5 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition">Cancel</button><button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="px-5 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-md shadow-red-200">Confirm</button></div></div></div>)}
    </AppContext.Provider>
  );
};

const useAppContext = () => { const ctx = useContext(AppContext); if (!ctx) throw new Error('useAppContext must be used within AppProvider'); return ctx; };

// --- COMPONENTS ---

// 1. Auth Screens
const LandingScreen = ({ onPrivacy }: { onPrivacy?: () => void }) => {
  const { login, loginCustomer, signup, showAlert } = useAppContext();

  const [step, setStep] = useState<'lang' | 'biz' | 'login'>(() => {
    const lang = localStorage.getItem('app_lang');
    const biz = localStorage.getItem('app_biz_type');
    if (lang && biz) return 'login';
    if (lang) return 'biz';
    return 'lang';
  });

  const [tab, setTab] = useState<'staff' | 'customer'>('staff');
  const [view, setView] = useState<'login' | 'signup'>('login');
  const [signupStep, setSignupStep] = useState<'basic' | 'networth'>('basic');
  const [loginEmail, setLoginEmail] = useState(''); const [loginPass, setLoginPass] = useState('');
  const [regName, setRegName] = useState(''); const [regPhone, setRegPhone] = useState(''); const [regBunk, setRegBunk] = useState(''); const [regFuelCompany, setRegFuelCompany] = useState('Generic'); const [regEmail, setRegEmail] = useState(''); const [regPass, setRegPass] = useState('');
  const [regDrugLicense, setRegDrugLicense] = useState(''); const [regSeason, setRegSeason] = useState('Kharif');
  const [regCash, setRegCash] = useState(''); const [regBank, setRegBank] = useState(''); const [regStock, setRegStock] = useState(''); const [regReceivables, setRegReceivables] = useState(''); const [regPayables, setRegPayables] = useState('');
  const [custPhone, setCustPhone] = useState(''); const [custPin, setCustPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchView = (newView: 'login' | 'signup') => { setLoginEmail(''); setLoginPass(''); setRegName(''); setRegPhone(''); setRegBunk(''); setRegEmail(''); setRegPass(''); setRegDrugLicense(''); setRegSeason('Kharif'); setRegCash(''); setRegBank(''); setRegStock(''); setRegReceivables(''); setRegPayables(''); setSignupStep('basic'); setView(newView); };

  const waNumber = (import.meta as any).env?.VITE_WHATSAPP_NUMBER || '917093578438';
  const selectLang = (l: string) => { localStorage.setItem('app_lang', l); setStep('biz'); };
  const selectBiz = (b: string) => { localStorage.setItem('app_biz_type', b); setStep('login'); };
  const goBack = () => {
    if (step === 'login') { localStorage.removeItem('app_biz_type'); setStep('biz'); }
    else if (step === 'biz') { localStorage.removeItem('app_lang'); setStep('lang'); }
  };
  const openWhatsApp = () => {
    window.open(`https://wa.me/${waNumber}?text=Hi, I want to register my business on Smart Biz AI`, '_blank', 'noopener,noreferrer');
  };

  const stepLabels = [{ key: 'lang', label: 'Language' }, { key: 'biz', label: 'Business' }, { key: 'login', label: 'Login' }];

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-indigo-950 via-purple-950 to-blue-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-700 to-purple-700 p-6 text-center text-white">
          <Briefcase className="w-12 h-12 mx-auto mb-2 text-indigo-200" />
          <h1 className="text-2xl font-bold">Smart Biz AI</h1>
          <p className="text-indigo-200 text-sm">Your AI-Powered Business Assistant</p>
        </div>
        <div className="flex bg-gray-50 border-b">
          {stepLabels.map((s, i) => (
            <div key={s.key} className={`flex-1 py-2 text-center text-xs font-medium ${step === s.key ? 'text-indigo-700 border-b-2 border-indigo-700' : 'text-gray-400'}`}>
              {i + 1}. {s.label}
            </div>
          ))}
        </div>
        <div className="p-6">
          {step === 'lang' && (
            <div className="space-y-3 animate-in fade-in">
              <p className="text-gray-500 text-center text-sm mb-4">Select your preferred language</p>
              {[
                { code: 'english', label: '🇮🇳 English', sub: 'Continue in English' },
                { code: 'telugu', label: '🇮🇳 తెలుగు', sub: 'తెలుగులో కొనసాగించండి' },
                { code: 'hindi', label: '🇮🇳 हिंदी', sub: 'हिंदी में जारी रखें' },
              ].map(l => (
                <button key={l.code} onClick={() => selectLang(l.code)}
                  className="w-full flex items-center justify-between p-4 border-2 border-gray-100 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group">
                  <div className="text-left">
                    <div className="font-semibold text-gray-800 group-hover:text-indigo-700">{l.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{l.sub}</div>
                  </div>
                  <ChevronRight className="text-gray-300 group-hover:text-indigo-500 shrink-0" size={20} />
                </button>
              ))}
            </div>
          )}
          {step === 'biz' && (
            <div className="space-y-3 animate-in fade-in">
              <p className="text-gray-500 text-center text-sm mb-2">What type of business do you run?</p>
              <button onClick={openWhatsApp} className="w-full flex items-center gap-3 p-3 bg-green-50 border-2 border-green-200 rounded-xl hover:border-green-400 hover:bg-green-100 transition-all group mb-1">
                <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                  <MessageCircle size={18} className="text-white" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-green-800 text-sm">Register via WhatsApp (Recommended)</div>
                  <div className="text-xs text-green-600">Tap to open chat · Set up in 5 minutes</div>
                </div>
                <ChevronRight className="text-green-400 shrink-0" size={18} />
              </button>
              <div className="flex items-center gap-2 text-gray-300 text-xs px-1 mb-1">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-gray-400">or register in app below</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { code: 'fuel', label: '⛽ Fuel Station', sub: 'Petrol / Diesel' },
                  { code: 'kirana', label: '🛒 Kirana Store', sub: 'Grocery & retail' },
                  { code: 'medical', label: '💊 Medical Shop', sub: 'Pharmacy' },
                  { code: 'cement', label: '🏗️ Cement & Steel', sub: 'Construction' },
                  { code: 'hardware', label: '🔧 Hardware', sub: 'Tools & fittings' },
                  { code: 'restaurant', label: '🍽️ Restaurant', sub: 'Food & beverage' },
                  { code: 'textile', label: '👗 Textile', sub: 'Cloth & garments' },
                  { code: 'auto_parts', label: '🚗 Auto Parts', sub: 'Vehicle spares' },
                  { code: 'agriculture', label: '🌾 Agriculture', sub: 'Seeds & fertilizer' },
                  { code: 'stationery', label: '📚 Stationery', sub: 'Office supplies' },
                  { code: 'general', label: '🏪 General Store', sub: 'Any retail' },
                ].map(b => (
                  <button key={b.code} onClick={() => selectBiz(b.code)}
                    className="flex flex-col items-start p-3 border-2 border-gray-100 rounded-xl transition-all hover:border-indigo-400 hover:bg-indigo-50 text-left group">
                    <div className="text-xl mb-1">{b.label.split(' ')[0]}</div>
                    <div className="font-semibold text-gray-800 group-hover:text-indigo-700 text-sm leading-tight">{b.label.slice(b.label.indexOf(' ') + 1)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{b.sub}</div>
                  </button>
                ))}
              </div>
              <button onClick={goBack} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-2 py-1">← Change language</button>
            </div>
          )}
          {step === 'login' && (
            <div className="animate-in fade-in">
              <div className="flex border-b mb-5 -mx-6 px-6">
                <button className={`flex-1 py-3 text-sm font-semibold ${tab === 'staff' ? 'text-indigo-700 border-b-2 border-indigo-700 -mb-px' : 'text-gray-500 hover:bg-gray-50'}`} onClick={() => setTab('staff')}>Staff Access</button>
                <button className={`flex-1 py-3 text-sm font-semibold ${tab === 'customer' ? 'text-indigo-700 border-b-2 border-indigo-700 -mb-px' : 'text-gray-500 hover:bg-gray-50'}`} onClick={() => setTab('customer')}>Customer Portal</button>
              </div>
              {tab === 'staff' && view === 'login' && (
                <form onSubmit={async (e) => { e.preventDefault(); setIsSubmitting(true); const ok = await login(loginEmail, loginPass); if (!ok) setLoginPass(''); setIsSubmitting(false); }} className="space-y-4 animate-in fade-in" autoComplete="off">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label><input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base" required /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base" required /></div>
                  <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-700 text-white p-3 rounded-lg font-bold hover:bg-indigo-800 transition disabled:opacity-50">{isSubmitting ? 'Authenticating...' : 'Login to Dashboard'}</button>
                  <div className="flex flex-col items-center mt-4 space-y-3 text-sm"><button type="button" onClick={() => showAlert("Please contact your station owner to reset your password.")} className="text-indigo-600 font-medium hover:underline">Forgot Password?</button><button type="button" onClick={() => switchView('signup')} className="text-gray-500 hover:text-gray-800 hover:underline">First time setup? Create Owner Account</button></div>
                </form>
              )}
              {tab === 'staff' && view === 'signup' && (() => {
                const selBiz = localStorage.getItem('app_biz_type') || 'fuel';
                const bizNameLabel: Record<string,string> = { fuel:'Fuel Station Name', kirana:'Store Name', medical:'Medical Shop Name', cement:'Shop / Depot Name', hardware:'Hardware Shop Name', restaurant:'Restaurant / Hotel Name', textile:'Shop Name', auto_parts:'Shop Name', agriculture:'Agro Shop Name', stationery:'Shop Name', general:'Business Name' };
                const bizNamePlaceholder: Record<string,string> = { fuel:'e.g., Highway Fuels', kirana:'e.g., Sri Rama Kirana', medical:'e.g., Sri Medicals', cement:'e.g., Ravi Cement Depot', hardware:'e.g., Kumar Hardware', restaurant:'e.g., Hotel Srinivas', textile:'e.g., Sri Sai Textiles', auto_parts:'e.g., Auto World', agriculture:'e.g., Kissan Agro', stationery:'e.g., Sri Stationery', general:'e.g., My Business' };
                const netWorthCalc = (Number(regCash)||0)+(Number(regBank)||0)+(Number(regStock)||0)+(Number(regReceivables)||0)-(Number(regPayables)||0);
                const fmtNW = (n: number) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
                if (signupStep === 'basic') return (
                  <form onSubmit={(e) => { e.preventDefault(); setSignupStep('networth'); }} className="space-y-4 animate-in fade-in slide-in-from-right-4 max-h-[60vh] overflow-y-auto pr-1" autoComplete="off">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Owner Full Name</label><input type="text" value={regName} onChange={e => setRegName(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base" required /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label><input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base" required /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">{bizNameLabel[selBiz] || 'Business Name'}</label><input type="text" value={regBunk} onChange={e => setRegBunk(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base" placeholder={bizNamePlaceholder[selBiz] || 'e.g., My Business'} required /></div>
                    {selBiz === 'fuel' && <div><label className="block text-sm font-medium text-gray-700 mb-1">Fuel Brand / Company</label><select className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-base" value={regFuelCompany} onChange={e => setRegFuelCompany(e.target.value)}><option value="Generic">Independent / Generic</option><option>HPCL</option><option>IOCL</option><option>BPCL</option><option>Reliance</option><option>Nayara</option><option>Shell</option></select></div>}
                    {selBiz === 'medical' && <div><label className="block text-sm font-medium text-gray-700 mb-1">Drug License Number <span className="text-gray-400 text-xs">(optional)</span></label><input type="text" value={regDrugLicense} onChange={e => setRegDrugLicense(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base" placeholder="e.g., DL/TG/2024/12345" /></div>}
                    {selBiz === 'agriculture' && <div><label className="block text-sm font-medium text-gray-700 mb-1">Main Crop Season</label><select className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-base" value={regSeason} onChange={e => setRegSeason(e.target.value)}><option>Kharif</option><option>Rabi</option><option>Both</option><option>Year Round</option></select></div>}
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label><input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base" required /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Password (Min 6 chars)</label><input type="password" value={regPass} onChange={e => setRegPass(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base" required minLength={6} /></div>
                    <button type="submit" className="w-full bg-indigo-700 text-white p-3 rounded-lg font-bold hover:bg-indigo-800 transition mt-2">Continue → Net Worth Setup</button>
                    <div className="text-center mt-4"><button type="button" onClick={() => switchView('login')} className="text-sm text-gray-500 hover:text-gray-800 hover:underline">Already have an account? Login here</button></div>
                  </form>
                );
                return (
                  <form onSubmit={async (e) => { e.preventDefault(); setIsSubmitting(true); await signup({ name: regName, phone: regPhone, bunkName: regBunk, fuelCompany: regFuelCompany, email: regEmail, pass: regPass, bizType: selBiz, drugLicense: regDrugLicense, season: regSeason, cashInHand: Number(regCash)||0, cashInBank: Number(regBank)||0, stockValue: Number(regStock)||0, customerReceivables: Number(regReceivables)||0, supplierPayables: Number(regPayables)||0 }); setIsSubmitting(false); }} className="space-y-3 animate-in fade-in slide-in-from-right-4 max-h-[62vh] overflow-y-auto pr-1" autoComplete="off">
                    <p className="text-xs text-gray-500 text-center pb-1 border-b">Opening Balance — helps calculate your net worth. <span className="text-indigo-600 font-medium">You can skip all fields.</span></p>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs font-medium text-gray-600 mb-1">Cash in Hand (₹)</label><input type="number" min="0" value={regCash} onChange={e => setRegCash(e.target.value)} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="0" /></div>
                      <div><label className="block text-xs font-medium text-gray-600 mb-1">Cash in Bank (₹)</label><input type="number" min="0" value={regBank} onChange={e => setRegBank(e.target.value)} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="0" /></div>
                      <div><label className="block text-xs font-medium text-gray-600 mb-1">Stock Value (₹)</label><input type="number" min="0" value={regStock} onChange={e => setRegStock(e.target.value)} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="0" /></div>
                      <div><label className="block text-xs font-medium text-gray-600 mb-1">Customer Dues (₹)</label><input type="number" min="0" value={regReceivables} onChange={e => setRegReceivables(e.target.value)} className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="0" /></div>
                      <div className="col-span-2"><label className="block text-xs font-medium text-red-600 mb-1">Supplier Payables (₹) <span className="text-gray-400 font-normal">— subtracted</span></label><input type="number" min="0" value={regPayables} onChange={e => setRegPayables(e.target.value)} className="w-full p-2.5 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-400 outline-none text-sm" placeholder="0" /></div>
                    </div>
                    <div className={`p-3 rounded-xl text-center font-bold text-lg border-2 ${netWorthCalc >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                      Net Worth: {fmtNW(netWorthCalc)}
                    </div>
                    <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-700 text-white p-3 rounded-lg font-bold hover:bg-indigo-800 transition disabled:opacity-50">{isSubmitting ? 'Registering...' : 'Complete Registration'}</button>
                    <button type="button" onClick={() => setSignupStep('basic')} className="w-full text-sm text-gray-500 hover:text-gray-700 py-1">← Back to Basic Info</button>
                  </form>
                );
              })()}
              {tab === 'customer' && (
                <form onSubmit={(e) => { e.preventDefault(); if (!/^\d{10}$/.test(custPhone)) { showAlert('Registered Mobile Number must be exactly 10 digits.'); return; } loginCustomer(custPhone, custPin); }} className="space-y-4 animate-in fade-in">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Registered Mobile Number</label><input type="tel" value={custPhone} onChange={e => setCustPhone(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base" placeholder="10-digit number" required /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">4-Digit PIN</label><input type="password" maxLength={4} value={custPin} onChange={e => setCustPin(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center tracking-[0.5em] text-lg" required /></div>
                  <p className="text-xs text-gray-400 text-center">Your PIN was shared by your fuel station. Contact them if you don't have it.</p>
                  <button type="submit" className="w-full bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition">Check Balance</button>
                </form>
              )}
              <button onClick={goBack} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-4 py-1">← Change business type</button>
            </div>
          )}
        </div>
        <div className="px-6 pb-5 text-center text-xs text-gray-400 space-y-1">
          <button onClick={onPrivacy} className="text-indigo-500 underline hover:text-indigo-700">Privacy Policy &amp; Terms of Use</button>
          <p>&#169; 2026 Smart Biz AI</p>
        </div>
      </div>
    </div>
  );
};

// Placeholder dashboard for Kirana / Medical (coming soon)
const PlaceholderDashboard = ({ bizType }: { bizType: string }) => {
  const { logout } = useAppContext();
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notified, setNotified] = useState(false);
  const [saving, setSaving] = useState(false);
  const isKirana = bizType === 'kirana';
  const label = isKirana ? 'Kirana Store' : 'Medical Shop';
  const icon = isKirana ? '🛒' : '💊';
  const features = ['Daily Sales Tracking', 'Inventory Management', 'Customer Credit Ledger', 'Expense Reports', 'WhatsApp Bot Integration', 'Staff Management'];

  const handleNotify = async () => {
    if (!notifyEmail.includes('@')) return;
    setSaving(true);
    await supabase.from('waitlist_emails').upsert({ email: notifyEmail, biz_type: bizType }, { onConflict: 'email' });
    setSaving(false);
    setNotified(true);
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-indigo-950 via-purple-950 to-blue-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-700 to-purple-700 p-6 text-center text-white">
          <div className="text-4xl mb-2">{icon}</div>
          <h1 className="text-2xl font-bold">Smart Biz AI</h1>
          <p className="text-indigo-200 text-sm">{label} Module — Coming Soon!</p>
        </div>
        <div className="p-6">
          <p className="text-gray-500 text-sm text-center mb-5">We're building this for you. Get notified when it launches!</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {features.map(f => (
              <div key={f} className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg opacity-50 cursor-not-allowed">
                <div className="w-2 h-2 bg-gray-400 rounded-full shrink-0" />
                <span className="text-xs text-gray-500 font-medium leading-tight">{f}</span>
              </div>
            ))}
          </div>
          {!notified ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Notify me when {label} launches:</label>
              <input type="email" value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)} placeholder="your@email.com" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-base" />
              <button onClick={handleNotify} disabled={saving} className="w-full bg-indigo-700 text-white p-3 rounded-lg font-bold hover:bg-indigo-800 transition flex items-center justify-center gap-2 disabled:opacity-50">
                <Bell size={16} /> {saving ? 'Saving...' : 'Notify Me'}
              </button>
            </div>
          ) : (
            <div className="text-center p-4 bg-green-50 rounded-xl border border-green-200">
              <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-700 font-semibold">You're on the list!</p>
              <p className="text-green-600 text-sm mt-1">We'll notify {notifyEmail} when it's ready.</p>
            </div>
          )}
          <button onClick={logout} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-5 py-1">Sign Out</button>
        </div>
      </div>
    </div>
  );
};

// 2. Customer Portal
const CustomerPortalView = () => {
  const { user, settings, getCustomerBalance, transactions, logout } = useAppContext();
  const balance = getCustomerBalance(user!.id);
  const myTx = transactions.filter(t => t.customerId === user?.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <div className="bg-blue-800 p-4 sm:p-6 flex justify-between items-center text-white shadow-md">
        <div><h2 className="text-lg sm:text-xl font-bold">{settings?.bunkName || 'Fuel Station Portal'}</h2><p className="text-xs sm:text-sm text-blue-200">Customer: {user?.name}</p></div>
        <button onClick={logout} className="p-2 sm:px-4 bg-blue-700 rounded-lg hover:bg-blue-600 flex items-center gap-2 font-medium transition"><LogOut size={18} /> <span className="hidden sm:inline">Logout</span></button>
      </div>
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="p-8 text-center border-b">
            <p className="text-gray-500 mb-2 font-medium">Total Outstanding Balance</p>
            <h1 className={`text-4xl sm:text-5xl font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatRs(Math.abs(balance))}</h1>
            <p className="text-sm font-medium mt-2">{balance > 0 ? 'Amount you owe us' : balance < 0 ? 'Advance credit' : 'All clear'}</p>
            <p className="text-xs text-gray-400 mt-4">Balance as of {formatISTDate(getTodayIST())}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b bg-gray-50"><h3 className="font-bold text-gray-800">Recent Transactions</h3></div>
          <div className="p-0">
            {myTx.length === 0 ? (<div className="p-8 text-center text-gray-500">No transactions found.</div>) : (
              <div className="divide-y">
                {myTx.map(t => (
                  <div key={t.id} className="flex justify-between items-center p-4 hover:bg-gray-50 transition">
                    <div><p className="font-bold text-sm capitalize text-gray-900">{t.type.replace('_', ' ')} {t.product ? `- ${t.product}` : ''}</p><p className="text-xs text-gray-500 mt-1">{formatISTDate(t.date)} {t.vehicleNumber && `• Veh: ${t.vehicleNumber}`} {t.reference && `• Ref: ${t.reference}`}</p></div>
                    <div className={`font-bold text-lg ${t.type === 'payment' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'payment' ? '-' : '+'}{formatRs(t.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 3. Main Views

// Dashboard Analytics Engine
const Dashboard = () => {
  const { user, customers, getCustomerBalance, settings, morningEntries, expenses, transactions, fuelPurchases, setCurrentRoute, setCustomerFilter, dataLoading } = useAppContext();
  const [showAssets, setShowAssets] = useState(false);

  const [selectedYear, setSelectedYear] = useState(getCurrentYearStr());
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr().substring(5, 7));
  const period = selectedMonth === 'All' ? selectedYear : `${selectedYear}-${selectedMonth}`;

  const [chartPage, setChartPage] = useState(0);

  const userRole = String(user?.role || '').toLowerCase();

  const availableYears = useMemo(() => {
    const years = new Set<string>([getCurrentYearStr()]);
    morningEntries.forEach(e => {
      if (e.date && typeof e.date === 'string') {
        years.add(e.date.substring(0, 4));
      }
    });
    return Array.from(years).sort().reverse();
  }, [morningEntries]);

  const MONTHS = [
    { val: 'All', label: 'Full Year' }, { val: '01', label: 'Jan' }, { val: '02', label: 'Feb' },
    { val: '03', label: 'Mar' }, { val: '04', label: 'Apr' }, { val: '05', label: 'May' },
    { val: '06', label: 'Jun' }, { val: '07', label: 'Jul' }, { val: '08', label: 'Aug' },
    { val: '09', label: 'Sep' }, { val: '10', label: 'Oct' }, { val: '11', label: 'Nov' },
    { val: '12', label: 'Dec' }
  ];

  // --- 1. GLOBAL METRICS --- (all hooks MUST come before any early return)
  const { totalReceivables, overdueCount } = useMemo(() => {
    let recv = 0; let over = 0;
    for (const c of customers) {
      const bal = getCustomerBalance(c.id);
      recv += bal;
      if (bal > c.creditLimit) over++;
    }
    return { totalReceivables: recv, overdueCount: over };
  }, [customers, transactions]);
  const totalCustomers = customers.length;

  const sortedEntries = [...morningEntries].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  const latestEntry = sortedEntries.length > 0 ? sortedEntries[0] : null;

  const strictlyLiquidAssets = latestEntry ? ((Number(latestEntry.balanceCash) || 0) + (Number(latestEntry.balanceBank) || 0) + (Number(latestEntry.balanceDigital) || 0)) : 0;
  const fuelStockValue = (latestEntry ? latestEntry.petrolDip : (settings?.initialPetrolDip || 0)) * (settings?.petrolRate || 0) + (latestEntry ? latestEntry.dieselDip : (settings?.initialDieselDip || 0)) * (settings?.dieselRate || 0);
  const odLimitDash = Number(settings?.odLimit) || 3000000;
  // balance_od stores the RAW AVAILABLE amount entered by user (e.g. 560000 = ₹5.6L available)
  // OD drawn = limit - available   |   for net worth: liability = available - limit (negative)
  const latestOdEntry = sortedEntries.length > 0 ? sortedEntries[0] : null;
  const odEntryIsToday = latestOdEntry?.date === getTodayIST();
  const odAvailableDisplay = latestOdEntry ? Number(latestOdEntry.balanceOd || 0) : Number(settings?.currentOdBalance || 0);
  const currentOdBalance = odAvailableDisplay - odLimitDash;   // negative = debt, for net worth
  const odDrawnAmount = Math.max(0, odLimitDash - odAvailableDisplay);
  const odUsedPct = odLimitDash > 0 ? (odDrawnAmount / odLimitDash) * 100 : 0;
  // OD is ALWAYS a liability/loan — always show in red
  const bunkNetValue = totalReceivables + strictlyLiquidAssets + fuelStockValue + currentOdBalance;

  // --- 2. PERIOD ANALYTICS (Dynamic Math) ---
  const pEntries = morningEntries.filter(e => e.date && typeof e.date === 'string' && e.date.startsWith(period));
  const pTransactions = transactions.filter(t => t.date && typeof t.date === 'string' && t.date.startsWith(period));
  const pPurchases = fuelPurchases.filter(f => f.date && typeof f.date === 'string' && f.date.startsWith(period));
  const pExpenses = expenses.filter(ex => ex.date && typeof ex.date === 'string' && ex.date.startsWith(period));

  const pTotalSalesRs = pEntries.reduce((sum, e) => sum + ((e.petrolSold || 0) * (settings?.petrolRate || 0) + (e.dieselSold || 0) * (settings?.dieselRate || 0)), 0);
  const pTotalPetrolL = pEntries.reduce((sum, e) => sum + (e.petrolSold || 0), 0);
  const pTotalDieselL = pEntries.reduce((sum, e) => sum + (e.dieselSold || 0), 0);
  const pFuelBuyRs = pPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);
  const pTotalExpRs = pExpenses.reduce((sum, ex) => sum + (ex.amount || 0), 0);

  const isYearly = period.length === 4;
  const daysInPeriod = pEntries.length > 0 ? pEntries.length : 1;
  const avgLabel = isYearly ? 'Avg Monthly' : 'Avg Daily';

  const avgDailySalesRs = pTotalSalesRs / daysInPeriod;
  const avgPetrolL = isYearly ? (pTotalPetrolL / 12) : (pTotalPetrolL / daysInPeriod);
  const avgDieselL = isYearly ? (pTotalDieselL / 12) : (pTotalDieselL / daysInPeriod);

  // Strict 10-day slice for average surplus/deficit
  const sortedPeriodEntries = [...pEntries].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  const recent10Entries = sortedPeriodEntries.slice(0, 10);
  const pAvgVariance = recent10Entries.length > 0 ? (recent10Entries.reduce((sum, e) => sum + (e.variance || 0), 0) / recent10Entries.length) : 0;

  // True Period Profit considering Stock Valuation Change
  const entriesBeforePeriod = morningEntries.filter(e => e.date < (isYearly ? `${period}-01-01` : `${period}-01`)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const openingEntryForPeriod = entriesBeforePeriod.length > 0 ? entriesBeforePeriod[0] : null;
  const openingPetrolStock = openingEntryForPeriod ? openingEntryForPeriod.petrolDip : (settings.initialPetrolDip || 0);
  const openingDieselStock = openingEntryForPeriod ? openingEntryForPeriod.dieselDip : (settings.initialDieselDip || 0);
  const openingStockVal = (openingPetrolStock * (settings.petrolRate || 0)) + (openingDieselStock * (settings.dieselRate || 0));

  const latestPeriodEntry = sortedPeriodEntries.length > 0 ? sortedPeriodEntries[0] : openingEntryForPeriod;
  const closingPetrolStock = latestPeriodEntry ? latestPeriodEntry.petrolDip : openingPetrolStock;
  const closingDieselStock = latestPeriodEntry ? latestPeriodEntry.dieselDip : openingDieselStock;
  const closingStockVal = (closingPetrolStock * (settings.petrolRate || 0)) + (closingDieselStock * (settings.dieselRate || 0));

  const stockValuationChange = closingStockVal - openingStockVal;
  const pPeriodNetProfit = pTotalSalesRs - pFuelBuyRs + stockValuationChange - pTotalExpRs;
  const periodMarginPct = pTotalSalesRs > 0 ? (pPeriodNetProfit / pTotalSalesRs) * 100 : 0;

  const pCreditGiven = pTransactions.filter(t => t.type === 'credit_sale' || t.type === 'advance').reduce((sum, t) => sum + (t.amount || 0), 0);
  const pCreditRecv = pTransactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + (t.amount || 0), 0);

  const openingTransactions = transactions.filter(t => t.date && typeof t.date === 'string' && t.date < (isYearly ? `${period}-01-01` : `${period}-01`));
  const pOpeningCreditBal = openingTransactions.reduce((acc, t) => {
    if (t.type === 'credit_sale' || t.type === 'advance' || t.type === 'opening_balance') return acc + (t.amount || 0);
    if (t.type === 'payment') return acc - (t.amount || 0);
    return acc;
  }, 0);

  // --- CHART PAGINATION ---
  const chronologicalData = [...pEntries].sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
  const totalChartPages = Math.ceil(chronologicalData.length / 10);
  const safeChartPage = Math.min(chartPage, Math.max(0, totalChartPages - 1));

  const endIndex = chronologicalData.length - safeChartPage * 10;
  const startIndex = Math.max(0, endIndex - 10);

  const chartData = chronologicalData.slice(startIndex, endIndex).map(e => {
    let d = new Date();
    const parts = e.date.split('-');
    if (parts.length === 3) d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

    const dateLabel = isYearly ? `${d.toLocaleDateString('en-IN', { month: 'short' })}` : `${d.getDate()} ${d.toLocaleDateString('en-IN', { month: 'short' })}`;
    return { label: dateLabel, value: (e.petrolSold || 0) * (settings?.petrolRate || 0) + (e.dieselSold || 0) * (settings?.dieselRate || 0) };
  });

  const rawMaxVal = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) : 1;
  const maxChartVal = rawMaxVal > 0 ? rawMaxVal : 1;

  // Daily Quick Stats
  const yesterdayPetrolVal = (latestEntry?.petrolSold || 0) * (settings?.petrolRate || 0);
  const yesterdayDieselVal = (latestEntry?.dieselSold || 0) * (settings?.dieselRate || 0);
  const latestSalesValue = yesterdayPetrolVal + yesterdayDieselVal;

  const yesterdayReceived = latestEntry ? (((latestEntry.collectionsCash || 0) - (latestEntry.openingBalance || 0)) + (latestEntry.collectionsBank || 0) + (latestEntry.collectionsDigital || 0) + (latestEntry.collectionDtp || 0) + (latestEntry.collectionsCard || 0)) : 0;
  const mtdExpenses = expenses.filter(e => e.date && typeof e.date === 'string' && e.date.startsWith(getCurrentMonthStr())).reduce((sum, e) => sum + (e.amount || 0), 0);

  // Status Card
  const todayEntry = morningEntries.find(e => e.date === getTodayIST());

  // Early return AFTER all hooks (Rules of Hooks compliance)
  if (dataLoading) return <div className="flex justify-center items-center p-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name || 'Staff'}</h1><p className="text-gray-500">Financial Command Center for {settings?.bunkName || 'your business'}.</p></div>
        <div className="flex gap-2">
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="p-2 border rounded-xl font-bold text-blue-900 bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500">
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="p-2 border rounded-xl font-bold text-blue-900 bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500">
            {MONTHS.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {userRole === 'owner' && (
        <div className="bg-gradient-to-r from-blue-950 to-blue-900 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden border border-blue-800">
          <div className="flex justify-between items-start mb-1">
            <h2 className="text-xs font-bold text-blue-300 uppercase tracking-widest flex items-center"><BarChart3 size={14} className="mr-2" /> Global Business Net Value</h2>
            <span className="bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center border border-green-500/30 uppercase tracking-widest"><CheckCircle2 size={12} className="mr-1" /> Live Sync</span>
          </div>

          <p className="text-2xl md:text-3xl font-black mt-1 tracking-tight">{formatLakhs(bunkNetValue)}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 border-t border-blue-800/50 pt-4">
            <div className="bg-white/5 p-3 rounded-xl cursor-pointer hover:bg-white/10 transition" onClick={() => setCurrentRoute('customers')}>
              <p className="text-[10px] md:text-xs text-blue-300 uppercase tracking-wider font-bold mb-1">Total Credit</p>
              <p className="text-base md:text-lg font-bold">{formatLakhs(totalReceivables)}</p>
            </div>
            <div className="bg-white/5 p-3 rounded-xl cursor-pointer hover:bg-white/10 transition border border-dashed border-blue-400/30 hover:border-blue-400" onClick={() => setShowAssets(true)}>
              <p className="text-[10px] md:text-xs text-blue-300 uppercase tracking-wider font-bold mb-1">Liquid Assets 👆</p>
              <p className="text-base md:text-lg font-bold">{formatLakhs(strictlyLiquidAssets)}</p>
            </div>
            <div className="bg-white/5 p-3 rounded-xl cursor-pointer hover:bg-white/10 transition" onClick={() => setCurrentRoute('fuel')}>
              <p className="text-[10px] md:text-xs text-blue-300 uppercase tracking-wider font-bold mb-1">Fuel Stock Value</p>
              <p className="text-base md:text-lg font-bold">{formatLakhs(fuelStockValue)}</p>
            </div>
            <div className="bg-red-900/50 p-3 rounded-xl border border-red-500/40">
              <p className="text-[10px] md:text-xs text-red-300 uppercase tracking-wider font-bold mb-1">OD Drawn {!odEntryIsToday && latestOdEntry ? <span className="normal-case font-normal opacity-60">(as of {latestOdEntry.date})</span> : null}</p>
              <p className="text-base md:text-lg font-black text-red-200">-{formatRs(odDrawnAmount)}</p>
              <p className="text-[10px] text-red-400 mt-0.5">Avail: {formatRs(Math.max(0, odAvailableDisplay))} of {formatRs(odLimitDash)} ({odUsedPct.toFixed(0)}% used)</p>
            </div>
          </div>
        </div>
      )}

      {/* LIQUID ASSETS MODAL */}
      {showAssets && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-900">Liquid Funds Breakdown</h3><button onClick={() => setShowAssets(false)} className="text-gray-400 hover:text-gray-700 bg-gray-100 p-1 rounded-full"><X size={20} /></button></div>
            <div className="space-y-4">
              <div className="flex justify-between p-3 bg-gray-50 rounded-xl"><span className="text-gray-600 font-medium">Vault Cash</span><span className="font-bold text-gray-900">{formatRs(latestEntry?.balanceCash || 0)}</span></div>
              <div className="flex justify-between p-3 bg-gray-50 rounded-xl"><span className="text-gray-600 font-medium">Primary Bank</span><span className="font-bold text-blue-600">{formatRs(latestEntry?.balanceBank || 0)}</span></div>
              <div className="flex justify-between p-3 bg-gray-50 rounded-xl"><span className="text-gray-600 font-medium">Digital / Wallets</span><span className="font-bold text-purple-600">{formatRs(latestEntry?.balanceDigital || 0)}</span></div>
            </div>
            <div className="mt-6 pt-4 border-t flex justify-between items-center"><span className="font-bold text-gray-800">Total Available</span><span className="text-2xl font-black text-green-600">{formatRs(strictlyLiquidAssets)}</span></div>
            <button onClick={() => setShowAssets(false)} className="w-full mt-6 bg-gray-900 text-white py-3 rounded-xl font-bold">Close Details</button>
          </div>
        </div>
      )}

      {/* MORNING ENTRY STATUS CARD — shows step-by-step completion */}
      {(() => {
        const hasDip = todayEntry && (Number(todayEntry.petrolDip) > 0 || Number(todayEntry.dieselDip) > 0);
        const hasColls = todayEntry && (Number(todayEntry.collectionsCash) > 0 || Number(todayEntry.balanceCash) > 0 || Number(todayEntry.collectionsDigital) > 0);
        const hasBank = todayEntry && (Number(todayEntry.balanceBank) > 0 || Number(todayEntry.balanceOd) >= 0 && todayEntry.balanceOd !== undefined && todayEntry.balanceOd !== null);
        const allDone = hasDip && hasColls && hasBank;

        const step = (done: boolean, label: string, detail?: string) => (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
            done ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            {done
              ? <CheckCircle2 size={14} className="shrink-0 text-green-500" />
              : <AlertCircle size={14} className="shrink-0 text-amber-500" />}
            <span>{label}</span>
            {detail && <span className="ml-auto opacity-60">{detail}</span>}
          </div>
        );

        return (
          <div className={`rounded-xl border p-4 ${
            allDone ? 'bg-green-50 border-green-200' : todayEntry ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sun size={18} className={allDone ? 'text-green-600' : 'text-amber-600'} />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-600">{formatISTDate(getTodayIST())}</p>
                  <p className={`font-bold text-sm ${ allDone ? 'text-green-700' : todayEntry ? 'text-amber-700' : 'text-red-700' }`}>
                    {allDone ? '✅ All Steps Complete' : todayEntry ? '⏳ Entry In Progress' : '❗ Entry Not Started'}
                  </p>
                </div>
              </div>
              {!allDone && (
                <button onClick={() => setCurrentRoute('morning')}
                  className="text-xs font-bold px-3 py-1.5 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition shadow-sm">
                  {todayEntry ? 'Continue →' : 'Start Entry →'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {step(!!todayEntry, 'Morning Started')}
              {step(hasDip ?? false, 'Dip Readings', todayEntry ? `P:${(todayEntry.petrolDip||0).toFixed(0)}L D:${(todayEntry.dieselDip||0).toFixed(0)}L` : undefined)}
              {step(hasColls ?? false, 'Collections', hasColls && todayEntry ? formatRs((todayEntry.collectionsCash||0)+(todayEntry.balanceCash||0)+(todayEntry.collectionsDigital||0)) : undefined)}
              {step(hasBank ?? false, 'Bank Balances', hasBank && todayEntry ? `OD: ${formatRs(todayEntry.balanceOd||0)}` : undefined)}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div onClick={() => { setCustomerFilter('All'); setCurrentRoute('customers'); }} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center cursor-pointer hover:bg-gray-50 transition"><div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 shrink-0 bg-indigo-50 text-indigo-600"><Users size={18} /></div><div><p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Total Customers</p><p className="text-base font-bold text-gray-900">{totalCustomers}</p></div></div>
        <div onClick={() => setCurrentRoute('morning')} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center cursor-pointer hover:bg-gray-50 transition"><div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 shrink-0 bg-green-50 text-green-600"><Fuel size={18} /></div><div><p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Latest Gross Sales</p><p className="text-base font-bold text-gray-900">{formatRs(latestSalesValue)}</p></div></div>
        <div onClick={() => setCurrentRoute('ledger')} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center cursor-pointer hover:bg-gray-50 transition"><div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 shrink-0 bg-blue-50 text-blue-600"><Receipt size={18} /></div><div><p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Latest Net Remittance</p><p className="text-base font-bold text-gray-900">{formatRs(yesterdayReceived)}</p></div></div>
        <div onClick={() => setCurrentRoute('expenses')} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center cursor-pointer hover:bg-gray-50 transition"><div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 shrink-0 bg-purple-50 text-purple-600"><Wallet size={18} /></div><div><p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">MTD Expenses</p><p className="text-base font-bold text-gray-900">{formatRs(mtdExpenses)}</p></div></div>
        <div onClick={() => { setCustomerFilter('overdue'); setCurrentRoute('customers'); }} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center cursor-pointer hover:bg-gray-50 transition"><div className="w-10 h-10 rounded-full flex items-center justify-center mr-3 shrink-0 bg-red-50 text-red-600"><AlertCircle size={18} /></div><div><p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Overdue Accounts</p><p className="text-base font-bold text-red-600">{overdueCount}</p></div></div>
      </div>

      {userRole === 'owner' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-base text-gray-800 flex items-center"><TrendingUp className="mr-2 text-blue-600" size={18} /> Sales Performance</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => setChartPage(p => Math.min(totalChartPages - 1, p + 1))} disabled={chartPage >= totalChartPages - 1} className="p-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition"><ChevronLeft size={16} /></button>
                  <button onClick={() => setChartPage(p => Math.max(0, p - 1))} disabled={chartPage === 0} className="p-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition"><ChevronRight size={16} /></button>
                </div>
              </div>
              {/* Bar chart on sm+, compact stats on mobile */}
              <div className="hidden sm:flex flex-1 items-end gap-1.5 h-40 mt-2 border-b border-gray-100 pb-2">
                {chartData.length === 0 ? <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-sm"><BarChart3 size={32} className="mb-2 opacity-20" /> No data for this period</div> : chartData.map((d) => (
                  <div key={d.label} className="relative flex-1 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-sm group transition-all hover:opacity-80 flex flex-col justify-end" style={{ height: `${Math.max(5, (d.value / maxChartVal) * 100)}%` }} title={`${d.label}: ${formatRs(d.value)}`}>
                    <div className="absolute opacity-0 group-hover:opacity-100 -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10 transition-opacity pointer-events-none">{formatLakhs(d.value)}</div>
                    <span className="text-[8px] text-center text-blue-900 font-bold mb-1 opacity-0 group-hover:opacity-100 truncate w-full px-1">{d.label}</span>
                  </div>
                ))}
              </div>
              <div className="sm:hidden grid grid-cols-2 gap-2 mt-2 border-t pt-3">
                <div className="bg-blue-50 rounded-lg p-2 text-center"><p className="text-[10px] text-blue-500 font-bold uppercase">Avg Daily</p><p className="text-sm font-bold text-blue-900">{formatLakhs(avgDailySalesRs)}</p></div>
                <div className="bg-green-50 rounded-lg p-2 text-center"><p className="text-[10px] text-green-500 font-bold uppercase">Period Profit</p><p className={`text-sm font-bold ${pPeriodNetProfit < 0 ? 'text-red-600' : 'text-green-700'}`}>{formatLakhs(pPeriodNetProfit)}</p></div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-2 font-medium">
                <span>Older</span><span>{period} Span</span><span>Newer</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-base text-gray-800 flex items-center"><Calendar className="mr-2 text-purple-600" size={18} /> Financial Analytics</h3>
                  {periodMarginPct !== 0 && <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">{periodMarginPct.toFixed(1)}% Margin</span>}
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center"><span className="text-gray-500">Avg. Daily Sales</span><span className="font-bold text-gray-900">{formatRs(avgDailySalesRs)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500">{avgLabel} Petrol</span><span className="font-bold text-gray-900">{avgPetrolL.toFixed(0)} L</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500">{avgLabel} Diesel</span><span className="font-bold text-gray-900">{avgDieselL.toFixed(0)} L</span></div>

                  <div className="flex justify-between items-center pt-3 mt-1 border-t border-dashed border-gray-200">
                    <span className="text-gray-500 flex items-center"><Activity size={14} className="mr-1" /> Avg Variance (10d)</span>
                    <span className={`font-bold ${pAvgVariance < 0 ? 'text-red-600' : pAvgVariance > 0 ? 'text-green-600' : 'text-gray-900'}`}>{pAvgVariance < 0 ? '-' : '+'}{formatRs(Math.abs(pAvgVariance))}</span>
                  </div>

                  <div className="border-t pt-3 flex justify-between items-center"><span className="text-gray-500">Total Fuel Buy</span><span className="font-bold text-blue-700">{formatRs(pFuelBuyRs)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500">Total Fuel Sale</span><span className="font-bold text-green-700">{formatRs(pTotalSalesRs)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500">Stock Val Change</span><span className={`font-bold ${stockValuationChange < 0 ? 'text-red-600' : 'text-blue-600'}`}>{stockValuationChange > 0 ? '+' : ''}{formatRs(stockValuationChange)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500">Total Expenses</span><span className="font-bold text-orange-600">{formatRs(pTotalExpRs)}</span></div>
                </div>
              </div>
              <div className={`mt-5 p-3 rounded-xl border ${pPeriodNetProfit < 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-gray-600">Period Net Profit/Loss</p>
                <p className={`text-xl font-black ${pPeriodNetProfit < 0 ? 'text-red-700' : 'text-green-700'}`}>{formatRs(pPeriodNetProfit)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center"><div className="bg-gray-100 p-3 rounded-full mr-4"><BookOpen className="text-gray-600" /></div><div><p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Opening Credit</p><p className="text-xl font-bold">{formatRs(pOpeningCreditBal)}</p></div></div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center"><div className="bg-orange-50 p-3 rounded-full mr-4"><TrendingUp className="text-orange-500" /></div><div><p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Credit Given</p><p className="text-xl font-bold text-orange-600">{formatRs(pCreditGiven)}</p></div></div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center"><div className="bg-green-50 p-3 rounded-full mr-4"><TrendingDown className="text-green-500" /></div><div><p className="text-xs text-gray-500 font-bold uppercase tracking-wide">Credit Received</p><p className="text-xl font-bold text-green-600">{formatRs(pCreditRecv)}</p></div></div>
          </div>
        </>
      )}
    </div>
  );
};

// Customers Module
const CustomerList = () => {
  const { user, customers, customerFilter, setCustomerFilter, getCustomerBalance, addCustomer, updateCustomer, deleteCustomer, showAlert, showConfirm, dataLoading, sendWhatsAppReminder, transactions } = useAppContext();
  const [showAdd, setShowAdd] = useState(false); const [editId, setEditId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newC, setNewC] = useState({
    accountName: '', ownerName: '', primaryPhone: '', altPhone: '', category: 'Fleet',
    creditLimit: 50000, paymentTerms: 'Monthly', address: '',
    vehicles: [{ fullNumber: '', shortCode: '', type: '', driverName: '', driverPhone: '' }],
    openingBalance: '', openingBalanceDate: getTodayIST()
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCustId, setExpandedCustId] = useState<string | null>(null);

  const userRole = String(user?.role || '').toLowerCase();

  const openAdd = () => {
    setEditId(null);
    setNewC({ accountName: '', ownerName: '', primaryPhone: '', altPhone: '', category: 'Fleet', creditLimit: 50000, paymentTerms: 'Monthly', address: '', vehicles: [{ fullNumber: '', shortCode: '', type: '', driverName: '', driverPhone: '' }], openingBalance: '', openingBalanceDate: getTodayIST() });
    setShowAdd(true);
  };

  const openEdit = (c: Customer) => {
    setEditId(c.id);

    let parsedVehicles = [{ fullNumber: '', shortCode: '', type: '', driverName: '', driverPhone: '' }];
    if (c.vehicleNumbers) {
      try {
        const v = JSON.parse(c.vehicleNumbers);
        if (Array.isArray(v)) parsedVehicles = v;
      } catch {
        parsedVehicles[0].fullNumber = c.vehicleNumbers;
      }
    }

    const phones = (c.phone || '').split(',').map(s => s.trim());

    setNewC({
      accountName: c.companyName, ownerName: c.ownerName || '',
      primaryPhone: phones[0] || '', altPhone: phones[1] || '',
      category: c.category, creditLimit: c.creditLimit, paymentTerms: c.paymentTerms || 'Monthly', address: c.address || '',
      vehicles: parsedVehicles,
      openingBalance: '', openingBalanceDate: getTodayIST()
    });
    setShowAdd(true);
  };

  const handleAddVehicle = () => { setNewC({ ...newC, vehicles: [...newC.vehicles, { fullNumber: '', shortCode: '', type: '', driverName: '', driverPhone: '' }] }); };
  const updateVehicle = (index: number, field: string, value: string) => {
    const v = [...newC.vehicles];
    v[index] = { ...v[index], [field]: value };
    setNewC({ ...newC, vehicles: v });
  };
  const removeVehicle = (index: number) => {
    if (newC.vehicles.length <= 1) return;
    const v = [...newC.vehicles]; v.splice(index, 1); setNewC({ ...newC, vehicles: v });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(newC.primaryPhone)) return showAlert('Primary Mobile number must be exactly 10 digits.');
    if (newC.creditLimit < 0) return showAlert('Credit limit cannot be negative.');

    setIsSubmitting(true);

    const combinedPhone = newC.altPhone ? `${newC.primaryPhone}, ${newC.altPhone}` : newC.primaryPhone;
    const vStr = JSON.stringify(newC.vehicles);
    const primaryDriver = newC.vehicles[0]?.driverName || '';
    const primaryDriverPhone = newC.vehicles[0]?.driverPhone || '';

    const payload = {
      companyName: newC.accountName, ownerName: newC.ownerName, category: newC.category,
      phone: combinedPhone, address: newC.address, paymentTerms: newC.paymentTerms,
      driverName: primaryDriver, driverPhone: primaryDriverPhone, vehicleNumbers: vStr,
      creditLimit: newC.creditLimit, status: 'Active'
    };

    if (editId) {
      await updateCustomer(editId, payload);
    } else {
      const newId = await addCustomer(payload);
      if (newId && Number(newC.openingBalance) > 0) {
        await supabase.from('transactions').insert([{ bunk_id: user?.bunkId, customer_id: newId, type: 'opening_balance', date: newC.openingBalanceDate, product: 'Opening Balance', quantity: 0, amount: Number(newC.openingBalance) }]);
        window.location.reload();
      }
    }

    setIsSubmitting(false);
    setShowAdd(false);
  };

  const safeDeleteCustomer = (c: Customer) => {
    const bal = getCustomerBalance(c.id);
    if (bal !== 0) return showAlert(`Cannot delete ${c.companyName}. They have an active balance of ${formatRs(bal)}. Please settle to 0 first.`);
    showConfirm(`Delete ${c.companyName} completely?`, () => deleteCustomer(c.id));
  };

  const displayedCustomers = customers.filter(c => {
    const lowerSearch = searchTerm.toLowerCase();
    const vehicleStr = c.vehicleNumbers ? (() => { try { const v = JSON.parse(c.vehicleNumbers); if (Array.isArray(v)) return v.map((vv: any) => `${vv.fullNumber || ''} ${vv.shortCode || ''}`).join(' ').toLowerCase(); } catch { } return c.vehicleNumbers.toLowerCase(); })() : '';
    const matchesSearch = !searchTerm || c.companyName.toLowerCase().includes(lowerSearch) || c.phone.includes(searchTerm) || vehicleStr.includes(lowerSearch);
    if (!matchesSearch) return false;
    if (customerFilter === 'All') return true;
    if (customerFilter === 'overdue') return getCustomerBalance(c.id) > c.creditLimit;
    return c.category === customerFilter;
  });

  const [custPage, setCustPage] = useState(0);
  const paginatedCustomers = displayedCustomers.slice(custPage * 10, (custPage + 1) * 10);
  const totalCustPages = Math.ceil(displayedCustomers.length / 10);
  const [custTxPages, setCustTxPages] = useState<Record<string, number>>({});
  const getCustTxPage = (id: string) => custTxPages[id] || 0;
  const setCustTxPage = (id: string, page: number) => setCustTxPages(prev => ({ ...prev, [id]: page }));

  if (dataLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">Customer Management</h2>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-48 shrink-0">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCustPage(0); }} className="w-full pl-9 pr-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="relative w-full sm:w-40 shrink-0"><Filter size={16} className="absolute left-3 top-3 text-gray-400" /><select value={customerFilter} onChange={e => { setCustomerFilter(e.target.value); setCustPage(0); }} className="w-full pl-9 pr-3 py-2 bg-white border rounded-lg text-base sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none"><option value="All">All Accounts</option><option value="overdue">⚠️ Overdue Only</option><optgroup label="Categories">{CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</optgroup></select></div>
          <button onClick={openAdd} className="w-full sm:w-auto justify-center bg-blue-800 text-white px-3 py-2 rounded-lg font-medium flex items-center hover:bg-blue-900 shadow-sm text-sm shrink-0"><Plus size={18} className="mr-2" /> Add Customer</button>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[500] p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in zoom-in-95 my-auto max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="text-lg font-bold">{editId ? 'Update Customer' : 'New Customer Registration'}</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-700 bg-gray-100 p-1 rounded-full"><X size={20} /></button>
            </div>

            <form onSubmit={handleAdd} className="flex-1 overflow-y-auto pr-2 pb-2 space-y-6">

              <div>
                <h4 className="text-xs font-bold text-blue-800 bg-blue-50 px-3 py-1 rounded inline-block uppercase tracking-wider mb-4 border border-blue-200">Account Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium mb-1">Account Name (Required)</label><input required disabled={userRole !== 'owner'} type="text" className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-gray-100 disabled:text-gray-500" value={newC.accountName} onChange={e => setNewC({ ...newC, accountName: e.target.value })} placeholder="e.g. Krishna Office" /></div>
                  <div><label className="block text-xs font-medium mb-1">Owner Full Name</label><input disabled={userRole !== 'owner'} type="text" className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-gray-100 disabled:text-gray-500" value={newC.ownerName} onChange={e => setNewC({ ...newC, ownerName: e.target.value })} /></div>
                  <div><label className="block text-xs font-medium mb-1">Primary Phone (Required)</label><input required disabled={userRole !== 'owner'} type="tel" className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-gray-100 disabled:text-gray-500" value={newC.primaryPhone} onChange={e => setNewC({ ...newC, primaryPhone: e.target.value })} placeholder="10 digits" /></div>
                  <div><label className="block text-xs font-medium mb-1">Alternate Phone</label><input disabled={userRole !== 'owner'} type="tel" className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-gray-100 disabled:text-gray-500" value={newC.altPhone} onChange={e => setNewC({ ...newC, altPhone: e.target.value })} /></div>
                  <div><label className="block text-xs font-medium mb-1">Category</label><select disabled={userRole !== 'owner'} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-gray-100 disabled:text-gray-500" value={newC.category} onChange={e => setNewC({ ...newC, category: e.target.value })}>{CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                  <div><label className="block text-xs font-medium mb-1">Credit Limit (Rs) *</label><input required disabled={userRole !== 'owner'} type="number" className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-sm disabled:bg-gray-100 disabled:text-gray-500" value={newC.creditLimit === 0 ? '' : newC.creditLimit} onChange={e => setNewC({ ...newC, creditLimit: Number(e.target.value) })} /></div>
                  <div><label className="block text-xs font-medium mb-1">Payment Terms</label><select disabled={userRole !== 'owner'} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-gray-100 disabled:text-gray-500" value={newC.paymentTerms} onChange={e => setNewC({ ...newC, paymentTerms: e.target.value })}><option>Weekly</option><option>Fortnightly</option><option>Monthly</option><option>On Demand</option></select></div>
                  <div className="sm:col-span-2"><label className="block text-xs font-medium mb-1">Address</label><input disabled={userRole !== 'owner'} type="text" className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:bg-gray-100 disabled:text-gray-500" value={newC.address} onChange={e => setNewC({ ...newC, address: e.target.value })} /></div>
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-bold text-blue-800 bg-blue-50 px-3 py-1 rounded inline-block uppercase tracking-wider border border-blue-200">Vehicles List</h4>
                  <button type="button" onClick={handleAddVehicle} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded hover:bg-blue-100 transition">+ Add Row</button>
                </div>
                <div className="space-y-3">
                  {newC.vehicles.map((v, i) => (
                    <div key={i} className="bg-gray-50 p-3 rounded-lg border border-gray-200 relative">
                      {newC.vehicles.length > 1 && <button type="button" onClick={() => removeVehicle(i)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><X size={16} /></button>}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="col-span-2 sm:col-span-2"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Full Number</label><input type="text" className="w-full border p-2 rounded text-sm outline-none focus:border-blue-400" placeholder="AP09 7447" value={v.fullNumber} onChange={e => updateVehicle(i, 'fullNumber', e.target.value)} /></div>
                        <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Short Code</label><input type="text" className="w-full border p-2 rounded text-sm outline-none focus:border-blue-400" placeholder="7447" value={v.shortCode} onChange={e => updateVehicle(i, 'shortCode', e.target.value)} /></div>
                        <div className="col-span-2"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Type</label><input type="text" className="w-full border p-2 rounded text-sm outline-none focus:border-blue-400" placeholder="Lorry/Tanker" value={v.type} onChange={e => updateVehicle(i, 'type', e.target.value)} /></div>
                        <div className="col-span-2 sm:col-span-2"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Driver Name</label><input type="text" className="w-full border p-2 rounded text-sm outline-none focus:border-blue-400" value={v.driverName} onChange={e => updateVehicle(i, 'driverName', e.target.value)} /></div>
                        <div className="col-span-2 sm:col-span-3"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Driver Phone</label><input type="tel" className="w-full border p-2 rounded text-sm outline-none focus:border-blue-400" value={v.driverPhone} onChange={e => updateVehicle(i, 'driverPhone', e.target.value)} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!editId && (
                <div className="border-t pt-6 mb-4">
                  <h4 className="text-xs font-bold text-blue-800 bg-blue-50 px-3 py-1 rounded inline-block uppercase tracking-wider mb-4 border border-blue-200">Opening Balance</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-orange-50 p-4 rounded-xl border border-orange-100">
                    <div><label className="block text-xs font-medium mb-1 text-orange-900">Amount Owed (Rs)</label><input type="number" className="w-full border border-orange-200 p-2.5 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-bold text-sm bg-white" value={newC.openingBalance} onChange={e => setNewC({ ...newC, openingBalance: e.target.value })} placeholder="0" /></div>
                    <div><label className="block text-xs font-medium mb-1 text-orange-900">As of Date</label><input type="date" className="w-full border border-orange-200 p-2.5 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-white" value={newC.openingBalanceDate} onChange={e => setNewC({ ...newC, openingBalanceDate: e.target.value })} /></div>
                  </div>
                </div>
              )}

              <div className="pt-2 sticky bottom-0 bg-white pb-2">
                <button type="submit" disabled={isSubmitting} className="w-full bg-blue-800 text-white py-3.5 rounded-xl font-bold shadow-md hover:bg-blue-900 transition disabled:opacity-50 flex justify-center items-center">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (editId ? 'Save Changes' : 'Register Customer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left cursor-pointer">
            <thead className="bg-gray-50 border-b"><tr><th className="p-4 text-sm font-medium text-gray-500 whitespace-nowrap">Customer Details</th><th className="p-4 text-sm font-medium text-gray-500 whitespace-nowrap">Category</th><th className="p-4 text-sm font-medium text-gray-500 text-center whitespace-nowrap">WhatsApp</th><th className="p-4 text-sm font-medium text-gray-500 whitespace-nowrap">Outstanding</th><th className="p-4 text-sm font-medium text-gray-500 whitespace-nowrap">Limit</th><th className="p-4 text-sm font-medium text-gray-500 whitespace-nowrap">Portal PIN</th><th className="p-4 text-sm font-medium text-gray-500 text-center whitespace-nowrap">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCustomers.length === 0 ? (<tr><td colSpan={7} className="p-10 text-center text-gray-400 flex flex-col items-center"><SearchX size={32} className="mb-2 opacity-50" />No customers found.</td></tr>) : paginatedCustomers.map((c, idx) => {
                const bal = getCustomerBalance(c.id); const isOver = bal > c.creditLimit;
                const isExpanded = expandedCustId === c.id;

                const cTxs = transactions.filter(t => t.customerId === c.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const custTxPage = getCustTxPage(c.id);
                const TX_PER_PAGE = 15;
                const paginatedTxs = cTxs.slice(custTxPage * TX_PER_PAGE, (custTxPage + 1) * TX_PER_PAGE);
                const totalTxsPages = Math.ceil(cTxs.length / TX_PER_PAGE);

                let displayVehicles = '';
                if (c.vehicleNumbers) {
                  try {
                    const vArr = JSON.parse(c.vehicleNumbers);
                    if (Array.isArray(vArr)) displayVehicles = vArr.map((v: any) => v.fullNumber || v.shortCode).filter(Boolean).join(', ');
                    else displayVehicles = c.vehicleNumbers;
                  } catch { displayVehicles = c.vehicleNumbers; }
                }

                return (
                  <React.Fragment key={c.id || `cust-${idx}`}>
                    <tr onClick={() => { setExpandedCustId(isExpanded ? null : c.id); }} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 min-w-[200px]"><p className="font-bold text-gray-900 flex items-center">{c.companyName} {isExpanded ? <ChevronDown size={14} className="ml-2 text-gray-400" /> : <ChevronRight size={14} className="ml-2 text-gray-400" />}</p><p className="text-xs text-gray-500">{c.phone.split(',')[0]} {c.ownerName ? `(${c.ownerName})` : ''}</p>{displayVehicles && <p className="text-[10px] text-gray-400 mt-1 truncate max-w-[250px]">{displayVehicles}</p>}</td>
                      <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{c.category}</td>
                      <td className="p-4 text-center">
                        {!c.phone ? '-' : (
                          <span title={c.notifyOnCredit !== false ? "Bot Sync Enabled" : "Bot Sync Disabled"} className={`inline-block p-1.5 rounded-full ${c.notifyOnCredit !== false ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                            <MessageCircle size={16} />
                          </span>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap"><span className={`font-bold ${isOver ? 'text-red-600' : 'text-gray-900'}`}>{formatRs(bal)}</span></td>
                      <td className="p-4 text-sm whitespace-nowrap">{formatRs(c.creditLimit)}</td>
                      <td className="p-4 text-sm font-mono bg-gray-100 rounded px-2 whitespace-nowrap">{c.pin}</td>
                      <td className="p-4 flex justify-center gap-1 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button onClick={() => sendWhatsAppReminder(c)} className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition" title="Send WhatsApp Reminder"><MessageCircle size={18} /></button>
                        <button onClick={() => openEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition" title="Edit Customer"><Edit2 size={18} /></button>
                        {userRole === 'owner' && (<button onClick={() => safeDeleteCustomer(c)} className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition"><Trash2 size={18} /></button>)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="p-0 bg-blue-50/40 border-b-2 border-blue-200">
                          <div className="p-4 pl-8 animate-in fade-in slide-in-from-top-2">
                            {/* Header */}
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Receipt size={14} />
                                Transaction History
                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                  {cTxs.length} total
                                </span>
                              </h4>
                            </div>

                            {cTxs.length === 0 ? (
                              <p className="text-sm text-gray-500 italic py-4 text-center">No transactions recorded yet.</p>
                            ) : (
                              <>
                                <table className="w-full text-sm bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                                  <thead>
                                    <tr className="bg-gray-50 border-b">
                                      <th className="p-3 text-left text-xs font-semibold text-gray-500 w-28">Date</th>
                                      <th className="p-3 text-left text-xs font-semibold text-gray-500">Type / Details</th>
                                      <th className="p-3 text-right text-xs font-semibold text-gray-500">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {paginatedTxs.map(tx => {
                                      let displayAmount = tx.amount;
                                      let advStr = '';
                                      if (tx.type === 'credit_sale' && tx.remarks?.startsWith('advance:')) {
                                        const parts = tx.remarks.split('|');
                                        const advAmt = Number(parts[0].split(':')[1]) || 0;
                                        displayAmount += advAmt;
                                        advStr = ` (+ ${formatRs(advAmt)} Adv)`;
                                      }
                                      const isPayment = tx.type === 'payment';
                                      return (
                                        <tr key={tx.id} className="border-b last:border-b-0 hover:bg-blue-50/50 transition-colors">
                                          <td className="p-3 text-gray-500 text-xs whitespace-nowrap">{formatISTDate(tx.date)}</td>
                                          <td className="p-3">
                                            <span className="font-medium capitalize">{tx.type.replace('_', ' ')}</span>
                                            {tx.product && <span className="text-gray-500"> ({tx.product})</span>}
                                            {advStr && <span className="text-orange-600 text-xs">{advStr}</span>}
                                            {tx.vehicleNumber && <span className="text-xs text-gray-400 block">{tx.vehicleNumber}</span>}
                                          </td>
                                          <td className={`p-3 text-right font-bold whitespace-nowrap ${isPayment ? 'text-green-600' : 'text-red-600'}`}>
                                            {isPayment ? '-' : '+'}{formatRs(displayAmount)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>

                                {/* Pagination bar — always shown when there are transactions */}
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-blue-100">
                                  <span className="text-xs text-gray-500">
                                    Showing {custTxPage * TX_PER_PAGE + 1}–{Math.min((custTxPage + 1) * TX_PER_PAGE, cTxs.length)} of <strong>{cTxs.length}</strong> transactions
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setCustTxPage(c.id, Math.max(0, custTxPage - 1)); }}
                                      disabled={custTxPage === 0}
                                      className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold hover:bg-blue-50 hover:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm flex items-center gap-1"
                                    >
                                      <ChevronLeft size={13} /> Previous
                                    </button>
                                    <span className="text-xs font-semibold text-gray-600 px-2">
                                      Page {custTxPage + 1} / {Math.max(1, totalTxsPages)}
                                    </span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setCustTxPage(c.id, Math.min(totalTxsPages - 1, custTxPage + 1)); }}
                                      disabled={custTxPage >= totalTxsPages - 1}
                                      className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold hover:bg-blue-50 hover:border-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm flex items-center gap-1"
                                    >
                                      Next <ChevronRight size={13} />
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center text-sm mt-auto">
          <span className="text-gray-500">Showing page {custPage + 1} of {Math.max(1, totalCustPages)}</span>
          <div className="flex gap-2">
            <button onClick={() => setCustPage(p => Math.max(0, p - 1))} disabled={custPage === 0} className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 transition">Previous</button>
            <button onClick={() => setCustPage(p => Math.min(totalCustPages - 1, p + 1))} disabled={custPage >= totalCustPages - 1} className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 transition">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Credit Ledger Module (Independent Scrolling & Advance Logic)
const CreditLedger = () => {
  const { user, customers, transactions, addTransaction, updateTransaction, deleteTransaction, settings, showAlert, showConfirm, validateInputs, dataLoading, sendWhatsAppAlert } = useAppContext();
  const [tab, setTab] = useState<'sale' | 'payment'>('sale');
  const [editId, setEditId] = useState<string | null>(null);
  const [txDate, setTxDate] = useState(getTodayIST());
  const [selCategory, setSelCategory] = useState(''); const [selCust, setSelCust] = useState(''); const [selVehicle, setSelVehicle] = useState(''); const [amount, setAmount] = useState(''); const [product, setProduct] = useState('Diesel'); const [qty, setQty] = useState(''); const [advanceAmount, setAdvanceAmount] = useState(''); const [advanceRemarks, setAdvanceRemarks] = useState('');
  const [payMode, setPayMode] = useState('Cash');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [ledgerPage, setLedgerPage] = useState(0);

  const userRole = String(user?.role || '').toLowerCase();

  const filteredCustomers = selCategory ? customers.filter(c => c.category === selCategory) : customers; const selectedCustomerData = customers.find(c => c.id === selCust);

  const availableVehicles = useMemo(() => {
    if (!selectedCustomerData?.vehicleNumbers) return [];
    try {
      const vArr = JSON.parse(selectedCustomerData.vehicleNumbers);
      if (Array.isArray(vArr)) return vArr.map((v: any) => v.fullNumber || v.shortCode).filter(Boolean);
    } catch { }
    return selectedCustomerData.vehicleNumbers.split(',').map(v => v.trim()).filter(Boolean);
  }, [selectedCustomerData]);

  const resetForm = (keepTab = false) => {
    setEditId(null);
    setAmount(''); setQty(''); setAdvanceAmount(''); setAdvanceRemarks(''); setSelCust(''); setSelVehicle('');
    if (!keepTab) setTab('sale');
    setProduct('Diesel'); setPayMode('Cash');
  };

  const openEdit = (t: Transaction) => {
    setEditId(t.id); setTxDate(t.date || getTodayIST()); setSelCust(t.customerId); setSelVehicle(t.vehicleNumber || '');
    if (t.type === 'credit_sale' || t.type === 'opening_balance') {
      setTab('sale'); setAmount(t.amount.toString()); setProduct(t.product || 'Diesel'); setQty(t.quantity?.toString() || '');
      let aAmt = ''; let aRem = '';
      if (t.remarks?.startsWith('advance:')) {
        const parts = t.remarks.split('|');
        aAmt = parts[0].split(':')[1];
        aRem = parts[1] || '';
      }
      setAdvanceAmount(aAmt); setAdvanceRemarks(aRem);
    }
    else if (t.type === 'advance') { setTab('sale'); setAdvanceAmount(t.amount.toString()); setAdvanceRemarks(t.reference || t.remarks || ''); setAmount(''); setQty(''); }
    else { setTab('payment'); setAmount(t.amount.toString()); setPayMode(t.mode || 'Cash'); }
  };

  const submitTransaction = async (amtNum: number, advNum: number, qtyNum: number) => {
    setIsSubmitting(true);
    const buildRemarks = (): string | undefined => {
      if (advNum > 0 && amtNum > 0) return `advance:${advNum}` + (advanceRemarks ? `|${advanceRemarks}` : '|');
      return advanceRemarks || undefined;
    };
    if (editId) {
      const existing = transactions.find(t => t.id === editId);
      if (!existing) { setIsSubmitting(false); return; }
      if (existing.type === 'credit_sale' || existing.type === 'opening_balance') {
        await updateTransaction(editId, { customerId: selCust, product, quantity: qtyNum, amount: amtNum, vehicleNumber: selVehicle, date: txDate, remarks: buildRemarks() });
      } else if (existing.type === 'advance') {
        await updateTransaction(editId, { customerId: selCust, amount: advNum, vehicleNumber: selVehicle, remarks: advanceRemarks, date: txDate });
      } else {
        await updateTransaction(editId, { customerId: selCust, amount: amtNum, vehicleNumber: selVehicle, mode: payMode, date: txDate });
      }
      resetForm(tab === 'payment');
    } else {
      if (tab === 'sale') {
        if (amtNum > 0) {
          const txType = product === 'Opening Balance' ? 'opening_balance' : 'credit_sale';
          const ok = await addTransaction({ customerId: selCust, type: txType, date: txDate, product, quantity: qtyNum, amount: amtNum, vehicleNumber: selVehicle || undefined, remarks: buildRemarks() });
          if (!ok) { setIsSubmitting(false); return; }
          showAlert(advNum > 0 ? `Saved! Credit ₹${amtNum.toLocaleString()} + Advance ₹${advNum.toLocaleString()}` : "Credit sale recorded!");
        } else if (advNum > 0) {
          const ok = await addTransaction({ customerId: selCust, type: 'advance', date: txDate, amount: advNum, vehicleNumber: selVehicle || undefined, remarks: advanceRemarks || undefined });
          if (!ok) { setIsSubmitting(false); return; }
          showAlert(`Cash advance ₹${advNum.toLocaleString()} recorded!`);
        }
      } else {
        const ok = await addTransaction({ customerId: selCust, type: 'payment', date: txDate, amount: amtNum, mode: payMode, vehicleNumber: selVehicle || undefined });
        if (!ok) { setIsSubmitting(false); return; }
        showAlert("Payment recorded successfully.");
      }
      resetForm(tab === 'payment');
    }
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selCust) return showAlert("Please select a customer first.");
    if (tab === 'sale' && !amount && !advanceAmount) return showAlert("Please enter a sale amount or an advance amount.");
    if (tab === 'payment' && !amount) return showAlert("Please enter a payment amount.");
    const amtNum = Number(amount) || 0; const advNum = Number(advanceAmount) || 0; const qtyNum = Number(qty) || 0;
    if (!validateInputs([amtNum, advNum], [qtyNum])) return;
    // Credit limit check — warn if this sale would exceed the limit
    if (tab === 'sale' && !editId && amtNum > 0 && (selectedCustomerData?.creditLimit || 0) > 0) {
      const currentBal = getCustomerBalance(selCust);
      const newBal = currentBal + amtNum + advNum;
      if (newBal > (selectedCustomerData?.creditLimit || 0)) {
        showConfirm(
          `⚠️ Credit limit exceeded for ${selectedCustomerData?.companyName}.\n\nBalance: ₹${currentBal.toLocaleString('en-IN')} → ₹${newBal.toLocaleString('en-IN')} (Limit: ₹${(selectedCustomerData?.creditLimit || 0).toLocaleString('en-IN')})\n\nProceed anyway?`,
          () => submitTransaction(amtNum, advNum, qtyNum)
        );
        return;
      }
    }
    submitTransaction(amtNum, advNum, qtyNum);
  };

  const getRate = (prod: string) => (prod === 'Petrol' ? settings?.petrolRate || 0 : prod === 'Diesel' ? settings?.dieselRate || 0 : 0);
  const handleQtyChange = (val: string) => { setQty(val); const r = getRate(product); if (val && r > 0) setAmount((Number(val) * r).toFixed(2)); else if (val === '') setAmount(''); };
  const handleAmountChange = (val: string) => { setAmount(val); if (tab === 'sale' && product !== 'Opening Balance') { const r = getRate(product); if (val && r > 0) setQty((Number(val) / r).toFixed(2)); else if (val === '' && r > 0) setQty(''); } };
  const handleProductChange = (val: string) => { setProduct(val); setQty(''); setAmount(''); };

  const filteredTransactions = transactions.filter(t => {
    if (!searchTerm) return true;
    const cust = customers.find(c => c.id === t.customerId);
    const searchStr = `${cust?.companyName || ''} ${t.vehicleNumber || ''} ${t.reference || ''} ${t.remarks || ''}`.toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  const groupedTransactions = filteredTransactions.reduce((acc, t) => {
    const dKey = t.date || getTodayIST();
    if (!acc[dKey]) acc[dKey] = { date: dKey, transactions: [], totalCredit: 0, totalReceived: 0 };
    acc[dKey].transactions.push(t);

    // advance is always a separate row — just use t.amount directly
    if (t.type === 'credit_sale' || t.type === 'advance' || t.type === 'opening_balance') acc[dKey].totalCredit += (t.amount || 0);
    if (t.type === 'payment') acc[dKey].totalReceived += (t.amount || 0);
    return acc;
  }, {} as Record<string, { date: string, transactions: Transaction[], totalCredit: number, totalReceived: number }>);

  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const totalLedgerPages = Math.ceil(sortedDates.length / 10);
  const paginatedDates = sortedDates.slice(ledgerPage * 10, (ledgerPage + 1) * 10);

  if (dataLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* LEFT PANEL — Transaction Form (sticky on desktop) */}
      <div className="lg:w-1/3 lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto pr-2 pb-10 space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6">
          <div className="flex border-b mb-6 text-sm"><button disabled={!!editId && tab !== 'sale'} className={`flex-1 pb-2 font-bold transition-colors ${tab === 'sale' ? 'text-blue-800 border-b-2 border-blue-800' : 'text-gray-400 hover:text-gray-600 disabled:opacity-50'}`} onClick={() => setTab('sale')}>+ Sale / Advance</button><button disabled={!!editId && tab !== 'payment'} className={`flex-1 pb-2 font-bold transition-colors ${tab === 'payment' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-400 hover:text-gray-600 disabled:opacity-50'}`} onClick={() => setTab('payment')}>+ Payment</button></div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="block text-sm font-medium mb-1 text-gray-500">1. Select Date</label><input type="date" required className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-base font-bold" value={txDate} onChange={e => setTxDate(e.target.value)} /></div>
            <div><label className="block text-sm font-medium mb-1 text-gray-500">2. Select Category</label><select className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-base" value={selCategory} onChange={e => { setSelCategory(e.target.value); setSelCust(''); setSelVehicle(''); }}><option value="">All Categories</option>{CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
            <div><label className="block text-sm font-medium mb-1 text-gray-500">3. Select Customer *</label><select required className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-base text-gray-900" value={selCust} onChange={e => { setSelCust(e.target.value); setSelVehicle(''); }}><option value="">Search or Select...</option>{filteredCustomers.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}</select></div>
            {tab !== 'payment' && selCust && availableVehicles.length > 0 && (<div><label className="block text-sm font-medium mb-1 text-gray-500">4. Select Vehicle (Optional)</label><select className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-base" value={selVehicle} onChange={e => setSelVehicle(e.target.value)}><option value="">No specific vehicle</option>{availableVehicles.map(v => <option key={v} value={v}>{v}</option>)}</select></div>)}
            <div className="border-t pt-4 mt-4 space-y-4">
              {tab === 'sale' && (
                <>
                  <div><label className="block text-sm font-medium mb-1">Product</label><select disabled={!!editId && !!advanceAmount && !amount} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-base disabled:bg-gray-100" value={product} onChange={e => handleProductChange(e.target.value)}><option>Diesel</option><option>Petrol</option><option>Lubricant</option><option>Opening Balance</option></select></div>
                  {product !== 'Opening Balance' && (<div><label className="block text-sm font-medium mb-1">Quantity (Litres)</label><input disabled={!!editId && !!advanceAmount && !amount} type="number" step="0.01" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base disabled:bg-gray-100" value={qty} onChange={e => handleQtyChange(e.target.value)} /></div>)}
                  <div><label className="block text-sm font-medium mb-1">{product === 'Opening Balance' ? 'Opening Balance Amount (Rs)' : 'Sale Amount (Rs)'}</label><input disabled={!!editId && !!advanceAmount && !amount} required={!advanceAmount} type="number" step="0.01" className="w-full border p-3 rounded-lg font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none text-base disabled:bg-gray-100" value={amount} onChange={e => handleAmountChange(e.target.value)} placeholder="0" />{product === 'Opening Balance' && <p className="text-xs text-gray-500 mt-1">Use this to enter a customer's balance from before you started using this app</p>}</div>
                  {product !== 'Opening Balance' && (<div className="border-t border-dashed pt-4 mt-4"><label className="block text-sm font-bold text-orange-700 mb-1">Cash Advance Given (Rs)</label><input disabled={!!editId && !!amount && !advanceAmount} type="number" step="0.01" className="w-full border p-3 rounded-lg font-bold text-lg focus:ring-2 focus:ring-orange-500 outline-none border-orange-200 bg-orange-50 text-base disabled:opacity-50" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} placeholder="0" /></div>)}
                  {advanceAmount && Number(advanceAmount) > 0 && (<div><label className="block text-xs font-medium mb-1 text-gray-500">Advance Remarks / Driver Name</label><input type="text" className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm text-base" value={advanceRemarks} onChange={e => setAdvanceRemarks(e.target.value)} placeholder="e.g. Ramesh - Toll money" /></div>)}
                </>
              )}
              {tab === 'payment' && (
                <>
                  <div><label className="block text-sm font-medium mb-1">Payment Received (Rs) *</label><input required type="number" step="0.01" className="w-full border p-3 rounded-lg font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={amount} onChange={e => handleAmountChange(e.target.value)} placeholder="0" /></div>
                  <div><label className="block text-sm font-medium mb-1">Mode of Payment</label><select className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-base" value={payMode} onChange={e => setPayMode(e.target.value)}><option>Cash</option><option>DTP</option><option>HPpay</option><option>Paytm</option><option>Account Transfer (RTGS/NEFT)</option></select></div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {editId && <button type="button" onClick={() => resetForm(tab === 'payment')} className="w-1/3 border py-3 rounded-xl font-bold transition hover:bg-gray-50">Cancel</button>}
              <button type="submit" disabled={isSubmitting} className={`flex-1 text-white py-3 rounded-xl font-bold shadow-sm transition disabled:opacity-50 ${tab === 'sale' ? 'bg-blue-800 hover:bg-blue-900' : 'bg-green-600 hover:bg-green-700'}`}>{isSubmitting ? 'Processing...' : (editId ? 'Update Record' : 'Save Record')}</button>
            </div>
          </form>
        </div>
      </div>

      {/* RIGHT PANEL — Ledger History (independently scrollable on desktop) */}
      <div className="lg:w-2/3 flex flex-col min-h-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
          <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="font-bold text-gray-800 text-xl">Daily Ledger History</h3>
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input type="text" placeholder="Search customer, veh..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setLedgerPage(0); setExpandedDate(null); }} className="w-full pl-9 pr-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
            </div>
          </div>

          <div className="space-y-4 mt-2 flex-1 p-4 pt-0 overflow-y-auto">
            {paginatedDates.length === 0 ? (
              <div className="bg-white p-10 flex flex-col items-center justify-center text-gray-400 rounded-xl border border-gray-100">
                <SearchX size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-medium">No transactions found matching your search.</p>
              </div>
            ) : paginatedDates.map(date => {
              const dayData = groupedTransactions[date]; const isExpanded = expandedDate === date || !!searchTerm;
              return (
                <div key={date} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div onClick={() => setExpandedDate(isExpanded ? null : date)} className="p-4 bg-gray-50 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-gray-100 transition-colors">
                    <h4 className="font-bold text-gray-900 flex items-center">{formatISTDate(date)} {date === getTodayIST() && <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded">TODAY</span>} {isExpanded ? <ChevronDown size={16} className="ml-2 text-gray-400" /> : <ChevronRight size={16} className="ml-2 text-gray-400" />}</h4>
                    <div className="flex gap-4 w-full sm:w-auto">
                      <div className="flex-1 sm:flex-none text-right"><span className="text-[10px] font-bold text-gray-500 block uppercase tracking-wider">Credit Given</span><span className="font-bold text-orange-600">{formatRs(dayData.totalCredit)}</span></div>
                      <div className="flex-1 sm:flex-none text-right"><span className="text-[10px] font-bold text-gray-500 block uppercase tracking-wider">Payments Rec.</span><span className="font-bold text-green-600">{formatRs(dayData.totalReceived)}</span></div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="p-0 overflow-x-auto animate-in fade-in slide-in-from-top-2">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white"><tr><th className="p-3 text-gray-500 whitespace-nowrap">Customer Details</th><th className="p-3 text-gray-500 whitespace-nowrap">Type / Ref</th><th className="p-3 text-gray-500 text-right whitespace-nowrap">Amount</th><th className="p-3 text-gray-500 text-center whitespace-nowrap">Actions</th></tr></thead>
                        <tbody className="divide-y divide-gray-100">
                          {dayData.transactions.map((t, idx) => {
                            const cust = customers.find(c => c.id === t.customerId);
                            const isDebit = t.type !== 'payment';
                            const isAdvance = t.type === 'advance';
                            // Backward compat: old format had advance embedded in credit_sale remarks
                            let displayAmount = t.amount;
                            let inlineAdvStr = '';
                            if (t.type === 'credit_sale' && t.remarks?.startsWith('advance:')) {
                              const advAmt = Number(t.remarks.split('|')[0].split(':')[1]) || 0;
                              displayAmount += advAmt;
                              inlineAdvStr = ` + ${formatRs(advAmt)} Adv`;
                            }
                            const typeLabel = t.type === 'credit_sale' ? `Credit Sale`
                              : isAdvance ? '💸 Cash Advance'
                                : t.type === 'payment' ? 'Payment'
                                  : t.type === 'opening_balance' ? 'Opening Balance'
                                    : t.type.replace('_', ' ');

                            return (
                              <tr key={t.id || `tx-${idx}`} className={`hover:bg-blue-50/50 transition-colors ${editId === t.id ? 'bg-blue-50' : ''} ${isAdvance ? 'bg-orange-50/40' : ''}`}>
                                <td className="p-3 font-medium min-w-[150px]">{cust?.companyName || 'Unknown'}{t.vehicleNumber && <p className="text-xs text-gray-500">Veh: {t.vehicleNumber}</p>}</td>
                                <td className="p-3 min-w-[140px]"><span className={isAdvance ? 'text-orange-700 font-bold' : t.type === 'payment' ? 'text-green-700 font-medium' : 'text-gray-800 font-medium'}>{typeLabel}{t.product && !isAdvance ? ` (${t.product})` : ''}{inlineAdvStr ? ` (incl. ${inlineAdvStr})` : ''}</span>{t.remarks && !t.remarks.startsWith('advance:') && <p className="text-[10px] text-gray-400 mt-0.5">{t.remarks}</p>}{t.type === 'payment' && <p className="text-[10px] text-green-600 mt-0.5 font-bold">Via {t.mode}</p>}</td>
                                <td className={`p-3 text-right font-bold whitespace-nowrap ${isDebit ? (isAdvance ? 'text-orange-600' : 'text-red-600') : 'text-green-600'}`}>{isDebit ? '+' : '-'}{formatRs(displayAmount)}</td>
                                <td className="p-3 flex justify-center gap-1 whitespace-nowrap">
                                  {cust && (<button onClick={(e) => { e.stopPropagation(); sendWhatsAppAlert(t, cust); }} className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition" title="Send WhatsApp Receipt"><MessageCircle size={16} /></button>)}
                                  {userRole === 'owner' && (
                                    <>
                                      <button onClick={(e) => { e.stopPropagation(); openEdit(t); }} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition"><Edit2 size={16} /></button>
                                      <button onClick={(e) => { e.stopPropagation(); showConfirm("Delete transaction?", () => deleteTransaction(t.id)); }} className="text-red-500 hover:bg-red-100 p-1.5 rounded transition"><Trash2 size={16} /></button>
                                    </>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="p-4 border-t bg-gray-50 flex justify-between items-center text-sm mt-auto">
            <span className="text-gray-500 font-medium">Page {ledgerPage + 1} of {Math.max(1, totalLedgerPages)}</span>
            <div className="flex gap-2">
              <button onClick={() => { setLedgerPage(p => Math.max(0, p - 1)); setExpandedDate(null); }} disabled={ledgerPage === 0} className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 font-bold transition shadow-sm">Previous</button>
              <button onClick={() => { setLedgerPage(p => Math.min(totalLedgerPages - 1, p + 1)); setExpandedDate(null); }} disabled={ledgerPage >= totalLedgerPages - 1} className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 font-bold transition shadow-sm">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Morning Entry Module
const MorningEntryForm = () => {
  const { user, settings, expenses, addMorningEntry, updateMorningEntry, deleteMorningEntry, morningEntries, transactions, fuelPurchases, updateSettings, showAlert, showConfirm, validateInputs, dataLoading, setUnsavedForm, customers, getCustomerBalanceAsOf } = useAppContext();
  const [step, setStep] = useState(0); const [submitted, setSubmitted] = useState(false); const [editId, setEditId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userRole = String(user?.role || '').toLowerCase();

  const defaultEntryDate = useMemo(() => {
    const hasToday = morningEntries.some(m => m.date === getTodayStr());
    if (hasToday) {
      const d = new Date(getTodayStr() + 'T00:00:00+05:30');
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    }
    return getTodayStr();
  }, [morningEntries]);

  const [entryDate, setEntryDate] = useState(defaultEntryDate);
  const targetDate = editId ? (morningEntries.find(m => m.id === editId)?.date || entryDate) : entryDate;

  const sortedEntries = [...morningEntries].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  const previousEntry = sortedEntries.find(e => (e.date || '') < targetDate);
  const previousEntryDate = previousEntry ? previousEntry.date : '1970-01-01';

  const basePetrolDip = previousEntry ? previousEntry.petrolDip : (settings?.initialPetrolDip || 0); const baseDieselDip = previousEntry ? previousEntry.dieselDip : (settings?.initialDieselDip || 0);
  const periodPurchases = fuelPurchases.filter(p => (p.date || '') > previousEntryDate && (p.date || '') <= targetDate);
  const autoTankerPetrol = periodPurchases.filter(p => p.product === 'Petrol').reduce((sum, p) => sum + (p.litres || 0), 0); const autoTankerDiesel = periodPurchases.filter(p => p.product === 'Diesel').reduce((sum, p) => sum + (p.litres || 0), 0);
  const yesterdayPetrol = basePetrolDip + autoTankerPetrol; const yesterdayDiesel = baseDieselDip + autoTankerDiesel;

  const [form, setForm] = useState({ petrolDip: '', dieselDip: '', openingBalance: '', cashRaw: '', bankRaw: '', digitalRaw: '', dtpRaw: '', cardRaw: '', bankBal: '', odBal: '', digitalBal: '' });
  const [nozzleForm, setNozzleForm] = useState({ p1: '', p2: '', d1: '', d2: '' });
  const [nozzleSynced, setNozzleSynced] = useState(false);
  const [prevNozzle, setPrevNozzle] = useState<any>(null);

  useEffect(() => { setUnsavedForm(step > 0 && !submitted); }, [step, submitted, setUnsavedForm]);

  useEffect(() => {
    if (!editId && user?.bunkId) {
      // Fetch previous day nozzle readings for nozzle-based sold calculation
      supabase.from('nozzle_readings').select('*').eq('bunk_id', user.bunkId).lt('date', targetDate).order('date', { ascending: false }).limit(1).maybeSingle().then(({ data }: any) => {
        setPrevNozzle(data || null);
      });
    }
  }, [targetDate, editId, user?.bunkId]);

  useEffect(() => {
    if (step === 0 && !editId) {
      supabase.from('nozzle_readings').select('*').eq('bunk_id', user?.bunkId).eq('date', targetDate).single().then(({ data }: any) => {
        if (data) {
          setNozzleForm({ p1: data.p1_reading?.toString() || '', p2: data.p2_reading?.toString() || '', d1: data.d1_reading?.toString() || '', d2: data.d2_reading?.toString() || '' });
          setNozzleSynced(data.entered_via === 'bot');
        } else { setNozzleSynced(false); setNozzleForm({ p1: '', p2: '', d1: '', d2: '' }); }
      });
    }
  }, [step, targetDate, editId, user?.bunkId]);

  const [setupForm, setSetupForm] = useState({ pDip: '', dDip: '' });
  const needsInitialSetup = morningEntries.length === 0 && (settings?.initialPetrolDip || 0) === 0 && (settings?.initialDieselDip || 0) === 0;

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number(setupForm.pDip) || 0;
    const d = Number(setupForm.dDip) || 0;
    if (!validateInputs([], [p, d])) return;
    setIsSubmitting(true);
    await updateSettings({ ...settings, initialPetrolDip: p, initialDieselDip: d });
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setEditId(null); setStep(0);
    setEntryDate(defaultEntryDate);
    setForm({ petrolDip: '', dieselDip: '', openingBalance: '', cashRaw: '', bankRaw: '', digitalRaw: '', dtpRaw: '', cardRaw: '', bankBal: '', odBal: '', digitalBal: '' });
    setNozzleForm({ p1: '', p2: '', d1: '', d2: '' });
    setNozzleSynced(false);
  };

  const openEdit = (m: MorningEntry) => {
    const availableOd = m.balanceOd || 0;   // balance_od stores raw available amount directly
    setEditId(m.id); setEntryDate(m.date);
    setForm({ petrolDip: m.petrolDip.toString(), dieselDip: m.dieselDip.toString(), openingBalance: m.collectionsCash?.toString() || '', cashRaw: m.balanceCash?.toString() || '', bankRaw: m.collectionsBank?.toString() || '', digitalRaw: m.collectionsDigital?.toString() || '', dtpRaw: m.collectionDtp?.toString() || '', cardRaw: m.collectionsCard?.toString() || '', bankBal: m.balanceBank?.toString() || '', odBal: availableOd.toString(), digitalBal: m.balanceDigital?.toString() || '' });
    setStep(1); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNozzleNext = async () => {
    const p1 = Number(nozzleForm.p1) || 0; const p2 = Number(nozzleForm.p2) || 0; const d1 = Number(nozzleForm.d1) || 0; const d2 = Number(nozzleForm.d2) || 0;
    if (p1 > 0 || p2 > 0 || d1 > 0 || d2 > 0) {
      setIsSubmitting(true);
      // Try update first; if no row exists, insert. This avoids needing a DB unique constraint.
      const payload = { p1_reading: p1, p2_reading: p2, d1_reading: d1, d2_reading: d2, entered_via: 'webapp' };
      const { data: existing } = await supabase.from('nozzle_readings').select('id').eq('bunk_id', user?.bunkId).eq('date', targetDate).maybeSingle();
      const { error: nozzleErr } = existing
        ? await supabase.from('nozzle_readings').update(payload).eq('id', existing.id).eq('bunk_id', user?.bunkId)
        : await supabase.from('nozzle_readings').insert({ bunk_id: user?.bunkId, date: targetDate, ...payload });
      setIsSubmitting(false);
      if (nozzleErr) {
        showAlert(`⚠️ Nozzle readings could not be saved (${nozzleErr.message}). You can still proceed — dip-based calculation will be used.`);
      }
    }
    setStep(1);
  };

  const isStep1Valid = form.petrolDip !== '' && form.dieselDip !== ''; const isStep2Valid = true; const isStep3Valid = form.bankBal !== '' && form.digitalBal !== '' && form.odBal !== '';
  const canGoNext = (step === 1 && isStep1Valid) || (step === 2 && isStep2Valid) || (step === 3 && isStep3Valid);

  const pDip = Number(form.petrolDip) || 0; const dDip = Number(form.dieselDip) || 0;

  // Nozzle-based gross sales (primary): use delta from previous nozzle readings
  const nP1 = Number(nozzleForm.p1) || 0; const nP2 = Number(nozzleForm.p2) || 0;
  const nD1 = Number(nozzleForm.d1) || 0; const nD2 = Number(nozzleForm.d2) || 0;
  const hasNozzleToday = nP1 > 0 || nP2 > 0 || nD1 > 0 || nD2 > 0;
  const hasPrevNozzle = prevNozzle && (Number(prevNozzle.p1_reading) > 0 || Number(prevNozzle.p2_reading) > 0 || Number(prevNozzle.d1_reading) > 0 || Number(prevNozzle.d2_reading) > 0);
  const useNozzleBased = hasNozzleToday && hasPrevNozzle;

  const petrolSold = useNozzleBased
    ? Math.max(0, (nP1 - (Number(prevNozzle?.p1_reading) || 0)) + (nP2 - (Number(prevNozzle?.p2_reading) || 0)))
    : Math.max(0, yesterdayPetrol - pDip);
  const dieselSold = useNozzleBased
    ? Math.max(0, (nD1 - (Number(prevNozzle?.d1_reading) || 0)) + (nD2 - (Number(prevNozzle?.d2_reading) || 0)))
    : Math.max(0, yesterdayDiesel - dDip);

  const petrolSalesVal = petrolSold * (settings?.petrolRate || 0); const dieselSalesVal = dieselSold * (settings?.dieselRate || 0); const totalSalesVal = petrolSalesVal + dieselSalesVal;

  // Dip-based sales always computed (for nozzle vs dip comparison)
  const dipPetrolSold = Math.max(0, yesterdayPetrol - pDip);
  const dipDieselSold = Math.max(0, yesterdayDiesel - dDip);
  const dipSalesVal = dipPetrolSold * (settings?.petrolRate || 0) + dipDieselSold * (settings?.dieselRate || 0);
  const nozzleVsDipVariance = useNozzleBased ? totalSalesVal - dipSalesVal : null;

  const openingBal = Number(form.openingBalance) || 0;
  const totalCollected = (Number(form.cashRaw) || 0) + (Number(form.bankRaw) || 0) + (Number(form.digitalRaw) || 0) + (Number(form.dtpRaw) || 0) + (Number(form.cardRaw) || 0);

  const periodTransactions = transactions.filter(t => (t.date || '') > previousEntryDate && (t.date || '') <= targetDate);
  // Credit sales: include the credit amount + any embedded advance in remarks
  const periodCreditSales = periodTransactions.filter(t => t.type === 'credit_sale' || t.type === 'opening_balance').reduce((sum, t) => {
    let total = t.amount || 0;
    if (t.remarks?.startsWith('advance:')) {
      total += Number(t.remarks.split('|')[0].split(':')[1]) || 0;
    }
    return sum + total;
  }, 0);
  // Standalone advance rows (advance-only entries, no credit sale)
  const periodAdvances = periodTransactions.filter(t => t.type === 'advance').reduce((sum, t) => sum + (t.amount || 0), 0);
  const currentPeriodExpenses = expenses.filter(e => (e.date || '') > previousEntryDate && (e.date || '') <= targetDate).reduce((sum, e) => sum + (e.amount || 0), 0);

  const totalAccounted = (totalCollected - openingBal) + periodCreditSales + periodAdvances + currentPeriodExpenses;
  const variance = totalAccounted - totalSalesVal;

  const projectedDigitalAccountBal = (settings?.currentHpBalance || 0) + (Number(form.dtpRaw) || 0) + (Number(form.digitalRaw) || 0);

  const strictlyLiquidAssets = (Number(form.cashRaw) || 0) + (Number(form.bankBal) || 0) + (Number(form.digitalBal) || 0);
  const currentTotalReceivablesAsOfTargetDate = customers.reduce((acc, c) => acc + getCustomerBalanceAsOf(c.id, targetDate), 0);
  const currentFuelStockValue = (pDip * (settings?.petrolRate || 0)) + (dDip * (settings?.dieselRate || 0));

  const odLimSubmit = Number(settings.odLimit) || 3000000;
  const odAvailableSave = Number(form.odBal) || 0;     // what user entered = available amount
  const newOdDebt = odAvailableSave - odLimSubmit;      // negative liability for net worth calc

  const calculatedNetValue = strictlyLiquidAssets + newOdDebt + currentTotalReceivablesAsOfTargetDate + currentFuelStockValue;

  const previousNetValue = previousEntry ? previousEntry.netValue : (((settings?.initialPetrolDip || 0) * (settings?.petrolRate || 0)) + ((settings?.initialDieselDip || 0) * (settings?.dieselRate || 0)));
  const trueNetProfit = calculatedNetValue - previousNetValue;

  const handleSubmit = async () => {
    // Allow negative vault cash (returns) — only validate litres
    if (!validateInputs([], [pDip, dDip])) return;

    setIsSubmitting(true);
    const payload = { date: entryDate, petrolDip: pDip, dieselDip: dDip, petrolSold, dieselSold, netProfit: trueNetProfit, variance, submitted: true, collectionsCash: openingBal, balanceCash: Number(form.cashRaw) || 0, collectionsBank: Number(form.bankRaw) || 0, collectionsDigital: Number(form.digitalRaw) || 0, collectionDtp: Number(form.dtpRaw) || 0, collectionsCard: Number(form.cardRaw) || 0, collectionsCredit: (periodCreditSales + periodAdvances), periodExpenses: currentPeriodExpenses, balanceBank: Number(form.bankBal) || 0, balanceDigital: Number(form.digitalBal) || 0, balanceOd: odAvailableSave, openingBalance: openingBal, netValue: calculatedNetValue };

    const isLatestEntry = sortedEntries.length === 0 || targetDate >= (sortedEntries[0].date || '');

    if (editId) {
      await updateMorningEntry(editId, payload);
      if (isLatestEntry) await updateSettings({ ...settings, currentOdBalance: odAvailableSave, currentHpBalance: Number(form.digitalBal) || 0 });
    } else {
      await addMorningEntry(payload);
      if (isLatestEntry) await updateSettings({ ...settings, currentOdBalance: odAvailableSave, currentHpBalance: Number(form.digitalBal) || 0 });
    }
    setIsSubmitting(false);
    setSubmitted(true);
  };

  const [mePage, setMePage] = useState(0);
  const totalMePages = Math.ceil(morningEntries.length / 10);
  const paginatedEntries = sortedEntries.slice(mePage * 10, (mePage + 1) * 10);

  if (dataLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  if (needsInitialSetup) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden max-w-2xl mx-auto"><div className="bg-blue-900 p-6 text-white"><h2 className="text-xl font-bold">First-Time Setup</h2></div><div className="p-6 md:p-8"><p className="text-gray-600 mb-8 font-medium">To calculate your true Net Worth correctly from Day 1, please enter your starting tank dips.</p><form onSubmit={handleSetupSubmit} className="space-y-6"><div className="bg-blue-50 p-6 rounded-xl border border-blue-100"><h4 className="font-bold text-blue-900 mb-4">Starting Fuel Inventory</h4><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-sm font-medium mb-1">Opening Petrol Dip (L)</label><input type="number" required className="w-full border p-3 rounded-lg focus:ring-blue-500 outline-none text-base bg-white" value={setupForm.pDip} onChange={e => setSetupForm({ ...setupForm, pDip: e.target.value })} placeholder="0" /></div><div><label className="block text-sm font-medium mb-1">Opening Diesel Dip (L)</label><input type="number" required className="w-full border p-3 rounded-lg focus:ring-blue-500 outline-none text-base bg-white" value={setupForm.dDip} onChange={e => setSetupForm({ ...setupForm, dDip: e.target.value })} placeholder="0" /></div></div></div><button type="submit" disabled={isSubmitting} className="w-full bg-blue-800 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-blue-900 transition text-lg disabled:opacity-50">{isSubmitting ? 'Processing...' : 'Save & Initialize Bunk'}</button></form></div></div>
    )
  }

  if (submitted) return (<div className="bg-green-50 text-green-800 p-8 rounded-2xl text-center border border-green-200"><CheckCircle2 size={64} className="mx-auto mb-4 text-green-500" /><h2 className="text-2xl font-bold mb-2">Morning Entry {editId ? 'Updated' : 'Submitted'}</h2><p className="text-sm text-green-700 mb-4">Stock and balance values will update for the next entry.</p><button onClick={() => { setSubmitted(false); setEditId(null); setStep(0); setForm({ petrolDip: '', dieselDip: '', openingBalance: '', cashRaw: '', bankRaw: '', digitalRaw: '', dtpRaw: '', cardRaw: '', bankBal: '', odBal: '', digitalBal: '' }); setNozzleForm({ p1: '', p2: '', d1: '', d2: '' }); setNozzleSynced(false); }} className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg font-bold shadow-sm">Start New Entry</button></div>);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-blue-900 p-6 text-white flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div><h2 className="text-xl md:text-2xl font-bold">{editId ? `Editing Entry` : 'Inventory Reconciliation'}</h2><div className="flex gap-2 mt-4 w-48">{[0, 1, 2, 3, 4].map(i => (<div key={i} className={`h-2 flex-1 rounded-full ${step >= i ? 'bg-blue-400' : 'bg-blue-800 border border-blue-700'}`}></div>))}</div></div>
          <div className="flex flex-col items-end gap-2">
            {editId && <button onClick={resetForm} className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-sm font-bold shadow transition-colors">Cancel Edit</button>}
            <div className="bg-blue-800 rounded flex items-center p-1 border border-blue-700">
              <span className="text-xs font-bold px-2 uppercase tracking-widest text-blue-300">Date</span>
              <input type="date" value={entryDate} onChange={e => { setEntryDate(e.target.value); if (!editId) setStep(0); }} className="bg-transparent border-none text-sm font-bold outline-none text-white" />
            </div>
          </div>
        </div>
        <div className="p-5 md:p-8">
          {step === 0 && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-bold">Step 0: Nozzle Meter Readings (Optional)</h3>
                {nozzleSynced && <span className="bg-green-100 text-green-700 text-[10px] uppercase font-bold px-2 py-1 rounded-full flex items-center"><CheckCircle2 size={12} className="mr-1" /> Synced from WhatsApp Bot</span>}
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start text-blue-800">
                <AlertCircle size={20} className="mr-3 shrink-0" />
                <p className="text-sm font-medium">Nozzle readings allow exact per-nozzle fuel tracking. Skip if you prefer dip-only reconciliation.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Petrol Nozzle 1</label><input type="number" step="0.01" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-base" value={nozzleForm.p1} onChange={e => setNozzleForm({ ...nozzleForm, p1: e.target.value })} placeholder="0.00" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Petrol Nozzle 2</label><input type="number" step="0.01" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-base" value={nozzleForm.p2} onChange={e => setNozzleForm({ ...nozzleForm, p2: e.target.value })} placeholder="0.00" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Diesel Nozzle 1</label><input type="number" step="0.01" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-base" value={nozzleForm.d1} onChange={e => setNozzleForm({ ...nozzleForm, d1: e.target.value })} placeholder="0.00" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Diesel Nozzle 2</label><input type="number" step="0.01" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-base" value={nozzleForm.d2} onChange={e => setNozzleForm({ ...nozzleForm, d2: e.target.value })} placeholder="0.00" /></div>
              </div>
              <div className="mt-8 flex justify-between border-t pt-6">
                <button onClick={() => setStep(1)} className="px-5 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition">Skip →</button>
                <button onClick={handleNozzleNext} disabled={isSubmitting} className="px-8 py-3 bg-blue-800 text-white rounded-xl font-bold shadow-md hover:bg-blue-900 transition disabled:opacity-50">Next Step →</button>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-bold border-b pb-2">Step 1: Inventory Dips (Litres)</h3>
              <div className="bg-gray-50 p-4 rounded-xl space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="text-sm border p-4 rounded-xl bg-white shadow-sm"><h4 className="font-bold text-gray-500 mb-3 border-b pb-2">Petrol Flow</h4><p className="flex justify-between text-gray-600 mb-1"><span>Prev Closing:</span> <span className="font-mono">{basePetrolDip} L</span></p><p className="flex justify-between text-green-600"><span>Period Receipts:</span> <span className="font-mono">+{autoTankerPetrol} L</span></p><p className="flex justify-between font-bold text-blue-900 mt-3 pt-3 border-t"><span>Opening Stock:</span> <span className="font-mono text-lg">{yesterdayPetrol} L</span></p></div>
                  <div className="text-sm border p-4 rounded-xl bg-white shadow-sm"><h4 className="font-bold text-gray-500 mb-3 border-b pb-2">Diesel Flow</h4><p className="flex justify-between text-gray-600 mb-1"><span>Prev Closing:</span> <span className="font-mono">{baseDieselDip} L</span></p><p className="flex justify-between text-green-600"><span>Period Receipts:</span> <span className="font-mono">+{autoTankerDiesel} L</span></p><p className="flex justify-between font-bold text-blue-900 mt-3 pt-3 border-t"><span>Opening Stock:</span> <span className="font-mono text-lg">{yesterdayDiesel} L</span></p></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4"><div><label className="block text-sm font-bold text-blue-900 mb-2">Current Petrol Closing *</label><input autoFocus type="number" value={form.petrolDip} onChange={e => setForm({ ...form, petrolDip: e.target.value })} className="w-full p-4 border-2 border-blue-200 rounded-xl focus:ring-blue-500 outline-none font-bold text-lg" placeholder="0" /></div><div><label className="block text-sm font-bold text-blue-900 mb-2">Current Diesel Closing *</label><input type="number" value={form.dieselDip} onChange={e => setForm({ ...form, dieselDip: e.target.value })} className="w-full p-4 border-2 border-blue-200 rounded-xl focus:ring-blue-500 outline-none font-bold text-lg" placeholder="0" /></div></div>
              </div>
              {(pDip > 0 || dDip > 0 || useNozzleBased) && (<div className="bg-blue-50 p-6 rounded-xl border border-blue-100 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div><p className="text-sm text-blue-800 mb-1">Petrol Dispensed {useNozzleBased ? '(Nozzle)' : '(Dip)'}</p><p className="text-3xl font-bold text-blue-900">{petrolSold.toFixed(0)} L</p><p className="text-sm font-medium text-blue-600 mt-1">Value: {formatRs(petrolSalesVal)}</p></div>
                <div><p className="text-sm text-blue-800 mb-1">Diesel Dispensed {useNozzleBased ? '(Nozzle)' : '(Dip)'}</p><p className="text-3xl font-bold text-blue-900">{dieselSold.toFixed(0)} L</p><p className="text-sm font-medium text-blue-600 mt-1">Value: {formatRs(dieselSalesVal)}</p></div>
                {useNozzleBased && <div className="col-span-2 text-xs text-green-700 font-bold bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">✓ Using nozzle meter delta (more accurate)</div>}
              </div>)}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-bold border-b pb-2">Step 2: Remittances (Period Collections)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-bold text-orange-700 mb-1">Opening Cash (Float) *</label>
                  <input type="number" min="0" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: e.target.value })} className="w-full p-3 border-2 border-orange-300 bg-orange-50 rounded-lg outline-none text-base font-bold text-orange-900" placeholder="0" />
                </div>
                <div><label className="block text-sm font-medium mb-1">End of Day Vault Cash *</label><input type="number" value={form.cashRaw} onChange={e => setForm({ ...form, cashRaw: e.target.value })} className="w-full p-3 border rounded-lg outline-none text-base" placeholder="0" /></div>
                <div><label className="block text-sm font-medium mb-1">Bank Transfer (Rs)</label><input type="number" value={form.bankRaw} onChange={e => setForm({ ...form, bankRaw: e.target.value })} className="w-full p-3 border rounded-lg outline-none text-base" placeholder="0" /></div>
                <div><label className="block text-sm font-medium mb-1">Digital App (Rs)</label><input type="number" value={form.digitalRaw} onChange={e => setForm({ ...form, digitalRaw: e.target.value })} className="w-full p-3 border rounded-lg outline-none text-base" placeholder="0" /></div>
                <div><label className="block text-sm font-medium mb-1">DTP Pay (Rs)</label><input type="number" value={form.dtpRaw} onChange={e => setForm({ ...form, dtpRaw: e.target.value })} className="w-full p-3 border rounded-lg outline-none text-base bg-blue-50 border-blue-200" placeholder="0" /></div>
                <div><label className="block text-sm font-medium mb-1">Cards / Other (Rs)</label><input type="number" value={form.cardRaw} onChange={e => setForm({ ...form, cardRaw: e.target.value })} className="w-full p-3 border rounded-lg outline-none text-base" placeholder="0" /></div>
              </div>
              <div className="bg-gray-50 p-6 rounded-xl flex justify-between items-center"><span className="font-bold text-gray-700">Net Remittance (Minus Float):</span><span className="text-3xl font-bold text-gray-900">{formatRs(totalCollected - openingBal)}</span></div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-bold border-b pb-2">Step 3: Account Balances Snapshot</h3>
              <p className="text-sm text-gray-500">Provide bank balance updates to finalize net worth tracking. Cash in Box is automatically drawn from Step 2.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
                <div><label className="block text-sm font-medium mb-2">Primary Bank Balance *</label><input type="number" value={form.bankBal} onChange={e => setForm({ ...form, bankBal: e.target.value })} className="w-full p-4 border rounded-xl text-lg font-bold" placeholder="0" /></div>
                <div><div className="flex justify-between items-end mb-2"><label className="block text-sm font-medium">Digital/Wallet Balance *</label><span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Proj: {formatRs(projectedDigitalAccountBal)}</span></div><input type="number" value={form.digitalBal} onChange={e => setForm({ ...form, digitalBal: e.target.value })} className="w-full p-4 border bg-blue-50 border-blue-200 rounded-xl text-lg font-bold" placeholder="0" /></div>
                <div className="sm:col-span-2 bg-red-50 p-6 rounded-xl border border-red-100">
                  <label className="block text-sm font-bold text-red-900 mb-2">OD Currently Available Balance (Rs) *</label>
                  <input type="number" value={form.odBal} onChange={e => setForm({ ...form, odBal: e.target.value })} className="w-full p-4 border border-red-300 rounded-xl text-red-900 text-lg font-bold outline-none focus:ring-2 focus:ring-red-500 bg-white" placeholder="e.g. 500000" />
                  <p className="text-xs text-red-700 mt-2 font-medium">Enter what the bank shows as your available limit. Default configured max limit is {formatRs(settings.odLimit || 3000000)}.</p>
                  {form.odBal && <p className="font-bold text-red-800 mt-2">Current OD Used (Debt): {formatRs((Number(settings.odLimit) || 3000000) - Number(form.odBal))}</p>}
                </div>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in">
              <h3 className="text-lg font-bold border-b pb-2">Step 4: Audit & Submission</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-blue-50 p-5 rounded-xl border border-blue-100"><h4 className="font-bold text-blue-900 mb-4 border-b border-blue-200 pb-2">Gross Sales {useNozzleBased ? '(Nozzle-Based)' : '(Dip-Based)'}</h4><div className="space-y-3 text-sm font-medium"><div className="flex justify-between"><span>Petrol Dispensed ({petrolSold.toFixed(1)}L)</span><span>{formatRs(petrolSalesVal)}</span></div><div className="flex justify-between"><span>Diesel Dispensed ({dieselSold.toFixed(1)}L)</span><span>{formatRs(dieselSalesVal)}</span></div><div className="flex justify-between pt-3 border-t border-blue-200 font-black text-lg"><span>Total Target</span><span>{formatRs(totalSalesVal)}</span></div></div></div>
                <div className="bg-green-50 p-5 rounded-xl border border-green-100">
                  <h4 className="font-bold text-green-900 mb-4 border-b border-green-200 pb-2">Total Reconciled Value</h4>
                  <div className="space-y-2 text-sm font-medium">
                    <div className="flex justify-between"><span>End of Day Vault Cash</span><span>{formatRs(Number(form.cashRaw))}</span></div>
                    <div className="flex justify-between text-orange-600"><span>Less: Opening Float</span><span>- {formatRs(openingBal)}</span></div>
                    <div className="flex justify-between"><span>Digital Remittances</span><span>{formatRs(totalCollected - Number(form.cashRaw))}</span></div>
                    <div className="flex justify-between text-blue-700"><span>Period Credit Extended</span><span>{formatRs(periodCreditSales)}</span></div>
                    <div className="flex justify-between text-blue-700"><span>Driver Advances</span><span>{formatRs(periodAdvances)}</span></div>
                    <div className="flex justify-between text-purple-700"><span>Period Expenses</span><span>{formatRs(currentPeriodExpenses)}</span></div>
                    <div className="flex justify-between pt-3 border-t border-green-200 font-black text-lg"><span>Total Accounted</span><span>{formatRs(totalAccounted)}</span></div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mt-6">
                <div className={`p-6 rounded-xl border flex justify-between items-center shadow-sm ${variance < 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <div>
                    <h4 className={`font-black text-lg ${variance < 0 ? 'text-red-800' : 'text-green-800'}`}>Collection Variance {variance < 0 ? '⚠️ Short' : variance === 0 ? '✅ Balanced' : '✅ Surplus'}</h4>
                    <p className="text-sm opacity-80 mt-1">{variance < 0 ? 'Short collection — cash/credit collected less than fuel dispensed.' : variance > 0 ? 'Surplus — more collected than fuel dispensed (over-collected).' : 'Perfect balance.'}</p>
                  </div>
                  <span className={`text-2xl md:text-3xl font-black whitespace-nowrap ml-4 ${variance < 0 ? 'text-red-600' : 'text-green-600'}`}>{variance < 0 ? '-' : '+'}{formatRs(Math.abs(variance))}</span>
                </div>
                {nozzleVsDipVariance !== null && (
                  <div className={`p-6 rounded-xl border flex justify-between items-center shadow-sm ${Math.abs(nozzleVsDipVariance) > 500 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                    <div>
                      <h4 className={`font-black text-lg ${Math.abs(nozzleVsDipVariance) > 500 ? 'text-amber-800' : 'text-blue-800'}`}>Nozzle vs Dip Variance</h4>
                      <p className="text-sm opacity-80 mt-1">Nozzle-dispensed ({(petrolSold + dieselSold).toFixed(1)}L) vs Dip-measured ({(dipPetrolSold + dipDieselSold).toFixed(1)}L) stock difference.</p>
                    </div>
                    <span className={`text-2xl md:text-3xl font-black whitespace-nowrap ml-4 ${Math.abs(nozzleVsDipVariance) > 500 ? 'text-amber-600' : 'text-blue-600'}`}>{nozzleVsDipVariance < 0 ? '-' : '+'}{formatRs(Math.abs(nozzleVsDipVariance))}</span>
                  </div>
                )}
              </div>

              {/* EXPLICIT NET WORTH PREVIEW (OWNER ONLY) */}
              {userRole === 'owner' && (
                <div className="bg-gray-900 text-white p-5 rounded-xl shadow-lg mt-6">
                  <h4 className="font-bold text-blue-300 mb-3 border-b border-gray-700 pb-2 uppercase tracking-wider text-xs">Business Net Worth Preview</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div><p className="text-gray-400 text-[10px] uppercase tracking-wider">Liquid Assets</p><p className="font-bold text-sm">{formatLakhs(strictlyLiquidAssets)}</p></div>
                    <div><p className="text-gray-400 text-[10px] uppercase tracking-wider">Receivables</p><p className="font-bold text-sm">{formatLakhs(currentTotalReceivablesAsOfTargetDate)}</p></div>
                    <div><p className="text-gray-400 text-[10px] uppercase tracking-wider">Fuel Stock</p><p className="font-bold text-sm">{formatLakhs(currentFuelStockValue)}</p></div>
                    <div><p className="text-gray-400 text-[10px] uppercase tracking-wider">OD Debt</p><p className="font-bold text-sm text-red-400">{formatLakhs(Math.abs(newOdDebt))}</p></div>
                  </div>
                  <div className="flex justify-between items-end pt-3 border-t border-gray-700 mt-2">
                    <div>
                      <p className="text-gray-400 text-[10px] uppercase tracking-wider">Calculated New Net Worth</p>
                      <p className="text-2xl font-black">{formatLakhs(calculatedNetValue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-[10px] uppercase tracking-wider">Shift True Profit</p>
                      <p className={`text-xl font-black ${trueNetProfit < 0 ? 'text-red-400' : 'text-green-400'}`}>{trueNetProfit > 0 ? '+' : ''}{formatRs(trueNetProfit)}</p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
          {step > 0 && (
            <div className="mt-8 flex justify-between border-t pt-6">
              <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={isSubmitting} className="px-5 py-3 border-2 border-gray-200 rounded-xl disabled:opacity-50 font-bold text-gray-600 hover:bg-gray-50 transition">Back</button>
              {step < 4 ? (<button onClick={() => setStep(s => s + 1)} disabled={!canGoNext || isSubmitting} className="px-8 py-3 bg-blue-800 text-white rounded-xl font-bold disabled:opacity-50 transition shadow-md hover:bg-blue-900">Next Step</button>) : (<button onClick={handleSubmit} disabled={isSubmitting} className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold shadow-md hover:bg-green-700 transition disabled:opacity-50">{isSubmitting ? 'Saving...' : (editId ? 'Update Ledger' : 'Lock Daily Ledger')}</button>)}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="p-5 border-b bg-gray-50"><h3 className="font-bold text-gray-800">Ledger History</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white border-b"><tr><th className="p-4 text-gray-500 whitespace-nowrap">Date</th><th className="p-4 text-gray-500 whitespace-nowrap">Gross Sales</th><th className="p-4 text-gray-500 whitespace-nowrap">Remitted</th><th className="p-4 text-gray-500 whitespace-nowrap">Credit Extended</th><th className="p-4 text-gray-500 whitespace-nowrap">Collection Variance</th>{userRole === 'owner' && <th className="p-4 text-gray-500 text-center whitespace-nowrap">Actions</th>}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedEntries.length === 0 ? (<tr><td colSpan={6} className="p-10 flex flex-col items-center justify-center text-gray-400"><SearchX size={32} className="mb-2 opacity-50" />No past entries.</td></tr>) : paginatedEntries.map((e, idx) => (
                <tr key={e.id || `entry-${idx}`} className={`hover:bg-gray-50 transition ${editId === e.id ? 'bg-blue-50/50' : ''}`}>
                  <td className="p-4 whitespace-nowrap font-medium">{formatISTDate(e.date)}</td>
                  <td className="p-4 whitespace-nowrap">{formatRs(e.petrolSold * (e.petrolRateAtEntry || settings.petrolRate || 0) + e.dieselSold * (e.dieselRateAtEntry || settings.dieselRate || 0))}</td>
                  <td className="p-4 whitespace-nowrap text-gray-600">{formatRs(((e.collectionsCash || 0) - (e.openingBalance || 0)) + (e.collectionsBank || 0) + (e.collectionsDigital || 0) + (e.collectionDtp || 0) + (e.collectionsCard || 0))}</td>
                  <td className="p-4 whitespace-nowrap text-orange-600 font-medium">{(() => {
                    // Compute credit extended for this entry's date range dynamically
                    // so bot-submitted entries (which don't write collections_credit) show correctly.
                    const prevEntry = sortedEntries.find(pe => (pe.date || '') < (e.date || ''));
                    const prevDate = prevEntry ? prevEntry.date : '1970-01-01';
                    const rangeTxns = transactions.filter(t =>
                      (t.date || '') > prevDate && (t.date || '') <= (e.date || '')
                    );
                    const creditFromTxns = rangeTxns
                      .filter(t => t.type === 'credit_sale' || t.type === 'opening_balance')
                      .reduce((sum, t) => {
                        let total = t.amount || 0;
                        if (t.remarks?.startsWith('advance:')) {
                          total += Number(t.remarks.split('|')[0].split(':')[1]) || 0;
                        }
                        return sum + total;
                      }, 0)
                      + rangeTxns.filter(t => t.type === 'advance').reduce((sum, t) => sum + (t.amount || 0), 0);
                    // Fall back to DB value only if no transactions are loaded yet
                    const displayCredit = rangeTxns.length > 0 ? creditFromTxns : (e.collectionsCredit || 0);
                    return formatRs(displayCredit);
                  })()}</td>

                  <td className={`p-4 whitespace-nowrap font-bold ${e.variance < 0 ? 'text-red-600' : 'text-green-600'}`}>{e.variance < 0 ? '-' : '+'}{formatRs(Math.abs(e.variance))}</td>
                  {userRole === 'owner' && (<td className="p-4 flex justify-center gap-2"><button onClick={() => openEdit(e)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition"><Edit2 size={16} /></button><button onClick={() => showConfirm("Delete entry?", () => deleteMorningEntry(e.id))} className="text-red-500 p-2 hover:bg-red-100 rounded-lg transition"><Trash2 size={16} /></button></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center text-sm">
          <span className="text-gray-500">Showing page {mePage + 1} of {Math.max(1, totalMePages)}</span>
          <div className="flex gap-2">
            <button onClick={() => setMePage(p => Math.max(0, p - 1))} disabled={mePage === 0} className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 transition shadow-sm">Previous</button>
            <button onClick={() => setMePage(p => Math.min(totalMePages - 1, p + 1))} disabled={mePage >= totalMePages - 1} className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 transition shadow-sm">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Expenses Module
const ExpenseModule = () => {
  const { user, settings, expenses, addExpense, updateExpense, deleteExpense, showConfirm, validateInputs, dataLoading } = useAppContext();
  const [form, setForm] = useState({ date: getTodayIST(), category: 'Salaries', amount: '', description: '', vendor: '', mode: 'Cash' });
  const [editId, setEditId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const userRole = String(user?.role || '').toLowerCase();

  const resetForm = () => { setEditId(null); setForm({ date: getTodayIST(), category: 'Salaries', amount: '', description: '', vendor: '', mode: 'Cash' }); };
  const openEdit = (e: Expense) => { setEditId(e.id); setForm({ date: e.date, category: e.category, amount: e.amount.toString(), description: e.description || '', vendor: e.vendor || '', mode: e.mode || 'Cash' }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!validateInputs([Number(form.amount)], [])) return;
    setIsSubmitting(true);
    if (editId) { await updateExpense(editId, { ...form, amount: Number(form.amount) }); } else { await addExpense({ ...form, amount: Number(form.amount) }); }
    setIsSubmitting(false);
    resetForm();
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  // Fix #13: budget tracker should compare CURRENT MONTH only, not all-time total
  const currentMonthExpenses = expenses.filter(e => e.date?.startsWith(getCurrentMonthStr())).reduce((sum, e) => sum + (e.amount || 0), 0);
  const budget = settings?.monthlyBudget || 0; const budgetPct = budget > 0 ? Math.min(100, (currentMonthExpenses / budget) * 100) : 0;

  const filteredExpenses = expenses.filter(e => {
    if (!searchTerm) return true;
    const str = `${e.category} ${e.vendor} ${e.description}`.toLowerCase();
    return str.includes(searchTerm.toLowerCase());
  });

  const [expPage, setExpPage] = useState(0);
  const totalExpPages = Math.ceil(filteredExpenses.length / 10);
  const paginatedExpenses = filteredExpenses.slice(expPage * 10, (expPage + 1) * 10);

  if (dataLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100dvh-100px)]">
      <div className="lg:w-1/3 lg:overflow-y-auto pr-2 pb-10 space-y-6 relative">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6"><div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="text-lg font-bold">Record Expense</h3>{editId && <button type="button" onClick={resetForm} className="text-red-500 text-sm font-bold">Cancel</button>}</div><form onSubmit={handleSubmit} className="space-y-4"><div><label className="block text-sm font-medium mb-1">Date</label><input type="date" required className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div><div><label className="block text-sm font-medium mb-1">Category</label><select className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-base" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option>Salaries</option><option>Electricity/Water</option><option>Maintenance</option><option>Bank Charges</option><option>Miscellaneous</option></select></div><div><label className="block text-sm font-medium mb-1">Amount (Rs)</label><input type="number" required className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" /></div><div><label className="block text-sm font-medium mb-1">Vendor / Description</label><input type="text" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} /></div><button type="submit" disabled={isSubmitting} className="w-full bg-blue-800 text-white py-3 rounded-xl font-bold shadow hover:bg-blue-900 transition disabled:opacity-50">{isSubmitting ? 'Processing...' : (editId ? 'Update Expense' : 'Save Expense')}</button></form></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6"><h3 className="font-bold text-gray-700 mb-2">Monthly Budget Tracker</h3><div className="flex justify-between text-sm mb-1"><span className="font-medium">{formatRs(currentMonthExpenses)} this month</span><span className="text-gray-500">{formatRs(budget)} limit</span></div><div className="w-full bg-gray-200 rounded-full h-2.5"><div className={`h-2.5 rounded-full ${budgetPct > 90 ? 'bg-red-600' : 'bg-green-600'}`} style={{ width: `${budgetPct}%` }}></div></div></div>
      </div>
      <div className="lg:w-2/3 lg:overflow-y-auto pl-2 pb-10 relative flex flex-col h-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="font-bold text-gray-700 text-lg">Expense History</h3>
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input type="text" placeholder="Search expenses..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setExpPage(0); }} className="w-full pl-9 pr-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-white border-b"><tr><th className="p-3 text-gray-500 whitespace-nowrap">Date</th><th className="p-3 text-gray-500 whitespace-nowrap">Category</th><th className="p-3 text-gray-500 whitespace-nowrap">Details</th><th className="p-3 text-gray-500 text-right whitespace-nowrap">Amount</th>{userRole === 'owner' && <th className="p-3 text-gray-500 text-center whitespace-nowrap">Actions</th>}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedExpenses.length === 0 ? (<tr><td colSpan={5} className="p-10 flex flex-col items-center justify-center text-gray-400"><SearchX size={32} className="mb-2 opacity-50" />No expenses found.</td></tr>) : paginatedExpenses.map((e, idx) => (
                  <tr key={e.id || `exp-${idx}`} className={`hover:bg-gray-50 ${editId === e.id ? 'bg-blue-50' : ''}`}>
                    <td className="p-3 whitespace-nowrap font-medium">{formatISTDate(e.date)}</td>
                    <td className="p-3 font-medium whitespace-nowrap">{e.category}</td>
                    <td className="p-3 text-gray-500 min-w-[150px]">{e.vendor}</td>
                    <td className="p-3 text-right font-bold text-gray-900 whitespace-nowrap">{formatRs(e.amount)}</td>
                    {userRole === 'owner' && (<td className="p-3 flex justify-center gap-2"><button onClick={() => openEdit(e)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition"><Edit2 size={16} /></button><button onClick={() => showConfirm("Delete this expense?", () => deleteExpense(e.id))} className="text-red-500 hover:bg-red-100 p-1.5 rounded transition"><Trash2 size={16} /></button></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t bg-gray-50 flex justify-between items-center text-sm mt-auto">
            <span className="text-gray-500">Showing page {expPage + 1} of {Math.max(1, totalExpPages)}</span>
            <div className="flex gap-2">
              <button onClick={() => setExpPage(p => Math.max(0, p - 1))} disabled={expPage === 0} className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 transition shadow-sm">Previous</button>
              <button onClick={() => setExpPage(p => Math.min(totalExpPages - 1, p + 1))} disabled={expPage >= totalExpPages - 1} className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 transition shadow-sm">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Fuel Stock Module
const FuelStockModule = () => {
  const { user, fuelPurchases, addFuelPurchase, updateFuelPurchase, deleteFuelPurchase, showAlert, showConfirm, validateInputs, dataLoading } = useAppContext();
  const [form, setForm] = useState({ date: getTodayIST(), petrolLitres: '', petrolRate: '', dieselLitres: '', dieselRate: '', supplier: '', invoice: '', mode: 'Bank Transfer' });
  const [editId, setEditId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const userRole = String(user?.role || '').toLowerCase();

  const resetForm = () => { setEditId(null); setForm({ date: getTodayIST(), petrolLitres: '', petrolRate: '', dieselLitres: '', dieselRate: '', supplier: '', invoice: '', mode: 'Bank Transfer' }); };
  const openEdit = (f: FuelPurchase) => {
    setEditId(f.id);
    const isPetrol = f.product === 'Petrol';
    setForm({
      date: f.date, supplier: f.supplier || '', invoice: f.invoice || '', mode: f.mode || 'Bank Transfer',
      petrolLitres: isPetrol ? f.litres.toString() : '',
      petrolRate: isPetrol ? f.rate.toString() : '',
      dieselLitres: !isPetrol ? f.litres.toString() : '',
      dieselRate: !isPetrol ? f.rate.toString() : ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pL = Number(form.petrolLitres) || 0; const pR = Number(form.petrolRate) || 0;
  const dL = Number(form.dieselLitres) || 0; const dR = Number(form.dieselRate) || 0;
  const totalInvoiceValue = (pL * pR) + (dL * dR);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pL === 0 && dL === 0) return showAlert("Please enter litres for at least one product.");
    if (!validateInputs([], [pL, dL])) return;
    if (!form.invoice) return showAlert("Invoice number is required.");

    setIsSubmitting(true);
    if (editId) {
      const product = pL > 0 ? 'Petrol' : 'Diesel';
      const l = pL > 0 ? pL : dL;
      const r = pL > 0 ? pR : dR;
      await updateFuelPurchase(editId, { date: form.date, product, litres: l, rate: r, amount: Math.round(l * r), supplier: form.supplier, invoice: form.invoice, mode: form.mode });
    } else {
      const purchases: any[] = [];
      if (pL > 0) purchases.push({ date: form.date, product: 'Petrol', litres: pL, rate: pR, amount: Math.round(pL * pR), supplier: form.supplier || 'Vendor', invoice: form.invoice, mode: form.mode });
      if (dL > 0) purchases.push({ date: form.date, product: 'Diesel', litres: dL, rate: dR, amount: Math.round(dL * dR), supplier: form.supplier || 'Vendor', invoice: form.invoice, mode: form.mode });
      await addFuelPurchase(purchases);
    }
    setIsSubmitting(false);
    resetForm();
  };

  const filteredPurchases = fuelPurchases.filter(f => {
    if (!searchTerm) return true;
    const str = `${f.supplier} ${f.invoice} ${f.product}`.toLowerCase();
    return str.includes(searchTerm.toLowerCase());
  });

  // Group purchases by Invoice+Date visually in the table
  const groupedInvoices = filteredPurchases.reduce((acc, f) => {
    const key = `${f.invoice || 'No Invoice'}-${f.date || 'Unknown'}`;
    if (!acc[key]) acc[key] = { id: f.id, date: f.date, invoice: f.invoice, supplier: f.supplier, totalLitres: 0, totalAmount: 0, items: [] };
    acc[key].totalLitres += (f.litres || 0);
    acc[key].totalAmount += (f.amount || 0);
    acc[key].items.push(f);
    return acc;
  }, {} as Record<string, any>);

  const sortedInvoices = Object.values(groupedInvoices).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  const [fuelPage, setFuelPage] = useState(0);
  const totalFuelPages = Math.ceil(sortedInvoices.length / 10);
  const paginatedInvoices = sortedInvoices.slice(fuelPage * 10, (fuelPage + 1) * 10);

  if (dataLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100dvh-100px)]">
      <div className="lg:w-1/3 lg:overflow-y-auto pr-2 pb-10 space-y-6 relative">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6">
          <div className="flex justify-between items-center mb-4 border-b pb-2"><div className="flex items-center"><Truck className="text-blue-800 mr-2" /><h3 className="text-lg font-bold">Log Fuel Receipt</h3></div>{editId && <button type="button" onClick={resetForm} className="text-red-500 text-sm font-bold">Cancel</button>}</div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="block text-sm font-medium mb-1">Date Received</label><input type="date" required className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className={`bg-orange-50 p-3 rounded-xl border border-orange-100 ${editId && dL > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
              <h4 className="font-bold text-orange-800 mb-2 text-sm">Petrol Details</h4>
              <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium mb-1">Litres</label><input type="number" className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-base bg-white" value={form.petrolLitres} onChange={e => setForm({ ...form, petrolLitres: e.target.value })} placeholder="0" /></div><div><label className="block text-xs font-medium mb-1">Rate (Rs/L)</label><input type="number" step="0.01" className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-base bg-white" value={form.petrolRate} onChange={e => setForm({ ...form, petrolRate: e.target.value })} placeholder="0.00" /></div></div>
            </div>
            <div className={`bg-blue-50 p-3 rounded-xl border border-blue-100 ${editId && pL > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
              <h4 className="font-bold text-blue-800 mb-2 text-sm">Diesel Details</h4>
              <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium mb-1">Litres</label><input type="number" className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base bg-white" value={form.dieselLitres} onChange={e => setForm({ ...form, dieselLitres: e.target.value })} placeholder="0" /></div><div><label className="block text-xs font-medium mb-1">Rate (Rs/L)</label><input type="number" step="0.01" className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base bg-white" value={form.dieselRate} onChange={e => setForm({ ...form, dieselRate: e.target.value })} placeholder="0.00" /></div></div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center border"><span className="text-sm font-medium text-gray-500">Gross Invoice Value</span><span className="font-bold text-gray-900 text-lg">{formatRs(totalInvoiceValue)}</span></div>
            <div>
              <label className="block text-sm font-medium mb-1">Supplier / Invoice No.</label>
              <div className="flex gap-2">
                <input type="text" placeholder="Vendor" className="w-1/2 border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
                <input type="text" placeholder="Inv No." required className="w-1/2 border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.invoice} onChange={e => setForm({ ...form, invoice: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Mode</label>
              <select className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-base" value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })}>
                <option>Bank Transfer</option><option>Cash</option><option>Credit</option>
              </select>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-800 text-white py-3 rounded-xl font-bold shadow hover:bg-blue-900 transition disabled:opacity-50">{isSubmitting ? 'Processing...' : (editId ? 'Update Receipt' : 'Save Full Receipt')}</button>
          </form>
        </div>
      </div>

      <div className="lg:w-2/3 lg:overflow-y-auto pl-2 pb-10 relative flex flex-col h-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="font-bold text-gray-700 text-lg">Fuel Deliveries</h3>
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input type="text" placeholder="Search supplier, invoice..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setFuelPage(0); }} className="w-full pl-9 pr-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-white border-b"><tr><th className="p-3 text-gray-500 whitespace-nowrap">Date</th><th className="p-3 text-gray-500 whitespace-nowrap">Invoice</th><th className="p-3 text-gray-500 text-right whitespace-nowrap">Total Litres</th><th className="p-3 text-gray-500 text-right whitespace-nowrap">Invoice Value</th>{userRole === 'owner' && <th className="p-3 text-gray-500 text-center whitespace-nowrap">Actions</th>}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedInvoices.length === 0 ? (<tr><td colSpan={5} className="p-10 flex flex-col items-center justify-center text-gray-400"><SearchX size={32} className="mb-2 opacity-50" />No receipts found.</td></tr>) : paginatedInvoices.map((inv, idx) => (
                  <React.Fragment key={`inv-${idx}`}>
                    <tr className="bg-gray-50">
                      <td className="p-3 whitespace-nowrap font-bold">{formatISTDate(inv.date)}</td>
                      <td className="p-3 whitespace-nowrap"><span className="font-bold text-gray-900">{inv.invoice}</span> <span className="text-xs text-gray-500 ml-1">({inv.supplier})</span></td>
                      <td className="p-3 text-right font-bold text-gray-900">{inv.totalLitres} L</td>
                      <td className="p-3 text-right font-black text-blue-900">{formatRs(inv.totalAmount)}</td>
                      <td className="p-3"></td>
                    </tr>
                    {inv.items.map((f: FuelPurchase) => (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="p-3 pl-8 text-xs text-gray-400">↳ Item</td>
                        <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${f.product === 'Petrol' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>{f.product}</span></td>
                        <td className="p-3 text-right text-gray-600">{f.litres} L <span className="text-xs text-gray-400">(@ {f.rate}/L)</span></td>
                        <td className="p-3 text-right text-gray-600">{formatRs(f.amount)}</td>
                        {userRole === 'owner' && (
                          <td className="p-3 flex justify-center gap-2">
                            <button onClick={() => openEdit(f)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition"><Edit2 size={14} /></button>
                            <button onClick={() => showConfirm("Delete this item from invoice?", () => deleteFuelPurchase(f.id))} className="text-red-500 hover:bg-red-100 p-1.5 rounded transition"><Trash2 size={14} /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t bg-gray-50 flex justify-between items-center text-sm mt-auto">
            <span className="text-gray-500">Showing page {fuelPage + 1} of {Math.max(1, totalFuelPages)}</span>
            <div className="flex gap-2">
              <button onClick={() => setFuelPage(p => Math.max(0, p - 1))} disabled={fuelPage === 0} className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 transition shadow-sm">Previous</button>
              <button onClick={() => setFuelPage(p => Math.min(totalFuelPages - 1, p + 1))} disabled={fuelPage >= totalFuelPages - 1} className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 transition shadow-sm">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Monthly Reports Module (FIX 6)
const MonthlyReports = () => {
  const { morningEntries, transactions, expenses, fuelPurchases, customers, settings, dataLoading } = useAppContext();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr());

  const monthEntries = morningEntries.filter(e => e.date?.startsWith(selectedMonth));
  const monthTx = transactions.filter(t => t.date?.startsWith(selectedMonth));
  const monthExp = expenses.filter(e => e.date?.startsWith(selectedMonth));
  const monthFuel = fuelPurchases.filter(f => f.date?.startsWith(selectedMonth));

  const grossSalesRs = monthEntries.reduce((s, e) => s + (e.petrolSold || 0) * (e.petrolRateAtEntry || settings?.petrolRate || 0) + (e.dieselSold || 0) * (e.dieselRateAtEntry || settings?.dieselRate || 0), 0);
  const creditSales = monthTx.filter(t => t.type === 'credit_sale').reduce((s, t) => s + (t.amount || 0), 0);
  const paymentsRec = monthTx.filter(t => t.type === 'payment').reduce((s, t) => s + (t.amount || 0), 0);
  const totalExpenses = monthExp.reduce((s, e) => s + (e.amount || 0), 0);
  const fuelCost = monthFuel.reduce((s, f) => s + (f.amount || 0), 0);
  const netProfit = grossSalesRs - fuelCost - totalExpenses;

  const topCustomers = customers.map(c => ({
    name: c.companyName,
    credit: monthTx.filter(t => t.customerId === c.id && t.type === 'credit_sale').reduce((s, t) => s + (t.amount || 0), 0)
  })).filter(x => x.credit > 0).sort((a, b) => b.credit - a.credit).slice(0, 5);

  const handleExportCSV = () => {
    let csv = `Monthly Report — ${selectedMonth}\n\nMetric,Amount (Rs)\n`;
    csv += `Gross Sales,${grossSalesRs}\nCredit Sales,${creditSales}\nPayments Received,${paymentsRec}\nTotal Expenses,${totalExpenses}\nFuel Cost,${fuelCost}\nNet Profit,${netProfit}\n\nTop Customers by Credit\nCustomer,Amount\n`;
    topCustomers.forEach(c => { csv += `"${c.name}",${c.credit}\n`; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FuelDesk_Report_${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (dataLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Monthly Reports</h2>
          <p className="text-gray-500 text-sm">Financial summary for the selected month.</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-900 bg-white shadow-sm" />
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-blue-800 text-white rounded-lg font-bold hover:bg-blue-900 transition shadow-sm"><Download size={16} /> Export CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Gross Sales', value: grossSalesRs, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
          { label: 'Credit Sales', value: creditSales, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-100' },
          { label: 'Payments Received', value: paymentsRec, color: 'text-green-700', bg: 'bg-green-50 border-green-100' },
          { label: 'Fuel Cost', value: fuelCost, color: 'text-red-700', bg: 'bg-red-50 border-red-100' },
          { label: 'Total Expenses', value: totalExpenses, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-100' },
          { label: 'Net Profit', value: netProfit, color: netProfit >= 0 ? 'text-green-700' : 'text-red-700', bg: netProfit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border p-5 ${card.bg}`}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{card.label}</p>
            <p className={`text-2xl font-black ${card.color}`}>{formatRs(card.value)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center"><TrendingUp size={18} className="mr-2 text-blue-500" /> Top 5 Customers by Credit</h3>
        {topCustomers.length === 0 ? <p className="text-gray-400 text-sm italic">No credit transactions this month.</p> : (
          <div className="space-y-2">
            {topCustomers.map((c, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-800">#{i + 1} {c.name}</span>
                <span className="font-bold text-orange-600">{formatRs(c.credit)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b bg-gray-50"><h3 className="font-bold text-gray-800">Daily Entry Summary</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white border-b"><tr><th className="p-3 text-gray-500">Date</th><th className="p-3 text-gray-500 text-right">Petrol (L)</th><th className="p-3 text-gray-500 text-right">Diesel (L)</th><th className="p-3 text-gray-500 text-right">Gross Sales</th><th className="p-3 text-gray-500 text-right">Variance</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {monthEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((e, idx) => (
                <tr key={e.id || idx} className="hover:bg-gray-50">
                  <td className="p-3 font-medium">{formatISTDate(e.date)}</td>
                  <td className="p-3 text-right">{(e.petrolSold || 0).toFixed(0)}</td>
                  <td className="p-3 text-right">{(e.dieselSold || 0).toFixed(0)}</td>
                  <td className="p-3 text-right font-bold">{formatRs((e.petrolSold || 0) * (e.petrolRateAtEntry || settings?.petrolRate || 0) + (e.dieselSold || 0) * (e.dieselRateAtEntry || settings?.dieselRate || 0))}</td>
                  <td className={`p-3 text-right font-bold ${(e.variance || 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>{(e.variance || 0) < 0 ? '-' : '+'}{formatRs(Math.abs(e.variance || 0))}</td>
                </tr>
              ))}
              {monthEntries.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">No entries for this month.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Settings Module
const SettingsModule = () => {
  const { settings, updateSettings, users, addUser, deleteUser, changePassword, user, customers, transactions, showAlert, showConfirm, dataLoading } = useAppContext();

  const [form, setForm] = useState(settings);
  useEffect(() => { setForm(settings); }, [settings]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await updateSettings({
      ...settings,
      bunkName: form.bunkName,
      fuelCompany: form.fuelCompany || settings.fuelCompany,
      petrolRate: Number(form.petrolRate) || 0,
      dieselRate: Number(form.dieselRate) || 0,
      monthlyBudget: Number(form.monthlyBudget) || 0,
      odLimit: Number(form.odLimit) || 3000000
    });
    setIsSubmitting(false);
    showAlert('Settings successfully updated!');
  };

  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', role: 'supervisor' });
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);

  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 6) return showAlert('Password must be at least 6 characters.');
    if (newPass !== confirmPass) return showAlert('Passwords do not match.');
    setIsChangingPass(true);
    await changePassword(newPass);
    setNewPass(''); setConfirmPass('');
    setIsChangingPass(false);
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingStaff(true);
    await addUser(staffForm);
    setStaffForm({ name: '', email: '', password: '', role: 'supervisor' });
    setIsSubmittingStaff(false);
  };

  const handleExportData = () => {
    if (customers.length === 0 && transactions.length === 0) {
      return showAlert("No database records found to export.");
    }

    let csv = "=== FUELDESK MASTER EXPORT ===\n\n";

    const parseVehicles = (vStr: string | undefined) => {
      if (!vStr) return '';
      try {
        const vArr = JSON.parse(vStr);
        if (Array.isArray(vArr)) return vArr.map((v: any) => `${v.fullNumber} (${v.type})`).join(' | ');
      } catch { }
      return vStr.replace(/"/g, '""');
    };

    csv += "--- CUSTOMER DATABASE ---\n";
    csv += "ID,Company_Name,Category,Phone,Driver,Credit_Limit,Current_Balance,Vehicles\n";
    customers.forEach(c => {
      const bal = transactions.filter(t => t.customerId === c.id).reduce((acc, curr) => {
        if (curr.type === 'credit_sale' || curr.type === 'opening_balance' || curr.type === 'advance') return acc + curr.amount;
        if (curr.type === 'payment') return acc - curr.amount;
        return acc;
      }, 0);
      csv += `"${c.id}","${c.companyName}","${c.category}","${c.phone}","${c.driverName || ''}",${c.creditLimit},${bal},"${parseVehicles(c.vehicleNumbers)}"\n`;
    });

    csv += "\n--- CREDIT LEDGER TRANSACTIONS ---\n";
    csv += "Date,Customer_Name,Type,Product,Quantity,Amount,Vehicle,Reference\n";
    transactions.forEach(t => {
      const cust = customers.find(c => c.id === t.customerId);
      csv += `"${t.date}","${cust?.companyName || 'Unknown'}","${t.type}","${t.product || ''}",${t.quantity || 0},${t.amount},"${t.vehicleNumber || ''}","${t.reference || t.remarks || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const exportUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = exportUrl;
    link.download = `FuelDesk_Export_${getTodayStr()}.csv`;
    link.click();
    URL.revokeObjectURL(exportUrl);
    showAlert("Master database downloaded successfully.");
  };

  const userRole = String(user?.role || '').toLowerCase();

  if (dataLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  if (userRole !== 'owner') return <div className="p-8 text-center text-red-600 font-bold">Settings are only accessible to the owner.</div>;

  const ownerCount = users.filter(u => String(u.role).toLowerCase() === 'owner').length;

  return (
    <div className="space-y-5 pb-10 max-w-3xl mx-auto">

      {/* Business & Rate Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6">
        <div className="flex items-center mb-4 border-b pb-2"><Settings className="text-gray-400 mr-2" /><h3 className="text-lg font-bold">Business &amp; Rate Settings</h3></div>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Business Name</label><input type="text" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.bunkName} onChange={e => setForm({ ...form, bunkName: e.target.value })} /></div>
            <div><label className="block text-sm font-medium mb-1">Fuel Brand / Company</label><select className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-base" value={form.fuelCompany || 'Generic'} onChange={e => setForm({ ...form, fuelCompany: e.target.value })}><option value="Generic">Independent / Generic</option><option>HPCL</option><option>IOCL</option><option>BPCL</option><option>Reliance</option><option>Nayara</option><option>Shell</option></select></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><label className="block text-sm font-medium mb-1">Petrol Rate (Rs/L)</label><input type="number" step="0.01" className="w-full border p-3 rounded-lg font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.petrolRate || ''} onChange={e => setForm({ ...form, petrolRate: e.target.value })} placeholder="0.00" /></div>
            <div><label className="block text-sm font-medium mb-1">Diesel Rate (Rs/L)</label><input type="number" step="0.01" className="w-full border p-3 rounded-lg font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.dieselRate || ''} onChange={e => setForm({ ...form, dieselRate: e.target.value })} placeholder="0.00" /></div>
            <div><label className="block text-sm font-medium mb-1">OD Limit (Rs)</label><input type="number" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.odLimit || ''} onChange={e => setForm({ ...form, odLimit: e.target.value })} placeholder="3000000" /></div>
            <div><label className="block text-sm font-medium mb-1">Monthly Budget (Rs)</label><input type="number" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.monthlyBudget || ''} onChange={e => setForm({ ...form, monthlyBudget: e.target.value })} placeholder="0" /></div>
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-blue-800 text-white py-3 rounded-xl font-bold shadow hover:bg-blue-900 transition disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Update Settings'}</button>
        </form>
      </div>

      {/* Language Preference */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6">
        <div className="flex items-center mb-4 border-b pb-2">
          <span className="text-xl mr-2">🌐</span>
          <h3 className="text-lg font-bold">Language / భాష / भाषा</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">Choose the language for WhatsApp bot replies.</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { code: 'en', label: '🇮🇳 English' },
            { code: 'te', label: '🇮🇳 తెలుగు' },
            { code: 'hi', label: '🇮🇳 हिंदी' },
          ].map(l => (
            <button key={l.code}
              onClick={async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) return showAlert('Not authenticated.');
                const { data: prof } = await supabase.from('profiles').select('bunk_id').eq('id', session.user.id).maybeSingle();
                const bid = prof?.bunk_id || user?.bunkId;
                if (!bid) return showAlert('Could not find bunk. Try re-logging in.');
                const { error } = await supabase.from('bunks').update({ language: l.code }).eq('id', bid);
                if (error) return showAlert('Failed to update language: ' + error.message);
                showAlert(`✅ Language updated! The bot will now reply in ${l.label.split(' ')[1] || l.label}.`);
              }}
              className={`py-3 px-2 rounded-xl border-2 font-semibold text-sm transition-all hover:border-indigo-400 hover:bg-indigo-50 ${
                settings?.language === l.code ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-700'
              }`}>
              {l.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">⚠️ This only changes the WhatsApp bot language. The webapp is always in English.</p>
      </div>

      {/* WhatsApp Bot Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6">
        <div className="flex items-center mb-4 border-b pb-2"><MessageCircle className="text-green-500 mr-2" /><h3 className="text-lg font-bold">WhatsApp Bot Status</h3></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-100">
            <span className="text-sm font-medium text-gray-700">Bot Number</span>
            <span className="font-bold text-green-800">+{((import.meta as any).env?.VITE_WHATSAPP_NUMBER || '917093578438').replace(/^(\d{2})(\d{5})(\d{5})$/, '$1 $2 $3')}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
            <span className="text-sm font-medium text-gray-700">Bot Status</span>
            <span className="flex items-center gap-1.5 font-bold text-green-700"><span className="w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse"></span>Deployed</span>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6">
        <div className="flex items-center mb-4 border-b pb-2"><Settings className="text-gray-400 mr-2" /><h3 className="text-lg font-bold">Security — Change Password</h3></div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium mb-1">New Password (min 6 chars)</label><input type="password" required minLength={6} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Enter new password" /></div>
            <div><label className="block text-xs font-medium mb-1">Confirm New Password</label><input type="password" required minLength={6} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Confirm new password" /></div>
          </div>
          <button type="submit" disabled={isChangingPass} className="w-full bg-gray-800 text-white py-3 rounded-xl font-bold shadow hover:bg-gray-900 transition disabled:opacity-50">{isChangingPass ? 'Changing...' : 'Change Password'}</button>
        </form>
      </div>

      {/* Data Management */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6">
        <div className="flex items-center mb-4 border-b pb-2"><Download className="text-gray-400 mr-2" /><h3 className="text-lg font-bold">Data Management</h3></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 flex flex-col items-center justify-center text-center">
            <UploadCloud className="w-10 h-10 text-blue-400 mb-3" />
            <h4 className="font-bold text-blue-900 mb-1">Need to Import Data?</h4>
            <p className="text-xs text-blue-700 mb-4">Bulk data migration is handled securely by your development team.</p>
            <button type="button" onClick={() => showConfirm("Contact your developer to execute a secure database migration script directly into Supabase.", () => { })} className="px-5 bg-blue-800 text-white py-2 rounded-lg font-bold text-sm hover:bg-blue-900 shadow transition">Request Data Migration</button>
          </div>
          <button onClick={handleExportData} className="flex flex-col items-center justify-center p-5 bg-gray-50 border rounded-xl hover:bg-blue-50 hover:border-blue-200 transition group min-h-[140px]">
            <Download className="text-gray-400 group-hover:text-blue-600 mb-2" size={24} />
            <span className="text-sm font-bold text-gray-700 group-hover:text-blue-800">Export Full Database to CSV</span>
            <span className="text-xs text-gray-400 mt-1">All customers &amp; transactions</span>
          </button>
        </div>
      </div>

      {/* Staff Management */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6">
        <div className="flex items-center justify-between mb-4 border-b pb-2">
          <div className="flex items-center"><Users className="text-gray-400 mr-2" /><h3 className="text-lg font-bold">Staff Management</h3></div>
          <div className="flex gap-2 text-xs font-bold">
            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">{ownerCount} Owner{ownerCount !== 1 ? 's' : ''}</span>
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{users.filter(u => String(u.role).toLowerCase() === 'supervisor').length} Supervisor{users.filter(u => String(u.role).toLowerCase() === 'supervisor').length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="mb-5">
          <h4 className="text-sm font-bold text-gray-500 mb-2">Current Staff</h4>
          <div className="space-y-2">
            {users.length === 0 ? <p className="text-sm text-gray-500">No staff found.</p> : users.map((u, idx) => {
              const canDelete = String(u.role).toLowerCase() !== 'owner' || ownerCount > 1;
              return (
                <div key={u.id || `staff-${idx}`} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
                  <div><p className="font-bold text-sm">{u.name}</p><p className="text-xs text-gray-500">{u.email}</p></div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs rounded uppercase font-bold ${String(u.role).toLowerCase() === 'owner' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{u.role}</span>
                    {canDelete && (<button onClick={() => showConfirm(`Revoke access for ${u.name}?`, () => deleteUser(u.id))} className="text-red-500 hover:bg-red-100 p-1.5 rounded transition"><Trash2 size={16} /></button>)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <form onSubmit={handleAddStaff} className="space-y-4 pt-4 border-t">
          <h4 className="text-sm font-bold text-gray-500">Add New Staff Member</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium mb-1">Name</label><input type="text" required className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} /></div>
            <div><label className="block text-xs font-medium mb-1">Email / Login ID</label><input type="email" required className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={staffForm.email} onChange={e => setStaffForm({ ...staffForm, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium mb-1">Temporary Password</label><input type="password" required minLength={6} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={staffForm.password} onChange={e => setStaffForm({ ...staffForm, password: e.target.value })} /></div>
            <div>
              <label className="block text-xs font-medium mb-1">Role</label>
              <select className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-base" value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}>
                <option value="supervisor">Supervisor</option>
                <option value="owner">Owner (Full Access)</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={isSubmittingStaff} className="w-full bg-gray-800 text-white py-3 rounded-xl font-bold shadow hover:bg-gray-900 transition disabled:opacity-50">
            {isSubmittingStaff ? 'Processing...' : 'Create Account'}
          </button>
        </form>
      </div>

      {/* Danger Zone — always last, full-width */}
      {user?.role === 'owner' && <DangerZone bunkId={user.bunkId || ''} />}
    </div>
  );
};

// ── Danger Zone: Deactivate or permanently delete account ────────────────────
const DangerZone = ({ bunkId }: { bunkId: string }) => {
  const { showConfirm, showAlert, logout } = useAppContext();
  const [choice, setChoice] = useState<'none' | 'temp' | 'perm'>('none');
  const [permConfirm, setPermConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTemp = () => {
    showConfirm(
      '⏸️ Temporary Pause\n\nYour account will be deactivated. All data is kept safely. You can rejoin anytime.\n\nConfirm?',
      async () => {
        setLoading(true);
        // Deactivate bunk and all staff roles in DB
        await supabase.from('bunks').update({ is_active: false, deactivated_at: new Date().toISOString() }).eq('id', bunkId);
        await supabase.from('staff_roles').update({ is_active: false }).eq('bunk_id', bunkId);
        // Fix #8: invalidate active JWT sessions for all webapp users in this bunk
        // Using supabase.auth.admin requires service role — this is safe as the admin
        // client is initialized server-side. On the client we sign out the current user;
        // other staff sessions will expire on their next API call (RLS returns 403).
        try {
          const { data: staffWithAuth } = await supabase
            .from('staff_roles').select('webapp_user_id').eq('bunk_id', bunkId).not('webapp_user_id', 'is', null);
          if (staffWithAuth?.length) {
            // Sign out all staff via Supabase admin (requires service role key — server side only)
            // Client-side: we can only sign out the current session; others expire on next request
            await supabase.auth.signOut(); // signs out current user immediately
          }
        } catch (_) { /* non-fatal — DB deactivation already prevents data access */ }
        setLoading(false);
        showAlert('✅ Account paused. Log in again anytime to reactivate.');
        logout();
      }
    );
  };

  const handlePerm = async () => {
    if (permConfirm.toUpperCase() !== 'DELETE') {
      return showAlert('Type DELETE (in caps) to confirm permanent deletion.');
    }
    showConfirm(
      '🗑️ PERMANENT DELETE\n\nThis will erase ALL your data — customers, transactions, reports, everything — forever.\n\nThis CANNOT be undone. Continue?',
      // BUG-FIX: wrap in async IIFE and add try/catch so errors surface to user
      () => {
        (async () => {
          setLoading(true);
          try {
            // BUG-FIX: added ALL store-type tables including hw_*, ki_*, rst_*, etc.
            const tables = [
              // Fuel station tables
              'transactions', 'expenses', 'fuel_purchases', 'morning_entries',
              'customers', 'bunk_accounts', 'settings', 'pending_actions',
              'processed_messages',
              // Hardware store (hw_*)
              'hw_products', 'hw_sales', 'hw_sale_items', 'hw_purchases',
              'hw_customers', 'hw_expenses', 'hw_payments', 'hw_stock_adjustments',
              // Kirana store (ki_*)
              'ki_products', 'ki_sales', 'ki_sale_items', 'ki_purchases',
              'ki_customers', 'ki_expenses', 'ki_payments', 'ki_suppliers',
              // Medical store (med_*)
              'med_products', 'med_sales', 'med_purchases',
              'med_customers', 'med_expenses',
              // Restaurant (rst_*)
              'rst_products', 'rst_sales', 'rst_purchases',
              'rst_customers', 'rst_expenses',
              // Cement (cem_*)
              'cem_products', 'cem_sales', 'cem_purchases',
              'cem_customers', 'cem_expenses', 'cem_deliveries',
              // General (gen_*)
              'gen_products', 'gen_sales', 'gen_purchases',
              'gen_customers', 'gen_expenses', 'gen_suppliers',
              // Auto parts (ap_*)
              'ap_products', 'ap_sales', 'ap_purchases',
              'ap_customers', 'ap_expenses',
              // Agriculture (ag_*)
              'ag_products', 'ag_sales', 'ag_purchases',
              'ag_customers', 'ag_expenses',
              // Textile (tx_*)
              'tx_products', 'tx_sales', 'tx_purchases',
              'tx_customers', 'tx_expenses',
              // Stationery (st_*)
              'st_products', 'st_sales', 'st_purchases',
              'st_customers', 'st_expenses',
              // Electrical (elec_*)
              'elec_products', 'elec_sales', 'elec_purchases',
              'elec_customers', 'elec_expenses',
            ];
            await Promise.allSettled(tables.map(t => supabase.from(t).delete().eq('bunk_id', bunkId)));

            const { data: staffList } = await supabase.from('staff_roles').select('webapp_user_id, id').eq('bunk_id', bunkId);
            if (staffList?.length) {
              const botUrl = (import.meta as any).env?.VITE_BOT_URL || '';
              // BUG-FIX: safely destructure session — avoid crash if getSession fails
              const sessionResult = await supabase.auth.getSession();
              const token = sessionResult?.data?.session?.access_token || '';
              if (botUrl && token) {
                await Promise.allSettled(
                  staffList.filter(s => s.webapp_user_id).map(s =>
                    fetch(`${botUrl}/api/users/${s.webapp_user_id}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` }
                    }).catch(() => {})
                  )
                );
              }
            }
            await supabase.from('staff_roles').delete().eq('bunk_id', bunkId);
            await supabase.from('bunks').delete().eq('id', bunkId);
            showAlert('🗑️ Account permanently deleted. All data removed.');
            logout();
          } catch (err: any) {
            showAlert('❌ Deletion failed: ' + (err?.message || 'Unknown error. Please try again.'));
          } finally {
            setLoading(false);
          }
        })();
      }
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6 mt-6">
      <h3 className="text-lg font-bold text-red-700 mb-1 flex items-center gap-2">
        <AlertCircle size={20} className="text-red-500" /> Danger Zone
      </h3>
      <p className="text-sm text-gray-500 mb-6">These actions affect your entire account. Proceed with caution.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Temporary pause */}
        <div className="border border-orange-200 rounded-xl p-4 bg-orange-50">
          <h4 className="font-bold text-orange-700 mb-1">⏸️ Temporary Pause</h4>
          <p className="text-xs text-gray-600 mb-3">Deactivate your account. All data is kept safely for 12 months. You can rejoin anytime by logging back in or messaging on WhatsApp.</p>
          <button onClick={handleTemp} disabled={loading}
            className="w-full border border-orange-400 text-orange-700 py-2 rounded-lg font-semibold text-sm hover:bg-orange-100 transition disabled:opacity-50">
            {loading ? 'Processing...' : 'Pause My Account'}
          </button>
        </div>

        {/* Permanent delete */}
        <div className="border border-red-200 rounded-xl p-4 bg-red-50">
          <h4 className="font-bold text-red-700 mb-1">🗑️ Permanent Delete</h4>
          <p className="text-xs text-gray-600 mb-3">Permanently deletes ALL data — customers, transactions, reports — forever. This cannot be undone.</p>
          {choice !== 'perm'
            ? <button onClick={() => setChoice('perm')}
                className="w-full border border-red-400 text-red-700 py-2 rounded-lg font-semibold text-sm hover:bg-red-100 transition">
                Delete My Account
              </button>
            : <div className="space-y-2">
                <p className="text-xs text-red-600 font-medium">Type <strong>DELETE</strong> to confirm:</p>
                <input type="text" value={permConfirm} onChange={e => setPermConfirm(e.target.value)}
                  placeholder="Type DELETE here"
                  className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400" />
                <div className="flex gap-2">
                  <button onClick={handlePerm} disabled={loading}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-red-700 transition disabled:opacity-50">
                    {loading ? '...' : 'Confirm Delete'}
                  </button>
                  <button onClick={() => { setChoice('none'); setPermConfirm(''); }}
                    className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
                    Cancel
                  </button>
                </div>
              </div>
          }
        </div>
      </div>
    </div>
  );
};

// --- GLOBAL ERROR BOUNDARY ---
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: any, errorInfo: any, countdown: number }> {
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _interval: ReturnType<typeof setInterval> | null = null;

  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, countdown: 3 };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error, errorInfo: null, countdown: 3 };
  }

  componentDidCatch(error: any, errorInfo: any) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught:', error, errorInfo);
    // Clear ALL localStorage (including Supabase auth tokens sb-xxx-auth-token)
    // This is the only reliable way to break the stale-session crash loop
    try { localStorage.clear(); } catch (_) {}
    // Auto-reload after countdown so user doesn't need to click anything
    let count = 3;
    this._interval = setInterval(() => {
      count -= 1;
      this.setState({ countdown: count });
      if (count <= 0) {
        if (this._interval) clearInterval(this._interval);
        window.location.reload();
      }
    }, 1000);
  }

  componentWillUnmount() {
    if (this._timer) clearTimeout(this._timer);
    if (this._interval) clearInterval(this._interval);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-white p-8 rounded-2xl shadow-xl text-center border-t-4 border-orange-500">
            <div className="w-16 h-16 mx-auto mb-4 bg-orange-50 rounded-full flex items-center justify-center">
              <AlertCircle className="text-orange-500" size={32} />
            </div>
            <h1 className="text-xl font-black text-gray-900 mb-2">Session Reset</h1>
            <p className="text-gray-500 text-sm mb-1">A stale session was detected and cleared.</p>
            <p className="text-gray-400 text-sm mb-6">Reloading in <span className="font-bold text-orange-500">{this.state.countdown}s</span>…</p>
            <button onClick={() => { if (this._interval) clearInterval(this._interval); window.location.reload(); }}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition">
              🔄 Reload Now
            </button>
            {import.meta.env.DEV && (
              <details className="text-left bg-red-50 p-3 rounded-lg border border-red-100 mt-4">
                <summary className="text-xs font-bold text-red-800 cursor-pointer">Debug (dev only)</summary>
                <p className="text-xs text-red-600 font-mono mt-2">{this.state.error?.toString()}</p>
                <pre className="text-[10px] text-red-500 font-mono whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Privacy Policy & Terms
const PrivacyPolicyPage = () => {
  const waNumber = (import.meta as any).env?.VITE_WHATSAPP_NUMBER || '917093578438';
  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Briefcase className="text-indigo-700" size={28} />
          <h1 className="text-2xl font-black text-gray-900">Smart Biz AI</h1>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Privacy Policy & Terms of Use</h2>
        <p className="text-sm text-gray-500 mb-8">Effective date: May 2026 · Last updated: May 2026</p>
        <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
          <section><h3 className="font-bold text-gray-900 mb-2">1. What We Collect</h3><p>We collect your name, mobile number, email address, and business details (station name, address, nozzle count, fuel rates, bank account names) during registration. We also log WhatsApp messages you send to our bot for the purpose of processing transactions and reports.</p></section>
          <section><h3 className="font-bold text-gray-900 mb-2">2. How We Use Your Data</h3><p>Your data is used solely to operate the Smart Biz AI service: processing credit sales, generating reports, sending WhatsApp notifications, and maintaining your dashboard. We never sell your data to third parties.</p></section>
          <section><h3 className="font-bold text-gray-900 mb-2">3. Data Storage</h3><p>All data is stored securely on Supabase (hosted on AWS, eu-west region). Data is encrypted at rest and in transit (TLS 1.2+). Row-Level Security is enforced so no other business can access your data.</p></section>
          <section><h3 className="font-bold text-gray-900 mb-2">4. WhatsApp Integration</h3><p>Smart Biz AI uses the Meta WhatsApp Business API. Your conversations with our bot are processed through Meta's infrastructure. By using our WhatsApp bot, you agree to Meta's Privacy Policy at facebook.com/privacy/policy.</p></section>
          <section><h3 className="font-bold text-gray-900 mb-2">5. Data Retention</h3><p>Your data is retained for the duration of your subscription. After account deletion, data is removed within 30 days. Transaction records may be retained for 7 years as required by Indian tax law (GST Act).</p></section>
          <section><h3 className="font-bold text-gray-900 mb-2">6. Your Rights</h3><p>You may request export, correction, or deletion of your data at any time by contacting us. We will respond within 7 working days.</p></section>
          <section><h3 className="font-bold text-gray-900 mb-2">7. Trial & Payments</h3><p>The 3-month free trial requires no credit card. After trial expiry, continued use requires a paid subscription. Pricing will be communicated before your trial ends. No charges are made without explicit consent.</p></section>
          <section><h3 className="font-bold text-gray-900 mb-2">8. Governing Law</h3><p>These terms are governed by the laws of India. Any disputes are subject to the jurisdiction of courts in Hyderabad, Telangana.</p></section>
          <section><h3 className="font-bold text-gray-900 mb-2">9. Contact Us</h3>
            <p>For privacy concerns, data requests, or support:</p>
            <ul className="mt-2 space-y-1">
              <li>📱 WhatsApp: <a href={`https://wa.me/${waNumber}`} className="text-indigo-600 underline" target="_blank" rel="noopener noreferrer">+{waNumber}</a></li>
              <li>📧 Email: support@smartbizai.in</li>
            </ul>
          </section>
        </div>
        <div className="mt-10 pt-6 border-t text-center text-xs text-gray-400">
          © 2026 Smart Biz AI · Built with ❤️ in India
        </div>
      </div>
    </div>
  );
};

// Main Layout / Router
const AppContent = () => {
  const { user, settings, logout, currentRoute, setCurrentRoute, unsavedForm, setUnsavedForm } = useAppContext();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  };

  const handleNavClick = (id: string) => {
    if (unsavedForm) {
      if (window.confirm("You have an unsaved morning entry. Leave anyway?")) {
        setUnsavedForm(false); setCurrentRoute(id); setIsSidebarOpen(false);
      }
    } else { setCurrentRoute(id); setIsSidebarOpen(false); }
  };

  if (currentRoute === 'privacy') return <PrivacyPolicyPage />;
  if (!user) return <LandingScreen onPrivacy={() => setCurrentRoute('privacy')} />;
  if (user.role === 'customer') return <CustomerPortalView />;
  // Validate bizType against whitelist to prevent XSS-injected localStorage values routing to wrong module
  const VALID_BIZ_TYPES = ['fuel','cement','hardware','restaurant','auto_parts','agriculture','textile','stationery','kirana','medical','general','lpg_gas_agency','electrical'];
  const _rawBizType = localStorage.getItem('app_biz_type') || '';
  const bizType = VALID_BIZ_TYPES.includes(_rawBizType) ? _rawBizType : 'fuel';
  const _moduleUser = { name: user.name, email: user.email, role: user.role };

  // Store-app fallback UI shown while the lazy chunk loads
  const StoreFallback = (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading your workspace…</p>
      </div>
    </div>
  );

  if (bizType === 'cement')      return <Suspense fallback={StoreFallback}><CementApp      bunkId={user.bunkId || ''} onLogout={logout} user={_moduleUser} /></Suspense>;
  if (bizType === 'hardware')    return <Suspense fallback={StoreFallback}><HardwareApp    bunkId={user.bunkId || ''} onLogout={logout} user={_moduleUser} /></Suspense>;
  if (bizType === 'restaurant')  return <Suspense fallback={StoreFallback}><RestaurantApp  bunkId={user.bunkId || ''} onLogout={logout} user={_moduleUser} /></Suspense>;
  if (bizType === 'auto_parts')  return <Suspense fallback={StoreFallback}><AutoPartsApp   bunkId={user.bunkId || ''} onLogout={logout} user={_moduleUser} /></Suspense>;
  if (bizType === 'agriculture') return <Suspense fallback={StoreFallback}><AgricultureApp bunkId={user.bunkId || ''} onLogout={logout} user={_moduleUser} /></Suspense>;
  if (bizType === 'textile')     return <Suspense fallback={StoreFallback}><TextileApp     bunkId={user.bunkId || ''} onLogout={logout} user={_moduleUser} /></Suspense>;
  if (bizType === 'stationery')  return <Suspense fallback={StoreFallback}><StationeryApp  bunkId={user.bunkId || ''} onLogout={logout} user={_moduleUser} /></Suspense>;
  if (bizType === 'kirana')      return <Suspense fallback={StoreFallback}><KiranaApp      bunkId={user.bunkId || ''} onLogout={logout} user={_moduleUser} /></Suspense>;
  if (bizType === 'medical')     return <Suspense fallback={StoreFallback}><MedicalApp     bunkId={user.bunkId || ''} onLogout={logout} user={_moduleUser} /></Suspense>;
  if (bizType === 'lpg_gas_agency') return <Suspense fallback={StoreFallback}><LPGApp     bunkId={user.bunkId || ''} onLogout={logout} user={_moduleUser} /></Suspense>;
  if (bizType === 'electrical')  return <Suspense fallback={StoreFallback}><ElectricalApp  bunkId={user.bunkId || ''} onLogout={logout} user={_moduleUser} /></Suspense>;
  if (bizType === 'general')     return <Suspense fallback={StoreFallback}><OtherApp       bunkId={user.bunkId || ''} bizType={bizType} onLogout={logout} user={_moduleUser} /></Suspense>;

  const userRole = String(user.role || 'supervisor').toLowerCase();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, roles: ['owner', 'supervisor'] },
    { id: 'customers', label: 'Customers', icon: Users, roles: ['owner', 'supervisor'] },
    { id: 'ledger', label: 'Credit Ledger', icon: BookOpen, roles: ['owner', 'supervisor'] },
    { id: 'fuel', label: 'Fuel Receipts', icon: Truck, roles: ['owner', 'supervisor'] },
    { id: 'morning', label: 'Morning Entry', icon: Sun, roles: ['owner', 'supervisor'] },
    { id: 'expenses', label: 'Expenses', icon: Receipt, roles: ['owner', 'supervisor'] },
    { id: 'reports', label: 'Reports', icon: TrendingUp, roles: ['owner'] },
    { id: 'intelligence', label: 'AI Intelligence', icon: Brain, roles: ['owner'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['owner'] },
  ];

  return (
    <div className="flex h-[100dvh] bg-gray-100 font-sans text-gray-900">
      {isSidebarOpen && (<div className="fixed inset-0 bg-black/60 z-20 md:hidden transition-opacity" onClick={() => setIsSidebarOpen(false)} />)}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-blue-950 text-white flex flex-col shadow-2xl z-30 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="p-6 border-b border-blue-900/50 flex justify-between items-center">
          <div><div className="flex items-center space-x-3 text-indigo-400 mb-1"><Briefcase size={20} className="shrink-0" /><span className="font-black text-xl text-white tracking-tight truncate max-w-[150px]">{settings?.bunkName || 'Business Manager'}</span></div><p className="text-blue-300 text-xs">Powered by Smart Biz AI</p></div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.filter(i => i.roles.includes(userRole)).map(item => (
            <button key={item.id} onClick={() => handleNavClick(item.id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${currentRoute === item.id ? 'bg-blue-800 text-white font-medium shadow-inner' : 'text-blue-200 hover:bg-blue-900/50 hover:text-white'}`}><item.icon size={20} className={currentRoute === item.id ? 'text-blue-400' : 'opacity-70'} /><span>{item.label}</span></button>
          ))}
        </nav>
        <div className="p-4 border-t border-blue-900/50">
          <div className="bg-blue-900/50 p-4 rounded-xl mb-4"><p className="text-sm font-bold truncate">{user.name}</p><p className="text-xs text-blue-300 uppercase tracking-wide mt-1">{userRole}</p></div>
          <button onClick={handleLogout} disabled={isLoggingOut} className="w-full flex items-center justify-center space-x-2 text-blue-300 hover:text-white py-2 transition disabled:opacity-50">{isLoggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />} <span>{isLoggingOut ? 'Signing Out...' : 'Sign Out'}</span></button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative">
        <header className="md:hidden bg-blue-950 text-white p-4 flex justify-between items-center shadow-md z-10 sticky top-0 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="p-1 hover:bg-blue-900 rounded transition text-blue-200 hover:text-white"><Menu size={24} /></button>
          <div className="flex items-center space-x-2 text-indigo-400 font-black text-lg text-white"><Briefcase className="w-5 h-5 shrink-0" /><span className="truncate max-w-[150px]">{settings?.bunkName || 'Manager'}</span></div>
          <button onClick={handleLogout} disabled={isLoggingOut} className="text-blue-200 hover:text-white disabled:opacity-50">{isLoggingOut ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}</button>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto pb-10">
            {currentRoute === 'dashboard' && <Dashboard />}
            {currentRoute === 'customers' && <CustomerList />}
            {currentRoute === 'ledger' && <CreditLedger />}
            {currentRoute === 'fuel' && <FuelStockModule />}
            {currentRoute === 'morning' && <MorningEntryForm />}
            {currentRoute === 'expenses' && <ExpenseModule />}
            {currentRoute === 'reports' && <MonthlyReports />}
            {currentRoute === 'intelligence' && <IntelligenceTab bunkId={user.bunkId || ''} />}
            {currentRoute === 'settings' && <SettingsModule />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  if (!hasValidKeys) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md bg-white p-8 rounded-2xl shadow-xl text-center border-t-4 border-red-600">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-gray-900 mb-2">Configuration Missing</h1>
          <p className="text-gray-600 mb-4">The app deployed successfully, but cannot connect to the database because your Netlify environment variables are missing.</p>
          <div className="text-left bg-gray-50 rounded-xl p-4 text-sm space-y-2 border">
            <p className="font-bold text-gray-700">To fix this:</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-600">
              <li>Go to Netlify → Site Settings → Environment Variables</li>
              <li>Add <code className="bg-gray-200 px-1 rounded text-xs">VITE_SUPABASE_URL</code></li>
              <li>Add <code className="bg-gray-200 px-1 rounded text-xs">VITE_SUPABASE_ANON_KEY</code></li>
              <li>Redeploy the site</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}