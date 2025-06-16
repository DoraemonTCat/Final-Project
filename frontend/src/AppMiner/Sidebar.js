// frontend/src/components/Sidebar.js
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fetchPages, connectFacebook } from '../Features/Tool';
import '../CSS/Sidebar.css';


function Sidebar() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const loadPages = async () => {
      try {
        const pagesData = await fetchPages();
        setPages(pagesData);
        
        const savedPage = localStorage.getItem("selectedPage");
        if (savedPage && pagesData.some(page => page.id === savedPage)) {
          setSelectedPage(savedPage);
        }
      } catch (err) {
        console.error("ไม่สามารถโหลดเพจได้:", err);
      }
    };
    
    loadPages();
  }, []);

  const handlePageChange = (e) => {
    const pageId = e.target.value;
    setSelectedPage(pageId);
    localStorage.setItem("selectedPage", pageId);
    
    // Trigger a custom event to notify other components
    window.dispatchEvent(new CustomEvent('pageChanged', { detail: { pageId } }));
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // Function to check if a path is active
  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
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
        <Link to="/App" className={`nav-link ${isActive('/App') || isActive('/') ? 'active' : ''}`}>
          <span className="nav-icon">🏠</span>
          หน้าแรก
        </Link>
        
        <button className="dropdown-toggle" onClick={toggleDropdown}>
          <span>
            <span className="menu-icon">⚙️</span>
            ตั้งค่าระบบขุด
          </span>
          
        </button>
        
        <div className={`dropdown-menu ${isDropdownOpen ? 'open' : ''}`}>
          <Link 
            to="/manage-message-sets" 
            className={`dropdown-item ${isActive('/manage-message-sets') || isActive('/default') ? 'active' : ''}`}
          >
            ▶ Default
          </Link>
          <Link 
            to="/MinerGroup" 
            className={`dropdown-item ${isActive('/MinerGroup') || isActive('/GroupDefault') || isActive('/GroupSchedule') ? 'active' : ''}`}
          >
            ▶ ตามกลุ่ม/ลูกค้า
          </Link>
        </div>
        
        <a href="#" className="nav-link">
          <span className="nav-icon">📊</span>
          Dashboard
        </a>
        
        <Link to="/settings" className={`nav-link ${isActive('/settings') ? 'active' : ''}`}>
          <span className="nav-icon">🔧</span>
          Setting
        </Link>
      </nav>
    </aside>
  );
}

export default Sidebar;