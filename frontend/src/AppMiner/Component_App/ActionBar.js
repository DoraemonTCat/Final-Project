// components/ActionBar.js
// =====================================================
// COMPONENT: ActionBar
// PURPOSE: แสดงปุ่มดำเนินการต่างๆ
// FEATURES:
// - ปุ่มขุดข้อมูล
// - ปุ่มรีเฟรช
// - แสดงจำนวนที่เลือก
// =====================================================

import React from 'react';

const ActionBar = ({ 
  selectedCount, 
  totalCount, 
  loading, 
  selectedPage,
  onOpenPopup, 
  onRefresh 
}) => {
  return (
    <div className="action-bar">
      <div className="action-left">
        <button
          onClick={onOpenPopup}
          className={`action-btn primary ${selectedCount > 0 ? 'active' : ''}`} 
          style={{paddingRight:"30%" }}
          disabled={loading || selectedCount === 0}
        >
          <span className="btn-icon">⛏️</span>
          <span>ขุด</span>
        </button>

        <button 
          onClick={onRefresh} 
          className="action-btn secondary"  
          style={{paddingRight:"30%"}}
          disabled={loading || !selectedPage}
        >
          <span className={`btn-icon ${loading ? 'spinning' : ''}`} >🔄</span>
          <span>{loading ? "กำลังโหลด..." : "รีเฟรช"}</span>
        </button>
      </div>

      <div className="action-right">
        <div className="selection-summary">
          <span className="summary-icon">📊</span>
          <span>เลือกแล้ว {selectedCount} จาก {totalCount} รายการ</span>
        </div>
      </div>
    </div>
  );
};

export default ActionBar;