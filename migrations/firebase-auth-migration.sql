-- Firebase Authentication Migration
-- This migration adds Firebase UID support and role management

-- Step 1: Add firebase_uid column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128) UNIQUE;

-- Step 2: Create index for firebase_uid for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Step 3: Create user_roles table for role management
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'student')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Step 4: Create index on user_id for faster role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- Step 5: Seed admin roles for existing admin users
INSERT INTO user_roles (user_id, role, created_at, updated_at)
SELECT id, 'admin', NOW(), NOW()
FROM users
WHERE email IN ('cherubindavid@gmail.com', 'colombemadoungou@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 6: Assign student role to all other existing users without roles
INSERT INTO user_roles (user_id, role, created_at, updated_at)
SELECT u.id, 'student', NOW(), NOW()
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Verification queries (comment out in production)
-- SELECT 'Total users' as metric, COUNT(*) as count FROM users;
-- SELECT 'Users with Firebase UID' as metric, COUNT(*) as count FROM users WHERE firebase_uid IS NOT NULL;
-- SELECT 'Total user roles' as metric, COUNT(*) as count FROM user_roles;
-- SELECT role, COUNT(*) as count FROM user_roles GROUP BY role;
