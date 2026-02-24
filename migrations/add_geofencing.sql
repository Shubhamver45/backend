-- Migration: Add Geofencing Support to Lectures Table
-- Description: Adds latitude, longitude, and radius columns for GPS-based attendance verification
-- Date: 2026-01-30

-- Add geofencing columns to lectures table
ALTER TABLE lectures 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS radius INTEGER DEFAULT 100;

-- Add comments to document the columns
COMMENT ON COLUMN lectures.latitude IS 'GPS latitude coordinate for geofencing (-90 to 90)';
COMMENT ON COLUMN lectures.longitude IS 'GPS longitude coordinate for geofencing (-180 to 180)';
COMMENT ON COLUMN lectures.radius IS 'Geofence radius in meters (default: 100)';

-- Create index for geofencing queries (optional, for future optimization)
CREATE INDEX IF NOT EXISTS idx_lectures_geofence ON lectures(latitude, longitude) WHERE latitude IS NOT NULL;

-- Verify the migration
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'lectures' 
AND column_name IN ('latitude', 'longitude', 'radius');
