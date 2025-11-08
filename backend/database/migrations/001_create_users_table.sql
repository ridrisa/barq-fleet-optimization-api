-- Create users table for authentication
-- Migration: 001_create_users_table
-- Created: 2025-01-05

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'customer',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,

  -- Indexes
  CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'admin', 'manager', 'dispatcher', 'driver', 'customer', 'external_service'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default super admin user
-- Password: Admin@123 (CHANGE THIS IN PRODUCTION!)
INSERT INTO users (email, password_hash, name, role, active)
VALUES (
  'admin@barq.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyB9POx4S7Ie',
  'System Administrator',
  'super_admin',
  true
)
ON CONFLICT (email) DO NOTHING;

-- Comments
COMMENT ON TABLE users IS 'User accounts for authentication and authorization';
COMMENT ON COLUMN users.id IS 'Unique user identifier (UUID)';
COMMENT ON COLUMN users.email IS 'User email address (unique, used for login)';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password (never store plain text passwords)';
COMMENT ON COLUMN users.name IS 'User full name';
COMMENT ON COLUMN users.role IS 'User role for RBAC (super_admin, admin, manager, dispatcher, driver, customer, external_service)';
COMMENT ON COLUMN users.active IS 'Whether the user account is active';
COMMENT ON COLUMN users.created_at IS 'Timestamp when user was created';
COMMENT ON COLUMN users.updated_at IS 'Timestamp when user was last updated (auto-updated by trigger)';
COMMENT ON COLUMN users.last_login IS 'Timestamp of last successful login';
