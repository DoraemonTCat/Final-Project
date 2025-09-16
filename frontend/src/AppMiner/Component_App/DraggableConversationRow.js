// DraggableConversationRow.js
import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import ConversationRow from './ConversationRow';

const ItemType = 'CONVERSATION_ROW';

const DraggableConversationRow = ({ 
  conv, 
  idx, 
  isSelected, 
  onToggleCheckbox,
  onInactivityChange,
  isRecentlyUpdated,
  moveRow,
  findRow
}) => {
  const ref = useRef(null);
  
  // Original index ของ item ใน array
  const originalIndex = findRow(conv.conversation_id).index;

  // useDrag - ทำให้ element สามารถลากได้
  const [{ isDragging }, drag, preview] = useDrag({
    type: ItemType,
    item: { 
      id: conv.conversation_id, 
      originalIndex,
      conv // เก็บข้อมูล conversation ไว้ด้วย
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (item, monitor) => {
      // เมื่อ drop เสร็จแล้ว
      const { id: droppedId, originalIndex } = item;
      const didDrop = monitor.didDrop();
      
      // ถ้าไม่ได้ drop หรือ drop นอกพื้นที่ ให้กลับไปที่เดิม
      if (!didDrop) {
        moveRow(droppedId, originalIndex);
      }
    },
  });

  // useDrop - ทำให้ element สามารถรับการ drop ได้
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ItemType,
    hover: (item, monitor) => {
      if (!ref.current) {
        return;
      }
      
      const dragIndex = item.originalIndex;
      const hoverIndex = idx;
      
      // ถ้าลากมาที่ตำแหน่งเดิม ไม่ต้องทำอะไร
      if (dragIndex === hoverIndex) {
        return;
      }
      
      // คำนวณตำแหน่ง
      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      
      // ตรวจสอบว่าควร swap หรือยัง
      // ถ้าลากลง แต่ยังไม่ถึงครึ่งล่างของ item ก็ยังไม่ swap
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      
      // ถ้าลากขึ้น แต่ยังไม่ถึงครึ่งบนของ item ก็ยังไม่ swap
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }
      
      // ทำการย้ายตำแหน่ง
      moveRow(item.id, hoverIndex);
      
      // อัพเดท index เพื่อประสิทธิภาพ
      item.originalIndex = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  // รวม ref ของ drag และ drop
  drag(drop(ref));

  // Style สำหรับ visual feedback
  const opacity = isDragging ? 0.4 : 1;
  const backgroundColor = isOver && canDrop ? '#f0f8ff' : 'transparent';
  const transform = isDragging ? 'rotate(2deg)' : '';
  const cursor = 'move';

  return (
    <tbody 
      ref={ref} 
      style={{ 
        opacity, 
        backgroundColor,
        transform,
        cursor,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative'
      }}
    >
      {isOver && canDrop && (
        <tr>
          <td colSpan="8" style={{ height: '2px', padding: 0 }}>
            <div style={{
              height: '2px',
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              animation: 'pulse 1s infinite'
            }}/>
          </td>
        </tr>
      )}
      <ConversationRow
        conv={conv}
        idx={idx}
        isSelected={isSelected}
        onToggleCheckbox={onToggleCheckbox}
        onInactivityChange={onInactivityChange}
        isRecentlyUpdated={isRecentlyUpdated}
      />
    </tbody>
  );
};

export default DraggableConversationRow;