-- ═══════════════════════════════════════════════════════════════
-- SQL BLOĞU 13: İstatistik View'ları (Dashboard için)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW task_statistics AS
SELECT
  COUNT(*) FILTER (WHERE status = 'unassigned')             AS unassigned_count,
  COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) AS active_count,
  COUNT(*) FILTER (WHERE status = 'completed')              AS completed_count,
  COUNT(*) FILTER (WHERE status = 'closed')                 AS closed_count,
  COUNT(*) FILTER (WHERE status = 'rejected')               AS rejected_count,
  COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('closed', 'completed', 'rejected')) AS overdue_count,
  COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) AS this_month_count,
  COUNT(*) AS total_count
FROM tasks;

CREATE OR REPLACE VIEW category_statistics AS
SELECT
  tc.id,
  tc.name,
  tc.color,
  COUNT(t.id)                                               AS total_count,
  COUNT(t.id) FILTER (WHERE t.status = 'closed')           AS closed_count,
  COUNT(t.id) FILTER (WHERE t.due_date < NOW() AND t.status NOT IN ('closed','completed','rejected')) AS overdue_count,
  ROUND(
    COUNT(t.id) FILTER (WHERE t.status = 'closed')::numeric /
    NULLIF(COUNT(t.id), 0) * 100, 1
  ) AS closure_rate
FROM task_categories tc
LEFT JOIN tasks t ON t.category_id = tc.id
GROUP BY tc.id, tc.name, tc.color
ORDER BY total_count DESC;

CREATE OR REPLACE VIEW monthly_task_trend AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  TO_CHAR(created_at, 'Mon YYYY')  AS month_label,
  COUNT(*)                          AS created_count,
  COUNT(*) FILTER (WHERE status = 'closed')    AS closed_count,
  COUNT(*) FILTER (WHERE status NOT IN ('closed','completed','rejected') AND due_date < NOW()) AS overdue_count
FROM tasks
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at), TO_CHAR(created_at, 'Mon YYYY')
ORDER BY month ASC;

CREATE OR REPLACE VIEW severity_distribution AS
SELECT
  severity,
  CASE severity
    WHEN 5 THEN '★★★★★ İŞ DERHAL DURACAK'
    WHEN 4 THEN '★★★★ EN FAZLA 2 GÜN'
    WHEN 3 THEN '★★★ EN FAZLA 1 HAFTA'
    WHEN 2 THEN '★★ BİR SONRAKİ DENETİM'
    WHEN 1 THEN '★ PLANLANAN DENETİM'
  END AS severity_label,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE status = 'closed') AS closed_count
FROM tasks
GROUP BY severity
ORDER BY severity DESC;
