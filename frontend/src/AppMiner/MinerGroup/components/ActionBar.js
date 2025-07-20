// MinerGroup/components/ActionBar.js
import React from 'react';

/**
 * ActionBar Component
 * แถบดำเนินการด้านล่าง
 * - แสดงจำนวนกลุ่มที่เลือก
 * - ปุ่มดำเนินการต่อไป
 */
const ActionBar = ({ selectedCount, onProceed, disabled }) => {
  return (
    <div className="action-bar">
      <div className="selection-info">
        <span className="selection-icon">✓</span>
        เลือกแล้ว {selectedCount} กลุ่ม
      </div>
      <button
        onClick={onProceed}
        className="proceed-btn"
        disabled={disabled}
      >
        ถัดไป: ตั้งค่าข้อความ
        <span className="arrow-icon">→</span>
      </button>
    </div>
  );
};

export default ActionBar;