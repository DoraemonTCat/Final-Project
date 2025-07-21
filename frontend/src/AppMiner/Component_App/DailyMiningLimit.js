// components/DailyMiningLimit.js
// =====================================================
// COMPONENT: DailyMiningLimit
// PURPOSE: แสดงและจัดการขีดจำกัดการขุดประจำวัน
// FEATURES:
// - แสดงจำนวนที่ขุดไปแล้ววันนี้
// - แสดงขีดจำกัดประจำวัน
// - สามารถปรับขีดจำกัดได้
// - แสดง progress bar
// - มี compact mode สำหรับแสดงแบบเล็ก
// =====================================================

import React, { useState } from 'react';

const DailyMiningLimit = ({ currentCount, dailyLimit, onLimitChange, compact = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempLimit, setTempLimit] = useState(dailyLimit);
  
  const percentage = Math.min((currentCount / dailyLimit) * 100, 100);
  const remaining = Math.max(0, dailyLimit - currentCount);
  const isLimitReached = currentCount >= dailyLimit;
  
  const handleSave = () => {
    const newLimit = parseInt(tempLimit);
    if (newLimit > 0 && newLimit <= 10000) {
      onLimitChange(newLimit);
      setIsEditing(false);
    } else {
      alert('กรุณาระบุจำนวนระหว่าง 1-10,000');
    }
  };
  
  const handleCancel = () => {
    setTempLimit(dailyLimit);
    setIsEditing(false);
  };
  
  const getProgressColor = () => {
    if (percentage >= 90) return '#e53e3e'; // red
    if (percentage >= 70) return '#ed8936'; // orange
    if (percentage >= 50) return '#ecc94b'; // yellow
    return '#48bb78'; // green
  };

  // Compact Version for Popup
  if (compact) {
    return (
      <div className="mining-limit-compact">
        <div className="limit-row">
          <span className="limit-label">⛏️ ขีดจำกัดการขุดวันนี้</span>
          <div className="limit-right">
            <div className="limit-numbers">
              <span className="current-count" style={{ color: getProgressColor() }}>
                {currentCount}
              </span>
              <span className="divider">/</span>
              <span className="daily-limit">{dailyLimit}</span>
            </div>
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="edit-btn-compact">
                ตั้งค่า
              </button>
            ) : (
              <div className="edit-controls-compact">
                <input
                  type="number"
                  value={tempLimit}
                  onChange={(e) => setTempLimit(e.target.value)}
                  min="1"
                  max="10000"
                  className="limit-input-compact"
                />
                <button onClick={handleSave} className="save-btn-compact">✓</button>
                <button onClick={handleCancel} className="cancel-btn-compact">✕</button>
              </div>
            )}
          </div>
        </div>
        <div className="mini-progress">
          <div 
            className="mini-progress-fill"
            style={{ 
              width: `${percentage}%`,
              backgroundColor: getProgressColor()
            }}
          />
        </div>
        {isLimitReached && (
          <div className="limit-warning-compact">
            <span>⚠️ ถึงขีดจำกัดแล้ว</span>
          </div>
        )}
      </div>
    );
  }

  // Full Version
  return (
    <div className="daily-mining-limit-section">
      <div className="limit-container">
        <div className="limit-header">
          <div className="limit-title">
            <span className="limit-icon">⛏️</span>
            <span>ขีดจำกัดการขุดประจำวัน</span>
          </div>
          
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="edit-btn">
              ตั้งค่า
            </button>
          ) : (
            <div className="edit-controls">
              <input
                type="number"
                value={tempLimit}
                onChange={(e) => setTempLimit(e.target.value)}
                min="1"
                max="10000"
                className="limit-input"
              />
              <button onClick={handleSave} className="save-btn">✓</button>
              <button onClick={handleCancel} className="cancel-btn">✕</button>
            </div>
          )}
        </div>
        
        <div className="limit-content">
          <div className="limit-stats">
            <div className="stat-group">
              <span className="stat-label">ขุดไปแล้ว</span>
              <span className="stat-value" style={{ color: getProgressColor() }}>
                {currentCount}
              </span>
            </div>
            <span className="stat-separator">/</span>
            <div className="stat-group">
              <span className="stat-label">ขีดจำกัด</span>
              <span className="stat-value">{dailyLimit}</span>
            </div>
            <div className="stat-group">
              <span className="stat-label">คงเหลือ</span>
              <span className="stat-value" style={{ 
                color: isLimitReached ? '#e53e3e' : '#48bb78' 
              }}>
                {remaining}
              </span>
            </div>
          </div>
          
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ 
                  width: `${percentage}%`,
                  backgroundColor: getProgressColor()
                }}
              />
            </div>
            <span className="progress-percentage">{percentage.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyMiningLimit;