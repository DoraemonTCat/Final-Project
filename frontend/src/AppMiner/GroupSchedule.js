import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../CSS/GroupSchedule.css';
import { fetchPages, connectFacebook } from "../Features/Tool";
import Sidebar from "./Sidebar"; 

function GroupSchedule() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [scheduleType, setScheduleType] = useState('immediate'); // immediate, scheduled
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [repeatType, setRepeatType] = useState('once'); // once, daily, weekly, monthly
  const [repeatCount, setRepeatCount] = useState(1);
  const [repeatDays, setRepeatDays] = useState([]);
  const [endDate, setEndDate] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const weekDays = [
    { id: 0, name: 'อาทิตย์', short: 'อา' },
    { id: 1, name: 'จันทร์', short: 'จ' },
    { id: 2, name: 'อังคาร', short: 'อ' },
    { id: 3, name: 'พุธ', short: 'พ' },
    { id: 4, name: 'พฤหัสบดี', short: 'พฤ' },
    { id: 5, name: 'ศุกร์', short: 'ศ' },
    { id: 6, name: 'เสาร์', short: 'ส' }
  ];

  // Listen for page changes from Sidebar
  useEffect(() => {
    const handlePageChange = (event) => {
      const pageId = event.detail.pageId;
      setSelectedPage(pageId);
    };

    window.addEventListener('pageChanged', handlePageChange);
    
    const savedPage = localStorage.getItem("selectedPage");
    if (savedPage) {
      setSelectedPage(savedPage);
    }

    return () => {
      window.removeEventListener('pageChanged', handlePageChange);
    };
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // 🔥 ฟังก์ชันดึงกลุ่มลูกค้าตาม page ID
  const getGroupsForPage = (pageId) => {
    if (!pageId) return [];
    const key = `customerGroups_${pageId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  };

  // 🔥 ฟังก์ชันบันทึกตารางการส่งตาม page ID
  const saveSchedulesForPage = (pageId, schedules) => {
    if (!pageId) return;
    const key = `miningSchedules_${pageId}`;
    localStorage.setItem(key, JSON.stringify(schedules));
  };

  // 🔥 ฟังก์ชันดึงตารางการส่งตาม page ID
  const getSchedulesForPage = (pageId) => {
    if (!pageId) return [];
    const key = `miningSchedules_${pageId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  };

  useEffect(() => {
    // 🔥 ตรวจสอบว่า page ID ตรงกันหรือไม่
    const selectedPageId = localStorage.getItem("selectedCustomerGroupsPageId");
    const savedPage = localStorage.getItem("selectedPage");
    
    if (selectedPageId && selectedPageId !== savedPage) {
      alert("กลุ่มลูกค้าที่เลือกมาจากเพจอื่น กรุณากลับไปเลือกใหม่");
      navigate('/MinerGroup');
      return;
    }

    // โหลดกลุ่มที่เลือก
    const groups = JSON.parse(localStorage.getItem("selectedCustomerGroups") || '[]');
    const allGroups = getGroupsForPage(savedPage); // 🔥 ใช้ฟังก์ชันใหม่
    const selectedGroupsData = allGroups.filter(g => groups.includes(g.id));
    setSelectedGroups(selectedGroupsData);

    if (savedPage) {
      setSelectedPage(savedPage);
    }

    fetchPages()
      .then(setPages)
      .catch(err => console.error("ไม่สามารถโหลดเพจได้:", err));

    // ตั้งค่าวันที่เริ่มต้น
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timeStr = today.toTimeString().slice(0, 5);
    setScheduleDate(dateStr);
    setScheduleTime(timeStr);
  }, [navigate]);

  const handlePageChange = (e) => {
    const pageId = e.target.value;
    setSelectedPage(pageId);
    localStorage.setItem("selectedPage", pageId);
  };

  const toggleWeekDay = (dayId) => {
    setRepeatDays(prev => {
      if (prev.includes(dayId)) {
        return prev.filter(id => id !== dayId);
      }
      return [...prev, dayId];
    });
  };

  const validateSchedule = () => {
    if (scheduleType === 'scheduled') {
      if (!scheduleDate || !scheduleTime) {
        alert("กรุณาเลือกวันที่และเวลา");
        return false;
      }

      const scheduleDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
      if (scheduleDateTime <= new Date()) {
        alert("กรุณาเลือกเวลาในอนาคต");
        return false;
      }
    }

    if (repeatType === 'weekly' && repeatDays.length === 0) {
      alert("กรุณาเลือกวันที่ต้องการส่งซ้ำ");
      return false;
    }

    if (repeatType !== 'once' && endDate) {
      const end = new Date(endDate);
      const start = new Date(scheduleDate);
      if (end <= start) {
        alert("วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น");
        return false;
      }
    }

    return true;
  };

  const saveSchedule = () => {
    if (!validateSchedule()) return;

    // 🔥 ดึงข้อความที่บันทึกไว้แยกตามเพจ
    const messageKey = `groupMessages_${selectedPage}`;
    const messages = JSON.parse(localStorage.getItem(messageKey) || '[]');

    const scheduleData = {
      id: Date.now(),
      pageId: selectedPage, // 🔥 เพิ่ม pageId
      type: scheduleType,
      date: scheduleDate,
      time: scheduleTime,
      repeat: {
        type: repeatType,
        count: repeatCount,
        days: repeatDays,
        endDate: endDate
      },
      groups: selectedGroups.map(g => g.id),
      groupNames: selectedGroups.map(g => g.name), // 🔥 เก็บชื่อกลุ่มด้วย
      messages: messages,
      createdAt: new Date().toISOString()
    };

    // 🔥 บันทึกตารางการส่งแยกตามเพจ
    const schedules = getSchedulesForPage(selectedPage);
    schedules.push(scheduleData);
    saveSchedulesForPage(selectedPage, schedules);

    // 🔥 เคลียร์ข้อมูลที่เลือกไว้
    localStorage.removeItem("selectedCustomerGroups");
    localStorage.removeItem("selectedCustomerGroupsPageId");
    localStorage.removeItem(messageKey);

    alert("บันทึกการตั้งเวลาสำเร็จ!");
    navigate('/MinerGroup'); // กลับไปยังหน้ากลุ่มลูกค้า
  };

  const getScheduleSummary = () => {
    if (scheduleType === 'immediate') return 'ส่งทันที';
    
    let summary = `ส่งวันที่ ${new Date(scheduleDate).toLocaleDateString('th-TH')} เวลา ${scheduleTime} น.`;
    
    if (repeatType !== 'once') {
      summary += '\n';
      switch (repeatType) {
        case 'daily':
          summary += `ทำซ้ำทุกวัน`;
          break;
        case 'weekly':
          summary += `ทำซ้ำทุกสัปดาห์ วัน${repeatDays.map(d => weekDays.find(w => w.id === d)?.short).join(', ')}`;
          break;
        case 'monthly':
          summary += `ทำซ้ำทุกเดือน`;
          break;
      }
      
      if (endDate) {
        summary += ` จนถึง ${new Date(endDate).toLocaleDateString('th-TH')}`;
      }
    }
    
    return summary;
  };

  const selectedPageInfo = pages.find(p => p.id === selectedPage);

  return (
    <div className="app-container">
       <Sidebar />

      <div className="schedule-container">
        <div className="schedule-header">
          <h1 className="schedule-title">
            <span className="title-icon">⏰</span>
            ตั้งเวลาและความถี่การส่ง
            {selectedPageInfo && (
              <span style={{ fontSize: '18px', color: '#718096', marginLeft: '10px' }}>
                - {selectedPageInfo.name}
              </span>
            )}
          </h1>
          <div className="breadcrumb">
            <span className="breadcrumb-item">1. เลือกกลุ่ม</span>
            <span className="breadcrumb-separator">›</span>
            <span className="breadcrumb-item">2. ตั้งค่าข้อความ</span>
            <span className="breadcrumb-separator">›</span>
            <span className="breadcrumb-item active">3. ตั้งเวลา</span>
          </div>
        </div>

        <div className="schedule-summary">
          <h3>สรุปการตั้งค่า:</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">เพจ:</span>
              <span className="summary-value">{selectedPageInfo?.name || '-'}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">กลุ่มที่เลือก:</span>
              <span className="summary-value">{selectedGroups.map(g => g.name).join(', ')}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">จำนวนข้อความ:</span>
              <span className="summary-value">{JSON.parse(localStorage.getItem(`groupMessages_${selectedPage}`) || '[]').length} ข้อความ</span>
            </div>
          </div>
        </div>

        <div className="schedule-form">
          <div className="form-section">
            <h3 className="section-title">🕐 เวลาที่ต้องการส่ง</h3>
            
            <div className="schedule-type-selector">
              <label className="radio-option">
                <input
                  type="radio"
                  name="scheduleType"
                  value="immediate"
                  checked={scheduleType === 'immediate'}
                  onChange={(e) => setScheduleType(e.target.value)}
                />
                <span className="radio-label">
                  <span className="radio-icon">⚡</span>
                  ส่งทันที
                </span>
              </label>
              
              <label className="radio-option">
                <input
                  type="radio"
                  name="scheduleType"
                  value="scheduled"
                  checked={scheduleType === 'scheduled'}
                  onChange={(e) => setScheduleType(e.target.value)}
                />
                <span className="radio-label">
                  <span className="radio-icon">📅</span>
                  กำหนดเวลา
                </span>
              </label>
            </div>

            {scheduleType === 'scheduled' && (
              <div className="datetime-inputs">
                <div className="form-group">
                  <label className="form-label">วันที่:</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">เวลา:</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="form-section">
            <h3 className="section-title">🔄 ความถี่ในการส่ง</h3>
            
            <div className="repeat-type-selector">
              <label className="radio-option">
                <input
                  type="radio"
                  name="repeatType"
                  value="once"
                  checked={repeatType === 'once'}
                  onChange={(e) => setRepeatType(e.target.value)}
                />
                <span className="radio-label">ครั้งเดียว</span>
              </label>
              
              <label className="radio-option">
                <input
                  type="radio"
                  name="repeatType"
                  value="daily"
                  checked={repeatType === 'daily'}
                  onChange={(e) => setRepeatType(e.target.value)}
                />
                <span className="radio-label">ทุกวัน</span>
              </label>
              
              <label className="radio-option">
                <input
                  type="radio"
                  name="repeatType"
                  value="weekly"
                  checked={repeatType === 'weekly'}
                  onChange={(e) => setRepeatType(e.target.value)}
                />
                <span className="radio-label">ทุกสัปดาห์</span>
              </label>
              
              <label className="radio-option">
                <input
                  type="radio"
                  name="repeatType"
                  value="monthly"
                  checked={repeatType === 'monthly'}
                  onChange={(e) => setRepeatType(e.target.value)}
                />
                <span className="radio-label">ทุกเดือน</span>
              </label>
            </div>

            {repeatType === 'weekly' && (
              <div className="weekdays-selector">
                <label className="form-label">เลือกวันที่ต้องการส่ง:</label>
                <div className="weekdays-grid">
                  {weekDays.map(day => (
                    <button
                      key={day.id}
                      type="button"
                      className={`weekday-btn ${repeatDays.includes(day.id) ? 'active' : ''}`}
                      onClick={() => toggleWeekDay(day.id)}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {repeatType !== 'once' && (
              <div className="repeat-options">
                <div className="form-group">
                  <label className="form-label">สิ้นสุดวันที่ (ไม่บังคับ):</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={scheduleDate || new Date().toISOString().split('T')[0]}
                    className="form-input"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="schedule-preview">
            <h3 className="preview-title">📋 สรุปการตั้งเวลา</h3>
            <div className="preview-content">
              {getScheduleSummary()}
            </div>
          </div>

          <div className="action-buttons">
            <Link to="/GroupDefault" className="back-btn">
              ← กลับ
            </Link>
            <button
              onClick={saveSchedule}
              className="save-schedule-btn"
            >
              <span className="btn-icon">💾</span>
              บันทึกการตั้งค่า
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GroupSchedule;