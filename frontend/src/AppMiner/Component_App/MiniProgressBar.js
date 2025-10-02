// frontend/src/AppMiner/Component_App/MiniProgressBar.js
import React, { useState, useEffect } from 'react';

const MiniProgressBar = () => {
  const [progress, setProgress] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [remainingTime, setRemainingTime] = useState(null);
  const [nextBatchTime, setNextBatchTime] = useState(null);

  useEffect(() => {
    // เช็ค progress จาก localStorage ทุกๆ 1 วินาที
    const checkProgress = () => {
      const savedProgress = localStorage.getItem('miningProgress');
      
      if (savedProgress) {
        try {
          const progressData = JSON.parse(savedProgress);
          const percentage = (progressData.currentBatch / progressData.totalBatches) * 100;
          
          // คำนวณเวลาที่เหลือ
          const now = Date.now();
          const elapsedTime = now - progressData.startTime;
          const batchesCompleted = progressData.currentBatch;
          const batchesRemaining = progressData.totalBatches - batchesCompleted;
          
          let estimatedRemainingMs = 0;
          
          if (batchesRemaining > 0) {
            // คำนวณเวลาโดยประมาณ
            // เวลาที่ใช้ไปต่อรอบ = (เวลาที่ผ่านไป) / (จำนวนรอบที่เสร็จแล้ว)
            const avgTimePerBatch = batchesCompleted > 0 
              ? elapsedTime / batchesCompleted 
              : progressData.delayMinutes * 60 * 1000;
            
            estimatedRemainingMs = avgTimePerBatch * batchesRemaining;
            
            // เพิ่มเวลา delay ระหว่างรอบ
            if (batchesRemaining > 0) {
              estimatedRemainingMs += (batchesRemaining - 1) * progressData.delayMinutes * 60 * 1000;
            }
          }
          
          // คำนวณเวลารอบถัดไป (ถ้าไม่ใช่รอบสุดท้าย)
          let nextBatch = null;
          if (batchesRemaining > 0 && progressData.lastBatchCompletedAt) {
            const timeSinceLastBatch = now - progressData.lastBatchCompletedAt;
            const delayMs = progressData.delayMinutes * 60 * 1000;
            const timeUntilNextBatch = Math.max(0, delayMs - timeSinceLastBatch);
            
            if (timeUntilNextBatch > 0) {
              nextBatch = timeUntilNextBatch;
            }
          }
          
          setProgress({
            ...progressData,
            percentage: Math.round(percentage)
          });
          setRemainingTime(estimatedRemainingMs);
          setNextBatchTime(nextBatch);
          setIsVisible(true);
        } catch (error) {
          console.error('Error parsing progress:', error);
          localStorage.removeItem('miningProgress');
          setIsVisible(false);
        }
      } else {
        setIsVisible(false);
      }
    };

    checkProgress();
    const interval = setInterval(checkProgress, 1000);

    return () => clearInterval(interval);
  }, []);

  // ฟังก์ชันแปลงเวลาเป็นรูปแบบที่อ่านง่าย
  const formatTime = (milliseconds) => {
    if (!milliseconds || milliseconds <= 0) return '0 วินาที';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const parts = [];
    if (hours > 0) parts.push(`${hours} ชั่วโมง`);
    if (minutes > 0) parts.push(`${minutes} นาที`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds} วินาที`);
    
    return parts.join(' ');
  };

  // ฟังก์ชันแปลงเวลาแบบสั้น (สำหรับ countdown)
  const formatCountdown = (milliseconds) => {
    if (!milliseconds || milliseconds <= 0) return '00:00';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  if (!isVisible || !progress) return null;

  return (
    <div className="mini-progress-container">
      <div className="mini-progress-content">
        <div className="mini-progress-header">
          <span className="mini-progress-icon">⛏️</span>
          <span className="mini-progress-text">กำลังขุด...</span>
          <span className="mini-progress-percentage">{progress.percentage}%</span>
        </div>
        
        <div className="mini-progress-bar">
          <div 
            className="mini-progress-fill"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        
        <div className="mini-progress-stats">
          <span className="mini-stat">
            📦 รอบ {progress.currentBatch}/{progress.totalBatches}
          </span>
          <span className="mini-stat">
            ✅ {progress.successCount}
          </span>
          {progress.failCount > 0 && (
            <span className="mini-stat error">
              ❌ {progress.failCount}
            </span>
          )}
        </div>
        
        {/* ✅ Countdown รอบถัดไป */}
        {nextBatchTime > 0 && progress.currentBatch < progress.totalBatches && (
          <div className="mini-progress-countdown">
            <span className="countdown-label">⏳ รอบถัดไปในอีก:</span>
            <span className="countdown-value">{formatCountdown(nextBatchTime)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MiniProgressBar;