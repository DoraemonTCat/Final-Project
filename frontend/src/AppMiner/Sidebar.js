// frontend/src/AppMiner/Sidebar.js
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fetchPages, connectFacebook, fetchPageAdmin } from '../Features/Tool';
import '../CSS/Sidebar.css';

function Sidebar() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [adminInfo, setAdminInfo] = useState(null);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const loadPages = async () => {
      try {
        const pagesData = await fetchPages();
        setPages(pagesData);
        setIsConnected(pagesData.length > 0);
        
        const savedPage = localStorage.getItem("selectedPage");
        if (savedPage && pagesData.some(page => page.id === savedPage)) {
          setSelectedPage(savedPage);
          // โหลดข้อมูล admin เมื่อมี page ที่เลือก
          loadAdminInfo(savedPage);
        } else if (pagesData.length > 0) {
          // ถ้าไม่มี saved page ให้เลือก page แรก
          const firstPageId = pagesData[0].id;
          setSelectedPage(firstPageId);
          localStorage.setItem("selectedPage", firstPageId);
          loadAdminInfo(firstPageId);
        }
      } catch (err) {
        console.error("ไม่สามารถโหลดเพจได้:", err);
        setIsConnected(false);
      }
    };
    
    loadPages();
  }, []);

  const loadAdminInfo = async (pageId) => {
    if (!pageId) return;
    
    setLoadingAdmin(true);
    try {
      const adminData = await fetchPageAdmin(pageId);
      console.log("Admin data loaded:", adminData);
      setAdminInfo(adminData);
    } catch (err) {
      console.error("ไม่สามารถโหลดข้อมูล admin ได้:", err);
      // ใช้ default ถ้าโหลดไม่ได้
      setAdminInfo({
        primary_admin: {
          name: "Page Admin",
          role: "ADMIN",
          picture: null
        }
      });
    } finally {
      setLoadingAdmin(false);
    }
  };

  const handlePageChange = (e) => {
    const pageId = e.target.value;
    setSelectedPage(pageId);
    localStorage.setItem("selectedPage", pageId);
    
    // โหลดข้อมูล admin ใหม่เมื่อเปลี่ยน page
    loadAdminInfo(pageId);
    
    // Trigger a custom event to notify other components
    window.dispatchEvent(new CustomEvent('pageChanged', { detail: { pageId } }));
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Function to check if a path is active
  const isActive = (path) => {
    return location.pathname === path;
  };

  // Check if any dropdown item is active
  const isDropdownActive = () => {
    return ['/manage-message-sets', '/default', '/MinerGroup', '/GroupDefault', 
            '/GroupSchedule', '/schedule-dashboard'].some(path => isActive(path));
  };

  // ฟังก์ชันสำหรับแสดงชื่อ Admin
  const getAdminDisplayName = () => {
    if (loadingAdmin) return "กำลังโหลด...";
    if (!adminInfo || !adminInfo.primary_admin) return "Page Admin";
    
    const admin = adminInfo.primary_admin;
    // แสดงชื่อ หรือ fallback เป็น "Page Admin"
    return admin.name || "Page Admin";
  };



  // ฟังก์ชันสำหรับแสดงรูป Profile
  const getAdminAvatar = () => {
    if (adminInfo?.primary_admin?.picture) {
      return (
        <img 
          src={adminInfo.primary_admin.picture} 
          alt={adminInfo.primary_admin.name}
          className="admin-profile-pic"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      );
    }
    return <span className="avatar-icon">👤</span>;
  };

  return (
    <>
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Logo Section */}
        <div className="sidebar-logo">
          <div className="logo-icon">
            <span className="logo-emoji">⚡</span>
          </div>
          {!isSidebarCollapsed && (
            <div className="logo-text">
              <span className="logo-title">MinerBot</span>
              <span className="logo-subtitle">Miner Dashboard</span>
            </div>
          )}
        </div>

        {/* Connection Status */}
        <div className="connection-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {!isSidebarCollapsed && (
              <span className="status-text">
                {isConnected ? 'เชื่อมต่อแล้ว' : 'ยังไม่เชื่อมต่อ'}
              </span>
            )}
          </div>
        </div>
        
        {/* Connection Section */}
        <div className="connection-section">
          <button 
            onClick={connectFacebook} 
            className={`connect-btn facebook-btn ${isSidebarCollapsed ? 'collapsed' : ''}`}
            title="เชื่อมต่อ Facebook"
          >
            <svg width="20" height="20" viewBox="0 0 320 512" fill="#fff" className="fb-icon">
              <path d="M279.14 288l14.22-92.66h-88.91V127.91c0-25.35 12.42-50.06 52.24-50.06H293V6.26S259.5 
              0 225.36 0c-73.22 0-121 44.38-121 124.72v70.62H22.89V288h81.47v224h100.2V288z" />
            </svg>
            {!isSidebarCollapsed && <span>เชื่อมต่อ Facebook</span>}
          </button>
        </div>

        {/* Page Selector */}
        {isConnected && (
          <div className="page-selector-section">
            {!isSidebarCollapsed && <label className="select-label" style={{color:"white"}}>เลือกเพจ</label>}
            <div className="select-wrapper">
              <select 
                value={selectedPage} 
                onChange={handlePageChange} 
                className="select-page"
                title={isSidebarCollapsed ? "เลือกเพจ" : ""} style={{color:"white"}}
              >

                {pages.map((page) => (
                  <option key={page.id} value={page.id} >
                    {page.name}
                  </option>
                ))}
              </select>
              {selectedPage && (
                <div className="selected-page-indicator">
                  <span className="indicator-dot"></span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="sidebar-nav">
          <Link 
            to="/App" 
            className={`nav-link ${isActive('/App') || isActive('/') ? 'active' : ''}`}
            title={isSidebarCollapsed ? "หน้าแรก" : ""}
          >
            <span className="nav-icon">🏠</span>
            {!isSidebarCollapsed && <span className="nav-text" style={{color:"white"}}>หน้าแรก</span>}
            {(isActive('/App') || isActive('/')) && <span className="active-indicator"></span>}
          </Link>
          
          <div className="dropdown-container">
            <button 
              className={`dropdown-toggle ${isDropdownActive() ? 'active' : ''}`} 
              style={{color:"white"}}
              onClick={toggleDropdown}
              title={isSidebarCollapsed ? "ตั้งค่าระบบขุด" : ""}
            >
              <span className="menu-icon">⚙️</span>
              {!isSidebarCollapsed && (
                <>
                  <span className="menu-text">ตั้งค่าระบบขุด</span>
                  <span className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}>›</span>
                </>
              )}
            </button>
            
            <div className={`dropdown-menu ${isDropdownOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}>
              <Link 
                to="/manage-message-sets" 
                className={`dropdown-item ${isActive('/manage-message-sets') || isActive('/default') ? 'active' : ''}`}
                title={isSidebarCollapsed ? "Default" : ""}
              >
                <span className="dropdown-icon">📝</span>
                {!isSidebarCollapsed && <span>Default</span>}
              </Link>
              <Link 
                to="/MinerGroup" 
                className={`dropdown-item ${isActive('/MinerGroup') || isActive('/GroupDefault') || isActive('/GroupSchedule') ? 'active' : ''}`}
                title={isSidebarCollapsed ? "ตามกลุ่ม/ลูกค้า" : ""}
              >
                <span className="dropdown-icon">👥</span>
                {!isSidebarCollapsed && <span>ตามกลุ่ม/ลูกค้า</span>}
              </Link>
              <Link 
                to="/schedule-dashboard" 
                className={`dropdown-item ${isActive('/schedule-dashboard') ? 'active' : ''}`}
                title={isSidebarCollapsed ? "Dashboard กลุ่มลูกค้า" : ""}
              >
                <span className="dropdown-icon">📊</span>
                {!isSidebarCollapsed && <span>Dashboard กลุ่มลูกค้า</span>}
              </Link>
            </div>
          </div>
          
          <Link 
            to="#" 
            className={`nav-link`}
            title={isSidebarCollapsed ? "Dashboard" : ""}
          >
            <span className="nav-icon">📈</span>
            {!isSidebarCollapsed && <span className="nav-text" style={{color:"white"}}>Dashboard</span>}
          </Link>
          
          <Link 
            to="/settings" 
            className={`nav-link ${isActive('/settings') ? 'active' : ''}`}
            title={isSidebarCollapsed ? "Setting" : ""}
          >
            <span className="nav-icon">🔧</span>
            {!isSidebarCollapsed && <span className="nav-text" style={{color:"white"}}>Setting</span>}
            {isActive('/settings') && <span className="active-indicator"></span>}
          </Link>
        </nav>

        {/* User Profile Section - Updated with Admin Info */}
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar" style={{borderRadius:"8%", overflow:"hidden"}}>
              {getAdminAvatar()}
              <span className="avatar-icon" style={{ display: 'none' }}>👤</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="user-info">
                <span className="user-name" style={{color:"white"}}>
                  {getAdminDisplayName()}
                </span>
               
              </div>
            )}
          </div>       
        </div>
      </aside>

      {/* Overlay for mobile */}
      <div 
        className={`sidebar-overlay ${!isSidebarCollapsed ? 'active' : ''}`} 
        onClick={toggleSidebar}
      ></div>
    </>
  );
}

export default Sidebar;