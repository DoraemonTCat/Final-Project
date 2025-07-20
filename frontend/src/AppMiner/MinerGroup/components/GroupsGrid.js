// MinerGroup/components/GroupsGrid.js
import React from 'react';
import GroupCard from './GroupCard';

/**
 * GroupsGrid Component
 * จัดการการแสดงผลกลุ่มลูกค้าทั้งหมด
 * - แบ่งเป็น default groups และ user groups
 * - จัดการ grid layout
 */
const GroupsGrid = ({
  defaultGroups,
  userGroups,
  selectedGroups,
  editingGroupId,
  groupScheduleCounts,
  onToggleSelect,
  onStartEdit,
  onDelete,
  onEditMessages,
  onViewSchedules,
  onSaveEdit,
  onCancelEdit
}) => {
  if (defaultGroups.length === 0 && userGroups.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔍</div>
        <h3>ไม่พบกลุ่มที่ค้นหา</h3>
        <p>ลองค้นหาด้วยคำอื่น</p>
      </div>
    );
  }

  return (
    <>
      {defaultGroups.length > 0 && (
        <div className="default-groups-section">
          <h3 className="section-title">
            <span className="section-icon">⭐</span>
            กลุ่มพื้นฐาน
          </h3>
          <div className="groups-grid">
            {defaultGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                isSelected={selectedGroups.includes(group.id)}
                isEditing={editingGroupId === group.id}
                scheduleCount={groupScheduleCounts[group.id] || 0}
                onToggleSelect={onToggleSelect}
                onStartEdit={onStartEdit}
                onDelete={onDelete}
                onEditMessages={onEditMessages}
                onViewSchedules={onViewSchedules}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
              />
            ))}
          </div>
        </div>
      )}

      {defaultGroups.length > 0 && userGroups.length > 0 && (
        <div className="groups-divider">
          <div className="divider-line"></div>
          <span className="divider-text">กลุ่มที่คุณสร้าง</span>
          <div className="divider-line"></div>
        </div>
      )}

      {userGroups.length > 0 && (
        <div className="user-groups-section">
          <div className="groups-grid">
            {userGroups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                isSelected={selectedGroups.includes(group.id)}
                isEditing={editingGroupId === group.id}
                scheduleCount={groupScheduleCounts[group.id] || 0}
                onToggleSelect={onToggleSelect}
                onStartEdit={onStartEdit}
                onDelete={onDelete}
                onEditMessages={onEditMessages}
                onViewSchedules={onViewSchedules}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default GroupsGrid;