// backend/routes/admin.js
const express = require('express');
const pool = require('../db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const router = express.Router();

// Apply auth middleware to ALL admin routes
router.use(verifyToken, verifyAdmin);

// ─── Dashboard Stats (includes archived data) ──────────────
router.get('/dashboard-stats', async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM users WHERE role = 'teacher') AS total_teachers,
                (SELECT COUNT(*) FROM users WHERE role = 'student') AS total_students,
                (SELECT COUNT(*) FROM lectures) AS active_lectures,
                (SELECT COUNT(*) FROM attendance) AS active_attendance,
                COALESCE((SELECT COUNT(*) FROM archived_lectures), 0) AS archived_lectures,
                COALESCE((SELECT COUNT(*) FROM archived_attendance), 0) AS archived_attendance
        `);
        const row = stats.rows[0];
        res.json({
            total_teachers: parseInt(row.total_teachers),
            total_students: parseInt(row.total_students),
            active_lectures: parseInt(row.active_lectures),
            active_attendance: parseInt(row.active_attendance),
            archived_lectures: parseInt(row.archived_lectures),
            archived_attendance: parseInt(row.archived_attendance),
            total_lectures: parseInt(row.active_lectures) + parseInt(row.archived_lectures),
            total_attendance_records: parseInt(row.active_attendance) + parseInt(row.archived_attendance)
        });
    } catch (error) {
        // Fallback if archived tables don't exist yet
        try {
            const stats = await pool.query(`
                SELECT
                    (SELECT COUNT(*) FROM users WHERE role = 'teacher') AS total_teachers,
                    (SELECT COUNT(*) FROM users WHERE role = 'student') AS total_students,
                    (SELECT COUNT(*) FROM lectures) AS total_lectures,
                    (SELECT COUNT(*) FROM attendance) AS total_attendance_records
            `);
            res.json({
                ...stats.rows[0],
                active_lectures: parseInt(stats.rows[0].total_lectures),
                active_attendance: parseInt(stats.rows[0].total_attendance_records),
                archived_lectures: 0,
                archived_attendance: 0,
                total_lectures: parseInt(stats.rows[0].total_lectures),
                total_attendance_records: parseInt(stats.rows[0].total_attendance_records)
            });
        } catch (fallbackError) {
            console.error('❌ Error fetching dashboard stats:', fallbackError.message);
            res.status(500).json({ error: 'Failed to fetch dashboard stats' });
        }
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

// ─── Get All Active Lectures ───────────────────────────────
router.get('/all-lectures', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT l.*, u.name AS teacher_name, u.email AS teacher_email,
                   (SELECT COUNT(*) FROM attendance a WHERE a.lecture_id = l.id) AS attendance_count,
                   'active' AS status
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

// ─── Get All Archived Lectures ─────────────────────────────
router.get('/archived-lectures', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, original_lecture_id, name, subject, date, time, 
                   teacher_id, teacher_name, latitude, longitude, radius,
                   attendance_count, created_at, archived_at,
                   'archived' AS status
            FROM archived_lectures
            ORDER BY archived_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        // Table might not exist yet
        if (error.code === '42P01') {
            return res.json([]);
        }
        console.error('❌ Error fetching archived lectures:', error.message);
        res.status(500).json({ error: 'Failed to fetch archived lectures' });
    }
});

// ─── Get Combined Lectures (Active + Archived) ────────────
router.get('/combined-lectures', async (req, res) => {
    try {
        let activeLectures = [];
        let archivedLectures = [];

        // Fetch active
        const activeResult = await pool.query(`
            SELECT l.id, l.name, l.subject, l.date, l.time, l.teacher_id,
                   u.name AS teacher_name, u.email AS teacher_email,
                   (SELECT COUNT(*) FROM attendance a WHERE a.lecture_id = l.id) AS attendance_count,
                   l.created_at, 'active' AS status
            FROM lectures l
            JOIN users u ON l.teacher_id = u.id
            ORDER BY l.created_at DESC
        `);
        activeLectures = activeResult.rows;

        // Fetch archived (with fallback)
        try {
            const archivedResult = await pool.query(`
                SELECT id, original_lecture_id AS original_id, name, subject, date, time,
                       teacher_id, teacher_name, '' AS teacher_email,
                       attendance_count, created_at, archived_at, 'archived' AS status
                FROM archived_lectures
                ORDER BY archived_at DESC
            `);
            archivedLectures = archivedResult.rows;
        } catch (e) {
            // archived table doesn't exist yet — that's fine
        }

        res.json({ active: activeLectures, archived: archivedLectures, all: [...activeLectures, ...archivedLectures] });
    } catch (error) {
        console.error('❌ Error fetching combined lectures:', error.message);
        res.status(500).json({ error: 'Failed to fetch lectures' });
    }
});

// ─── Get All Active Attendance Records ─────────────────────
router.get('/all-attendance', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT a.id, a.lecture_id, a.student_id, a.status, a.timestamp,
                   u.name AS student_name, u.roll_number, u.enrollment_number,
                   l.name AS lecture_name, l.subject, l.date AS lecture_date,
                   'active' AS record_status
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

// ─── Get Combined Attendance (Active + Archived) ───────────
router.get('/combined-attendance', async (req, res) => {
    try {
        let activeRecords = [];
        let archivedRecords = [];

        const activeResult = await pool.query(`
            SELECT a.id, a.lecture_id, a.student_id, a.status, a.timestamp,
                   u.name AS student_name, u.roll_number, u.enrollment_number,
                   l.name AS lecture_name, l.subject, l.date AS lecture_date,
                   'active' AS record_status
            FROM attendance a
            JOIN users u ON a.student_id = u.id
            JOIN lectures l ON a.lecture_id = l.id
            ORDER BY a.timestamp DESC
        `);
        activeRecords = activeResult.rows;

        try {
            const archivedResult = await pool.query(`
                SELECT id, lecture_id, student_id, student_name, roll_number, 
                       enrollment_number, status, timestamp,
                       'archived' AS record_status
                FROM archived_attendance
                ORDER BY timestamp DESC
            `);
            archivedRecords = archivedResult.rows;
        } catch (e) {
            // archived table doesn't exist yet
        }

        res.json({ active: activeRecords, archived: archivedRecords, all: [...activeRecords, ...archivedRecords] });
    } catch (error) {
        console.error('❌ Error fetching combined attendance:', error.message);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

// ─── Attendance Trend Data (for charts) ────────────────────
router.get('/attendance-trend', async (req, res) => {
    try {
        // Get attendance per day for the last 30 days
        const result = await pool.query(`
            SELECT DATE(timestamp) as date, COUNT(*) as count
            FROM attendance
            WHERE timestamp >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(timestamp)
            ORDER BY date ASC
        `);

        // Also try archived data
        let archivedTrend = [];
        try {
            const archivedResult = await pool.query(`
                SELECT DATE(timestamp) as date, COUNT(*) as count
                FROM archived_attendance
                WHERE timestamp >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(timestamp)
                ORDER BY date ASC
            `);
            archivedTrend = archivedResult.rows;
        } catch (e) { }

        // Merge active and archived trend data
        const mergedMap = {};
        [...result.rows, ...archivedTrend].forEach(row => {
            const dateStr = new Date(row.date).toISOString().split('T')[0];
            mergedMap[dateStr] = (mergedMap[dateStr] || 0) + parseInt(row.count);
        });

        const trend = Object.entries(mergedMap).sort().map(([date, count]) => ({ date, count }));

        res.json(trend);
    } catch (error) {
        console.error('❌ Error fetching attendance trend:', error.message);
        res.status(500).json({ error: 'Failed to fetch trend data' });
    }
});

// ─── Top Students by Attendance ────────────────────────────
router.get('/top-students', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.name, u.roll_number, u.enrollment_number, COUNT(a.id) as attendance_count
            FROM users u
            JOIN attendance a ON u.id = a.student_id
            WHERE u.role = 'student'
            GROUP BY u.id, u.name, u.roll_number, u.enrollment_number
            ORDER BY attendance_count DESC
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching top students:', error.message);
        res.status(500).json({ error: 'Failed to fetch top students' });
    }
});

// ─── Attendance by Subject ─────────────────────────────────
router.get('/attendance-by-subject', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT l.subject, COUNT(a.id) as attendance_count, COUNT(DISTINCT l.id) as lecture_count
            FROM lectures l
            LEFT JOIN attendance a ON l.id = a.lecture_id
            WHERE l.subject IS NOT NULL
            GROUP BY l.subject
            ORDER BY attendance_count DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching attendance by subject:', error.message);
        res.status(500).json({ error: 'Failed to fetch subject data' });
    }
});

// ─── Delete a User ─────────────────────────────────────────
router.delete('/users/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own admin account' });
        }

        const userCheck = await pool.query('SELECT id, role, name FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const targetUser = userCheck.rows[0];
        if (targetUser.role === 'admin') {
            return res.status(403).json({ error: 'Cannot delete admin accounts' });
        }

        // Delete related records (triggers will archive lectures automatically)
        if (targetUser.role === 'student') {
            await pool.query('DELETE FROM attendance WHERE student_id = $1', [userId]);
        } else if (targetUser.role === 'teacher') {
            await pool.query(`DELETE FROM attendance WHERE lecture_id IN (SELECT id FROM lectures WHERE teacher_id = $1)`, [userId]);
            await pool.query('DELETE FROM lectures WHERE teacher_id = $1', [userId]); // Trigger will archive
        }

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
        const lectureCheck = await pool.query('SELECT id, name FROM lectures WHERE id = $1', [lectureId]);
        if (lectureCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Lecture not found' });
        }

        await pool.query('DELETE FROM attendance WHERE lecture_id = $1', [lectureId]);
        await pool.query('DELETE FROM lectures WHERE id = $1', [lectureId]); // Trigger will archive

        res.json({ message: `Lecture "${lectureCheck.rows[0].name}" deleted successfully and archived` });
    } catch (error) {
        console.error('❌ Error deleting lecture:', error.message);
        res.status(500).json({ error: 'Failed to delete lecture' });
    }
});

module.exports = router;
