// components/ConversationRow.js
// =====================================================
// COMPONENT: ConversationRow
// PURPOSE: แสดงแต่ละแถวของข้อมูลการสนทนา
// FEATURES:
// - แสดงข้อมูลผู้ใช้ (avatar, ชื่อ)
// - แสดงสถานะต่างๆ (platform, customer type, mining status)
// - checkbox สำหรับเลือกแถว
// - ใช้ TimeAgoCell สำหรับแสดงเวลา
// =====================================================

import React from 'react';
import TimeAgoCell from './TimeAgoCell';
import CustomerInfoBadge from './CustomerInfoBadge';


const ConversationRow = React.memo(({ 
  conv, 
  idx, 
  isSelected, 
  onToggleCheckbox,
  onInactivityChange,
  isRecentlyUpdated
}) => {
  // ฟังก์ชันแสดงหมวดหมู่ลูกค้า - รองรับทั้ง 2 ประเภท
  const getCustomerTypeDisplay = () => {
    const types = [];
    
    // ถ้ามี Custom Category (กลุ่มที่ user สร้างเอง)
    if (conv.customer_type_name && conv.customer_type_custom_id) {
      types.push({
        name: conv.customer_type_name,
        color: "#667eea",
        type: "custom",
        icon: "👤",
        id: conv.customer_type_custom_id,
        priority: 1  // แสดงก่อน
      });
    }
    
    // ถ้ามี Knowledge Category (กลุ่มพื้นฐานจาก AI)
    if (conv.customer_type_knowledge_name && conv.customer_type_knowledge_id) {
      types.push({
        name: conv.customer_type_knowledge_name,
        color: "#48bb78",
        type: "knowledge",
        icon: "👤",
        id: conv.customer_type_knowledge_id,
        priority: 2  // แสดงทีหลัง
      });
    }
    
    // เรียงตาม priority
    return types.sort((a, b) => a.priority - b.priority);
  };
  
  const customerTypes = getCustomerTypeDisplay();

  // Platform mapping
  const platformMap = {
    FB: {
      label: "Facebook",
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      className: "facebook"
    },
    Line: {
      label: "Line",
      icon: (
        <svg width="12" height="12" viewBox="0 0 48 48" fill="currentColor">
          <ellipse cx="24" cy="24" rx="20" ry="18" fill="#00c300"/>
          <text x="24" y="30" textAnchor="middle" fontSize="18" fill="#fff" fontFamily="Arial">LINE</text>
        </svg>
      ),
      className: "line"
    }
  };
  const platformInfo = platformMap[conv.platform] || platformMap.FB;

  // Mining status mapping
  const miningStatusMap = {
  'ยังไม่ขุด': { 
    label: "ยังไม่ขุด", 
    color: "#e53e3e",
    icon: "⭕",
    bgColor: "#fed7d7"
  },
  'ขุดแล้ว': { 
    label: "ขุดแล้ว", 
    color: "#48bb78",
    icon: "✅",
    bgColor: "#c6f6d5"
  },
  'มีการตอบกลับ': { 
    label: "มีการตอบกลับ", 
    color: "#3182ce",
    icon: "💬",
    bgColor: "#bee3f8"
  }
};

  const currentStatus = conv.miningStatus || 'ยังไม่ขุด';
  const miningStatusInfo = miningStatusMap[currentStatus] || miningStatusMap['ยังไม่ขุด'];

  return (
    <tr className={`table-row ${isSelected ? 'selected' : ''} ${isRecentlyUpdated ? 'recently-updated' : ''}`}>
      <td className="table-cell text-center">
        <div className="row-number">{idx + 1}</div> {/* แสดงหมายเลขแถว */}
      </td>
      
      <td className="table-cell">
        <div className="user-info">
          <div className="user-avatar">
            {conv.user_name?.charAt(0) || 'U'}
          </div>
          <div className="user-details">
            <div className="user-name" >{conv.conversation_name || `บทสนทนาที่ ${idx + 1}`}</div>  {/* แสดงชื่อชื่อ */}
            {conv.source_type && <CustomerInfoBadge customer={conv} />}
          </div>
        </div>
      </td>
      
      <td className="table-cell">
        <div className="date-display">
          {conv.first_interaction_at
            ? new Date(conv.first_interaction_at).toLocaleDateString("th-TH", {  // แสดงวันที่ในรูปแบบไทย
                year: 'numeric', month: 'short', day: 'numeric'
              })
            : conv.created_time
              ? new Date(conv.created_time).toLocaleDateString("th-TH", {  // ใช้ created_time ถ้าไม่มี first_interaction_at
                  year: 'numeric', month: 'short', day: 'numeric'
                })
              : "-"
          }
        </div>
      </td>
      
      <TimeAgoCell   
        lastMessageTime={conv.last_user_message_time}  // ไว่้บอกระยะเวลาที่หายไป
        updatedTime={conv.updated_time}
        userId={conv.raw_psid}
        onInactivityChange={onInactivityChange}
      />
      
      <td className="table-cell"style={{paddingLeft:"17px"}}>      {/* Platform	 */}
        <div className={`platform-badge ${platformInfo.className}`}>  
          {platformInfo.icon}
          {platformInfo.label}
        </div>
      </td>
      
      <td className="table-cell" style={{paddingLeft:"47px"}}>     {/* หมวดหมู่ลูกค้า */}
        {customerTypes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {customerTypes.map((type, index) => (
              <span 
                key={`${type.type}-${type.id}-${index}`}
                className={`customer-type-badge ${isRecentlyUpdated ? 'updating' : ''}`}
                style={{
                  background: type.type === 'custom' 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                    : 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
                  color: "#fff",
                  padding: "4px 10px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: "600",
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  width: 'fit-content',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease',
                  transform: isRecentlyUpdated ? 'scale(1.05)' : 'scale(1)'
                }}
                title={type.type === 'custom' 
                  ? 'กลุ่มที่กำหนดเอง' 
                  : 'กลุ่มพื้นฐาน (AI Classification)'}
              >
                <span style={{ fontSize: '10px' }}>{type.icon}</span>
                {type.name}
               
                {isRecentlyUpdated && (
                  <span className="update-pulse" style={{
                    width: '6px',
                    height: '6px',
                    backgroundColor: '#fff',
                    borderRadius: '50%',
                    animation: 'pulse 1s infinite'
                  }}></span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <span style={{
            background: "#f7fafc",
            color: "#718096",
            padding: "4px 12px",
            borderRadius: "12px",
            fontSize: "13px",
            display: "inline-block",
            border: "1px dashed #cbd5e0"
          }}>
            ยังไม่จัดกลุ่ม
          </span>
        )}
      </td>
      
      <td className="table-cell" style={{paddingLeft:"35px"}}> {/* สถานะขุด */}
        <div 
          className="status-indicator" 
          style={{ 
            '--status-color': miningStatusInfo.color,
            background: miningStatusInfo.bgColor,
            padding: '6px 12px',
            borderRadius: '20px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: '600',
            fontSize: '13px',
            border: `1px solid ${miningStatusInfo.color}`,
            transition: 'all 0.3s ease'
          }}
        >
          <span className="status-icon" style={{ fontSize: '16px' }}>
            {miningStatusInfo.icon}
          </span>
          <span style={{ color: miningStatusInfo.color }}>
            {miningStatusInfo.label}
          </span>
        </div>
      </td>
      
      <td className="table-cell text-center">    {/* Checkbox */}
        <label className="custom-checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleCheckbox(conv.conversation_id)}
          />
          <span className="checkbox-mark"></span>
        </label>
      </td>
    </tr>
  );
});

export default ConversationRow;