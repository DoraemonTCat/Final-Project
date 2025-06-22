import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../CSS/ScheduleDashboard.css';
import Sidebar from "./Sidebar";

function ScheduleDashboard() {
  const [selectedPage, setSelectedPage] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [sentLogs, setSentLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSchedules, setActiveSchedules] = useState([]);

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

  const loadSchedules = (pageId) => {
    const key = `miningSchedules_${pageId}`;
    const savedSchedules = JSON.parse(localStorage.getItem(key) || '[]');
    setSchedules(savedSchedules);
    
    // โหลด active schedules
    const activeKey = `activeSchedules_${pageId}`;
    const activeSchedulesList = JSON.parse(localStorage.getItem(activeKey) || '[]');
    setActiveSchedules(activeSchedulesList);
  };

  const refreshStatus = async () => {
    setRefreshing(true);
    
    try {
      // .นระบบจริงจะเรียก API เพื่อดึง status
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
      if (scheduleTime > new Date()) return 'รอส่ง';
      return isActive ? 'กำลังทำงาน' : 'ส่งแล้ว';
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
    // สร้าง modal หรือหน้าใหม่สำหรับดูรายละเอียด
    const details = `
📋 รายละเอียดตารางเวลา

ประเภท: ${
      schedule.type === 'immediate' ? 'ส่งทันที' :
      schedule.type === 'scheduled' ? 'ตามเวลา' : 'User หายไป'
    }

กลุ่ม: ${schedule.groupNames?.join(', ') || 'ไม่ระบุ'}

เงื่อนไข: ${
      schedule.type === 'user-inactive' ? 
        `หายไป ${schedule.inactivityPeriod} ${schedule.inactivityUnit}` :
      schedule.type === 'scheduled' ? 
        `${schedule.date} ${schedule.time}` :
        '-'
    }

จำนวนข้อความ: ${schedule.messages?.length || 0}

ข้อความ:
${schedule.messages?.map((msg, idx) => 
  `${idx + 1}. ${msg.type === 'text' ? msg.content : `[${msg.type.toUpperCase()}] ${msg.content}`}`
).join('\n') || 'ไม่มีข้อความ'}

สถานะ: ${getScheduleStatus(schedule)}
    `;
    
    alert(details);
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
              <Link to="/MinerGroup" className="create-link">
                สร้างตารางเวลาใหม่
              </Link>
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
                      <td>
                        {schedule.type === 'user-inactive' && 
                          `${schedule.inactivityPeriod} ${schedule.inactivityUnit}`}
                        {schedule.type === 'scheduled' && 
                          `${new Date(schedule.date).toLocaleDateString('th-TH')} ${schedule.time}`}
                        {schedule.type === 'immediate' && '-'}
                      </td>
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

        <Link to="/MinerGroup" className="back-link">
          ← กลับไปหน้ากลุ่ม
        </Link>
      </div>
    </div>
  );
}

export default ScheduleDashboard;