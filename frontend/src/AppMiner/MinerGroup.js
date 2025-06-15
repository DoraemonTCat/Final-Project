import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../CSS/MinerGroup.css';
import { fetchPages, connectFacebook } from "../Features/Tool";

function SetMiner() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [customerGroups, setCustomerGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [showAddGroupForm, setShowAddGroupForm] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const navigate = useNavigate();

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // 🔥 ฟังก์ชันดึงกลุ่มลูกค้าตาม page ID
  const getGroupsForPage = (pageId) => {
    if (!pageId) return [];
    const key = `customerGroups_${pageId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  };

  // 🔥 ฟังก์ชันบันทึกกลุ่มลูกค้าตาม page ID
  const saveGroupsForPage = (pageId, groups) => {
    if (!pageId) return;
    const key = `customerGroups_${pageId}`;
    localStorage.setItem(key, JSON.stringify(groups));
  };

  useEffect(() => {
    const savedPage = localStorage.getItem("selectedPage");
    
    if (savedPage) {
      setSelectedPage(savedPage);
    }
    
    fetchPages()
      .then(setPages)
      .catch(err => console.error("ไม่สามารถโหลดเพจได้:", err));
  }, []);

  // 🔥 โหลดกลุ่มลูกค้าเมื่อเปลี่ยนเพจ
  useEffect(() => {
    if (selectedPage) {
      const pageGroups = getGroupsForPage(selectedPage);
      setCustomerGroups(pageGroups);
      // รีเซ็ตการเลือกเมื่อเปลี่ยนเพจ
      setSelectedGroups([]);
    } else {
      setCustomerGroups([]);
      setSelectedGroups([]);
    }
  }, [selectedPage]);

  const handlePageChange = (e) => {
    const pageId = e.target.value;
    setSelectedPage(pageId);
    localStorage.setItem("selectedPage", pageId);
  };

  const addCustomerGroup = () => {
    if (newGroupName.trim() && selectedPage) {
      const newGroup = {
        id: Date.now(),
        name: newGroupName,
        pageId: selectedPage, // 🔥 เพิ่ม pageId ในกลุ่ม
        customers: [],
        messages: [],
        createdAt: new Date().toISOString()
      };
      const updatedGroups = [...customerGroups, newGroup];
      setCustomerGroups(updatedGroups);
      saveGroupsForPage(selectedPage, updatedGroups); // 🔥 บันทึกตาม page ID
      setNewGroupName("");
      setShowAddGroupForm(false);
    } else if (!selectedPage) {
      alert("กรุณาเลือกเพจก่อนสร้างกลุ่ม");
    }
  };

  const removeCustomerGroup = (groupId) => {
    if (window.confirm("คุณต้องการลบกลุ่มนี้หรือไม่?")) {
      const updatedGroups = customerGroups.filter(group => group.id !== groupId);
      setCustomerGroups(updatedGroups);
      saveGroupsForPage(selectedPage, updatedGroups); // 🔥 บันทึกตาม page ID
      setSelectedGroups(selectedGroups.filter(id => id !== groupId));
    }
  };

  const toggleGroupSelection = (groupId) => {
    setSelectedGroups(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      }
      return [...prev, groupId];
    });
  };

  const handleProceed = () => {
    if (!selectedPage) {
      alert("กรุณาเลือกเพจก่อน");
      return;
    }
    
    if (selectedGroups.length === 0) {
      alert("กรุณาเลือกกลุ่มลูกค้าอย่างน้อย 1 กลุ่ม");
      return;
    }
    
    // 🔥 บันทึกข้อมูลการเลือกพร้อมกับ page ID
    localStorage.setItem("selectedCustomerGroups", JSON.stringify(selectedGroups));
    localStorage.setItem("selectedCustomerGroupsPageId", selectedPage);
    
    navigate('/GroupDefault');
  };

  // 🔥 ฟังก์ชันเริ่มการแก้ไขชื่อกลุ่ม
  const startEditGroup = (group) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  };

  // 🔥 ฟังก์ชันบันทึกการแก้ไขชื่อกลุ่ม
  const saveEditGroup = () => {
    if (!editingGroupName.trim()) {
      alert("กรุณากรอกชื่อกลุ่ม");
      return;
    }

    const updatedGroups = customerGroups.map(group => {
      if (group.id === editingGroupId) {
        return { ...group, name: editingGroupName };
      }
      return group;
    });

    setCustomerGroups(updatedGroups);
    saveGroupsForPage(selectedPage, updatedGroups);
    setEditingGroupId(null);
    setEditingGroupName("");
  };

  // 🔥 ฟังก์ชันยกเลิกการแก้ไข
  const cancelEdit = () => {
    setEditingGroupId(null);
    setEditingGroupName("");
  };

  // 🔥 ฟังก์ชันแก้ไขข้อความในกลุ่ม
  const editGroupMessages = (groupId) => {
    // บันทึกข้อมูลกลุ่มที่เลือกเพื่อแก้ไข
    localStorage.setItem("selectedCustomerGroups", JSON.stringify([groupId]));
    localStorage.setItem("selectedCustomerGroupsPageId", selectedPage);
    localStorage.setItem("editingMode", "true");
    
    navigate('/GroupDefault');
  };

  const filteredGroups = customerGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 🔥 แสดงชื่อเพจในหัวข้อถ้ามีการเลือกเพจ
  const selectedPageInfo = selectedPage ? pages.find(p => p.id === selectedPage) : null;

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

      <div className="miner-main-content">
        <div className="miner-header">
          <h1 className="miner-title">
            <span className="title-icon">👥</span>
            ตั้งค่าระบบขุดตามกลุ่มลูกค้า
            {selectedPageInfo && (
              <span style={{ fontSize: '18px', color: '#718096', marginLeft: '10px' }}>
                - {selectedPageInfo.name}
              </span>
            )}
          </h1>
          <div className="breadcrumb">
            <span className="breadcrumb-item active">1. เลือกกลุ่ม</span>
            <span className="breadcrumb-separator">›</span>
            <span className="breadcrumb-item">2. ตั้งค่าข้อความ</span>
            <span className="breadcrumb-separator">›</span>
            <span className="breadcrumb-item">3. ตั้งเวลา</span>
          </div>
        </div>

        {/* 🔥 แสดงข้อความแจ้งเตือนถ้ายังไม่ได้เลือกเพจ */}
        {!selectedPage && (
          <div style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            color: '#856404',
            padding: '12px 20px',
            marginBottom: '20px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>⚠️</span>
            <span>กรุณาเลือกเพจก่อนเพื่อดูและจัดการกลุ่มลูกค้าของเพจนั้น</span>
          </div>
        )}

        <div className="miner-controls">
          <div className="search-section">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="ค้นหากลุ่มลูกค้า..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
                disabled={!selectedPage}
              />
            </div>
          </div>
          <button 
            onClick={() => setShowAddGroupForm(true)}
            className="add-group-btn"
            disabled={!selectedPage}
            style={{ opacity: selectedPage ? 1 : 0.5 }}
          >
            <span className="btn-icon">➕</span>
            เพิ่มกลุ่มใหม่
          </button>
        </div>

        {/* Form เพิ่มกลุ่มใหม่ */}
        {showAddGroupForm && (
          <div className="add-group-modal">
            <div className="modal-content">
              <h3>สร้างกลุ่มลูกค้าใหม่{selectedPageInfo && ` - ${selectedPageInfo.name}`}</h3>
              <input
                type="text"
                placeholder="ชื่อกลุ่มลูกค้า"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="group-name-input"
                autoFocus
              />
              <div className="modal-actions">
                <button
                  onClick={addCustomerGroup}
                  className="save-btn"
                  disabled={!newGroupName.trim()}
                >
                  บันทึก
                </button>
                <button
                  onClick={() => {
                    setShowAddGroupForm(false);
                    setNewGroupName("");
                  }}
                  className="cancel-btn"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="groups-container">
          {!selectedPage ? (
            <div className="empty-state">
              <div className="empty-icon">🏢</div>
              <h3>เลือกเพจเพื่อจัดการกลุ่มลูกค้า</h3>
              <p>แต่ละเพจจะมีกลุ่มลูกค้าแยกกันอิสระ</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📁</div>
              <h3>ยังไม่มีกลุ่มลูกค้าสำหรับเพจนี้ +++</h3>
            
              <button 
                onClick={() => setShowAddGroupForm(true)}
                className="empty-add-btn"
              >
                สร้างกลุ่มแรก
              </button>
            </div>
          ) : (
            <>
              <div className="groups-grid">
                {filteredGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`group-card ${selectedGroups.includes(group.id) ? 'selected' : ''}`}
                  >
                    <div className="group-checkbox">
                      <input
                        type="checkbox"
                        id={`group-${group.id}`}
                        checked={selectedGroups.includes(group.id)}
                        onChange={() => toggleGroupSelection(group.id)}
                      />
                      <label htmlFor={`group-${group.id}`}></label>
                    </div>
                    
                    <div className="group-content">
                      <div className="group-icon">👥</div>
                      {editingGroupId === group.id ? (
                        <div style={{ marginBottom: '12px' }}>
                          <input
                            type="text"
                            value={editingGroupName}
                            onChange={(e) => setEditingGroupName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && saveEditGroup()}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '18px',
                              fontWeight: '600',
                              textAlign: 'center',
                              border: '2px solid #667eea',
                              borderRadius: '6px',
                              outline: 'none'
                            }}
                            autoFocus
                          />
                          <div style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button
                              onClick={saveEditGroup}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#48bb78',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              บันทึก
                            </button>
                            <button
                              onClick={cancelEdit}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#e2e8f0',
                                color: '#4a5568',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </div>
                      ) : (
                        <h3 className="group-name">{group.name}</h3>
                      )}
                      <div className="group-stats">
                        <span className="stat-item">
                          <span className="stat-icon">👤</span>
                          {group.customers.length} สมาชิก
                        </span>
                        <span className="stat-item">
                          <span className="stat-icon">💬</span>
                          {group.messages?.length || 0} ข้อความ
                        </span>
                      </div>
                      <div className="group-date">
                        สร้างเมื่อ {new Date(group.createdAt).toLocaleDateString('th-TH')}
                      </div>
                      
                      {/* 🔥 ปุ่มแก้ไข */}
                      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditGroup(group);
                          }}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#f39c12',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease'
                          }}
                          title="แก้ไขชื่อกลุ่ม"
                        >
                          ✏️ แก้ไขชื่อ
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            editGroupMessages(group.id);
                          }}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease'
                          }}
                          title="แก้ไขข้อความ"
                        >
                          💬 แก้ไขข้อความ
                        </button>
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCustomerGroup(group.id);
                      }}
                      className="delete-btn"
                      title="ลบกลุ่ม"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>

              <div className="action-bar">
                <div className="selection-info">
                  <span className="selection-icon">✓</span>
                  เลือกแล้ว {selectedGroups.length} กลุ่ม
                </div>
               <button
                  onClick={handleProceed}
                  className="proceed-btn"
                  disabled={selectedGroups.length === 0}
                >
                  ถัดไป: ตั้งค่าข้อความ
                  <span className="arrow-icon">→</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SetMiner;