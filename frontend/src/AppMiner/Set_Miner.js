import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../CSS/Set_Miner.css';
import { fetchPages, connectFacebook } from "../Features/Tool";

function SetMiner() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");

  useEffect(() => {
    const savedPage = localStorage.getItem("selectedPage");
    if (savedPage) {
      setSelectedPage(savedPage);
    }
    fetchPages()
      .then(setPages)
      .catch(err => console.error("ไม่สามารถโหลดเพจได้:", err));
  }, []);

  const handlePageChange = (e) => {
    const pageId = e.target.value;
    setSelectedPage(pageId);
    localStorage.setItem("selectedPage", pageId);
  };

  return (
    <div className="app-container">
                <aside className="sidebar">
                    <div className="sidebar-header">
                        <h3 className="sidebar-title">
                            
                             📋 ตารางการขุด
                        </h3>
                    </div>
                    
                    <div className="connection-section">
                        <button onClick={connectFacebook} className="connect-btn facebook-btn">
                            <svg width="15" height="20" viewBox="0 0 320 512" fill="#fff" className="fb-icon">
                                <path d="M279.14 288l14.22-92.66h-88.91V127.91c0-25.35 12.42-50.06 52.24-50.06H293V6.26S259.5 0 225.36 0c-73.22 0-121 44.38-121 124.72v70.62H22.89V288h81.47v224h100.2V288z" />
                            </svg>
                            <span>เชื่อมต่อ Facebook</span>
                        </button>
                    </div>
    
                    <div className="page-selector-section">
                        <label className="select-label">เลือกเพจ</label>
                        <select value={selectedPage} onChange={handlePageChange} className="select-page">
                            <option value="">-- เลือกเพจ --</option>
                            {pages.map((page) => (
                                <option key={page.id} value={page.id}>
                                    {page.name}
                                </option>
                            ))}
                        </select>
                    </div>
    
                    <nav className="sidebar-nav">
                        <Link to="/App" className="nav-link">
                            <span className="nav-icon">🏠</span>
                            หน้าแรก
                        </Link>
                        <Link to="/Set_Miner" className="nav-link">
                            <span className="nav-icon">⚙️</span>
                            ตั้งค่าระบบขุด
                        </Link>
                        <a href="#" className="nav-link">
                            <span className="nav-icon">📊</span>
                            Dashboard
                        </a>
                        <a href="#" className="nav-link">
                            <span className="nav-icon">🔧</span>
                            Setting
                        </a>
                    </nav>
                </aside>

      {/* Main Content */}
      <div className="setminer-root">
        <div className="setminer-header">
          ตั้งค่าระบบขุด
        </div>
        <div className="setminer-main">
          <div className="setminer-card">
            <Link to="/manage-message-sets" className="Box" >Default</Link>
          </div>
          <div className="setminer-card">
            <Link to="/MinerGroup" className="Box" >ตามกลุ่ม/ลูกค้า</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SetMiner;