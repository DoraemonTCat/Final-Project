// MinerGroup/components/GroupCard.js
import React from 'react';
import EditGroupForm from './EditGroupForm';

/**
 * GroupCard Component
 * แสดงข้อมูลกลุ่มลูกค้าในรูปแบบการ์ด
 * - รองรับทั้ง default group และ user group
 * - มี checkbox สำหรับเลือก
 * - แสดงจำนวน schedule
 * - มีปุ่มแก้ไขและลบ
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
  onCancelEdit
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
            
            {group.rule_description && (
              <p className="group-description">{group.rule_description}</p>
            )}
            
            {group.keywords && !isDefault && (
              <div className="group-keywords">
                {(() => {
                  const keywordsList = typeof group.keywords === 'string' 
                    ? group.keywords.split(',').map(k => k.trim()).filter(k => k)
                    : Array.isArray(group.keywords) 
                    ? group.keywords 
                    : [];
                  
                  return keywordsList.slice(0, 3).map((keyword, idx) => (
                    <span key={idx} className="keyword-tag">{keyword}</span>
                  )).concat(
                    keywordsList.length > 3 
                      ? [<span key="more" className="more-keywords">+{keywordsList.length - 3}</span>]
                      : []
                  );
                })()}
              </div>
            )}
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
            {isDefault ? 'กลุ่มพื้นฐานของระบบ' : 
             `สร้างเมื่อ ${group.created_at ? new Date(group.created_at).toLocaleDateString('th-TH') : 'ไม่ทราบ'}`}
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
          <button onClick={(e) => {
            e.stopPropagation();
            onEditMessages(group.id);
          }} className="action-btn edit-message-btn">
            {isDefault ? 'รายละเอียด' : 'รายละเอียด'}
          </button>
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