/**
 * PAGE-P1-PS-102 ZIP批量导出API
 * 艹，这个API必须支持大文件下载、批量打包、快速响应！
 *
 * @author 老王
 */

import { NextRequest, NextResponse } from 'next/server';

// ZIP下载API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrls, filename = 'product_shoot_images.zip' } = body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      );
    }

    if (imageUrls.length > 100) {
      return NextResponse.json(
        { error: 'Too many images (max 100 per request)' },
        { status: 400 }
      );
    }

    console.log(`Creating ZIP for ${imageUrls.length} images`);

    // 在实际应用中，这里应该：
    // 1. 下载所有图片到临时目录
    // 2. 使用JSZip或类似库创建ZIP文件
    // 3. 返回ZIP文件流

    // 由于这是演示，我们返回一个模拟的ZIP文件
    const mockZipContent = createMockZipContent(imageUrls, filename);

    // 设置响应头
    const headers = new Headers({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });

    return new Response(mockZipContent, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('ZIP creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create ZIP file' },
      { status: 500 }
    );
  }
}

// 创建模拟ZIP内容（实际应用中应该使用真实的ZIP库）
function createMockZipContent(imageUrls: string[], filename: string): ArrayBuffer {
  // 这是一个简化的模拟实现
  // 实际应用中应该使用库如 jszip
  const zipHeader = new Uint8Array([
    0x50, 0x4B, 0x03, 0x04 // Local file header signature
  ]);

  const textContent = `
商品图快速通道 - 批量导出
==============================
导出时间: ${new Date().toLocaleString()}
图片数量: ${imageUrls.length}
文件名: ${filename}

图片列表:
${imageUrls.map((url, index) => `${index + 1}. ${url}`).join('\n')}

---
由 AI商拍工作室 生成
  `.trim();

  const encoder = new TextEncoder();
  const textBytes = encoder.encode(textContent);

  // 创建一个简单的模拟ZIP结构
  const buffer = new ArrayBuffer(zipHeader.length + textBytes.length);
  const view = new Uint8Array(buffer);

  view.set(zipHeader, 0);
  view.set(textBytes, zipHeader.length);

  return buffer;
}

// GET方法用于支持直接下载链接
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrls = searchParams.get('urls')?.split(',').filter(Boolean);
  const filename = searchParams.get('filename') || 'product_shoot_images.zip';

  if (!imageUrls || imageUrls.length === 0) {
    return NextResponse.json(
      { error: 'No images provided' },
      { status: 400 }
    );
  }

  return POST(request);
}