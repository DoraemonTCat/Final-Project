import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import '../CSS/App.css';
import { fetchPages, getMessagesBySetId, fetchConversations } from "../Features/Tool";
import Sidebar from "./Sidebar"; 
import Popup from "./MinerPopup";

// 🚀 Component สำหรับแสดงเวลาแบบ optimized
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
    
    // อัพเดทครั้งแรกทันที
    updateTime();
    
    // ตั้ง interval ตามความถี่ที่เหมาะสม
    const referenceTime = lastMessageTime || updatedTime;
    if (!referenceTime) return;
    
    const past = new Date(referenceTime);
    const now = new Date();
    const diffMs = now.getTime() - past.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    
    let intervalMs;
    if (diffMin < 1) {
      intervalMs = 1000; // อัพเดททุกวินาทีถ้าน้อยกว่า 1 นาที
    } else if (diffMin < 60) {
      intervalMs = 60000; // อัพเดททุกนาทีถ้าน้อยกว่า 1 ชม.
    } else {
      intervalMs = 3600000; // อัพเดททุกชั่วโมงถ้ามากกว่า 1 ชม.
    }
    
    const interval = setInterval(updateTime, intervalMs);
    
    return () => clearInterval(interval);
  }, [lastMessageTime, updatedTime]);
  
  const isRecent = lastMessageTime && 
    new Date(lastMessageTime) > new Date(Date.now() - 60000);
  
  return (
    <td className="table" style={{
      backgroundColor: isRecent ? '#e8f5e9' : 'transparent'
    }}>
      {displayTime}
    </td>
  );
});

// 🚀 Component สำหรับแสดงแต่ละแถวในตาราง
const ConversationRow = React.memo(({ 
  conv, 
  idx, 
  isSelected, 
  onToggleCheckbox 
}) => {
  return (
    <tr key={conv.conversation_id || idx}>
      <td style={{ border: "1px solid #ccc", padding: "8px", textAlign: "center" }}>{idx + 1}</td>
      <td className="table">{conv.conversation_name || `บทสนทนาที่ ${idx + 1}`}</td>
      <td className="table">
        {conv.updated_time
          ? new Date(conv.updated_time).toLocaleDateString("th-TH", {
            year: 'numeric', month: 'short', day: 'numeric'
          })
          : "-"
        }
      </td>
      <TimeAgoCell 
        lastMessageTime={conv.last_user_message_time}
        updatedTime={conv.updated_time}
      />
      <td className="table">Context</td>
      <td className="table">สินค้าที่สนใจ</td>
      <td className="table">Platform</td>
      <td className="table">หมวดหมู่ลูกค้า</td>
      <td className="table">สถานะการขุด</td>
      <td className="table">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleCheckbox(conv.conversation_id)}
        />
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

  // 🚀 Refs สำหรับ intervals
  const clockIntervalRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  
  // 🚀 Cache สำหรับเก็บข้อมูลที่โหลดแล้ว
  const messageCache = useRef({});
  const conversationCache = useRef({});
  const cacheTimeout = 5 * 60 * 1000; // 5 นาที

  // 🚀 Memoized display data
  const displayData = useMemo(() => {
    return filteredConversations.length > 0 ? filteredConversations : conversations;
  }, [filteredConversations, conversations]);

  // 🚀 ฟังก์ชันตรวจสอบ cache
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

  // Listen for page changes from Sidebar
  useEffect(() => {
    const handlePageChange = (event) => {
      const newPageId = event.detail.pageId;
      setSelectedPage(newPageId);
    };

    window.addEventListener('pageChanged', handlePageChange);
    
    // Load saved page on mount
    const savedPage = localStorage.getItem("selectedPage");
    if (savedPage) {
      setSelectedPage(savedPage);
    }

    // Load pages for display
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

  // 🚀 โหลดข้อมูลแบบ parallel เมื่อเปลี่ยน selectedPage
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

  // 🚀 ฟังก์ชันโหลดข้อความที่ปรับปรุงแล้ว
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

  // 🚀 ฟังก์ชันตรวจสอบข้อความใหม่ที่ปรับปรุงแล้ว
  const checkForNewMessages = useCallback(async () => {
    if (!selectedPage || loading) return;
    
    try {
      const newConversations = await fetchConversations(selectedPage);
      
      // ตรวจสอบว่ามีการเปลี่ยนแปลงหรือไม่
      const hasChanges = newConversations.some(newConv => {
        const oldConv = allConversations.find(c => c.conversation_id === newConv.conversation_id);
        if (!oldConv) return true;
        return newConv.last_user_message_time !== oldConv.last_user_message_time;
      });
      
      if (hasChanges) {
        setConversations(newConversations);
        setAllConversations(newConversations);
        setLastUpdateTime(new Date());
        
        // Clear cache เมื่อมีข้อมูลใหม่
        conversationCache.current = {};
        
        if (filteredConversations.length > 0) {
          setTimeout(() => applyFilters(), 100);
        }
        
        // แจ้งเตือนเฉพาะเมื่อมีข้อความใหม่จริงๆ
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

  // 🚀 useEffect สำหรับ clock และ polling
  useEffect(() => {
    // อัพเดทนาฬิกาทุก 1 วินาที
    clockIntervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, []);

  // 🚀 useEffect สำหรับ polling ข้อมูลใหม่
  useEffect(() => {
    if (selectedPage) {
      // เริ่ม polling ทุก 5 วินาที
      pollingIntervalRef.current = setInterval(() => {
        checkForNewMessages();
      }, 5000);
    }

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [selectedPage, checkForNewMessages]);

  // 🚀 ฟังก์ชันโหลด conversations ที่ปรับปรุงแล้ว
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
      
      // Clear filters เมื่อโหลดข้อมูลใหม่
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
    // Clear cache ก่อน refresh
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

  // 🚀 ฟังก์ชันส่งข้อความที่ปรับปรุงให้ส่งตามลำดับ
  const sendMessagesBySelectedSets = async (messageSetIds) => {
    if (!Array.isArray(messageSetIds) || selectedConversationIds.length === 0) {
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      // แสดงข้อความกำลังส่ง
      const notification = document.createElement('div');
      notification.innerHTML = `<strong>🚀 กำลังส่งข้อความ...</strong><br>ส่งไปยัง ${selectedConversationIds.length} การสนทนา`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 9999;
      `;
      document.body.appendChild(notification);

      // วนลูปส่งข้อความสำหรับแต่ละ conversation
      for (const conversationId of selectedConversationIds) {
        const selectedConv = displayData.find(conv => conv.conversation_id === conversationId);
        const psid = selectedConv?.raw_psid;

        if (!psid) {
          failCount++;
          continue;
        }

        try {
          // ส่งข้อความทีละชุดตามลำดับ
          for (const setId of messageSetIds) {
            // โหลดข้อความในชุดนี้
            const response = await fetch(`http://localhost:8000/custom_messages/${setId}`);
            if (!response.ok) continue;
            
            const messages = await response.json();
            const sortedMessages = messages.sort((a, b) => a.display_order - b.display_order);

            // ส่งข้อความในชุดนี้ทีละข้อความ
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

              // หน่วงเวลาระหว่างข้อความ
              await new Promise(resolve => setTimeout(resolve, 500));
            }

            // หน่วงเวลาระหว่างชุดข้อความ (1 วินาที)
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          successCount++;
        } catch (err) {
          console.error(`ส่งข้อความไม่สำเร็จสำหรับ ${conversationId}:`, err);
          failCount++;
        }
      }

      // ลบ notification
      notification.remove();

      // แสดงผลสรุป
      if (successCount > 0) {   
        console.log("✅ ส่งข้อความสำเร็จ:", successCount);
        setSelectedConversationIds([]);
      } else {
        console.log(" ❌ ส่งข้อความไม่สำเร็จ:", failCount);
        setSelectedConversationIds([]);
      }
      
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการส่งข้อความ:", error);
      alert("เกิดข้อผิดพลาดในการส่งข้อความ");
    }
  };

  const getUpdateStatus = () => {
    const diffMs = currentTime - lastUpdateTime;
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return "🟢 อัพเดทล่าสุด";
    if (diffMin < 5) return "🟡 " + diffMin + " นาทีที่แล้ว";
    return "🔴 " + diffMin + " นาทีที่แล้ว";
  };

  const handleConfirmPopup = (checkedSetIds) => {
    setSelectedMessageSetIds(checkedSetIds);
    setIsPopupOpen(false);
    
    // ส่งข้อความแบบ background
    sendMessagesBySelectedSets(checkedSetIds);
  };

  
  return (
    <div className="app-container">
      <Sidebar />

      <main className="main-dashboard">
        <div className="line-divider">
          <p style={{ marginLeft: "95%" }}>ชื่อ User</p>
        </div>

        <button
          className="filter-toggle-button"
          onClick={() => setShowFilter(prev => !prev)}
        >
          🧰 ตัวกรอง
        </button>

        {showFilter && (
          <div className="filter-bar">
            <select
              className="filter-select"
              value={disappearTime}
              onChange={(e) => setDisappearTime(e.target.value)}
            >
              <option value="">ระยะเวลาที่หายไป (จากข้อความล่าสุดของ User)</option>
              <option value="1d">ภายใน 1 วัน</option>
              <option value="3d">ภายใน 3 วัน</option>
              <option value="7d">ภายใน 1 สัปดาห์</option>
              <option value="1m">ภายใน 1 เดือน</option>
              <option value="3m">ภายใน 3 เดือน</option>
              <option value="6m">ภายใน 6 เดือน</option>
              <option value="1y">ภายใน 1 ปี</option>
              <option value="over1y">1 ปีขึ้นไป</option>
            </select>
            <select
              className="filter-select"
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value)}
            >
              <option value="">หมวดหมู่ลูกค้า</option>
              <option value="newCM">ลูกค้าใหม่</option>
              <option value="intrestCM">ลูกค้ามีความสนใจในสินค้าสูง</option>
              <option value="dealDoneCM">ใกล้ปิดการขาย</option>
              <option value="exCM">ลูกค้าเก่า</option>
            </select>
            <select
              className="filter-select"
              value={platformType}
              onChange={(e) => setPlatformType(e.target.value)}
            >
              <option value="">Platform</option>
              <option value="FB">Facebook</option>
              <option value="Line">Line</option>
            </select>
            <select className="filter-select"><option>สินค้า</option></select>
            <select className="filter-select"><option>ประเภท</option></select>
            <select
              className="filter-select"
              value={miningStatus}
              onChange={(e) => setMiningStatus(e.target.value)}
            >
              <option value="">สถานะการขุด</option>
              <option value="0Mining">ยังไม่ขุด</option>
              <option value="Mining">ขุดแล้ว</option>
              <option value="returnCM">มีการตอบกลับ</option>
            </select>
            <div className="date-range-group">
              <input
                type="date"
                className="filter-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="วันที่เริ่มต้น"
              />
              <span className="date-separator">-</span>
              <input
                type="date"
                className="filter-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="วันที่สิ้นสุด"
              />
            </div>
            <button onClick={() => {
              setFilteredConversations([]);
              setDisappearTime("");
              setCustomerType("");
              setPlatformType("");
              setMiningStatus("");
              setStartDate("");
              setEndDate("");
            }}>
              ❌ ล้างตัวกรอง
            </button>
            <button className="filter-button" onClick={applyFilters}>🔍 ค้นหา</button>
          </div>
        )}

        {/* Enhanced Status Bar */}
        <div className="status-bar">
          {/* ข้อมูลการเชื่อมต่อ */}
          <div className="connection-info">
            <div className="status-badge">
              🔗 {selectedPage ? `เชื่อมต่อ: ${pages.find(p => p.id === selectedPage)?.name || 'ไม่ทราบชื่อ'}` : 'ยังไม่ได้เชื่อมต่อเพจ'}
            </div>
            
            {/* สถานะการอัปเดต */}
            <div className="status-update">
              {getUpdateStatus()}
            </div>
          </div>

          {/* ข้อมูลสถิติ */}
          <div className="stats-container">
            <div className="stat-item">
              <div className="stat-number">
                {displayData.length}
              </div>
              <div className="stat-label">การสนทนาทั้งหมด</div>
            </div>
            
            <div className="stat-item">
              <div className="stat-number selected">
                {selectedConversationIds.length}
              </div>
              <div className="stat-label">เลือกแล้ว</div>
            </div>
            
            <div className="stat-item">
              <div className="stat-number ready">
                {defaultMessages.length}
              </div>
              <div className="stat-label">ข้อความพร้อมส่ง</div>
            </div>

            {/* แสดงข้อความใหม่ */}
            {displayData.some(conv => 
              conv.last_user_message_time && 
              new Date(conv.last_user_message_time) > new Date(Date.now() - 10000) // 10 วินาที
            ) && (
              <div className="new-message-alert">
                🔴 มีข้อความใหม่!
              </div>
            )}
          </div>

          {/* ข้อมูลเวลา */}
          <div className="current-time">
            🕐 {currentTime.toLocaleTimeString('th-TH')}
          </div>
        </div>

        {/* Alert Bar สำหรับข้อมูลสำคัญ */}
        {!selectedPage && (
          <div className="alert-warning">
            <span>⚠️</span>
            <span>กรุณาเลือกเพจ Facebook เพื่อเริ่มใช้งานระบบขุดข้อมูล</span>
          </div>
        )}

        {selectedPage && conversations.length === 0 && !loading && (
          <div className="alert-info">
            <span>ℹ️</span>
            <span>ยังไม่มีข้อมูลการสนทนา กดปุ่ม "🔄 รีเฟรชข้อมูล" เพื่อโหลดข้อมูล</span>
          </div>
        )}

        {filteredConversations.length > 0 && (
          <div className="alert-success">
            <span>🔍</span>
            <span>กำลังแสดงผลการกรองข้อมูล: {filteredConversations.length} จาก {allConversations.length} การสนทนา</span>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ fontSize: "18px" }}>⏳ กำลังโหลดข้อมูล...</p>
          </div>
        ) : displayData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ fontSize: "18px", color: "#666" }}>
              {selectedPage ? "ไม่พบข้อมูลการสนทนา" : "กรุณาเลือกเพจเพื่อแสดงข้อมูล"}
            </p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#fff" }}>
            <thead>
              <tr>
                <th className="table">ลำดับ</th>
                <th className="table">ชื่อผู้ใช้</th>
                <th className="table">วันที่เข้ามา</th>
                <th className="table">ระยะเวลาที่หาย</th>
                <th className="table">Context</th>
                <th className="table">สินค้าที่สนใจ</th>
                <th className="table">Platform</th>
                <th className="table">หมวดหมู่ลูกค้า</th>
                <th className="table">สถานะการขุด</th>
                <th className="table">เลือก</th>
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
        )}

        <div style={{ marginTop: "15px", display: "flex", alignItems: "center", gap: "15px" }}>
          <button
            onClick={handOpenPopup}
            className={`button-default ${selectedConversationIds.length > 0 ? "button-active" : ""}`}
            disabled={loading || selectedConversationIds.length === 0}
          >
            📥 ขุด
          </button>

          {isPopupOpen && (
            <Popup
              selectedPage={selectedPage}
              onClose={handleClosePopup}
              defaultMessages={defaultMessages}
              onConfirm={handleConfirmPopup}
              count={selectedConversationIds.length}
            />
          )}
          <button onClick={handleloadConversations} className="Re-default" disabled={loading || !selectedPage}>
            {loading ? "⏳ กำลังโหลด..." : "🔄 รีเฟรชข้อมูล"}
          </button>
        </div>
      </main>
    </div>
  );
}

export default App;