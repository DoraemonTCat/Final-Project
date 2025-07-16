// components/CustomerInfoBadge.js
// =====================================================
// COMPONENT: CustomerInfoBadge
// PURPOSE: แสดงข้อมูลเพิ่มเติมของลูกค้า
// FEATURES:
// - แสดงเวลาที่เข้ามาครั้งแรก
// - แสดงที่มาของลูกค้า (new/imported)
// - คำนวณระยะเวลาแบบ human-readable
// =====================================================

import React from 'react';

const CustomerInfoBadge = ({ customer }) => {
  const getTimeDiff = (dateStr) => {
    if (!dateStr) return 'ไม่ทราบ';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffDays > 0) return `${diffDays} วัน`;
    if (diffHours > 0) return `${diffHours} ชั่วโมง`;
    if (diffMinutes > 0) return `${diffMinutes} นาที`;
    return 'เมื่อสักครู่';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      fontSize: '11px',
      color: '#718096',
      marginTop: '4px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>🕐</span>
        <span>ครั้งแรก: {getTimeDiff(customer.first_interaction_at)} ที่แล้ว</span>
      </div>
      {customer.source_type && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>📍</span>
          <span>ที่มา: {customer.source_type === 'new' ? 'User ใหม่' : 'Import'}</span>
        </div>
      )}
    </div>
  );
};

export default CustomerInfoBadge;