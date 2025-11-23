// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors'); // We need CORS

const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');
const pool = require('./db');

const app = express();
// Render provides this PORT, or we use 3001 for local testing
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Allow requests from your Netlify frontend
app.use(express.json()); // Allow server to accept JSON data

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);

// Test route
app.get('/', (req, res) => {
    res.send('Smart Attendance Backend is running!');
});

// Debug route to test database connection
app.get('/api/debug/db-status', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ 
            status: 'success', 
            message: 'Database connected!',
            timestamp: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: error.message,
            code: error.code
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});