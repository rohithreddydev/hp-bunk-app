import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// This will tell you if your keys are missing instead of showing a white screen!
if (!supabaseUrl || !supabaseKey) {
  alert("Missing Supabase Keys! Make sure .env.local exists in your root folder and you have restarted the server.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder'
);