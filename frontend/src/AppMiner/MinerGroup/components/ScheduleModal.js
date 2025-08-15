import React from 'react';
import { useNavigate } from 'react-router-dom';
/**
 * ScheduleModal Component
 * แสดง Modal รายละเอียดตารางเวลาของกลุ่ม
 * - แสดงรายการ schedule ทั้งหมดของกลุ่ม
 * - มีปุ่มลบ schedule
 */
const ScheduleModal = ({ show, schedules, groupName, onClose, onDeleteSchedule }) => {
  const navigate = useNavigate();

  if (!show) return null;

  // ฟังก์ชันสำหรับแสดงรายละเอียด schedule ที่ปรับปรุงแล้ว
  const formatScheduleDetail = (schedule) => {
    // ถ้ามี displayText ที่ประมวลผลมาแล้ว ใช้เลย
    if (schedule.displayText) {
      return schedule.displayText;
    }
    
    // ไม่งั้นใช้ logic เดิมแต่ปรับปรุง
    if (schedule.type === 'immediate') {
      return 'ส่งทันที';
    } else if (schedule.type === 'scheduled') {
      const date = schedule.date ? new Date(schedule.date).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 'ไม่ระบุวันที่';
      const time = schedule.time || 'ไม่ระบุเวลา';
      return `ส่งตามเวลา: ${date} เวลา ${time} น.`;
    } else if (schedule.type === 'user-inactive') {
      // ถ้ามี inactivityDescription ใช้เลย
      if (schedule.inactivityDescription) {
        return schedule.inactivityDescription;
      }
      
      // ถ้ามี send_after_inactive ดิบ ให้แปลง
      if (schedule.send_after_inactive) {
        const parts = schedule.send_after_inactive.split(' ');
        if (parts.length >= 2) {
          const value = parts[0];
          const unit = parts[1];
          const unitText = 
            unit.includes('minute') ? 'นาที' :
            unit.includes('hour') ? 'ชั่วโมง' :
            unit.includes('day') ? 'วัน' :
            unit.includes('week') ? 'สัปดาห์' :
            unit.includes('month') ? 'เดือน' : unit;
          return `ส่งเมื่อ User หายไป ${value} ${unitText}`;
        }
      }
      
      // Fallback ถ้าไม่มีข้อมูล
      const period = schedule.inactivityPeriod || 0;
      const unit = schedule.inactivityUnit || 'days';
      const unitText = unit === 'minutes' ? 'นาที' :
                      unit === 'hours' ? 'ชั่วโมง' :
                      unit === 'days' ? 'วัน' :
                      unit === 'weeks' ? 'สัปดาห์' : 'เดือน';
      return `ส่งเมื่อ User หายไป ${period} ${unitText}`;
    }
    return 'ไม่ทราบประเภท';
  };

  // ฟังก์ชันสำหรับแสดงการทำซ้ำ
  const formatRepeat = (schedule) => {
    if (!schedule.repeat || schedule.repeat.type === 'once') {
      return null;
    }
    
    const repeatType = schedule.repeat.type === 'daily' ? 'ทุกวัน' :
                      schedule.repeat.type === 'weekly' ? 'ทุกสัปดาห์' :
                      schedule.repeat.type === 'monthly' ? 'ทุกเดือน' : '';
    
    const endDate = schedule.repeat.endDate ? 
      ` จนถึง ${new Date(schedule.repeat.endDate).toLocaleDateString('th-TH')}` : '';
    
    return `🔄 ทำซ้ำ: ${repeatType}${endDate}`;
  };

  const handleEditSchedule = (schedule) => {
    // เก็บ group id และ schedule id ลง localStorage
    localStorage.setItem('selectedCustomerGroups', JSON.stringify(schedule.groups));
    localStorage.setItem('selectedCustomerGroupsPageId', localStorage.getItem('selectedPage'));
    localStorage.setItem('editingScheduleId', schedule.id);
    navigate('/GroupSchedule');
  };

  return (
    <div className="add-group-modal">
      <div className="modal-content" style={{ maxWidth: '700px' }}>
        <h3>⏰ ตารางเวลาของกลุ่ม: {groupName}</h3>
        
        {schedules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
            <p>ยังไม่มีการตั้งเวลาสำหรับกลุ่มนี้</p>
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '20px' }}>
            {schedules.map((schedule, index) => (
              <div key={schedule.id || index} style={{
                background: '#f8f9fa',
                padding: '20px',
                borderRadius: '12px',
                marginBottom: '15px',
                border: '1px solid #e2e8f0',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ 
                      margin: '0 0 12px 0', 
                      fontWeight: '600', 
                      color: '#2d3748',
                      fontSize: '16px'
                    }}>
                      <span style={{
                        background: '#667eea',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        marginRight: '8px'
                      }}>
                        #{index + 1}
                      </span>
                      {formatScheduleDetail(schedule)}
                    </p>
                    
                    {formatRepeat(schedule) && (
                      <p style={{
                        margin: '8px 0 0 0',
                        color: '#4a5568',
                        fontSize: '14px'
                      }}>
                        {formatRepeat(schedule)}
                      </p>
                    )}
                  
                    
                    {schedule.created_at && (
                      <p style={{
                        margin: '8px 0 0 0',
                        color: '#a0aec0',
                        fontSize: '12px'
                      }}>
                        สร้างเมื่อ: {new Date(schedule.created_at).toLocaleString('th-TH')}
                      </p>
                    )}
                  </div>
                  
                  {/* ปุ่มแก้ไขและลบ */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleEditSchedule(schedule)}
                      style={{
                        background: 'orange',
                        color: '#f3e8e8ff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      ✏️ แก้ไข
                    </button>
                    <button
                      onClick={() => onDeleteSchedule(schedule.id)}
                      style={{
                        background: '#fee',
                        color: '#e53e3e',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      🗑️ ลบ
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="modal-actions" style={{ marginTop: '20px' }}>
          <button
            onClick={onClose}
            className="cancel-btn"
            style={{ width: '100%' }}
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;