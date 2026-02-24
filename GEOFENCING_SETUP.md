# Backend Setup Guide - Geofencing Update

## Quick Start

If you already have the backend running, follow these steps to add geofencing support:

### Step 1: Update Database Schema

Run this SQL migration on your PostgreSQL database:

```sql
-- Add geofencing columns
ALTER TABLE lectures 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS radius INTEGER DEFAULT 100;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_lectures_geofence 
ON lectures(latitude, longitude) 
WHERE latitude IS NOT NULL;

-- Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'lectures' 
AND column_name IN ('latitude', 'longitude', 'radius');
```

#### Option A: Using psql command line
```bash
psql $DATABASE_URL < migrations/add_geofencing.sql
```

#### Option B: Using a database GUI
1. Open your database in pgAdmin, DBeaver, or similar tool
2. Run the SQL commands above
3. Verify the new columns exist

#### Option C: Using Render/Railway dashboard
1. Go to your database dashboard
2. Open the SQL console
3. Paste and run the migration SQL
4. Verify success

### Step 2: Verify Backend Code

The backend code has been updated with:
- ✅ Modified `routes/teacher.js` to accept and store geofencing data
- ✅ Added missing endpoints (`/all-students`, `/all-attendance`)
- ✅ Updated README documentation

No additional dependencies needed - the changes use existing packages.

### Step 3: Test the Backend

#### Test 1: Create Lecture with Geofencing
```bash
curl -X POST http://localhost:3001/api/teacher/lectures \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "subject": "Test Lecture",
    "date": "2026-01-30",
    "time": "10:00",
    "teacher_id": "YOUR_TEACHER_ID",
    "latitude": 28.7041,
    "longitude": 77.1025,
    "radius": 100
  }'
```

Expected response:
```json
{
  "id": 1,
  "qrUrl": "http://localhost:5173/attend?lectureId=1",
  "name": "Test Lecture - 2026-01-30",
  "subject": "Test Lecture",
  "date": "2026-01-30",
  "time": "10:00",
  "teacher_id": "YOUR_TEACHER_ID",
  "latitude": 28.7041,
  "longitude": 77.1025,
  "radius": 100
}
```

#### Test 2: Get Lectures (Verify Geofencing Data)
```bash
curl http://localhost:3001/api/teacher/lectures/YOUR_TEACHER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Should return lectures with `latitude`, `longitude`, and `radius` fields.

#### Test 3: Backward Compatibility
Create a lecture WITHOUT geofencing:
```bash
curl -X POST http://localhost:3001/api/teacher/lectures \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "subject": "No Geofence Lecture",
    "date": "2026-01-30",
    "time": "11:00",
    "teacher_id": "YOUR_TEACHER_ID"
  }'
```

Should work fine with `latitude`, `longitude`, and `radius` as null/default.

### Step 4: Deploy to Production

#### If using Render:
1. Push your changes to GitHub
2. Render will auto-deploy the backend
3. Run the migration SQL in Render's database console
4. Verify deployment

#### If using Railway:
1. Push your changes to GitHub
2. Railway will auto-deploy
3. Run migration: `railway run psql $DATABASE_URL < migrations/add_geofencing.sql`
4. Verify deployment

#### If using Vercel + External DB:
1. Deploy backend to Vercel
2. Run migration on your database (Supabase, Neon, etc.)
3. Verify deployment

### Step 5: Verify End-to-End

1. **Frontend**: Create a lecture with geofencing
2. **Backend**: Check database to confirm data is stored
3. **Student**: Try to mark attendance (should verify location)

## Troubleshooting

### Migration Fails: "column already exists"
This is fine! It means the column was already added. The `IF NOT EXISTS` clause prevents errors.

### Migration Fails: "permission denied"
Your database user needs ALTER TABLE permissions. Contact your database admin or use a superuser account.

### Lectures don't show geofencing data
1. Check if migration ran successfully
2. Verify columns exist: `\d lectures` in psql
3. Check if data was actually saved during lecture creation

### API returns 500 error when creating lecture
1. Check server logs for the exact error
2. Verify database connection is working
3. Ensure all required fields are provided
4. Check if migration was successful

## Database Schema Reference

After migration, your `lectures` table should look like:

```sql
CREATE TABLE lectures (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    teacher_id VARCHAR(50) REFERENCES users(id),
    latitude DECIMAL(10, 8),           -- NEW
    longitude DECIMAL(11, 8),          -- NEW
    radius INTEGER DEFAULT 100,        -- NEW
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Changes Summary

### Modified Endpoints:

**POST /api/teacher/lectures**
- Now accepts: `latitude`, `longitude`, `radius` (all optional)
- Returns: All lecture data including geofencing fields

**GET /api/teacher/lectures/:teacherId**
- Now returns: `latitude`, `longitude`, `radius` for each lecture

**GET /api/student/lectures**
- Now returns: `latitude`, `longitude`, `radius` for each lecture

### New Endpoints:

**GET /api/teacher/all-students**
- Returns: List of all registered students

**GET /api/teacher/all-attendance**
- Returns: All attendance records

## Environment Variables

No new environment variables needed! The geofencing feature uses existing configuration.

## Performance Considerations

The geofencing feature:
- ✅ Adds minimal database overhead (3 columns)
- ✅ Includes index for geofencing queries
- ✅ No impact on existing queries
- ✅ Optional feature (doesn't slow down non-geofenced lectures)

## Security Notes

- Location data is stored in the database
- Only lecture locations are stored (not student locations)
- Frontend performs distance calculations
- No sensitive data exposed in API responses
- Backward compatible with existing system

## Next Steps

1. ✅ Run database migration
2. ✅ Deploy updated backend
3. ✅ Test with frontend
4. ✅ Monitor for any issues
5. ✅ Train teachers on new feature

## Support

If you encounter issues:
1. Check server logs: `npm run dev` or check deployment logs
2. Verify database schema: `\d lectures` in psql
3. Test API endpoints with curl or Postman
4. Check frontend console for errors

---

**You're all set!** The backend is now ready to support geofencing. 🎉
