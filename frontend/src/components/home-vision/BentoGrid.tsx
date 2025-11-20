'use client';

import {
  CameraOutlined,
  SkinOutlined,
  ScissorOutlined,
  GlobalOutlined,
  SafetyCertificateFilled,
  RocketFilled,
  ArrowRightOutlined
} from '@ant-design/icons';

/**
 * BentoGrid - Bento Grid 功能展示区
 * 展示核心功能模块和数据亮点
 */
export default function BentoGrid() {
  return (
    <section style={{
      padding: '120px 24px',
      background: '#F5F5F7'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '80px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-1px', marginBottom: '16px' }}>
            不仅仅是工具，<br />更是您的顶级创意团队。
          </h2>
          <p style={{ fontSize: '20px', color: '#86868B' }}>
            全天候待命，无需沟通成本，输出即是行业标准。
          </p>
        </div>

        {/* Grid 布局 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gridTemplateRows: 'repeat(2, minmax(320px, auto))',
          gap: '24px'
        }}>

          {/* 卡片 1: AI 首席摄影师 (大) */}
          <div className="bento-card bento-card-dark" style={{ gridColumn: 'span 8', gridRow: 'span 2' }}>
            {/* 背景图 */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'url(/images/photographer.png) center/cover',
              opacity: 0.7,
              transition: 'transform 0.7s ease'
            }} className="card-bg" />
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 100%)',
              zIndex: 1
            }} />

            <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                  <CameraOutlined style={{ fontSize: '24px', color: '#FFF' }} />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', letterSpacing: '1px' }}>CORE MODULE</span>
                </div>
                <h3 style={{ fontSize: '40px', fontWeight: 700, marginBottom: '16px' }}>AI 首席摄影师</h3>
                <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.9)', maxWidth: '480px', lineHeight: '1.6' }}>
                  无需租赁影棚，无需预约模特。上传平铺图，即刻生成媲美《VOGUE》大片的商业摄影作品。支持全球 50+ 种地域面孔，完美适配跨境电商。
                </p>
              </div>
              <div style={{ marginTop: '40px' }}>
                <button className="btn-vision" style={{ background: '#FFF', color: '#000' }}>
                  开始创作 <ArrowRightOutlined />
                </button>
              </div>
            </div>
          </div>

          {/* 卡片 2: AI 搭配总监 (中) */}
          <div className="bento-card" style={{ gridColumn: 'span 4', gridRow: 'span 1' }}>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <SkinOutlined style={{ fontSize: '32px', color: '#0071E3', marginBottom: '24px' }} />
              <h3 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px' }}>AI 搭配总监</h3>
              <p style={{ color: '#86868B', lineHeight: '1.6', fontSize: '14px' }}>
                洞察全球流行趋势，一键生成爆款搭配。让单品不再孤单，提升连带率。
              </p>
            </div>
            {/* 底部配图 */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              left: 0,
              height: '120px',
              background: 'url(/images/stylist.png) center/cover',
              maskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
              opacity: 0.8
            }} />
          </div>

          {/* 卡片 3: AI 视觉工程师 (中) */}
          <div className="bento-card" style={{ gridColumn: 'span 4', gridRow: 'span 1' }}>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <ScissorOutlined style={{ fontSize: '32px', color: '#FF9500', marginBottom: '24px' }} />
              <h3 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px' }}>AI 视觉工程师</h3>
              <p style={{ color: '#86868B', lineHeight: '1.6', fontSize: '14px' }}>
                像素级精修，自动处理复杂边缘与透明材质。还原面料真实质感，拒绝&ldquo;塑料感&rdquo;。
              </p>
            </div>
            {/* 底部配图 */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              left: 0,
              height: '120px',
              background: 'url(/images/engineer.png) center/cover',
              maskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
              opacity: 0.8
            }} />
          </div>

        </div>

        {/* 第二行 Grid (数据与安全) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px',
          marginTop: '24px'
        }}>
          <div className="bento-card">
            <GlobalOutlined style={{ fontSize: '32px', marginBottom: '24px', color: '#1D1D1F' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>全球网络</h3>
            <p style={{ color: '#86868B', fontSize: '14px' }}>CDN 节点覆盖全球，创意即刻送达。</p>
          </div>
          <div className="bento-card">
            <SafetyCertificateFilled style={{ fontSize: '32px', marginBottom: '24px', color: '#34C759' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>企业级安全</h3>
            <p style={{ color: '#86868B', fontSize: '14px' }}>银行级数据加密，保障设计资产安全。</p>
          </div>
          <div className="bento-card">
            <RocketFilled style={{ fontSize: '32px', marginBottom: '24px', color: '#5856D6' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>10倍效率</h3>
            <p style={{ color: '#86868B', fontSize: '14px' }}>从 3 天缩短至 3 分钟，上新快人一步。</p>
          </div>
        </div>

      </div>
    </section>
  );
}
