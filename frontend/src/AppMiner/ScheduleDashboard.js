import React, { useState, useEffect } from 'react';
import '../CSS/ScheduleDashboard.css';
import Sidebar from "./Sidebar";

function ScheduleDashboard() {
  const [selectedPage, setSelectedPage] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [sentLogs, setSentLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSchedules, setActiveSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    const savedPage = localStorage.getItem("selectedPage");
    if (savedPage) {
      setSelectedPage(savedPage);
      loadSchedules(savedPage);
    }
  }, []);

  // Listen for page changes from Sidebar
  useEffect(() => {
    const handlePageChange = (event) => {
      const pageId = event.detail.pageId;
      setSelectedPage(pageId);
      loadSchedules(pageId);
    };

    window.addEventListener('pageChanged', handlePageChange);
    
    return () => {
      window.removeEventListener('pageChanged', handlePageChange);
    };
  }, []);

  // ...existing code...

const loadSchedules = (pageId) => {
  const key = `miningSchedules_${pageId}`;
  const savedSchedules = JSON.parse(localStorage.getItem(key) || '[]');

  // ดึงกลุ่มทั้งหมดของเพจนี้
  const groupKey = `customerGroups_${pageId}`;
  const groups = JSON.parse(localStorage.getItem(groupKey) || '[]');
  const groupIds = groups.map(g => g.id);

  // filter schedule ที่กลุ่มยังอยู่
  const filteredSchedules = savedSchedules.filter(sch =>
    sch.groups.some(gid => groupIds.includes(gid))
  );
  setSchedules(filteredSchedules);

  // โหลด active schedules
  const activeKey = `activeSchedules_${pageId}`;
  const activeSchedulesList = JSON.parse(localStorage.getItem(activeKey) || '[]');
  setActiveSchedules(activeSchedulesList);
};

// ...existing code...

  const refreshStatus = async () => {
    setRefreshing(true);
    
    try {
      // ในระบบจริงจะเรียก API เพื่อดึง status
      // ตอนนี้ simulate delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reload schedules
      loadSchedules(selectedPage);
      
      alert("รีเฟรชสถานะสำเร็จ!");
    } catch (error) {
      console.error('Error refreshing status:', error);
      alert("เกิดข้อผิดพลาดในการรีเฟรช");
    } finally {
      setRefreshing(false);
    }
  };

  const getScheduleStatus = (schedule) => {
  // ตรวจสอบว่า schedule นี้ active อยู่หรือไม่
  const isActive = activeSchedules.some(id => id === schedule.id);

  if (schedule.type === 'immediate') return 'ส่งแล้ว';
  if (schedule.type === 'user-inactive') return isActive ? 'กำลังทำงาน' : 'หยุดชั่วคราว';
  if (schedule.type === 'scheduled') {
    const scheduleTime = new Date(`${schedule.date}T${schedule.time}`);
    if (scheduleTime > new Date()) return isActive ? 'กำลังทำงาน' : 'หยุดชั่วคราว'; // เปลี่ยนตรงนี้
    return 'ส่งแล้ว';
  }
  return 'ไม่ทราบสถานะ';
};

  const getStatusColor = (status) => {
    switch (status) {
      case 'ส่งแล้ว': return '#48bb78';
      case 'กำลังทำงาน': return '#4299e1';
      case 'รอส่ง': return '#ed8936';
      case 'หยุดชั่วคราว': return '#e53e3e';
      default: return '#718096';
    }
  };

  // เพิ่มในไฟล์ ScheduleDashboard.js ฟังก์ชัน toggleScheduleStatus

const toggleScheduleStatus = async (schedule) => {
  const status = getScheduleStatus(schedule);
  
  try {
    if (status === 'กำลังทำงาน') {
      // หยุดการทำงาน
      const response = await fetch('http://localhost:8000/schedule/deactivate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          page_id: selectedPage,
          schedule_id: schedule.id
        })
      });

      if (!response.ok) throw new Error('Failed to deactivate');
      
      // อัพเดท active schedules
      const newActiveSchedules = activeSchedules.filter(id => id !== schedule.id);
      setActiveSchedules(newActiveSchedules);
      localStorage.setItem(`activeSchedules_${selectedPage}`, JSON.stringify(newActiveSchedules));
      
      alert("หยุดการทำงานสำเร็จ!");
    } else {
      // เปิดใช้งาน
      const response = await fetch('http://localhost:8000/schedule/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          page_id: selectedPage,
          schedule: schedule
        })
      });

      if (!response.ok) throw new Error('Failed to activate');
      
      // อัพเดท active schedules
      const newActiveSchedules = [...activeSchedules, schedule.id];
      setActiveSchedules(newActiveSchedules);
      localStorage.setItem(`activeSchedules_${selectedPage}`, JSON.stringify(newActiveSchedules));
      
      alert("เปิดใช้งานสำเร็จ!");
    }
    
    // Reload schedules
    loadSchedules(selectedPage);
    
  } catch (error) {
    console.error('Error toggling schedule:', error);
    alert("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
  }
};

  const viewScheduleDetails = (schedule) => {
    setSelectedSchedule(schedule);
    setShowDetailModal(true);
  };

  const getScheduleDescription = (schedule) => {
    if (schedule.type === 'immediate') return 'ส่งทันที';
    if (schedule.type === 'scheduled') return `${new Date(schedule.date).toLocaleDateString('th-TH')} ${schedule.time}`;
    if (schedule.type === 'user-inactive') {
      return `${schedule.inactivityPeriod} ${
        
        schedule.inactivityUnit === 'minutes' ? 'นาที' :
        schedule.inactivityUnit === 'hours' ? 'ชั่วโมง' :
        schedule.inactivityUnit === 'days' ? 'วัน' :
        schedule.inactivityUnit === 'weeks' ? 'สัปดาห์' : 'เดือน'
      }`;
    }
    return '-';
  };

  const goToMinerGroup = () => {
    window.location.href = '/MinerGroup';
  };

  const goBack = () => {
    window.location.href = '/MinerGroup';
  };

  return (
    <div className="app-container">
      <Sidebar />

      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1 className="dashboard-title">
            <span className="title-icon">📊</span>
            Dashboard การส่งข้อความ
          </h1>
          <button 
            onClick={refreshStatus}
            disabled={refreshing}
            className="refresh-btn"
          >
            {refreshing ? '⏳ กำลังรีเฟรช...' : '🔄 รีเฟรชสถานะ'}
          </button>
        </div>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-info">
              <div className="stat-value">{schedules.length}</div>
              <div className="stat-label">ตารางเวลาทั้งหมด</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <div className="stat-value">
                {schedules.filter(s => getScheduleStatus(s) === 'ส่งแล้ว').length}
              </div>
              <div className="stat-label">ส่งแล้ว</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-info">
              <div className="stat-value">
                {schedules.filter(s => getScheduleStatus(s) === 'กำลังทำงาน').length}
              </div>
              <div className="stat-label">กำลังทำงาน</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">⏸️</div>
            <div className="stat-info">
              <div className="stat-value">
                {schedules.filter(s => getScheduleStatus(s) === 'หยุดชั่วคราว').length}
              </div>
              <div className="stat-label">หยุดชั่วคราว</div>
            </div>
          </div>
        </div>

        <div className="schedules-table">
          <h2>รายการตารางเวลา</h2>
          {schedules.length === 0 ? (
            <div className="empty-table">
              <p>ยังไม่มีตารางเวลาสำหรับเพจนี้</p>
              <button onClick={goToMinerGroup} className="create-link">
                สร้างตารางเวลาใหม่
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ชื่อกลุ่ม</th>
                  <th>ประเภท</th>
                  <th>เงื่อนไข</th>
                  <th>จำนวนข้อความ</th>
                  <th>สถานะ</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule, index) => {
                  const status = getScheduleStatus(schedule);
                  return (
                    <tr key={schedule.id}>
                      <td>{schedule.groupNames?.join(', ') || 'ไม่ระบุ'}</td>
                      <td>
                        {schedule.type === 'immediate' && '⚡ ส่งทันที'}
                        {schedule.type === 'scheduled' && '📅 ตามเวลา'}
                        {schedule.type === 'user-inactive' && '🕰️ User หาย'}
                      </td>
                      <td>{getScheduleDescription(schedule)}</td>
                      <td>{schedule.messages?.length || 0}</td>
                      <td>
                        <span 
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(status) }}
                        >
                          {status}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="action-btn view-btn"
                          onClick={() => viewScheduleDetails(schedule)}
                        >
                          👁️ ดู
                        </button>
                        {status !== 'ส่งแล้ว' && (
                          <button 
                            className="action-btn toggle-btn"
                            onClick={() => toggleScheduleStatus(schedule)}
                          >
                            {status === 'กำลังทำงาน' ? '⏸️ หยุด' : '▶️ เริ่ม'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <button onClick={goBack} className="back-link">
          ← กลับไปหน้ากลุ่ม
        </button>
      </div>

      {/* Modal แสดงรายละเอียด */}
      {showDetailModal && selectedSchedule && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 รายละเอียดตารางเวลา</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>✖</button>
            </div>
            
            <div className="modal-body">
              <div className="detail-section">
                <h4>ข้อมูลทั่วไป</h4>
                <p><strong>ประเภท:</strong> {
                  selectedSchedule.type === 'immediate' ? 'ส่งทันที' :
                  selectedSchedule.type === 'scheduled' ? 'ตามเวลา' : 'User หายไป'
                }</p>
                <p><strong>กลุ่ม:</strong> {selectedSchedule.groupNames?.join(', ') || 'ไม่ระบุ'}</p>
                <p><strong>เงื่อนไข:</strong> {getScheduleDescription(selectedSchedule)}</p>
                {selectedSchedule.repeat && selectedSchedule.repeat.type !== 'once' && (
                  <p><strong>ทำซ้ำ:</strong> {
                    selectedSchedule.repeat.type === 'daily' ? 'ทุกวัน' :
                    selectedSchedule.repeat.type === 'weekly' ? 'ทุกสัปดาห์' : 'ทุกเดือน'
                  }</p>
                )}
              </div>

              <div className="detail-section">
                <h4>ข้อความ ({selectedSchedule.messages?.length || 0})</h4>
                <div className="messages-list">
                  {selectedSchedule.messages?.map((msg, idx) => (
                    <div key={idx} className="message-item">
                      <span className="message-number">{idx + 1}.</span>
                      <span className="message-type">
                        {msg.type === 'text' ? '💬' : msg.type === 'image' ? '🖼️' : '📹'}
                      </span>
                      <span className="message-content">
                        {msg.type === 'text' ? msg.content : `[${msg.type.toUpperCase()}] ${msg.content}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detail-section">
                <h4>สถานะ</h4>
                <p><strong>สถานะปัจจุบัน:</strong> {getScheduleStatus(selectedSchedule)}</p>
                <p><strong>สร้างเมื่อ:</strong> {new Date(selectedSchedule.createdAt).toLocaleString('th-TH')}</p>
                {selectedSchedule.updatedAt && (
                  <p><strong>แก้ไขล่าสุด:</strong> {new Date(selectedSchedule.updatedAt).toLocaleString('th-TH')}</p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-btn" onClick={() => setShowDetailModal(false)}>ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScheduleDashboard;