// frontend/src/AppMiner/Component_App/useRealtimeUpdates.js

import { useEffect, useRef, useCallback } from 'react';

export const useRealtimeUpdates = (pages, selectedPageId, onUpdate) => {
  const eventSourcesRef = useRef({});
  const reconnectTimeoutsRef = useRef({});
  const reconnectAttemptsRef = useRef({});
  const lastEventIdsRef = useRef({});

  // ✅ สร้าง connection สำหรับเพจเดียว
  const connectToPage = useCallback((pageId) => {
    if (!pageId) return;

    // ปิด connection เดิม (ถ้ามี)
    if (eventSourcesRef.current[pageId]) {
      eventSourcesRef.current[pageId].close();
      delete eventSourcesRef.current[pageId];
    }

    console.log(`🔌 Connecting to SSE for page ${pageId}`);
    
    const eventSource = new EventSource(
      `http://localhost:8000/sse/customers/${pageId}`
    );
    
    eventSourcesRef.current[pageId] = eventSource;

    eventSource.onopen = () => {
      console.log(`✅ SSE connection established for page ${pageId}`);
      reconnectAttemptsRef.current[pageId] = 0;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // ป้องกันข้อมูลซ้ำ
        const eventId = data.id || data.timestamp;
        if (eventId && eventId === lastEventIdsRef.current[pageId]) {
          return;
        }
        lastEventIdsRef.current[pageId] = eventId;
        
        // จัดการตาม type
        switch (data.type) {
          case 'customer_update':
            console.log(`📊 [${pageId}] Received customer updates:`, data.data);
            
            // ✅ แยกประเภทการอัปเดต
            const statusUpdates = data.data.filter(u => 
              u.action === 'mining_status_update' || u.mining_status
            );
            
            const newUsers = data.data.filter(u => u.action === 'new');
         
            
            // ส่งข้อมูลไปอัปเดต (พร้อม pageId)
            if (onUpdate) {
              onUpdate(pageId, data.data);
            }
            break;
            
          case 'customer_type_update':
            console.log(`🏷️ [${pageId}] Received customer type update:`, data.data);
            if (onUpdate) {
              onUpdate(pageId, data.data);
            }
            break;
            
          case 'heartbeat':
            // Heartbeat - ไม่ต้องทำอะไร
            break;
            
          case 'error':
            console.error(`❌ [${pageId}] SSE Error:`, data.message);
            break;
            
          default:
            console.log(`📦 [${pageId}] Unknown event type:`, data.type);
        }
      } catch (error) {
        console.error(`Error parsing SSE data for page ${pageId}:`, error);
      }
    };

    eventSource.onerror = (error) => {
      console.error(`❌ SSE connection error for page ${pageId}:`, error);
      eventSource.close();
      delete eventSourcesRef.current[pageId];
      
      // Reconnect with exponential backoff
      const attempts = reconnectAttemptsRef.current[pageId] || 0;
      const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
      
      console.log(`🔄 [${pageId}] Reconnecting in ${delay}ms (attempt ${attempts + 1})`);
      
      reconnectTimeoutsRef.current[pageId] = setTimeout(() => {
        reconnectAttemptsRef.current[pageId] = attempts + 1;
        connectToPage(pageId);
      }, delay);
    };
  }, [onUpdate]);

  // ✅ เชื่อมต่อทุกเพจ
  const connectAllPages = useCallback(() => {
    if (!Array.isArray(pages) || pages.length === 0) {
      console.warn('⚠️ No pages to connect');
      return;
    }

    console.log(`🚀 Connecting to ${pages.length} pages...`);
    
    pages.forEach(page => {
      if (page && page.id) {
        connectToPage(page.id);
      }
    });
  }, [pages, connectToPage]);

  // ✅ ปิดการเชื่อมต่อทั้งหมด
  const disconnectAll = useCallback(() => {
    console.log('🔌 Disconnecting all SSE connections...');
    
    // ปิด eventSources ทั้งหมด
    Object.keys(eventSourcesRef.current).forEach(pageId => {
      if (eventSourcesRef.current[pageId]) {
        eventSourcesRef.current[pageId].close();
      }
    });
    eventSourcesRef.current = {};
    
    // Clear reconnect timeouts
    Object.keys(reconnectTimeoutsRef.current).forEach(pageId => {
      if (reconnectTimeoutsRef.current[pageId]) {
        clearTimeout(reconnectTimeoutsRef.current[pageId]);
      }
    });
    reconnectTimeoutsRef.current = {};
    
    // Reset states
    reconnectAttemptsRef.current = {};
    lastEventIdsRef.current = {};
  }, []);

  // ✅ Effect: เชื่อมต่อเมื่อ pages เปลี่ยน
  useEffect(() => {
    connectAllPages();
    
    return () => {
      disconnectAll();
    };
  }, [connectAllPages, disconnectAll]);

  return { 
    disconnect: disconnectAll, 
    reconnect: connectAllPages 
  };
};
