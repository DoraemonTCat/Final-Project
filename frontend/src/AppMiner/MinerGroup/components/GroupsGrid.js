// MinerGroup/components/GroupsGrid.js
import React from 'react';
import GroupCard from './GroupCard';

/**
 * GroupsGrid Component
 * จัดการการแสดงผลกลุ่มลูกค้าทั้งหมด
 * - แบ่งเป็น knowledge groups และ user groups
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
  onCancelEdit,
  onViewDetails
}) => {
  // แยก knowledge groups และ user groups
  const knowledgeGroups = [...defaultGroups, ...userGroups].filter(g => g.isKnowledge);
  const customGroups = userGroups.filter(g => !g.isKnowledge);

  if (knowledgeGroups.length === 0 && customGroups.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔍</div>
        <h3>ไม่พบกลุ่มที่ค้นหา</h3>
       
      </div>
    );
  }

  return (
    <>
      {knowledgeGroups.length > 0 && (
        <div className="knowledge-groups-section">
          <h3 className="section-title">
            <span className="section-icon">🧠</span>
            กลุ่มจาก Knowledge Base
          </h3>
          <div className="groups-grid">
            {knowledgeGroups.map((group) => (
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
                onViewDetails={onViewDetails}
              />
            ))}
          </div>
        </div>
      )}

      {knowledgeGroups.length > 0 && customGroups.length > 0 && (
        <div className="groups-divider">
          <div className="divider-line"></div>
          <span className="divider-text">กลุ่มที่คุณสร้าง</span>
          <div className="divider-line"></div>
        </div>
      )}

      {customGroups.length > 0 && (
        <div className="user-groups-section">
          <div className="groups-grid">
            {customGroups.map((group) => (
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
                onViewDetails={onViewDetails}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default GroupsGrid;