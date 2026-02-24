-- =====================================================
-- Migration: Add lecture archiving for admin data retention
-- =====================================================
-- This migration creates an archived_lectures table that preserves
-- lecture and attendance data even after lectures are auto-deleted.
-- =====================================================

-- 1. Create archived_lectures table
CREATE TABLE IF NOT EXISTS archived_lectures (
    id SERIAL PRIMARY KEY,
    original_lecture_id INTEGER NOT NULL,
    name VARCHAR(255),
    subject VARCHAR(255),
    date DATE,
    time VARCHAR(50),
    teacher_id VARCHAR(255),
    teacher_name VARCHAR(255),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    radius INTEGER DEFAULT 100,
    attendance_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create archived_attendance table
CREATE TABLE IF NOT EXISTS archived_attendance (
    id SERIAL PRIMARY KEY,
    original_attendance_id INTEGER,
    lecture_id INTEGER NOT NULL, -- references archived_lectures.original_lecture_id
    student_id VARCHAR(255),
    student_name VARCHAR(255),
    roll_number VARCHAR(100),
    enrollment_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'present',
    timestamp TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create function to archive a lecture and its attendance before deletion
CREATE OR REPLACE FUNCTION archive_lecture_before_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Archive the lecture
    INSERT INTO archived_lectures (original_lecture_id, name, subject, date, time, teacher_id, teacher_name, latitude, longitude, radius, attendance_count, created_at)
    SELECT 
        OLD.id,
        OLD.name,
        OLD.subject,
        OLD.date,
        OLD.time,
        OLD.teacher_id,
        COALESCE((SELECT name FROM users WHERE id = OLD.teacher_id), 'Unknown'),
        OLD.latitude,
        OLD.longitude,
        OLD.radius,
        (SELECT COUNT(*) FROM attendance WHERE lecture_id = OLD.id),
        OLD.created_at;

    -- Archive attendance records
    INSERT INTO archived_attendance (original_attendance_id, lecture_id, student_id, student_name, roll_number, enrollment_number, status, timestamp)
    SELECT 
        a.id,
        a.lecture_id,
        a.student_id,
        u.name,
        u.roll_number,
        u.enrollment_number,
        a.status,
        a.timestamp
    FROM attendance a
    JOIN users u ON a.student_id = u.id
    WHERE a.lecture_id = OLD.id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger on lectures table to auto-archive before delete
DROP TRIGGER IF EXISTS trigger_archive_lecture ON lectures;
CREATE TRIGGER trigger_archive_lecture
    BEFORE DELETE ON lectures
    FOR EACH ROW
    EXECUTE FUNCTION archive_lecture_before_delete();

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_archived_lectures_teacher ON archived_lectures(teacher_id);
CREATE INDEX IF NOT EXISTS idx_archived_lectures_date ON archived_lectures(date);
CREATE INDEX IF NOT EXISTS idx_archived_attendance_lecture ON archived_attendance(lecture_id);
CREATE INDEX IF NOT EXISTS idx_archived_attendance_student ON archived_attendance(student_id);

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Run this to verify the setup:
-- SELECT * FROM archived_lectures LIMIT 5;
-- SELECT * FROM archived_attendance LIMIT 5;
--
-- ROLLBACK (if needed):
-- DROP TRIGGER IF EXISTS trigger_archive_lecture ON lectures;
-- DROP FUNCTION IF EXISTS archive_lecture_before_delete();
-- DROP TABLE IF EXISTS archived_attendance;
-- DROP TABLE IF EXISTS archived_lectures;
-- =====================================================
