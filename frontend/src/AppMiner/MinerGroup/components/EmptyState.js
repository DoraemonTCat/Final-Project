// MinerGroup/components/EmptyState.js
import React from 'react';

/**
 * EmptyState Component
 * แสดงเมื่อไม่มีข้อมูลหรือยังไม่ได้เลือกเพจ
 */
const EmptyState = ({ selectedPage }) => {
  if (!selectedPage) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🏢</div>
        <h3>เลือกเพจเพื่อจัดการกลุ่มลูกค้า</h3>
      </div>
    );
  }

  return null;
};

export default EmptyState;