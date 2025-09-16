// DraggableConversationTable.js
import React, { useState, useCallback, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import DraggableConversationRow from './DraggableConversationRow';

const DraggableConversationTable = ({ 
  displayData, 
  selectedConversationIds, 
  onToggleCheckbox, 
  onToggleAll,
  onInactivityChange,
  onDataReorder,
  recentlyUpdatedUsers 
}) => {
  // Local state สำหรับเก็บลำดับของข้อมูล
  const [orderedData, setOrderedData] = useState(displayData);

  // Update เมื่อ displayData เปลี่ยน
  useEffect(() => {
    setOrderedData(displayData);
  }, [displayData]);

  // ฟังก์ชันหา index ของ row
  const findRow = useCallback((id) => {
    const row = orderedData.filter(c => c.conversation_id === id)[0];
    return {
      row,
      index: orderedData.indexOf(row),
    };
  }, [orderedData]);

  // ฟังก์ชันย้ายตำแหน่ง row
  const moveRow = useCallback((id, atIndex) => {
    const { row, index } = findRow(id);
    
    // ถ้าตำแหน่งเดิมกับใหม่เหมือนกัน ไม่ต้องทำอะไร
    if (index === atIndex) {
      return;
    }

    // สร้าง array ใหม่โดยการย้ายตำแหน่ง
    const newData = [...orderedData];
    
    // ลบ item ออกจากตำแหน่งเดิม
    newData.splice(index, 1);
    
    // ใส่ item เข้าไปในตำแหน่งใหม่
    newData.splice(atIndex, 0, row);
    
    // อัพเดท state
    setOrderedData(newData);
    
    // Callback ไปยัง parent component (ถ้าต้องการ)
    if (onDataReorder) {
      onDataReorder(newData);
    }
  }, [findRow, orderedData, onDataReorder]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="table-container">
        <style>{`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
          
          .drag-handle {
            cursor: move;
            padding: 4px 8px;
            color: #718096;
            transition: color 0.2s;
          }
          
          .drag-handle:hover {
            color: #4A5568;
          }
          
          .dragging-row {
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            background: white;
            border-radius: 8px;
          }
        `}</style>
        
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
                    checked={selectedConversationIds.length === orderedData.length && orderedData.length > 0}
                    onChange={(e) => onToggleAll(e.target.checked)}
                  />
                  <span className="checkbox-mark"></span>
                </label>
              </th>
            </tr>
          </thead>
          
          {orderedData.map((conv, idx) => (
            <DraggableConversationRow
              key={conv.conversation_id || idx}
              conv={conv}
              idx={idx}
              isSelected={selectedConversationIds.includes(conv.conversation_id)}
              onToggleCheckbox={onToggleCheckbox}
              onInactivityChange={onInactivityChange}
              isRecentlyUpdated={recentlyUpdatedUsers?.has(conv.raw_psid)}
              moveRow={moveRow}
              findRow={findRow}
            />
          ))}
        </table>
        
        {/* Floating indicator when dragging */}
        <div id="drag-indicator" style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '20px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
          display: 'none',
          zIndex: 9999,
          fontSize: '14px',
          fontWeight: '600'
        }}>
          <span>🔄 กำลังจัดเรียง...</span>
        </div>
      </div>
    </DndProvider>
  );
};

export default DraggableConversationTable;