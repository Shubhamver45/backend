// backend/routes/teacher.js
const express = require('express');
const pool = require('../db');
const { sendDeficiencyEmail } = require('../utils/mailer');
const router = express.Router();

// Create a new lecture
router.post('/lectures', async (req, res) => {
    const { subject, date, time, teacher_id, latitude, longitude, radius } = req.body;

    // Validation
    if (!subject || !date || !time || !teacher_id) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const name = `${subject} - ${date}`;

    try {
        // Include geofencing fields in the query
        const query = `
            INSERT INTO lectures (name, subject, date, time, teacher_id, latitude, longitude, radius) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING id
        `;
        const values = [
            name,
            subject,
            date,
            time,
            teacher_id,
            latitude || null,  // Allow null if not provided
            longitude || null, // Allow null if not provided
            radius || 100      // Default to 100 meters
        ];

        const result = await pool.query(query, values);
        const newLectureId = result.rows[0].id;

        const qrUrl = `${process.env.FRONTEND_URL}/attend?lectureId=${newLectureId}`;

        res.status(201).json({
            id: newLectureId,
            qrUrl: qrUrl,
            name,
            subject,
            date,
            time,
            teacher_id,
            latitude,
            longitude,
            radius: radius || 100
        });
    } catch (error) {
        console.error('Ã¢ÂÅ’ Error creating lecture:', error.message);
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
        console.error('Ã¢ÂÅ’ Error fetching lectures:', error.message);
        res.status(500).json({ error: 'Failed to fetch lectures' });
    }
});

// Get defaulter report (students with <75% attendance) - Active + Archived
router.get('/reports/defaulters/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;

        // Count total lectures (Active + Archived)
        const totalLecturesResult = await pool.query(`
            SELECT 
                (SELECT COUNT(id) FROM lectures WHERE teacher_id = $1) + 
                (SELECT COUNT(id) FROM archived_lectures WHERE teacher_id = $1) as total
        `, [teacherId]);
        const totalLectures = parseInt(totalLecturesResult.rows[0].total || 0);

        if (totalLectures === 0) return res.json([]);

        // Get student attendance counts across both Active and Archived tables
        // Uses DISTINCT ON to deduplicate students by roll_number (if multiple accounts exist)
        const attendanceCountsResult = await pool.query(`
            WITH deduplicated_students AS (
                SELECT DISTINCT ON (COALESCE(NULLIF(TRIM(roll_number), ''), id)) id, name, roll_number, enrollment_number
                FROM users 
                WHERE role = 'student'
                ORDER BY COALESCE(NULLIF(TRIM(roll_number), ''), id), created_at DESC
            )
            SELECT ds.id, ds.name, ds.roll_number, ds.enrollment_number, COUNT(combined_att.lecture_id) as attended_count
            FROM deduplicated_students ds
            LEFT JOIN (
                SELECT student_id, lecture_id FROM attendance WHERE lecture_id IN (SELECT id FROM lectures WHERE teacher_id = $1)
                UNION ALL
                SELECT student_id, lecture_id FROM archived_attendance WHERE lecture_id IN (SELECT original_lecture_id FROM archived_lectures WHERE teacher_id = $1)
            ) combined_att ON ds.id = combined_att.student_id
            GROUP BY ds.id, ds.name, ds.roll_number, ds.enrollment_number
        `, [teacherId]);

        const defaulters = attendanceCountsResult.rows.map(student => ({
            ...student,
            attended_count: parseInt(student.attended_count),
            total_lectures: totalLectures,
            percentage: (parseInt(student.attended_count) / totalLectures) * 100
        })).filter(student => student.percentage < 75);

        res.json(defaulters);
    } catch (error) {
        console.error('❌ Error fetching defaulter report:', error.message);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// Send deficiency alerts (Manual Trigger)
router.post('/reports/send-alerts/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;

        // 1. Identify defaulters (Same logic as above)
        const totalLecturesResult = await pool.query(`
            SELECT 
                (SELECT COUNT(id) FROM lectures WHERE teacher_id = $1) + 
                (SELECT COUNT(id) FROM archived_lectures WHERE teacher_id = $1) as total
        `, [teacherId]);
        const totalLectures = parseInt(totalLecturesResult.rows[0].total || 0);

        if (totalLectures === 0) return res.status(400).json({ error: 'No lectures found for this teacher.' });

        const attendanceCountsResult = await pool.query(`
            WITH deduplicated_students AS (
                SELECT DISTINCT ON (COALESCE(NULLIF(TRIM(roll_number), ''), id)) id, name, roll_number, enrollment_number, subject_teacher_email, parents_email, mentor_email
                FROM users 
                WHERE role = 'student'
                ORDER BY COALESCE(NULLIF(TRIM(roll_number), ''), id), created_at DESC
            )
            SELECT ds.*, COUNT(combined_att.lecture_id) as attended_count
            FROM deduplicated_students ds
            LEFT JOIN (
                SELECT student_id, lecture_id FROM attendance WHERE lecture_id IN (SELECT id FROM lectures WHERE teacher_id = $1)
                UNION ALL
                SELECT student_id, lecture_id FROM archived_attendance WHERE lecture_id IN (SELECT original_lecture_id FROM archived_lectures WHERE teacher_id = $1)
            ) combined_att ON ds.id = combined_att.student_id
            GROUP BY ds.id, ds.name, ds.roll_number, ds.enrollment_number, ds.subject_teacher_email, ds.parents_email, ds.mentor_email
        `, [teacherId]);

        const defaulters = attendanceCountsResult.rows.map(student => ({
            ...student,
            attended_count: parseInt(student.attended_count),
            percentage: (parseInt(student.attended_count) / totalLectures) * 100
        })).filter(student => student.percentage < 75);

        if (defaulters.length === 0) {
            return res.json({ message: 'No students found with attendance below 75%.' });
        }

        // 2. Loop through and send emails
        let sentCount = 0;
        for (const student of defaulters) {
            const contacts = {
                parents_email: student.parents_email,
                mentor_email: student.mentor_email,
                subject_teacher_email: student.subject_teacher_email
            };
            
            // Send asynchronously (don't block the loop completely if one fails)
            sendDeficiencyEmail(student, contacts, student.percentage);
            sentCount++;
        }

        res.json({ message: `Success: Alerts initiated for ${sentCount} students.` });

    } catch (error) {
        console.error('❌ Error sending alerts:', error.message);
        res.status(500).json({ error: 'Failed to send alerts' });
    }
});

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
        console.error('Ã¢ÂÅ’ Error fetching attendance:', error.message);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

// Get attendance report for a specific lecture
router.get('/lecture-report/:lectureId', async (req, res) => {
    try {
        const query = `
            SELECT u.id as student_id, u.roll_number, u.enrollment_number, u.name as student_name, a.timestamp
            FROM users u
            LEFT JOIN attendance a ON u.id = a.student_id AND a.lecture_id = $1 AND a.status = 'present'
            WHERE u.role = 'student'
            ORDER BY u.roll_number ASC, u.name ASC
        `;
        const result = await pool.query(query, [req.params.lectureId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Ã¢ÂÅ’ Error fetching lecture report:', error.message);
        res.status(500).json({ error: 'Failed to fetch report' });
    }
});

// Get all students (for teacher reports)
router.get('/all-students', async (req, res) => {
    try {
        const query = `
            SELECT id, name, email, roll_number, enrollment_number
            FROM users 
            WHERE role = 'student'
            ORDER BY name ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Ã¢ÂÅ’ Error fetching students:', error.message);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

// Get all attendance records (for teacher reports)
router.get('/all-attendance', async (req, res) => {
    try {
        const query = `
            SELECT a.id, a.lecture_id, a.student_id, a.status, a.timestamp
            FROM attendance a
            ORDER BY a.timestamp DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Ã¢ÂÅ’ Error fetching attendance records:', error.message);
        res.status(500).json({ error: 'Failed to fetch attendance records' });
    }
});


// Get cumulative report for a teacher (ALL TIME - active + archived)
router.get('/reports/cumulative/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;

        // All students
        const studentsResult = await pool.query(
            'SELECT id, name, roll_number, enrollment_number FROM users WHERE role = $1 ORDER BY roll_number ASC, name ASC',
            ['student']
        );
        const students = studentsResult.rows;

        // Active lectures for this teacher
        const activeLecturesResult = await pool.query(
            'SELECT id, name, subject, date FROM lectures WHERE teacher_id = $1 ORDER BY date ASC, id ASC',
            [teacherId]
        );

        // Archived lectures for this teacher
        let archivedLectures = [];
        try {
            const archivedResult = await pool.query(
                'SELECT original_lecture_id AS id, name, subject, date FROM archived_lectures WHERE teacher_id = $1 ORDER BY date ASC, original_lecture_id ASC',
                [teacherId]
            );
            archivedLectures = archivedResult.rows;
        } catch (e) { /* archived table may not exist yet */ }

        // Merge and deduplicate (active takes priority)
        const activeIds = new Set(activeLecturesResult.rows.map(l => String(l.id)));
        const allLectures = [
            ...activeLecturesResult.rows,
            ...archivedLectures.filter(l => !activeIds.has(String(l.id)))
        ].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Active attendance records
        const activeAttendanceResult = await pool.query(
            'SELECT student_id, lecture_id FROM attendance WHERE lecture_id IN (SELECT id FROM lectures WHERE teacher_id = $1)',
            [teacherId]
        );

        // Archived attendance records
        let archivedAttendance = [];
        try {
            const archivedAttResult = await pool.query(
                'SELECT student_id, lecture_id FROM archived_attendance WHERE lecture_id IN (SELECT original_lecture_id FROM archived_lectures WHERE teacher_id = $1)',
                [teacherId]
            );
            archivedAttendance = archivedAttResult.rows;
        } catch (e) { /* archived table may not exist yet */ }

        const records = [...activeAttendanceResult.rows, ...archivedAttendance];

        res.json({ students, lectures: allLectures, records });
    } catch (error) {
        console.error('Error fetching cumulative report:', error.message);
        res.status(500).json({ error: 'Failed to fetch cumulative report' });
    }
});

// Get month-wise cumulative report for a teacher (active + archived)
router.get('/reports/monthly/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;
        const { month, year } = req.query;

        // All students
        const studentsResult = await pool.query(
            'SELECT id, name, roll_number, enrollment_number FROM users WHERE role = $1 ORDER BY roll_number ASC, name ASC',
            ['student']
        );
        const students = studentsResult.rows;

        // Build month/year filter
        let monthFilter = '';
        const activeParams = [teacherId];
        const archivedParams = [teacherId];

        if (month && year) {
            monthFilter = ` AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3`;
            activeParams.push(parseInt(month), parseInt(year));
            archivedParams.push(parseInt(month), parseInt(year));
        } else if (year) {
            monthFilter = ` AND EXTRACT(YEAR FROM date) = $2`;
            activeParams.push(parseInt(year));
            archivedParams.push(parseInt(year));
        }

        // Active lectures filtered by month/year
        const activeLecturesResult = await pool.query(
            `SELECT id, name, subject, date FROM lectures WHERE teacher_id = $1${monthFilter} ORDER BY date ASC, id ASC`,
            activeParams
        );

        // Archived lectures filtered by month/year
        let archivedLectures = [];
        try {
            const archivedResult = await pool.query(
                `SELECT original_lecture_id AS id, name, subject, date FROM archived_lectures WHERE teacher_id = $1${monthFilter} ORDER BY date ASC, original_lecture_id ASC`,
                archivedParams
            );
            archivedLectures = archivedResult.rows;
        } catch (e) { /* archived table may not exist */ }

        // Merge and deduplicate
        const activeIds = new Set(activeLecturesResult.rows.map(l => String(l.id)));
        const allLectures = [
            ...activeLecturesResult.rows,
            ...archivedLectures.filter(l => !activeIds.has(String(l.id)))
        ].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Attendance records for these lectures
        const allLectureIds = allLectures.map(l => l.id);
        let records = [];

        if (allLectureIds.length > 0) {
            // Active attendance
            const activeAttResult = await pool.query(
                'SELECT student_id, lecture_id FROM attendance WHERE lecture_id = ANY($1)',
                [allLectureIds]
            );
            records = activeAttResult.rows;

            // Archived attendance
            try {
                const archivedAttResult = await pool.query(
                    'SELECT student_id, lecture_id FROM archived_attendance WHERE lecture_id = ANY($1)',
                    [allLectureIds]
                );
                records = [...records, ...archivedAttResult.rows];
            } catch (e) { /* archived table may not exist */ }
        }

        res.json({ students, lectures: allLectures, records, month, year });
    } catch (error) {
        console.error('Error fetching monthly report:', error.message);
        res.status(500).json({ error: 'Failed to fetch monthly report' });
    }
});

module.exports = router;

