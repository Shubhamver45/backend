require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL
});

async function check() {
    try {
        const res = await pool.query(`
            SELECT conname, pg_get_constraintdef(oid) as def 
            FROM pg_constraint 
            WHERE conrelid = 'attendance'::regclass
        `);
        console.log('Constraints:', JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}
check();
