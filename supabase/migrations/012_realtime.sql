-- ═══════════════════════════════════════════════════════════════
-- SQL BLOĞU 12: Realtime Subscription
-- ═══════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE task_actions;
