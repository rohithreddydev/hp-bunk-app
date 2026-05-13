// ═══════════════════════════════════════════════════════════════════════════
// Smart Biz AI — Shared Settings Tab
// Neutral/gray theme — used by all non-fuel store modules
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  User, Mail, Shield, Building2, Lock, LogOut,
  CheckCircle2, AlertTriangle, Loader2, MessageCircle, Save,
} from 'lucide-react';
import { supabase } from './supabase';

interface SettingsTabProps {
  bunkId: string;
  user: { name: string; email: string; role: string };
  onLogout: () => void;
}

export function SettingsTab({ bunkId, user, onLogout }: SettingsTabProps) {
  const [businessName, setBusinessName] = useState('');
  const [origBusinessName, setOrigBusinessName] = useState('');
  const [loadingName, setLoadingName] = useState(true);
  const [savingName, setSavingName] = useState(false);

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load business name from bunks table
  useEffect(() => {
    if (!bunkId) { setLoadingName(false); return; }
    supabase
      .from('bunks')
      .select('name')
      .eq('id', bunkId)
      .single()
      .then(({ data }) => {
        const name = data?.name || '';
        setBusinessName(name);
        setOrigBusinessName(name);
        setLoadingName(false);
      });
  }, [bunkId]);

  const handleSaveBusinessName = async () => {
    if (!businessName.trim()) { showToast('Business name cannot be empty', 'error'); return; }
    setSavingName(true);
    const { error } = await supabase
      .from('bunks')
      .update({ name: businessName.trim() })
      .eq('id', bunkId);
    setSavingName(false);
    if (error) { showToast(error.message, 'error'); return; }
    setOrigBusinessName(businessName.trim());
    showToast('Business name updated');
  };

  const handleChangePassword = async () => {
    if (!newPass || newPass.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    if (newPass !== confirmPass) { showToast('Passwords do not match', 'error'); return; }
    setChangingPass(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setChangingPass(false);
    if (error) { showToast(error.message, 'error'); return; }
    showToast('Password changed successfully');
    setCurrentPass(''); setNewPass(''); setConfirmPass('');
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    localStorage.removeItem('app_user_session');
    localStorage.removeItem('app_biz_type');
    onLogout();
  };

  const roleBadgeColor = (role: string) => {
    if (role === 'owner') return 'bg-purple-100 text-purple-700';
    if (role === 'supervisor') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* User Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <User size={15} /> Account
        </h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
              <User size={20} className="text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 text-sm truncate">{user.name || 'Unknown User'}</p>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className="flex items-center gap-1 text-xs text-gray-500"><Mail size={11} />{user.email}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadgeColor(user.role)}`}>{user.role}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Business Name */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Building2 size={15} /> Business Name
        </h2>
        {loadingName ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 size={16} className="animate-spin" /> Loading…</div>
        ) : (
          <div className="flex gap-2">
            <input
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              placeholder="Your business name"
            />
            <button
              onClick={handleSaveBusinessName}
              disabled={savingName || businessName.trim() === origBusinessName}
              className="flex items-center gap-1.5 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              {savingName ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {savingName ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Lock size={15} /> Change Password
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Current Password</label>
            <input
              type="password"
              value={currentPass}
              onChange={e => setCurrentPass(e.target.value)}
              placeholder="Enter current password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">New Password</label>
            <input
              type="password"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Confirm New Password</label>
            <input
              type="password"
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <button
            onClick={handleChangePassword}
            disabled={changingPass || !newPass || !confirmPass}
            className="flex items-center gap-1.5 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {changingPass ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            {changingPass ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </div>

      {/* WhatsApp Bot Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <MessageCircle size={15} /> WhatsApp Bot
        </h2>
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm font-medium text-green-700">Active</span>
          <span className="text-xs text-gray-400 ml-1">— Smart Biz AI bot is running</span>
        </div>
      </div>

      {/* Sign Out */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Shield size={15} /> Session
        </h2>
        <button
          onClick={handleSignOut}
          disabled={loggingOut}
          className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          {loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
          {loggingOut ? 'Signing Out…' : 'Sign Out'}
        </button>
      </div>
    </div>
  );
}
