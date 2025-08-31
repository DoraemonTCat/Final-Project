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
// MAIN APP COMPONENT
// =====================================================
function App() {
  // =====================================================
  // SECTION 1: STATE MANAGEMENT
  // =====================================================
  
  // ===== Core States =====
  // สำหรับจัดการ pages และ conversations หลัก
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [conversations, setConversations] = useState([]);
  const [allConversations, setAllConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [tempConversations, setTempConversations] = useState([]);
  
  // ===== Loading & UI States =====
  // สำหรับแสดงสถานะการโหลดและ UI
  const [loading, setLoading] = useState(false);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  
  // ===== Filter States =====
  // สำหรับจัดการการกรองข้อมูลต่างๆ
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
  
  // ===== Selection States =====
  // สำหรับจัดการการเลือกข้อมูล
  const [pageId, setPageId] = useState("");
  const [selectedConversationIds, setSelectedConversationIds] = useState([]);
  const [selectedMessageSetIds, setSelectedMessageSetIds] = useState([]);
  const [defaultMessages, setDefaultMessages] = useState([]);
  
  // ===== Time & Update States =====
  // สำหรับจัดการเวลาและการอัพเดท
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());
  const [lastUpdateId, setLastUpdateId] = useState(null);
  const [pendingUpdates, setPendingUpdates] = useState([]);
  const [recentlyUpdatedUsers, setRecentlyUpdatedUsers] = useState(new Set());
  
  // ===== Inactivity States =====
  // สำหรับจัดการข้อมูล inactivity ของผู้ใช้
  const [userInactivityData, setUserInactivityData] = useState({});
  
  // ===== Mining Limit States =====
  // สำหรับจัดการขีดจำกัดการขุดประจำวัน
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
  
  // ===== Timer Refs =====
  // สำหรับจัดการ timers และ intervals
  const inactivityUpdateTimerRef = useRef(null);
  const clockIntervalRef = useRef(null);
  
  // ===== Cache Refs =====
  // สำหรับจัดการ cache ของข้อมูล
  const messageCache = useRef({});
  const cacheTimeout = 5 * 60 * 1000; // 5 นาที

  // =====================================================
  // SECTION 3: COMPUTED VALUES & MEMOIZATION
  // =====================================================
  
  /**
   * displayData - ข้อมูลที่จะแสดงในตาราง
   * ถ้ามีการกรองจะแสดง filteredConversations ถ้าไม่มีจะแสดง conversations
   */
  const displayData = useMemo(() => {
    return filteredConversations.length > 0 ? filteredConversations : conversations;
  }, [filteredConversations, conversations]);

  /**
   * selectedPageInfo - ข้อมูลของ page ที่เลือก
   */
  const selectedPageInfo = pages.find(p => p.id === selectedPage);

  // =====================================================
  // SECTION 4: UTILITY FUNCTIONS
  // =====================================================
  
  /**
   * getCachedData - ดึงข้อมูลจาก cache
   * @param {string} key - key ของข้อมูลที่ต้องการดึง
   * @param {object} cache - cache object
   * @returns {any} - ข้อมูลจาก cache หรือ null ถ้าไม่มีหรือหมดอายุ
   */
  const getCachedData = (key, cache) => {
    const cached = cache.current[key];
    if (cached && Date.now() - cached.timestamp < cacheTimeout) {
      return cached.data;
    }
    return null;
  };

  /**
   * setCachedData - เก็บข้อมูลลง cache
   * @param {string} key - key ของข้อมูลที่ต้องการเก็บ
   * @param {any} data - ข้อมูลที่ต้องการเก็บ
   * @param {object} cache - cache object
   */
  const setCachedData = (key, data, cache) => {
    cache.current[key] = {
      data,
      timestamp: Date.now()
    };
  };

  /**
   * calculateInactivityMinutes - คำนวณเวลาที่ผู้ใช้หายไป (นาที)
   * @param {string} lastMessageTime - เวลาข้อความล่าสุด
   * @param {string} updatedTime - เวลาอัพเดทล่าสุด
   * @returns {number} - จำนวนนาทีที่หายไป
   */
  const calculateInactivityMinutes = (lastMessageTime, updatedTime) => {
    const referenceTime = lastMessageTime || updatedTime;
    if (!referenceTime) return 0;
    
    const past = new Date(referenceTime);
    const now = new Date();
    const diffMs = now.getTime() - past.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    return diffMinutes > 0 ? diffMinutes : 0;
  };

  // =====================================================
  // SECTION 5: MINING FUNCTIONS
  // =====================================================
  
  /**
   * updateMiningCount - อัพเดทจำนวนการขุดของวันนี้
   * @param {number} count - จำนวนที่ต้องการเพิ่ม
   */
  const updateMiningCount = (count) => {
    const today = new Date().toDateString();
    const newCount = todayMiningCount + count;
    setTodayMiningCount(newCount);
    
    localStorage.setItem('miningData', JSON.stringify({
      date: today,
      count: newCount
    }));
  };

  /**
   * resetDailyCount - รีเซ็ตจำนวนการขุดประจำวัน
   * ตรวจสอบว่าเป็นวันใหม่หรือไม่ ถ้าใช่จะรีเซ็ตเป็น 0
   */
  const resetDailyCount = () => {
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
  };

  /**
   * canMineMore - ตรวจสอบว่ายังขุดได้อีกหรือไม่
   * @returns {boolean} - true ถ้ายังขุดได้
   */
  const canMineMore = () => {
    return todayMiningCount < dailyMiningLimit;
  };

  /**
   * getRemainingMines - คำนวณจำนวนการขุดที่เหลือในวันนี้
   * @returns {number} - จำนวนครั้งที่ขุดได้อีก
   */
  const getRemainingMines = () => {
    return Math.max(0, dailyMiningLimit - todayMiningCount);
  };

  // =====================================================
  // SECTION 6: DATA LOADING FUNCTIONS
  // =====================================================
  
  /**
   * loadMessages - โหลดข้อความจาก API หรือ cache
   * @param {string} pageId - ID ของ page
   * @returns {Promise<Array>} - array ของข้อความ
   */
  const loadMessages = async (pageId) => {
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
  };

  /**
   * loadConversations - โหลดข้อมูลการสนทนาจาก API
   * @param {string} pageId - ID ของ page
   * @param {boolean} forceRefresh - บังคับ refresh ข้อมูล
   * @param {boolean} resetFilters - รีเซ็ต filters
   * @param {boolean} isBackground - เป็นการโหลด background หรือไม่
   */
  const loadConversations = async (pageId, forceRefresh = false, resetFilters = false, isBackground = false) => {
    if (!pageId) return;

    // ถ้าเป็น background refresh ไม่ต้องแสดง loading
    if (!isBackground) {
      setLoading(true);
    } else {
      setIsBackgroundLoading(true);
    }

    try {
      const conversations = await fetchConversations(pageId);
      
      // ถ้าเป็น background refresh ให้เช็คก่อนว่าข้อมูลเปลี่ยนหรือไม่
      if (isBackground) {
        const hasChanges = JSON.stringify(conversations) !== JSON.stringify(allConversations);
        
        if (hasChanges) {
          requestAnimationFrame(() => {
            setConversations(conversations);
            setAllConversations(conversations);
            setLastUpdateTime(new Date());
          });
        }
      } else {
        // การโหลดปกติ
        setConversations(conversations);
        setAllConversations(conversations);
        setLastUpdateTime(new Date());
      }

      // Reset filters เฉพาะเมื่อต้องการ
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

      // Update cache
      setCachedData(`conversations_${pageId}`, conversations, { current: {} });
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
  };

  /**
   * handleloadConversations - Wrapper function สำหรับโหลดข้อมูลแชท
   * @param {boolean} showSuccessNotification - แสดง notification เมื่อสำเร็จ
   * @param {boolean} resetFilters - รีเซ็ต filters
   * @param {boolean} isBackground - เป็นการโหลด background
   */
  const handleloadConversations = async (showSuccessNotification = false, resetFilters = false, isBackground = false) => {
    console.log("🔄 เริ่มรีเฟรชข้อมูล...");
    
    if (!selectedPage) {
      if (!isBackground) {
        showNotification('warning', 'กรุณาเลือกเพจก่อนรีเฟรช');
      }
      return;
    }

    // ถ้าเป็น background refresh ไม่ต้อง disconnect SSE
    if (!isBackground && disconnect) {
      disconnect();
    }

    try {
      await loadConversations(selectedPage, true, resetFilters, isBackground);
      
      // reconnect SSE เฉพาะเมื่อไม่ใช่ background
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
  };

  // =====================================================
  // SECTION 7: FILTER FUNCTIONS
  // =====================================================
  
  /**
   * applyFilters - ใช้ filters กับข้อมูล conversations
   * กรองข้อมูลตามเงื่อนไขต่างๆ ที่ตั้งไว้
   */
  const applyFilters = () => {
    let filtered = [...allConversations];
    const { disappearTime, customerType, platformType, miningStatus, startDate, endDate } = filters;

    // กรองตามวันที่เข้ามา
    if (dateEntryFilter) {
      filtered = filtered.filter(conv => {
        const dateStr = conv.first_interaction_at || conv.created_time;
        if (!dateStr) return false;

        const date = new Date(dateStr).toISOString().split('T')[0];
        return date === dateEntryFilter;
      });
    }

    // กรองตามระยะเวลาที่หาย
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

    // กรองตามหมวดหมู่ลูกค้า
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

    // กรองตาม platform
    if (platformType) {
      filtered = filtered.filter(conv => conv.platform === platformType);
    }

    // กรองตามสถานะการขุด
    if (miningStatus) {
      filtered = filtered.filter(conv => conv.miningStatus === miningStatus);
    }

    // Helper function สำหรับแปลงวันที่
    const toDateOnly = (dateStr) => {
      if (!dateStr) return null;
      return new Date(dateStr).toISOString().split("T")[0];
    };

    // กรองตามช่วงวันที่
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
  };

  /**
   * handleClearDateFilter - ล้าง date filter
   */
  const handleClearDateFilter = () => {
    setSyncDateRange(null);
    loadConversations(selectedPage);
  };

  /**
   * handleDateEntryFilterChange - จัดการเมื่อ date entry filter เปลี่ยน
   * @param {string} date - วันที่ที่เลือก
   */
  const handleDateEntryFilterChange = (date) => {
    setDateEntryFilter(date);
    
    if (date === null) {
      setFilteredConversations([]);
    }
  };

  // =====================================================
  // SECTION 8: MESSAGE FUNCTIONS
  // =====================================================
  
  /**
   * sendMessagesBySelectedSets - ส่งข้อความไปยังการสนทนาที่เลือก
   * @param {Array} messageSetIds - array ของ message set IDs
   */
  const sendMessagesBySelectedSets = async (messageSetIds) => {
    if (!Array.isArray(messageSetIds) || selectedConversationIds.length === 0) {
      return;
    }

    // ตรวจสอบขีดจำกัดประจำวัน
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
        } catch (err) {
          console.error(`ส่งข้อความไม่สำเร็จสำหรับ ${conversationId}:`, err);
          failCount++;
        }
      }

      removeNotification();

      if (successCount > 0) {   
        // อัพเดทจำนวนการขุด
        updateMiningCount(successCount);
        
        showNotification('success', `ส่งข้อความสำเร็จ ${successCount} การสนทนา`, 
          `ขุดไปแล้ว ${todayMiningCount + successCount}/${dailyMiningLimit} ครั้งวันนี้`);
        setSelectedConversationIds([]);
      } else {
        showNotification('error', `ส่งข้อความไม่สำเร็จ ${failCount} การสนทนา`);
      }
      
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการส่งข้อความ:", error);
      alert("เกิดข้อผิดพลาดในการส่งข้อความ");
    }
  };

  // =====================================================
  // SECTION 9: NOTIFICATION FUNCTIONS
  // =====================================================
  
  /**
   * showNotification - แสดง notification
   * @param {string} type - ประเภทของ notification (success, error, warning, send)
   * @param {string} message - ข้อความหลัก
   * @param {string} detail - รายละเอียดเพิ่มเติม
   */
  const showNotification = (type, message, detail = '') => {
    const notification = document.createElement('div');
    notification.className = `${type}-notification`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      send: '🚀'
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
  };

  /**
   * removeNotification - ลบ notification ประเภท send
   */
  const removeNotification = () => {
    const notifications = document.querySelectorAll('.send-notification');
    notifications.forEach(n => n.remove());
  };

  // =====================================================
  // SECTION 10: POPUP HANDLERS
  // =====================================================
  
  /**
   * handleOpenPopup - เปิด popup เลือกข้อความ
   */
  const handleOpenPopup = () => {
    setIsPopupOpen(true);
  };

  /**
   * handleClosePopup - ปิด popup
   */
  const handleClosePopup = () => {
    setIsPopupOpen(false);
  };

  /**
   * handleConfirmPopup - ยืนยันการเลือกข้อความและส่ง
   * @param {Array} checkedSetIds - array ของ message set IDs ที่เลือก
   */
  const handleConfirmPopup = (checkedSetIds) => {
    setSelectedMessageSetIds(checkedSetIds);
    setIsPopupOpen(false);
    sendMessagesBySelectedSets(checkedSetIds);
  };

  // =====================================================
  // SECTION 11: INACTIVITY FUNCTIONS
  // =====================================================
  
  /**
   * sendInactivityBatch - ส่งข้อมูล inactivity แบบ batch
   * อัพเดทข้อมูลเวลาที่ผู้ใช้หายไปไปยัง backend
   */
  const sendInactivityBatch = useCallback(async () => {
    if (!selectedPage || displayData.length === 0) return;
    
    try {
      const userData = displayData.map(conv => {
        const inactivityInfo = userInactivityData[conv.raw_psid] || {};
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
  }, [selectedPage, displayData, userInactivityData]);

  // =====================================================
  // SECTION 12: CALLBACK FUNCTIONS
  // =====================================================
  
  /**
   * handleInactivityChange - จัดการเมื่อ inactivity เปลี่ยน
   * @param {string} userId - ID ของผู้ใช้
   * @param {number} minutes - จำนวนนาทีที่หายไป
   */
  const handleInactivityChange = useCallback((userId, minutes) => {
    setUserInactivityData(prev => ({
      ...prev,
      [userId]: {
        minutes,
        updatedAt: new Date()
      }
    }));
  }, []);

  /**
   * toggleCheckbox - สลับการเลือก conversation
   * @param {string} conversationId - ID ของ conversation
   */
  const toggleCheckbox = useCallback((conversationId) => {
    setSelectedConversationIds((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId]
    );
  }, []);

  /**
   * handleRealtimeUpdate - จัดการ real-time updates จาก SSE
   * @param {Array} updates - array ของการอัพเดท
   */
  const handleRealtimeUpdate = useCallback((updates) => {
    console.log('📊 Received updates:', updates);

    // จัดการ customer type updates
    if (Array.isArray(updates) && updates.length > 0) {
      const firstUpdate = updates[0];

      // ตรวจสอบว่าเป็น customer type update
      if (firstUpdate.customer_type_name !== undefined || 
          firstUpdate.customer_type_custom_id !== undefined ||
          firstUpdate.customer_type_knowledge_name !== undefined ||
          firstUpdate.customer_type_knowledge_id !== undefined) {
        
        console.log('🏷️ Processing customer type updates');

        // อัพเดท conversations
        setConversations(prevConvs => {
          return prevConvs.map(conv => {
            const update = updates.find(u => u.psid === conv.raw_psid);
            if (update) {
              // เพิ่ม visual feedback
              setRecentlyUpdatedUsers(prev => {
                const newSet = new Set(prev);
                newSet.add(conv.raw_psid);

                setTimeout(() => {
                  setRecentlyUpdatedUsers(current => {
                    const updated = new Set(current);
                    updated.delete(conv.raw_psid);
                    return updated;
                  });
                }, 3000);

                return newSet;
              });

              // อัพเดทข้อมูลทั้ง custom และ knowledge types
              return {
                ...conv,
                // Custom type (User Groups)
                customer_type_custom_id: update.customer_type_custom_id !== undefined 
                  ? update.customer_type_custom_id 
                  : conv.customer_type_custom_id,
                customer_type_name: update.customer_type_name !== undefined 
                  ? update.customer_type_name 
                  : conv.customer_type_name,
                // Knowledge type (กลุ่มพื้นฐาน)
                customer_type_knowledge_id: update.customer_type_knowledge_id !== undefined 
                  ? update.customer_type_knowledge_id 
                  : conv.customer_type_knowledge_id,
                customer_type_knowledge_name: update.customer_type_knowledge_name !== undefined 
                  ? update.customer_type_knowledge_name 
                  : conv.customer_type_knowledge_name,
                // Update times
                last_user_message_time: update.last_interaction || conv.last_user_message_time,
                updated_time: new Date().toISOString()
              };
            }
            return conv;
          });
        });

        // อัพเดท allConversations
        setAllConversations(prevAll => {
          return prevAll.map(conv => {
            const update = updates.find(u => u.psid === conv.raw_psid);
            if (update) {
              return {
                ...conv,
                // Custom type (User Groups)
                customer_type_custom_id: update.customer_type_custom_id !== undefined 
                  ? update.customer_type_custom_id 
                  : conv.customer_type_custom_id,
                customer_type_name: update.customer_type_name !== undefined 
                  ? update.customer_type_name 
                  : conv.customer_type_name,
                // Knowledge type (กลุ่มพื้นฐาน)
                customer_type_knowledge_id: update.customer_type_knowledge_id !== undefined 
                  ? update.customer_type_knowledge_id 
                  : conv.customer_type_knowledge_id,
                customer_type_knowledge_name: update.customer_type_knowledge_name !== undefined 
                  ? update.customer_type_knowledge_name 
                  : conv.customer_type_knowledge_name,
                last_user_message_time: update.last_interaction || conv.last_user_message_time,
                updated_time: new Date().toISOString()
              };
            }
            return conv;
          });
        });

        // อัพเดท filteredConversations ถ้ามี
        setFilteredConversations(prevFiltered => {
          if (prevFiltered.length > 0) {
            return prevFiltered.map(conv => {
              const update = updates.find(u => u.psid === conv.raw_psid);
              if (update) {
                return {
                  ...conv,
                  // Custom type (User Groups)
                  customer_type_custom_id: update.customer_type_custom_id !== undefined 
                    ? update.customer_type_custom_id 
                    : conv.customer_type_custom_id,
                  customer_type_name: update.customer_type_name !== undefined 
                    ? update.customer_type_name 
                    : conv.customer_type_name,
                  // Knowledge type (กลุ่มพื้นฐาน)
                  customer_type_knowledge_id: update.customer_type_knowledge_id !== undefined 
                    ? update.customer_type_knowledge_id 
                    : conv.customer_type_knowledge_id,
                  customer_type_knowledge_name: update.customer_type_knowledge_name !== undefined 
                    ? update.customer_type_knowledge_name 
                    : conv.customer_type_knowledge_name,
                  last_user_message_time: update.last_interaction || conv.last_user_message_time,
                  updated_time: new Date().toISOString()
                };
              }
              return conv;
            });
          }
          return prevFiltered;
        });

        // แสดง notification
        const customUpdateCount = updates.filter(u => u.customer_type_name).length;
        const knowledgeUpdateCount = updates.filter(u => u.customer_type_knowledge_name).length;
        const totalUpdates = customUpdateCount + knowledgeUpdateCount;
        
        if (totalUpdates > 0) {
          let message = `อัพเดทหมวดหมู่ลูกค้า ${totalUpdates} คน`;
          if (customUpdateCount > 0 && knowledgeUpdateCount > 0) {
            message += ` (กลุ่มผู้ใช้: ${customUpdateCount}, กลุ่มพื้นฐาน: ${knowledgeUpdateCount})`;
          } else if (customUpdateCount > 0) {
            message += ` (กลุ่มผู้ใช้)`;
          } else if (knowledgeUpdateCount > 0) {
            message += ` (กลุ่มพื้นฐาน)`;
          }
          showNotification('info', message);
        }

        return; // จบการประมวลผล customer type updates
      }
    }

    // จัดการ normal customer updates (โค้ดเดิม)
    setPendingUpdates(prev => [...prev, ...updates]);

    setConversations(prevConvs => {
      const conversationMap = new Map(prevConvs.map(c => [c.raw_psid, c]));
      updates.forEach(update => {
        const existing = conversationMap.get(update.psid);
        if (existing) {
          conversationMap.set(update.psid, {
            ...existing,
            user_name: update.name,
            conversation_name: update.name,
            last_user_message_time: update.last_interaction,
            first_interaction_at: update.first_interaction,
            source_type: update.source_type,
            updated_time: new Date().toISOString()
          });
        } else {
          const newConv = {
            id: conversationMap.size + 1,
            conversation_id: update.psid,
            raw_psid: update.psid,
            user_name: update.name,
            conversation_name: update.name,
            last_user_message_time: update.last_interaction,
            first_interaction_at: update.first_interaction,
            source_type: update.source_type,
            created_time: update.first_interaction,
            updated_time: new Date().toISOString()
          };
          conversationMap.set(update.psid, newConv);
        }
      });
      
      const updatedConvs = Array.from(conversationMap.values()).sort((a, b) => {
        const timeA = new Date(a.last_user_message_time || 0);
        const timeB = new Date(b.last_user_message_time || 0);
        return timeB - timeA;
      });
      return updatedConvs;
    });

    setAllConversations(prevAll => {
      const allMap = new Map(prevAll.map(c => [c.raw_psid, c]));
      updates.forEach(update => {
        const existing = allMap.get(update.psid);
        if (existing) {
          allMap.set(update.psid, {
            ...existing,
            user_name: update.name,
            conversation_name: update.name,
            last_user_message_time: update.last_interaction,
            first_interaction_at: update.first_interaction,
            source_type: update.source_type
          });
        }
      });
      return Array.from(allMap.values());
    });

    setLastUpdateId(prev => prev + 1);
    setLastUpdateTime(new Date());

    const newCustomers = updates.filter(u => u.action === 'new');
    if (newCustomers.length > 0) {
      showNotification('info', `มีลูกค้าใหม่ ${newCustomers.length} คน`);
    }
  }, []);

  /**
   * handleAddUsersFromFile - เพิ่ม users จากไฟล์ที่อัพโหลด
   * @param {Array} usersFromDatabase - array ของ users จาก database
   */
  const handleAddUsersFromFile = useCallback((usersFromDatabase) => {
    setConversations(prevConvs => {
      // กรองเอาเฉพาะ users ที่ยังไม่มีในตาราง
      const existingIds = new Set(prevConvs.map(c => c.conversation_id));
      const newUsers = usersFromDatabase.filter(u => !existingIds.has(u.conversation_id));
      
      // รวม users ใหม่เข้ากับที่มีอยู่
      const combined = [...prevConvs, ...newUsers];
      
      // เรียงลำดับตาม last_user_message_time
      combined.sort((a, b) => {
        const timeA = new Date(a.last_user_message_time || 0);
        const timeB = new Date(b.last_user_message_time || 0);
        return timeB - timeA;
      });
      
      return combined;
    });
    
    // อัพเดท allConversations ด้วย
    setAllConversations(prevConvs => {
      const existingIds = new Set(prevConvs.map(c => c.conversation_id));
      const newUsers = usersFromDatabase.filter(u => !existingIds.has(u.conversation_id));
      return [...prevConvs, ...newUsers];
    });
    
    // อัพเดท filteredConversations ถ้ามีการกรองอยู่
    setFilteredConversations(prevFiltered => {
      if (prevFiltered.length > 0) {
        const existingIds = new Set(prevFiltered.map(c => c.conversation_id));
        const newUsers = usersFromDatabase.filter(u => !existingIds.has(u.conversation_id));
        return [...prevFiltered, ...newUsers];
      }
      return prevFiltered;
    });
  }, []);

  // =====================================================
  // SECTION 13: REALTIME UPDATES HOOK
  // =====================================================
  
  /**
   * useRealtimeUpdates - Hook สำหรับจัดการ real-time updates ผ่าน SSE
   */
  const { disconnect, reconnect } = useRealtimeUpdates(
    selectedPage,
    handleRealtimeUpdate
  );

  // =====================================================
  // SECTION 14: EFFECTS & LIFECYCLE
  // =====================================================
  
  /**
   * Effect: Background Refresh
   * รีเฟรชข้อมูลอัตโนมัติทุก 30 วินาที
   */
  useEffect(() => {
    if (!selectedPage) return;

    const backgroundRefresh = async () => {
      // ตรวจสอบว่าไม่มีการโหลดอยู่
      if (!loading && !isBackgroundLoading) {
        await handleloadConversations(false, false, true);
      }
    };

    // เริ่ม interval
    const interval = setInterval(backgroundRefresh, 30000); // ทุก 30 วินาที

    return () => clearInterval(interval);
  }, [selectedPage, loading, isBackgroundLoading]);

  /**
   * Effect: Apply Filters เมื่อ dateEntryFilter เปลี่ยน
   */
  useEffect(() => {
    if (dateEntryFilter !== null) {
      applyFilters();
    } else {
      setFilteredConversations([]);
    }
  }, [dateEntryFilter]);

  /**
   * Effect: Reset Daily Count ทุกๆ 5 วินาที
   * ตรวจสอบว่าเป็นวันใหม่หรือไม่
   */
  useEffect(() => {
    const checkMidnight = setInterval(() => {
      resetDailyCount();
    }, 5000);

    return () => clearInterval(checkMidnight);
  }, []);

  /**
   * Effect: Initial Setup
   * - Setup event listeners
   * - Load saved page
   * - Fetch pages
   * - Request notification permission
   * - Reset daily count
   */
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

    // Reset daily count on load
    resetDailyCount();

    return () => {
      window.removeEventListener('pageChanged', handlePageChange);
    };
  }, []);

  /**
   * Effect: Handle URL Parameters
   * ดึง page_id จาก URL parameters
   */
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageIdFromURL = urlParams.get("page_id");
    if (pageIdFromURL) {
      setPageId(pageIdFromURL);
    }
  }, []);

  /**
   * Effect: Load Data เมื่อ selectedPage เปลี่ยน
   */
  useEffect(() => {
    if (selectedPage) {
      Promise.all([
        loadMessages(selectedPage),
        loadConversations(selectedPage)
      ]).catch(err => console.error("Error loading data:", err));
    } else {
      setDefaultMessages([]);
      setConversations([]);
    }
  }, [selectedPage]);

  /**
   * Effect: Clock Update
   * อัพเดทเวลาปัจจุบันทุกวินาที
   */
  useEffect(() => {
    clockIntervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, []);

  /**
   * Effect: Inactivity Batch Update
   * ส่งข้อมูล inactivity ทุก 30 วินาที
   */
  useEffect(() => {
    if (inactivityUpdateTimerRef.current) {
      clearInterval(inactivityUpdateTimerRef.current);
    }
    
    sendInactivityBatch();
    
    inactivityUpdateTimerRef.current = setInterval(() => {
      sendInactivityBatch();
    }, 30000);
    
    return () => {
      if (inactivityUpdateTimerRef.current) {
        clearInterval(inactivityUpdateTimerRef.current);
      }
    };
  }, [sendInactivityBatch]);

  // =====================================================
  // SECTION 15: RENDER
  // =====================================================
  
  /**
   * Main Render
   * แสดง UI ทั้งหมดของ Application
   */
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
          onSyncComplete={(dateRange) => {
            setSyncDateRange(dateRange);
            loadConversations(selectedPage);
          }}
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
          onSelectUsers={(conversationIds) => {
            setSelectedConversationIds(prev => {
              const newIds = [...new Set([...prev, ...conversationIds])];
              return newIds;
            });
          }}
          onClearSelection={() => setSelectedConversationIds([])}
          onAddUsersFromFile={handleAddUsersFromFile}
        />
        
        <FilterSection
          showFilter={showFilter}
          onToggleFilter={() => setShowFilter(prev => !prev)}
          filters={filters}
          onFilterChange={(newFilters) => setFilters(newFilters)}
          onApplyFilters={applyFilters}
          onClearFilters={() => {
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
          }}
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
              onToggleAll={(checked) => {
                if (checked) {
                  setSelectedConversationIds(displayData.map(conv => conv.conversation_id));
                } else {
                  setSelectedConversationIds([]);
                }
              }}
              onInactivityChange={handleInactivityChange}
              renderRow={(conv, idx, isSelected, onToggleCheckbox, onInactivityChange) => (
                <ConversationRow
                  key={conv.conversation_id}
                  conv={conv}
                  idx={idx}
                  isSelected={isSelected}
                  onToggleCheckbox={onToggleCheckbox}
                  onInactivityChange={onInactivityChange}
                  isRecentlyUpdated={recentlyUpdatedUsers.has(conv.raw_psid)}
                />
              )}
            />
          )}
        </div>

        <ActionBar
          selectedCount={selectedConversationIds.length}
          totalCount={displayData.length}
          loading={loading}
          selectedPage={selectedPage}
          onOpenPopup={handleOpenPopup}
          onRefresh={() => handleloadConversations(true, true)}
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
            onLimitChange={(newLimit) => {
              setDailyMiningLimit(newLimit);
              localStorage.setItem('dailyMiningLimit', newLimit.toString());
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;