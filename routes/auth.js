// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// THIS IS THE FIX: It now correctly imports your PostgreSQL database pool
const pool = require('../db');
const router = express.Router();

// --- User Registration (PostgreSQL syntax) ---
router.post('/register', async (req, res) => {
    const { id, name, email, password, role, roll_number, enrollment_number } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const query = 'INSERT INTO users (id, name, email, password, role, roll_number, enrollment_number) VALUES ($1, $2, $3, $4, $5, $6, $7)';
        const values = [id, name, email, hashedPassword, role, roll_number || null, enrollment_number || null];
        
        await pool.query(query, values);
        
        res.status(201).json({ message: 'User registered successfully!' });

    } catch (error) {
        console.error('Registration Error:', error);
        if (error.code === '23505') { // PostgreSQL unique violation
            return res.status(409).json({ error: 'Email or ID already exists.' });
        }
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// --- Role-Specific Login Logic (Helper Function) ---
const handleLogin = async (req, res, expectedRole) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        
        if (user.role !== expectedRole) {
            return res.status(403).json({ error: `Access denied. Please use the '${user.role}' login portal.` });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const payload = { user: { id: user.id, role: user.role, name: user.name } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ token, user: payload.user });

    } catch (error) {
        console.error(`Login Error for ${expectedRole}:`, error);
        res.status(500).json({ error: 'Server error during login.' });
    }
};

// --- Separate Login Routes ---
router.post('/teacher/login', (req, res) => handleLogin(req, res, 'teacher'));
router.post('/student/login', (req, res) => handleLogin(req, res, 'student'));

module.exports = router;