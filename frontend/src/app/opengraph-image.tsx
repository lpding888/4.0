/**
 * 简易OpenGraph静态图片
 * 避免Windows下@vercel/og依赖报错
 */

export const alt = 'AI衣柜 - 专业的服装图片AI处理服务';
export const size = {
  width: 1200,
  height: 630
};
export const contentType = 'image/svg+xml';

const backgroundGradient = `
  <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#667eea" />
    <stop offset="100%" stop-color="#764ba2" />
  </linearGradient>
`;

export default function Image() {
  const svg = `
    <svg width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>${backgroundGradient}</defs>
      <rect width="100%" height="100%" fill="url(#bg)" rx="32" />
      <g fill="white" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" text-anchor="middle">
        <text x="50%" y="45%" font-size="96" font-weight="bold">AI衣柜</text>
        <text x="50%" y="60%" font-size="48" opacity="0.9">专业的服装图片AI处理服务</text>
        <text x="50%" y="75%" font-size="32" opacity="0.8">AI修图 · AI模特 · Lookbook · 短视频</text>
      </g>
    </svg>
  `;

  return new Response(svg.trim(), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}
