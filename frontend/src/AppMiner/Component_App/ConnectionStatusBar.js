// components/ConnectionStatusBar.js
// =====================================================
// COMPONENT: ConnectionStatusBar
// PURPOSE: แสดงสถานะการเชื่อมต่อและเวลาอัพเดท
// FEATURES:
// - แสดงสถานะการเชื่อมต่อเพจ
// - แสดงเวลาอัพเดทล่าสุด
// - มีปุ่ม Sync ข้อมูล
// - แสดงเวลาปัจจุบัน
// - Date Entry Filter (NEW)
// =====================================================

import React from 'react';
import SyncCustomersButton from '../Component_App/SyncCustomersButton';
import DateFilterBadge from '../Component_App/DateFilterBadge';
import DateEntryFilter from '../Component_App/DateEntryFilter'; // เพิ่ม import

const ConnectionStatusBar = ({ 
  selectedPage, 
  selectedPageInfo, 
  lastUpdateTime, 
  currentTime,
  onSyncComplete,
  syncDateRange,
  onClearDateFilter,
  conversations,
  onDateEntryFilterChange,
  currentDateEntryFilter,
  isBackgroundLoading // เพิ่ม prop ใหม่
}) => {
  const getUpdateStatus = () => {
    const diffMs = currentTime - lastUpdateTime;
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return { status: "อัพเดทล่าสุด", color: "success" };
    if (diffMin < 5) return { status: `${diffMin} นาทีที่แล้ว`, color: "warning" };
    return { status: `${diffMin} นาทีที่แล้ว`, color: "danger" };
  };

  const updateStatus = getUpdateStatus();

  return (
    <div className="connection-status-bar">
      <div className="status-left">
        <div className={`connection-badge ${selectedPage ? 'connected' : 'disconnected'}`}>
          <span className="status-icon">{selectedPage ? '🟢' : '🔴'}</span>
          <span className="status-text">
            {selectedPage ? `เชื่อมต่อแล้ว: ${selectedPageInfo?.name}` : 'ยังไม่ได้เชื่อมต่อ'}
          </span>
        </div>
       
        {selectedPage && (
          <SyncCustomersButton 
            selectedPage={selectedPage}
            onSyncComplete={onSyncComplete}
          />
        )}
        
        {/* Date Entry Filter - เพิ่มตรงนี้ */}
        {selectedPage && conversations && (
          <DateEntryFilter
            conversations={conversations}
            onFilterChange={onDateEntryFilterChange}
            currentFilter={currentDateEntryFilter}
          />
        )}

        {/* เพิ่ม indicator สำหรับ background loading */}
        {isBackgroundLoading && (
          <div className="background-loading-indicator">
            <span className="pulse-dot"></span>
            <span style={{ fontSize: '0.75rem', color: '#4299e1' }}>
              กำลังซิงค์...
            </span>
          </div>
        )}
      </div>
      
      <div className="status-right">
        <span className="clock-display">
          🕐 {currentTime.toLocaleTimeString('th-TH')}
        </span>
      </div>
    </div>
  );
};

export default ConnectionStatusBar;