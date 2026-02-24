// backend/db.js
require('dotenv').config();
const { Pool } = require('pg');

let pool;

// Get database URL from environment variables
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error('❌ DATABASE_URL not found in environment variables.');
    console.error('Please create a .env file in the backend directory with:');
    console.error('DATABASE_URL=postgresql://username:password@host:port/database');
    process.exit(1);
}

console.log('✅ Connecting to PostgreSQL database...');
console.log('📍 Host:', dbUrl.split('@')[1]?.split(':')[0] || 'unknown');

const config = { 
    connectionString: dbUrl,
    // Enable SSL for production/hosted databases
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

pool = new Pool(config);

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    }
    console.log('✅ Database connected successfully at', res.rows[0].now);
});

// Handle pool errors
pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
});

module.exports = pool;