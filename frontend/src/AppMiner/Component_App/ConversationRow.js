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

// Extracted constants to avoid recreation
const PLATFORM_MAP = {
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
    icon: "📱",
    className: "line"
  }
};

const MINING_STATUS_MAP = {
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

const CUSTOMER_TYPE_MAP = {
  newCM: "ทักแล้วหาย",
  intrestCM: "ทักแล้วคุย แต่ไม่ถามราคา",
  dealDoneCM: "ทักแล้วถามราคา แต่ไม่ซื้อ",
  exCM: "ทักแล้วซื้อ"
};

// Memoized sub-components
const UserInfo = React.memo(({ displayName, conv }) => (
  <div className="user-info">
    <div className="user-avatar">
      {displayName.charAt(0).toUpperCase()}
    </div>
    <div className="user-details">
      <div className="user-name">{displayName}</div>
      {conv.source_type && <CustomerInfoBadge customer={conv} />}
    </div>
  </div>
), (prev, next) => 
  prev.displayName === next.displayName && 
  prev.conv.source_type === next.conv.source_type
);

const PlatformBadge = React.memo(({ platform }) => {
  const info = PLATFORM_MAP[platform] || PLATFORM_MAP.FB;
  return (
    <div className={`platform-badge ${info.className}`}>
      {info.icon}
      {info.label}
    </div>
  );
}, (prev, next) => prev.platform === next.platform);

const CustomerTypes = React.memo(({ types, isRecentlyUpdated }) => {
  if (types.length === 0) {
    return (
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
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {types.map((type, index) => (
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
  );
}, (prev, next) => 
  JSON.stringify(prev.types) === JSON.stringify(next.types) &&
  prev.isRecentlyUpdated === next.isRecentlyUpdated
);

const MiningStatus = React.memo(({ status }) => {
  const info = MINING_STATUS_MAP[status] || MINING_STATUS_MAP['ยังไม่ขุด'];
  
  return (
    <div 
      className="status-indicator" 
      style={{ 
        '--status-color': info.color,
        background: info.bgColor,
        padding: '6px 12px',
        borderRadius: '20px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: '600',
        fontSize: '13px',
        border: `1px solid ${info.color}`,
        transition: 'all 0.3s ease'
      }}
    >
      <span className="status-icon" style={{ fontSize: '16px' }}>
        {info.icon}
      </span>
      <span style={{ color: info.color }}>
        {info.label}
      </span>
    </div>
  );
}, (prev, next) => prev.status === next.status);

const ConversationRow = React.memo(({ 
  conv, 
  idx, 
  isSelected, 
  onToggleCheckbox,
  onInactivityChange,
  isRecentlyUpdated
}) => {
  // Use stable values
  const displayName = React.useMemo(() => 
    conv.conversation_name || conv.user_name || 
    `User...${(conv.raw_psid || '').slice(-8)}` || `บทสนทนาที่ ${idx + 1}`,
    [conv.conversation_name, conv.user_name, conv.raw_psid, idx]
  );
  
  const customerTypes = React.useMemo(() => {
    const types = [];
    
    if (conv.customer_type_name && conv.customer_type_custom_id) {
      types.push({
        name: conv.customer_type_name,
        color: "#667eea",
        type: "custom",
        icon: "👤",
        id: conv.customer_type_custom_id,
        priority: 1
      });
    }
    
    if (conv.customer_type_knowledge_name && conv.customer_type_knowledge_id) {
      types.push({
        name: conv.customer_type_knowledge_name,
        color: "#48bb78",
        type: "knowledge",
        icon: "👤",
        id: conv.customer_type_knowledge_id,
        priority: 2
      });
    }
    
    return types.sort((a, b) => a.priority - b.priority);
  }, [conv.customer_type_name, conv.customer_type_custom_id, 
      conv.customer_type_knowledge_name, conv.customer_type_knowledge_id]);

  const dateDisplay = React.useMemo(() => {
    const dateStr = conv.first_interaction_at || conv.created_time;
    if (!dateStr) return "-";
    
    return new Date(dateStr).toLocaleDateString("th-TH", {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }, [conv.first_interaction_at, conv.created_time]);

  // Stable callback
  const handleCheckboxChange = React.useCallback(() => {
    onToggleCheckbox(conv.conversation_id);
  }, [onToggleCheckbox, conv.conversation_id]);

  return (
    <tr className={`table-row ${isSelected ? 'selected' : ''} ${isRecentlyUpdated ? 'recently-updated' : ''}`}>
      <td className="table-cell text-center">
        <div className="row-number">{idx + 1}</div>
      </td>
      
      <td className="table-cell">
        <UserInfo displayName={displayName} conv={conv} />
      </td>
      
      <td className="table-cell">
        <div className="date-display">{dateDisplay}</div>  
      </td>
      
      <TimeAgoCell
        lastMessageTime={conv.last_user_message_time}
        updatedTime={conv.updated_time}
        userId={conv.raw_psid}
        onInactivityChange={onInactivityChange}
      />
      
      <td className="table-cell" style={{paddingLeft:"17px"}}>
        <PlatformBadge platform={conv.platform} />
      </td>
      
      <td className="table-cell" style={{paddingLeft:"47px"}}>
        <CustomerTypes types={customerTypes} isRecentlyUpdated={isRecentlyUpdated} />
      </td>
      
      <td className="table-cell" style={{paddingLeft:"35px"}}>
        <MiningStatus status={conv.miningStatus || 'ยังไม่ขุด'} />
      </td>
      
      <td className="table-cell text-center">
        <label className="custom-checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
          />
          <span className="checkbox-mark"></span>
        </label>
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  // Deep comparison for optimization
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isRecentlyUpdated === nextProps.isRecentlyUpdated &&
    prevProps.idx === nextProps.idx &&
    // Deep check for conv object - only check fields that affect rendering
    prevProps.conv.conversation_id === nextProps.conv.conversation_id &&
    prevProps.conv.conversation_name === nextProps.conv.conversation_name &&
    prevProps.conv.user_name === nextProps.conv.user_name &&
    prevProps.conv.raw_psid === nextProps.conv.raw_psid &&
    prevProps.conv.customer_type_name === nextProps.conv.customer_type_name &&
    prevProps.conv.customer_type_custom_id === nextProps.conv.customer_type_custom_id &&
    prevProps.conv.customer_type_knowledge_name === nextProps.conv.customer_type_knowledge_name &&
    prevProps.conv.customer_type_knowledge_id === nextProps.conv.customer_type_knowledge_id &&
    prevProps.conv.miningStatus === nextProps.conv.miningStatus &&
    prevProps.conv.platform === nextProps.conv.platform &&
    prevProps.conv.first_interaction_at === nextProps.conv.first_interaction_at &&
    prevProps.conv.created_time === nextProps.conv.created_time &&
    prevProps.conv.last_user_message_time === nextProps.conv.last_user_message_time &&
    prevProps.conv.updated_time === nextProps.conv.updated_time &&
    prevProps.conv.source_type === nextProps.conv.source_type &&
    // Check callback function references
    prevProps.onToggleCheckbox === nextProps.onToggleCheckbox &&
    prevProps.onInactivityChange === nextProps.onInactivityChange
  );
});

ConversationRow.displayName = 'ConversationRow';

export default ConversationRow;