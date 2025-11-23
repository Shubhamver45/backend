// backend/db.js
require('dotenv').config();
const { Pool } = require('pg');

let pool;

// This logic checks if you are on Render (for deployment) or running locally
if (process.env.DATABASE_URL) {
    // This is for your LIVE deployment on Render
    console.log("Connecting to Render PostgreSQL...");
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
} else if (process.env.SUPABASE_DB_HOST && process.env.SUPABASE_DB_PASSWORD) {
    // This is for your LOCAL development (running on your laptop)
    console.log("Connecting to Supabase PostgreSQL for local development...");
    pool = new Pool({
        host: process.env.SUPABASE_DB_HOST,
        port: 5432,
        user: 'postgres',
        password: process.env.SUPABASE_DB_PASSWORD,
        database: 'postgres'
    });
} else {
    console.error("Database connection string not found. Please check your backend/.env file.");
    // This will stop the server if the .env file is missing
    process.exit(1);
}

module.exports = pool;