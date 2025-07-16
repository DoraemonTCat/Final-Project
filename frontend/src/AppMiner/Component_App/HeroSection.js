// components/HeroSection.js
// =====================================================
// COMPONENT: HeroSection
// PURPOSE: แสดงส่วนหัวของหน้า Dashboard
// FEATURES:
// - แสดงชื่อระบบและคำอธิบาย
// - มี animation และ gradient background
// =====================================================

import React from 'react';

const HeroSection = () => {
  return (
    <div className="dashboard-hero">
      <div className="hero-content">
        <h1 className="hero-title">
          <span className="title-icon">⛏️</span>
          ระบบขุดข้อมูลลูกค้า
        </h1>
        <p className="hero-subtitle">
          จัดการและติดตามการสนทนากับลูกค้าของคุณอย่างมีประสิทธิภาพ
        </p>
      </div>
    </div>
  );
};

export default HeroSection;