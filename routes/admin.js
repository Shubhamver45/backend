// backend/routes/admin.js
const express = require('express');
const pool = require('../db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const router = express.Router();

// Apply auth middleware to ALL admin routes
router.use(verifyToken, verifyAdmin);

// ─── Dashboard Stats ───────────────────────────────────────
router.get('/dashboard-stats', async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM users WHERE role = 'teacher') AS total_teachers,
                (SELECT COUNT(*) FROM users WHERE role = 'student') AS total_students,
                (SELECT COUNT(*) FROM lectures) AS total_lectures,
                (SELECT COUNT(*) FROM attendance) AS total_attendance_records
        `);
        res.json(stats.rows[0]);
    } catch (error) {
        console.error('❌ Error fetching dashboard stats:', error.message);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

// ─── Get All Teachers ──────────────────────────────────────
router.get('/all-teachers', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, email, created_at
            FROM users 
            WHERE role = 'teacher'
            ORDER BY created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching teachers:', error.message);
        res.status(500).json({ error: 'Failed to fetch teachers' });
    }
});

// ─── Get All Students ──────────────────────────────────────
router.get('/all-students', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, email, roll_number, enrollment_number, created_at
            FROM users 
            WHERE role = 'student'
            ORDER BY created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching students:', error.message);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

// ─── Get All Users (Teachers + Students) ───────────────────
router.get('/all-users', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, name, email, role, roll_number, enrollment_number, created_at
            FROM users 
            WHERE role != 'admin'
            ORDER BY role ASC, created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching users:', error.message);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// ─── Get All Lectures (across all teachers) ────────────────
router.get('/all-lectures', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT l.*, u.name AS teacher_name, u.email AS teacher_email,
                   (SELECT COUNT(*) FROM attendance a WHERE a.lecture_id = l.id) AS attendance_count
            FROM lectures l
            JOIN users u ON l.teacher_id = u.id
            ORDER BY l.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching all lectures:', error.message);
        res.status(500).json({ error: 'Failed to fetch lectures' });
    }
});

// ─── Get All Attendance Records (with details) ─────────────
router.get('/all-attendance', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.id, a.lecture_id, a.student_id, a.status, a.timestamp,
                   u.name AS student_name, u.roll_number, u.enrollment_number,
                   l.name AS lecture_name, l.subject, l.date AS lecture_date
            FROM attendance a
            JOIN users u ON a.student_id = u.id
            JOIN lectures l ON a.lecture_id = l.id
            ORDER BY a.timestamp DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching attendance records:', error.message);
        res.status(500).json({ error: 'Failed to fetch attendance records' });
    }
});

// ─── Delete a User ─────────────────────────────────────────
router.delete('/users/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // Prevent admin from deleting themselves
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own admin account' });
        }

        // Check if user exists
        const userCheck = await pool.query('SELECT id, role, name FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const targetUser = userCheck.rows[0];

        // Prevent deleting other admins
        if (targetUser.role === 'admin') {
            return res.status(403).json({ error: 'Cannot delete admin accounts' });
        }

        // Delete related records first (cascade)
        if (targetUser.role === 'student') {
            await pool.query('DELETE FROM attendance WHERE student_id = $1', [userId]);
        } else if (targetUser.role === 'teacher') {
            // Delete attendance records for this teacher's lectures, then the lectures
            await pool.query(`
                DELETE FROM attendance WHERE lecture_id IN (SELECT id FROM lectures WHERE teacher_id = $1)
            `, [userId]);
            await pool.query('DELETE FROM lectures WHERE teacher_id = $1', [userId]);
        }

        // Delete the user
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);

        res.json({ message: `User "${targetUser.name}" deleted successfully` });
    } catch (error) {
        console.error('❌ Error deleting user:', error.message);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// ─── Delete a Lecture ──────────────────────────────────────
router.delete('/lectures/:lectureId', async (req, res) => {
    const { lectureId } = req.params;
    try {
        // Check if lecture exists
        const lectureCheck = await pool.query('SELECT id, name FROM lectures WHERE id = $1', [lectureId]);
        if (lectureCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Lecture not found' });
        }

        // Delete attendance records for this lecture first
        await pool.query('DELETE FROM attendance WHERE lecture_id = $1', [lectureId]);

        // Delete the lecture
        await pool.query('DELETE FROM lectures WHERE id = $1', [lectureId]);

        res.json({ message: `Lecture "${lectureCheck.rows[0].name}" deleted successfully` });
    } catch (error) {
        console.error('❌ Error deleting lecture:', error.message);
        res.status(500).json({ error: 'Failed to delete lecture' });
    }
});

module.exports = router;
