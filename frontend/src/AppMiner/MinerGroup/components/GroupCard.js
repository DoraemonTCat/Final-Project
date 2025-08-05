// MinerGroup/components/GroupCard.js
import React from 'react';
import EditGroupForm from './EditGroupForm';

/**
 * GroupCard Component
 * แสดงข้อมูลกลุ่มลูกค้าในรูปแบบการ์ด
 * - รองรับทั้ง knowledge group และ user group
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
  onViewDetails
}) => {
  const isKnowledge = group.isKnowledge;
  const isDefault = group.isDefault;
  const isDisabled = isKnowledge && group.is_enabled === false; // เช็คว่าถูกปิดใช้งานหรือไม่
  
  return (
    <div className={`group-card ${isKnowledge ? 'knowledge-group' : ''} ${isDefault ? 'default-group' : ''} ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled-group' : ''}`}>
      {isKnowledge && (
        <div className="knowledge-badge">
          กลุ่มพื้นฐาน
          {isDisabled && <span className="disabled-indicator"> (ปิดใช้งาน)</span>}
        </div>
      )}
      {isDefault && <div className="default-badge">พื้นฐาน</div>}
      
      <div className="group-checkbox">
        <input
          type="checkbox"
          id={`group-${group.id}`}
          checked={isSelected}
          onChange={() => !isDisabled && onToggleSelect(group.id)} // ป้องกันการเลือกถ้าปิดใช้งาน
          disabled={isDisabled}
        />
        <label htmlFor={`group-${group.id}`}></label>
      </div>
      
      <div className="group-content">
        <div className="group-icon">{group.icon || '👥'}</div>
        
        {isEditing && !isDisabled ? (
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
        
        {scheduleCount > 0 && !isDisabled && (
          <div className="schedule-info" onClick={(e) => {
            e.stopPropagation();
            if (!isDisabled) onViewSchedules(group);
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
          {!isDisabled && (
            <button onClick={(e) => {
              e.stopPropagation();
              onStartEdit(group);
            }} className="action-btn edit-name-btn">
              ✏️ แก้ไข
            </button>
          )}
          
          {!isDisabled && (
            <button onClick={(e) => {
              e.stopPropagation();
              onEditMessages(group.id);
            }} className="action-btn edit-message-btn">
              💬 ข้อความ
            </button>
          )}
          
          {!isDisabled && (
            <button onClick={(e) => {
              e.stopPropagation();
              onViewDetails(group);
            }} className="action-btn detail-btn" style={{ width: isKnowledge && isDisabled ? '100%' : '190px' }}>
              📋 รายละเอียด
            </button>
          )}
          
          {/* แสดงข้อความแทนปุ่มเมื่อปิดใช้งาน */}
          {isDisabled && (
            <div className="disabled-message">
             Disable
            </div>
          )}
        </div>
      </div>
      
      {!isKnowledge && !isDefault && !isDisabled && (
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