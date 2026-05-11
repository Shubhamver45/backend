// backend/routes/student.js
const express = require('express');
const pool = require('../db');
const router = express.Router();

// Mark attendance for a lecture
router.post('/mark-attendance', async (req, res) => {
    const { lectureId, studentId } = req.body;
    
    // Validation
    if (!lectureId || !studentId) {
        return res.status(400).json({ error: 'Lecture ID and Student ID are required' });
    } 

    try {
        const existingCheck = await pool.query(
            'SELECT * FROM attendance WHERE lecture_id = $1 AND student_id = $2',
            [lectureId, studentId]
        );

        if (existingCheck.rows.length > 0) {
            return res.status(409).json({ message: 'Attendance already marked for this lecture.' });
        }

        const result = await pool.query(
            'INSERT INTO attendance (lecture_id, student_id, status) VALUES ($1, $2, $3) RETURNING id',
            [lectureId, studentId, 'present']
        );
        
        res.status(201).json({ 
            message: 'Attendance marked successfully',
            newRecordId: result.rows[0].id 
        });

    } catch (error) {
        console.error('❌ Error marking attendance:', error.message);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
});

// Get all available lectures
router.get('/lectures', async (req, res) => {
    try {
        const query = `
            SELECT lectures.*, users.name as teacher_name 
            FROM lectures 
            JOIN users ON lectures.teacher_id = users.id 
            WHERE users.role = 'teacher'
            ORDER BY lectures.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching lectures:', error.message);
        res.status(500).json({ error: 'Failed to fetch lectures' });
    }
});

// Get student's attendance history
router.get('/attendance/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const result = await pool.query(
            'SELECT * FROM attendance WHERE student_id = $1 ORDER BY timestamp DESC',
            [studentId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching attendance history:', error.message);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

// Get student profile
router.get('/profile/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const result = await pool.query(
            'SELECT id, name, email, roll_number, enrollment_number, subject_teacher_email, parents_email, mentor_email FROM users WHERE id = $1',
            [studentId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Error fetching profile:', error.message);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update student profile
router.put('/profile/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { subject_teacher_email, parents_email, mentor_email } = req.body;
        
        await pool.query(
            'UPDATE users SET subject_teacher_email = $1, parents_email = $2, mentor_email = $3 WHERE id = $4',
            [subject_teacher_email, parents_email, mentor_email, studentId]
        );
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('❌ Error updating profile:', error.message);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Phase 2: Leave Application System
// Apply for leave
router.post('/leaves', async (req, res) => {
    try {
        const { studentId, start_date, end_date, reason } = req.body;
        
        if (!studentId || !start_date || !end_date || !reason) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        await pool.query(
            'INSERT INTO leaves (student_id, start_date, end_date, reason) VALUES ($1, $2, $3, $4)',
            [studentId, start_date, end_date, reason]
        );

        // Fetch student name and teacher email for notification
        try {
            const studentRes = await pool.query('SELECT name, subject_teacher_email FROM users WHERE id = $1', [studentId]);
            if (studentRes.rows.length > 0) {
                const { name, subject_teacher_email } = studentRes.rows[0];
                if (subject_teacher_email) {
                    const { sendLeaveNotificationEmail } = require('../utils/mailer');
                    await sendLeaveNotificationEmail(name, subject_teacher_email, { start_date, end_date, reason });
                }
            }
        } catch (mailErr) {
            console.error('⚠️ Could not send leave notification email:', mailErr.message);
        }

        res.status(201).json({ message: 'Leave application submitted successfully. Your Class Teacher has been notified.' });
    } catch (error) {
        console.error('❌ Error applying for leave:', error.message);
        res.status(500).json({ error: 'Failed to apply for leave' });
    }
});

// Get student's leaves
router.get('/leaves/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const result = await pool.query(
            'SELECT * FROM leaves WHERE student_id = $1 ORDER BY created_at DESC',
            [studentId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching leaves:', error.message);
        res.status(500).json({ error: 'Failed to fetch leaves' });
    }
});

module.exports = router;