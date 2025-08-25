// MinerGroup/components/ActionBar.js
import React, { useState } from 'react';

/**
 * ActionBar Component
 * แถบดำเนินการด้านล่าง
 * - แสดงจำนวนกลุ่มที่เลือก
 * - ปุ่มดำเนินการต่อไป
 */
const ActionBar = ({ selectedCount, onProceed, disabled }) => {
  // ถ้าเลือก checkbox ให้ forceShow = true
  const forceShow = selectedCount > 0;
  const [isHovered, setIsHovered] = useState(false);

  // ถ้า forceShow หรือ hover ให้แสดง bar
  const showBar = isHovered || forceShow;

  return (
    <div
      className={`action-bar custom-fade-bar${showBar ? ' hovered' : ''}`} style={{ marginBottom: "-18px" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
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