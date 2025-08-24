// components/DateEntryFilter.js
// =====================================================
// COMPONENT: DateEntryFilter
// PURPOSE: กรองข้อมูลตามวันที่เข้ามาครั้งแรก
// FEATURES:
// - แสดงปุ่มกรองตามวันที่
// - แสดงเฉพาะวันที่ที่มีผู้ใช้เข้ามาจริง
// - แสดงจำนวนผู้ใช้ในแต่ละวัน
// =====================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';

const DateEntryFilter = ({ 
  conversations, 
  onFilterChange,
  currentFilter
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedDate, setSelectedDate] = useState(currentFilter || null);
  const dropdownRef = useRef(null);

  // คำนวณวันที่ที่มีผู้ใช้เข้ามา พร้อมจำนวนคน
  const dateGroups = useMemo(() => {
    const groups = {};
    
    conversations.forEach(conv => {
      // ใช้ first_interaction_at หรือ created_time
      const dateStr = conv.first_interaction_at || conv.created_time;
      if (!dateStr) return;
      
      const date = new Date(dateStr);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          displayDate: date.toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }),
          count: 0,
          users: []
        };
      }
      
      groups[dateKey].count++;
      groups[dateKey].users.push({
        name: conv.user_name || conv.conversation_name,
        time: date.toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit'
        })
      });
    });
    
    // แปลงเป็น array และเรียงตามวันที่ (ใหม่ไปเก่า)
    return Object.values(groups).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );
  }, [conversations]);

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDateSelect = (date) => {
    if (selectedDate === date) {
      // ถ้าเลือกวันเดิมอีกครั้ง = ยกเลิกการกรอง
      setSelectedDate(null);
      onFilterChange(null);
    } else {
      setSelectedDate(date);
      onFilterChange(date);
    }
    setShowDropdown(false);
  };

  const clearFilter = () => {
    setSelectedDate(null);
    onFilterChange(null);
    setShowDropdown(false);
  };

  // นับจำนวนวันที่มีข้อมูล
  const totalDays = dateGroups.length;
  const totalUsers = conversations.length;

  return (
    <div className="date-entry-filter" ref={dropdownRef}>
      <button
        className={`date-filter-btn ${selectedDate ? 'active' : ''}`}
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <span className="filter-icon">📅</span>
        <span className="filter-text">
          {selectedDate 
            ? dateGroups.find(g => g.date === selectedDate)?.displayDate 
            : 'วันที่เข้ามา'}
        </span>
        <span  className={`dropdown-arrow ${showDropdown ? 'open' : '' }` }></span>
      </button>

      {showDropdown && (
        <div className="date-dropdown">
          <div className="dropdown-header">
            <div className="header-stats">
              <span>📊 พบข้อมูล {totalDays} วัน</span>
              <span>👥 รวม {totalUsers} คน</span>
            </div>
            {selectedDate && (
              <button onClick={clearFilter} className="clear-btn">
                ✖ ล้างตัวกรอง
              </button>
            )}
          </div>

          <div className="date-list">
            {dateGroups.map(group => (
              <div
                key={group.date}
                className={`date-item ${selectedDate === group.date ? 'selected' : ''}`}
                onClick={() => handleDateSelect(group.date)}
              >
                <div className="date-info">
                  <div className="date-main">
                    <span className="date-text">{group.displayDate}</span>
                    <span className="user-count">{group.count} คน</span>
                  </div>
                  
                  {/* Preview ผู้ใช้ 3 คนแรก */}
                  <div className="user-preview">
                    {group.users.slice(0, 3).map((user, idx) => (
                      <span key={idx} className="preview-user">
                        {user.name} 
                      </span>
                    ))}
                    {group.count > 3 && (
                      <span className="more-users">
                        และอีก {group.count - 3} คน...
                      </span>
                    )}
                  </div>
                </div>

                <div className="date-visual">
                  {/* แถบแสดงสัดส่วน */}
                  <div 
                    className="count-bar" 
                    style={{
                      width: `${(group.count / Math.max(...dateGroups.map(g => g.count))) * 100}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {dateGroups.length === 0 && (
            <div className="empty-dates">
              <span className="empty-icon">📭</span>
              <span>ไม่พบข้อมูลวันที่</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DateEntryFilter;