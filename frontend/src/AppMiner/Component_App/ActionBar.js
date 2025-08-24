// components/ActionBar.js
// =====================================================
// COMPONENT: ActionBar
// PURPOSE: แสดงปุ่มดำเนินการต่างๆ
// FEATURES:
// - ปุ่มขุดข้อมูล
// - ปุ่มรีเฟรช
// - แสดงจำนวนที่เลือก
// - แสดงจำนวนการขุดที่เหลือ
// =====================================================

import React from 'react';

const ActionBar = ({ 
  selectedCount, 
  totalCount, 
  loading, 
  selectedPage,
  onOpenPopup, 
  onRefresh,
  canMineMore,
  remainingMines
}) => {
  // เพิ่ม debug log
  console.log("ActionBar props:", {
    loading,
    selectedPage,
    hasOnRefresh: !!onRefresh
  });

  return (
    <div className="action-bar">
      <div className="action-left">
        {/* ปุ่มขุด */}
        <button
          onClick={onOpenPopup}
          className={`action-btn primary ${selectedCount > 0 ? 'active' : ''}`} 
          style={{paddingRight:"95%", paddingLeft:"50%" }}
          disabled={loading || selectedCount === 0}
        >
          <span className="btn-icon">⛏️</span>
          <span>ขุด</span><span>{selectedCount}</span>
        </button>

        {/* ปุ่มรีเฟรช - เพิ่ม error handling */}
        <button 
          onClick={() => {
            console.log("🔄 Refresh button clicked!");
            if (typeof onRefresh === 'function') {
              onRefresh();
            } else {
              console.error("❌ onRefresh is not a function:", onRefresh);
            }
          }}
          className="action-btn secondary"  
          style={{paddingRight:"95%", paddingLeft:"50%"}}
          disabled={loading || !selectedPage}
          title={!selectedPage ? "กรุณาเลือกเพจก่อน" : "คลิกเพื่อรีเฟรชข้อมูล"}
        >
          <span className={`btn-icon ${loading ? 'spinning' : ''}`}>🔄</span>
          <span>{loading ? "กำลังโหลด..." : "รีเฟรช"}</span>
        </button>
      </div>

      <div className="action-right">
        {remainingMines !== undefined && (
          <div className="remaining-mines">
            <span className="remaining-icon">💎</span>
            <span>ขุดเหลือ {remainingMines} ครั้ง</span>
            {!canMineMore && (
              <div className="limit-reached-badge">
                <span className="badge-icon">🚫</span>
                <span>ถึงขีดจำกัดแล้ว</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActionBar;