// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');
const adminRoutes = require('./routes/admin');
const pool = require('./db');
const cron = require('node-cron');
const { sendDeficiencyEmail } = require('./utils/mailer');

// --- AUTOMATED MONTHLY ALERTS ---
// Run at 00:00 on day 1 of every month: 0 0 1 * *
cron.schedule('0 0 1 * *', async () => {
    console.log('🕒 [Cron] Starting Automatic Monthly Attendance Alerts...');
    try {
        // Find all teachers
        const teachersRes = await pool.query("SELECT id, name FROM users WHERE role = 'teacher'");
        const teachers = teachersRes.rows;

        for (const teacher of teachers) {
            console.log(`📡 Processing alerts for Teacher: ${teacher.name}...`);
            
            // Re-use logic to find defaulters for this teacher
            const totalLecturesRes = await pool.query(`
                SELECT (SELECT COUNT(id) FROM lectures WHERE teacher_id = $1) + 
                       (SELECT COUNT(id) FROM archived_lectures WHERE teacher_id = $1) as total
            `, [teacher.id]);
            const total = parseInt(totalLecturesRes.rows[0].total || 0);

            if (total === 0) continue;

            const defaultersRes = await pool.query(`
                WITH deduplicated_students AS (
                    SELECT DISTINCT ON (COALESCE(NULLIF(TRIM(roll_number), ''), id)) id, name, roll_number, enrollment_number, subject_teacher_email, parents_email, mentor_email
                    FROM users WHERE role = 'student' ORDER BY COALESCE(NULLIF(TRIM(roll_number), ''), id), created_at DESC
                )
                SELECT ds.*, COUNT(combined_att.lecture_id) as attended_count
                FROM deduplicated_students ds
                LEFT JOIN (
                    SELECT student_id, lecture_id FROM attendance WHERE lecture_id IN (SELECT id FROM lectures WHERE teacher_id = $1)
                    UNION ALL
                    SELECT student_id, lecture_id FROM archived_attendance WHERE lecture_id IN (SELECT original_lecture_id FROM archived_lectures WHERE teacher_id = $1)
                ) combined_att ON ds.id = combined_att.student_id
                GROUP BY ds.id, ds.name, ds.roll_number, ds.enrollment_number, ds.subject_teacher_email, ds.parents_email, ds.mentor_email
            `, [teacher.id]);

            const defaulters = defaultersRes.rows.map(s => ({
                ...s, percentage: (parseInt(s.attended_count) / total) * 100
            })).filter(s => s.percentage < 75);

            // Send emails
            for (const student of defaulters) {
                sendDeficiencyEmail(student, {
                    parents_email: student.parents_email,
                    mentor_email: student.mentor_email,
                    subject_teacher_email: student.subject_teacher_email
                }, student.percentage);
            }
        }
        console.log('✅ [Cron] All monthly alerts sent successfully.');
    } catch (err) {
        console.error('❌ [Cron] Failed to execute monthly alerts:', err.message);
    }
});

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);

// Health check route
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Smart Attendance Backend',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Database health check
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as time, COUNT(*) as users FROM users');
        res.json({
            status: 'healthy',
            database: 'connected',
            timestamp: result.rows[0].time,
            users: result.rows[0].users
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            database: 'disconnected',
            error: error.message
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.listen(PORT, () => {
    console.log('🚀 Server started successfully');
    console.log(`📡 Listening on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'not set'}`);
    console.log('\n✨ Ready to accept connections!\n');
});