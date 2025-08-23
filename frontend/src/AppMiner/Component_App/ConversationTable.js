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
import ConversationRow from './ConversationRow';

const ConversationTable = ({ 
  displayData, 
  selectedConversationIds, 
  onToggleCheckbox, 
  onToggleAll,
  onInactivityChange 
}) => {
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
                  checked={selectedConversationIds.length === displayData.length && displayData.length > 0}
                  onChange={(e) => onToggleAll(e.target.checked)}
                />
                <span className="checkbox-mark"></span>
              </label>
            </th>
          </tr>
        </thead>
        <tbody>
          {displayData.map((conv, idx) => (
            <ConversationRow
              key={conv.conversation_id || idx}
              conv={conv}
              idx={idx}
              isSelected={selectedConversationIds.includes(conv.conversation_id)}
              onToggleCheckbox={onToggleCheckbox}
              onInactivityChange={onInactivityChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ConversationTable;