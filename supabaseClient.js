// backend/supabaseClient.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// These will be read from your Vercel Environment Variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL and Anon Key are required in .env or Vercel environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;