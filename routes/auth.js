// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();

// User Registration
router.post('/register', async (req, res) => {
    const { id, name, email, password, role, roll_number, enrollment_number } = req.body;

    // Validation
    if (!id || !name || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const query = 'INSERT INTO users (id, name, email, password, role, roll_number, enrollment_number) VALUES ($1, $2, $3, $4, $5, $6, $7)';
        const values = [id, name, email, hashedPassword, role, roll_number || null, enrollment_number || null];

        await pool.query(query, values);

        res.status(201).json({ message: 'User registered successfully!' });

    } catch (error) {
        console.error('❌ Registration Error:', error.message);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Email or ID already exists' });
        }
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Role-specific login handler
const handleLogin = async (req, res, expectedRole) => {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.role !== expectedRole) {
            return res.status(403).json({ error: `Access denied. Please use the ${user.role} login` });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!process.env.JWT_SECRET) {
            console.error('❌ JWT_SECRET not configured');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        const payload = { user: { id: user.id, role: user.role, name: user.name } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.json({ token, user: payload.user });

    } catch (error) {
        console.error(`❌ ${expectedRole} login error:`, error.message);
        res.status(500).json({ error: 'Login failed' });
    }
};

// Login routes
router.post('/teacher/login', (req, res) => handleLogin(req, res, 'teacher'));
router.post('/student/login', (req, res) => handleLogin(req, res, 'student'));
router.post('/admin/login', (req, res) => handleLogin(req, res, 'admin'));

module.exports = router;