import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../CSS/GroupSchedule.css';
import { fetchPages, connectFacebook } from "../Features/Tool";

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

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  useEffect(() => {
    // โหลดกลุ่มที่เลือก
    const groups = JSON.parse(localStorage.getItem("selectedCustomerGroups") || '[]');
    const allGroups = JSON.parse(localStorage.getItem("customerGroups") || '[]');
    const selectedGroupsData = allGroups.filter(g => groups.includes(g.id));
    setSelectedGroups(selectedGroupsData);

    const savedPage = localStorage.getItem("selectedPage");
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
  }, []);

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

    const scheduleData = {
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
      messages: JSON.parse(localStorage.getItem("groupMessages") || '[]'),
      createdAt: new Date().toISOString()
    };

    // บันทึกตารางการส่ง
    const schedules = JSON.parse(localStorage.getItem("miningSchedules") || '[]');
    schedules.push(scheduleData);
    localStorage.setItem("miningSchedules", JSON.stringify(schedules));

    alert("บันทึกการตั้งเวลาสำเร็จ!");
    navigate('/App');
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

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h3 className="sidebar-title">
            📋 ตารางการขุด
          </h3>
        </div>
        
        <div className="connection-section">
          <button onClick={connectFacebook} className="connect-btn facebook-btn">
            <svg width="15" height="20" viewBox="0 0 320 512" fill="#fff" className="fb-icon">
              <path d="M279.14 288l14.22-92.66h-88.91V127.91c0-25.35 12.42-50.06 52.24-50.06H293V6.26S259.5 0 225.36 0c-73.22 0-121 44.38-121 124.72v70.62H22.89V288h81.47v224h100.2V288z" />
            </svg>
            <span>เชื่อมต่อ Facebook</span>
          </button>
        </div>

        <div className="page-selector-section">
          <label className="select-label">เลือกเพจ</label>
          <select value={selectedPage} onChange={handlePageChange} className="select-page">
            <option value="">-- เลือกเพจ --</option>
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.name}
              </option>
            ))}
          </select>
        </div>

        <nav className="sidebar-nav">
          <Link to="/App" className="nav-link">
            <span className="nav-icon">🏠</span>
            หน้าแรก
          </Link>
          <button className="dropdown-toggle" onClick={toggleDropdown}>
            <span>
              <span className="menu-icon">⚙️</span>
              ตั้งค่าระบบขุด
            </span>
            <span className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}></span>
          </button>
          <div className={`dropdown-menu ${isDropdownOpen ? 'open' : ''}`}>
            <Link to="/manage-message-sets" className="dropdown-item">▶ Default</Link>
            <Link to="/MinerGroup" className="dropdown-item">▶ ตามกลุ่ม/ลูกค้า</Link>
          </div>
          <a href="#" className="nav-link">
            <span className="nav-icon">📊</span>
            Dashboard
          </a>
          <a href="#" className="nav-link">
            <span className="nav-icon">🔧</span>
            Setting
          </a>
        </nav>
      </aside>

      <div className="schedule-container">
        <div className="schedule-header">
          <h1 className="schedule-title">
            <span className="title-icon">⏰</span>
            ตั้งเวลาและความถี่การส่ง
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
              <span className="summary-label">กลุ่มที่เลือก:</span>
              <span className="summary-value">{selectedGroups.map(g => g.name).join(', ')}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">จำนวนข้อความ:</span>
              <span className="summary-value">{JSON.parse(localStorage.getItem("groupMessages") || '[]').length} ข้อความ</span>
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