import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../CSS/GroupSchedule.css';
import { 
  fetchPages, 
  getCustomerGroups,
  getGroupMessages,
  createSchedule,
  updateSchedule
} from "../Features/Tool";
import Sidebar from "./Sidebar"; 

function GroupSchedule() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [scheduleType, setScheduleType] = useState('immediate');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [inactivityPeriod, setInactivityPeriod] = useState('1');
  const [inactivityUnit, setInactivityUnit] = useState('days');
  const [repeatType, setRepeatType] = useState('once');
  const [repeatCount, setRepeatCount] = useState(1);
  const [repeatDays, setRepeatDays] = useState([]);
  const [endDate, setEndDate] = useState('');
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const pagesData = await fetchPages();
        setPages(pagesData);

        const savedPage = localStorage.getItem("selectedPage");
        if (savedPage) {
          setSelectedPage(savedPage);
          
          // โหลดกลุ่มที่เลือก
          const selectedGroupIds = JSON.parse(localStorage.getItem("selectedCustomerGroups") || '[]');
          
          // ดึงข้อมูลกลุ่มจาก database
          const pagesResponse = await fetch('http://localhost:8000/pages/');
          const pagesData = await pagesResponse.json();
          const currentPage = pagesData.find(p => p.page_id === savedPage);
          
          if (currentPage) {
            const groupsData = await getCustomerGroups(currentPage.ID);
            const selectedGroupsData = groupsData.filter(g => selectedGroupIds.includes(g.id));
            setSelectedGroups(selectedGroupsData);
          }
        }

        // ตรวจสอบว่าเป็นการแก้ไขหรือไม่
        const editingId = localStorage.getItem("editingScheduleId");
        if (editingId) {
          setEditingScheduleId(editingId);
          // TODO: โหลดข้อมูล schedule จาก database
        }

        // ตั้งค่า default
        const today = new Date();
        setScheduleDate(today.toISOString().split('T')[0]);
        setScheduleTime(today.toTimeString().slice(0, 5));

      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };

    loadInitialData();
  }, []);

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

    if (scheduleType === 'user-inactive') {
      if (!inactivityPeriod || inactivityPeriod < 1) {
        alert("กรุณากำหนดระยะเวลาที่หายไป");
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

  const saveSchedule = async () => {
    if (!validateSchedule()) return;

    setLoading(true);
    try {
      // ดึงข้อความของแต่ละกลุ่มจาก database
      const allMessages = [];
      const selectedGroupIds = selectedGroups.map(g => g.id);
      
      for (const group of selectedGroups) {
        const messages = await getGroupMessages(group.id);
        allMessages.push(...messages);
      }

      // เตรียมข้อมูลสำหรับบันทึก
      const scheduleData = {
        type: scheduleType,
        date: scheduleDate,
        time: scheduleTime,
        inactivityPeriod: scheduleType === 'user-inactive' ? inactivityPeriod : null,
        inactivityUnit: scheduleType === 'user-inactive' ? inactivityUnit : null,
        repeat: {
          type: repeatType,
          count: repeatCount,
          days: repeatDays,
          endDate: endDate
        },
        groups: selectedGroupIds,
        messages: allMessages
      };

      if (editingScheduleId) {
        // แก้ไข schedule ที่มีอยู่
        await updateSchedule(editingScheduleId, scheduleData);
        alert("แก้ไขการตั้งเวลาสำเร็จ!");
      } else {
        // สร้าง schedule ใหม่
        await createSchedule(scheduleData);
        alert("บันทึกการตั้งเวลาสำเร็จ!");
      }

      // เคลียร์ข้อมูลที่เลือกไว้
      localStorage.removeItem("selectedCustomerGroups");
      localStorage.removeItem("selectedCustomerGroupsPageId");
      localStorage.removeItem("editingScheduleId");

      navigate('/MinerGroup');

    } catch (error) {
      console.error('Error saving schedule:', error);
      alert("เกิดข้อผิดพลาดในการบันทึก: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleWeekDay = (dayId) => {
    setRepeatDays(prev => {
      if (prev.includes(dayId)) {
        return prev.filter(id => id !== dayId);
      }
      return [...prev, dayId];
    });
  };

  const getScheduleSummary = () => {
    if (scheduleType === 'immediate') return 'ส่งทันที';
    
    if (scheduleType === 'user-inactive') {
      let summary = `ส่งเมื่อ User หายไปเกิน ${inactivityPeriod} ${
        inactivityUnit === 'minutes' ? 'นาที' :
        inactivityUnit === 'hours' ? 'ชั่วโมง' :
        inactivityUnit === 'days' ? 'วัน' :
        inactivityUnit === 'weeks' ? 'สัปดาห์' : 'เดือน'
      }`;
      
      if (repeatType !== 'once') {
        summary += '\n';
        switch (repeatType) {
          case 'daily':
            summary += `ตรวจสอบและส่งซ้ำทุกวัน`;
            break;
          case 'weekly':
            summary += `ตรวจสอบและส่งซ้ำทุกสัปดาห์ วัน${repeatDays.map(d => weekDays.find(w => w.id === d)?.short).join(', ')}`;
            break;
          case 'monthly':
            summary += `ตรวจสอบและส่งซ้ำทุกเดือน`;
            break;
        }
        
        if (endDate) {
          summary += ` จนถึง ${new Date(endDate).toLocaleDateString('th-TH')}`;
        }
      }
      
      return summary;
    }
    
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
            {editingScheduleId ? 'แก้ไขการตั้งเวลา' : 'ตั้งเวลาและความถี่การส่ง'}
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
              <span className="summary-value">
                {selectedGroups.map(g => g.type_name).join(', ') || '-'}
              </span>
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

              <label className="radio-option">
                <input
                  type="radio"
                  name="scheduleType"
                  value="user-inactive"
                 checked={scheduleType === 'user-inactive'}
                 onChange={(e) => setScheduleType(e.target.value)}
               />
               <span className="radio-label">
                 <span className="radio-icon">🕰️</span>
                 ตามระยะเวลาที่หาย
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

           {scheduleType === 'user-inactive' && (
             <div className="inactivity-settings">
               <label className="form-label">ส่งข้อความเมื่อ User หายไปเกิน:</label>
               <div className="inactivity-inputs">
                 <input
                   type="number"
                   value={inactivityPeriod}
                   onChange={(e) => setInactivityPeriod(e.target.value)}
                   min="1"
                   className="form-input inactivity-number"
                 />
                 <select
                   value={inactivityUnit}
                   onChange={(e) => setInactivityUnit(e.target.value)}
                   className="form-input inactivity-select"
                 >
                   <option value="minutes">นาที</option>
                   <option value="hours">ชั่วโมง</option>
                   <option value="days">วัน</option>
                   <option value="weeks">สัปดาห์</option>
                   <option value="months">เดือน</option>
                 </select>
               </div>
               <p className="inactivity-hint">
                 💡 ระบบจะตรวจสอบทุกๆ ชั่วโมง และส่งข้อความไปยัง User ที่ไม่มีการตอบกลับตามระยะเวลาที่กำหนด
               </p>
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
             disabled={loading}
           >
             {loading ? (
               <>
                 <span className="btn-icon">⏳</span>
                 กำลังบันทึก...
               </>
             ) : (
               <>
                 <span className="btn-icon">💾</span>
                 {editingScheduleId ? 'บันทึกการแก้ไข' : 'บันทึกการตั้งค่า'}
               </>
             )}
           </button>
         </div>
       </div>
     </div>
   </div>
 );
}

export default GroupSchedule;