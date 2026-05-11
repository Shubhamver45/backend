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
pool.query('SELECT NOW()', async (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        console.error('⚠️  Server will continue — pool will retry connections automatically.');
        return;
    }
    console.log('✅ Database connected successfully at', res.rows[0].now);

    // Phase 2: Create leaves table if it doesn't exist
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS leaves (
                id SERIAL PRIMARY KEY,
                student_id VARCHAR(50) REFERENCES users(id),
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                reason TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Leaves table initialized.');

        // Phase 4: Add face_embedding to users table
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS face_embedding TEXT;
        `);
        console.log('✅ Users table updated with face_embedding column.');
    } catch (tableErr) {
        console.error('❌ Error initializing database tables:', tableErr.message);
    }
});

// Handle pool errors
pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
});

module.exports = pool;