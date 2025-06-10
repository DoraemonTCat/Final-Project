import { useState, useEffect, useRef } from "react";
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
  
  const updateIntervalRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  const checkForNewMessages = async () => {
    if (!selectedPage) return;
    
    try {
      const newConversations = await fetchConversations(selectedPage);
      
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
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    updateIntervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);

    if (selectedPage) {
      pollingIntervalRef.current = setInterval(() => {
        checkForNewMessages();
      }, 30000);
    }

    return () => {
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [selectedPage, allConversations]);

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

  const loadConversations = async (pageId) => {
    if (!pageId) return;

    setLoading(true);
    try {
      console.log(`🚀 เริ่มโหลด conversations สำหรับ pageId: ${pageId}`);
      const conversations = await fetchConversations(pageId);
      setConversations(conversations);
      setAllConversations(conversations);
      setLastUpdateTime(new Date());
      console.log(`✅ โหลด conversations สำเร็จ: ${conversations.length} รายการ`);
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

  useEffect(() => {
    if (selectedPage) {
      loadConversations(selectedPage);
      setDisappearTime("");
      setCustomerType("");
      setPlatformType("");
      setMiningStatus("");
      setStartDate("");
      setEndDate("");
      setFilteredConversations([]);
      setSelectedConversationIds([]);
    }
  }, [selectedPage]);

  const handleloadConversations = () => {
    if (!selectedPage) {
      alert("กรุณาเลือกเพจ");
      return;
    }
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

    try {
      for (const conversationId of selectedConversationIds) {
        const selectedConv = displayData.find(conv => conv.conversation_id === conversationId);
        const psid = selectedConv?.raw_psid;

        if (!psid) {
          console.error(`ไม่พบ PSID สำหรับ conversation: ${conversationId}`);
          continue;
        }

        for (const messageObj of defaultMessages) {
          const messageText = messageObj.content || messageObj.message || messageObj;

          await fetch(`http://localhost:8000/send/${selectedPage}/${psid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: messageText }),
          });

          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const selectedSetName = messageSets.find(set => set.id.toString() === selectedMessageSetId)?.set_name || "ไม่ทราบชื่อ";
      alert(`ส่งข้อความเรียบร้อยแล้ว!\nชุดข้อความ: ${selectedSetName}\nส่งไปยัง ${selectedConversationIds.length} การสนทนา\nจำนวน ${defaultMessages.length} ข้อความ`);

      setSelectedConversationIds([]);

    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการส่งข้อความ:", error);
      alert("เกิดข้อผิดพลาดในการส่งข้อความ กรุณาลองใหม่อีกครั้ง");
    }
  };

  const getUpdateStatus = () => {
    const diffMs = currentTime - lastUpdateTime;
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return "🟢 อัพเดทล่าสุด";
    if (diffMin < 5) return "🟡 " + diffMin + " นาทีที่แล้ว";
    return "🔴 " + diffMin + " นาทีที่แล้ว";
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

        <div style={{ marginTop: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={sendMessageToSelected}
            className={`button-default ${selectedConversationIds.length > 0 ? "button-active" : ""}`}
            disabled={loading || messageSets.length === 0}
          >
            📥 ขุด ({selectedConversationIds.length} รายการ)
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
                            [{msg.message_type.toUpperCase()}] {msg.content}
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