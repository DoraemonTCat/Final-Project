import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../CSS/Settings.css';
import { fetchPages, connectFacebook } from "../Features/Tool";

function Settings() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showMessage, setShowMessage] = useState({ type: '', text: '', show: false });
  
  // Settings States
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem('appSettings');
    return savedSettings ? JSON.parse(savedSettings) : {
      // General Settings
      language: 'th',
      theme: 'light',
      fontSize: 'medium',
      primaryColor: '#667eea',
      
      // Notification Settings
      enableNotifications: true,
      notificationSound: true,
      desktopNotifications: true,
      emailNotifications: false,
      notificationVolume: 70,
      
      // Auto-send Settings
      autoSendEnabled: false,
      autoSendDelay: 5,
      autoSendLimit: 100,
      batchSize: 10,
      
      // Message Settings
      defaultMessageDelay: 1000,
      typingIndicator: true,
      readReceipts: true,
      messagePreview: true,
      
      // Display Settings
      compactMode: false,
      showTimestamps: true,
      showAvatars: true,
      animationsEnabled: true,
      sidebarPosition: 'left',
      
      // Data Settings
      autoRefreshInterval: 30,
      cacheEnabled: true,
      cacheDuration: 300,
      dataRetention: 30,
      
      // Privacy Settings
      saveHistory: true,
      anonymousMode: false,
      shareAnalytics: true,
      
      // Advanced Settings
      debugMode: false,
      apiTimeout: 30000,
      maxRetries: 3,
      logLevel: 'error'
    };
  });

  // บันทึกการตั้งค่าเมื่อมีการเปลี่ยนแปลง
  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
    applySettings(settings);
  }, [settings]);

  // Apply settings to the app
  const applySettings = (newSettings) => {
    // Theme
    document.documentElement.setAttribute('data-theme', newSettings.theme);
    
    // Font Size - เปลี่ยนเป็นใช้ class แทน
    document.body.classList.remove('font-size-small', 'font-size-medium', 'font-size-large', 'font-size-xlarge');
    document.body.classList.add(`font-size-${newSettings.fontSize}`);
    
    // Primary Color
    document.documentElement.style.setProperty('--primary-color', newSettings.primaryColor);
    
    // Language
    document.documentElement.setAttribute('lang', newSettings.language);
    
    // Compact Mode
    if (newSettings.compactMode) {
      document.body.classList.add('compact-mode');
    } else {
      document.body.classList.remove('compact-mode');
    }
    
    // Animations
    if (!newSettings.animationsEnabled) {
      document.body.classList.add('no-animations');
    } else {
      document.body.classList.remove('no-animations');
    }
  };

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
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const showNotification = (type, text) => {
    setShowMessage({ type, text, show: true });
    setTimeout(() => {
      setShowMessage({ type: '', text: '', show: false });
    }, 3000);
  };

  const saveSettings = () => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
    showNotification('success', 'บันทึกการตั้งค่าสำเร็จ!');
  };

  const resetSettings = () => {
    if (window.confirm('คุณต้องการรีเซ็ตการตั้งค่าทั้งหมดเป็นค่าเริ่มต้นหรือไม่?')) {
      localStorage.removeItem('appSettings');
      window.location.reload();
    }
  };



  return (
    <div className="app-container">
      {/* Sidebar */}
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
          
          <button className="dropdown-toggle" onClick={toggleDropdown}>
            <span>
              <span className="menu-icon">⚙️</span>
              ตั้งค่าระบบขุด
            </span>
            <span className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}></span>
          </button>
          <div className={`dropdown-menu ${isDropdownOpen ? 'open' : ''}`}>
            <Link to="/manage-message-sets" className="dropdown-item">▶ Default</Link>
            <Link to="/MinerGroup" className="dropdown-item">▶ ตามกลุ่ม/ลูกค้า</Link>
          </div>
          
          <a href="#" className="nav-link">
            <span className="nav-icon">📊</span>
            Dashboard
          </a>
          <Link to="/settings" className="nav-link">
            <span className="nav-icon">🔧</span>
            Setting
          </Link>
        </nav>
      </aside>

      {/* Main Settings Content */}
      <div className="settings-container">
        <div className="settings-header">
          <h1 className="settings-title">
            <span className="title-icon">⚙️</span>
            ตั้งค่าระบบ
          </h1>
          <p className="settings-subtitle">
            ปรับแต่งการทำงานของระบบให้เหมาะสมกับการใช้งานของคุณ
          </p>
        </div>

        <div className="settings-sections">
          {/* General Settings */}
          <div className="settings-section">
            <div className="section-header">
              <span className="section-icon">🌐</span>
              <div>
                <h2 className="section-title">การตั้งค่าทั่วไป</h2>
                <p className="section-description">ภาษา, ธีม และการแสดงผลพื้นฐาน</p>
              </div>
            </div>
            
            <div className="settings-group">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">ภาษา</div>
                  <div className="setting-description">เลือกภาษาที่ใช้ในระบบ</div>
                </div>
                <div className="setting-control">
                  <select 
                    className="setting-select"
                    value={settings.language}
                    onChange={(e) => updateSetting('language', e.target.value)}
                  >
                    <option value="th">ไทย</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">ธีมสี</div>
                  <div className="setting-description">เลือกธีมสีของระบบ</div>
                </div>
                <div className="setting-control">
                  <div className="theme-preview">
                    <div 
                      className={`theme-option ${settings.theme === 'light' ? 'selected' : ''}`}
                      onClick={() => updateSetting('theme', 'light')}
                    >
                      <div className="theme-icon">☀️</div>
                      <div className="theme-name">สว่าง</div>
                    </div>
                    <div 
                      className={`theme-option ${settings.theme === 'dark' ? 'selected' : ''}`}
                      onClick={() => updateSetting('theme', 'dark')}
                    >
                      <div className="theme-icon">🌙</div>
                      <div className="theme-name">มืด</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">ขนาดตัวอักษร</div>
                  <div className="setting-description">ปรับขนาดตัวอักษรทั้งระบบ</div>
                </div>
                <div className="setting-control">
                  <select 
                    className="setting-select"
                    value={settings.fontSize}
                    onChange={(e) => updateSetting('fontSize', e.target.value)}
                  >
                    <option value="small">เล็ก</option>
                    <option value="medium">ปกติ</option>
                    <option value="large">ใหญ่</option>
                    <option value="xlarge">ใหญ่มาก</option>
                  </select>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">สีหลักของระบบ</div>
                  <div className="setting-description">เลือกสีหลักที่ใช้ในระบบ</div>
                </div>
                <div className="setting-control">
                  <div className="color-picker-group">
                    <div 
                      className={`color-option ${settings.primaryColor === '#667eea' ? 'selected' : ''}`}
                      style={{ backgroundColor: '#667eea' }}
                      onClick={() => updateSetting('primaryColor', '#667eea')}
                    />
                    <div 
                      className={`color-option ${settings.primaryColor === '#3182ce' ? 'selected' : ''}`}
                      style={{ backgroundColor: '#3182ce' }}
                      onClick={() => updateSetting('primaryColor', '#3182ce')}
                    />
                    <div 
                      className={`color-option ${settings.primaryColor === '#48bb78' ? 'selected' : ''}`}
                      style={{ backgroundColor: '#48bb78' }}
                      onClick={() => updateSetting('primaryColor', '#48bb78')}
                    />
                    <div 
                      className={`color-option ${settings.primaryColor === '#ed8936' ? 'selected' : ''}`}
                      style={{ backgroundColor: '#ed8936' }}
                      onClick={() => updateSetting('primaryColor', '#ed8936')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="settings-section">
            <div className="section-header">
              <span className="section-icon">🔔</span>
              <div>
                <h2 className="section-title">การแจ้งเตือน</h2>
                <p className="section-description">ตั้งค่าการแจ้งเตือนต่างๆ</p>
              </div>
            </div>
            
            <div className="settings-group">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">เปิดใช้การแจ้งเตือน</div>
                  <div className="setting-description">แจ้งเตือนเมื่อมีข้อความใหม่</div>
                </div>
                <div className="setting-control">
                  <div 
                    className={`toggle-switch ${settings.enableNotifications ? 'active' : ''}`}
                    onClick={() => updateSetting('enableNotifications', !settings.enableNotifications)}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">เสียงแจ้งเตือน</div>
                  <div className="setting-description">เล่นเสียงเมื่อมีข้อความใหม่</div>
                </div>
                <div className="setting-control">
                  <div 
                    className={`toggle-switch ${settings.notificationSound ? 'active' : ''}`}
                    onClick={() => updateSetting('notificationSound', !settings.notificationSound)}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">ระดับเสียง</div>
                  <div className="setting-description">ปรับระดับเสียงแจ้งเตือน</div>
                </div>
                <div className="setting-control">
                  <input 
                    type="number"
                    className="setting-number"
                    value={settings.notificationVolume}
                    onChange={(e) => updateSetting('notificationVolume', parseInt(e.target.value))}
                    min="0"
                    max="100"
                  />
                  <span className="setting-unit">%</span>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">แจ้งเตือนบนเดสก์ท็อป</div>
                  <div className="setting-description">แสดงการแจ้งเตือนบนหน้าจอเดสก์ท็อป</div>
                </div>
                <div className="setting-control">
                  <div 
                    className={`toggle-switch ${settings.desktopNotifications ? 'active' : ''}`}
                    onClick={() => updateSetting('desktopNotifications', !settings.desktopNotifications)}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">แจ้งเตือนทางอีเมล</div>
                  <div className="setting-description">ส่งการแจ้งเตือนไปยังอีเมลของคุณ</div>
                </div>
                <div className="setting-control">
                  <div 
                    className={`toggle-switch ${settings.emailNotifications ? 'active' : ''}`}
                    onClick={() => updateSetting('emailNotifications', !settings.emailNotifications)}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Auto-send Settings */}
          <div className="settings-section">
            <div className="section-header">
              <span className="section-icon">🚀</span>
              <div>
                <h2 className="section-title">การส่งอัตโนมัติ</h2>
                <p className="section-description">ตั้งค่าการส่งข้อความอัตโนมัติ</p>
              </div>
            </div>
            
            <div className="settings-group">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">เปิดใช้การส่งอัตโนมัติ</div>
                  <div className="setting-description">ส่งข้อความอัตโนมัติตามที่ตั้งค่าไว้</div>
                </div>
                <div className="setting-control">
                  <div 
                    className={`toggle-switch ${settings.autoSendEnabled ? 'active' : ''}`}
                    onClick={() => updateSetting('autoSendEnabled', !settings.autoSendEnabled)}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">หน่วงเวลาระหว่างข้อความ</div>
                  <div className="setting-description">เวลารอระหว่างการส่งแต่ละข้อความ</div>
                </div>
                <div className="setting-control">
                  <input 
                    type="number"
                    className="setting-number"
                    value={settings.autoSendDelay}
                    onChange={(e) => updateSetting('autoSendDelay', parseInt(e.target.value))}
                    min="1"
                    max="60"
                  />
                  <span className="setting-unit">วินาที</span>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">จำกัดการส่งต่อวัน</div>
                  <div className="setting-description">จำนวนข้อความสูงสุดที่ส่งได้ต่อวัน</div>
                </div>
                <div className="setting-control">
                  <input 
                    type="number"
                    className="setting-number"
                    value={settings.autoSendLimit}
                    onChange={(e) => updateSetting('autoSendLimit', parseInt(e.target.value))}
                    min="1"
                    max="1000"
                  />
                  <span className="setting-unit">ข้อความ</span>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">ขนาดการส่งต่อรอบ</div>
                  <div className="setting-description">จำนวนข้อความที่ส่งในแต่ละรอบ</div>
                </div>
                <div className="setting-control">
                  <input 
                    type="number"
                    className="setting-number"
                    value={settings.batchSize}
                    onChange={(e) => updateSetting('batchSize', parseInt(e.target.value))}
                    min="1"
                    max="50"
                  />
                  <span className="setting-unit">ข้อความ</span>
                </div>
              </div>
            </div>
          </div>

          {/* Display Settings */}
          <div className="settings-section">
            <div className="section-header">
              <span className="section-icon">🎨</span>
              <div>
                <h2 className="section-title">การแสดงผล</h2>
                <p className="section-description">ปรับแต่งการแสดงผลต่างๆ</p>
              </div>
            </div>
            
            <div className="settings-group">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">โหมดกะทัดรัด</div>
                  <div className="setting-description">แสดงข้อมูลแบบกะทัดรัดเพื่อประหยัดพื้นที่</div>
                </div>
                <div className="setting-control">
                  <div 
                    className={`toggle-switch ${settings.compactMode ? 'active' : ''}`}
                    onClick={() => updateSetting('compactMode', !settings.compactMode)}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">แสดงเวลา</div>
                  <div className="setting-description">แสดงเวลาของข้อความ</div>
                </div>
                <div className="setting-control">
                  <div 
                    className={`toggle-switch ${settings.showTimestamps ? 'active' : ''}`}
                    onClick={() => updateSetting('showTimestamps', !settings.showTimestamps)}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">แสดงรูปโปรไฟล์</div>
                  <div className="setting-description">แสดงรูปโปรไฟล์ของผู้ใช้</div>
                </div>
                <div className="setting-control">
                  <div 
                    className={`toggle-switch ${settings.showAvatars ? 'active' : ''}`}
                    onClick={() => updateSetting('showAvatars', !settings.showAvatars)}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">เปิดใช้แอนิเมชั่น</div>
                  <div className="setting-description">แสดงแอนิเมชั่นต่างๆ ในระบบ</div>
                </div>
                <div className="setting-control">
                  <div 
                    className={`toggle-switch ${settings.animationsEnabled ? 'active' : ''}`}
                    onClick={() => updateSetting('animationsEnabled', !settings.animationsEnabled)}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Data & Privacy Settings */}
          <div className="settings-section">
            <div className="section-header">
              <span className="section-icon">🔐</span>
              <div>
                <h2 className="section-title">ข้อมูลและความเป็นส่วนตัว</h2>
                <p className="section-description">จัดการข้อมูลและความเป็นส่วนตัว</p>
              </div>
            </div>
            
            <div className="settings-group">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">บันทึกประวัติ</div>
                  <div className="setting-description">บันทึกประวัติการสนทนาและกิจกรรม</div>
                </div>
                <div className="setting-control">
                  <div 
                    className={`toggle-switch ${settings.saveHistory ? 'active' : ''}`}
                    onClick={() => updateSetting('saveHistory', !settings.saveHistory)}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">โหมดไม่ระบุตัวตน</div>
                  <div className="setting-description">ซ่อนข้อมูลส่วนตัวในการใช้งาน</div>
                </div>
                <div className="setting-control">
                  <div 
                    className={`toggle-switch ${settings.anonymousMode ? 'active' : ''}`}
                    onClick={() => updateSetting('anonymousMode', !settings.anonymousMode)}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">เก็บข้อมูล</div>
                  <div className="setting-description">ระยะเวลาในการเก็บข้อมูล</div>
                </div>
                <div className="setting-control">
                  <input 
                    type="number"
                    className="setting-number"
                    value={settings.dataRetention}
                    onChange={(e) => updateSetting('dataRetention', parseInt(e.target.value))}
                    min="1"
                    max="365"
                  />
                  <span className="setting-unit">วัน</span>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="settings-section">
            <div className="section-header">
              <span className="section-icon">🛠️</span>
              <div>
                <h2 className="section-title">การตั้งค่าขั้นสูง</h2>
                <p className="section-description">สำหรับผู้ใช้ที่มีความชำนาญ</p>
              </div>
            </div>
            
            <div className="settings-group">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">โหมดดีบัก</div>
                  <div className="setting-description">แสดงข้อมูลการทำงานเพื่อการแก้ไขปัญหา</div>
                </div>
                <div className="setting-control">
                  <div 
                    className={`toggle-switch ${settings.debugMode ? 'active' : ''}`}
                    onClick={() => updateSetting('debugMode', !settings.debugMode)}
                  >
                    <div className="toggle-slider" />
                  </div>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">API Timeout</div>
                  <div className="setting-description">ระยะเวลารอการตอบสนองจาก API</div>
                </div>
                <div className="setting-control">
                  <input 
                    type="number"
                    className="setting-number"
                    value={settings.apiTimeout / 1000}
                    onChange={(e) => updateSetting('apiTimeout', parseInt(e.target.value) * 1000)}
                    min="10"
                    max="120"
                  />
                  <span className="setting-unit">วินาที</span>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">จำนวนครั้งลองใหม่</div>
                  <div className="setting-description">จำนวนครั้งที่พยายามใหม่เมื่อเกิดข้อผิดพลาด</div>
                </div>
                <div className="setting-control">
                  <input 
                    type="number"
                    className="setting-number"
                    value={settings.maxRetries}
                    onChange={(e) => updateSetting('maxRetries', parseInt(e.target.value))}
                    min="0"
                    max="10"
                  />
                  <span className="setting-unit">ครั้ง</span>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-label">ระดับการบันทึก Log</div>
                  <div className="setting-description">เลือกระดับการบันทึก log ของระบบ</div>
                </div>
                <div className="setting-control">
                  <select 
                    className="setting-select"
                    value={settings.logLevel}
                    onChange={(e) => updateSetting('logLevel', e.target.value)}
                  >
                    <option value="error">Error</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="settings-actions">
          <button onClick={saveSettings} className="action-btn save-btn">
            💾 บันทึกการตั้งค่า
          </button>
          <button onClick={resetSettings} className="action-btn reset-btn">
            🔄 รีเซ็ตเป็นค่าเริ่มต้น
          </button>
         
        </div>

        {/* Toast Message */}
        {showMessage.show && (
          <div className={`message-toast message-${showMessage.type}`}>
            {showMessage.text}
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;