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

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

// =====================================================
// MAIN APP COMPONENT WITH OPTIMIZATIONS
// =====================================================
function App() {
  // =====================================================
  // SECTION 1: STATE MANAGEMENT - ใช้ useReducer สำหรับ state ที่ซับซ้อน
  // =====================================================
  
  // Core States
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [conversations, setConversations] = useState([]);
  const [allConversations, setAllConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [miningStatuses, setMiningStatuses] = useState({});

  // Loading & UI States
  const [loading, setLoading] = useState(false);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  
  // Filter States - ใช้ useReducer เพื่อลด re-render
  const [filters, setFilters] = useState({
    disappearTime: "",
    startDate: "",
    endDate: "",
    customerType: "",
    platformType: "",
    miningStatus: ""
  });
  const [dateEntryFilter, setDateEntryFilter] = useState(null);
  const [syncDateRange, setSyncDateRange] = useState(null);
  
  // Selection States
  const [selectedConversationIds, setSelectedConversationIds] = useState([]);
  const [selectedMessageSetIds, setSelectedMessageSetIds] = useState([]);
  const [defaultMessages, setDefaultMessages] = useState([]);
  
  // Time & Update States - ใช้ ref สำหรับค่าที่ไม่ต้อง trigger render
  const [currentTime, setCurrentTime] = useState(new Date());
  const lastUpdateTimeRef = useRef(new Date());
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());
  const pendingUpdatesRef = useRef([]);
  const [recentlyUpdatedUsers, setRecentlyUpdatedUsers] = useState(new Set());
  
  // Inactivity States
  const userInactivityDataRef = useRef({});
  
  // Mining Limit States
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
  // SECTION 2: REFS MANAGEMENT
  // =====================================================
  
  const inactivityUpdateTimerRef = useRef(null);
  const clockIntervalRef = useRef(null);
  const messageCache = useRef({});
  const conversationCache = useRef({});
  const cacheTimeout = 5 * 60 * 1000;
  const updateQueueRef = useRef([]);
  const isProcessingRef = useRef(false);

  // =====================================================
  // SECTION 3: MEMOIZED VALUES - เพิ่ม memoization
  // =====================================================
  
  // Memoize displayData เพื่อลด re-render
  const displayData = useMemo(() => {
    const hasFilters = filteredConversations.length > 0 || dateEntryFilter;
    return hasFilters ? filteredConversations : conversations;
  }, [filteredConversations, conversations, dateEntryFilter]);

  // Memoize selectedPageInfo
  const selectedPageInfo = useMemo(() => 
    pages.find(p => p.id === selectedPage),
    [pages, selectedPage]
  );

  // Memoize filter check
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(v => v !== "") || dateEntryFilter !== null;
  }, [filters, dateEntryFilter]);

  // =====================================================
  // SECTION 4: OPTIMIZED UTILITY FUNCTIONS
  // =====================================================
  
  const getCachedData = useCallback((key, cache) => {
    const cached = cache.current[key];
    if (cached && Date.now() - cached.timestamp < cacheTimeout) {
      return cached.data;
    }
    return null;
  }, [cacheTimeout]);

  const setCachedData = useCallback((key, data, cache) => {
    cache.current[key] = {
      data,
      timestamp: Date.now()
    };
  }, []);

  const calculateInactivityMinutes = useCallback((lastMessageTime, updatedTime) => {
    const referenceTime = lastMessageTime || updatedTime;
    if (!referenceTime) return 0;
    
    const past = new Date(referenceTime);
    const now = new Date();
    const diffMs = now.getTime() - past.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    return diffMinutes > 0 ? diffMinutes : 0;
  }, []);

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

  const canMineMore = useCallback(() => {
    return todayMiningCount < dailyMiningLimit;
  }, [todayMiningCount, dailyMiningLimit]);

  const getRemainingMines = useCallback(() => {
    return Math.max(0, dailyMiningLimit - todayMiningCount);
  }, [dailyMiningLimit, todayMiningCount]);

  // =====================================================
  // SECTION 6: OPTIMIZED DATA LOADING
  // =====================================================
  
  const loadMessages = useCallback(async (pageId) => {
    const cached = getCachedData(`messages_${pageId}`, messageCache);
    if (cached) {
      setDefaultMessages(cached);
      return cached;
    }

    try {
      const data = await getMessagesBySetId(pageId);
      const messages = Array.isArray(data) ? data : [];
      setDefaultMessages(messages);
      setCachedData(`messages_${pageId}`, messages, messageCache);
      return messages;
    } catch (err) {
      console.error("โหลดข้อความล้มเหลว:", err);
      setDefaultMessages([]);
      return [];
    }
  }, [getCachedData, setCachedData]);

  // ใช้ requestAnimationFrame และ batch updates
  const loadConversations = useCallback(async (pageId, forceRefresh = false, resetFilters = false, isBackground = false) => {
    if (!pageId) return;

    // Check cache first
    if (!forceRefresh && !isBackground) {
      const cached = getCachedData(`conversations_${pageId}`, conversationCache);
      if (cached) {
        setConversations(cached);
        setAllConversations(cached);
        return;
      }
    }

    if (!isBackground) {
      setLoading(true);
    } else {
      setIsBackgroundLoading(true);
    }

    try {
      const conversations = await fetchConversations(pageId);
      
      // Batch state updates
      requestAnimationFrame(() => {
        const newMiningStatuses = {};
        conversations.forEach(conv => {
          if (conv.raw_psid) {
            newMiningStatuses[conv.raw_psid] = {
              status: conv.miningStatus || 'ยังไม่ขุด',
              updatedAt: conv.miningStatusUpdatedAt
            };
          }
        });
        
        // Batch all state updates
        setMiningStatuses(newMiningStatuses);
        setConversations(conversations);
        setAllConversations(conversations);
        lastUpdateTimeRef.current = new Date();
        setLastUpdateTime(new Date());
        
        // Update cache
        setCachedData(`conversations_${pageId}`, conversations, conversationCache);
      });

      if (resetFilters) {
        setFilters({
          disappearTime: "",
          startDate: "",
          endDate: "",
          customerType: "",
          platformType: "",
          miningStatus: ""
        });
        setFilteredConversations([]);
        setDateEntryFilter(null);
      }
    } catch (err) {
      console.error("❌ เกิดข้อผิดพลาด:", err);
      if (!isBackground && err.response?.status === 400) {
        alert("กรุณาเชื่อมต่อ Facebook Page ก่อนใช้งาน");
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      } else {
        setIsBackgroundLoading(false);
      }
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
        showNotification('success', 'รีเฟรชข้อมูลสำเร็จ', `โหลดข้อมูล ${conversations.length} รายการ`);
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
      if (!isBackground) {
        showNotification('error', 'รีเฟรชข้อมูลไม่สำเร็จ', error.message);
      }
    }
  }, [selectedPage, loadConversations, conversations.length]);

  const loadMiningStatuses = useCallback(async (pageId) => {
  try {
    const response = await fetch(`http://localhost:8000/mining-status/${pageId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.statuses) {
        setMiningStatuses(data.statuses);
        
        // Batch update conversations ด้วยสถานะใหม่
        requestAnimationFrame(() => {
          setConversations(prevConvs => 
            prevConvs.map(conv => ({
              ...conv,
              miningStatus: data.statuses[conv.raw_psid]?.status || 'ยังไม่ขุด',
              miningStatusUpdatedAt: data.statuses[conv.raw_psid]?.created_at
            }))
          );
          
          setAllConversations(prevAll =>
            prevAll.map(conv => ({
              ...conv,
              miningStatus: data.statuses[conv.raw_psid]?.status || 'ยังไม่ขุด',
              miningStatusUpdatedAt: data.statuses[conv.raw_psid]?.created_at
            }))
          );
        });
        
        console.log('✅ Loaded mining statuses:', data.statuses);
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
    requestAnimationFrame(() => {
      let filtered = [...allConversations];
      const { disappearTime, customerType, platformType, miningStatus, startDate, endDate } = filters;

      // Apply all filters
      if (dateEntryFilter) {
        filtered = filtered.filter(conv => {
          const dateStr = conv.first_interaction_at || conv.created_time;
          if (!dateStr) return false;
          const date = new Date(dateStr).toISOString().split('T')[0];
          return date === dateEntryFilter;
        });
      }

      if (disappearTime) {
        const now = new Date();
        filtered = filtered.filter(conv => {
          const referenceTime = conv.last_user_message_time || conv.updated_time;
          if (!referenceTime) return false;

          const updated = new Date(referenceTime);
          const diffDays = (now - updated) / (1000 * 60 * 60 * 24);

          switch (disappearTime) {
            case '1d': return diffDays <= 1;
            case '3d': return diffDays <= 3;
            case '7d': return diffDays <= 7;
            case '1m': return diffDays <= 30;
            case '3m': return diffDays <= 90;
            case '6m': return diffDays <= 180;
            case '1y': return diffDays <= 365;
            case 'over1y': return diffDays > 365;
            default: return true;
          }
        });
      }

      if (customerType) {
        const customerTypeMap = {
          newCM: "ทักแล้วหาย",
          intrestCM: "ทักแล้วคุย แต่ไม่ถามราคา",
          dealDoneCM: "ทักแล้วถามราคา แต่ไม่ซื้อ",
          exCM: "ทักแล้วซื้อ"
        };

        filtered = filtered.filter(
          conv => conv.customer_type_knowledge_name === customerTypeMap[customerType]
        );
      }

      if (platformType) {
        filtered = filtered.filter(conv => conv.platform === platformType);
      }

      if (miningStatus) {
        filtered = filtered.filter(conv => conv.miningStatus === miningStatus);
      }

      const toDateOnly = (dateStr) => {
        if (!dateStr) return null;
        return new Date(dateStr).toISOString().split("T")[0];
      };

      if (startDate) {
        filtered = filtered.filter(conv => {
          const convDate = toDateOnly(conv.first_interaction_at);
          return convDate && convDate >= startDate;
        });
      }

      if (endDate) {
        filtered = filtered.filter(conv => {
          const convDate = toDateOnly(conv.first_interaction_at);
          return convDate && convDate <= endDate;
        });
      }

      setFilteredConversations(filtered);
    });
  }, [allConversations, filters, dateEntryFilter]);

  const handleClearDateFilter = useCallback(() => {
    setSyncDateRange(null);
    loadConversations(selectedPage);
  }, [selectedPage, loadConversations]);

  const handleDateEntryFilterChange = useCallback((date) => {
    setDateEntryFilter(date);
    if (date === null) {
      setFilteredConversations([]);
    }
  }, []);

  // =====================================================
  // SECTION 8: OPTIMIZED MESSAGE FUNCTIONS
  // =====================================================
  
  // ใช้ useCallback เพื่อลดการสร้างฟังก์ชันซ้ำๆ
  const sendMessagesBySelectedSets = useCallback(async (messageSetIds) => {
    if (!Array.isArray(messageSetIds) || selectedConversationIds.length === 0) {
      return;
    }

    const selectedCount = selectedConversationIds.length;
    const remaining = getRemainingMines();
    
    if (remaining === 0) {
      showNotification('error', 'ถึงขีดจำกัดประจำวันแล้ว', `คุณได้ขุดครบ ${dailyMiningLimit} ครั้งแล้ววันนี้`);
      return;
    }
    
    if (selectedCount > remaining) {
      showNotification('warning', 'เกินขีดจำกัด', `คุณสามารถขุดได้อีก ${remaining} ครั้งเท่านั้นในวันนี้`);
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;
      const successfulPsids = [];

      showNotification('send', 'กำลังส่งข้อความ...', `ส่งไปยัง ${selectedConversationIds.length} การสนทนา`);

      for (const conversationId of selectedConversationIds) {
        const selectedConv = displayData.find(conv => conv.conversation_id === conversationId);
        const psid = selectedConv?.raw_psid;

        if (!psid) {
          failCount++;
          continue;
        }

        try {
          for (const setId of messageSetIds) {
            const response = await fetch(`http://localhost:8000/custom_messages/${setId}`);
            if (!response.ok) continue;
            
            const messages = await response.json();
            const sortedMessages = messages.sort((a, b) => a.display_order - b.display_order);

            for (const messageObj of sortedMessages) {
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
          console.error(`ส่งข้อความไม่สำเร็จสำหรับ ${conversationId}:`, err);
          failCount++;
        }
      }

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
          // Batch update
          requestAnimationFrame(() => {
            setConversations(prevConvs =>
              prevConvs.map(conv => ({
                ...conv,
                miningStatus: successfulPsids.includes(conv.raw_psid) 
                  ? 'ขุดแล้ว' 
                  : conv.miningStatus
              }))
            );

            setAllConversations(prevAll =>
              prevAll.map(conv => ({
                ...conv,
                miningStatus: successfulPsids.includes(conv.raw_psid) 
                  ? 'ขุดแล้ว' 
                  : conv.miningStatus
              }))
            );

            setMiningStatuses(prev => {
              const updated = { ...prev };
              successfulPsids.forEach(psid => {
                updated[psid] = {
                  status: 'ขุดแล้ว',
                  note: `Mined at ${new Date().toISOString()}`,
                  created_at: new Date().toISOString()
                };
              });
              return updated;
            });
          });
        }
      }

      removeNotification();

      if (successCount > 0) {   
        updateMiningCount(successCount);
        showNotification('success', `ส่งข้อความและอัพเดทสถานะสำเร็จ ${successCount} การสนทนา`, 
          `ขุดไปแล้ว ${todayMiningCount + successCount}/${dailyMiningLimit} ครั้งวันนี้`);
        setSelectedConversationIds([]);
      } else {
        showNotification('error', `ส่งข้อความไม่สำเร็จ ${failCount} การสนทนา`);
      }
      
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการส่งข้อความ:", error);
      alert("เกิดข้อผิดพลาดในการส่งข้อความ");
    }
  }, [selectedConversationIds, selectedPage, displayData, getRemainingMines, dailyMiningLimit, 
      todayMiningCount, updateMiningCount]);

  // =====================================================
  // SECTION 9: OPTIMIZED NOTIFICATION FUNCTIONS
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
  // SECTION 10: OPTIMIZED POPUP HANDLERS
  // =====================================================
  
  const handleOpenPopup = useCallback(() => {
    setIsPopupOpen(true);
  }, []);

  const handleClosePopup = useCallback(() => {
    setIsPopupOpen(false);
  }, []);

  const handleConfirmPopup = useCallback((checkedSetIds) => {
    setSelectedMessageSetIds(checkedSetIds);
    setIsPopupOpen(false);
    sendMessagesBySelectedSets(checkedSetIds);
  }, [sendMessagesBySelectedSets]);

  // =====================================================
  // SECTION 11: OPTIMIZED INACTIVITY FUNCTIONS
  // =====================================================
  
  const sendInactivityBatch = useCallback(async () => {
    if (!selectedPage || displayData.length === 0) return;
    
    try {
      const userData = displayData.map(conv => {
        const inactivityInfo = userInactivityDataRef.current[conv.raw_psid] || {};
        return {
          user_id: conv.raw_psid,
          conversation_id: conv.conversation_id,
          last_message_time: conv.last_user_message_time || conv.updated_time,
          inactivity_minutes: inactivityInfo.minutes || calculateInactivityMinutes(
            conv.last_user_message_time,
            conv.updated_time
          )
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
  }, [selectedPage, displayData, calculateInactivityMinutes]);

  // =====================================================
  // SECTION 12: OPTIMIZED CALLBACK FUNCTIONS
  // =====================================================

//  Callback functions ที่ใช้ useCallback เพื่อลดการสร้างฟังก์ชันซ้ำ
const handleSyncComplete = useCallback((dateRange) => {
  setSyncDateRange(dateRange);
  loadConversations(selectedPage);
}, [selectedPage, loadConversations]);

const handleSelectUsers = useCallback((conversationIds) => {
  setSelectedConversationIds(prev => {
    const newIds = [...new Set([...prev, ...conversationIds])];
    return newIds;
  });
}, []);

const handleClearSelection = useCallback(() => {
  setSelectedConversationIds([]);
}, []);

const handleToggleFilter = useCallback(() => {
  setShowFilter(prev => !prev);
}, []);

const handleFilterChange = useCallback((newFilters) => {
  setFilters(newFilters);
}, []);

const handleClearFilters = useCallback(() => {
  setFilteredConversations([]);
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
    setSelectedConversationIds(displayData.map(conv => conv.conversation_id));
  } else {
    setSelectedConversationIds([]);
  }
}, [displayData]);

const handleRefresh = useCallback(() => {
  handleloadConversations(true, true);
}, [handleloadConversations]);

const handleLimitChange = useCallback((newLimit) => {
  setDailyMiningLimit(newLimit);
  localStorage.setItem('dailyMiningLimit', newLimit.toString());
}, []);

const renderConversationRow = useCallback((conv, idx, isSelected, onToggleCheckbox, onInactivityChange) => (
  <ConversationRow
    key={conv.conversation_id}
    conv={conv}
    idx={idx}
    isSelected={isSelected}
    onToggleCheckbox={onToggleCheckbox}
    onInactivityChange={onInactivityChange}
    isRecentlyUpdated={recentlyUpdatedUsers.has(conv.raw_psid)}
  />
), [recentlyUpdatedUsers]);
  
  const handleInactivityChange = useCallback((userId, minutes) => {
    userInactivityDataRef.current[userId] = {
      minutes,
      updatedAt: new Date()
    };
  }, []);

  const toggleCheckbox = useCallback((conversationId) => {
    setSelectedConversationIds((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId]
    );
  }, []);

  // Optimized batch update function
  const processBatchUpdates = useCallback(() => {
    if (isProcessingRef.current || updateQueueRef.current.length === 0) return;
    
    isProcessingRef.current = true;
    const updates = [...updateQueueRef.current];
    updateQueueRef.current = [];
    
    requestAnimationFrame(() => {
      // Process all updates in one batch
      setConversations(prevConvs => {
        const convMap = new Map(prevConvs.map(c => [c.raw_psid, c]));
        
        updates.forEach(update => {
          const existing = convMap.get(update.psid);
          if (existing) {
            convMap.set(update.psid, { ...existing, ...update });
          }
        });
        
        return Array.from(convMap.values());
      });
      
      setAllConversations(prevAll => {
        const allMap = new Map(prevAll.map(c => [c.raw_psid, c]));
        
        updates.forEach(update => {
          const existing = allMap.get(update.psid);
          if (existing) {
            allMap.set(update.psid, { ...existing, ...update });
          }
        });
        
        return Array.from(allMap.values());
      });
      
      isProcessingRef.current = false;
    });
  }, []);

  // Optimized realtime update handler
  const handleRealtimeUpdate = useCallback((updates) => {
  if (!Array.isArray(updates) || updates.length === 0) return;
  
  // Process all updates
  requestAnimationFrame(() => {
    updates.forEach(update => {
      // ถ้ามี mining_status ให้อัพเดททันที
      if (update.mining_status || update.action === 'mining_status_update') {
        setMiningStatuses(prev => ({
          ...prev,
          [update.psid]: {
            status: update.mining_status || 'ยังไม่ขุด',
            updatedAt: update.timestamp || new Date().toISOString()
          }
        }));
        
        // อัพเดท conversations
        setConversations(prevConvs =>
          prevConvs.map(conv => 
            conv.raw_psid === update.psid 
              ? { ...conv, miningStatus: update.mining_status || conv.miningStatus }
              : conv
          )
        );
        
        setAllConversations(prevAll =>
          prevAll.map(conv => 
            conv.raw_psid === update.psid 
              ? { ...conv, miningStatus: update.mining_status || conv.miningStatus }
              : conv
          )
        );
        
        // แสดง notification
        if (update.mining_status === 'มีการตอบกลับ') {
          showNotification('info', 'สถานะอัพเดท', 
            `ลูกค้า ${update.name || update.psid?.slice(-8) || ''} มีการตอบกลับ`);
        }
      }
    });
  });
}, [showNotification]);

  const handleAddUsersFromFile = useCallback((usersFromDatabase) => {
    requestAnimationFrame(() => {
      setConversations(prevConvs => {
        const existingIds = new Set(prevConvs.map(c => c.conversation_id));
        const newUsers = usersFromDatabase.filter(u => !existingIds.has(u.conversation_id));
        
        const combined = [...prevConvs, ...newUsers];
        combined.sort((a, b) => {
          const timeA = new Date(a.last_user_message_time || 0);
          const timeB = new Date(b.last_user_message_time || 0);
          return timeB - timeA;
        });
        
        return combined;
      });
      
      setAllConversations(prevConvs => {
        const existingIds = new Set(prevConvs.map(c => c.conversation_id));
        const newUsers = usersFromDatabase.filter(u => !existingIds.has(u.conversation_id));
        return [...prevConvs, ...newUsers];
      });
    });
  }, []);

  // =====================================================
  // SECTION 13: REALTIME UPDATES HOOK
  // =====================================================
  
  const { disconnect, reconnect } = useRealtimeUpdates(
    selectedPage,
    handleRealtimeUpdate
  );

  // =====================================================
  // SECTION 14: OPTIMIZED EFFECTS
  // =====================================================
  
  // Background refresh with debounce
  useEffect(() => {
  if (!selectedPage) return;

  let refreshTimeout;
  const backgroundRefresh = async () => {
    if (!loading && !isBackgroundLoading) {
      await handleloadConversations(false, false, true);
      await loadMiningStatuses(selectedPage);  // เพิ่มบรรทัดนี้
    }
    refreshTimeout = setTimeout(backgroundRefresh, 30000);
  };

  refreshTimeout = setTimeout(backgroundRefresh, 30000);

  return () => {
    if (refreshTimeout) clearTimeout(refreshTimeout);
  };
}, [selectedPage, loading, isBackgroundLoading, handleloadConversations, loadMiningStatuses]); // เพิ่ม loadMiningStatuses

  // Apply filters with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (dateEntryFilter !== null || hasActiveFilters) {
        applyFilters();
      } else {
        setFilteredConversations([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [dateEntryFilter, hasActiveFilters, applyFilters]);

  // Reset daily count
  useEffect(() => {
    const checkMidnight = setInterval(() => {
      resetDailyCount();
    }, 60000); // Check every minute instead of 5 seconds

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

    resetDailyCount();

    return () => {
      window.removeEventListener('pageChanged', handlePageChange);
    };
  }, [resetDailyCount]);

  // Load data when page changes
  useEffect(() => {
  if (selectedPage) {
    // Clear states
    setDateEntryFilter(null);
    setFilteredConversations([]);
    setSyncDateRange(null);
    setSelectedConversationIds([]);
    setSelectedMessageSetIds([]);
    
    // Load data with cache check
    Promise.all([
      loadMessages(selectedPage),
      loadConversations(selectedPage),
      loadMiningStatuses(selectedPage)  // เพิ่มบรรทัดนี้
    ]).catch(err => console.error("Error loading data:", err));
  } else {
    setDefaultMessages([]);
    setConversations([]);
    setDateEntryFilter(null);
    setFilteredConversations([]);
    setSyncDateRange(null);
    setSelectedConversationIds([]);
    setSelectedMessageSetIds([]);
    setMiningStatuses({});
  }
}, [selectedPage, loadMessages, loadConversations, loadMiningStatuses]); 

  // Optimized clock update
  useEffect(() => {
    clockIntervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, []);

  // Inactivity batch update with throttle
  useEffect(() => {
    if (inactivityUpdateTimerRef.current) {
      clearInterval(inactivityUpdateTimerRef.current);
    }
    
    sendInactivityBatch();
    
    inactivityUpdateTimerRef.current = setInterval(() => {
      sendInactivityBatch();
    }, 60000); // Update every minute instead of 30 seconds
    
    return () => {
      if (inactivityUpdateTimerRef.current) {
        clearInterval(inactivityUpdateTimerRef.current);
      }
    };
  }, [sendInactivityBatch]);

  
  // =====================================================
  // SECTION 15: OPTIMIZED RENDER
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
        conversations={allConversations}
        onDateEntryFilterChange={handleDateEntryFilterChange}
        currentDateEntryFilter={dateEntryFilter}
        isBackgroundLoading={isBackgroundLoading}
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
        conversationsLength={conversations.length}
        loading={loading}
        filteredLength={filteredConversations.length}
        allLength={allConversations.length}
      />

      <div className="content-area">
        {loading ? (
          <LoadingState />
        ) : displayData.length === 0 ? (
          <EmptyState selectedPage={selectedPage} />
        ) : (
          <ConversationTable
            displayData={displayData}
            selectedConversationIds={selectedConversationIds}
            onToggleCheckbox={toggleCheckbox}
            onToggleAll={handleToggleAll}
            onInactivityChange={handleInactivityChange}
            renderRow={renderConversationRow}
          />
        )}
      </div>

      <ActionBar
        selectedCount={selectedConversationIds.length}
        totalCount={displayData.length}
        loading={loading}
        selectedPage={selectedPage}
        onOpenPopup={handleOpenPopup}
        onRefresh={handleRefresh}
        canMineMore={canMineMore()}
        remainingMines={getRemainingMines()}
        forceShow={selectedConversationIds.length > 0}
      />

      {isPopupOpen && (
        <Popup
          selectedPage={selectedPage}
          onClose={handleClosePopup}
          defaultMessages={defaultMessages}
          onConfirm={handleConfirmPopup}
          count={selectedConversationIds.length}
          remainingMines={getRemainingMines()}
          currentMiningCount={todayMiningCount}
          dailyMiningLimit={dailyMiningLimit}
          onLimitChange={handleLimitChange}
        />
      )}
    </main>
  </div>
);
}

export default React.memo(App);