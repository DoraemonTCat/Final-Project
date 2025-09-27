import React, { useState, useEffect } from 'react';
import '../CSS/Settings.css';
import Sidebar from "./Sidebar"; 

function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Settings States
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem('appSettings');
    return savedSettings ? JSON.parse(savedSettings) : {
      // General Settings
      language: 'th',
      theme: 'light',
      fontSize: 'medium',
      primaryColor: '#667eea',
      accentColor: '#48bb78',
      
      // Display Settings
      sidebarPosition: 'left',
      sidebarWidth: 'normal',
      compactMode: false,
      showTimestamps: true,
      showAvatars: true,
      animationsEnabled: true,
      highContrast: false,
      
      // Notification Settings
      enableNotifications: true,
      notificationSound: true,
      desktopNotifications: true,
      emailNotifications: false,
      notificationVolume: 70,
      notificationPosition: 'top-right',
      
      // Message Settings
      autoSendEnabled: false,
      autoSendDelay: 5,
      autoSendLimit: 100,
      batchSize: 10,
      messagePreview: true,
      typingIndicator: true,
      readReceipts: true,
      
      // Performance Settings
      autoRefreshInterval: 30,
      cacheEnabled: true,
      cacheDuration: 300,
      lazyLoading: true,
      preloadImages: true,
      
      // Privacy Settings
      saveHistory: true,
      anonymousMode: false,
      shareAnalytics: true,
      dataRetention: 30,
      
      // Accessibility
      keyboardShortcuts: true,
      screenReaderMode: false,
      focusIndicator: true,
      reduceMotion: false,
      
      // Advanced Settings
      debugMode: false,
      apiTimeout: 30000,
      maxRetries: 3,
      logLevel: 'error',
      experimentalFeatures: false
    };
  });

  // Theme presets
  const themePresets = {
    light: {
      name: 'สว่าง',
      icon: '☀️',
      colors: {
        bg: '#ffffff',
        text: '#2d3748',
        border: '#e2e8f0'
      }
    },
    dark: {
      name: 'มืด',
      icon: '🌙',
      colors: {
        bg: '#1a202c',
        text: '#e2e8f0',
        border: '#4a5568'
      }
    },
    
  };

  // Color presets
  const colorPresets = [
    { name: 'Violet', value: '#667eea' },
    { name: 'Blue', value: '#3182ce' },
    { name: 'Green', value: '#48bb78' },
    { name: 'Orange', value: '#ed8936' },
    { name: 'Pink', value: '#ed64a6' },
    { name: 'Teal', value: '#38b2ac' },
    { name: 'Red', value: '#e53e3e' },
    { name: 'Gray', value: '#718096' }
  ];

  // Font size presets
  const fontSizes = {
    small: { label: 'เล็ก', value: '12px', scale: 0.875 },
    medium: { label: 'ปกติ', value: '14px', scale: 1 },
    large: { label: 'ใหญ่', value: '16px', scale: 1.125 },
    xlarge: { label: 'ใหญ่มาก', value: '18px', scale: 1.25 }
  };

  // Apply Dark Mode to ALL pages
  const applyDarkMode = (theme) => {
    const root = document.documentElement;
    const body = document.body;
    
    // Remove existing theme classes
    root.classList.remove('theme-light', 'theme-dark', 'theme-auto');
    body.classList.remove('theme-light', 'theme-dark', 'theme-auto');
    
    // Apply theme to both root and body
    if (theme === 'dark') {
      root.classList.add('theme-dark');
      body.classList.add('theme-dark');
      root.setAttribute('data-theme', 'dark');
      
      // Apply dark mode CSS variables globally
      root.style.setProperty('--bg-primary', '#1a202c');
      root.style.setProperty('--bg-secondary', '#2d3748');
      root.style.setProperty('--bg-sidebar', '#111827');
      root.style.setProperty('--text-primary', '#e2e8f0');
      root.style.setProperty('--text-secondary', '#a0aec0');
      root.style.setProperty('--gray-800', '#e2e8f0');
      root.style.setProperty('--gray-700', '#cbd5e0');
      root.style.setProperty('--gray-600', '#a0aec0');
      root.style.setProperty('--gray-500', '#718096');
      root.style.setProperty('--gray-200', '#4a5568');
      root.style.setProperty('--gray-100', '#374151');
      root.style.setProperty('--gray-50', '#2d3748');
      
      // Update other color variables for dark mode
      root.style.setProperty('--card-bg', '#2d3748');
      root.style.setProperty('--card-border', '#4a5568');
      root.style.setProperty('--hover-bg', '#374151');
      root.style.setProperty('--border-color', '#4a5568');
      
    } else if (theme === 'light') {
      root.classList.add('theme-light');
      body.classList.add('theme-light');
      root.setAttribute('data-theme', 'light');
      
      // Reset to light mode colors
      root.style.setProperty('--bg-primary', '#f3f4f6');
      root.style.setProperty('--bg-secondary', '#ffffff');
      root.style.setProperty('--bg-sidebar', '#1f2937');
      root.style.setProperty('--text-primary', '#2d3748');
      root.style.setProperty('--text-secondary', '#718096');
      root.style.setProperty('--gray-800', '#1f2937');
      root.style.setProperty('--gray-700', '#374151');
      root.style.setProperty('--gray-600', '#4b5563');
      root.style.setProperty('--gray-500', '#6b7280');
      root.style.setProperty('--gray-200', '#e5e7eb');
      root.style.setProperty('--gray-100', '#f3f4f6');
      root.style.setProperty('--gray-50', '#f9fafb');
      
      // Reset other color variables for light mode
      root.style.setProperty('--card-bg', '#ffffff');
      root.style.setProperty('--card-border', '#e0e0e0');
      root.style.setProperty('--hover-bg', '#f1f3f5');
      root.style.setProperty('--border-color', '#e2e8f0');
      
    } else if (theme === 'auto') {
      root.classList.add('theme-auto');
      body.classList.add('theme-auto');
      root.setAttribute('data-theme', 'auto');
      
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        applyDarkMode('dark');
      } else {
        applyDarkMode('light');
      }
    }
    
    // Save theme preference
    localStorage.setItem('appTheme', theme);
    
    // Broadcast theme change to other components
    window.dispatchEvent(new CustomEvent('themeChange', { detail: { theme } }));
  };

  // Apply settings to DOM
  const applySettings = (newSettings) => {
    const root = document.documentElement;
    const body = document.body;
    
    // Apply theme
    applyDarkMode(newSettings.theme);
    
    // Colors
    root.style.setProperty('--primary-color', newSettings.primaryColor);
    root.style.setProperty('--accent-color', newSettings.accentColor);
    
    // Font Size
    const fontSize = fontSizes[newSettings.fontSize];
    root.style.setProperty('--base-font-size', fontSize.value);
    root.style.setProperty('--font-scale', fontSize.scale);
    body.className = body.className.replace(/font-size-\w+/, '');
    body.classList.add(`font-size-${newSettings.fontSize}`);
    
    // Compact Mode
    body.classList.toggle('compact-mode', newSettings.compactMode);
    
    // Animations
    body.classList.toggle('no-animations', !newSettings.animationsEnabled);
    body.classList.toggle('reduce-motion', newSettings.reduceMotion);
    
    // High Contrast
    body.classList.toggle('high-contrast', newSettings.highContrast);
    
    // Sidebar Position
    body.classList.toggle('sidebar-right', newSettings.sidebarPosition === 'right');
    
    // Sidebar Width
    root.style.setProperty('--sidebar-width', 
      newSettings.sidebarWidth === 'narrow' ? '200px' : 
      newSettings.sidebarWidth === 'wide' ? '300px' : '250px'
    );
    
    // Language
    root.setAttribute('lang', newSettings.language);
  };

  // Load saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      const updatedSettings = { ...settings, theme: savedTheme };
      setSettings(updatedSettings);
      applySettings(updatedSettings);
    } else {
      applySettings(settings);
    }
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e) => {
      if (settings.theme === 'auto') {
        applyDarkMode('auto');
      }
    };
    
    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, []);

  // Save settings
  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
    applySettings(settings);
  }, [settings]);

  // Update setting
  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setHasUnsavedChanges(true);
    
    // Apply theme immediately
    if (key === 'theme') {
      applyDarkMode(value);
    }
  };

  // Save all settings
  const saveSettings = () => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
    localStorage.setItem('appTheme', settings.theme);
    setShowSaveNotification(true);
    setHasUnsavedChanges(false);
    setTimeout(() => setShowSaveNotification(false), 3000);
  };

  // Reset settings
  const resetSettings = () => {
    if (window.confirm('คุณต้องการรีเซ็ตการตั้งค่าทั้งหมดเป็นค่าเริ่มต้นหรือไม่?')) {
      localStorage.removeItem('appSettings');
      localStorage.removeItem('appTheme');
      window.location.reload();
    }
  };

  // Tab content renderer
  const renderTabContent = () => {
    switch(activeTab) {
      case 'general':
        return <GeneralSettings settings={settings} updateSetting={updateSetting} />;
      case 'display':
        return <DisplaySettings settings={settings} updateSetting={updateSetting} />;
      case 'notifications':
        return <NotificationSettings settings={settings} updateSetting={updateSetting} />;
      case 'messages':
        return <MessageSettings settings={settings} updateSetting={updateSetting} />;
      case 'performance':
        return <PerformanceSettings settings={settings} updateSetting={updateSetting} />;
      case 'privacy':
        return <PrivacySettings settings={settings} updateSetting={updateSetting} />;
      case 'accessibility':
        return <AccessibilitySettings settings={settings} updateSetting={updateSetting} />;
      case 'advanced':
        return <AdvancedSettings settings={settings} updateSetting={updateSetting} />;
      default:
        return null;
    }
  };

  return (
    <div className="settings-page" style={{marginLeft:"50px"}}>
      <Sidebar />
      <div className="settings-container">
        <div className="settings-header">
          <h1 className="settings-title">
            <span className="title-icon">⚙️</span>
            ตั้งค่าระบบ
          </h1>
          {hasUnsavedChanges && (
            <span className="unsaved-indicator">• มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
          )}
        </div>

        <div className="settings-tabs">
          <button 
            className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            🌐 ทั่วไป
          </button>
          <button 
            className={`tab-btn ${activeTab === 'display' ? 'active' : ''}`}
            onClick={() => setActiveTab('display')}
          >
            🎨 การแสดงผล
          </button>
          <button 
            className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            🔔 การแจ้งเตือน
          </button>
          <button 
            className={`tab-btn ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            💬 ข้อความ
          </button>
          <button 
            className={`tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
            onClick={() => setActiveTab('performance')}
          >
            ⚡ ประสิทธิภาพ
          </button>
          <button 
            className={`tab-btn ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            🔐 ความเป็นส่วนตัว
          </button>
          <button 
            className={`tab-btn ${activeTab === 'accessibility' ? 'active' : ''}`}
            onClick={() => setActiveTab('accessibility')}
          >
            ♿ การเข้าถึง
          </button>
          <button 
            className={`tab-btn ${activeTab === 'advanced' ? 'active' : ''}`}
            onClick={() => setActiveTab('advanced')}
          >
            🛠️ ขั้นสูง
          </button>
        </div>

        <div className="settings-content">
          {renderTabContent()}
        </div>

        <div className="settings-footer">
          
          <div className="footer-right" style={{marginLeft:"780px"}}>
            <button onClick={resetSettings} className="btn-danger">
              🔄 รีเซ็ตทั้งหมด
            </button>
            <button onClick={saveSettings} className="btn-primary">
              💾 บันทึกการตั้งค่า
            </button>
          </div>
        </div>
      </div>

      {showSaveNotification && (
        <div className="notification-toast success">
          ✅ บันทึกการตั้งค่าสำเร็จ!
        </div>
      )}
    </div>
  );
}

// General Settings Component
const GeneralSettings = ({ settings, updateSetting }) => {
  const colorPresets = [
    { name: 'Violet', value: '#667eea' },
    { name: 'Blue', value: '#3182ce' },
    { name: 'Green', value: '#48bb78' },
    { name: 'Orange', value: '#ed8936' },
    { name: 'Pink', value: '#ed64a6' },
    { name: 'Teal', value: '#38b2ac' }
  ];

  return (
    <div className="settings-section" >
      <h2 className="section-title">การตั้งค่าทั่วไป</h2>
      
      

      <div className="setting-group">
        <label className="setting-label">ธีมสี</label>
        <div className="theme-selector">
          <div 
            className={`theme-option ${settings.theme === 'light' ? 'active' : ''}`}
            onClick={() => updateSetting('theme', 'light')}
          >
            ☀️ สว่าง
          </div>
          <div 
            className={`theme-option ${settings.theme === 'dark' ? 'active' : ''}`}
            onClick={() => updateSetting('theme', 'dark')}
          >
            🌙 มืด
          </div>
          
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">ขนาดตัวอักษร</label>
        <div className="font-size-selector">
          {Object.entries({
            small: 'เล็ก',
            medium: 'ปกติ',
            large: 'ใหญ่',
            xlarge: 'ใหญ่มาก'
          }).map(([key, label]) => (
            <button
              key={key}
              className={`size-option ${settings.fontSize === key ? 'active' : ''}`}
              onClick={() => updateSetting('fontSize', key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">สีหลัก</label>
        <div className="color-palette">
          {colorPresets.map(color => (
            <div
              key={color.value}
              className={`color-option ${settings.primaryColor === color.value ? 'active' : ''}`}
              style={{ backgroundColor: color.value }}
              onClick={() => updateSetting('primaryColor', color.value)}
              title={color.name}
            />
          ))}
          <input
            type="color"
            value={settings.primaryColor}
            onChange={(e) => updateSetting('primaryColor', e.target.value)}
            className="color-picker"
          />
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">สีรอง</label>
        <div className="color-palette">
          {colorPresets.map(color => (
            <div
              key={color.value}
              className={`color-option ${settings.accentColor === color.value ? 'active' : ''}`}
              style={{ backgroundColor: color.value }}
              onClick={() => updateSetting('accentColor', color.value)}
              title={color.name}
            />
          ))}
          <input
            type="color"
            value={settings.accentColor}
            onChange={(e) => updateSetting('accentColor', e.target.value)}
            className="color-picker"
          />
        </div>
      </div>
    </div>
  );
};

// Display Settings Component
const DisplaySettings = ({ settings, updateSetting }) => {
  return (
    <div className="settings-section">
    
      <h2 className="section-title">การแสดงผล</h2>
      
      <div className="setting-group">
        <label className="setting-label">
          <input
            type="checkbox"
            checked={settings.compactMode}
            onChange={(e) => updateSetting('compactMode', e.target.checked)}
          />
          โหมดกะทัดรัด
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-label">
          <input
            type="checkbox"
            checked={settings.showTimestamps}
            onChange={(e) => updateSetting('showTimestamps', e.target.checked)}
          />
          แสดงเวลา
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-label">
          <input
            type="checkbox"
            checked={settings.showAvatars}
            onChange={(e) => updateSetting('showAvatars', e.target.checked)}
          />
          แสดงรูปโปรไฟล์
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-label">
          <input
            type="checkbox"
            checked={settings.animationsEnabled}
            onChange={(e) => updateSetting('animationsEnabled', e.target.checked)}
          />
          เปิดใช้แอนิเมชั่น
        </label>
      </div>

     
    </div>
  );
};

// Other Settings Components (Simplified for brevity)
const NotificationSettings = ({ settings, updateSetting }) => (
  <div className="settings-section">

    <h2 className="section-title">การแจ้งเตือน</h2>
    {/* Add notification settings here */}
  </div>
);

const MessageSettings = ({ settings, updateSetting }) => (
  <div className="settings-section">
  
    <h2 className="section-title">ข้อความ</h2>
    {/* Add message settings here */}
  </div>
);

const PerformanceSettings = ({ settings, updateSetting }) => (
  <div className="settings-section">
   
    <h2 className="section-title">ประสิทธิภาพ</h2>
    {/* Add performance settings here */}
  </div>
);

const PrivacySettings = ({ settings, updateSetting }) => (
  <div className="settings-section">
  
    <h2 className="section-title">ความเป็นส่วนตัว</h2>
    {/* Add privacy settings here */}
  </div>
);

const AccessibilitySettings = ({ settings, updateSetting }) => (
  <div className="settings-section">
 
    <h2 className="section-title">การเข้าถึง</h2>
    {/* Add accessibility settings here */}
  </div>
);

const AdvancedSettings = ({ settings, updateSetting }) => (
  <div className="settings-section">
  
    <h2 className="section-title">ขั้นสูง</h2>
    {/* Add advanced settings here */}
  </div>
);

export default Settings;