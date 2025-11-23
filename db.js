// backend/db.js
require('dotenv').config();
const { Pool } = require('pg');

let pool;

// Prefer an explicit URL (DATABASE_URL or SUPABASE_DB_URL)
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || 'postgresql://postgres:Shubham!450@db.heegldqwbtywjzmwmqra.supabase.co:5432/postgres';

if (dbUrl) {
    console.log("Connecting to PostgreSQL via connection URL...");
    console.log("DATABASE_URL is set:", !!process.env.DATABASE_URL);
    console.log("Connection string host:", dbUrl.split('@')[1]?.split(':')[0] || 'unknown');
    
    const config = { connectionString: dbUrl };

    // Enable relaxed SSL for hosted providers (Render / Supabase) or when in production
    // (keeps compatibility with how it was before: rejectUnauthorized: false)
    if (process.env.NODE_ENV === 'production' || dbUrl.includes('supabase.co') || process.env.DATABASE_URL) {
        config.ssl = { rejectUnauthorized: false };
    }

    pool = new Pool(config);
} else if (process.env.SUPABASE_DB_HOST && process.env.SUPABASE_DB_PASSWORD) {
    // Fallback: compose a connection URL for local Supabase dev if explicit URL is not provided
    console.log("Composing connection URL from SUPABASE_DB_HOST and SUPABASE_DB_PASSWORD...");
    const composedUrl = `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@${process.env.SUPABASE_DB_HOST}:5432/postgres`;
    pool = new Pool({ connectionString: composedUrl });
} else {
    console.error("Database connection string not found. Please check your backend/.env file.");
    // This will stop the server if the .env file is missing
    process.exit(1);
}

module.exports = pool;