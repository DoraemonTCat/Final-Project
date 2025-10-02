import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPause, faPlay, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';

const MiningProgressModal = ({ 
  currentBatch, 
  totalBatches, 
  successCount,
  failCount = 0,
  remainingTime,
  isPaused = false,
  onPause,
  onResume,
  onCancel,
  currentUsers = [] // รายชื่อคนที่กำลังขุด
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const progress = (currentBatch / totalBatches) * 100;
  const remainingMinutes = Math.floor(remainingTime / 60000);
  const remainingSeconds = Math.floor((remainingTime % 60000) / 1000);

  return (
    <div className="mining-progress-overlay">
      <div className="mining-progress-modal">
        {/* ✅ ปุ่มปิด */}
        <button 
          className="progress-close-btn"
          onClick={onCancel}
          title="ยกเลิกการขุด"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <div className="mining-progress-header">
          <h2>⛏️ กำลังขุดข้อมูล</h2>
          <p style={{ color: '#718096', margin: 0 }}>
            {isPaused ? '⏸️ หยุดชั่วคราว' : '🚀 กำลังดำเนินการ...'}
          </p>
        </div>
        
        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill" 
            style={{ 
              width: `${progress}%`,
              opacity: isPaused ? 0.6 : 1
            }}
          >
            <span id="progress-text">{Math.round(progress)}%</span>
          </div>
        </div>
        
        <div className="progress-stats">
          <div className="progress-stat">
            <div className="progress-stat-value">{currentBatch}</div>
            <div className="progress-stat-label">รอบปัจจุบัน</div>
          </div>
          <div className="progress-stat">
            <div className="progress-stat-value">{totalBatches}</div>
            <div className="progress-stat-label">ทั้งหมด</div>
          </div>
          <div className="progress-stat">
            <div className="progress-stat-value" style={{ color: '#48bb78' }}>
              {successCount}
            </div>
            <div className="progress-stat-label">สำเร็จ</div>
          </div>
          {failCount > 0 && (
            <div className="progress-stat">
              <div className="progress-stat-value" style={{ color: '#fc8181' }}>
                {failCount}
              </div>
              <div className="progress-stat-label">ล้มเหลว</div>
            </div>
          )}
        </div>
        
        {/* ✅ ปุ่มควบคุม */}
        <div className="progress-controls">
          {isPaused ? (
            <button 
              className="control-btn resume-btn"
              onClick={onResume}
            >
              <FontAwesomeIcon icon={faPlay} />
              ทำต่อ
            </button>
          ) : (
            <button 
              className="control-btn pause-btn"
              onClick={onPause}
            >
              <FontAwesomeIcon icon={faPause} />
              หยุดชั่วคราว
            </button>
          )}
          
          <button 
            className="control-btn cancel-btn"
            onClick={() => {
              if (window.confirm('คุณต้องการยกเลิกการขุดหรือไม่?\nข้อมูลที่ส่งไปแล้วจะไม่สามารถย้อนกลับได้')) {
                onCancel();
              }
            }}
          >
            <FontAwesomeIcon icon={faTimes} />
            ยกเลิก
          </button>
        </div>

        {/* ✅ แสดงเวลาที่เหลือ */}
        {remainingTime > 0 && !isPaused && (
          <div className="remaining-time-info">
            ⏱️ รอบถัดไปในอีก <strong>
              {remainingMinutes}:{remainingSeconds.toString().padStart(2, '0')}
            </strong>
          </div>
        )}

        {/* ✅ ส่วนแสดงรายละเอียด (สามารถเปิด/ปิดได้) */}
        <div className="progress-details">
          <button 
            className="details-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span>
              {isExpanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
            </span>
            <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} />
          </button>
          
          {isExpanded && (
            <div className="details-content">
              <h4>📋 ข้อมูลการขุดรอบนี้</h4>
              <div className="detail-item">
                <span className="detail-label">📊 ความคืบหน้า:</span>
                <span className="detail-value">{currentBatch} / {totalBatches} รอบ</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">✅ ส่งสำเร็จ:</span>
                <span className="detail-value">{successCount} คน</span>
              </div>
              {failCount > 0 && (
                <div className="detail-item">
                  <span className="detail-label">❌ ส่งไม่สำเร็จ:</span>
                  <span className="detail-value">{failCount} คน</span>
                </div>
              )}
              
              {currentUsers.length > 0 && (
                <div className="current-users-section">
                  <h5>👥 กำลังขุดในรอบนี้:</h5>
                  <div className="current-users-list">
                    {currentUsers.slice(0, 5).map((user, index) => (
                      <div key={index} className="user-item">
                        <span className="user-icon">👤</span>
                        <span className="user-name">{user.name || `User ${index + 1}`}</span>
                      </div>
                    ))}
                    {currentUsers.length > 5 && (
                      <div className="user-item more">
                        และอีก {currentUsers.length - 5} คน...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MiningProgressModal;