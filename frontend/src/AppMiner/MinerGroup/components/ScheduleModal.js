// MinerGroup/components/ScheduleModal.js
import React from 'react';

/**
 * ScheduleModal Component
 * แสดง Modal รายละเอียดตารางเวลาของกลุ่ม
 * - แสดงรายการ schedule ทั้งหมดของกลุ่ม
 * - มีปุ่มลบ schedule
 */
const ScheduleModal = ({ show, schedules, groupName, onClose, onDeleteSchedule }) => {
  if (!show) return null;

  return (
    <div className="add-group-modal">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <h3>⏰ ตารางเวลาของกลุ่ม: {groupName}</h3>
        <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '20px' }}>
          {schedules.map((schedule, index) => (
            <div key={schedule.id} style={{
              background: '#f8f9fa',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '15px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#2d3748' }}>
                    #{index + 1} - {
                      schedule.type === 'immediate' ? 'ส่งทันที' :
                      schedule.type === 'scheduled' ? `ส่งตามเวลา: ${new Date(schedule.date).toLocaleDateString('th-TH')} ${schedule.time} น.` :
                      `ส่งเมื่อหายไป ${schedule.inactivityPeriod} ${
                        schedule.inactivityUnit === 'minutes' ? 'นาที' :
                        schedule.inactivityUnit === 'hours' ? 'ชั่วโมง' :
                        schedule.inactivityUnit === 'days' ? 'วัน' :
                        schedule.inactivityUnit === 'weeks' ? 'สัปดาห์' : 'เดือน'
                      }`
                    }
                  </p>
                  {schedule?.repeat?.type !== 'once' && (
                    <p>
                      🔄 ทำซ้ำ: {
                        schedule?.repeat?.type === 'daily' ? 'ทุกวัน' :
                        schedule?.repeat?.type === 'weekly' ? 'ทุกสัปดาห์' :
                        'ทุกเดือน'
                      }
                      {schedule?.repeat?.endDate && ` จนถึง ${new Date(schedule.repeat.endDate).toLocaleDateString('th-TH')}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onDeleteSchedule(schedule.id)}
                  style={{
                    background: '#fee',
                    color: '#e53e3e',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  🗑️ ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
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