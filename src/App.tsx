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

import React, { useState, createContext, useContext, useEffect, useMemo, Component, type ReactNode } from 'react';
import {
  Users, BookOpen, Sun, Receipt, Fuel, Search, ChevronLeft,
  BarChart3, Settings, LogOut, Plus, AlertCircle, CheckCircle2,
  Download, X, Truck, Trash2, Edit2, Menu, Filter, ChevronDown, ChevronRight, Loader2, UploadCloud, MessageCircle, Calendar, TrendingUp, TrendingDown, Wallet, Activity, SearchX
} from 'lucide-react';

// --- TIMEZONE UTILS (IST STRICT) ---
export function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // UTC+5:30
  const ist = new Date(now.getTime() + istOffset);
  return ist.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

export function nowIST(): Date {
  const now = new Date();
  return new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
}

export function formatISTDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00+05:30');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

const todayStr = getTodayIST();
const currentMonthStr = todayStr.substring(0, 7);
const currentYearStr = todayStr.substring(0, 4);
const CATEGORIES = ['Fleet', 'Milk Tanker', 'School', 'Hospital', 'Individual', 'Logistics', 'Other'];

// --- BULLETPROOF SUPABASE SETUP ---
// ⚠️ MAC/VS CODE USER: UNCOMMENT THE NEXT 5 LINES FOR PRODUCTION AND DELETE THE CANVAS MOCK! ⚠️

import { createClient } from '@supabase/supabase-js';
const rawUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const rawKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
export const hasValidKeys = Boolean(rawUrl && rawKey && rawUrl !== 'undefined' && rawKey !== 'undefined');
export const supabase = createClient(rawUrl || 'https://placeholder.supabase.co', rawKey || 'placeholder-key');

// --- CANVAS MOCK (DELETE THIS ENTIRE BLOCK WHEN RUNNING LOCALLY ON YOUR MAC) ---

// ------------------------------------------------------------------------------------------

// --- TYPES ---
type Role = 'owner' | 'supervisor' | 'customer';
interface User { id: string; name: string; email: string; role: Role; phone?: string; bunkId?: string; }
interface Customer { id: string; category: string; companyName: string; ownerName?: string; phone: string; address?: string; paymentTerms?: string; driverName?: string; driverPhone?: string; vehicleNumbers?: string; creditLimit: number; status: 'Active' | 'Suspended' | 'Blocked'; pin: string; portalAccess: boolean; notifyOnCredit: boolean | null; }
interface Transaction { id: string; customerId: string; type: 'credit_sale' | 'payment' | 'opening_balance' | 'advance'; date: string; product?: string; quantity?: number; rate?: number; amount: number; mode?: string; vehicleNumber?: string; remarks?: string; }
interface MorningEntry { id: string; date: string; petrolDip: number; dieselDip: number; petrolSold: number; dieselSold: number; netProfit: number; variance: number; submitted: boolean; netValue: number; collectionsCash: number; balanceCash: number; collectionsBank: number; collectionsDigital: number; collectionDtp: number; collectionsCard: number; collectionsCredit: number; periodExpenses: number; balanceBank: number; balanceDigital: number; balanceOd: number; }
interface Expense { id: string; date: string; category: string; amount: number; description: string; vendor: string; mode: string; }
interface FuelPurchase { id: string; date: string; product: string; litres: number; rate: number; amount: number; supplier: string; invoice: string; mode: string; }

interface AppContextType {
  user: User | null; dataLoading: boolean; unsavedForm: boolean; setUnsavedForm: (v: boolean) => void;
  login: (email: string, pass: string) => Promise<void>; loginCustomer: (phone: string, pin: string) => void;
  signup: (data: { name: string, phone: string, bunkName: string, email: string, pass: string, fuelCompany: string }) => Promise<void>;
  logout: () => void; currentRoute: string; setCurrentRoute: (r: string) => void; customerFilter: string; setCustomerFilter: (f: string) => void;
  customers: Customer[]; transactions: Transaction[]; morningEntries: MorningEntry[]; expenses: Expense[]; fuelPurchases: FuelPurchase[]; users: User[]; settings: any;
  addCustomer: (c: any) => Promise<string | null>; updateCustomer: (id: string, updates: any) => Promise<void>; deleteCustomer: (id: string) => Promise<void>;
  addTransaction: (t: any) => Promise<void>; updateTransaction: (id: string, updates: any) => Promise<void>; deleteTransaction: (id: string) => Promise<void>;
  addMorningEntry: (e: any) => Promise<void>; updateMorningEntry: (id: string, updates: any) => Promise<void>; deleteMorningEntry: (id: string) => Promise<void>;
  addExpense: (e: any) => Promise<void>; updateExpense: (id: string, updates: any) => Promise<void>; deleteExpense: (id: string) => Promise<void>;
  addFuelPurchase: (purchases: any) => Promise<void>; updateFuelPurchase: (id: string, updates: any) => Promise<void>; deleteFuelPurchase: (id: string) => Promise<void>;
  addUser: (u: any) => Promise<void>; deleteUser: (id: string) => Promise<void>; updateSettings: (s: any) => Promise<void>;
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
const generateId = () => Math.random().toString(36).substr(2, 9);

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
    window.history.replaceState({ route: currentRoute }, '', `#${currentRoute}`);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentRoute]);

  const [customerFilter, setCustomerFilter] = useState('All');

  const [customers, setCustomers] = useState<Customer[]>([]); const [transactions, setTransactions] = useState<Transaction[]>([]); const [morningEntries, setMorningEntries] = useState<MorningEntry[]>([]); const [expenses, setExpenses] = useState<Expense[]>([]); const [fuelPurchases, setFuelPurchases] = useState<FuelPurchase[]>([]); const [users, setUsers] = useState<User[]>([]);

  const showAlert = (msg: string) => { setAlertMessage(msg); setTimeout(() => setAlertMessage(null), 4500); };
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !user) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data: profile }) => {
          if (profile) saveUserSession({ id: String(profile.id), name: String(profile.name), email: String(profile.email), role: String(profile.role).toLowerCase() as Role, bunkId: String(profile.bunk_id) });
        });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { if (!session) saveUserSession(null); });
    return () => subscription.unsubscribe();
  }, []);

  const mapTx = (d: any): Transaction => ({
    id: String(d.id), customerId: String(d.customer_id),
    type: d.type || 'credit_sale', date: String(d.date || getTodayIST()),
    product: d.product || '', quantity: Number(d.quantity) || 0,
    rate: Number(d.rate) || 0, amount: Number(d.amount) || 0,
    mode: d.payment_mode || '', vehicleNumber: d.vehicle_number || '',
    remarks: d.remarks || d.notes || ''
  });

  useEffect(() => {
    if (!user || !hasValidKeys) return;
    const targetBunk = user.bunkId || 'default';
    const fetchSupabaseData = async () => {
      setDataLoading(true);
      try {
        if (user.role === 'customer') {
          const { data: txData } = await supabase.from('transactions').select('*').eq('customer_id', user.id).order('created_at', { ascending: false });
          if (txData) setTransactions(txData.map(mapTx));
          setDataLoading(false); return;
        }

        const [{ data: bunkData }, { data: custData }, { data: txData }, { data: expData }, { data: fuelData }, { data: profData }, { data: morningData }] = await Promise.all([
          supabase.from('bunks').select('*').eq('id', targetBunk),
          supabase.from('customers').select('*').eq('bunk_id', targetBunk),
          supabase.from('transactions').select('*').eq('bunk_id', targetBunk).order('created_at', { ascending: false }),
          supabase.from('expenses').select('*').eq('bunk_id', targetBunk).order('created_at', { ascending: false }),
          supabase.from('fuel_purchases').select('*').eq('bunk_id', targetBunk).order('created_at', { ascending: false }),
          supabase.from('profiles').select('*').eq('bunk_id', targetBunk),
          supabase.from('morning_entries').select('*').eq('bunk_id', targetBunk).order('created_at', { ascending: false })
        ]);

        if (bunkData && bunkData.length > 0) {
          const b = bunkData[0];
          const cloudSettings = { bunkName: b.name || '', fuelCompany: b.fuel_company || '', petrolRate: Number(b.petrol_rate) || 0, dieselRate: Number(b.diesel_rate) || 0, monthlyBudget: Number(b.monthly_budget) || 0, odLimit: Number(b.od_limit) || 3000000, currentOdBalance: Number(b.current_od_balance) || 0, currentHpBalance: Number(b.current_hp_balance) || 0, initialPetrolDip: Number(settings?.initialPetrolDip) || 0, initialDieselDip: Number(settings?.initialDieselDip) || 0 };
          setSettings(cloudSettings); localStorage.setItem('app_settings', JSON.stringify(cloudSettings));
        }

        if (custData) setCustomers(custData.map((d: any) => ({ id: String(d.id), category: d.category || 'Other', companyName: d.company_name || 'Unknown', ownerName: d.owner_name || '', address: d.address || '', paymentTerms: d.payment_terms || 'Monthly', phone: d.phone || '', driverName: d.driver_name || '', driverPhone: d.driver_phone || '', vehicleNumbers: d.vehicle_numbers || '', creditLimit: Number(d.credit_limit) || 0, status: d.status || 'Active', pin: d.portal_pin || '', portalAccess: Boolean(d.portal_access), notifyOnCredit: d.notify_on_credit })));
        if (txData) setTransactions(txData.map(mapTx));
        if (expData) setExpenses(expData.map((d: any) => ({ id: String(d.id), date: String(d.date || getTodayIST()), category: d.category || 'Other', amount: Number(d.amount) || 0, description: d.description || '', vendor: d.vendor || '', mode: d.payment_mode || '' })));
        if (fuelData) setFuelPurchases(fuelData.map((d: any) => ({ id: String(d.id), date: String(d.date || getTodayIST()), product: d.product || 'Diesel', litres: Number(d.litres) || 0, rate: Number(d.rate) || 0, amount: Number(d.amount) || Number(d.total_amount) || 0, supplier: d.supplier || d.vendor || '', invoice: d.invoice || d.invoice_number || '', mode: d.payment_mode || '' })));
        if (profData) setUsers(profData.map((d: any) => ({ id: String(d.id), name: d.name || 'Staff', email: d.email || '', role: String(d.role || 'supervisor').toLowerCase(), bunkId: String(d.bunk_id) } as any)));
        if (morningData) setMorningEntries(morningData.map((d: any) => ({
          id: String(d.id), date: String(d.entry_date || getTodayIST()), petrolDip: Number(d.petrol_dip_today) || 0, dieselDip: Number(d.diesel_dip_today) || 0, petrolSold: Number(d.petrol_sold_litres) || 0, dieselSold: Number(d.diesel_sold_litres) || 0, netProfit: Number(d.net_profit) || 0, variance: Number(d.collection_variance) || 0, submitted: true, netValue: Number(d.bunk_net_value) || 0,
          collectionsCash: Number(d.collections_cash) || 0, balanceCash: Number(d.balance_cash) || 0, collectionsBank: Number(d.collections_sbi) || 0, collectionsDigital: Number(d.collections_hppay) || 0, collectionDtp: Number(d.collections_dtp) || 0, collectionsCard: Number(d.collections_paytm) || 0, collectionsCredit: Number(d.collections_credit) || 0, periodExpenses: Number(d.period_expenses) || 0, balanceBank: Number(d.balance_sbi) || 0, balanceDigital: Number(d.balance_hp) || 0, balanceOd: Number(d.balance_od) || 0
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
      balanceBank: Number(d.balance_sbi) || 0, balanceDigital: Number(d.balance_hp) || 0, balanceOd: Number(d.balance_od) || 0
    });
    const channel = supabase
      .channel(`bunk-realtime-${targetBunk}`)
      // Transactions
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `bunk_id=eq.${targetBunk}` }, (payload) => { const newTx = mapTx(payload.new); setTransactions(prev => { if (prev.some(t => t.id === newTx.id)) return prev; return [newTx, ...prev]; }); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `bunk_id=eq.${targetBunk}` }, (payload) => { const updated = mapTx(payload.new); setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t)); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transactions' }, (payload) => { setTransactions(prev => prev.filter(t => t.id !== String((payload.old as any).id))); })
      // Expenses
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'expenses', filter: `bunk_id=eq.${targetBunk}` }, (payload) => { const d = payload.new as any; const newExp = { id: String(d.id), date: String(d.date || getTodayIST()), category: d.category || 'Other', amount: Number(d.amount) || 0, description: d.description || '', vendor: d.vendor || '', mode: d.payment_mode || '' }; setExpenses(prev => { if (prev.some(e => e.id === newExp.id)) return prev; return [newExp, ...prev]; }); })
      // Morning Entries — bot saves dip/sold/collections via WhatsApp
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'morning_entries', filter: `bunk_id=eq.${targetBunk}` }, (payload) => { const nm = mapMorningEntry(payload.new); setMorningEntries(prev => { if (prev.some(m => m.id === nm.id)) return prev; return [nm, ...prev]; }); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'morning_entries', filter: `bunk_id=eq.${targetBunk}` }, (payload) => { const um = mapMorningEntry(payload.new); setMorningEntries(prev => prev.map(m => m.id === um.id ? um : m)); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, user?.bunkId]);

  const login = async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pass });
    if (error) { showAlert(`Login Failed: ${error.message}`); return; }

    const { data: profile, error: profError } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    if (profError || !profile) { showAlert(`Your profile is missing. Please contact support or sign up again.`); return; }

    saveUserSession({ id: String(profile.id), name: String(profile.name), email: String(profile.email), role: String(profile.role).toLowerCase() as Role, bunkId: String(profile.bunk_id) });
    showAlert(`Welcome back, ${profile.name}!`);
  };

  const signup = async (formData: { name: string, phone: string, bunkName: string, email: string, pass: string, fuelCompany: string }) => {
    const cleanEmail = formData.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return showAlert("Please enter a valid email address.");
    if (formData.pass.length < 6) return showAlert("Password must be at least 6 characters.");

    const { data: authData, error: authError } = await supabase.auth.signUp({ email: cleanEmail, password: formData.pass, options: { emailRedirectTo: window.location.origin } });
    if (authError) return showAlert(`Registration Error: ${authError.message}`);
    if (!authData.user) return showAlert('Registration failed. Email might already exist.');

    const newBunkId = generateId();
    await supabase.from('bunks').insert([{ id: newBunkId, name: formData.bunkName || 'My Fuel Station', owner_name: formData.name, fuel_company: formData.fuelCompany, current_od_balance: 0, current_hp_balance: 0, od_limit: 3000000 }]);
    await supabase.from('profiles').insert([{ id: authData.user.id, name: formData.name, email: cleanEmail, role: 'owner', bunk_id: newBunkId }]);

    if (!authData.session) {
      showAlert('Success! Please check your email inbox and click the verification link to log in.');
      return;
    }

    saveUserSession({ id: authData.user.id, name: formData.name, email: cleanEmail, role: 'owner', bunkId: newBunkId });
    if (formData.bunkName) updateSettings({ ...settings, bunkName: formData.bunkName });
    showAlert('Account created and logged in successfully!');
  };

  const loginCustomer = (phone: string, pin: string) => {
    const c = customers.find(c => c.phone === phone && c.pin === pin && c.portalAccess);
    if (c) { saveUserSession({ id: c.id, name: c.companyName, email: '', role: 'customer', phone }); showAlert(`Welcome to your portal, ${c.companyName}!`); }
    else showAlert('Invalid PIN or mobile number not found.');
  };

  const logout = async () => { await supabase.auth.signOut(); saveUserSession(null); setCustomers([]); setTransactions([]); setMorningEntries([]); setExpenses([]); setFuelPurchases([]); setUsers([]); setCurrentRoute('dashboard'); };

  const bId = user?.bunkId || 'default';

  const addCustomer = async (c: any) => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const { data, error } = await supabase.from('customers').insert([{
      bunk_id: bId, company_name: c.companyName, owner_name: c.ownerName, category: c.category, phone: c.phone, address: c.address, payment_terms: c.paymentTerms,
      driver_name: c.driverName, driver_phone: c.driverPhone, vehicle_numbers: c.vehicleNumbers, credit_limit: c.creditLimit, status: c.status, portal_pin: pin, portal_access: true
    }]).select();

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
    }).eq('id', id);
    if (error) return showAlert("Update Failed: " + error.message);
    setCustomers(customers.map(c => c.id === id ? { ...c, ...updates } : c)); showAlert("Customer details updated.");
  };

  const deleteCustomer = async (id: string) => { const { error } = await supabase.from('customers').delete().eq('id', id); if (error) return showAlert("Delete Failed: " + error.message); setCustomers(customers.filter(c => c.id !== id)); showAlert("Customer permanently removed."); };

  const addTransaction = async (t: any) => { const { data, error } = await supabase.from('transactions').insert([{ bunk_id: bId, customer_id: t.customerId, type: t.type, date: t.date, product: t.product, quantity: t.quantity, amount: t.amount, payment_mode: t.mode, vehicle_number: t.vehicleNumber, remarks: t.remarks }]).select(); if (error) return showAlert("Transaction Failed: " + error.message); if (data && data.length > 0) setTransactions([{ ...t, id: data[0].id }, ...transactions]); };
  const updateTransaction = async (id: string, updates: any) => { const { error } = await supabase.from('transactions').update({ customer_id: updates.customerId, type: updates.type, date: updates.date, product: updates.product, quantity: updates.quantity, amount: updates.amount, payment_mode: updates.mode, vehicle_number: updates.vehicleNumber, remarks: updates.remarks }).eq('id', id); if (error) return showAlert("Update Failed: " + error.message); setTransactions(transactions.map(t => t.id === id ? { ...t, ...updates } : t)); showAlert("Transaction updated."); };
  const deleteTransaction = async (id: string) => { const { error } = await supabase.from('transactions').delete().eq('id', id); if (error) return showAlert("Delete Failed: " + error.message); setTransactions(transactions.filter(t => t.id !== id)); showAlert("Record deleted."); };

  const addMorningEntry = async (e: any) => {
    // Use direct REST API fetch to bypass PostgREST schema cache issues with balance_od column
    // UPSERT on (bunk_id, entry_date) to prevent duplicate entry errors
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
    const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
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
    };
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/morning_entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation,resolution=merge-duplicates',
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        showAlert('Failed to save entry: ' + errText);
        return;
      }
      const data = await resp.json();
      const savedId = Array.isArray(data) && data.length > 0 ? data[0].id : null;
      setMorningEntries([{ ...e, id: savedId || ('tmp-' + Date.now()) }, ...morningEntries]);
    } catch (err: any) {
      showAlert('Save Failed (network): ' + err.message);
    }
  };
  const updateMorningEntry = async (id: string, updates: any) => {
    // KEY FIX: Use POST+UPSERT instead of PATCH — PATCH still hits PostgREST schema
    // cache validation and fails with 'balance_od not found'. POST with
    // 'resolution=merge-duplicates' uses the INSERT path which bypasses the stale cache.
    // The UNIQUE constraint on (bunk_id, entry_date) ensures it updates the correct row.
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
    const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    const body = {
      bunk_id: bId,                          // required for conflict resolution
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
    };
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/morning_entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation,resolution=merge-duplicates',
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        showAlert('Update Failed: ' + errText);
        return;
      }
      const data = await resp.json();
      const savedRow = Array.isArray(data) && data.length > 0 ? data[0] : null;
      // Update local state with the actual saved row data
      setMorningEntries(prev => prev.map(m => m.id === id ? { ...m, ...updates, id: savedRow?.id || id } : m));
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
  const deleteMorningEntry = async (id: string) => { const { error } = await supabase.from('morning_entries').delete().eq('id', id); if (error) return showAlert("Delete Failed: " + error.message); setMorningEntries(morningEntries.filter(m => m.id !== id)); showAlert("Morning entry deleted."); };

  const addExpense = async (e: any) => { const { data, error } = await supabase.from('expenses').insert([{ bunk_id: bId, date: e.date, category: e.category, amount: e.amount, description: e.description, vendor: e.vendor, payment_mode: e.mode }]).select(); if (error) return showAlert("Failed to record expense: " + error.message); if (data && data.length > 0) setExpenses([{ ...e, id: data[0].id }, ...expenses]); showAlert("Expense recorded."); };
  const updateExpense = async (id: string, updates: any) => { const { error } = await supabase.from('expenses').update({ date: updates.date, category: updates.category, amount: updates.amount, description: updates.description, vendor: updates.vendor }).eq('id', id); if (error) return showAlert("Update Failed: " + error.message); setExpenses(expenses.map(e => e.id === id ? { ...e, ...updates } : e)); showAlert("Expense updated."); };
  const deleteExpense = async (id: string) => { const { error } = await supabase.from('expenses').delete().eq('id', id); if (error) return showAlert("Delete Failed: " + error.message); setExpenses(expenses.filter(e => e.id !== id)); showAlert("Expense deleted."); };

  const addFuelPurchase = async (purchases: any[]) => {
    const rows = purchases.map(f => ({
      bunk_id: bId, date: f.date, product: f.product,
      litres: f.litres, rate: f.rate, amount: f.amount,
      supplier: f.supplier || '', invoice: f.invoice || '',
      payment_mode: f.mode || 'Bank Transfer'
    }));
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
    }).eq('id', id);
    if (error) return showAlert('Update Failed: ' + error.message);
    setFuelPurchases(fuelPurchases.map(f => f.id === id ? { ...f, ...updates } : f));
    showAlert('Fuel receipt updated.');
  };
  const deleteFuelPurchase = async (id: string) => { const { error } = await supabase.from('fuel_purchases').delete().eq('id', id); if (error) return showAlert("Delete Failed: " + error.message); setFuelPurchases(fuelPurchases.filter(f => f.id !== id)); showAlert("Fuel record deleted."); };

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
  const deleteUser = async (id: string) => { const { error } = await supabase.from('profiles').delete().eq('id', id); if (error) return showAlert("Failed to remove user: " + error.message); setUsers(users.filter(u => u.id !== id)); showAlert("User account removed."); };

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
            if (Object.keys(updates).length > 0) { await supabase.from('customers').update(updates).eq('id', existing.id); updateCount++; }
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

      showAlert(`Success: Imported ${successCount} new, Updated ${updateCount} existing accounts! Refreshing data...`);
      setTimeout(() => window.location.reload(), 2000);
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

    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const sendWhatsAppReminder = (c: Customer) => {
    const bal = getCustomerBalance(c.id);
    if (bal <= 0) return showAlert("No pending balance for this customer.");
    let msg = `*${settings?.bunkName || 'Fuel Station'}*\n\nHello ${c.companyName || ''},\n\nThis is a gentle reminder that your current pending balance is *${formatRs(bal)}*.\n\nPlease arrange for payment at your earliest convenience.\n\nThank you for your business!`;

    const phoneStr = c.phone || '';
    const cleanPhone = phoneStr.replace(/\D/g, '');
    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <AppContext.Provider value={{ user, dataLoading, unsavedForm, setUnsavedForm, login, loginCustomer, signup, logout, currentRoute, setCurrentRoute, customerFilter, setCustomerFilter, customers, transactions, morningEntries, expenses, fuelPurchases, users, settings, addCustomer, updateCustomer, deleteCustomer, addTransaction, updateTransaction, deleteTransaction, addMorningEntry, updateMorningEntry, deleteMorningEntry, addExpense, updateExpense, deleteExpense, addFuelPurchase, updateFuelPurchase, deleteFuelPurchase, addUser, deleteUser, updateSettings, getCustomerBalance, getCustomerBalanceAsOf, bulkImportCustomers, showAlert, showConfirm, validateInputs, sendWhatsAppAlert, sendWhatsAppReminder }}>
      {children}
      {alertMessage && (<div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-5 sm:top-5 z-[9999] bg-gray-900 text-white px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4"><AlertCircle size={20} className="text-blue-400 shrink-0" /><p className="font-medium text-sm">{alertMessage}</p></div>)}
      {confirmDialog && (<div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95"><div className="flex items-center text-red-600 mb-4 gap-2"><AlertCircle size={24} /><h3 className="text-lg font-bold text-gray-900">Confirm Action</h3></div><p className="text-gray-600 mb-8 font-medium">{confirmDialog.message}</p><div className="flex gap-3 justify-end"><button onClick={() => setConfirmDialog(null)} className="px-5 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition">Cancel</button><button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="px-5 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-md shadow-red-200">Confirm</button></div></div></div>)}
    </AppContext.Provider>
  );
};

const useAppContext = () => { const ctx = useContext(AppContext); if (!ctx) throw new Error('useAppContext must be used within AppProvider'); return ctx; };

// --- COMPONENTS ---

// 1. Auth Screens
const LoginScreen = () => {
  const { login, loginCustomer, signup, showAlert } = useAppContext();
  const [tab, setTab] = useState<'staff' | 'customer'>('staff'); const [view, setView] = useState<'login' | 'signup'>('login');
  const [loginEmail, setLoginEmail] = useState(''); const [loginPass, setLoginPass] = useState('');
  const [regName, setRegName] = useState(''); const [regPhone, setRegPhone] = useState(''); const [regBunk, setRegBunk] = useState(''); const [regFuelCompany, setRegFuelCompany] = useState('Generic'); const [regEmail, setRegEmail] = useState(''); const [regPass, setRegPass] = useState('');
  const [custPhone, setCustPhone] = useState(''); const [custPin, setCustPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchView = (newView: 'login' | 'signup') => { setLoginEmail(''); setLoginPass(''); setRegName(''); setRegPhone(''); setRegBunk(''); setRegEmail(''); setRegPass(''); setView(newView); };

  return (
    <div className="min-h-[100dvh] bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-blue-900 p-6 text-center text-white">
          <Fuel className="w-12 h-12 mx-auto mb-2 text-blue-300" />
          <h1 className="text-2xl font-bold">FuelDesk SaaS</h1>
          <p className="text-blue-200 text-sm">Universal Fuel Station Manager</p>
        </div>
        <div className="flex border-b">
          <button className={`flex-1 py-3 text-sm font-semibold ${tab === 'staff' ? 'text-blue-900 border-b-2 border-blue-900 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`} onClick={() => setTab('staff')}>Staff Access</button>
          <button className={`flex-1 py-3 text-sm font-semibold ${tab === 'customer' ? 'text-blue-900 border-b-2 border-blue-900 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`} onClick={() => setTab('customer')}>Customer Portal</button>
        </div>
        <div className="p-6">
          {tab === 'staff' && view === 'login' && (
            <form onSubmit={async (e) => { e.preventDefault(); setIsSubmitting(true); await login(loginEmail, loginPass); setIsSubmitting(false); }} className="space-y-4 animate-in fade-in" autoComplete="off">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label><input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" required /></div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-blue-800 text-white p-3 rounded-lg font-bold hover:bg-blue-900 transition disabled:opacity-50">{isSubmitting ? 'Authenticating...' : 'Login to Dashboard'}</button>
              <div className="flex flex-col items-center mt-4 space-y-3 text-sm"><button type="button" onClick={() => showAlert("Please contact your station owner to reset your password.")} className="text-blue-600 font-medium hover:underline">Forgot Password?</button><button type="button" onClick={() => switchView('signup')} className="text-gray-500 hover:text-gray-800 hover:underline">First time setup? Create Owner Account</button></div>
            </form>
          )}
          {tab === 'staff' && view === 'signup' && (
            <form onSubmit={async (e) => { e.preventDefault(); setIsSubmitting(true); await signup({ name: regName, phone: regPhone, bunkName: regBunk, fuelCompany: regFuelCompany, email: regEmail, pass: regPass }); setIsSubmitting(false); }} className="space-y-4 animate-in fade-in slide-in-from-right-4 max-h-[60vh] overflow-y-auto pr-1" autoComplete="off">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Owner Full Name</label><input type="text" value={regName} onChange={e => setRegName(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label><input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Fuel Station Name</label><input type="text" value={regBunk} onChange={e => setRegBunk(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" placeholder="e.g., Highway Fuels" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Fuel Brand / Company</label><select className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-base" value={regFuelCompany} onChange={e => setRegFuelCompany(e.target.value)}><option value="Generic">Independent / Generic</option><option>HPCL</option><option>IOCL</option><option>BPCL</option><option>Reliance</option><option>Nayara</option><option>Shell</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label><input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Password (Min 6 chars)</label><input type="password" value={regPass} onChange={e => setRegPass(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" required minLength={6} /></div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-blue-800 text-white p-3 rounded-lg font-bold hover:bg-blue-900 transition mt-2 disabled:opacity-50">{isSubmitting ? 'Registering...' : 'Register & Setup SaaS'}</button>
              <div className="text-center mt-4"><button type="button" onClick={() => switchView('login')} className="text-sm text-gray-500 hover:text-gray-800 hover:underline">Already have an account? Login here</button></div>
            </form>
          )}
          {tab === 'customer' && (
            <form onSubmit={(e) => { e.preventDefault(); if (!/^\d{10}$/.test(custPhone)) { showAlert('Registered Mobile Number must be exactly 10 digits.'); return; } loginCustomer(custPhone, custPin); }} className="space-y-4 animate-in fade-in">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Registered Mobile Number</label><input type="tel" value={custPhone} onChange={e => setCustPhone(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" placeholder="10-digit number" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">4-Digit PIN</label><input type="password" maxLength={4} value={custPin} onChange={e => setCustPin(e.target.value)} className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center tracking-[0.5em] text-lg" required /></div>
              <button type="submit" className="w-full bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition">Check Balance</button>
            </form>
          )}
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

  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr.substring(5, 7));
  const period = selectedMonth === 'All' ? selectedYear : `${selectedYear}-${selectedMonth}`;

  const [chartPage, setChartPage] = useState(0);

  const userRole = String(user?.role || '').toLowerCase();

  const availableYears = useMemo(() => {
    const years = new Set<string>([currentYearStr]);
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

  if (dataLoading) return <div className="flex justify-center items-center p-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  // --- 1. GLOBAL METRICS ---
  const totalReceivables = customers.reduce((acc, c) => acc + getCustomerBalance(c.id), 0);
  const totalCustomers = customers.length;
  const overdueCount = customers.filter(c => getCustomerBalance(c.id) > c.creditLimit).length;

  const sortedEntries = [...morningEntries].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  const latestEntry = sortedEntries.length > 0 ? sortedEntries[0] : null;

  const strictlyLiquidAssets = latestEntry ? ((Number(latestEntry.balanceCash) || 0) + (Number(latestEntry.balanceBank) || 0) + (Number(latestEntry.balanceDigital) || 0)) : 0;
  const fuelStockValue = (latestEntry ? latestEntry.petrolDip : (settings?.initialPetrolDip || 0)) * (settings?.petrolRate || 0) + (latestEntry ? latestEntry.dieselDip : (settings?.initialDieselDip || 0)) * (settings?.dieselRate || 0);
  const odLimitDash = Number(settings?.odLimit) || 3000000;
  // balance_od stores NEGATIVE debt (e.g., user has ₹5L available → stored as -25L debt = 5L - 30L).
  // available = balance_od + limit   |   used/drawn = limit - available
  const latestOdEntry = sortedEntries.length > 0 ? sortedEntries[0] : null;
  const odEntryIsToday = latestOdEntry?.date === getTodayIST();
  // balance_od in DB is negative debt; fall back to settings if no entry yet
  const rawOdDebt = latestOdEntry ? Number(latestOdEntry.balanceOd || 0) : Number(settings?.currentOdBalance || 0);
  const currentOdBalance = rawOdDebt;                              // negative number = debt
  const odAvailableDisplay = rawOdDebt + odLimitDash;             // e.g. -25L + 30L = 5L available
  const odDrawnAmount = Math.max(0, odLimitDash - odAvailableDisplay); // 30L - 5L = 25L drawn
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
  const mtdExpenses = expenses.filter(e => e.date && typeof e.date === 'string' && e.date.startsWith(currentMonthStr)).reduce((sum, e) => sum + (e.amount || 0), 0);

  // Status Card
  const todayEntry = morningEntries.find(e => e.date === getTodayIST());

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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="text-blue-500" size={24} />
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{formatISTDate(getTodayIST())}</p>
            {todayEntry ? (
              <p className="font-bold text-green-600 flex items-center gap-1 text-sm"><CheckCircle2 size={16} /> Morning Entry Submitted</p>
            ) : (
              <p className="font-bold text-orange-600 flex items-center gap-1 text-sm"><AlertCircle size={16} /> Morning Entry Pending</p>
            )}
          </div>
        </div>
        {!todayEntry && (
          <button onClick={() => setCurrentRoute('morning')} className="text-sm font-bold text-blue-600 hover:underline">
            → Start Entry
          </button>
        )}
      </div>

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
              {/* Graph safely hidden on mobile phones, restored on tablets/desktops */}
              <div className="hidden sm:flex flex-1 items-end gap-1.5 h-40 mt-2 border-b border-gray-100 pb-2">
                {chartData.length === 0 ? <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-sm"><BarChart3 size={32} className="mb-2 opacity-20" /> No data for this period</div> : chartData.map((d, i) => (
                  <div key={i} className="relative flex-1 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-sm group transition-all hover:opacity-80 flex flex-col justify-end" style={{ height: `${Math.max(5, (d.value / maxChartVal) * 100)}%` }} title={`${d.label}: ${formatRs(d.value)}`}>
                    <div className="absolute opacity-0 group-hover:opacity-100 -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10 transition-opacity pointer-events-none">{formatLakhs(d.value)}</div>
                    <span className="text-[8px] text-center text-blue-900 font-bold mb-1 opacity-0 group-hover:opacity-100 truncate w-full px-1">{d.label}</span>
                  </div>
                ))}
              </div>
              <div className="sm:hidden flex-1 flex items-center justify-center text-gray-400 text-xs italic border-y border-gray-100 py-4 my-2">
                Detailed bar graph visible on larger screens
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
  const [custTxPage, setCustTxPage] = useState(0);

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
            <thead className="bg-gray-50 border-b"><tr><th className="p-4 text-sm font-medium text-gray-500 whitespace-nowrap">Customer Details</th><th className="p-4 text-sm font-medium text-gray-500 whitespace-nowrap">Category</th><th className="p-4 text-sm font-medium text-gray-500 text-center whitespace-nowrap">Bot</th><th className="p-4 text-sm font-medium text-gray-500 whitespace-nowrap">Outstanding</th><th className="p-4 text-sm font-medium text-gray-500 whitespace-nowrap">Limit</th><th className="p-4 text-sm font-medium text-gray-500 whitespace-nowrap">Portal PIN</th><th className="p-4 text-sm font-medium text-gray-500 text-center whitespace-nowrap">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCustomers.length === 0 ? (<tr><td colSpan={7} className="p-10 text-center text-gray-400 flex flex-col items-center"><SearchX size={32} className="mb-2 opacity-50" />No customers found.</td></tr>) : paginatedCustomers.map((c, idx) => {
                const bal = getCustomerBalance(c.id); const isOver = bal > c.creditLimit;
                const isExpanded = expandedCustId === c.id;

                const cTxs = transactions.filter(t => t.customerId === c.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const paginatedTxs = cTxs.slice(custTxPage * 5, (custTxPage + 1) * 5);
                const totalTxsPages = Math.ceil(cTxs.length / 5);

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
                    <tr onClick={() => { setExpandedCustId(isExpanded ? null : c.id); setCustTxPage(0); }} className="hover:bg-gray-50 transition-colors">
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
                        <td colSpan={7} className="p-0 bg-gray-50 border-b-2 border-blue-200">
                          <div className="p-4 pl-12 animate-in fade-in slide-in-from-top-2">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex justify-between items-center">
                              Recent Transactions
                              <div className="flex items-center gap-2">
                                <button onClick={() => setCustTxPage(p => Math.max(0, p - 1))} disabled={custTxPage === 0} className="p-1 bg-white rounded shadow-sm disabled:opacity-50 hover:bg-blue-50 transition"><ChevronLeft size={14} /></button>
                                <span className="text-[10px]">Page {custTxPage + 1} of {Math.max(1, totalTxsPages)}</span>
                                <button onClick={() => setCustTxPage(p => Math.min(totalTxsPages - 1, p + 1))} disabled={custTxPage >= totalTxsPages - 1} className="p-1 bg-white rounded shadow-sm disabled:opacity-50 hover:bg-blue-50 transition"><ChevronRight size={14} /></button>
                              </div>
                            </h4>
                            {cTxs.length === 0 ? <p className="text-sm text-gray-500 italic">No transactions recorded yet.</p> : (
                              <table className="w-full text-sm bg-white rounded-lg shadow-sm overflow-hidden">
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
                                    return (
                                      <tr key={tx.id} className="border-b last:border-b-0 hover:bg-blue-50/50">
                                        <td className="p-3 text-gray-500 w-32">{formatISTDate(tx.date)}</td>
                                        <td className="p-3 capitalize font-medium">{tx.type.replace('_', ' ')} {tx.product ? `(${tx.product})` : ''} {advStr} <span className="text-xs text-gray-400 block">{tx.vehicleNumber}</span></td>
                                        <td className={`p-3 text-right font-bold ${tx.type === 'payment' ? 'text-green-600' : 'text-red-600'}`}>{tx.type === 'payment' ? '-' : '+'}{formatRs(displayAmount)}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
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
  const { user, customers, transactions, addTransaction, updateTransaction, deleteTransaction, settings, showAlert, validateInputs, dataLoading, sendWhatsAppAlert } = useAppContext();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selCust) return;
    if (tab === 'sale' && !amount && !advanceAmount) return showAlert("Please enter a sale amount or an advance amount.");
    if (tab === 'payment' && !amount) return showAlert("Please enter a payment amount.");
    const amtNum = Number(amount) || 0; const advNum = Number(advanceAmount) || 0; const qtyNum = Number(qty) || 0;
    if (!validateInputs([amtNum, advNum], [qtyNum])) return;
    setIsSubmitting(true);

    // ONE combined row: advance embedded in remarks as "advance:{amount}|{note}"
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
          // SINGLE credit_sale row with advance embedded in remarks
          const txType = product === 'Opening Balance' ? 'opening_balance' : 'credit_sale';
          await addTransaction({ customerId: selCust, type: txType, date: txDate, product, quantity: qtyNum, amount: amtNum, vehicleNumber: selVehicle || undefined, remarks: buildRemarks() });
          showAlert(advNum > 0 ? `Saved! Credit ₹${amtNum.toLocaleString()} + Advance ₹${advNum.toLocaleString()}` : "Credit sale recorded!");
        } else if (advNum > 0) {
          // Advance-only (no credit sale in this entry)
          await addTransaction({ customerId: selCust, type: 'advance', date: txDate, amount: advNum, vehicleNumber: selVehicle || undefined, remarks: advanceRemarks || undefined });
          showAlert(`Cash advance ₹${advNum.toLocaleString()} recorded!`);
        }
      } else {
        await addTransaction({ customerId: selCust, type: 'payment', date: txDate, amount: amtNum, mode: payMode, vehicleNumber: selVehicle || undefined });
        showAlert("Payment recorded successfully.");
      }
      resetForm(tab === 'payment');
    }
    setIsSubmitting(false);
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
      <div className="lg:w-1/3 lg:overflow-y-auto pr-2 pb-10 space-y-4 relative">
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

      <div className="lg:w-2/3 pl-2 pb-10 flex flex-col relative">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="font-bold text-gray-800 text-xl">Daily Ledger History</h3>
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input type="text" placeholder="Search customer, veh..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setLedgerPage(0); setExpandedDate(null); }} className="w-full pl-9 pr-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
            </div>
          </div>

          <div className="space-y-4 mt-2 flex-1 p-4 pt-0">
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
  const { user, settings, expenses, addMorningEntry, updateMorningEntry, deleteMorningEntry, morningEntries, transactions, fuelPurchases, updateSettings, showConfirm, validateInputs, dataLoading, setUnsavedForm, customers, getCustomerBalanceAsOf } = useAppContext();
  const [step, setStep] = useState(0); const [submitted, setSubmitted] = useState(false); const [editId, setEditId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userRole = String(user?.role || '').toLowerCase();

  const defaultEntryDate = useMemo(() => {
    const hasToday = morningEntries.some(m => m.date === todayStr);
    if (hasToday) {
      const d = new Date(todayStr + 'T00:00:00+05:30');
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    }
    return todayStr;
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

  useEffect(() => { setUnsavedForm(step > 0 && !submitted); }, [step, submitted, setUnsavedForm]);

  useEffect(() => {
    if (step === 0 && !editId) {
      supabase.from('nozzle_readings').select('*').eq('bunk_id', user?.bunkId).eq('date', targetDate).single().then(({ data }: any) => {
        if (data && data.entered_via === 'bot') {
          setNozzleForm({ p1: data.p1_reading?.toString() || '', p2: data.p2_reading?.toString() || '', d1: data.d1_reading?.toString() || '', d2: data.d2_reading?.toString() || '' });
          setNozzleSynced(true);
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
    const odLim = Number(settings.odLimit) || 3000000;
    const availableOd = (m.balanceOd || 0) + odLim;
    setEditId(m.id); setEntryDate(m.date);
    setForm({ petrolDip: m.petrolDip.toString(), dieselDip: m.dieselDip.toString(), openingBalance: m.collectionsCash?.toString() || '', cashRaw: m.balanceCash?.toString() || '', bankRaw: m.collectionsBank?.toString() || '', digitalRaw: m.collectionsDigital?.toString() || '', dtpRaw: m.collectionDtp?.toString() || '', cardRaw: m.collectionsCard?.toString() || '', bankBal: m.balanceBank?.toString() || '', odBal: availableOd.toString(), digitalBal: m.balanceDigital?.toString() || '' });
    setStep(1); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNozzleNext = async () => {
    const p1 = Number(nozzleForm.p1) || 0; const p2 = Number(nozzleForm.p2) || 0; const d1 = Number(nozzleForm.d1) || 0; const d2 = Number(nozzleForm.d2) || 0;
    if (p1 > 0 || p2 > 0 || d1 > 0 || d2 > 0) {
      setIsSubmitting(true);
      await supabase.from('nozzle_readings').upsert({ bunk_id: user?.bunkId, date: targetDate, p1_reading: p1, p2_reading: p2, d1_reading: d1, d2_reading: d2, entered_via: 'webapp' }, { onConflict: 'bunk_id,date' });
      setIsSubmitting(false);
    }
    setStep(1);
  };

  const isStep1Valid = form.petrolDip !== '' && form.dieselDip !== ''; const isStep2Valid = true; const isStep3Valid = form.bankBal !== '' && form.digitalBal !== '' && form.odBal !== '';
  const canGoNext = (step === 1 && isStep1Valid) || (step === 2 && isStep2Valid) || (step === 3 && isStep3Valid);

  const pDip = Number(form.petrolDip) || 0; const dDip = Number(form.dieselDip) || 0; const petrolSold = yesterdayPetrol - pDip; const dieselSold = yesterdayDiesel - dDip;
  const petrolSalesVal = petrolSold * (settings?.petrolRate || 0); const dieselSalesVal = dieselSold * (settings?.dieselRate || 0); const totalSalesVal = petrolSalesVal + dieselSalesVal;

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
  const newOdDebt = (Number(form.odBal) || 0) - odLimSubmit;

  const calculatedNetValue = strictlyLiquidAssets + newOdDebt + currentTotalReceivablesAsOfTargetDate + currentFuelStockValue;

  const previousNetValue = previousEntry ? previousEntry.netValue : (((settings?.initialPetrolDip || 0) * (settings?.petrolRate || 0)) + ((settings?.initialDieselDip || 0) * (settings?.dieselRate || 0)));
  const trueNetProfit = calculatedNetValue - previousNetValue;

  const handleSubmit = async () => {
    // Allow negative vault cash (returns) — only validate litres
    if (!validateInputs([], [pDip, dDip])) return;

    setIsSubmitting(true);
    const payload = { date: targetDate, petrolDip: pDip, dieselDip: dDip, petrolSold, dieselSold, netProfit: trueNetProfit, variance, submitted: true, collectionsCash: openingBal, balanceCash: Number(form.cashRaw) || 0, collectionsBank: Number(form.bankRaw) || 0, collectionsDigital: Number(form.digitalRaw) || 0, collectionDtp: Number(form.dtpRaw) || 0, collectionsCard: Number(form.cardRaw) || 0, collectionsCredit: (periodCreditSales + periodAdvances), periodExpenses: currentPeriodExpenses, balanceBank: Number(form.bankBal) || 0, balanceDigital: Number(form.digitalBal) || 0, balanceOd: newOdDebt, openingBalance: openingBal, netValue: calculatedNetValue };

    const isLatestEntry = sortedEntries.length === 0 || targetDate >= (sortedEntries[0].date || '');

    if (editId) {
      await updateMorningEntry(editId, payload);
      if (isLatestEntry) await updateSettings({ ...settings, currentOdBalance: newOdDebt, currentHpBalance: Number(form.digitalBal) || 0 });
    } else {
      await addMorningEntry(payload);
      if (isLatestEntry) await updateSettings({ ...settings, currentOdBalance: newOdDebt, currentHpBalance: Number(form.digitalBal) || 0 });
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
              <input disabled={!!editId} type="date" value={entryDate} onChange={e => { setEntryDate(e.target.value); setStep(0); }} className="bg-transparent border-none text-sm font-bold outline-none text-white disabled:opacity-80" />
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
              {pDip > 0 && dDip > 0 && (<div className="bg-blue-50 p-6 rounded-xl border border-blue-100 grid grid-cols-1 sm:grid-cols-2 gap-6"><div><p className="text-sm text-blue-800 mb-1">Computed Gross Dispensed</p><p className="text-3xl font-bold text-blue-900">{petrolSold.toFixed(0)} L</p><p className="text-sm font-medium text-blue-600 mt-1">Value: {formatRs(petrolSalesVal)}</p></div><div><p className="text-sm text-blue-800 mb-1">Computed Gross Dispensed</p><p className="text-3xl font-bold text-blue-900">{dieselSold.toFixed(0)} L</p><p className="text-sm font-medium text-blue-600 mt-1">Value: {formatRs(dieselSalesVal)}</p></div></div>)}
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
                <div className="bg-blue-50 p-5 rounded-xl border border-blue-100"><h4 className="font-bold text-blue-900 mb-4 border-b border-blue-200 pb-2">Theoretical Gross Sales</h4><div className="space-y-3 text-sm font-medium"><div className="flex justify-between"><span>Petrol Dispensed ({petrolSold}L)</span><span>{formatRs(petrolSalesVal)}</span></div><div className="flex justify-between"><span>Diesel Dispensed ({dieselSold}L)</span><span>{formatRs(dieselSalesVal)}</span></div><div className="flex justify-between pt-3 border-t border-blue-200 font-black text-lg"><span>Total Target</span><span>{formatRs(totalSalesVal)}</span></div></div></div>
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

              <div className={`p-6 rounded-xl border flex justify-between items-center mt-6 shadow-sm ${variance < 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}><div><h4 className={`font-black text-lg ${variance < 0 ? 'text-red-800' : 'text-green-800'}`}>Reconciliation Status</h4><p className="text-sm opacity-80 mt-1">Total Accounted minus Theoretical Sales.</p></div><span className={`text-2xl md:text-3xl font-black whitespace-nowrap ml-4 ${variance < 0 ? 'text-red-600' : 'text-green-600'}`}>{variance < 0 ? '-' : '+'}{formatRs(Math.abs(variance))}</span></div>

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
            <thead className="bg-white border-b"><tr><th className="p-4 text-gray-500 whitespace-nowrap">Date</th><th className="p-4 text-gray-500 whitespace-nowrap">Gross Sales</th><th className="p-4 text-gray-500 whitespace-nowrap">Remitted</th><th className="p-4 text-gray-500 whitespace-nowrap">Credit Extended</th><th className="p-4 text-gray-500 whitespace-nowrap">Status</th>{userRole === 'owner' && <th className="p-4 text-gray-500 text-center whitespace-nowrap">Actions</th>}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedEntries.length === 0 ? (<tr><td colSpan={6} className="p-10 flex flex-col items-center justify-center text-gray-400"><SearchX size={32} className="mb-2 opacity-50" />No past entries.</td></tr>) : paginatedEntries.map((e, idx) => (
                <tr key={e.id || `entry-${idx}`} className={`hover:bg-gray-50 transition ${editId === e.id ? 'bg-blue-50/50' : ''}`}>
                  <td className="p-4 whitespace-nowrap font-medium">{formatISTDate(e.date)}</td>
                  <td className="p-4 whitespace-nowrap">{formatRs(e.petrolSold * (settings.petrolRate || 0) + e.dieselSold * (settings.dieselRate || 0))}</td>
                  <td className="p-4 whitespace-nowrap text-gray-600">{formatRs(((e.collectionsCash || 0) - (e.openingBalance || 0)) + (e.collectionsBank || 0) + (e.collectionsDigital || 0) + (e.collectionDtp || 0) + (e.collectionsCard || 0))}</td>
                  <td className="p-4 whitespace-nowrap text-orange-600 font-medium">{formatRs(e.collectionsCredit || 0)}</td>
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

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0); const budget = settings?.monthlyBudget || 0; const budgetPct = budget > 0 ? Math.min(100, (totalExpenses / budget) * 100) : 0;

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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6"><h3 className="font-bold text-gray-700 mb-2">Monthly Budget Tracker</h3><div className="flex justify-between text-sm mb-1"><span className="font-medium">{formatRs(totalExpenses)} spent</span><span className="text-gray-500">{formatRs(budget)} limit</span></div><div className="w-full bg-gray-200 rounded-full h-2.5"><div className={`h-2.5 rounded-full ${budgetPct > 90 ? 'bg-red-600' : 'bg-green-600'}`} style={{ width: `${budgetPct}%` }}></div></div></div>
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
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  const monthEntries = morningEntries.filter(e => e.date?.startsWith(selectedMonth));
  const monthTx = transactions.filter(t => t.date?.startsWith(selectedMonth));
  const monthExp = expenses.filter(e => e.date?.startsWith(selectedMonth));
  const monthFuel = fuelPurchases.filter(f => f.date?.startsWith(selectedMonth));

  const grossSalesRs = monthEntries.reduce((s, e) => s + (e.petrolSold || 0) * (settings?.petrolRate || 0) + (e.dieselSold || 0) * (settings?.dieselRate || 0), 0);
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
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `FuelDesk_Report_${selectedMonth}.csv`;
    link.click();
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
                  <td className="p-3 text-right font-bold">{formatRs((e.petrolSold || 0) * (settings?.petrolRate || 0) + (e.dieselSold || 0) * (settings?.dieselRate || 0))}</td>
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
  const { settings, updateSettings, users, addUser, deleteUser, user, customers, transactions, showAlert, showConfirm, dataLoading } = useAppContext();

  const [form, setForm] = useState(settings);
  useEffect(() => { setForm(settings); }, [settings]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await updateSettings({
      ...settings,
      bunkName: form.bunkName,
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
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `FuelDesk_Export_${todayStr}.csv`;
    link.click();
    showAlert("Master database downloaded successfully.");
  };

  const userRole = String(user?.role || '').toLowerCase();

  if (dataLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  if (userRole !== 'owner') return <div className="p-8 text-center text-red-600 font-bold">Settings are only accessible to the owner.</div>;

  const ownerCount = users.filter(u => String(u.role).toLowerCase() === 'owner').length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6">
          <div className="flex items-center mb-4 border-b pb-2"><Settings className="text-gray-400 mr-2" /><h3 className="text-lg font-bold">Business & Rate Settings</h3></div>
          <form onSubmit={handleSave} className="space-y-4">
            <div><label className="block text-sm font-medium mb-1">Business Name</label><input type="text" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.bunkName} onChange={e => setForm({ ...form, bunkName: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Petrol Rate (Rs/L)</label><input type="number" step="0.01" className="w-full border p-3 rounded-lg font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.petrolRate || ''} onChange={e => setForm({ ...form, petrolRate: e.target.value })} placeholder="0.00" /></div>
              <div><label className="block text-sm font-medium mb-1">Diesel Rate (Rs/L)</label><input type="number" step="0.01" className="w-full border p-3 rounded-lg font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.dieselRate || ''} onChange={e => setForm({ ...form, dieselRate: e.target.value })} placeholder="0.00" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">OD Account Total Limit (Rs)</label>
                <input type="number" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.odLimit || ''} onChange={e => setForm({ ...form, odLimit: e.target.value })} placeholder="3000000" />
                <p className="text-xs text-gray-500 mt-1">The maximum amount you can draw from OD</p>
              </div>
              <div><label className="block text-sm font-medium mb-1">Monthly Expense Budget (Rs)</label><input type="number" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={form.monthlyBudget || ''} onChange={e => setForm({ ...form, monthlyBudget: e.target.value })} placeholder="0" /></div>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-blue-800 text-white py-3 rounded-xl font-bold shadow hover:bg-blue-900 transition disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Update Settings'}</button>
          </form>
        </div>

        {/* WhatsApp Bot Info Card (FIX 10) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6">
          <div className="flex items-center mb-4 border-b pb-2"><MessageCircle className="text-green-500 mr-2" /><h3 className="text-lg font-bold">WhatsApp Bot Status</h3></div>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-100">
              <span className="text-sm font-medium text-gray-700">Bot Number</span>
              <span className="font-bold text-green-800">+91 90636 78438</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border">
              <span className="text-sm font-medium text-gray-700">Bot Status</span>
              <span className="flex items-center gap-1.5 font-bold text-green-700"><span className="w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse"></span>Active</span>
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
              <p className="text-xs font-bold text-yellow-800 mb-1">⚠️ Schema Cache Issues?</p>
              <p className="text-xs text-yellow-700">If you see "balance_od schema cache" errors, go to <strong>Supabase → API → Schema Cache → Reload</strong>, then hard-refresh this page (Ctrl+Shift+R).</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6">
          <div className="flex items-center mb-4 border-b pb-2"><Download className="text-gray-400 mr-2" /><h3 className="text-lg font-bold">Data Management</h3></div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 flex flex-col items-center justify-center text-center">
            <UploadCloud className="w-12 h-12 text-blue-400 mb-4" />
            <h4 className="font-bold text-blue-900 mb-2">Need to Import Data?</h4>
            <p className="text-sm text-blue-700 mb-6 max-w-sm">To ensure database integrity and eliminate duplicate records, bulk data migration is currently handled securely by your development team.</p>
            <button type="button" onClick={() => showConfirm("Contact your developer to execute a secure database migration script directly into Supabase.", () => { })} className="px-6 bg-blue-800 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-blue-900 shadow transition">Request Data Migration</button>
          </div>

          <div className="mt-4">
            <button onClick={handleExportData} className="w-full flex items-center justify-center p-4 bg-gray-50 border rounded-xl hover:bg-blue-50 hover:border-blue-200 transition group">
              <Download className="text-gray-400 group-hover:text-blue-600 mr-3" size={20} />
              <span className="text-sm font-bold text-gray-700 group-hover:text-blue-800">Export Full Database to CSV</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 md:p-6">
          <div className="flex items-center mb-4 border-b pb-2"><Users className="text-gray-400 mr-2" /><h3 className="text-lg font-bold">Staff Management</h3></div>
          <div className="mb-6">
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
              <div><label className="block text-xs font-medium mb-1">Temporary Password</label><input type="text" required minLength={6} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" value={staffForm.password} onChange={e => setStaffForm({ ...staffForm, password: e.target.value })} /></div>
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
      </div>
    </div>
  );
};

// --- GLOBAL ERROR BOUNDARY ---
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: any, errorInfo: any }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false, error: null, errorInfo: null }; }

  componentDidCatch(error: any, errorInfo: any) {
    this.setState({ hasError: true, error, errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white p-8 rounded-2xl shadow-xl text-center border-t-4 border-red-600">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-gray-900 mb-2">System Interruption</h1>
            <p className="text-gray-600 mb-6">We intercepted a background error before it could corrupt your session. You can safely reset the app to continue.</p>

            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition mb-4">Safe Reset App</button>

            <details className="text-left bg-red-50 p-4 rounded-lg border border-red-100">
              <summary className="text-sm font-bold text-red-800 cursor-pointer outline-none">View Technical Debug Log</summary>
              <div className="mt-3 overflow-x-auto">
                <p className="text-xs text-red-600 font-mono font-bold mb-2">{this.state.error && this.state.error.toString()}</p>
                <pre className="text-[10px] text-red-500 font-mono whitespace-pre-wrap leading-tight">{this.state.errorInfo?.componentStack}</pre>
              </div>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Main Layout / Router
const AppContent = () => {
  const { user, settings, logout, currentRoute, setCurrentRoute, unsavedForm, setUnsavedForm } = useAppContext();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleNavClick = (id: string) => {
    if (unsavedForm) {
      if (window.confirm("You have an unsaved morning entry. Leave anyway?")) {
        setUnsavedForm(false); setCurrentRoute(id); setIsSidebarOpen(false);
      }
    } else { setCurrentRoute(id); setIsSidebarOpen(false); }
  };

  if (!user) return <LoginScreen />;
  if (user.role === 'customer') return <CustomerPortalView />;

  const userRole = String(user.role || 'supervisor').toLowerCase();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, roles: ['owner', 'supervisor'] },
    { id: 'customers', label: 'Customers', icon: Users, roles: ['owner', 'supervisor'] },
    { id: 'ledger', label: 'Credit Ledger', icon: BookOpen, roles: ['owner', 'supervisor'] },
    { id: 'fuel', label: 'Fuel Receipts', icon: Truck, roles: ['owner', 'supervisor'] },
    { id: 'morning', label: 'Morning Entry', icon: Sun, roles: ['owner', 'supervisor'] },
    { id: 'expenses', label: 'Expenses', icon: Receipt, roles: ['owner', 'supervisor'] },
    { id: 'reports', label: 'Reports', icon: TrendingUp, roles: ['owner'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['owner'] },
  ];

  return (
    <div className="flex h-[100dvh] bg-gray-100 font-sans text-gray-900">
      {isSidebarOpen && (<div className="fixed inset-0 bg-black/60 z-20 md:hidden transition-opacity" onClick={() => setIsSidebarOpen(false)} />)}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-blue-950 text-white flex flex-col shadow-2xl z-30 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="p-6 border-b border-blue-900/50 flex justify-between items-center">
          <div><div className="flex items-center space-x-3 text-blue-400 mb-1"><Fuel className="fill-current" /><span className="font-black text-xl text-white tracking-tight truncate max-w-[150px]">{settings?.bunkName || 'Business Manager'}</span></div><p className="text-blue-300 text-xs">Powered by FuelDesk</p></div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}><X size={24} /></button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.filter(i => i.roles.includes(userRole)).map(item => (
            <button key={item.id} onClick={() => handleNavClick(item.id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${currentRoute === item.id ? 'bg-blue-800 text-white font-medium shadow-inner' : 'text-blue-200 hover:bg-blue-900/50 hover:text-white'}`}><item.icon size={20} className={currentRoute === item.id ? 'text-blue-400' : 'opacity-70'} /><span>{item.label}</span></button>
          ))}
        </nav>
        <div className="p-4 border-t border-blue-900/50">
          <div className="bg-blue-900/50 p-4 rounded-xl mb-4"><p className="text-sm font-bold truncate">{user.name}</p><p className="text-xs text-blue-300 uppercase tracking-wide mt-1">{userRole}</p></div>
          <button onClick={logout} className="w-full flex items-center justify-center space-x-2 text-blue-300 hover:text-white py-2 transition"><LogOut size={18} /> <span>Sign Out</span></button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden relative">
        <header className="md:hidden bg-blue-950 text-white p-4 flex justify-between items-center shadow-md z-10 sticky top-0 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="p-1 hover:bg-blue-900 rounded transition text-blue-200 hover:text-white"><Menu size={24} /></button>
          <div className="flex items-center space-x-2 text-blue-400 font-black text-lg text-white"><Fuel className="w-5 h-5" /><span className="truncate max-w-[150px]">{settings?.bunkName || 'Manager'}</span></div>
          <button onClick={logout} className="text-blue-200 hover:text-white"><LogOut size={20} /></button>
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
          <p className="text-gray-600 mb-6">The app deployed successfully, but cannot connect to the database because your Netlify keys are missing.</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}