// backend/routes/teacher.js
const express = require('express');
const pool = require('../db');
const router = express.Router();

// Create a new lecture
router.post('/lectures', async (req, res) => {
    const { subject, date, time, teacher_id } = req.body;
    
    // Validation
    if (!subject || !date || !time || !teacher_id) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    const name = `${subject} - ${date}`; 

    try {
        const query = 'INSERT INTO lectures (name, subject, date, time, teacher_id) VALUES ($1, $2, $3, $4, $5) RETURNING id';
        const values = [name, subject, date, time, teacher_id];
        
        const result = await pool.query(query, values);
        const newLectureId = result.rows[0].id;

        const qrUrl = `${process.env.FRONTEND_URL}/attend?lectureId=${newLectureId}`;
        
        res.status(201).json({ 
            id: newLectureId, 
            qrUrl: qrUrl,
            name, subject, date, time, teacher_id
        });
    } catch (error) {
        console.error('❌ Error creating lecture:', error.message);
        res.status(500).json({ error: 'Failed to create lecture' });
    }
});

// Get all lectures for a teacher
router.get('/lectures/:teacherId', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM lectures WHERE teacher_id = $1 ORDER BY created_at DESC', 
            [req.params.teacherId]
        );
        
        const lecturesWithQrUrls = result.rows.map(lecture => ({
            ...lecture,
            qrUrl: `${process.env.FRONTEND_URL}/attend?lectureId=${lecture.id}`
        }));

        res.json(lecturesWithQrUrls);
    } catch (error) {
        console.error('❌ Error fetching lectures:', error.message);
        res.status(500).json({ error: 'Failed to fetch lectures' });
    }
});

// Get defaulter report (students with <75% attendance)
router.get('/reports/defaulters/:teacherId', async (req, res) => {
    try {
        const totalLecturesResult = await pool.query('SELECT COUNT(id) as total FROM lectures WHERE teacher_id = $1', [req.params.teacherId]);
        const totalLectures = totalLecturesResult.rows[0].total;

        if (totalLectures === 0) return res.json([]);

        const attendanceCountsResult = await pool.query(`
            SELECT u.id, u.name, u.roll_number, u.enrollment_number, COUNT(a.id) as attended_count
            FROM users u
            LEFT JOIN attendance a ON u.id = a.student_id
            WHERE u.role = 'student' AND a.lecture_id IN (SELECT id FROM lectures WHERE teacher_id = $1)
            GROUP BY u.id, u.name, u.roll_number, u.enrollment_number
        `, [req.params.teacherId]);

        const defaulters = attendanceCountsResult.rows.map(student => ({
            ...student,
            percentage: (student.attended_count / totalLectures) * 100
        })).filter(student => student.percentage < 75);

        if (defaulters.length > 0) {
            console.log(`📧 ${defaulters.length} defaulters identified`);
        }
        res.json(defaulters);
    } catch (error) {
        console.error('❌ Error fetching defaulter report:', error.message);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// Get live attendance records for a lecture
router.get('/lectures/:lectureId/attendance', async (req, res) => {
    try {
        const query = `
            SELECT a.id, a.timestamp, u.name as student_name, u.roll_number, u.enrollment_number 
             FROM attendance a
             JOIN users u ON a.student_id = u.id
             WHERE a.lecture_id = $1 
             ORDER BY a.timestamp ASC
        `;
        const result = await pool.query(query, [req.params.lectureId]);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching attendance:', error.message);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

// Get attendance report for a specific lecture
router.get('/lecture-report/:lectureId', async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.roll_number, u.enrollment_number, u.name, a.timestamp
            FROM attendance a
            JOIN users u ON a.student_id = u.id
            WHERE a.lecture_id = $1 AND a.status = 'present'
            ORDER BY u.roll_number ASC
        `;
        const result = await pool.query(query, [req.params.lectureId]);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching lecture report:', error.message);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

module.exports = router;