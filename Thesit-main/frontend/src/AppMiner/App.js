import { useState, useEffect } from "react";
import '../CSS/App.css';
import { fetchPages, connectFacebook, getMessagesBySetId, fetchConversations } from "../Features/Tool";
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
  const [allConversations, setAllConversations] = useState([]); // ข้อมูลดิบ
  const [filteredConversations, setFilteredConversations] = useState([]); // ข้อมูลหลังกรอง
  const displayData = filteredConversations.length > 0 ? filteredConversations : conversations;
  const [pageId, setPageId] = useState("");
  const [selectedConversationIds, setSelectedConversationIds] = useState([]);
  const [defaultMessages, setDefaultMessages] = useState([]); // 🔥 เพิ่ม state สำหรับเก็บข้อความจาก DB

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

  // 🔥 โหลดข้อความเมื่อเปลี่ยน selectedPage
  useEffect(() => {
    const loadMessages = async () => {
      if (selectedPage) {
        try {
          console.log(`🔄 กำลังโหลดข้อความสำหรับ page_id: ${selectedPage}`);
          const data = await getMessagesBySetId(selectedPage);
          console.log(`✅ โหลดข้อความสำเร็จ:`, data);
          setDefaultMessages(Array.isArray(data) ? data : []);
        } catch (err) {
          console.error("โหลดข้อความล้มเหลว:", err);
          setDefaultMessages([]);
        }
      } else {
        setDefaultMessages([]);
      }
    };

    loadMessages();
  }, [selectedPage]);

  // ฟังก์ชันแปลงเวลาห่าง
  function timeAgo(dateString) {
    if (!dateString) return "-";
    const past = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - past.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 0) return "0 วินาทีที่แล้ว";
    if (diffSec < 60) return `${diffSec} วินาทีที่แล้ว`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} วันที่แล้ว`;
  }

  // 🚀 ฟังก์ชันโหลดข้อมูล conversations แบบใหม่ - ใช้ batch API เพื่อความเร็ว
  const loadConversations = async (pageId) => {
    if (!pageId) return;

    setLoading(true);
    try {
      console.log(`🚀 เริ่มโหลด conversations สำหรับ pageId: ${pageId}`);
      const conversations = await fetchConversations(pageId);
      setConversations(conversations);
      setAllConversations(conversations);
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

  // โหลดข้อมูลทันทีเมื่อเลือกเพจ
  useEffect(() => {
    if (selectedPage) {
      loadConversations(selectedPage);
      // ล้าง filter ทุกตัวเมื่อเปลี่ยนเพจ
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

  // ปุ่มขุด กดเพื่อโหลดข้อมูลซ้ำ
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

    // 🔥 แก้ไข filter: disappearTime ให้ใช้ last_user_message_time แทน updated_time
    if (disappearTime) {
      const now = new Date();
      filtered = filtered.filter(conv => {
        // ใช้เวลาข้อความล่าสุดของ User หากมี ถ้าไม่มีใช้ updated_time
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

    // ตัวอย่าง filter: customerType (สมมติใน conv มี customerType)
    if (customerType) {
      filtered = filtered.filter(conv => conv.customerType === customerType);
    }

    // ตัวอย่าง filter: platformType
    if (platformType) {
      filtered = filtered.filter(conv => conv.platform === platformType);
    }

    // ตัวอย่าง filter: miningStatus
    if (miningStatus) {
      filtered = filtered.filter(conv => conv.miningStatus === miningStatus);
    }

    // ตัวอย่าง filter: วันที่ (startDate - endDate)
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

  // 📌 Handle เช็ค/ไม่เช็ค
  const toggleCheckbox = (conversationId) => {
    setSelectedConversationIds((prev) =>
      prev.includes(conversationId)
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId]
    );
  };

  // 📤 ฟังก์ชันกดปุ่ม "ขุด" - ส่งข้อความทั้งหมดจากฐานข้อมูล
  const sendMessageToSelected = async () => {
    if (selectedConversationIds.length === 0) {
      alert("กรุณาเลือกการสนทนาที่ต้องการส่งข้อความ");
      return;
    }

    // 🔥 ตรวจสอบข้อความจากฐานข้อมูล
    if (defaultMessages.length === 0) {
      alert("ไม่มีข้อความที่บันทึกไว้ กรุณาไปตั้งค่าข้อความใน 'ตั้งค่าระบบขุด' ก่อน");
      return;
    }

    try {
      // วนลูปส่งข้อความไปยังแต่ละ conversation
      for (const conversationId of selectedConversationIds) {
        // หา PSID จาก conversation_id
        const selectedConv = displayData.find(conv => conv.conversation_id === conversationId);
        const psid = selectedConv?.raw_psid;

        if (!psid) {
          console.error(`ไม่พบ PSID สำหรับ conversation: ${conversationId}`);
          continue;
        }

        // ส่งข้อความทีละข้อความ
        for (const messageObj of defaultMessages) {
          const messageText = messageObj.message || messageObj; // รองรับทั้ง object และ string

          await fetch(`http://localhost:8000/send/${selectedPage}/${psid}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: messageText }),
          });

          // หน่วงเวลาเล็กน้อยระหว่างการส่งข้อความแต่ละข้อความ
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      alert(`ส่งข้อความเรียบร้อยแล้ว! ส่งไปยัง ${selectedConversationIds.length} การสนทนา จำนวน ${defaultMessages.length} ข้อความ`);

      // ล้างการเลือก checkbox หลังส่งเสร็จ
      setSelectedConversationIds([]);

    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการส่งข้อความ:", error);
      alert("เกิดข้อผิดพลาดในการส่งข้อความ กรุณาลองใหม่อีกครั้ง");
    }
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
            {/* ตัวกรองตามเดิม */}
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

        {/* 🔥 แสดงจำนวนข้อความที่จะส่ง */}
        <div style={{ margin: "10px 0", padding: "10px", backgroundColor: "#f0f8ff", borderRadius: "5px" }}>
          <strong>📝 ข้อความที่จะส่ง: {defaultMessages.length} ข้อความ</strong>
          {displayData.length > 0 && (
            <span style={{ marginLeft: "20px", color: "#666" }}>
              📊 มี: {displayData.length} การสนทนา
            </span>
          )}
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
                  <td className="table" >
                    {/* 🔥 แสดงเวลาจากข้อความล่าสุดของ User */}
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

        {/* 🔥 ปุ่มขุดที่ปรับปรุงแล้ว */}
        <div style={{ marginTop: "15px", display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={sendMessageToSelected}
            className={`button-default ${selectedConversationIds.length > 0 ? "button-active" : ""}`}
            disabled={loading}
          >
            📥 ขุด ({selectedConversationIds.length} รายการ)

          </button>
          <button onClick={handleloadConversations} className="Re-default" disabled={loading || !selectedPage}>
            {loading ? "⏳ กำลังโหลด..." : "🔄 รีเฟรชข้อมูล"}
          </button>

          {selectedConversationIds.length > 0 && (
            <span style={{ color: "#666" }}>
              จะส่งข้อความ {defaultMessages.length} ข้อความ
            </span>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;