import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import '../CSS/App.css';
import { fetchPages, getMessagesBySetId, fetchConversations } from "../Features/Tool";
import Sidebar from "./Sidebar"; 
import Popup from "./MinerPopup";

// 🎨 Component สำหรับแสดงเวลาแบบ optimized
const TimeAgoCell = React.memo(({ lastMessageTime, updatedTime }) => {
  const [displayTime, setDisplayTime] = useState('');
  
  useEffect(() => {
    const updateTime = () => {
      const referenceTime = lastMessageTime || updatedTime;
      if (!referenceTime) {
        setDisplayTime('-');
        return;
      }
      
      const past = new Date(referenceTime);
      const now = new Date();
      const diffMs = now.getTime() - past.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      
      if (diffSec < 0) {
        setDisplayTime('0 วินาทีที่แล้ว');
      } else if (diffSec < 60) {
        setDisplayTime(`${diffSec} วินาทีที่แล้ว`);
      } else {
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) {
          setDisplayTime(`${diffMin} นาทีที่แล้ว`);
        } else {
          const diffHr = Math.floor(diffMin / 60);
          if (diffHr < 24) {
            setDisplayTime(`${diffHr} ชั่วโมงที่แล้ว`);
          } else {
            const diffDay = Math.floor(diffHr / 24);
            if (diffDay < 7) {
              setDisplayTime(`${diffDay} วันที่แล้ว`);
            } else {
              const diffWeek = Math.floor(diffDay / 7);
              if (diffWeek < 4) {
                setDisplayTime(`${diffWeek} สัปดาห์ที่แล้ว`);
              } else {
                const diffMonth = Math.floor(diffDay / 30);
                if (diffMonth < 12) {
                  setDisplayTime(`${diffMonth} เดือนที่แล้ว`);
                } else {
                  const diffYear = Math.floor(diffDay / 365);
                  setDisplayTime(`${diffYear} ปีที่แล้ว`);
                }
              }
            }
          }
        }
      }
    };
    
    updateTime();
    
    const referenceTime = lastMessageTime || updatedTime;
    if (!referenceTime) return;
    
    const past = new Date(referenceTime);
    const now = new Date();
    const diffMs = now.getTime() - past.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    
    let intervalMs;
    if (diffMin < 1) {
      intervalMs = 1000;
    } else if (diffMin < 60) {
      intervalMs = 60000;
    } else {
      intervalMs = 3600000;
    }
    
    const interval = setInterval(updateTime, intervalMs);
    
    return () => clearInterval(interval);
  }, [lastMessageTime, updatedTime]);
  
  const isRecent = lastMessageTime && 
    new Date(lastMessageTime) > new Date(Date.now() - 60000);
  
  return (
    <td className={`table-cell ${isRecent ? 'recent-message' : ''}`}>
      <div className="time-display">
        {isRecent && <span className="pulse-dot"></span>}
        {displayTime}
      </div>
    </td>
  );
});

// 🎨 Component สำหรับแสดงแต่ละแถวในตาราง
const ConversationRow = React.memo(({ 
  conv, 
  idx, 
  isSelected, 
  onToggleCheckbox 
}) => {
  const statusColors = {
    'ขุดแล้ว': '#48bb78',
    'ยังไม่ขุด': '#e53e3e',
    'มีการตอบกลับ': '#3182ce'
  };

  const getRandomStatus = () => {
    const statuses = ['ขุดแล้ว', 'ยังไม่ขุด', 'มีการตอบกลับ'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  };

  const status = getRandomStatus();

  return (
    <tr className={`table-row ${isSelected ? 'selected' : ''}`}>
      <td className="table-cell text-center">     {/* ลำดับ */}
        <div className="row-number">{idx + 1}</div>
      </td>
      <td className="table-cell">     {/* ผู้ใช้ */}
        <div className="user-info">
          <div className="user-avatar">
            {conv.user_name?.charAt(0) || 'U'}
          </div>
          <div className="user-details">
            <div className="user-name">{conv.conversation_name || `บทสนทนาที่ ${idx + 1}`}</div>
            <div className="user-id">{conv.raw_psid?.slice(-8) || 'N/A'}</div>
          </div>
        </div>
      </td>
      <td className="table-cell">   {/*	วันที่เข้ามา */}
        <div className="date-display">
          
          {conv.updated_time
            ? new Date(conv.updated_time).toLocaleDateString("th-TH", {
              year: 'numeric', month: 'short', day: 'numeric'
            })
            : "-"
          }
        </div>
      </td>   
      <TimeAgoCell   
        lastMessageTime={conv.last_user_message_time}   // 	ระยะเวลาที่หาย 
        updatedTime={conv.updated_time}
      /> 
      
      <td className="table-cell">
        <span className="product-tag">สินค้าที่สนใจ</span>
      </td>
      <td className="table-cell">
        <div className="platform-badge facebook">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Facebook
        </div>
      </td>
      <td className="table-cell">
        <span className="product-tag">หมวดหมู่ลูกค้า</span>
      </td>
      <td className="table-cell">
        <div className="status-indicator" style={{ '--status-color': statusColors[status] }}>
          <span className="customer-type new">สถานะการขุด</span>
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

function App() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [disappearTime, setDisappearTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [platformType, setPlatformType] = useState("");
  const [miningStatus, setMiningStatus] = useState("");
  const [allConversations, setAllConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [pageId, setPageId] = useState("");
  const [selectedConversationIds, setSelectedConversationIds] = useState([]);
  const [defaultMessages, setDefaultMessages] = useState([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedMessageSetIds, setSelectedMessageSetIds] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());

  const clockIntervalRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  
  const messageCache = useRef({});
  const conversationCache = useRef({});
  const cacheTimeout = 5 * 60 * 1000;

  const displayData = useMemo(() => {
    return filteredConversations.length > 0 ? filteredConversations : conversations;
  }, [filteredConversations, conversations]);

  const getCachedData = (key, cache) => {
    const cached = cache.current[key];
    if (cached && Date.now() - cached.timestamp < cacheTimeout) {
      return cached.data;
    }
    return null;
  };

  const setCachedData = (key, data, cache) => {
    cache.current[key] = {
      data,
      timestamp: Date.now()
    };
  };

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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageIdFromURL = urlParams.get("page_id");
    if (pageIdFromURL) {
      setPageId(pageIdFromURL);
    }
  }, []);

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

  const checkForNewMessages = useCallback(async () => {
    if (!selectedPage || loading) return;
    
    try {
      const newConversations = await fetchConversations(selectedPage);
      
      const hasChanges = newConversations.some(newConv => {
        const oldConv = allConversations.find(c => c.conversation_id === newConv.conversation_id);
        if (!oldConv) return true;
        return newConv.last_user_message_time !== oldConv.last_user_message_time;
      });
      
      if (hasChanges) {
        setConversations(newConversations);
        setAllConversations(newConversations);
        setLastUpdateTime(new Date());
        
        conversationCache.current = {};
        
        if (filteredConversations.length > 0) {
          setTimeout(() => applyFilters(), 100);
        }
        
        const newMessages = newConversations.filter(newConv => {
          const oldConv = allConversations.find(c => c.conversation_id === newConv.conversation_id);
          if (!oldConv) return false;
          return newConv.last_user_message_time && 
                 new Date(newConv.last_user_message_time) > new Date(oldConv.last_user_message_time || 0);
        });
        
        if (newMessages.length > 0 && Notification.permission === "granted") {
          new Notification("มีข้อความใหม่!", {
            body: `มีข้อความใหม่จาก ${newMessages.length} การสนทนา`,
            icon: "/favicon.ico"
          });
        }
      }
    } catch (err) {
      console.error("❌ เกิดข้อผิดพลาดในการตรวจสอบ:", err);
    }
  }, [selectedPage, allConversations, loading, filteredConversations]);

  useEffect(() => {
    clockIntervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedPage) {
      pollingIntervalRef.current = setInterval(() => {
        checkForNewMessages();
      }, 5000);
    }

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [selectedPage, checkForNewMessages]);

  const loadConversations = async (pageId) => {
    if (!pageId) return;

    const cached = getCachedData(`conversations_${pageId}`, conversationCache);
    if (cached && !loading) {
      setConversations(cached);
      setAllConversations(cached);
      return;
    }

    setLoading(true);
    try {
      const conversations = await fetchConversations(pageId);
      setConversations(conversations);
      setAllConversations(conversations);
      setLastUpdateTime(new Date());
      setCachedData(`conversations_${pageId}`, conversations, conversationCache);
      
      setDisappearTime("");
      setCustomerType("");
      setPlatformType("");
      setMiningStatus("");
      setStartDate("");
      setEndDate("");
      setFilteredConversations([]);
      setSelectedConversationIds([]);
    } catch (err) {
      console.error("❌ เกิดข้อผิดพลาด:", err);
      if (err.response?.status === 400) {
        alert("กรุณาเชื่อมต่อ Facebook Page ก่อนใช้งาน");
      } else {
        alert(`เกิดข้อผิดพลาด: ${err.message || err}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleloadConversations = () => {
    if (!selectedPage) {
      alert("กรุณาเลือกเพจ");
      return;
    }
    conversationCache.current = {};
    messageCache.current = {};
    loadConversations(selectedPage);
  };

  const applyFilters = () => {
    let filtered = [...allConversations];

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
      filtered = filtered.filter(conv => conv.customerType === customerType);
    }

    if (platformType) {
      filtered = filtered.filter(conv => conv.platform === platformType);
    }

    if (miningStatus) {
      filtered = filtered.filter(conv => conv.miningStatus === miningStatus);
    }

    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(conv => new Date(conv.created_time) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      filtered = filtered.filter(conv => new Date(conv.created_time) <= end);
    }

    setFilteredConversations(filtered);
  };

  const toggleCheckbox = useCallback((conversationId) => {
    setSelectedConversationIds((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId]
    );
  }, []);

  const handOpenPopup = () => {
    setIsPopupOpen(true);
  };

  const handleClosePopup = () => {
    setIsPopupOpen(false);
  };

  const sendMessagesBySelectedSets = async (messageSetIds) => {
    if (!Array.isArray(messageSetIds) || selectedConversationIds.length === 0) {
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      const notification = document.createElement('div');
      notification.className = 'send-notification';
      notification.innerHTML = `
        <div class="notification-content">
          <div class="notification-icon">🚀</div>
          <div class="notification-text">
            <strong>กำลังส่งข้อความ...</strong>
            <span>ส่งไปยัง ${selectedConversationIds.length} การสนทนา</span>
          </div>
        </div>
      `;
      document.body.appendChild(notification);

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

      notification.remove();

      if (successCount > 0) {   
        showSuccessNotification(`ส่งข้อความสำเร็จ ${successCount} การสนทนา`);
        setSelectedConversationIds([]);
      } else {
        showErrorNotification(`ส่งข้อความไม่สำเร็จ ${failCount} การสนทนา`);
      }
      
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการส่งข้อความ:", error);
      alert("เกิดข้อผิดพลาดในการส่งข้อความ");
    }
  };

  const showSuccessNotification = (message) => {
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">✅</span>
        <span>${message}</span>
      </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  };

  const showErrorNotification = (message) => {
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">❌</span>
        <span>${message}</span>
      </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  };

  const getUpdateStatus = () => {
    const diffMs = currentTime - lastUpdateTime;
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return { status: "อัพเดทล่าสุด", color: "success" };
    if (diffMin < 5) return { status: `${diffMin} นาทีที่แcontextล้ว`, color: "warning" };
    return { status: `${diffMin} นาทีที่แล้ว`, color: "danger" };
  };

  const handleConfirmPopup = (checkedSetIds) => {
    setSelectedMessageSetIds(checkedSetIds);
    setIsPopupOpen(false);
    
    sendMessagesBySelectedSets(checkedSetIds);
  };

  const updateStatus = getUpdateStatus();
  const selectedPageInfo = pages.find(p => p.id === selectedPage);

  return (
    <div className="app-container">
      <Sidebar />

      <main className="main-dashboard">
        {/* Hero Section */}
        <div className="dashboard-hero">
          <div className="hero-content">
            <h1 className="hero-title">
              <span className="title-icon">⛏️</span>
              ระบบขุดข้อมูลลูกค้า
            </h1>
            <p className="hero-subtitle">
              จัดการและติดตามการสนทนากับลูกค้าของคุณอย่างมีประสิทธิภาพ
            </p>
          </div>
         
        </div>

        {/* Connection Status Bar */}
        <div className="connection-status-bar">
          <div className="status-left">
            <div className={`connection-badge ${selectedPage ? 'connected' : 'disconnected'}`}>
              <span className="status-icon">{selectedPage ? '🟢' : '🔴'}</span>
              <span className="status-text">
                {selectedPage ? `เชื่อมต่อแล้ว: ${selectedPageInfo?.name}` : 'ยังไม่ได้เชื่อมต่อ'}
              </span>
            </div>
            <div className={`update-badge ${updateStatus.color}`}>
              <span className="update-icon">🔄</span>
              <span className="update-text">{updateStatus.status}</span>
            </div>
          </div>
          <div className="status-right">
            <span className="clock-display">
              🕐 {currentTime.toLocaleTimeString('th-TH')}
            </span>
          </div>
        </div>

        {/* Filter Section */}
        <div className="filter-section">
          <button
            className="filter-toggle-btn"
            onClick={() => setShowFilter(prev => !prev)}
          >
            <span className="btn-icon">🔍</span>
            <span>ตัวกรองขั้นสูง</span>
            <span className={`toggle-arrow ${showFilter ? 'open' : ''}`}>▼</span>
          </button>

          {showFilter && (
            <div className="filter-panel">
              <div className="filter-grid">
                <div className="filter-group">
                  <label className="filter-label">ระยะเวลาที่หายไป</label>
                  <select
                    className="filter-select"
                    value={disappearTime}
                    onChange={(e) => setDisappearTime(e.target.value)}
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="1d">ภายใน 1 วัน</option>
                    <option value="3d">ภายใน 3 วัน</option>
                    <option value="7d">ภายใน 1 สัปดาห์</option>
                    <option value="1m">ภายใน 1 เดือน</option>
                    <option value="3m">ภายใน 3 เดือน</option>
                    <option value="6m">ภายใน 6 เดือน</option>
                    <option value="1y">ภายใน 1 ปี</option>
                    <option value="over1y">มากกว่า 1 ปี</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label">หมวดหมู่ลูกค้า</label>
                  <select
                    className="filter-select"
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value)}
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="newCM">ลูกค้าใหม่</option>
                    <option value="intrestCM">สนใจสินค้าสูง</option>
                    <option value="dealDoneCM">ใกล้ปิดการขาย</option>
                    <option value="exCM">ลูกค้าเก่า</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label">Platform</label>
                  <select
                    className="filter-select"
                    value={platformType}
                    onChange={(e) => setPlatformType(e.target.value)}
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="FB">Facebook</option>
                    <option value="Line">Line</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label">สถานะการขุด</label>
                  <select
                    className="filter-select"
                    value={miningStatus}
                    onChange={(e) => setMiningStatus(e.target.value)}
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="0Mining">ยังไม่ขุด</option>
                    <option value="Mining">ขุดแล้ว</option>
                    <option value="returnCM">มีการตอบกลับ</option>
                  </select>
                </div>

                <div className="filter-group date-range">
                  <label className="filter-label">ช่วงวันที่</label>
                  <div className="date-inputs">
                    <input
                      type="date"
                      className="filter-input date-input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      placeholder="วันที่เริ่มต้น"
                    />
                    <span className="date-separator">ถึง</span>
                    <input
                      type="date"
                      className="filter-input date-input"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      placeholder="วันที่สิ้นสุด"
                    />
                  </div>
                </div>
              </div>

              <div className="filter-actions">
                <button onClick={applyFilters} className="apply-filter-btn">
                  <span className="btn-icon">✨</span>
                  ใช้ตัวกรอง
                </button>
                <button onClick={() => {
                  setFilteredConversations([]);
                  setDisappearTime("");
                  setCustomerType("");
                  setPlatformType("");
                  setMiningStatus("");
                  setStartDate("");
                  setEndDate("");
                }} className="clear-filter-btn">
                  <span className="btn-icon">🗑️</span>
                  ล้างตัวกรอง
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Alert Messages */}
        {!selectedPage && (
          <div className="alert alert-warning">
            <div className="alert-icon">⚠️</div>
            <div className="alert-content">
              <strong>กรุณาเลือกเพจ Facebook</strong>
              <p>เลือกเพจจากเมนูด้านซ้ายเพื่อเริ่มใช้งานระบบขุดข้อมูล</p>
            </div>
          </div>
        )}

        {selectedPage && conversations.length === 0 && !loading && (
          <div className="alert alert-info">
            <div className="alert-icon">ℹ️</div>
            <div className="alert-content">
              <strong>ยังไม่มีข้อมูลการสนทนา</strong>
              <p>กดปุ่ม "รีเฟรชข้อมูล" เพื่อโหลดข้อมูลการสนทนาล่าสุด</p>
            </div>
          </div>
        )}

        {filteredConversations.length > 0 && (
          <div className="alert alert-success">
            <div className="alert-icon">🔍</div>
            <div className="alert-content">
              <strong>กำลังแสดงผลการกรอง</strong>
              <p>พบ {filteredConversations.length} จาก {allConversations.length} การสนทนา</p>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="content-area">
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p className="loading-text">กำลังโหลดข้อมูล...</p>
            </div>
          ) : displayData.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h3 className="empty-title">
                {selectedPage ? "ไม่พบข้อมูลการสนทนา" : "กรุณาเลือกเพจเพื่อแสดงข้อมูล"}
              </h3>
              <p className="empty-description">
                {selectedPage 
                  ? "ลองกดปุ่มรีเฟรชเพื่อโหลดข้อมูลใหม่ หรือตรวจสอบการเชื่อมต่อ" 
                  : "เลือกเพจจากเมนูด้านซ้ายเพื่อเริ่มดูข้อมูลการสนทนา"}
              </p>
              {selectedPage && (
                <button onClick={handleloadConversations} className="empty-action-btn">
                  🔄 โหลดข้อมูลใหม่
                </button>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th className="th-number">ลำดับ</th>
                    <th className="th-user">ผู้ใช้</th>
                    <th className="th-date">วันที่เข้ามา</th>
                    <th className="th-time">ระยะเวลาที่หาย</th>
                   
                    <th className="th-product">สินค้าที่สนใจ</th>
                    <th className="th-platform">Platform</th>
                    <th className="th-type">หมวดหมู่ลูกค้า</th>
                    <th className="th-status">สถานะการขุด</th>
                    <th className="th-select">
                      <label className="select-all-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedConversationIds.length === displayData.length && displayData.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedConversationIds(displayData.map(conv => conv.conversation_id));
                            } else {
                              setSelectedConversationIds([]);
                            }
                          }}
                        />
                        <span className="checkbox-mark"></span>
                      </label>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((conv, idx) => (
                    <ConversationRow
                      key={conv.conversation_id || idx}
                      conv={conv}
                      idx={idx}
                      isSelected={selectedConversationIds.includes(conv.conversation_id)}
                      onToggleCheckbox={toggleCheckbox}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="action-bar">
          <div className="action-left">
            <button
              onClick={handOpenPopup}
              className={`action-btn primary ${selectedConversationIds.length > 0 ? 'active' : ''}`} style={{paddingRight:"30%" }}
              disabled={loading || selectedConversationIds.length === 0}
            >
              <span className="btn-icon">⛏️</span>
              <span>ขุด</span>
            </button>

            <button 
              onClick={handleloadConversations} 
              className="action-btn secondary"  style={{paddingRight:"30%"}}
              disabled={loading || !selectedPage}
            >
              <span className={`btn-icon ${loading ? 'spinning' : ''}`} >🔄</span>
              <span>{loading ? "กำลังโหลด..." : "รีเฟรช"}</span>
            </button>
          </div>

          <div className="action-right">
            <div className="selection-summary">
              <span className="summary-icon">📊</span>
              <span>เลือกแล้ว {selectedConversationIds.length} จาก {displayData.length} รายการ</span>
            </div>
          </div>
        </div>

        {/* Popup */}
        {isPopupOpen && (
          <Popup
            selectedPage={selectedPage}
            onClose={handleClosePopup}
            defaultMessages={defaultMessages}
            onConfirm={handleConfirmPopup}
            count={selectedConversationIds.length}
          />
        )}
      </main>
    </div>
  );
}

export default App;