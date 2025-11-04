/**
 * 发票PDF生成工具
 * 艹！这个工具用于生成电子发票PDF文件！
 *
 * @author 老王
 */

import type { Order } from '@/app/account/billing/page';

/**
 * 发票信息
 */
export interface InvoiceData {
  order: Order;
  company_name: string; // 公司名称
  tax_id: string; // 税号
  address?: string; // 地址
  phone?: string; // 电话
  bank_name?: string; // 开户银行
  bank_account?: string; // 银行账号
}

/**
 * 生成发票PDF（前端实现，仅用于演示）
 *
 * 艹！真实场景应该由后端生成PDF，这里只是Mock实现！
 *
 * @param invoiceData 发票数据
 * @returns PDF Blob
 */
export async function generateInvoicePDF(invoiceData: InvoiceData): Promise<Blob> {
  const { order, company_name, tax_id, address, phone, bank_name, bank_account } = invoiceData;

  // 创建Canvas元素
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法创建Canvas上下文');
  }

  // 背景色
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 标题
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('电子发票', canvas.width / 2, 60);

  // 发票编号
  ctx.font = '14px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`发票编号: ${order.order_id}`, 50, 120);

  // 分割线
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, 140);
  ctx.lineTo(canvas.width - 50, 140);
  ctx.stroke();

  // 购买方信息
  ctx.font = 'bold 16px Arial';
  ctx.fillText('购买方信息', 50, 180);

  ctx.font = '14px Arial';
  ctx.fillText(`公司名称: ${company_name}`, 50, 210);
  ctx.fillText(`税号: ${tax_id}`, 50, 240);
  if (address) ctx.fillText(`地址: ${address}`, 50, 270);
  if (phone) ctx.fillText(`电话: ${phone}`, 50, 300);
  if (bank_name) ctx.fillText(`开户银行: ${bank_name}`, 50, 330);
  if (bank_account) ctx.fillText(`银行账号: ${bank_account}`, 50, 360);

  // 分割线
  ctx.beginPath();
  ctx.moveTo(50, 390);
  ctx.lineTo(canvas.width - 50, 390);
  ctx.stroke();

  // 订单信息
  ctx.font = 'bold 16px Arial';
  ctx.fillText('订单信息', 50, 430);

  ctx.font = '14px Arial';
  ctx.fillText(`套餐名称: ${order.plan_name}`, 50, 460);
  ctx.fillText(`订单金额: ¥${order.amount.toFixed(2)}`, 50, 490);
  ctx.fillText(`创建时间: ${new Date(order.created_at).toLocaleString('zh-CN')}`, 50, 520);
  if (order.paid_at) {
    ctx.fillText(`支付时间: ${new Date(order.paid_at).toLocaleString('zh-CN')}`, 50, 550);
  }
  if (order.payment_method) {
    ctx.fillText(`支付方式: ${order.payment_method}`, 50, 580);
  }

  // 分割线
  ctx.beginPath();
  ctx.moveTo(50, 610);
  ctx.lineTo(canvas.width - 50, 610);
  ctx.stroke();

  // 金额总计
  ctx.font = 'bold 20px Arial';
  ctx.fillText(`总计金额: ¥${order.amount.toFixed(2)}`, 50, 660);

  // 分割线
  ctx.beginPath();
  ctx.moveTo(50, 690);
  ctx.lineTo(canvas.width - 50, 690);
  ctx.stroke();

  // 备注
  ctx.font = '12px Arial';
  ctx.fillStyle = '#666666';
  ctx.fillText('本发票为电子发票，与纸质发票具有同等法律效力', 50, 730);
  ctx.fillText(`开票日期: ${new Date().toLocaleDateString('zh-CN')}`, 50, 760);

  // 页脚
  ctx.textAlign = 'center';
  ctx.fillText('AI衣柜科技有限公司', canvas.width / 2, 850);
  ctx.fillText('联系电话: 400-XXX-XXXX', canvas.width / 2, 880);
  ctx.fillText('官方网站: www.ai-wardrobe.com', canvas.width / 2, 910);

  // 将Canvas转换为Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('生成PDF失败'));
      }
    }, 'image/png');
  });
}

/**
 * 下载发票PDF
 *
 * @param invoiceData 发票数据
 * @param filename 文件名
 */
export async function downloadInvoicePDF(
  invoiceData: InvoiceData,
  filename?: string
): Promise<void> {
  try {
    const blob = await generateInvoicePDF(invoiceData);

    // 创建下载链接
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `发票_${invoiceData.order.order_id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[发票生成] 下载发票失败:', error);
    throw error;
  }
}
