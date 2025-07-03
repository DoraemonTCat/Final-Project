// frontend/src/AppMiner/NewUserNotification.js
import React, { useState, useEffect } from 'react';
import '../CSS/NewUserNotification.css';

function NewUserNotification({ selectedPage }) {
  const [newUsers, setNewUsers] = useState([]);
  const [showNotification, setShowNotification] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (!selectedPage) return;

    // ดึงข้อมูล user ใหม่ทุก 30 วินาที
    const fetchNewUsers = async () => {
      try {
        const response = await fetch(`http://localhost:8000/new-user-notifications/${selectedPage}`);
        if (response.ok) {
          const data = await response.json();
          
          // เช็คว่ามี user ใหม่หรือไม่
          if (data.new_users && data.new_users.length > 0) {
            setNewUsers(data.new_users);
            setShowNotification(true);
            
            // แสดง desktop notification ถ้าได้รับอนุญาต
            if (Notification.permission === "granted" && data.new_users.length > newUsers.length) {
              const latestUser = data.new_users[data.new_users.length - 1];
              new Notification("🎉 มี User ใหม่!", {
                body: `${latestUser.user_name} เพิ่งทักเข้ามาในเพจ`,
                icon: latestUser.profile_pic || "/favicon.ico"
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching new users:', error);
      }
    };

    // เรียกทันทีครั้งแรก
    fetchNewUsers();

    // ตั้ง interval
    const interval = setInterval(fetchNewUsers, 30000);

    return () => clearInterval(interval);
  }, [selectedPage]);

  const handleClose = () => {
    setShowNotification(false);
    setNewUsers([]);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  if (!showNotification || newUsers.length === 0) return null;

  return (
    <div className={`new-user-notification ${isMinimized ? 'minimized' : ''}`}>
      <div className="notification-header">
        <div className="header-content">
          <span className="notification-icon">🆕</span>
          <span className="notification-title">
            User ใหม่ ({newUsers.length} คน)
          </span>
        </div>
        <div className="header-actions">
          <button onClick={toggleMinimize} className="minimize-btn">
            {isMinimized ? '▲' : '▼'}
          </button>
          <button onClick={handleClose} className="close-btn">✖</button>
        </div>
      </div>
      
      {!isMinimized && (
        <div className="notification-body">
          <div className="new-users-list">
            {newUsers.slice(-5).reverse().map((user, index) => (
              <div key={index} className="new-user-item">
                <div className="user-avatar">
                  {user.profile_pic ? (
                    <img src={user.profile_pic} alt={user.user_name} />
                  ) : (
                    <div className="avatar-placeholder">
                      {user.user_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="user-info">
                  <div className="user-name">{user.user_name}</div>
                  <div className="user-time">
                    {new Date(user.timestamp).toLocaleTimeString('th-TH')}
                  </div>
                </div>
                <div className="sync-status">
                  <span className="status-badge success">
                    ✅ Synced
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          {newUsers.length > 5 && (
            <div className="more-users">
              และอีก {newUsers.length - 5} คน...
            </div>
          )}
          
          <div className="notification-footer">
            <div className="auto-sync-info">
              <span className="info-icon">ℹ️</span>
              <span className="info-text">
                ระบบ sync ข้อมูล user ใหม่อัตโนมัติทันทีที่มีการทักเข้ามา
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NewUserNotification;