// =====================================================
// REFACTORED APP.JS - แบ่งเป็น Component ย่อยๆ
// =====================================================
// TABLE OF CONTENTS:
// 1. IMPORTS & DEPENDENCIES **รวม imports ทั้งหมด
// 2. STATE MANAGEMENT **จัดกลุ่ม states ตามหน้าที่
// 3. REFS MANAGEMENT **รวม refs ทั้งหมด
// 4. UTILITY FUNCTIONS **ค่าที่คำนวณและ memoization
// 5. MINING FUNCTIONS **ฟังก์ชันช่วยทั่วไป
// 6. DATA LOADING FUNCTIONS **ฟังก์ชันเกี่ยวกับการขุด
// 7. FILTER FUNCTIONS **ฟังก์ชันโหลดข้อมูล
// 8. MESSAGE FUNCTIONS **ฟังก์ชันส่งข้อความ
// 9. NOTIFICATION FUNCTIONS **ฟังก์ชันแสดง notifications
// 10. POPUP HANDLERS **จัดการ popup
// 11. INACTIVITY FUNCTIONS  **จัดการ inactivity
// 12. CALLBACK FUNCTIONS **callback functions ต่างๆ
// 13. EFFECTS & LIFECYCLE **useEffect ทั้งหมด
// 14. RENDER  **ส่วนแสดงผล

// =====================================================

import React, { useState, useEffect, useCallback, useRef, useMemo, useReducer } from "react";
import { useRealtimeUpdates } from './Component_App/useRealtimeUpdates';
import '../CSS/App.css';
import { fetchPages, getMessagesBySetId, fetchConversations } from "../Features/Tool";
import Sidebar from "./Sidebar";
import Popup from "./Component_App/MinerPopup";
import SyncCustomersButton from './Component_App/SyncCustomersButton';
import DateFilterBadge from './Component_App/DateFilterBadge';
import DateEntryFilter from './Component_App/DateEntryFilter';

// Import component ย่อยที่แยกออกมา
import TimeAgoCell from './Component_App/TimeAgoCell';
import CustomerInfoBadge from './Component_App/CustomerInfoBadge';
import CustomerStatistics from './Component_App/CustomerStatistics';
import ConversationRow from './Component_App/ConversationRow';
import FileUploadSection from './Component_App/FileUploadSection';
import HeroSection from './Component_App/HeroSection';
import ConnectionStatusBar from './Component_App/ConnectionStatusBar';
import FilterSection from './Component_App/FilterSection';
import AlertMessages from './Component_App/AlertMessages';
import ConversationTable from './Component_App/ConversationTable';
import ActionBar from './Component_App/ActionBar';
import LoadingState from './Component_App/LoadingState';
import EmptyState from './Component_App/EmptyState';
import DailyMiningLimit from './Component_App/DailyMiningLimit';
import MiniProgressBar from './Component_App/MiniProgressBar';

// =====================================================
// OPTIMIZED STATE REDUCER
// =====================================================
const initialState = {
  conversations: [],
  allConversations: [],
  filteredConversations: [],
  miningStatuses: {},
  loading: false,
  isBackgroundLoading: false,
  selectedConversationIds: [],
  recentlyUpdatedUsers: new Set()
};

function conversationReducer(state, action) {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      return {
        ...state,
        conversations: action.payload,
        allConversations: action.payload
      };
    
    case 'SET_FILTERED':
      return {
        ...state,
        filteredConversations: action.payload
      };
    
    case 'UPDATE_MINING_STATUS':
      const newStatuses = { ...state.miningStatuses, ...action.payload };
      const updatedConvs = state.conversations.map(conv => ({
        ...conv,
        miningStatus: newStatuses[conv.raw_psid]?.status || conv.miningStatus
      }));
      
      return {
        ...state,
        miningStatuses: newStatuses,
        conversations: updatedConvs,
        allConversations: updatedConvs
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };
    
    case 'SET_BACKGROUND_LOADING':
      return {
        ...state,
        isBackgroundLoading: action.payload
      };
    
    case 'TOGGLE_SELECTION':
      const newSelection = state.selectedConversationIds.includes(action.payload)
        ? state.selectedConversationIds.filter(id => id !== action.payload)
        : [...state.selectedConversationIds, action.payload];
      return {
        ...state,
        selectedConversationIds: newSelection
      };
    
    case 'SELECT_ALL':
      return {
        ...state,
        selectedConversationIds: action.payload
      };
    
    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedConversationIds: []
      };
    
    case 'ADD_RECENTLY_UPDATED':
      return {
        ...state,
        recentlyUpdatedUsers: new Set([...state.recentlyUpdatedUsers, action.payload])
      };
    
    case 'BATCH_UPDATE':
      return {
        ...state,
        ...action.payload
      };
    
    default:
      return state;
  }
}

// =====================================================
// OPTIMIZED MAIN APP COMPONENT
// =====================================================
function App() {
  // =====================================================
  // SECTION 1: OPTIMIZED STATE MANAGEMENT
  // =====================================================
  
  // Use reducer for complex state
  const [state, dispatch] = useReducer(conversationReducer, initialState);
  
  // Simple states
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [defaultMessages, setDefaultMessages] = useState([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedMessageSetIds, setSelectedMessageSetIds] = useState([]);
  const [syncDateRange, setSyncDateRange] = useState(null);
  const [dateEntryFilter, setDateEntryFilter] = useState(null);
  const abortControllerRef = useRef(null);

  // Filter state - combined for fewer updates
  const [filters, setFilters] = useState({
    disappearTime: "",
    startDate: "",
    endDate: "",
    customerType: "",
    platformType: "",
    miningStatus: ""
  });
  
  // Time states - use ref when possible
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());
  
  // Mining limit states - persist in localStorage
  const [dailyMiningLimit, setDailyMiningLimit] = useState(() => {
    const saved = localStorage.getItem('dailyMiningLimit');
    return saved ? parseInt(saved) : 100;
  });
  
  const [todayMiningCount, setTodayMiningCount] = useState(() => {
    const savedData = localStorage.getItem('miningData');
    if (savedData) {
      const data = JSON.parse(savedData);
      const today = new Date().toDateString();
      if (data.date === today) {
        return data.count;
      }
    }
    return 0;
  });

  // =====================================================
  // SECTION 2: OPTIMIZED REFS
  // =====================================================
  
  const refs = useRef({
    inactivityUpdateTimer: null,
    clockInterval: null,
    messageCache: {},
    conversationCache: {},
    userInactivityData: {},
    updateQueue: [],
    isProcessing: false,
    lastEventId: null,
    lastPageId: null  // ✅ เพิ่มบรรทัดนี้
  }).current;
  
  const cacheTimeout = 5 * 60 * 1000;

  // =====================================================
  // SECTION 3: HEAVILY MEMOIZED VALUES
  // =====================================================
  
  // Memoize displayData dengan dependency ที่ถูกต้อง
  const displayData = useMemo(() => {
    if (dateEntryFilter || state.filteredConversations.length > 0) {
      return state.filteredConversations;
    }
    return state.conversations;
  }, [state.filteredConversations, state.conversations, dateEntryFilter]);

  const selectedPageInfo = useMemo(() => 
    pages.find(p => p.id === selectedPage),
    [pages, selectedPage]
  );

  const hasActiveFilters = useMemo(() => 
    Object.values(filters).some(v => v !== "") || dateEntryFilter !== null,
    [filters, dateEntryFilter]
  );

  const canMineMore = useMemo(() => 
    todayMiningCount < dailyMiningLimit,
    [todayMiningCount, dailyMiningLimit]
  );

  const remainingMines = useMemo(() => 
    Math.max(0, dailyMiningLimit - todayMiningCount),
    [dailyMiningLimit, todayMiningCount]
  );

  // =====================================================
  // SECTION 4: OPTIMIZED UTILITY FUNCTIONS
  // =====================================================
  
  const getCachedData = useCallback((key, useCache = true) => {
    if (!useCache) return null;
    const cached = refs.messageCache[key] || refs.conversationCache[key];
    if (cached && Date.now() - cached.timestamp < cacheTimeout) {
      return cached.data;
    }
    return null;
  }, [cacheTimeout, refs]);

  const setCachedData = useCallback((key, data, type = 'message') => {
    const cache = type === 'message' ? refs.messageCache : refs.conversationCache;
    cache[key] = {
      data,
      timestamp: Date.now()
    };
  }, [refs]);

  // =====================================================
  // SECTION 5: OPTIMIZED MINING FUNCTIONS
  // =====================================================
  
  const updateMiningCount = useCallback((count) => {
    const today = new Date().toDateString();
    setTodayMiningCount(prev => {
      const newCount = prev + count;
      localStorage.setItem('miningData', JSON.stringify({
        date: today,
        count: newCount
      }));
      return newCount;
    });
  }, []);

  const resetDailyCount = useCallback(() => {
    const today = new Date().toDateString();
    const savedData = localStorage.getItem('miningData');
    
    if (savedData) {
      const data = JSON.parse(savedData);
      if (data.date !== today) {
        setTodayMiningCount(0);
        localStorage.setItem('miningData', JSON.stringify({
          date: today,
          count: 0
        }));
      }
    }
  }, []);

  // =====================================================
  // SECTION 6: OPTIMIZED DATA LOADING
  // =====================================================
  
  const loadMessages = useCallback(async (pageId) => {
    const cached = getCachedData(`messages_${pageId}`);
    if (cached) {
      setDefaultMessages(cached);
      return cached;
    }

    try {
      const data = await getMessagesBySetId(pageId);
      const messages = Array.isArray(data) ? data : [];
      setDefaultMessages(messages);
      setCachedData(`messages_${pageId}`, messages, 'message');
      return messages;
    } catch (err) {
      console.error("โหลดข้อความล้มเหลว:", err);
      setDefaultMessages([]);
      return [];
    }
  }, [getCachedData, setCachedData]);

  const loadConversations = useCallback(async (pageId, forceRefresh = false, resetFilters = false, isBackground = false) => {
    if (!pageId) return;

    // Check cache
    if (!forceRefresh && !isBackground) {
      const cached = getCachedData(`conversations_${pageId}`, true);
      if (cached) {
        dispatch({ type: 'SET_CONVERSATIONS', payload: cached });
        return;
      }
    }

    dispatch({ type: isBackground ? 'SET_BACKGROUND_LOADING' : 'SET_LOADING', payload: true });

    try {
      const conversations = await fetchConversations(pageId);
      
      // Process mining statuses
      const newMiningStatuses = {};
      conversations.forEach(conv => {
        if (conv.raw_psid) {
          newMiningStatuses[conv.raw_psid] = {
            status: conv.miningStatus || 'ยังไม่ขุด',
            updatedAt: conv.miningStatusUpdatedAt
          };
        }
      });
      
      // Batch update using dispatch
      dispatch({
        type: 'BATCH_UPDATE',
        payload: {
          conversations,
          allConversations: conversations,
          miningStatuses: newMiningStatuses
        }
      });
      
      setLastUpdateTime(new Date());
      setCachedData(`conversations_${pageId}`, conversations, 'conversation');

      if (resetFilters) {
        setFilters({
          disappearTime: "",
          startDate: "",
          endDate: "",
          customerType: "",
          platformType: "",
          miningStatus: ""
        });
        dispatch({ type: 'SET_FILTERED', payload: [] });
        setDateEntryFilter(null);
      }
    } catch (err) {
      console.error("❌ เกิดข้อผิดพลาด:", err);
      if (!isBackground && err.response?.status === 400) {
        alert("กรุณาเชื่อมต่อ Facebook Page ก่อนใช้งาน");
      }
    } finally {
      dispatch({ type: isBackground ? 'SET_BACKGROUND_LOADING' : 'SET_LOADING', payload: false });
    }
  }, [getCachedData, setCachedData]);

  const handleloadConversations = useCallback(async (showSuccessNotification = false, resetFilters = false, isBackground = false) => {
    if (!selectedPage) {
      if (!isBackground) {
        showNotification('warning', 'กรุณาเลือกเพจก่อนรีเฟรช');
      }
      return;
    }

    if (!isBackground && disconnect) {
      disconnect();
    }

    try {
      await loadConversations(selectedPage, true, resetFilters, isBackground);
      
      if (!isBackground && reconnect) {
        setTimeout(() => reconnect(), 1000);
      }

      if (showSuccessNotification && !isBackground) {
        showNotification('success', 'รีเฟรชข้อมูลสำเร็จ', `โหลดข้อมูล ${state.conversations.length} รายการ`);
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
      if (!isBackground) {
        showNotification('error', 'รีเฟรชข้อมูลไม่สำเร็จ', error.message);
      }
    }
  }, [selectedPage, loadConversations, state.conversations.length]);

  const loadMiningStatuses = useCallback(async (pageId) => {
    try {
      const response = await fetch(`http://localhost:8000/mining-status/${pageId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.statuses) {
          dispatch({ type: 'UPDATE_MINING_STATUS', payload: data.statuses });
        }
      }
    } catch (error) {
      console.error('Error loading mining statuses:', error);
    }
  }, []);

  // =====================================================
  // SECTION 7: OPTIMIZED FILTER FUNCTIONS
  // =====================================================
  
  const applyFilters = useCallback(() => {
    // Use Web Worker or requestIdleCallback for heavy filtering
    requestIdleCallback(() => {
      let filtered = [...state.allConversations];
      const { disappearTime, customerType, platformType, miningStatus, startDate, endDate } = filters;

      // Optimize filter logic with early returns
      if (dateEntryFilter) {
        filtered = filtered.filter(conv => {
          const dateStr = conv.first_interaction_at || conv.created_time;
          if (!dateStr) return false;
          const date = new Date(dateStr).toISOString().split('T')[0];
          return date === dateEntryFilter;
        });
      }

      if (disappearTime) {
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        const timeMap = {
          '1d': dayInMs,
          '3d': 3 * dayInMs,
          '7d': 7 * dayInMs,
          '1m': 30 * dayInMs,
          '3m': 90 * dayInMs,
          '6m': 180 * dayInMs,
          '1y': 365 * dayInMs,
          'over1y': -365 * dayInMs
        };
        
        const threshold = timeMap[disappearTime];
        
        filtered = filtered.filter(conv => {
          const referenceTime = conv.last_user_message_time || conv.updated_time;
          if (!referenceTime) return false;
          const diff = now - new Date(referenceTime).getTime();
          return disappearTime === 'over1y' ? diff > -threshold : diff <= threshold;
        });
      }

      if (customerType) {
        const customerTypeMap = {
          newCM: "ทักแล้วหาย",
          intrestCM: "ทักแล้วคุย แต่ไม่ถามราคา",
          dealDoneCM: "ทักแล้วถามราคา แต่ไม่ซื้อ",
          exCM: "ทักแล้วซื้อ"
        };
        const targetType = customerTypeMap[customerType];
        filtered = filtered.filter(conv => conv.customer_type_knowledge_name === targetType);
      }

      if (platformType) {
        filtered = filtered.filter(conv => conv.platform === platformType);
      }

      if (miningStatus) {
        filtered = filtered.filter(conv => conv.miningStatus === miningStatus);
      }

      if (startDate || endDate) {
        filtered = filtered.filter(conv => {
          const convDate = conv.first_interaction_at?.split('T')[0];
          if (!convDate) return false;
          if (startDate && convDate < startDate) return false;
          if (endDate && convDate > endDate) return false;
          return true;
        });
      }

      dispatch({ type: 'SET_FILTERED', payload: filtered });
    });
  }, [state.allConversations, filters, dateEntryFilter]);

  // =====================================================
  // SECTION 9: NOTIFICATION FUNCTIONS
  // =====================================================
  
  const showNotification = useCallback((type, message, detail = '') => {
    const notification = document.createElement('div');
    notification.className = `${type}-notification`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      send: '🚀',
      info: 'ℹ️'
    };
    
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${icons[type]}</span>
        <div class="notification-text">
          <strong>${message}</strong>
          ${detail ? `<span>${detail}</span>` : ''}
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    if (type !== 'send') {
      setTimeout(() => notification.remove(), 3000);
    }
  }, []);

  const removeNotification = useCallback(() => {
    const notifications = document.querySelectorAll('.send-notification');
    notifications.forEach(n => n.remove());
  }, []);

  // =====================================================
  // SECTION 8: OPTIMIZED MESSAGE FUNCTIONS
  // =====================================================
  
  const sendMessagesBySelectedSets = useCallback(async (messageSetIds, frequencySettings = null) => {
  if (!Array.isArray(messageSetIds) || state.selectedConversationIds.length === 0) {
    return;
  }

  const selectedCount = state.selectedConversationIds.length;
  
  if (remainingMines === 0) {
    showNotification('error', 'ถึงขีดจำกัดประจำวันแล้ว', `คุณได้ขุดครบ ${dailyMiningLimit} ครั้งแล้ววันนี้`);
    return;
  }
  
  if (selectedCount > remainingMines) {
    showNotification('warning', 'เกินขีดจำกัด', `คุณสามารถขุดได้อีก ${remainingMines} ครั้งเท่านั้นในวันนี้`);
    return;
  }

  // ✅ สร้าง AbortController ใหม่
  abortControllerRef.current = new AbortController();
  const signal = abortControllerRef.current.signal;

  // ✅ เคลียร์ selection ทันที
  dispatch({ type: 'CLEAR_SELECTION' });

  // ✅ ใช้ความถี่จากการตั้งค่า หรือใช้ค่าเริ่มต้น
  const batchSize = frequencySettings?.batchSize || 20;
  const delayMinutes = frequencySettings?.delayMinutes || 60;
  const delayMs = delayMinutes * 60 * 1000;

  // ✅ ประกาศตัวแปรนอก try-catch เพื่อใช้ใน catch block
  let successCount = 0;
  let failCount = 0;
  const successfulPsids = [];

  try {
    const totalBatches = Math.ceil(selectedCount / batchSize);
    const batches = [];
    
    const conversationIdsToProcess = [...state.selectedConversationIds];
    
    for (let i = 0; i < conversationIdsToProcess.length; i += batchSize) {
      batches.push(conversationIdsToProcess.slice(i, i + batchSize));
    }

    console.log(`🚀 เริ่มขุด ${selectedCount} คน แบ่งเป็น ${totalBatches} รอบ`);
    console.log(`⏱️ แต่ละรอบ ${batchSize} คน หน่วงเวลา ${delayMinutes} นาที`);

    const miningState = {
      totalBatches,
      currentBatch: 0,
      successCount: 0,
      failCount: 0,
      batchSize,
      delayMinutes,
      lastBatchCompletedAt: null,
      startTime: Date.now(),
      pageId: selectedPage,
      messageSetIds,
      isActive: true // ✅ เพิ่ม flag
    };
    localStorage.setItem('miningProgress', JSON.stringify(miningState));

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      // ✅ เช็คว่าถูกยกเลิกหรือไม่
      if (signal.aborted) {
        console.log('❌ การขุดถูกยกเลิก');
        throw new Error('MINING_CANCELLED');
      }

      const currentBatch = batches[batchIndex];
      
      // อัพเดท localStorage
      miningState.currentBatch = batchIndex + 1;
      miningState.successCount = successCount;
      miningState.failCount = failCount;
      miningState.lastBatchCompletedAt = Date.now(); 
      localStorage.setItem('miningProgress', JSON.stringify(miningState));

      console.log(`\n📦 รอบที่ ${batchIndex + 1}/${totalBatches} - ส่งไปยัง ${currentBatch.length} คน`);

      for (const conversationId of currentBatch) {
        // ✅ เช็คการยกเลิกในแต่ละคน
        if (signal.aborted) {
          console.log('❌ การขุดถูกยกเลิกระหว่างส่งข้อความ');
          throw new Error('MINING_CANCELLED');
        }

        const selectedConv = displayData.find(conv => conv.conversation_id === conversationId);
        const psid = selectedConv?.raw_psid;

        if (!psid) {
          failCount++;
          continue;
        }

        try {
          for (const setId of messageSetIds) {
            if (signal.aborted) throw new Error('MINING_CANCELLED');

            const response = await fetch(`http://localhost:8000/custom_messages/${setId}`);
            if (!response.ok) continue;
            
            const messages = await response.json();
            const sortedMessages = messages.sort((a, b) => a.display_order - b.display_order);

            for (const messageObj of sortedMessages) {
              if (signal.aborted) throw new Error('MINING_CANCELLED');

              let messageContent = messageObj.content;

              if (messageObj.message_type === "image") {
                messageContent = `http://localhost:8000/images/${messageContent.replace('[IMAGE] ', '')}`;
              } else if (messageObj.message_type === "video") {
                messageContent = `http://localhost:8000/videos/${messageContent.replace('[VIDEO] ', '')}`;
              }

              await fetch(`http://localhost:8000/send/${selectedPage}/${psid}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  message: messageContent,
                  type: messageObj.message_type,
                  is_system_message: true
                }),
              });

              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          successCount++;
          successfulPsids.push(psid);
          
        } catch (err) {
          if (err.message === 'MINING_CANCELLED') throw err;
          console.error(`❌ ส่งข้อความไม่สำเร็จสำหรับ ${conversationId}:`, err);
          failCount++;
        }
      }

      miningState.successCount = successCount;
      miningState.failCount = failCount;
      localStorage.setItem('miningProgress', JSON.stringify(miningState));

      // ✅ หน่วงเวลาพร้อมเช็คการยกเลิก
      if (batchIndex < batches.length - 1) {
        console.log(`⏳ หน่วงเวลา ${delayMinutes} นาทีก่อนรอบถัดไป...`);
        
        const checkInterval = 1000;
        const totalChecks = Math.ceil(delayMs / checkInterval);
        
        for (let i = 0; i < totalChecks; i++) {
          if (signal.aborted) {
            console.log('❌ การขุดถูกยกเลิกระหว่างหน่วงเวลา');
            throw new Error('MINING_CANCELLED');
          }
          await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
      }
    }

    // อัพเดทสถานะการขุด
    if (successfulPsids.length > 0) {
      const updateResponse = await fetch(`http://localhost:8000/mining-status/update/${selectedPage}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_psids: successfulPsids,
          status: "ขุดแล้ว",
          note: `Mined with message sets: ${messageSetIds.join(', ')}`
        })
      });

      if (updateResponse.ok) {
        const updatedStatuses = {};
        successfulPsids.forEach(psid => {
          updatedStatuses[psid] = {
            status: 'ขุดแล้ว',
            note: `Mined at ${new Date().toISOString()}`,
            created_at: new Date().toISOString()
          };
        });
        
        dispatch({ type: 'UPDATE_MINING_STATUS', payload: updatedStatuses });
      }
    }

    localStorage.removeItem('miningProgress');

    if (successCount > 0) {   
      updateMiningCount(successCount);
      showNotification('success', ` ส่งข้อความสำเร็จ ${successCount} คน`);
    }
    if (failCount > 0) {
      showNotification('warning', `⚠️ ส่งข้อความไม่สำเร็จ ${failCount} คน`);
    }
    
  } catch (error) {
    if (error.message === 'MINING_CANCELLED') {
      // ✅ ใช้ตัวแปรที่ประกาศไว้ข้างนอก
      showNotification('warning', ' ยกเลิกการขุด', 
       );
    } else {
      console.error("เกิดข้อผิดพลาดในการส่งข้อความ:", error);
      showNotification('error', 'เกิดข้อผิดพลาด', error.message);
    }
    
    localStorage.removeItem('miningProgress');
  } finally {
    // ✅ ล้าง AbortController
    abortControllerRef.current = null;
  }
}, [state.selectedConversationIds, selectedPage, displayData, remainingMines, dailyMiningLimit, 
    todayMiningCount, updateMiningCount, dispatch, showNotification]);

  // ✅ เพิ่มฟังก์ชันยกเลิกการขุด
  const handleCancelMining = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      showNotification('info', '⚠️ กำลังยกเลิกการขุด...', 'กรุณารอสักครู่');
    }
  }, [showNotification]);

  // =====================================================
  // SECTION 10: OPTIMIZED CALLBACK FUNCTIONS
  // =====================================================

  const handleSyncComplete = useCallback((dateRange) => {
    setSyncDateRange(dateRange);
    loadConversations(selectedPage);
  }, [selectedPage, loadConversations]);

  const handleSelectUsers = useCallback((conversationIds) => {
    dispatch({ type: 'SELECT_ALL', payload: conversationIds });
  }, []);

  const handleClearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  const handleToggleFilter = useCallback(() => {
    setShowFilter(prev => !prev);
  }, []);

  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const handleClearFilters = useCallback(() => {
    dispatch({ type: 'SET_FILTERED', payload: [] });
    setFilters({
      disappearTime: "",
      startDate: "",
      endDate: "",
      customerType: "",
      platformType: "",
      miningStatus: ""
    });
    setDateEntryFilter(null);
  }, []);

  const handleToggleAll = useCallback((checked) => {
    if (checked) {
      dispatch({ type: 'SELECT_ALL', payload: displayData.map(conv => conv.conversation_id) });
    } else {
      dispatch({ type: 'CLEAR_SELECTION' });
    }
  }, [displayData]);

  const handleRefresh = useCallback(() => {
    handleloadConversations(true, true);
  }, [handleloadConversations]);

  const handleLimitChange = useCallback((newLimit) => {
    setDailyMiningLimit(newLimit);
    localStorage.setItem('dailyMiningLimit', newLimit.toString());
  }, []);

  const handleOpenPopup = useCallback(() => {
    setIsPopupOpen(true);
  }, []);

  const handleClosePopup = useCallback(() => {
    setIsPopupOpen(false);
  }, []);

  const handleConfirmPopup = useCallback((checkedSetIds, frequencySettings) => {
    setSelectedMessageSetIds(checkedSetIds);
    setIsPopupOpen(false);
    sendMessagesBySelectedSets(checkedSetIds, frequencySettings);
  }, [sendMessagesBySelectedSets]);

  const handleClearDateFilter = useCallback(() => {
    setSyncDateRange(null);
    loadConversations(selectedPage);
  }, [selectedPage, loadConversations]);

  const handleDateEntryFilterChange = useCallback((date) => {
    setDateEntryFilter(date);
    if (date === null) {
      dispatch({ type: 'SET_FILTERED', payload: [] });
    }
  }, []);

  const toggleCheckbox = useCallback((conversationId) => {
    dispatch({ type: 'TOGGLE_SELECTION', payload: conversationId });
  }, []);

  const handleInactivityChange = useCallback((userId, minutes) => {
    refs.userInactivityData[userId] = {
      minutes,
      updatedAt: new Date()
    };
  }, [refs]);

  const handleAddUsersFromFile = useCallback((usersFromDatabase) => {
    requestIdleCallback(() => {
      const existingIds = new Set(state.conversations.map(c => c.conversation_id));
      const newUsers = usersFromDatabase.filter(u => !existingIds.has(u.conversation_id));
      
      if (newUsers.length > 0) {
        const combined = [...state.conversations, ...newUsers];
        combined.sort((a, b) => {
          const timeA = new Date(a.last_user_message_time || 0);
          const timeB = new Date(b.last_user_message_time || 0);
          return timeB - timeA;
        });
        
        dispatch({ type: 'SET_CONVERSATIONS', payload: combined });
      }
    });
  }, [state.conversations]);

  // =====================================================
  // SECTION 11: OPTIMIZED REALTIME UPDATE HANDLER
  // =====================================================
  
  const handleRealtimeUpdate = useCallback((pageId, updates) => {
    if (!Array.isArray(updates) || updates.length === 0) return;
    
    // ✅ อัปเดตเฉพาะเพจที่ตรงกับข้อมูล
    // ถ้าไม่ใช่เพจที่เลือก → อัปเดต background data
    const isCurrentPage = pageId === selectedPage;
    
    // Avoid duplicate updates
    const eventId = updates[0]?.id || updates[0]?.timestamp;
    const cacheKey = `${pageId}_${eventId}`;
    if (eventId === refs.lastEventId && pageId === refs.lastPageId) return;
    refs.lastEventId = eventId;
    refs.lastPageId = pageId;
    
    // Batch process updates
    requestIdleCallback(() => {
      const miningUpdates = {};
      const updatedUsers = [];
      
      updates.forEach(update => {
        if (update.mining_status || update.action === 'mining_status_update') {
          miningUpdates[update.psid] = {
            status: update.mining_status || 'ยังไม่ขุด',
            updatedAt: update.timestamp || new Date().toISOString()
          };
          
          if (update.mining_status === 'มีการตอบกลับ') {
            updatedUsers.push(update.psid);
            
            // แสดง notification เฉพาะเพจที่เลือก
            if (isCurrentPage) {
              showNotification('info', 'สถานะอัพเดท', 
                `ลูกค้า ${update.name || update.psid?.slice(-8) || ''} มีการตอบกลับ`);
            }
          }
        }
      });
      
      // ✅ อัปเดต state เฉพาะเพจที่ถูกต้อง
      if (Object.keys(miningUpdates).length > 0 && isCurrentPage) {
        dispatch({ type: 'UPDATE_MINING_STATUS', payload: miningUpdates });
      }
      
      updatedUsers.forEach(psid => {
        dispatch({ type: 'ADD_RECENTLY_UPDATED', payload: psid });
      });
    });
  }, [showNotification, refs, selectedPage]);

  // =====================================================
  // SECTION 12: INACTIVITY BATCH UPDATE
  // =====================================================
  
  const sendInactivityBatch = useCallback(async () => {
    if (!selectedPage || displayData.length === 0) return;
    
    try {
      const userData = displayData.map(conv => {
        const inactivityInfo = refs.userInactivityData[conv.raw_psid] || {};
        return {
          user_id: conv.raw_psid,
          conversation_id: conv.conversation_id,
          last_message_time: conv.last_user_message_time || conv.updated_time,
          inactivity_minutes: inactivityInfo.minutes || 0
        };
      });
      
      const response = await fetch(`http://localhost:8000/update-user-inactivity/${selectedPage}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ users: userData })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update inactivity data');
      }
      
      const result = await response.json();
      console.log('✅ Batch update inactivity data:', result);

    } catch (error) {
      console.error('❌ Error sending inactivity batch:', error);
    }
  }, [selectedPage, displayData, refs]);

  // =====================================================
  // SECTION 13: OPTIMIZED RENDER CALLBACK
  // =====================================================
  
  const renderConversationRow = useCallback((conv, idx, isSelected, onToggleCheckbox, onInactivityChange) => (
    <ConversationRow
      key={conv.conversation_id}
      conv={conv}
      idx={idx}
      isSelected={isSelected}
      onToggleCheckbox={onToggleCheckbox}
      onInactivityChange={onInactivityChange}
      isRecentlyUpdated={state.recentlyUpdatedUsers.has(conv.raw_psid)}
    />
  ), [state.recentlyUpdatedUsers]);

  // =====================================================
  // SECTION 14: REALTIME UPDATES HOOK
  // =====================================================
  
  const { disconnect, reconnect } = useRealtimeUpdates(
    pages,              // ✅ ส่ง pages ทั้งหมด
    selectedPage,       // ✅ ส่ง selectedPage เพื่อใช้ในการแสดง notification
    handleRealtimeUpdate // ✅ callback รับ pageId ด้วย
  );

  // =====================================================
  // SECTION 15: OPTIMIZED EFFECTS
  // =====================================================
  
  // Background refresh with longer interval
  useEffect(() => {
    if (!selectedPage) return;

    let refreshTimeout;
    let isMounted = true; // ✅ เพิ่ม flag เช็คว่า component ยัง mount อยู่

    const backgroundRefresh = async () => {
      // ✅ เช็คว่า component ยัง mount และ selectedPage ยังคงเป็นเพจเดิม
      if (!isMounted || !state.loading && !state.isBackgroundLoading) {
        // ✅ เช็ค selectedPage อีกครั้งก่อน sync
        const currentPage = localStorage.getItem("selectedPage");
        
        if (currentPage !== selectedPage) {
          console.warn(`⚠️ Page changed during background refresh. Skipping sync.`);
          return;
        }

        await handleloadConversations(false, false, true);
        await loadMiningStatuses(selectedPage);
      }
      
      // ✅ เช็คอีกครั้งก่อนตั้ง timeout ใหม่
      if (isMounted) {
        refreshTimeout = setTimeout(backgroundRefresh, 60000);
      }
    };

    // เริ่ม background refresh
    refreshTimeout = setTimeout(backgroundRefresh, 60000);

    return () => {
      isMounted = false; // ✅ ตั้ง flag เมื่อ unmount
      if (refreshTimeout) clearTimeout(refreshTimeout);
    };
  }, [selectedPage, state.loading, state.isBackgroundLoading, handleloadConversations, loadMiningStatuses]);

  // Apply filters with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (dateEntryFilter !== null || hasActiveFilters) {
        applyFilters();
      } else {
        dispatch({ type: 'SET_FILTERED', payload: [] });
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [dateEntryFilter, hasActiveFilters, applyFilters]);

  // Reset daily count - check less frequently
  useEffect(() => {
    resetDailyCount();
    const checkMidnight = setInterval(() => {
      resetDailyCount();
    }, 60000); // Check every minute

    return () => clearInterval(checkMidnight);
  }, [resetDailyCount]);

  // Initial setup
  useEffect(() => {
    const handlePageChange = (event) => {
      const newPageId = event.detail.pageId;
      setSelectedPage(newPageId);
    };

    window.addEventListener('pageChanged', handlePageChange);
    
    const savedPage = localStorage.getItem("selectedPage");
    if (savedPage) {
      setSelectedPage(savedPage);
    }

    fetchPages()
      .then(setPages)
      .catch(err => console.error("ไม่สามารถโหลดเพจได้:", err));

    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      window.removeEventListener('pageChanged', handlePageChange);
    };
  }, []);

  // Load data when page changes
  useEffect(() => {
    if (selectedPage) {
      // Clear states
      setDateEntryFilter(null);
      dispatch({ type: 'SET_FILTERED', payload: [] });
      setSyncDateRange(null);
      dispatch({ type: 'CLEAR_SELECTION' });
      setSelectedMessageSetIds([]);
      
      // Load data with cache check
      Promise.all([
        loadMessages(selectedPage),
        loadConversations(selectedPage),
        loadMiningStatuses(selectedPage)
      ]).catch(err => console.error("Error loading data:", err));
    } else {
      setDefaultMessages([]);
      dispatch({ type: 'SET_CONVERSATIONS', payload: [] });
      setDateEntryFilter(null);
      dispatch({ type: 'SET_FILTERED', payload: [] });
      setSyncDateRange(null);
      dispatch({ type: 'CLEAR_SELECTION' });
      setSelectedMessageSetIds([]);
      dispatch({ type: 'UPDATE_MINING_STATUS', payload: {} });
    }
  }, [selectedPage, loadMessages, loadConversations, loadMiningStatuses]);

  // Optimized clock update - update every 5 seconds instead of 1
  useEffect(() => {
    const updateClock = () => setCurrentTime(new Date());
    updateClock();
    refs.clockInterval = setInterval(updateClock, 5000);

    return () => {
      if (refs.clockInterval) clearInterval(refs.clockInterval);
    };
  }, [refs]);

  // Inactivity batch update - less frequent
  useEffect(() => {
    if (refs.inactivityUpdateTimer) {
      clearInterval(refs.inactivityUpdateTimer);
    }
    
    sendInactivityBatch();
    
    refs.inactivityUpdateTimer = setInterval(() => {
      sendInactivityBatch();
    }, 120000); // Update every 2 minutes
    
    return () => {
      if (refs.inactivityUpdateTimer) {
        clearInterval(refs.inactivityUpdateTimer);
      }
    };
  }, [sendInactivityBatch, refs]);

  // =====================================================
  // SECTION 16: OPTIMIZED RENDER
  // =====================================================
  
  return (
    <div className="app-container">
      <Sidebar />

      <main className="main-dashboard">
        <HeroSection />
        
        <CustomerStatistics selectedPage={selectedPage} />
        
        <ConnectionStatusBar
          selectedPage={selectedPage}
          selectedPageInfo={selectedPageInfo}
          lastUpdateTime={lastUpdateTime}
          currentTime={currentTime}
          onSyncComplete={handleSyncComplete}
          syncDateRange={syncDateRange}
          onClearDateFilter={handleClearDateFilter}
          conversations={state.allConversations}
          onDateEntryFilterChange={handleDateEntryFilterChange}
          currentDateEntryFilter={dateEntryFilter}
          isBackgroundLoading={state.isBackgroundLoading}
        />
        
        <FileUploadSection 
          displayData={displayData}
          selectedPage={selectedPage}
          onSelectUsers={handleSelectUsers}
          onClearSelection={handleClearSelection}
          onAddUsersFromFile={handleAddUsersFromFile}
        />
        
        <FilterSection
          showFilter={showFilter}
          onToggleFilter={handleToggleFilter}
          filters={filters}
          onFilterChange={handleFilterChange}
          onApplyFilters={applyFilters}
          onClearFilters={handleClearFilters}
        />
        
        <AlertMessages
          selectedPage={selectedPage}
          conversationsLength={state.conversations.length}
          loading={state.loading}
          filteredLength={state.filteredConversations.length}
          allLength={state.allConversations.length}
        />

        <div className="content-area">
          {state.loading ? (
            <LoadingState />
          ) : displayData.length === 0 ? (
            <EmptyState selectedPage={selectedPage} />
          ) : (
            <ConversationTable
              displayData={displayData}
              selectedConversationIds={state.selectedConversationIds}
              onToggleCheckbox={toggleCheckbox}
              onToggleAll={handleToggleAll}
              onInactivityChange={handleInactivityChange}
              renderRow={renderConversationRow}
            />
          )}
        </div>

        <ActionBar
          selectedCount={state.selectedConversationIds.length}
          totalCount={displayData.length}
          loading={state.loading}
          selectedPage={selectedPage}
          onOpenPopup={handleOpenPopup}
          onRefresh={handleRefresh}
          canMineMore={canMineMore}
          remainingMines={remainingMines}
          forceShow={state.selectedConversationIds.length > 0}
        />

        {isPopupOpen && (
          <Popup
            selectedPage={selectedPage}
            onClose={handleClosePopup}
            defaultMessages={defaultMessages}
            onConfirm={handleConfirmPopup}
            count={state.selectedConversationIds.length}
            remainingMines={remainingMines}
            currentMiningCount={todayMiningCount}
            dailyMiningLimit={dailyMiningLimit}
            onLimitChange={handleLimitChange}
          />
        )}

         {/* ✅ Mini Progress Bar  */}
        <MiniProgressBar />

        <MiniProgressBar onCancel={handleCancelMining} />
      </main>
    </div>
  );
}

export default React.memo(App);