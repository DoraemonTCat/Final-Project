import React, { useState, useEffect } from 'react';
import '../CSS/ScheduleDashboard.css';
import Sidebar from "./Sidebar";
import { getPageSchedules, deleteSchedule } from "../Features/Tool";

function ScheduleDashboard() {
  const [selectedPage, setSelectedPage] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [activeSchedules, setActiveSchedules] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedPage = localStorage.getItem("selectedPage");
    if (savedPage) {
      setSelectedPage(savedPage);
      loadSchedules(savedPage);
      loadActiveSchedules(savedPage);
    }
  }, []);

  const loadActiveSchedules = async (pageId) => {
    try {
      const response = await fetch(`http://localhost:8000/active-schedules/${pageId}`);
      if (!response.ok) throw new Error('Failed to load active schedules');
      const data = await response.json();
      const activeIds = data.active_schedules.map(s => s.id);
      setActiveSchedules(activeIds);
    } catch (error) {
      console.error('Error loading active schedules:', error);
    }
  };

  const loadSchedules = async (pageId) => {
    setLoading(true);
    try {
      const data = await getPageSchedules(pageId);
      setSchedules(data.schedules || []);
    } catch (error) {
      console.error('Error loading schedules:', error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    setRefreshing(true);
    try {
      await loadSchedules(selectedPage);
      await loadActiveSchedules(selectedPage);
      alert("รีเฟรชสถานะสำเร็จ!");
    } catch (error) {
      console.error('Error refreshing status:', error);
      alert("เกิดข้อผิดพลาดในการรีเฟรช");
    } finally {
      setRefreshing(false);
    }
  };

  const getScheduleStatus = (schedule) => {
    const isActive = activeSchedules.includes(schedule.id);

    if (schedule.type === 'immediate') return 'ส่งข้อความแล้ว';
    if (schedule.type === 'user-inactive') return isActive ? 'กำลังทำงาน' : 'หยุดชั่วคราว';
    if (schedule.type === 'scheduled') {
      if (schedule.scheduled_at) {
        const scheduleTime = new Date(schedule.scheduled_at);
        if (scheduleTime > new Date()) return isActive ? 'กำลังทำงาน' : 'หยุดชั่วคราว';
      }
      return 'ส่งข้อความแล้ว';
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
        alert("หยุดการทำงานสำเร็จ!");
      } else {
        const response = await fetch('http://localhost:8000/schedule/activate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            page_id: selectedPage,
            schedule: {
              ...schedule,
              pageId: selectedPage
            }
          })
        });

        if (!response.ok) throw new Error('Failed to activate');
        alert("เปิดใช้งานสำเร็จ!");
      }

      await loadActiveSchedules(selectedPage);

    } catch (error) {
      console.error('Error toggling schedule:', error);
      alert("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm("คุณต้องการลบตารางเวลานี้หรือไม่?")) {
      return;
    }

    try {
      await deleteSchedule(scheduleId);
      alert("ลบตารางเวลาสำเร็จ!");
      await loadSchedules(selectedPage);
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert("เกิดข้อผิดพลาดในการลบตารางเวลา");
    }
  };

  const viewScheduleDetails = (schedule) => {
    setSelectedSchedule(schedule);
    setShowDetailModal(true);
  };

  const getScheduleDescription = (schedule) => {
    if (schedule.type === 'immediate') return 'ส่งทันที';
    if (schedule.type === 'scheduled' && schedule.scheduled_at) {
      const date = new Date(schedule.scheduled_at);
      return `${date.toLocaleDateString('th-TH')} ${date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (schedule.type === 'user-inactive' && schedule.send_after_inactive) {
      // แปลง timedelta string เป็นข้อความ
      const match = schedule.send_after_inactive.match(/(\d+)\s*(day|hour|minute)/);
      if (match) {
        const value = match[1];
        const unit = match[2];
        const unitThai = {
          'day': 'วัน',
          'hour': 'ชั่วโมง',
          'minute': 'นาที'
        };
        return `${value} ${unitThai[unit] || unit}`;
      }
      return schedule.send_after_inactive;
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
          {loading ? (
            <div className="loading-state">
              <p>กำลังโหลดข้อมูล...</p>
            </div>
          ) : schedules.length === 0 ? (
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
                {schedules.map((schedule) => {
                  const status = getScheduleStatus(schedule);
                  
                  return (
                    <tr key={schedule.id}>
                      <td>
                        <div className="group-names-cell">
                          {schedule.group_name || 'ไม่ระบุ'}
                        </div>
                      </td>
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
                        <button 
                          className="action-btn delete-btn"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                        >
                          🗑️ ลบ
                        </button>
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
                <p><strong>กลุ่ม:</strong> {selectedSchedule.group_name || 'ไม่ระบุ'}</p>
                <p><strong>เงื่อนไข:</strong> {getScheduleDescription(selectedSchedule)}</p>
                {selectedSchedule.frequency && selectedSchedule.frequency !== 'once' && (
                  <p><strong>ทำซ้ำ:</strong> {
                    selectedSchedule.frequency === 'daily' ? 'ทุกวัน' :
                    selectedSchedule.frequency === 'weekly' ? 'ทุกสัปดาห์' : 'ทุกเดือน'
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
                <p><strong>สร้างเมื่อ:</strong> {new Date(selectedSchedule.created_at).toLocaleString('th-TH')}</p>
                {selectedSchedule.updated_at && (
                  <p><strong>แก้ไขล่าสุด:</strong> {new Date(selectedSchedule.updated_at).toLocaleString('th-TH')}</p>
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