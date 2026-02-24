-- ============================================
-- QUICK MIGRATION SCRIPT
-- Run this on your PostgreSQL database
-- ============================================

-- Step 1: Add geofencing columns to lectures table
ALTER TABLE lectures 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS radius INTEGER DEFAULT 100;

-- Step 2: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_lectures_geofence 
ON lectures(latitude, longitude) 
WHERE latitude IS NOT NULL;

-- Step 3: Verify the migration
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'lectures' 
AND column_name IN ('latitude', 'longitude', 'radius')
ORDER BY column_name;

-- Expected output:
-- column_name | data_type | column_default | is_nullable
-- ------------+-----------+----------------+-------------
-- latitude    | numeric   | NULL           | YES
-- longitude   | numeric   | NULL           | YES
-- radius      | integer   | 100            | YES

-- Step 4: (Optional) View updated table structure
\d lectures

-- ============================================
-- ROLLBACK (if needed)
-- ============================================
-- Uncomment and run these lines to remove geofencing:
-- DROP INDEX IF EXISTS idx_lectures_geofence;
-- ALTER TABLE lectures DROP COLUMN IF EXISTS latitude;
-- ALTER TABLE lectures DROP COLUMN IF EXISTS longitude;
-- ALTER TABLE lectures DROP COLUMN IF EXISTS radius;
