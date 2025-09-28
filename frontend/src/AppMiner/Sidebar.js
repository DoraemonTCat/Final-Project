// frontend/src/AppMiner/Sidebar.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { fetchPages, connectFacebook, fetchPageAdmin } from '../Features/Tool';
import '../CSS/Sidebar.css';

// Constants
const DROPDOWN_PATHS = [
  '/manage-message-sets',
  '/default',
  '/MinerGroup',
  '/GroupDefault',
  '/GroupSchedule',
  '/schedule-dashboard'
];

const DEFAULT_ADMIN_INFO = {
  primary_admin: {
    name: "Page Admin",
    role: "ADMIN",
    picture: null
  }
};

const NAV_ITEMS = [
  { path: '/App', icon: '🏠', text: 'หน้าแรก', checkRoot: true },
  { path: '/dashboard', icon: '📈', text: 'Dashboard' },
  { path: '/settings', icon: '🔧', text: 'Setting' }
];

const DROPDOWN_ITEMS = [
  { 
    path: '/manage-message-sets', 
    icon: '📝', 
    text: 'Default',
    additionalActive: ['/default']
  },
  { 
    path: '/MinerGroup', 
    icon: '👥', 
    text: 'ตามกลุ่ม/ลูกค้า',
    additionalActive: ['/GroupDefault', '/GroupSchedule']
  },
  { 
    path: '/schedule-dashboard', 
    icon: '📊', 
    text: 'Dashboard กลุ่มลูกค้า'
  }
];

function Sidebar() {
  const [state, setState] = useState({
    pages: [],
    selectedPage: "",
    isDropdownOpen: false,
    isSidebarCollapsed: false,
    isConnected: false,
    adminInfo: null,
    loadingAdmin: false
  });
  
  const location = useLocation();

  // Memoized functions
  const isActive = useCallback((path, checkRoot = false) => {
    const isPathActive = location.pathname === path;
    if (checkRoot && location.pathname === '/') {
      return path === '/App';
    }
    return isPathActive;
  }, [location.pathname]);

  const isDropdownActive = useMemo(() => {
    return DROPDOWN_PATHS.some(path => location.pathname === path);
  }, [location.pathname]);

  // Load admin info
  const loadAdminInfo = useCallback(async (pageId) => {
    if (!pageId) return;
    
    setState(prev => ({ ...prev, loadingAdmin: true }));
    try {
      const adminData = await fetchPageAdmin(pageId);
      console.log("Admin data loaded:", adminData);
      setState(prev => ({ ...prev, adminInfo: adminData, loadingAdmin: false }));
    } catch (err) {
      console.error("ไม่สามารถโหลดข้อมูล admin ได้:", err);
      setState(prev => ({ 
        ...prev, 
        adminInfo: DEFAULT_ADMIN_INFO, 
        loadingAdmin: false 
      }));
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadPages = async () => {
      try {
        const pagesData = await fetchPages();
        const isConnected = pagesData.length > 0;
        
        let selectedPageId = "";
        const savedPage = localStorage.getItem("selectedPage");
        
        if (savedPage && pagesData.some(page => page.id === savedPage)) {
          selectedPageId = savedPage;
        } else if (pagesData.length > 0) {
          selectedPageId = pagesData[0].id;
          localStorage.setItem("selectedPage", selectedPageId);
        }
        
        setState(prev => ({
          ...prev,
          pages: pagesData,
          isConnected,
          selectedPage: selectedPageId
        }));
        
        if (selectedPageId) {
          loadAdminInfo(selectedPageId);
        }
      } catch (err) {
        console.error("ไม่สามารถโหลดเพจได้:", err);
        setState(prev => ({ ...prev, isConnected: false }));
      }
    };
    
    loadPages();
  }, [loadAdminInfo]);

  // Event handlers
  const handlePageChange = useCallback((e) => {
    const pageId = e.target.value;
    setState(prev => ({ ...prev, selectedPage: pageId }));
    localStorage.setItem("selectedPage", pageId);
    loadAdminInfo(pageId);
    window.dispatchEvent(new CustomEvent('pageChanged', { detail: { pageId } }));
  }, [loadAdminInfo]);

  const toggleDropdown = useCallback(() => {
    setState(prev => ({ ...prev, isDropdownOpen: !prev.isDropdownOpen }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setState(prev => ({ ...prev, isSidebarCollapsed: !prev.isSidebarCollapsed }));
  }, []);

  // Display helpers
  const getAdminDisplayName = useMemo(() => {
    if (state.loadingAdmin) return "กำลังโหลด...";
    if (!state.adminInfo?.primary_admin) return "Page Admin";
    return state.adminInfo.primary_admin.name || "Page Admin";
  }, [state.loadingAdmin, state.adminInfo]);

  const getAdminAvatar = useCallback(() => {
    if (state.adminInfo?.primary_admin?.picture) {
      return (
        <img 
          src={state.adminInfo.primary_admin.picture} 
          alt={state.adminInfo.primary_admin.name}
          className="admin-profile-pic"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      );
    }
    return <span className="avatar-icon">👤</span>;
  }, [state.adminInfo]);

  // Render helpers
  const renderNavLink = useCallback((item) => {
    const active = isActive(item.path, item.checkRoot);
    return (
      <Link 
        key={item.path}
        to={item.path}
        className={`nav-link ${active ? 'active' : ''}`}
        title={state.isSidebarCollapsed ? item.text : ""}
      >
        <span className="nav-icon">{item.icon}</span>
        {!state.isSidebarCollapsed && <span className="nav-text" style={{color:"white"}}>{item.text}</span>}
        {active && <span className="active-indicator"></span>}
      </Link>
    );
  }, [state.isSidebarCollapsed, isActive]);

  const renderDropdownItem = useCallback((item) => {
    const active = isActive(item.path) || 
                   (item.additionalActive && item.additionalActive.some(p => isActive(p)));
    
    return (
      <Link 
        key={item.path}
        to={item.path}
        className={`dropdown-item ${active ? 'active' : ''}`}
        title={state.isSidebarCollapsed ? item.text : ""}
      >
        <span className="dropdown-icon">{item.icon}</span>
        {!state.isSidebarCollapsed && <span>{item.text}</span>}
      </Link>
    );
  }, [state.isSidebarCollapsed, isActive]);

  const { 
    pages, 
    selectedPage, 
    isDropdownOpen, 
    isSidebarCollapsed, 
    isConnected 
  } = state;

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
                title={isSidebarCollapsed ? "เลือกเพจ" : ""} 
                style={{color:"white"}}
              >
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
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
          {renderNavLink(NAV_ITEMS[0])}
          
          <div className="dropdown-container">
            <button 
              className={`dropdown-toggle ${isDropdownActive ? 'active' : ''}`} 
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
              {DROPDOWN_ITEMS.map(renderDropdownItem)}
            </div>
          </div>
          
          {NAV_ITEMS.slice(1).map(renderNavLink)}
        </nav>

        {/* User Profile Section */}
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar" style={{borderRadius:"8%", overflow:"hidden"}}>
              {getAdminAvatar()}
              <span className="avatar-icon" style={{ display: 'none' }}>👤</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="user-info">
                <span className="user-name" style={{color:"white"}}>
                  {getAdminDisplayName}
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