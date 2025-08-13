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
    auto: {
      name: 'อัตโนมัติ',
      icon: '🌓',
      colors: null
    }
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

  // Apply settings to DOM
  const applySettings = (newSettings) => {
    const root = document.documentElement;
    const body = document.body;
    
    // Theme
    root.setAttribute('data-theme', newSettings.theme);
    
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
  };

  // Save all settings
  const saveSettings = () => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
    setShowSaveNotification(true);
    setHasUnsavedChanges(false);
    setTimeout(() => setShowSaveNotification(false), 3000);
  };

  // Reset settings
  const resetSettings = () => {
    if (window.confirm('คุณต้องการรีเซ็ตการตั้งค่าทั้งหมดเป็นค่าเริ่มต้นหรือไม่?')) {
      localStorage.removeItem('appSettings');
      window.location.reload();
    }
  };

  // Export settings
  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `settings_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Import settings
  const importSettings = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target.result);
          setSettings(importedSettings);
          saveSettings();
        } catch (error) {
          alert('ไม่สามารถอ่านไฟล์การตั้งค่าได้');
        }
      };
      reader.readAsText(file);
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
    <div className="settings-page" style={{marginLeft:"70px"}}>
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
          <div className="footer-left">
            <button onClick={exportSettings} className="btn-secondary">
              📥 Export การตั้งค่า
            </button>
            <label className="btn-secondary">
              📤 Import การตั้งค่า
              <input 
                type="file" 
                accept=".json"
                onChange={importSettings}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <div className="footer-right">
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
        <label className="setting-label">ภาษา</label>
        <select 
          value={settings.language}
          onChange={(e) => updateSetting('language', e.target.value)}
          className="setting-select"
        >
          <option value="th">ไทย</option>
          <option value="en">English</option>
        </select>
      </div>

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
          <div 
            className={`theme-option ${settings.theme === 'auto' ? 'active' : ''}`}
            onClick={() => updateSetting('theme', 'auto')}
          >
            🌓 อัตโนมัติ
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
        <label className="setting-label">ตำแหน่ง Sidebar</label>
        <div className="radio-group">
          <label className="radio-option">
            <input
              type="radio"
              value="left"
              checked={settings.sidebarPosition === 'left'}
              onChange={(e) => updateSetting('sidebarPosition', e.target.value)}
            />
            ซ้าย
          </label>
          <label className="radio-option">
            <input
              type="radio"
              value="right"
              checked={settings.sidebarPosition === 'right'}
              onChange={(e) => updateSetting('sidebarPosition', e.target.value)}
            />
            ขวา
          </label>
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">ขนาด Sidebar</label>
        <select 
          value={settings.sidebarWidth}
          onChange={(e) => updateSetting('sidebarWidth', e.target.value)}
          className="setting-select"
        >
          <option value="narrow">แคบ (200px)</option>
          <option value="normal">ปกติ (250px)</option>
          <option value="wide">กว้าง (300px)</option>
        </select>
      </div>

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

      <div className="setting-group">
        <label className="setting-label">
          <input
            type="checkbox"
            checked={settings.highContrast}
            onChange={(e) => updateSetting('highContrast', e.target.checked)}
          />
          โหมดความคมชัดสูง
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