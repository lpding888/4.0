'use client';

import { useRouter } from 'next/navigation';

/**
 * CTASection - 底部行动号召区域
 * 引导用户注册或开始使用
 */
export default function CTASection() {
  const router = useRouter();

  return (
    <section style={{ padding: '120px 24px', background: '#000', color: '#FFF', textAlign: 'center' }}>
      <h2 style={{ fontSize: '48px', fontWeight: 700, marginBottom: '24px' }}>
        准备好引领行业变革了吗？
      </h2>
      <p style={{ fontSize: '20px', color: '#86868B', marginBottom: '48px' }}>
        加入数千家先锋企业的行列，开启智能时尚时代。
      </p>
      <button
        className="btn-vision"
        style={{ background: '#FFF', color: '#000', padding: '20px 60px', fontSize: '20px' }}
        onClick={() => router.push('/login')}
      >
        立即开始
      </button>
    </section>
  );
}
