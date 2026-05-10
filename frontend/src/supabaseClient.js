import { createClient } from '@supabase/supabase-js';

// 1. Read variables using Vite's special syntax
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. Safety Check (Optional but helpful for debugging)

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key. Check your .env file or Cloudflare settings.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);