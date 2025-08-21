// components/AlertMessages.js
// =====================================================
// COMPONENT: AlertMessages
// PURPOSE: แสดงข้อความแจ้งเตือนตามสถานะต่างๆ
// FEATURES:
// - แจ้งเตือนเมื่อยังไม่เลือกเพจ
// - แจ้งเตือนเมื่อไม่มีข้อมูล
// - แสดงผลการกรองข้อมูล
// =====================================================

import React from 'react';

const AlertMessages = ({ selectedPage, conversationsLength, loading, filteredLength, allLength }) => {
  if (!selectedPage) {
    return (
      <div className="alert alert-warning">
        <div className="alert-icon">⚠️</div>
        <div className="alert-content">
          <strong>กรุณาเลือกเพจ Facebook</strong>
          <p>เลือกเพจจากเมนูด้านซ้ายเพื่อเริ่มใช้งานระบบขุดข้อมูล</p>
        </div>
      </div>
    );
  }

  if (selectedPage && conversationsLength === 0 && !loading) {
    return (
      <div className="alert alert-info">
        <div className="alert-icon">ℹ️</div>
        <div className="alert-content">
          <strong>ยังไม่มีข้อมูลการสนทนา</strong>
          <p>กดปุ่ม "รีเฟรชข้อมูล" เพื่อโหลดข้อมูลการสนทนาล่าสุด</p>
        </div>
      </div>
    );
  }

  
};

export default AlertMessages;