/**
 * 动态生成OpenGraph图片
 * 用于社交媒体分享卡片
 */

import { ImageResponse } from 'next/og';

// 图片元数据
export const alt = 'AI衣柜 - 专业的服装图片AI处理服务';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 80, fontWeight: 'bold', marginBottom: 20 }}>
            🎨 AI衣柜
          </div>
          <div style={{ fontSize: 40, opacity: 0.9 }}>
            专业的服装图片AI处理服务
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 40,
              gap: 30,
              fontSize: 28,
              opacity: 0.8,
            }}
          >
            <span>✨ AI修图</span>
            <span>👗 AI模特</span>
            <span>📸 Lookbook</span>
            <span>🎬 短视频</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
