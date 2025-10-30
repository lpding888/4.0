-- ==========================================
-- 分销代理系统 - 数据一致性验证SQL
-- ==========================================

-- 验证1: 分销员累计佣金 = 佣金记录之和
-- 预期: distributor_total 应该等于 commission_sum
SELECT
  d.id AS distributor_id,
  d.real_name,
  d.total_commission AS distributor_total,
  COALESCE(SUM(c.commission_amount), 0) AS commission_sum,
  (d.total_commission - COALESCE(SUM(c.commission_amount), 0)) AS difference
FROM distributors d
LEFT JOIN commissions c ON d.id = c.distributor_id
GROUP BY d.id, d.real_name, d.total_commission
HAVING ABS(difference) > 0.01;  -- 允许0.01元的浮点误差

-- ==========================================

-- 验证2: 可提现佣金 = 累计佣金 - 冻结佣金 - 已提现佣金
-- 预期: available_commission 应该等于 total_commission - frozen_sum - withdrawn_commission
SELECT
  d.id AS distributor_id,
  d.real_name,
  d.total_commission,
  d.available_commission,
  d.withdrawn_commission,
  COALESCE(SUM(CASE WHEN c.status = 'frozen' THEN c.commission_amount ELSE 0 END), 0) AS frozen_sum,
  COALESCE(SUM(CASE WHEN c.status = 'available' THEN c.commission_amount ELSE 0 END), 0) AS available_sum,
  (d.available_commission - available_sum) AS available_difference
FROM distributors d
LEFT JOIN commissions c ON d.id = c.distributor_id
GROUP BY d.id, d.real_name, d.total_commission, d.available_commission, d.withdrawn_commission
HAVING ABS(available_difference) > 0.01;  -- 允许0.01元的浮点误差

-- ==========================================

-- 验证3: 检查是否有重复计佣的订单
-- 预期: 应该返回空结果（没有重复）
SELECT
  order_id,
  distributor_id,
  COUNT(*) AS duplicate_count
FROM commissions
GROUP BY order_id, distributor_id
HAVING COUNT(*) > 1;

-- ==========================================

-- 验证4: 检查是否有推荐关系但没有分销员的情况
-- 预期: 应该返回空结果（推荐人都是分销员）
SELECT
  rr.id AS relation_id,
  rr.referrer_user_id,
  rr.referred_user_id,
  d.id AS distributor_id,
  d.status AS distributor_status
FROM referral_relationships rr
LEFT JOIN distributors d ON rr.referrer_distributor_id = d.id
WHERE d.id IS NULL OR d.status != 'active';

-- ==========================================

-- 验证5: 检查用户是否被多次推荐
-- 预期: 应该返回空结果（每个用户只能被推荐一次）
SELECT
  referred_user_id,
  COUNT(*) AS referral_count
FROM referral_relationships
GROUP BY referred_user_id
HAVING COUNT(*) > 1;

-- ==========================================

-- 验证6: 提现金额校验
-- 预期: 提现金额不应该大于可提现余额+已提现金额
SELECT
  d.id AS distributor_id,
  d.real_name,
  d.available_commission,
  d.withdrawn_commission,
  COALESCE(SUM(CASE WHEN w.status = 'pending' THEN w.amount ELSE 0 END), 0) AS pending_withdrawals,
  COALESCE(SUM(CASE WHEN w.status = 'approved' THEN w.amount ELSE 0 END), 0) AS approved_withdrawals,
  (d.available_commission + pending_withdrawals - approved_withdrawals) AS remaining_balance
FROM distributors d
LEFT JOIN withdrawals w ON d.id = w.distributor_id
GROUP BY d.id, d.real_name, d.available_commission, d.withdrawn_commission
HAVING remaining_balance < 0;

-- ==========================================

-- 验证7: 佣金状态统计
-- 用于检查佣金流转状态是否正常
SELECT
  d.id AS distributor_id,
  d.real_name,
  d.total_commission,
  COUNT(CASE WHEN c.status = 'frozen' THEN 1 END) AS frozen_count,
  COUNT(CASE WHEN c.status = 'available' THEN 1 END) AS available_count,
  COUNT(CASE WHEN c.status = 'withdrawn' THEN 1 END) AS withdrawn_count,
  COUNT(CASE WHEN c.status = 'cancelled' THEN 1 END) AS cancelled_count,
  SUM(CASE WHEN c.status = 'frozen' THEN c.commission_amount ELSE 0 END) AS frozen_amount,
  SUM(CASE WHEN c.status = 'available' THEN c.commission_amount ELSE 0 END) AS available_amount,
  SUM(CASE WHEN c.status = 'withdrawn' THEN c.commission_amount ELSE 0 END) AS withdrawn_amount,
  SUM(CASE WHEN c.status = 'cancelled' THEN c.commission_amount ELSE 0 END) AS cancelled_amount
FROM distributors d
LEFT JOIN commissions c ON d.id = c.distributor_id
GROUP BY d.id, d.real_name, d.total_commission
ORDER BY d.total_commission DESC;

-- ==========================================

-- 验证8: 冻结期检查
-- 检查是否有冻结期已结束但状态仍为frozen的佣金
SELECT
  id,
  distributor_id,
  order_id,
  commission_amount,
  status,
  freeze_until,
  TIMESTAMPDIFF(HOUR, freeze_until, NOW()) AS hours_overdue
FROM commissions
WHERE status = 'frozen'
  AND freeze_until < NOW()
ORDER BY freeze_until ASC
LIMIT 20;

-- ==========================================

-- 验证9: 订单首单检查
-- 检查是否有多次计佣的用户（违反首单计佣原则）
SELECT
  referred_user_id,
  COUNT(DISTINCT order_id) AS commission_count
FROM commissions
GROUP BY referred_user_id
HAVING COUNT(DISTINCT order_id) > 1;

-- ==========================================

-- 验证10: 分销员数据概览
-- 查看整体数据健康度
SELECT
  '总分销员数' AS metric,
  COUNT(*) AS value
FROM distributors
UNION ALL
SELECT
  '活跃分销员数' AS metric,
  COUNT(*) AS value
FROM distributors
WHERE status = 'active'
UNION ALL
SELECT
  '总推荐人数' AS metric,
  COUNT(*) AS value
FROM referral_relationships
UNION ALL
SELECT
  '总佣金金额' AS metric,
  COALESCE(SUM(commission_amount), 0) AS value
FROM commissions
UNION ALL
SELECT
  '冻结佣金金额' AS metric,
  COALESCE(SUM(commission_amount), 0) AS value
FROM commissions
WHERE status = 'frozen'
UNION ALL
SELECT
  '可提现佣金金额' AS metric,
  COALESCE(SUM(available_commission), 0) AS value
FROM distributors
UNION ALL
SELECT
  '待审核提现金额' AS metric,
  COALESCE(SUM(amount), 0) AS value
FROM withdrawals
WHERE status = 'pending';
