'use client';

import { useRouter } from 'next/navigation';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';

/**
 * HeroSection - Hero 区域组件
 * 包含主标题、副标题、CTA按钮和全球算力网络视觉演示
 */
export default function HeroSection() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  return (
    <section style={{
      padding: '180px 24px 120px',
      maxWidth: '1200px',
      margin: '0 auto',
      textAlign: 'center'
    }}>
      <div className="animate-fade-up">
        <div style={{
          display: 'inline-block',
          padding: '6px 16px',
          background: '#F5F5F7',
          borderRadius: '99px',
          color: '#0071E3',
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '24px'
        }}>
          全新 4.0 版本发布
        </div>
        <h1 className="hero-title" style={{ marginBottom: '24px' }}>
          重塑电商视觉流，<br />
          定义未来时尚标准。
        </h1>
        <p className="hero-subtitle" style={{ maxWidth: '640px', margin: '0 auto 48px' }}>
          您的 AI 首席设计团队已就位。从拍摄到修图,全流程智能化。<br />
          基于百亿级时尚图库训练，懂面料，更懂光影。
        </p>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button
            className="btn-vision"
            onClick={() => router.push(user ? '/workspace' : '/login')}
            style={{ padding: '20px 48px', fontSize: '18px' }}
          >
            立即体验 <ArrowRightOutlined />
          </button>
        </div>
      </div>

      {/* 视觉演示 (Visual Demo) - 全球算力网络 */}
      <div className="animate-fade-up delay-200" style={{
        marginTop: '100px',
        borderRadius: '32px',
        overflow: 'hidden',
        boxShadow: '0 40px 80px rgba(0,0,0,0.12)',
        position: 'relative',
        background: '#000',
        aspectRatio: '21/9',
        color: '#FFF'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'url(/images/global_network.png) center/cover',
          opacity: 0.8
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, #000 0%, transparent 100%)'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '40px',
          left: '40px',
          textAlign: 'left'
        }}>
          <div style={{ fontSize: '14px', color: '#86868B', marginBottom: '8px', letterSpacing: '1px' }}>INFRASTRUCTURE</div>
          <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>全球算力网络</div>
          <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)' }}>12 个数据中心 · 千卡集群 · 毫秒级响应</div>
        </div>
      </div>
    </section>
  );
}
