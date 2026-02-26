-- ═══════════════════════════════════════════════════════════════
-- SQL BLOĞU 1: Extensions & Enums
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('admin', 'inspector', 'responsible');

CREATE TYPE task_status AS ENUM (
  'unassigned',
  'open',
  'in_progress',
  'completed',
  'closed',
  'rejected'
);

CREATE TYPE notification_type AS ENUM (
  'task_created',
  'task_assigned',
  'task_viewed',
  'action_added',
  'task_completed',
  'task_closed',
  'task_overdue',
  'task_reminder',
  'user_invited'
);

CREATE TYPE photo_type AS ENUM ('before', 'after');

CREATE TYPE email_status AS ENUM ('sent', 'failed', 'pending');
