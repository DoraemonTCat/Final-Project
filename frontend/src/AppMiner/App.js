import { useState, useEffect, useCallback, useRef } from "react";
import '../CSS/App.css';
import { fetchPages, connectFacebook, getMessagesBySetId, fetchConversations } from "../Features/Tool";
import { Link } from 'react-router-dom';
import Popup from "./MinerPopup";

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
  const displayData = filteredConversations.length > 0 ? filteredConversations : conversations;
  const [pageId, setPageId] = useState("");
  const [selectedConversationIds, setSelectedConversationIds] = useState([]);
  const [defaultMessages, setDefaultMessages] = useState([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedMessageSetIds, setSelectedMessageSetIds] = useState([]);

  // 🔥 State สำหรับ realtime และ cache
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());
  const updateIntervalRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  
  // 🚀 Cache สำหรับเก็บข้อมูลที่โหลดแล้ว
  const messageCache = useRef({});
  const conversationCache = useRef({});
  const cacheTimeout = 5 * 60 * 1000; // 5 นาที

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

  useEffect(() => {
    const savedPage = localStorage.getItem("selectedPage");
    if (savedPage) {
      setSelectedPage(savedPage);
    }
    
    // 🚀 โหลด pages แบบ async
    fetchPages()
      .then(setPages)
      .catch(err => console.error("ไม่สามารถโหลดเพจได้:", err));

    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
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
      // โหลดข้อมูลทั้งหมดพร้อมกัน
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
    // ตรวจสอบ cache ก่อน
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

  // ฟังก์ชันแปลงเวลาห่าง
  const timeAgo = (dateString) => {
    if (!dateString) return "-";
    
    const past = new Date(dateString);
    const now = currentTime;
    const diffMs = now.getTime() - past.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 0) return "0 วินาทีที่แล้ว";
    if (diffSec < 60) return `${diffSec} วินาทีที่แล้ว`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay} วันที่แล้ว`;
    const diffWeek = Math.floor(diffDay / 7);
    if (diffWeek < 4) return `${diffWeek} สัปดาห์ที่แล้ว`;
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return `${diffMonth} เดือนที่แล้ว`;
    const diffYear = Math.floor(diffDay / 365);
    return `${diffYear} ปีที่แล้ว`;
  };

  // 🚀 ฟังก์ชันตรวจสอบข้อความใหม่ที่ปรับปรุงแล้ว
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
        setCurrentTime(new Date());
        
        // Clear cache เมื่อมีข้อมูลใหม่
        conversationCache.current = {};
        
        if (filteredConversations.length > 0) {
          setTimeout(() => applyFilters(), 100);
        }
        
        if (Notification.permission === "granted") {
          new Notification("มีข้อความใหม่!", {
            body: "มีลูกค้าส่งข้อความใหม่เข้ามา",
            icon: "/favicon.ico"
          });
        }
      }
    } catch (err) {
      console.error("❌ เกิดข้อผิดพลาดในการตรวจสอบ:", err);
    }
  }, [selectedPage, allConversations, loading, filteredConversations]);

  // useEffect สำหรับ realtime polling
  useEffect(() => {
    updateIntervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // อัปเดตเวลาในทุกๆ วินาที

    if (selectedPage) {
      pollingIntervalRef.current = setInterval(() => {
        checkForNewMessages();
      }, 5000); // เพิ่มเป็น 10 วินาทีเพื่อลดภาระ server
    }

    return () => {
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [selectedPage, checkForNewMessages]);

  // 🚀 ฟังก์ชันโหลด conversations ที่ปรับปรุงแล้ว
  const loadConversations = async (pageId) => {
    if (!pageId) return;

    // ตรวจสอบ cache ก่อน
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

  const handlePageChange = (e) => {
    const pageId = e.target.value;
    setSelectedPage(pageId);
    localStorage.setItem("selectedPage", pageId);
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

  const toggleCheckbox = (conversationId) => {
    setSelectedConversationIds((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId]
    );
  };

  const handOpenPopup = () => {
    setIsPopupOpen(true);
  };

  const handleClosePopup = () => {
    setIsPopupOpen(false);
  };

  // 🚀 ฟังก์ชันส่งข้อความที่ปรับปรุงให้ส่งตามลำดับ
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

    // 🚀 วนลูปส่งข้อความสำหรับแต่ละ conversation
    for (const conversationId of selectedConversationIds) {
      const selectedConv = displayData.find(conv => conv.conversation_id === conversationId);
      const psid = selectedConv?.raw_psid;

      if (!psid) {
        failCount++;
        continue;
      }

      try {
        // 🔥 ส่งข้อความทีละชุดตามลำดับ
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

          // 🔥 หน่วงเวลาระหว่างชุดข้อความ (1 วินาที)
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
      // 🔥 เคลียร์ checkbox ที่เลือกไว้หลังส่งสำเร็จ
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
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      
      {/* Sidebar */}
      <aside className="sidebar">
        <h3 className="sidebar-title">ช่องทางเชื่อมต่อ</h3>
        <button onClick={connectFacebook} className="BT">
          <svg width="15" height="20" viewBox="0 0 320 512" fill="#fff" className="fb-icon">
            <path d="M279.14 288l14.22-92.66h-88.91V127.91c0-25.35 12.42-50.06 52.24-50.06H293V6.26S259.5 0 225.36 0c-73.22 0-121 44.38-121 124.72v70.62H22.89V288h81.47v224h100.2V288z" />
          </svg>
        </button>
        <hr />
        <select value={selectedPage} onChange={handlePageChange} className="select-page">
          <option value="">-- เลือกเพจ --</option>
          {pages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.name}
            </option>
          ))}
        </select>
        <Link to="/App" className="title" style={{ marginLeft: "64px" }}>หน้าแรก</Link><br />
        <Link to="/Set_Miner" className="title" style={{ marginLeft: "50px" }}>ตั้งค่าระบบขุด</Link><br />
        <a href="#" className="title" style={{ marginLeft: "53px" }}>Dashboard</a><br />
        <a href="#" className="title" style={{ marginLeft: "66px" }}>Setting</a><br />
      </aside>

      {/* Main Dashboard */}
      <main className="main-dashboard">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px"}}>
          <h2>📋 ตารางการขุด</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>     
            <p>ชื่อ User</p>
          </div>
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
                new Date(conv.last_user_message_time) > new Date(Date.now() - 10000) //  5 วินาที
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
                  <td className="table" style={{
                      backgroundColor: conv.last_user_message_time && 
                        new Date(conv.last_user_message_time) > new Date(Date.now() - 60000) 
                        ? '#e8f5e9' : 'transparent'
                    }}>
                      {conv.last_user_message_time
                        ? timeAgo(conv.last_user_message_time)
                        : timeAgo(conv.updated_time)
                      }
                    </td>
                  <td className="table">Context</td>
                  <td className="table">สินค้าที่สนใจ</td>
                  <td className="table">Platform</td>
                  <td className="table">หมวดหมู่ลูกค้า</td>
                  <td className="table">สถานะการขุด</td>
                  <td className="table">
                    <input
                      type="checkbox"
                      checked={selectedConversationIds.includes(conv.conversation_id)}
                      onChange={() => toggleCheckbox(conv.conversation_id)}
                    />
                  </td>
                </tr>
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
            📥 ขุด {/*({selectedConversationIds.length} รายการ)*/}
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