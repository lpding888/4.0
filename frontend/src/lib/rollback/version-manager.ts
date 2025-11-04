/**
 * 版本管理工具
 * 艹!管理前端应用版本,支持快速回滚!
 *
 * @author 老王
 */

/**
 * 版本信息
 */
export interface VersionInfo {
  version: string; // 版本号 (如: "1.2.3")
  build: string; // 构建号
  commitHash: string; // Git commit hash
  commitMessage: string; // Git commit message
  buildTime: string; // 构建时间 ISO 8601
  author?: string; // 构建者
  branch: string; // Git分支
  environment: 'production' | 'staging' | 'development'; // 环境
  features?: string[]; // 启用的功能特性
  dependencies?: Record<string, string>; // 关键依赖版本
}

/**
 * 回滚点
 */
export interface RollbackPoint {
  id: string;
  version: VersionInfo;
  description: string; // 回滚点描述
  created_at: string; // 创建时间
  created_by: string; // 创建者
  snapshot: {
    configs: Record<string, any>; // 配置快照
    templates?: Record<string, any>; // 模板快照
    styles?: Record<string, any>; // 样式快照
  };
  status: 'active' | 'archived'; // 状态
}

/**
 * 回滚历史
 */
export interface RollbackHistory {
  id: string;
  from_version: string; // 源版本
  to_version: string; // 目标版本
  rollback_type: 'full' | 'config' | 'template' | 'style'; // 回滚类型
  performed_at: string; // 执行时间
  performed_by: string; // 执行者
  reason: string; // 回滚原因
  success: boolean; // 是否成功
  duration_ms: number; // 耗时(毫秒)
  details?: string; // 详细信息
}

/**
 * 当前运行时版本信息
 * 在构建时注入,由CI/CD流程生成
 */
export const CURRENT_VERSION: VersionInfo = {
  version: process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',
  build: process.env.NEXT_PUBLIC_BUILD_NUMBER || 'dev',
  commitHash: process.env.NEXT_PUBLIC_COMMIT_HASH || 'unknown',
  commitMessage: process.env.NEXT_PUBLIC_COMMIT_MESSAGE || 'Development build',
  buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
  branch: process.env.NEXT_PUBLIC_GIT_BRANCH || 'main',
  environment: (process.env.NEXT_PUBLIC_APP_ENV as any) || 'development',
};

/**
 * 版本比较
 * @returns 1: v1 > v2, 0: v1 = v2, -1: v1 < v2
 */
export function compareVersion(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

/**
 * 获取版本信息
 */
export function getVersionInfo(): VersionInfo {
  return CURRENT_VERSION;
}

/**
 * 格式化版本信息
 */
export function formatVersionInfo(version: VersionInfo): string {
  return `${version.version} (${version.build}) - ${version.environment}`;
}

/**
 * 检查是否可以回滚
 */
export function canRollback(currentVersion: string, targetVersion: string): {
  allowed: boolean;
  reason?: string;
} {
  // 不能回滚到相同版本
  if (currentVersion === targetVersion) {
    return {
      allowed: false,
      reason: '不能回滚到相同版本',
    };
  }

  // 版本号格式检查
  const versionRegex = /^\d+\.\d+\.\d+$/;
  if (!versionRegex.test(currentVersion) || !versionRegex.test(targetVersion)) {
    return {
      allowed: false,
      reason: '版本号格式不正确',
    };
  }

  // 允许回滚
  return { allowed: true };
}

/**
 * 生成回滚计划
 */
export function generateRollbackPlan(
  fromVersion: string,
  toVersion: string,
  type: RollbackHistory['rollback_type']
): {
  steps: string[];
  estimatedTime: number; // 预计耗时(秒)
  risks: string[];
} {
  const steps: string[] = [];
  const risks: string[] = [];
  let estimatedTime = 0;

  switch (type) {
    case 'full':
      steps.push('1. 备份当前配置');
      steps.push('2. 停止前端服务');
      steps.push('3. 切换到目标版本');
      steps.push('4. 恢复配置快照');
      steps.push('5. 重启前端服务');
      steps.push('6. 健康检查');
      estimatedTime = 300; // 5分钟
      risks.push('服务会有短暂的停机时间（~2分钟）');
      risks.push('回滚后需要用户刷新页面');
      break;

    case 'config':
      steps.push('1. 备份当前配置');
      steps.push('2. 恢复目标版本配置');
      steps.push('3. 验证配置');
      steps.push('4. 刷新配置缓存');
      estimatedTime = 60; // 1分钟
      risks.push('配置变更可能影响正在使用的用户');
      break;

    case 'template':
      steps.push('1. 备份当前模板');
      steps.push('2. 恢复目标版本模板');
      steps.push('3. 清理模板缓存');
      steps.push('4. 验证模板');
      estimatedTime = 120; // 2分钟
      risks.push('用户可能看到短暂的旧模板');
      break;

    case 'style':
      steps.push('1. 备份当前样式');
      steps.push('2. 恢复目标版本样式');
      steps.push('3. 清理CDN缓存');
      steps.push('4. 验证样式加载');
      estimatedTime = 90; // 1.5分钟
      risks.push('用户可能需要硬刷新才能看到新样式');
      break;
  }

  return { steps, estimatedTime, risks };
}

/**
 * 验证回滚点完整性
 */
export function validateRollbackPoint(point: RollbackPoint): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 检查版本信息
  if (!point.version || !point.version.version) {
    errors.push('缺少版本信息');
  }

  // 检查快照
  if (!point.snapshot) {
    errors.push('缺少快照数据');
  }

  // 检查创建时间
  if (!point.created_at) {
    errors.push('缺少创建时间');
  }

  // 检查描述
  if (!point.description || point.description.trim() === '') {
    errors.push('缺少回滚点描述');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 计算回滚预计影响
 */
export function estimateRollbackImpact(
  currentVersion: string,
  targetVersion: string
): {
  impactLevel: 'low' | 'medium' | 'high';
  affectedFeatures: string[];
  warnings: string[];
} {
  const comparison = compareVersion(currentVersion, targetVersion);
  const affectedFeatures: string[] = [];
  const warnings: string[] = [];
  let impactLevel: 'low' | 'medium' | 'high' = 'low';

  // 主版本回滚 (1.x.x -> 0.x.x)
  if (Math.abs(parseInt(currentVersion.split('.')[0]) - parseInt(targetVersion.split('.')[0])) > 0) {
    impactLevel = 'high';
    warnings.push('跨主版本回滚,可能存在重大功能变更');
    warnings.push('建议先在测试环境验证');
  }
  // 次版本回滚 (x.2.x -> x.1.x)
  else if (Math.abs(parseInt(currentVersion.split('.')[1]) - parseInt(targetVersion.split('.')[1])) > 0) {
    impactLevel = 'medium';
    warnings.push('次版本回滚,可能影响部分功能');
  }
  // 补丁版本回滚 (x.x.3 -> x.x.2)
  else {
    impactLevel = 'low';
  }

  // 根据版本差异推测受影响功能
  if (comparison > 0) {
    affectedFeatures.push('可能丢失当前版本的新功能');
    affectedFeatures.push('可能丢失当前版本的bug修复');
  }

  return {
    impactLevel,
    affectedFeatures,
    warnings,
  };
}
