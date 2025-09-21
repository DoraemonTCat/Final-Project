// components/ConversationTable.js
// =====================================================
// COMPONENT: ConversationTable
// PURPOSE: แสดงตารางข้อมูลการสนทนา
// FEATURES:
// - แสดงข้อมูลในรูปแบบตาราง
// - มี checkbox สำหรับเลือกทั้งหมด
// - ใช้ ConversationRow สำหรับแต่ละแถว
// =====================================================

import React from 'react';

const ConversationTable = React.memo(({ 
  displayData, 
  selectedConversationIds, 
  onToggleCheckbox, 
  onToggleAll,
  onInactivityChange,
  renderRow 
}) => {
  // Memoize checkbox state
  const isAllSelected = React.useMemo(() => 
    selectedConversationIds.length === displayData.length && displayData.length > 0,
    [selectedConversationIds.length, displayData.length]
  );

  // Memoize toggle all handler
  const handleToggleAll = React.useCallback((e) => {
    onToggleAll(e.target.checked);
  }, [onToggleAll]);

  return (
    <div className="table-container">
      <table className="modern-table">
        <thead>
          <tr>
            <th className="th-number">ลำดับ</th>
            <th className="th-user" style={{paddingLeft:"33px"}}>ผู้ใช้</th>
            <th className="th-date" style={{paddingLeft:"20px"}}>วันที่เข้า</th>
            <th className="th-time">ระยะเวลาที่หาย</th>    
            <th className="th-platform">Platform</th>
            <th className="th-type" style={{paddingLeft:"53px"}}>หมวดหมู่ลูกค้า</th>
            <th className="th-status" style={{paddingLeft:"43px"}}>สถานะการขุด</th>
            <th className="th-select">
              <label className="select-all-checkbox">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleToggleAll}
                />
                <span className="checkbox-mark"></span>
              </label>
            </th>
          </tr>
        </thead>
        <tbody>
          {displayData.map((conv, idx) => 
            renderRow(
              conv, 
              idx, 
              selectedConversationIds.includes(conv.conversation_id),
              onToggleCheckbox,
              onInactivityChange
            )
          )}
        </tbody>
      </table>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison
  return (
    prevProps.displayData.length === nextProps.displayData.length &&
    prevProps.selectedConversationIds.length === nextProps.selectedConversationIds.length &&
    JSON.stringify(prevProps.displayData) === JSON.stringify(nextProps.displayData) &&
    JSON.stringify(prevProps.selectedConversationIds) === JSON.stringify(nextProps.selectedConversationIds)
  );
});

ConversationTable.displayName = 'ConversationTable';

export default ConversationTable;