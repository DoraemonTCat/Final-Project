// components/TimeAgoCell.js
// =====================================================
// COMPONENT: TimeAgoCell
// PURPOSE: แสดงเวลาที่ผู้ใช้หายไปแบบ real-time
// FEATURES:
// - อัพเดทเวลาอัตโนมัติตาม interval ที่เหมาะสม
// - แสดง pulse animation สำหรับข้อความใหม่
// - คำนวณและส่งข้อมูล inactivity กลับไป parent
// =====================================================

import React, { useState, useEffect, useRef } from 'react';

const TimeAgoCell = React.memo(({ lastMessageTime, updatedTime, userId, onInactivityChange }) => {
  const [displayTime, setDisplayTime] = useState('');
  const [inactivityMinutes, setInactivityMinutes] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    const updateTime = () => {
      const referenceTime = lastMessageTime || updatedTime;
      if (!referenceTime) {
        setDisplayTime('-');
        setInactivityMinutes(0);
        return;
      }

      const past = new Date(referenceTime);
      const now = new Date();
      const diffMs = now.getTime() - past.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);

      setInactivityMinutes(diffMin > 0 ? diffMin : 0);

      if (onInactivityChange && userId) {
        onInactivityChange(userId, diffMin > 0 ? diffMin : 0);
      }

      // Format display time
      if (diffSec < 0) {
        setDisplayTime('ทักมาใหม่');
      } else if (diffSec < 60) {
        setDisplayTime(`${diffSec} วินาทีที่แล้ว`);
      } else {
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) {
          setDisplayTime(`${diffMin} นาทีที่แล้ว`);
        } else {
          const diffHr = Math.floor(diffMin / 60);
          if (diffHr < 24) {
            setDisplayTime(`${diffHr} ชั่วโมงที่แล้ว`);
          } else {
            const diffDay = Math.floor(diffHr / 24);
            if (diffDay < 7) {
              setDisplayTime(`${diffDay} วันที่แล้ว`);
            } else {
              const diffWeek = Math.floor(diffDay / 7);
              if (diffWeek < 4) {
                setDisplayTime(`${diffWeek} สัปดาห์ที่แล้ว`);
              } else {
                const diffMonth = Math.floor(diffDay / 30);
                if (diffMonth < 12) {
                  setDisplayTime(`${diffMonth} เดือนที่แล้ว`);
                } else {
                  const diffYear = Math.floor(diffDay / 365);
                  setDisplayTime(`${diffYear} ปีที่แล้ว`);
                }
              }
            }
          }
        }
      }
    };

    // Clear previous interval
    if (intervalRef.current) clearInterval(intervalRef.current);

    updateTime();

    // Calculate optimal interval
    const referenceTime = lastMessageTime || updatedTime;
    if (!referenceTime) return;

    const past = new Date(referenceTime);
    const now = new Date();
    const diffMs = now.getTime() - past.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    let intervalMs;
    if (diffMin < 1) {
      intervalMs = 1000; // Update every second
    } else if (diffMin < 60) {
      intervalMs = 60000; // Update every minute
    } else {
      intervalMs = 3600000; // Update every hour
    }

    intervalRef.current = setInterval(updateTime, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [lastMessageTime, updatedTime, userId, onInactivityChange]);

  const isRecent = lastMessageTime && 
    new Date(lastMessageTime) > new Date(Date.now() - 60000);

  return (
    <td className={`table-cell  ${isRecent ? 'recent-message' : '' } ` }>
      <div className="time-display" style={{paddingLeft:"17px"}} >
        {isRecent && <span className="pulse-dot" ></span>}
        {displayTime}
        <span className="inactivity-minutes" style={{ display: 'none' }}>
          {inactivityMinutes}
        </span>
      </div>
    </td>
  );
});

export default TimeAgoCell;