// InboxTab — WhatsApp Live Inbox (Multi-agent chat)
// Displays wa_conversations grouped by contact, with real-time-style polling.
//
// Required Supabase SQL (run once):
// CREATE TABLE wa_conversations (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   bunk_id uuid REFERENCES bunks(id),
//   from_phone text,
//   direction text,       -- 'incoming' | 'outgoing'
//   body text,
//   msg_type text,
//   wa_message_id text UNIQUE,
//   ts timestamptz,
//   created_at timestamptz DEFAULT now()
// );
// CREATE INDEX ON wa_conversations(bunk_id, from_phone, ts DESC);
// CREATE INDEX ON wa_conversations(bunk_id, ts DESC);

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import { Loader2, Send, MessageCircle, RefreshCw } from 'lucide-react';

interface WaMessage {
  id: string;
  bunk_id: string;
  from_phone: string;
  direction: 'incoming' | 'outgoing';
  body: string;
  msg_type: string;
  wa_message_id: string | null;
  ts: string;
}

interface ConvThread {
  phone: string;
  latestTs: string;
  latestMsg: string;
  unread: number;
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function InboxTab({
  bunkId,
  webhookUrl,
  cronSecret,
}: {
  bunkId: string;
  webhookUrl?: string;
  cronSecret?: string;
}) {
  const [threads, setThreads] = useState<ConvThread[]>([]);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load thread list
  const loadThreads = useCallback(async () => {
    const { data, error } = await supabase
      .from('wa_conversations')
      .select('from_phone, direction, body, ts')
      .eq('bunk_id', bunkId)
      .order('ts', { ascending: false })
      .limit(500);

    if (error) {
      setLoadingThreads(false);
      return;
    }

    // Group by phone
    const map: Record<string, ConvThread> = {};
    for (const row of (data || []) as { from_phone: string; direction: string; body: string; ts: string }[]) {
      if (!map[row.from_phone]) {
        map[row.from_phone] = {
          phone: row.from_phone,
          latestTs: row.ts,
          latestMsg: row.body || '',
          unread: 0,
        };
      }
      if (row.direction === 'incoming') map[row.from_phone].unread++;
    }

    const sorted = Object.values(map).sort((a, b) =>
      new Date(b.latestTs).getTime() - new Date(a.latestTs).getTime()
    );
    setThreads(sorted);
    setLoadingThreads(false);
  }, [bunkId]);

  // Load messages for active phone
  const loadMessages = useCallback(async (phone: string) => {
    setLoadingMsgs(true);
    const { data } = await supabase
      .from('wa_conversations')
      .select('*')
      .eq('bunk_id', bunkId)
      .eq('from_phone', phone)
      .order('ts', { ascending: true })
      .limit(200);
    setMessages((data as WaMessage[]) || []);
    setLoadingMsgs(false);
  }, [bunkId]);

  useEffect(() => { loadThreads(); }, [loadThreads, lastRefresh]);

  useEffect(() => {
    if (activePhone) loadMessages(activePhone);
  }, [activePhone, loadMessages, lastRefresh]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setLastRefresh(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const handleSend = async () => {
    if (!replyText.trim() || !activePhone) return;
    if (!webhookUrl || !cronSecret) {
      alert('Webhook URL or Cron Secret not configured. Please check environment variables.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${webhookUrl}/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: cronSecret,
          bunk_id: bunkId,
          phones: [activePhone],
          message: replyText.trim(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReplyText('');
      // Optimistically add message to chat
      const optimistic: WaMessage = {
        id: 'opt-' + Date.now(),
        bunk_id: bunkId,
        from_phone: activePhone,
        direction: 'outgoing',
        body: replyText.trim(),
        msg_type: 'text',
        wa_message_id: null,
        ts: new Date().toISOString(),
      };
      setMessages(prev => [...prev, optimistic]);
    } catch (err) {
      alert('Failed to send message. Check webhook URL and secret.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[500px] bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Left: Thread list */}
      <div className="w-72 border-r flex flex-col shrink-0">
        <div className="p-3 border-b flex items-center justify-between bg-gray-50">
          <span className="font-semibold text-gray-700 text-sm flex items-center gap-1.5">
            <MessageCircle size={15} className="text-indigo-500" /> Conversations
          </span>
          <button onClick={() => setLastRefresh(Date.now())} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingThreads ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="animate-spin text-indigo-400" size={20} />
            </div>
          ) : threads.length === 0 ? (
            <div className="p-5 text-center text-gray-400 text-sm">
              <MessageCircle size={28} className="mx-auto mb-2 opacity-30" />
              No conversations yet.<br />
              <span className="text-xs">Messages will appear here once customers start chatting.</span>
            </div>
          ) : (
            threads.map(t => (
              <button
                key={t.phone}
                onClick={() => setActivePhone(t.phone)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-indigo-50 transition-colors ${activePhone === t.phone ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {t.phone.slice(-2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-800 text-xs truncate">{t.phone}</span>
                      <span className="text-gray-400 text-[10px] shrink-0">{relativeTime(t.latestTs)}</span>
                    </div>
                    <p className="text-gray-500 text-xs truncate mt-0.5">{t.latestMsg || '...'}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: Chat view */}
      <div className="flex-1 flex flex-col">
        {!activePhone ? (
          <div className="flex-1 flex items-center justify-center text-gray-300">
            <div className="text-center">
              <MessageCircle size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a conversation to view messages</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="p-3 border-b bg-gray-50 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                {activePhone.slice(-2)}
              </div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">{activePhone}</p>
                <p className="text-xs text-gray-400">WhatsApp</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#f0f2f5]">
              {loadingMsgs ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-indigo-400" size={20} />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">No messages found.</p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      msg.direction === 'outgoing'
                        ? 'bg-[#d9fdd3] text-gray-800 rounded-br-none'
                        : 'bg-white text-gray-800 rounded-bl-none'
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.body || '[media]'}</p>
                      <p className="text-[10px] text-gray-400 text-right mt-1">{relativeTime(msg.ts)}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Reply box */}
            <div className="p-3 border-t bg-white flex items-end gap-2">
              <textarea
                className="flex-1 border rounded-xl px-3 py-2 text-sm resize-none max-h-28 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                rows={2}
                placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={handleSend}
                disabled={sending || !replyText.trim()}
                className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
