import { useState, useEffect, useRef, useCallback } from "react";
import '../CSS/App.css';
import { fetchPages, connectFacebook, getMessagesBySetId, fetchConversations, getMessageSetsByPage } from "../Features/Tool";
import { Link } from 'react-router-dom';

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
  const [messageSets, setMessageSets] = useState([]);
  const [selectedMessageSetId, setSelectedMessageSetId] = useState("");
  const [showMessageSetSelector, setShowMessageSetSelector] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());
  const [sendingMessages, setSendingMessages] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  
  // Pagination states
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [itemsPerPage] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  
  const updateIntervalRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  // Memoized check for new messages
 // แก้ไขฟังก์ชัน checkForNewMessages - วิธีแก้แบบง่าย
const checkForNewMessages = useCallback(async () => {
  if (!selectedPage || loading) return;
  
  try {
    const response = await fetchConversations(selectedPage, 100, 0, false);
    
    // ตรวจสอบว่า response เป็น array หรือไม่
    const newConversations = Array.isArray(response) 
      ? response 
      : (response?.conversations && Array.isArray(response.conversations) 
          ? response.conversations 
          : []);

    // ตรวจสอบว่า allConversations เป็น array และมีข้อมูล
    if (!Array.isArray(allConversations) || !Array.isArray(newConversations) || newConversations.length === 0) {
      return;
    }

    const hasChanges = newConversations.some(newConv => {
      const oldConv = allConversations.find(c => c.conversation_id === newConv.conversation_id);
      if (!oldConv) return true;
      return newConv.last_user_message_time !== oldConv.last_user_message_time;
    });
    
    if (hasChanges) {
      console.log("🔔 พบข้อความใหม่! อัพเดทข้อมูล...");
      setConversations(newConversations);
      setAllConversations(newConversations);
      setLastUpdateTime(new Date());
      
      if (Notification.permission === "granted") {
        new Notification("มีข้อความใหม่!", {
          body: "มีลูกค้าส่งข้อความใหม่เข้ามา",
          icon: "/favicon.ico"
        });
      }
    }
  } catch (err) {
    console.error("ไม่สามารถตรวจสอบข้อความใหม่ได้:", err);
  }
}, [selectedPage, allConversations, loading]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    updateIntervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // อัพเดทเวลาในทุกๆ วินาที

    if (selectedPage) {
      pollingIntervalRef.current = setInterval(() => {
        checkForNewMessages();
      }, 1000); // เปลี่ยนเป็น 1 วินาที เพื่อลดโหลด
    }

    return () => {
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [selectedPage, checkForNewMessages]);

  useEffect(() => {
    const savedPage = localStorage.getItem("selectedPage");
    if (savedPage) {
      setSelectedPage(savedPage);
    }
    fetchPages()
      .then(setPages)
      .catch(err => console.error("ไม่สามารถโหลดเพจได้:", err));
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageIdFromURL = urlParams.get("page_id");
    if (pageIdFromURL) {
      setPageId(pageIdFromURL);
    }
  }, []);

  useEffect(() => {
    const loadMessageSets = async () => {
      if (selectedPage) {
        try {
          console.log(`🔄 กำลังโหลดชุดข้อความสำหรับ page_id: ${selectedPage}`);
          const sets = await getMessageSetsByPage(selectedPage);
          console.log(`✅ โหลดชุดข้อความสำเร็จ:`, sets);
          setMessageSets(sets);
          
          if (sets.length > 0) {
            setSelectedMessageSetId(sets[0].id.toString());
          }
        } catch (err) {
          console.error("โหลดชุดข้อความล้มเหลว:", err);
          setMessageSets([]);
        }
      } else {
        setMessageSets([]);
        setSelectedMessageSetId("");
      }
    };

    loadMessageSets();
  }, [selectedPage]);

  useEffect(() => {
    const loadMessages = async () => {
      if (selectedMessageSetId) {
        try {
          console.log(`🔄 กำลังโหลดข้อความจากชุด ID: ${selectedMessageSetId}`);
          const messages = await getMessagesBySetId(selectedMessageSetId);
          console.log(`✅ โหลดข้อความสำเร็จ:`, messages);
          setDefaultMessages(Array.isArray(messages) ? messages : []);
        } catch (err) {
          console.error("โหลดข้อความล้มเหลว:", err);
          setDefaultMessages([]);
        }
      } else {
        setDefaultMessages([]);
      }
    };

    loadMessages();
  }, [selectedMessageSetId]);

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

  const loadConversations = async (pageId, limit = itemsPerPage, offset = 0, useCache = true) => {
  if (!pageId) return;

  setLoading(true);
  try {
    console.log(`🚀 เริ่มโหลด conversations สำหรับ pageId: ${pageId}`);
    const response = await fetchConversations(pageId, limit, offset, useCache);
    
    // ตรวจสอบรูปแบบของ response
    let conversationsData = [];
    if (Array.isArray(response)) {
      conversationsData = response;
    } else if (response && Array.isArray(response.conversations)) {
      conversationsData = response.conversations;
    } else {
      console.error('Unexpected response format:', response);
      alert('ข้อมูลที่ได้รับไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      return;
    }
    
    if (offset === 0) {
      // ถ้าเป็นการโหลดหน้าแรก
      setConversations(conversationsData);
      setAllConversations(conversationsData);
      setTotalItems(response.total || conversationsData.length);
    } else {
      // ถ้าเป็นการโหลดหน้าถัดไป ให้ต่อกับข้อมูลเดิม
      setConversations(prev => [...prev, ...conversationsData]);
      setAllConversations(prev => [...prev, ...conversationsData]);
    }
    
    setLastUpdateTime(new Date());
    console.log(`✅ โหลด conversations สำเร็จ: ${conversationsData.length} รายการ`);
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
}; // ✅ ปิด function ที่ถูกต้อง

  useEffect(() => {
    if (selectedPage) {
      loadConversations(selectedPage, itemsPerPage, 0, true);
      setDisappearTime("");
      setCustomerType("");
      setPlatformType("");
      setMiningStatus("");
      setStartDate("");
      setEndDate("");
      setFilteredConversations([]);
      setSelectedConversationIds([]);
      setCurrentPageNum(1);
    }
  }, [selectedPage, itemsPerPage]);

  const handleloadConversations = () => {
    if (!selectedPage) {
      alert("กรุณาเลือกเพจ");
      return;
    }
    loadConversations(selectedPage, itemsPerPage, 0, false); // ไม่ใช้ cache
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
          case '1d':
            return diffDays <= 1;
          case '3d':
            return diffDays <= 3;
          case '7d':
            return diffDays <= 7;
          case '1m':
            return diffDays <= 30;
          case '3m':
            return diffDays <= 90;
          case '6m':
            return diffDays <= 180;
          case '1y':
            return diffDays <= 365;
          case 'over1y':
            return diffDays > 365;
          default:
            return true;
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
    setCurrentPageNum(1); // Reset to first page after filtering
  };

  const toggleCheckbox = (conversationId) => {
    setSelectedConversationIds((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId]
    );
  };

  const sendMessageToSelected = async () => {
    if (selectedConversationIds.length === 0) {
      alert("กรุณาเลือกการสนทนาที่ต้องการส่งข้อความ");
      return;
    }

    setShowMessageSetSelector(true);
  };

  const confirmSendMessages = async () => {
    if (!selectedMessageSetId) {
      alert("กรุณาเลือกชุดข้อความที่ต้องการส่ง");
      return;
    }

    if (defaultMessages.length === 0) {
      alert("ชุดข้อความที่เลือกไม่มีข้อความ กรุณาไปเพิ่มข้อความในชุดนี้ก่อน");
      return;
    }

    setShowMessageSetSelector(false);
    setSendingMessages(true);
    setSendProgress({ current: 0, total: selectedConversationIds.length * defaultMessages.length });

    let progressCount = 0;
    let successCount = 0;
    let failedCount = 0;

    try {
      for (const conversationId of selectedConversationIds) {
        const selectedConv = displayData.find(conv => conv.conversation_id === conversationId);
        const psid = selectedConv?.raw_psid;

        if (!psid) {
          console.error(`ไม่พบ PSID สำหรับ conversation: ${conversationId}`);
          failedCount++;
          continue;
        }

        for (const messageObj of defaultMessages) {
          let requestBody = { 
            type: messageObj.message_type || "text"
          };

          if (messageObj.message_type === 'text') {
            // ข้อความธรรมดา
            requestBody.message = messageObj.content || messageObj.message || messageObj;
          } // แก้ไขใน confirmSendMessages ส่วนที่จัดการ media
            else if (messageObj.message_type === 'image' || messageObj.message_type === 'video') {
              console.log('📎 Processing media message:', messageObj);
              
              // สำหรับ media
              if (messageObj.media_url) {
                // ใช้ media_url ที่มาจาก backend โดยตรง
                const fullUrl = `http://localhost:8000${messageObj.media_url}`;
                requestBody.message = fullUrl;
                requestBody.type = messageObj.message_type;
                console.log('📎 Using media_url:', fullUrl);
              } else if (messageObj.media_path) {
                // fallback ถ้าไม่มี media_url
                // ตรวจสอบว่า media_path มี [IMAGE] หรือ [VIDEO] prefix หรือไม่
                let cleanPath = messageObj.media_path;
                if (cleanPath.startsWith('[IMAGE] ')) {
                  cleanPath = cleanPath.replace('[IMAGE] ', '');
                } else if (cleanPath.startsWith('[VIDEO] ')) {
                  cleanPath = cleanPath.replace('[VIDEO] ', '');
                }
                
                const fullUrl = `http://localhost:8000/media/${cleanPath}`;
                requestBody.message = fullUrl;
                requestBody.type = messageObj.message_type;
                console.log('📎 Using cleaned media_path:', fullUrl);
              } else if (messageObj.content && (messageObj.content.includes('|') || messageObj.content.includes('/'))) {
                // ถ้า content มีรูปแบบ "path|filename" หรือเป็น path
                let mediaPath = messageObj.content;
                
                // ถ้ามี | ให้เอาส่วนแรก
                if (mediaPath.includes('|')) {
                  mediaPath = mediaPath.split('|')[0];
                }
                
                // ลบ prefix [IMAGE] หรือ [VIDEO] ถ้ามี
                if (mediaPath.startsWith('[IMAGE] ')) {
                  mediaPath = mediaPath.replace('[IMAGE] ', '');
                } else if (mediaPath.startsWith('[VIDEO] ')) {
                  mediaPath = mediaPath.replace('[VIDEO] ', '');
                }
                
                const fullUrl = `http://localhost:8000/media/${mediaPath}`;
                requestBody.message = fullUrl;
                requestBody.type = messageObj.message_type;
                console.log('📎 Using content path:', fullUrl);
              } else if (messageObj.media_data) {
                // ถ้ามี base64 data ให้ส่งไปด้วย
                requestBody.media_data = messageObj.media_data;
                requestBody.filename = messageObj.filename || 'media';
                requestBody.type = messageObj.message_type;
                console.log('📎 Using media_data (base64)');
              } else {
                console.error('❌ No media data available for:', messageObj);
                progressCount++;
                setSendProgress({ current: progressCount, total: selectedConversationIds.length * defaultMessages.length });
                continue;
              }
              
              console.log('📤 Final requestBody for media:', requestBody);
            }

          try {
            console.log(`📤 กำลังส่ง ${requestBody.type} ไปยัง PSID: ${psid}`, requestBody);
            
            const response = await fetch(`http://localhost:8000/send/${selectedPage}/${psid}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
              const errorData = await response.json();
              console.error(`❌ ส่งข้อความล้มเหลว: ${response.status}`, errorData);
              failedCount++;
            } else {
              successCount++;
              console.log(`✅ ส่ง ${requestBody.type} สำเร็จ`);
            }

            // อัพเดท progress
            progressCount++;
            setSendProgress({ current: progressCount, total: selectedConversationIds.length * defaultMessages.length });

            // หน่วงเวลาเพื่อไม่ให้ส่งเร็วเกินไป
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (error) {
            console.error("Error sending message:", error);
            failedCount++;
            progressCount++;
            setSendProgress({ current: progressCount, total: selectedConversationIds.length * defaultMessages.length });
          }
        }
      }

      // แสดงผลลัพธ์
      const selectedSetName = messageSets.find(set => set.id.toString() === selectedMessageSetId)?.set_name || "ไม่ทราบชื่อ";
      
      let resultMessage = `ส่งข้อความเสร็จสิ้น!\n`;
      resultMessage += `ชุดข้อความ: ${selectedSetName}\n`;
      resultMessage += `ส่งไปยัง ${selectedConversationIds.length} การสนทนา\n`;
      resultMessage += `จำนวน ${defaultMessages.length} ข้อความต่อคน\n`;
      resultMessage += `รวมทั้งสิ้น ${selectedConversationIds.length * defaultMessages.length} ข้อความ\n\n`;
      
      if (successCount > 0) {
        resultMessage += `✅ สำเร็จ: ${successCount} ข้อความ\n`;
      }
      if (failedCount > 0) {
        resultMessage += `❌ ล้มเหลว: ${failedCount} ข้อความ`;
      }
      
      alert(resultMessage);

      // รีเซ็ตค่าต่างๆ
      setSelectedConversationIds([]);
      
      // รีโหลดข้อมูล conversations
      if (selectedPage) {
        loadConversations(selectedPage, itemsPerPage, 0, false);
      }

    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการส่งข้อความ:", error);
      alert("เกิดข้อผิดพลาดในการส่งข้อความ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSendingMessages(false);
      setSendProgress({ current: 0, total: 0 });
    }
  };

  const getUpdateStatus = () => {
    const diffMs = currentTime - lastUpdateTime;
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return "🟢 อัพเดทล่าสุด";
    if (diffMin < 5) return "🟡 " + diffMin + " นาทีที่แล้ว";
    return "🔴 " + diffMin + " นาทีที่แล้ว";
  };

  // Pagination calculations
  const totalPages = Math.ceil(displayData.length / itemsPerPage);
  const startIndex = (currentPageNum - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = displayData.slice(startIndex, endIndex);

  const handlePageNumChange = (pageNum) => {
    setCurrentPageNum(pageNum);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <h3 className="sidebar-title">ช่องทางเชื่อมต่อ</h3>
        <button onClick={connectFacebook} className="BT">
          <svg width="15" height="20" viewBox="0 0 320 512" fill="#fff" className="fb-icon">
            <path d="M279.14 288l14.22-92.66h-88.91V127.91c0-25.35 12.42-50.06 52.24-50.06H293V6.26S259.5 0 225.36 0c-73.22 0-121 44.38-121 124.72v70.62H22.89V288h81.47v224h100.2V288z" />
          </svg>
        </button>
        <hr />
        <select
          value={selectedPage} onChange={handlePageChange} className="select-page"
        >
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2>📋 ตารางการขุด</h2>
          <p>ชื่อ User</p>
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

        <div style={{ margin: "10px 0", padding: "10px", backgroundColor: "#f0f8ff", borderRadius: "5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>📚 ชุดข้อความที่มี: {messageSets.length} ชุด</strong>
            
            {displayData.length > 0 && (
              <span style={{ marginLeft: "20px", color: "#666" }}>
                📊 มี: {displayData.length} การสนทนา 
              </span>
            )}
          </div>
          <div style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "15px" }}>
            <span>{getUpdateStatus()}</span>
            <span style={{ color: "#888" }}>
              🕐 {currentTime.toLocaleTimeString('th-TH')}
            </span>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ fontSize: "18px" }}>⏳ กำลังโหลดข้อมูล...</p>
          </div>
        ) : currentPageData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <p style={{ fontSize: "18px", color: "#666" }}>
              {selectedPage ? "ไม่พบข้อมูลการสนทนา" : "กรุณาเลือกเพจเพื่อแสดงข้อมูล"}
            </p>
          </div>
        ) : (
          <>
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
                {currentPageData.map((conv, idx) => (
                  <tr key={conv.conversation_id || idx}>
                    <td style={{ border: "1px solid #ccc", padding: "8px", textAlign: "center" }}>{startIndex + idx + 1}</td>
                    <td className="table">{conv.conversation_name || `บทสนทนาที่ ${startIndex + idx + 1}`}</td>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ marginTop: "20px", display: "flex", justifyContent: "center", gap: "5px" }}>
                <button
                  onClick={() => handlePageNumChange(currentPageNum - 1)}
                  disabled={currentPageNum === 1}
                  style={{
                    padding: "5px 10px",
                    border: "1px solid #ddd",
                    backgroundColor: currentPageNum === 1 ? "#f5f5f5" : "#fff",
                    cursor: currentPageNum === 1 ? "not-allowed" : "pointer"
                  }}
                >
                  ◀ ก่อนหน้า
                </button>
                
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPageNum <= 3) {
                    pageNum = i + 1;
                  } else if (currentPageNum >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPageNum - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageNumChange(pageNum)}
                      style={{
                        padding: "5px 10px",
                        border: "1px solid #ddd",
                        backgroundColor: currentPageNum === pageNum ? "#007bff" : "#fff",
                        color: currentPageNum === pageNum ? "#fff" : "#000",
                        cursor: "pointer"
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageNumChange(currentPageNum + 1)}
                  disabled={currentPageNum === totalPages}
                  style={{
                    padding: "5px 10px",
                    border: "1px solid #ddd",
                    backgroundColor: currentPageNum === totalPages ? "#f5f5f5" : "#fff",
                    cursor: currentPageNum === totalPages ? "not-allowed" : "pointer"
                  }}
                >
                  ถัดไป ▶
                </button>
                
                <span style={{ marginLeft: "20px", alignSelf: "center" }}>
                  หน้า {currentPageNum} จาก {totalPages}
                </span>
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={sendMessageToSelected}
            className={`button-default ${selectedConversationIds.length > 0 ? "button-active" : ""}`}
            disabled={loading || messageSets.length === 0 || sendingMessages}
          >
            {sendingMessages ? `⏳ กำลังส่ง... (${sendProgress.current}/${sendProgress.total})` : `📥 ขุด (${selectedConversationIds.length} รายการ)`}
          </button>
          <button onClick={handleloadConversations} className="Re-default" disabled={loading || !selectedPage}>
            {loading ? "⏳ กำลังโหลด..." : "🔄 รีเฟรชข้อมูล"}
          </button>

          {selectedConversationIds.length > 0 && messageSets.length === 0 && (
            <span style={{ color: "#ff6b6b" }}>
              ⚠️ ยังไม่มีชุดข้อความ กรุณาไปสร้างชุดข้อความก่อน
            </span>
          )}
        </div>

        {showMessageSetSelector && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000
          }}>
            <div style={{
              backgroundColor: "white",
              padding: "30px",
              borderRadius: "12px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
              minWidth: "400px",
              maxWidth: "600px"
            }}>
              <h3 style={{ marginTop: 0, marginBottom: "20px", color: "#2c3e50" }}>
                📨 เลือกชุดข้อความที่ต้องการส่ง
              </h3>
              
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                  ชุดข้อความ:
                </label>
                <select
                  value={selectedMessageSetId}
                  onChange={(e) => setSelectedMessageSetId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #ddd",
                    fontSize: "16px"
                  }}
                >
                  <option value="">-- เลือกชุดข้อความ --</option>
                  {messageSets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.set_name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedMessageSetId && defaultMessages.length > 0 && (
                <div style={{
                  backgroundColor: "#f8f9fa",
                  padding: "15px",
                  borderRadius: "8px",
                  marginBottom: "20px",
                  maxHeight: "200px",
                  overflowY: "auto"
                }}>
                  <strong>📝 ข้อความในชุด ({defaultMessages.length} ข้อความ):</strong>
                  <ol style={{ margin: "10px 0 0 0", paddingLeft: "20px" }}>
                    {defaultMessages.map((msg, index) => (
                      <li key={index} style={{ marginBottom: "5px" }}>
                        {msg.message_type === 'text' ? (
                          <span>{msg.content || msg.message}</span>
                        ) : (
                          <span style={{ color: "#666" }}>
                            [{msg.message_type.toUpperCase()}] {msg.filename || msg.content}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "20px"
              }}>
                <div style={{ color: "#666", fontSize: "14px" }}>
                  จะส่งไปยัง {selectedConversationIds.length} การสนทนา
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => setShowMessageSetSelector(false)}
                    style={{
                      padding: "8px 20px",
                      borderRadius: "6px",
                      border: "1px solid #ddd",
                      backgroundColor: "white",
                      cursor: "pointer",
                      fontSize: "16px"
                    }}
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={confirmSendMessages}
                    disabled={!selectedMessageSetId}
                    style={{
                      padding: "8px 20px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: selectedMessageSetId ? "#27ae60" : "#bdc3c7",
                      color: "white",
                      cursor: selectedMessageSetId ? "pointer" : "not-allowed",
                      fontSize: "16px",
                      fontWeight: "600"
                    }}
                  >
                    ยืนยันส่งข้อความ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;