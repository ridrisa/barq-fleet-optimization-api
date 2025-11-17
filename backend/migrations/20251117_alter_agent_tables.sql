-- =================================================================
-- Alter Agent System Tables Migration
-- =================================================================
-- Purpose: Add missing columns to existing agent system tables
-- Date: 2025-11-17
-- =================================================================

-- Add status column to assignment_logs if it doesn't exist
ALTER TABLE assignment_logs
ADD COLUMN IF NOT EXISTS status VARCHAR(50);

-- Add assignment_strategy column if it doesn't exist
ALTER TABLE assignment_logs
ADD COLUMN IF NOT EXISTS assignment_strategy VARCHAR(100);

-- Add distance_km column if it doesn't exist
ALTER TABLE assignment_logs
ADD COLUMN IF NOT EXISTS distance_km DECIMAL(10,2);

-- Add estimated_time_minutes column if it doesn't exist
ALTER TABLE assignment_logs
ADD COLUMN IF NOT EXISTS estimated_time_minutes INTEGER;

-- Add confidence_score column if it doesn't exist
ALTER TABLE assignment_logs
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2);

-- Add alternative_count column if it doesn't exist
ALTER TABLE assignment_logs
ADD COLUMN IF NOT EXISTS alternative_count INTEGER DEFAULT 0;

-- Add created_by column if it doesn't exist
ALTER TABLE assignment_logs
ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT 'AGENT_SYSTEM';

-- Create index on status column if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_assignment_logs_status ON assignment_logs(status);

-- Create optimization_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS optimization_logs (
  id SERIAL PRIMARY KEY,
  batch_id VARCHAR(255),
  optimization_type VARCHAR(100),
  orders_count INTEGER,
  distance_before_km DECIMAL(10,2),
  distance_after_km DECIMAL(10,2),
  distance_saved_km DECIMAL(10,2),
  time_before_minutes INTEGER,
  time_after_minutes INTEGER,
  time_saved_minutes INTEGER,
  cost_before DECIMAL(10,2),
  cost_after DECIMAL(10,2),
  cost_saved DECIMAL(10,2),
  algorithm_used VARCHAR(100),
  computation_time_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  optimized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB,
  created_by VARCHAR(100) DEFAULT 'AGENT_SYSTEM'
);

-- Create indexes for optimization_logs
CREATE INDEX IF NOT EXISTS idx_optimization_logs_batch ON optimization_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_optimization_logs_type ON optimization_logs(optimization_type);
CREATE INDEX IF NOT EXISTS idx_optimization_logs_timestamp ON optimization_logs(optimized_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_logs_success ON optimization_logs(success);

-- =================================================================
-- Migration Complete
-- These alterations make the tables compatible with the agent system
-- =================================================================