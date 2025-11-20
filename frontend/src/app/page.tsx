'use client';

import { useEffect, useState } from 'react';
import Navbar from '@/components/home-vision/Navbar';
import HeroSection from '@/components/home-vision/HeroSection';
import BentoGrid from '@/components/home-vision/BentoGrid';
import SocialProof from '@/components/home-vision/SocialProof';
import CTASection from '@/components/home-vision/CTASection';

/**
 * HomePage - 首页 (Visionary Tech - Chinese Unicorn Edition)
 * 风格：Apple / OpenAI / Linear
 * 核心概念：未来时尚基础设施 + 顶级专业团队
 *
 * 架构：模块化组件设计，保持代码简洁与可维护性
 */
export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      <Navbar />
      <HeroSection />
      <BentoGrid />
      <SocialProof />
      <CTASection />
    </div>
  );
}
