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
  onInactivityChange 
}) => {
  const statusColors = {
    'ขุดแล้ว': '#48bb78',
    'ยังไม่ขุด': '#e53e3e',
    'มีการตอบกลับ': '#3182ce'
  };

  // อัพเดท Customer type mapping สำหรับแสดงชื่อกลุ่ม
  const getCustomerTypeDisplay = () => {
    // ถ้ามี customer_type_name จาก backend ให้แสดง
    if (conv.customer_type_name) {
      return {
        name: conv.customer_type_name,
        color: "#667eea"
      };
    }
    
    // ถ้าไม่มี ใช้ mapping เดิม
    const customerTypeMap = {
      newCM: { name: "ลูกค้าใหม่", color: "#667eea" },
      intrestCM: { name: "สนใจสินค้าสูง", color: "#38b2ac" },
      dealDoneCM: { name: "ใกล้ปิดการขาย", color: "#ecc94b" },
      exCM: { name: "ลูกค้าเก่า", color: "#718096" }
    };
    
    return customerTypeMap[conv.customerType] || null;
  };
  
  const customerTypeInfo = getCustomerTypeDisplay();

  // Platform mapping (โค้ดเดิม)
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
    Mining: { label: "ขุดแล้ว", color: statusColors['ขุดแล้ว'] },
    "0Mining": { label: "ยังไม่ขุด", color: statusColors['ยังไม่ขุด'] },
    returnCM: { label: "มีการตอบกลับ", color: statusColors['มีการตอบกลับ'] }
  };
  const miningStatusInfo = miningStatusMap[conv.miningStatus] || { label: "สถานะการขุด", color: "#a0aec0" };

  return (
    <tr className={`table-row ${isSelected ? 'selected' : ''}`}>
      <td className="table-cell text-center">
        <div className="row-number">{idx + 1}</div>
      </td>
      
      <td className="table-cell">
        <div className="user-info">
          <div className="user-avatar">
            {conv.user_name?.charAt(0) || 'U'}
          </div>
          <div className="user-details">
            <div className="user-name">{conv.conversation_name || `บทสนทนาที่ ${idx + 1}`}</div>
            {conv.source_type && <CustomerInfoBadge customer={conv} />}
          </div>
        </div>
      </td>
      
      <td className="table-cell">
        <div className="date-display">
          {conv.last_user_message_time
            ? new Date(conv.last_user_message_time).toLocaleDateString("th-TH", {
              year: 'numeric', month: 'short', day: 'numeric'
            })
            : "-"
          }
        </div>
      </td>
      
      <TimeAgoCell   
        lastMessageTime={conv.last_user_message_time}
        updatedTime={conv.updated_time}
        userId={conv.raw_psid}
        onInactivityChange={onInactivityChange}
      />
      
      <td className="table-cell">
        <span className="product-tag">{conv.product_interest || "สินค้าที่สนใจ"}</span>
      </td>
      
      <td className="table-cell">
        <div className={`platform-badge ${platformInfo.className}`}>
          {platformInfo.icon}
          {platformInfo.label}
        </div>
      </td>
      
      <td className="table-cell">
        {customerTypeInfo ? (
          <span style={{
            background: customerTypeInfo.color,
            color: "#fff",
            padding: "4px 12px",
            borderRadius: "12px",
            fontSize: "13px",
            fontWeight: "600",
            display: "inline-block"
          }}>
            {customerTypeInfo.name}
          </span>
        ) : (
          <span style={{
            background: "#f7fafc",
            color: "#718096",
            padding: "4px 12px",
            borderRadius: "12px",
            fontSize: "13px",
            display: "inline-block"
          }}>
            ยังไม่จัดกลุ่ม
          </span>
        )}
      </td>
      
      <td className="table-cell">
        <div className="status-indicator" style={{ '--status-color': miningStatusInfo.color }}>
          <span className="customer-type new">{miningStatusInfo.label}</span>
        </div>
      </td>
      
      <td className="table-cell text-center">
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