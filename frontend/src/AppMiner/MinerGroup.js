import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../CSS/MinerGroup.css';
import { fetchPages, connectFacebook } from "../Features/Tool";
import Sidebar from "./Sidebar"; 

function SetMiner() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [customerGroups, setCustomerGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [showAddGroupForm, setShowAddGroupForm] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showScheduleSelectModal, setShowScheduleSelectModal] = useState(false);
  const [schedulesToSelect, setSchedulesToSelect] = useState([]);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [viewingGroupSchedules, setViewingGroupSchedules] = useState([]);
  const [viewingGroupName, setViewingGroupName] = useState('');
  const navigate = useNavigate();

  // 🔥 กลุ่ม Default ที่มีมาแต่แรก
  const DEFAULT_GROUPS = [
    {
      id: 'default_1',
      name: 'กลุ่มคนหาย',
      isDefault: true,
      description: 'สำหรับลูกค้าที่หายไปไม่นาน',
      icon: '🕐',
      createdAt: new Date('2024-01-01').toISOString()
    },
    {
      id: 'default_2', 
      name: 'กลุ่มคนหายนาน',
      isDefault: true,
      description: 'สำหรับลูกค้าที่หายไปนาน',
      icon: '⏰',
      createdAt: new Date('2024-01-01').toISOString()
    },
    {
      id: 'default_3',
      name: 'กลุ่มคนหายนานมาก',
      isDefault: true,
      description: 'สำหรับลูกค้าที่หายไปนานมาก',
      icon: '📅',
      createdAt: new Date('2024-01-01').toISOString()
    }
  ];

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // 🔥 ฟังก์ชันดึงกลุ่มลูกค้าตาม page ID (รวม default groups)
  const getGroupsForPage = (pageId) => {
    if (!pageId) return [];
    const key = `customerGroups_${pageId}`;
    const userGroups = JSON.parse(localStorage.getItem(key) || '[]');
    
    // รวมกลุ่ม default กับกลุ่มที่ user สร้าง
    return [...DEFAULT_GROUPS, ...userGroups];
  };

  // 🔥 ฟังก์ชันบันทึกกลุ่มลูกค้าตาม page ID (บันทึกเฉพาะ user groups)
  const saveGroupsForPage = (pageId, groups) => {
    if (!pageId) return;
    const key = `customerGroups_${pageId}`;
    // กรองเอาเฉพาะกลุ่มที่ไม่ใช่ default ก่อนบันทึก
    const userGroups = groups.filter(g => !g.isDefault);
    localStorage.setItem(key, JSON.stringify(userGroups));
  };

  // 🔥 ฟังก์ชันดึงตารางการส่งตาม page ID
  const getSchedulesForPage = (pageId) => {
    if (!pageId) return [];
    const key = `miningSchedules_${pageId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  };

  // 🔥 ฟังก์ชันบันทึกตารางการส่งตาม page ID
  const saveSchedulesForPage = (pageId, schedules) => {
    if (!pageId) return;
    const key = `miningSchedules_${pageId}`;
    localStorage.setItem(key, JSON.stringify(schedules));
  };

  // 🔥 ฟังก์ชันตรวจสอบว่ากลุ่มมีการตั้งเวลาไว้หรือไม่
  const getGroupSchedules = (groupId) => {
    const schedules = getSchedulesForPage(selectedPage);
    return schedules.filter(schedule => schedule.groups.includes(groupId));
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

  // Listen for page changes from Sidebar
  useEffect(() => {
    const handlePageChange = (event) => {
      const pageId = event.detail.pageId;
      setSelectedPage(pageId);
    };

    window.addEventListener('pageChanged', handlePageChange);
    
    const savedPage = localStorage.getItem("selectedPage");
    if (savedPage) {
      setSelectedPage(savedPage);
    }

    return () => {
      window.removeEventListener('pageChanged', handlePageChange);
    };
  }, []);

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
        pageId: selectedPage,
        customers: [],
        messages: [],
        createdAt: new Date().toISOString(),
        isDefault: false // 🔥 กลุ่มที่ user สร้างจะเป็น false
      };
      const updatedGroups = [...customerGroups, newGroup];
      setCustomerGroups(updatedGroups);
      saveGroupsForPage(selectedPage, updatedGroups);
      setNewGroupName("");
      setShowAddGroupForm(false);
    } else if (!selectedPage) {
      alert("กรุณาเลือกเพจก่อนสร้างกลุ่ม");
    }
  };

  const removeCustomerGroup = (groupId) => {
    const group = customerGroups.find(g => g.id === groupId);
    
    // 🔥 ตรวจสอบว่าเป็นกลุ่ม default หรือไม่
    if (group && group.isDefault) {
      alert("ไม่สามารถลบกลุ่มพื้นฐานได้");
      return;
    }
    
    if (window.confirm("คุณต้องการลบกลุ่มนี้หรือไม่?")) {
      const updatedGroups = customerGroups.filter(group => group.id !== groupId);
      setCustomerGroups(updatedGroups);
      saveGroupsForPage(selectedPage, updatedGroups);
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
    const schedules = getGroupSchedules(groupId);
    const group = customerGroups.find(g => g.id === groupId);
    
    localStorage.setItem("selectedCustomerGroups", JSON.stringify([groupId]));
    localStorage.setItem("selectedCustomerGroupsPageId", selectedPage);
    
    if (schedules.length > 1) {
      setSchedulesToSelect(schedules);
      setEditingGroupId(groupId);
      setEditingGroupName(group?.name || '');
      setShowScheduleSelectModal(true);
    } else if (schedules.length === 1) {
      const schedule = schedules[0];
      localStorage.setItem("editingScheduleId", schedule.id.toString());
      
      const messageKey = `groupMessages_${selectedPage}`;
      localStorage.setItem(messageKey, JSON.stringify(schedule.messages || []));
      
      navigate('/GroupDefault');
    } else {
      localStorage.setItem("editingMode", "true");
      
      if (group && group.messages) {
        const messageKey = `groupMessages_${selectedPage}`;
        localStorage.setItem(messageKey, JSON.stringify(group.messages));
      }
      
      navigate('/GroupDefault');
    }
  };

  // 🔥 ฟังก์ชันเลือก schedule ที่จะแก้ไข
  const selectScheduleToEdit = (schedule) => {
    localStorage.setItem("editingScheduleId", schedule.id.toString());
    
    const messageKey = `groupMessages_${selectedPage}`;
    localStorage.setItem(messageKey, JSON.stringify(schedule.messages || []));
    
    setShowScheduleSelectModal(false);
    navigate('/GroupDefault');
  };

  // 🔥 ฟังก์ชันแสดงตารางเวลาของกลุ่ม
  const viewGroupSchedules = (group) => {
    const schedules = getGroupSchedules(group.id);
    setViewingGroupSchedules(schedules);
    setViewingGroupName(group.name);
    setShowScheduleModal(true);
  };

  // 🔥 ฟังก์ชันลบตารางเวลา
  const deleteSchedule = (scheduleId) => {
    if (window.confirm("คุณต้องการลบตารางเวลานี้หรือไม่?")) {
      const schedules = getSchedulesForPage(selectedPage);
      const updatedSchedules = schedules.filter(s => s.id !== scheduleId);
      saveSchedulesForPage(selectedPage, updatedSchedules);
      
      const newViewingSchedules = viewingGroupSchedules.filter(s => s.id !== scheduleId);
      setViewingGroupSchedules(newViewingSchedules);
      
      if (newViewingSchedules.length === 0) {
        setShowScheduleModal(false);
      }
    }
  };

  // 🔥 ฟังก์ชันแก้ไขตารางเวลา
  const editSchedule = (schedule) => {
    localStorage.setItem("selectedCustomerGroups", JSON.stringify(schedule.groups));
    localStorage.setItem("selectedCustomerGroupsPageId", selectedPage);
    localStorage.setItem("editingScheduleId", schedule.id.toString());
    
    const messageKey = `groupMessages_${selectedPage}`;
    localStorage.setItem(messageKey, JSON.stringify(schedule.messages || []));
    
    const scheduleSettings = {
      scheduleType: schedule.type,
      scheduleDate: schedule.date,
      scheduleTime: schedule.time,
      inactivityPeriod: schedule.inactivityPeriod || '1',
      inactivityUnit: schedule.inactivityUnit || 'days',
      repeatType: schedule.repeat.type,
      repeatCount: schedule.repeat.count || 1,
      repeatDays: schedule.repeat.days || [],
      endDate: schedule.repeat.endDate || ''
    };
    
    const savedScheduleKey = `lastScheduleSettings_${selectedPage}`;
    localStorage.setItem(savedScheduleKey, JSON.stringify(scheduleSettings));
    
    navigate('/GroupSchedule');
  };

  // 🔥 แยกกลุ่ม default และ user groups สำหรับการแสดงผล
  const defaultGroups = customerGroups.filter(g => g.isDefault);
  const userGroups = customerGroups.filter(g => !g.isDefault);

  // Filter สำหรับการค้นหา
  const filteredDefaultGroups = defaultGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredUserGroups = userGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedPageInfo = selectedPage ? pages.find(p => p.id === selectedPage) : null;

  return (
    <div className="app-container">
      <Sidebar />

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
            </div>
          ) : (filteredDefaultGroups.length === 0 && filteredUserGroups.length === 0) ? (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <h3>ไม่พบกลุ่มที่ค้นหา</h3>
              <p>ลองค้นหาด้วยคำอื่น</p>
            </div>
          ) : (
            <>
              {/* 🔥 แสดงกลุ่ม Default */}
              {filteredDefaultGroups.length > 0 && (
                <div className="default-groups-section">
                  <h3 className="section-title">
                    <span className="section-icon">⭐</span>
                    กลุ่มพื้นฐาน
                  </h3>
                  <div className="groups-grid">
                    {filteredDefaultGroups.map((group) => (
                      <div
                        key={group.id}
                        className={`group-card default-group ${selectedGroups.includes(group.id) ? 'selected' : ''}`}
                      >
                        <div className="default-badge">พื้นฐาน</div>
                        
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
                          <div className="group-icon">{group.icon || '👥'}</div>
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
                                <button onClick={saveEditGroup} className="edit-save-btn">
                                  บันทึก
                                </button>
                                <button onClick={cancelEdit} className="edit-cancel-btn">
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          ) : (
                            <h3 className="group-name">{group.name}</h3>
                          )}
                          
                          {group.description && (
                            <p className="group-description">{group.description}</p>
                          )}
                          
                          {getGroupSchedules(group.id).length > 0 && (
                            <div className="schedule-info" onClick={(e) => {
                              e.stopPropagation();
                              viewGroupSchedules(group);
                            }}>
                              <span>⏰ มีการตั้งเวลา {getGroupSchedules(group.id).length} รายการ</span>
                            </div>
                          )}
                          
                          <div className="group-date">
                            กลุ่มพื้นฐานของระบบ
                          </div>
                          
                          <div className="group-actions">
                            <button onClick={(e) => {
                              e.stopPropagation();
                              startEditGroup(group);
                            }} className="action-btn edit-name-btn">
                              ✏️ แก้ไขชื่อ
                            </button>
                            <button onClick={(e) => {
                              e.stopPropagation();
                              editGroupMessages(group.id);
                            }} className="action-btn edit-message-btn">
                              💬 แก้ไขข้อความ
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 🔥 เส้นแบ่งระหว่างกลุ่ม */}
              {filteredDefaultGroups.length > 0 && filteredUserGroups.length > 0 && (
                <div className="groups-divider">
                  <div className="divider-line"></div>
                  <span className="divider-text">กลุ่มที่คุณสร้าง</span>
                  <div className="divider-line"></div>
                </div>
              )}

              {/* 🔥 แสดงกลุ่มที่ User สร้าง */}
              {filteredUserGroups.length > 0 && (
                <div className="user-groups-section">
                  <div className="groups-grid">
                    {filteredUserGroups.map((group) => (
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
                                <button onClick={saveEditGroup} className="edit-save-btn">
                                  บันทึก
                                </button>
                                <button onClick={cancelEdit} className="edit-cancel-btn">
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          ) : (
                            <h3 className="group-name">{group.name}</h3>
                          )}
                          
                          {getGroupSchedules(group.id).length > 0 && (
                            <div className="schedule-info" onClick={(e) => {
                              e.stopPropagation();
                              viewGroupSchedules(group);
                            }}>
                              <span>⏰ มีการตั้งเวลา {getGroupSchedules(group.id).length} รายการ</span>
                            </div>
                          )}
                          
                          <div className="group-date">
                            สร้างเมื่อ {new Date(group.createdAt).toLocaleDateString('th-TH')}
                          </div>
                          
                          <div className="group-actions">
                            <button onClick={(e) => {
                              e.stopPropagation();
                              startEditGroup(group);
                            }} className="action-btn edit-name-btn">
                              ✏️ แก้ไขชื่อ
                            </button>
                            <button onClick={(e) => {
                              e.stopPropagation();
                              editGroupMessages(group.id);
                            }} className="action-btn edit-message-btn">
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
                </div>
              )}

              {/* Action Bar */}
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

        {/* Modal แสดงตารางเวลา */}
        {showScheduleModal && (
          <div className="add-group-modal">
            <div className="modal-content" style={{ maxWidth: '600px' }}>
              <h3>⏰ ตารางเวลาของกลุ่ม: {viewingGroupName}</h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '20px' }}>
                {viewingGroupSchedules.map((schedule, index) => (
                  <div key={schedule.id} style={{
                    background: '#f8f9fa',
                    padding: '15px',
                    borderRadius: '8px',
                    marginBottom: '15px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#2d3748' }}>
                          #{index + 1} - {
                            schedule.type === 'immediate' ? 'ส่งทันที' :
                            schedule.type === 'scheduled' ? `ส่งตามเวลา: ${new Date(schedule.date).toLocaleDateString('th-TH')} ${schedule.time} น.` :
                            `ส่งเมื่อหายไป ${schedule.inactivityPeriod} ${
                              schedule.inactivityUnit === 'minutes' ? 'นาที' :
                              schedule.inactivityUnit === 'hours' ? 'ชั่วโมง' :
                              schedule.inactivityUnit === 'days' ? 'วัน' :
                              schedule.inactivityUnit === 'weeks' ? 'สัปดาห์' : 'เดือน'
                            }`
                          }
                        </p>
                        {schedule.repeat.type !== 'once' && (
                          <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#718096' }}>
                            🔄 ทำซ้ำ: {
                              schedule.repeat.type === 'daily' ? 'ทุกวัน' :
                              schedule.repeat.type === 'weekly' ? `ทุกสัปดาห์` :
                              'ทุกเดือน'
                            }
                            {schedule.repeat.endDate && ` จนถึง ${new Date(schedule.repeat.endDate).toLocaleDateString('th-TH')}`}
                          </p>
                        )}
                        <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#a0aec0' }}>
                          สร้างเมื่อ: {new Date(schedule.createdAt).toLocaleString('th-TH')}
                        </p>
                        {schedule.updatedAt && (
                          <p style={{ margin: '0', fontSize: '12px', color: '#e53e3e' }}>
                            แก้ไขล่าสุด: {new Date(schedule.updatedAt).toLocaleString('th-TH')}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => editSchedule(schedule)}
                          style={{
                            background: '#e6f3ff',
                            color: '#3182ce',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#3182ce';
                            e.currentTarget.style.color = 'white';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#e6f3ff';
                            e.currentTarget.style.color = '#3182ce';
                          }}
                        >
                          ✏️ แก้ไข
                        </button>
                        <button
                          onClick={() => deleteSchedule(schedule.id)}
                          style={{
                            background: '#fee',
                            color: '#e53e3e',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#e53e3e';
                            e.currentTarget.style.color = 'white';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fee';
                            e.currentTarget.style.color = '#e53e3e';
                          }}
                        >
                          🗑️ ลบ
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="cancel-btn"
                  style={{ width: '100%' }}
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal เลือก Schedule ที่จะแก้ไข */}
        {showScheduleSelectModal && (
          <div className="add-group-modal">
            <div className="modal-content" style={{ maxWidth: '600px' }}>
              <h3>📋 เลือกตารางเวลาที่ต้องการแก้ไขข้อความ</h3>
              <p style={{ color: '#718096', fontSize: '14px', marginBottom: '20px' }}>
                กลุ่ม "{editingGroupName}" มีการตั้งเวลาหลายรายการ กรุณาเลือกรายการที่ต้องการแก้ไข
              </p>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {schedulesToSelect.map((schedule, index) => (
                  <div 
                    key={schedule.id} 
                    onClick={() => selectScheduleToEdit(schedule)}
                    style={{
                      background: '#f8f9fa',
                      padding: '15px',
                      borderRadius: '8px',
                      marginBottom: '10px',
                      border: '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#3182ce';
                      e.currentTarget.style.background = '#e6f3ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'transparent';
                      e.currentTarget.style.background = '#f8f9fa';
                    }}
                  >
                    <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#2d3748' }}>
                      #{index + 1} - {
                        schedule.type === 'immediate' ? 'ส่งทันที' :
                        schedule.type === 'scheduled' ? `ส่งตามเวลา: ${new Date(schedule.date).toLocaleDateString('th-TH')} ${schedule.time} น.` :
                        `ส่งเมื่อหายไป ${schedule.inactivityPeriod} ${
                          schedule.inactivityUnit === 'hours' ? 'ชั่วโมง' :
                          schedule.inactivityUnit === 'days' ? 'วัน' :
                          schedule.inactivityUnit === 'weeks' ? 'สัปดาห์' : 'เดือน'
                        }`
                      }
                    </p>
                    <p style={{ margin: '0', fontSize: '12px', color: '#718096' }}>
                      จำนวนข้อความ: {schedule.messages?.length || 0} ข้อความ
                    </p>
                  </div>
                ))}
              </div>
              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button
                  onClick={() => setShowScheduleSelectModal(false)}
                  className="cancel-btn"
                  style={{ width: '100%' }}
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SetMiner;