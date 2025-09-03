// MinerGroup/components/ScheduleModal.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ScheduleModal Component
 * แสดง Modal รายละเอียดตารางเวลาของกลุ่ม
 * - แสดงรายการ schedule ทั้งหมดของกลุ่ม (แบบรวม)
 * - มีปุ่มลบ schedule
 */
const ScheduleModal = ({ show, schedules, groupName, onClose, onDeleteSchedule }) => {
  const navigate = useNavigate();

  if (!show) return null;

  // ฟังก์ชันสำหรับจัดกลุ่ม schedules ที่มีเงื่อนไขเดียวกัน
  const groupSchedulesByCondition = (schedules) => {
    const grouped = {};
    
    schedules.forEach(schedule => {
      // สร้าง key สำหรับจัดกลุ่มตาม type และเงื่อนไข
      let conditionKey = '';
      
      if (schedule.type === 'immediate') {
        conditionKey = 'immediate';
      } else if (schedule.type === 'scheduled') {
        conditionKey = `scheduled_${schedule.date}_${schedule.time}`;
      } else if (schedule.type === 'user-inactive') {
        // ใช้ send_after_inactive หรือ inactivityPeriod + inactivityUnit
        if (schedule.send_after_inactive) {
          conditionKey = `inactive_${schedule.send_after_inactive}`;
        } else {
          conditionKey = `inactive_${schedule.inactivityPeriod}_${schedule.inactivityUnit}`;
        }
      }
      
      if (!grouped[conditionKey]) {
        grouped[conditionKey] = {
          ...schedule,
          ids: [],
          messageCount: 0
        };
      }
      
      grouped[conditionKey].ids.push(schedule.id);
      grouped[conditionKey].messageCount += 1;
    });
    
    return Object.values(grouped);
  };

  // ฟังก์ชันสำหรับแสดงรายละเอียด schedule ที่ปรับปรุงแล้ว
  const formatScheduleDetail = (schedule) => {
    // ถ้ามี displayText ที่ประมวลผลมาแล้ว ใช้เลย
    if (schedule.displayText) {
      return schedule.displayText;
    }
    
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
    localStorage.setItem('editingScheduleId', schedule.id || schedule.ids?.[0]);
    navigate('/GroupSchedule');
  };

  const handleDeleteAllSchedules = (groupedSchedule) => {
    if (window.confirm(`คุณต้องการลบตารางเวลานี้ทั้งหมด ${groupedSchedule.messageCount} รายการหรือไม่?`)) {
      // ลบทุก schedule ID ในกลุ่มนี้
      groupedSchedule.ids.forEach(id => {
        onDeleteSchedule(id);
      });
    }
  };

  // จัดกลุ่ม schedules ตามเงื่อนไข
  const groupedSchedules = groupSchedulesByCondition(schedules);

  return (
    <div className="add-group-modal">
      <div className="modal-content" style={{ maxWidth: '700px' }}>
        <h3>⏰ ตารางเวลาของกลุ่ม: {groupName}</h3>
        
        {groupedSchedules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
            <p>ยังไม่มีการตั้งเวลาสำหรับกลุ่มนี้</p>
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '20px' }}>
            {groupedSchedules.map((schedule, index) => (
              <div key={`group-${index}`} style={{
                background: 'linear-gradient(135deg, #f8f9fa 0%, #fff 100%)',
                padding: '24px',
                borderRadius: '12px',
                marginBottom: '15px',
                border: '2px solid #e2e8f0',
                position: 'relative',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    {/* แสดงหัวข้อเงื่อนไข */}
                    <p style={{ 
                      margin: '0 0 16px 0', 
                      fontWeight: '700', 
                      color: '#2d3748',
                      fontSize: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <span style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}>
                        เงื่อนไข
                      </span>
                      {formatScheduleDetail(schedule)}
                    </p>
                    
                    {/* แสดงจำนวนข้อความ */}
                    <div style={{
                      background: '#e6f3ff',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      display: 'inline-block'
                    }}>
                      <p style={{
                        margin: 0,
                        color: '#2b6cb0',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}>
                        📬 จำนวนข้อความในเงื่อนไขนี้: <strong>{schedule.messageCount || schedules.length}</strong> ข้อความ
                      </p>
                    </div>
                    
                    {/* แสดงการทำซ้ำ */}
                    {formatRepeat(schedule) && (
                      <p style={{
                        margin: '12px 0 0 0',
                        color: '#4a5568',
                        fontSize: '14px',
                        background: '#f0fff4',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        display: 'inline-block'
                      }}>
                        {formatRepeat(schedule)}
                      </p>
                    )}
                    
                    {/* แสดงเวลาที่สร้าง */}
                    {schedule.created_at && (
                      <p style={{
                        margin: '12px 0 0 0',
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
                        background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 18px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(251, 191, 36, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 4px 8px rgba(251, 191, 36, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 2px 4px rgba(251, 191, 36, 0.3)';
                      }}
                    >
                      ✏️ แก้ไข
                    </button>
                    <button
                      onClick={() => {
                        if (schedule.ids && schedule.ids.length > 1) {
                          handleDeleteAllSchedules(schedule);
                        } else {
                          onDeleteSchedule(schedule.id || schedule.ids?.[0]);
                        }
                      }}
                      style={{
                        background: '#fee',
                        color: '#e53e3e',
                        border: '1px solid #fc8181',
                        borderRadius: '8px',
                        padding: '10px 18px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#fed7d7';
                        e.target.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = '#fee';
                        e.target.style.transform = 'translateY(0)';
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
            style={{ 
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: '600',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 8px 16px rgba(102, 126, 234, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;