'use client';

/**
 * SocialProof - 行业影响力 / 社会证明区域
 * 展示客户信任度和用户评价
 */
export default function SocialProof() {
  return (
    <section style={{ padding: '100px 24px', textAlign: 'center', background: '#FFF' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#86868B', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '40px' }}>
          TRUSTED BY 500+ INDUSTRY LEADERS
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '60px', opacity: 0.4, filter: 'grayscale(100%)' }}>
          {/* 模拟 Logo */}
          <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'Arial' }}>NIKE</div>
          <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'Times New Roman' }}>ZARA</div>
          <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'Helvetica' }}>SHEIN</div>
          <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'Impact' }}>UNIQLO</div>
        </div>

        <div style={{ marginTop: '80px', padding: '40px', background: '#F5F5F7', borderRadius: '24px' }}>
          <p style={{ fontSize: '24px', fontWeight: 500, fontStyle: 'italic', color: '#1D1D1F', marginBottom: '24px' }}>
            &ldquo;AI.FASHION 彻底改变了我们的上新流程。它不是一个工具，而是我们最核心的生产力部门。&rdquo;
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', background: '#DDD', borderRadius: '50%' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600 }}>Sarah Chen</div>
              <div style={{ fontSize: '12px', color: '#86868B' }}>某跨境电商独角兽 运营总监</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
