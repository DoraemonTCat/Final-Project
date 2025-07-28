// frontend/src/hooks/useRealtimeUpdates.js
import { useEffect, useRef, useCallback } from 'react';

export const useRealtimeUpdates = (pageId, onUpdate) => {
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

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
      
      switch (data.type) {
        case 'customer_update':
          console.log('📊 Received customer updates:', data.data);
          if (onUpdate) {
            onUpdate(data.data);
          }
          break;
          
        case 'customer_type_update':
          // Handle customer type specific updates
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
    console.log('🔌 SSE disconnected');
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { disconnect, reconnect: connect };
};