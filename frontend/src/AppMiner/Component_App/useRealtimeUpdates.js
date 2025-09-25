// frontend/src/AppMiner/Component_App/useRealtimeUpdates.js

import { useEffect, useRef, useCallback } from 'react';

export const useRealtimeUpdates = (pageId, onUpdate) => {
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const lastEventIdRef = useRef(null);

  const connect = useCallback(() => {
    if (!pageId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log(`🔌 Connecting to SSE for page ${pageId}`);
    
    const eventSource = new EventSource(
      `http://localhost:8000/sse/customers/${pageId}`
    );
    
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✅ SSE connection established');
      reconnectAttemptsRef.current = 0;
    };

    eventSource.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    
    // เก็บ event ID เพื่อป้องกันข้อมูลซ้ำ
    const eventId = data.id || data.timestamp;
    if (eventId && eventId === lastEventIdRef.current) {
      return; // Skip duplicate
    }
    lastEventIdRef.current = eventId;
    
    switch (data.type) {
      case 'customer_update':
        console.log('📊 Received customer updates:', data.data);
        
        // ตรวจสอบว่ามี mining status update หรือไม่
        const statusUpdates = data.data.filter(u => u.action === 'mining_status_update');
        if (statusUpdates.length > 0) {
          console.log('⛏️ Mining status updates detected:', statusUpdates);
          
          // แสดง notification สำหรับสถานะที่เปลี่ยน
          statusUpdates.forEach(update => {
            if (update.mining_status === 'มีการตอบกลับ') {
              showMiningStatusNotification(update.psid, 'มีการตอบกลับ');
            }
          });
        }
        
        // ตรวจสอบว่ามี user ใหม่หรือไม่
        const newUsers = data.data.filter(u => u.action === 'new');
        if (newUsers.length > 0) {
          console.log('🆕 New users detected:', newUsers);
          
          // แสดง notification
          newUsers.forEach(user => {
            showNewUserNotification(user.name || 'ผู้ใช้ใหม่');
          });
        }
        
        if (onUpdate) {
          onUpdate(data.data);
        }
        break;
        
      case 'customer_type_update':
        console.log('🏷️ Received customer type update:', data.data);
        if (onUpdate) {
          onUpdate(data.data);
        }
        break;
        
      case 'heartbeat':
        // console.log('💓 Heartbeat received');
        break;
        
      case 'error':
        console.error('❌ SSE Error:', data.message);
        break;
        
      default:
        console.log('📦 Unknown event type:', data.type);
    }
  } catch (error) {
    console.error('Error parsing SSE data:', error);
  }
};

// เพิ่ม Helper function สำหรับแสดง notification สถานะการขุด
const showMiningStatusNotification = (psid, status) => {
  const notification = document.createElement('div');
  notification.className = 'mining-status-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">💬</span>
      <div class="notification-text">
        <strong>สถานะการขุดอัพเดท!</strong>
        <span>ลูกค้า ${psid.slice(-8)} ${status}</span>
      </div>
    </div>
  `;
  
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 10000;
    min-width: 300px;
    background: linear-gradient(135deg, #3182ce 0%, #2563eb 100%);
    color: white;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
    animation: slideInRight 0.3s ease-out;
    padding: 16px 20px;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
};

    eventSource.onerror = (error) => {
      console.error('❌ SSE connection error:', error);
      eventSource.close();
      
      // Reconnect with exponential backoff
      const attempts = reconnectAttemptsRef.current;
      const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
      
      console.log(`🔄 Reconnecting in ${delay}ms (attempt ${attempts + 1})`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttemptsRef.current += 1;
        connect();
      }, delay);
    };
  }, [pageId, onUpdate]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    reconnectAttemptsRef.current = 0;
    lastEventIdRef.current = null;
    console.log('🔌 SSE disconnected');
  }, []);

  // Helper function สำหรับแสดง notification
  const showNewUserNotification = (userName) => {
    // Browser notification
    if (Notification.permission === 'granted') {
      new Notification('มีลูกค้าใหม่!', {
        body: `${userName} ทักเข้ามาใหม่`,
        icon: '🆕',
        tag: 'new-user',
        requireInteraction: false
      });
    }
    
    // In-app notification
    const notification = document.createElement('div');
    notification.className = 'new-user-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">🆕</span>
        <div class="notification-text">
          <strong>ลูกค้าใหม่!</strong>
          <span>${userName} ทักเข้ามาใหม่</span>
        </div>
      </div>
    `;
    
    // Style for notification
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 10000;
      min-width: 300px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      animation: slideInRight 0.3s ease-out;
      padding: 16px 20px;
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  };

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { disconnect, reconnect: connect };
};