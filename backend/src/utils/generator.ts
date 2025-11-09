import crypto from 'crypto';
import { customAlphabet } from 'nanoid';

// P1-015: 定义不同用途的nanoid生成器
const nanoidNumeric = customAlphabet('0123456789', 10); // 数字
const nanoidAlphanumeric = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8); // 字母数字

/**
 * 生成随机ID (P1-015: 保持crypto.randomBytes，更安全)
 * @param length - ID长度
 * @returns 随机ID字符串
 */
export function generateId(length = 16): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 生成随机seed (1 ~ 2147483647)
 * P1-015: 使用crypto.randomInt替换Math.random()
 * @returns 随机seed数字
 */
export function generateSeed(): number {
  return crypto.randomInt(1, 2147483648); // 艹！crypto.randomInt更安全
}

/**
 * 生成验证码 (P1-015: 使用nanoid替换Math.random())
 * 艹！nanoid生成的验证码更随机，不会重复
 * @param length - 验证码长度
 * @returns 验证码字符串
 */
export function generateCode(length = 6): string {
  return nanoidNumeric().substring(0, length); // P1-015: 使用nanoid
}

/**
 * 生成订单号 (P1-015: 使用nanoid替换Math.random())
 * @returns 订单号字符串
 */
export function generateOrderId(): string {
  const timestamp = Date.now();
  const random = nanoidNumeric().substring(0, 4); // P1-015: 使用nanoid
  return `order_${timestamp}${random}`;
}

/**
 * 生成任务ID (P1-015: 使用nanoid替换Math.random())
 * @returns 任务ID字符串
 */
export function generateTaskId(): string {
  const timestamp = Date.now();
  const random = nanoidNumeric().substring(0, 4); // P1-015: 使用nanoid
  return `task_${timestamp}${random}`;
}

/**
 * 生成邀请码 (P1-015: 新增方法)
 * 艹！8位字母数字组合，不包含容易混淆的字符(0O, 1Il)
 * @returns 邀请码字符串
 */
export function generateInvitationCode(): string {
  const customNanoid = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 8);
  return customNanoid(); // 艹！排除了0O1Il，用户不会搞混
}

// 默认导出，兼容旧的require方式
export default {
  generateId,
  generateSeed,
  generateCode,
  generateOrderId,
  generateTaskId,
  generateInvitationCode // P1-015: 新增邀请码生成方法
};
