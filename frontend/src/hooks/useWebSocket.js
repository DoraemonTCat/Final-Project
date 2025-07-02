import { useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = 'http://localhost:8000';

export const useWebSocket = (pageId, onNewCustomer, onCustomerUpdate) => {
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    console.log('🔌 Connecting to WebSocket...');
    
    socketRef.current = io(SOCKET_URL, {
      path: '/ws/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Connection events
    socketRef.current.on('connect', () => {
      console.log('✅ WebSocket connected');
      reconnectAttempts.current = 0;
      
      // Subscribe to page updates
      if (pageId) {
        socketRef.current.emit('subscribe_page', { page_id: pageId });
      }
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });

    // Custom events
    socketRef.current.on('subscribed', (data) => {
      console.log('📢 Subscribed to page:', data.page_id);
    });

    socketRef.current.on('new_customer', (data) => {
      console.log('🆕 New customer event:', data);
      if (onNewCustomer && data.page_id === pageId) {
        onNewCustomer(data.customer);
      }
    });

    socketRef.current.on('customer_updated', (data) => {
      console.log('🔄 Customer updated event:', data);
      if (onCustomerUpdate && data.page_id === pageId) {
        onCustomerUpdate(data.customer);
      }
    });
  }, [pageId, onNewCustomer, onCustomerUpdate]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const subscribePage = useCallback((newPageId) => {
    if (socketRef.current?.connected && newPageId) {
      // Unsubscribe from old page
      if (pageId && pageId !== newPageId) {
        socketRef.current.emit('unsubscribe_page', { page_id: pageId });
      }
      // Subscribe to new page
      socketRef.current.emit('subscribe_page', { page_id: newPageId });
    }
  }, [pageId]);

  useEffect(() => {
    if (pageId) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      disconnect();
    };
  }, [pageId, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected || false,
    subscribePage,
    disconnect,
    reconnect: connect
  };
};