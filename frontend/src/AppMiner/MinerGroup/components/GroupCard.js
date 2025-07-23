// MinerGroup/components/GroupCard.js
import React from 'react';
import EditGroupForm from './EditGroupForm';

/**
 * GroupCard Component
 * แสดงข้อมูลกลุ่มลูกค้าในรูปแบบการ์ด
 * - รองรับทั้ง default group และ user group
 * - มี checkbox สำหรับเลือก
 * - แสดงจำนวน schedule
 * - มีปุ่มแก้ไข, ข้อความ, รายละเอียด และลบ
 */
const GroupCard = ({ 
  group, 
  isSelected, 
  isEditing, 
  scheduleCount,
  onToggleSelect, 
  onStartEdit, 
  onDelete, 
  onEditMessages, 
  onViewSchedules,
  onSaveEdit,
  onCancelEdit,
  onViewDetails  // เพิ่ม prop ใหม่สำหรับดูรายละเอียด
}) => {
  const isDefault = group.isDefault;
  
  return (
    <div className={`group-card ${isDefault ? 'default-group' : ''} ${isSelected ? 'selected' : ''}`}>
      {isDefault && <div className="default-badge">พื้นฐาน</div>}
      
      <div className="group-checkbox">
        <input
          type="checkbox"
          id={`group-${group.id}`}
          checked={isSelected}
          onChange={() => onToggleSelect(group.id)}
        />
        <label htmlFor={`group-${group.id}`}></label>
      </div>
      
      <div className="group-content">
        <div className="group-icon">{group.icon || '👥'}</div>
        
        {isEditing ? (
          <EditGroupForm 
            group={group}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
          />
        ) : (
          <>
            <h3 className="group-name">{group.type_name || group.name}</h3>
          </>
        )}
        
        {scheduleCount > 0 && (
          <div className="schedule-info" onClick={(e) => {
            e.stopPropagation();
            onViewSchedules(group);
          }}>
            <span>⏰ มีการตั้งเวลา {scheduleCount} รายการ</span>
          </div>
        )}
        
        <div className="group-meta">
          <div className="group-date">
            <br></br>
          </div>
        </div>
        
        <div className="group-actions">
          <button onClick={(e) => {
            e.stopPropagation();
            onStartEdit(group);
          }} className="action-btn edit-name-btn">
            ✏️ {isDefault ? 'แก้ไขชื่อ' : 'แก้ไข'}
          </button>
          <button onClick={(e) => {
            e.stopPropagation();
            onEditMessages(group.id);
          }} className="action-btn edit-message-btn">
            💬 {isDefault ? 'แก้ไขข้อความ' : 'ข้อความ'}
          </button>
          {!isDefault && (
            <button onClick={(e) => {
              e.stopPropagation();
              onViewDetails(group);
            }} className="action-btn detail-btn" style={{ width: '190px' }}>
              📋 รายละเอียด
            </button>
          )}
        </div>
      </div>
      
      {!isDefault && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(group.id);
          }}
          className="delete-btn"
          title="ลบกลุ่ม"
        >
          🗑️
        </button>
      )}
    </div>
  );
};

export default GroupCard;