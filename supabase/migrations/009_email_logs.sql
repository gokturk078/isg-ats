-- ═══════════════════════════════════════════════════════════════
-- SQL BLOĞU 9: Email Logları
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE email_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  to_email    TEXT NOT NULL,
  to_name     TEXT,
  email_type  notification_type NOT NULL,
  subject     TEXT,
  status      email_status DEFAULT 'pending',
  error_msg   TEXT,
  resend_id   TEXT,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  retry_count INTEGER DEFAULT 0
);

CREATE INDEX idx_email_logs_task_id ON email_logs(task_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);
