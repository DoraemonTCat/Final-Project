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
    // ตรวจสอบว่ากลุ่มนี้มีการตั้งเวลาหรือไม่
    const schedules = getGroupSchedules(groupId);
    const group = customerGroups.find(g => g.id === groupId);
    
    // บันทึกข้อมูลกลุ่มที่เลือกเพื่อแก้ไข
    localStorage.setItem("selectedCustomerGroups", JSON.stringify([groupId]));
    localStorage.setItem("selectedCustomerGroupsPageId", selectedPage);
    
    if (schedules.length > 1) {
      // ถ้ามีหลาย schedule ให้เลือก
      setSchedulesToSelect(schedules);
      setEditingGroupId(groupId);
      setEditingGroupName(group?.name || '');
      setShowScheduleSelectModal(true);
    } else if (schedules.length === 1) {
      // ถ้ามี schedule เดียว ใช้อันนั้นเลย
      const schedule = schedules[0];
      localStorage.setItem("editingScheduleId", schedule.id.toString());
      
      // บันทึกข้อความของ schedule นี้
      const messageKey = `groupMessages_${selectedPage}`;
      localStorage.setItem(messageKey, JSON.stringify(schedule.messages || []));
      
      navigate('/GroupDefault');
    } else {
      // ถ้าไม่มีการตั้งเวลา
      localStorage.setItem("editingMode", "true");
      
      // โหลดข้อความของกลุ่มนี้ (ถ้ามี)
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
    
    // บันทึกข้อความของ schedule นี้
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
      
      // อัพเดท modal
      const newViewingSchedules = viewingGroupSchedules.filter(s => s.id !== scheduleId);
      setViewingGroupSchedules(newViewingSchedules);
      
      // ถ้าไม่มีตารางเหลือ ปิด modal
      if (newViewingSchedules.length === 0) {
        setShowScheduleModal(false);
      }
    }
  };

  // 🔥 ฟังก์ชันแก้ไขตารางเวลา
  const editSchedule = (schedule) => {
    // บันทึกข้อมูลกลุ่มและตารางเวลาที่ต้องการแก้ไข
    localStorage.setItem("selectedCustomerGroups", JSON.stringify(schedule.groups));
    localStorage.setItem("selectedCustomerGroupsPageId", selectedPage);
    localStorage.setItem("editingScheduleId", schedule.id.toString());
    
    // บันทึกข้อความของ schedule นี้
    const messageKey = `groupMessages_${selectedPage}`;
    localStorage.setItem(messageKey, JSON.stringify(schedule.messages || []));
    
    // บันทึกการตั้งค่าเวลาเดิม
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
    
    // ไปหน้าตั้งเวลาเพื่อแก้ไข
    navigate('/GroupSchedule');
  };

  const filteredGroups = customerGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 🔥 แสดงชื่อเพจในหัวข้อถ้ามีการเลือกเพจ
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
                     
                      
                      {/* 🔥 แสดงการตั้งเวลาที่มีอยู่ */}
                      {getGroupSchedules(group.id).length > 0 && (
                        <div style={{
                          marginTop: '12px',
                          padding: '8px',
                          background: 'linear-gradient(135deg, rgba(72, 187, 120, 0.1), rgba(56, 161, 105, 0.1))',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#38a169',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          viewGroupSchedules(group);
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(72, 187, 120, 0.2), rgba(56, 161, 105, 0.2))';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(72, 187, 120, 0.1), rgba(56, 161, 105, 0.1))';
                        }}
                        >
                          <span style={{ fontWeight: '600' }}>⏰ มีการตั้งเวลา {getGroupSchedules(group.id).length} รายการ (คลิกเพื่อดู)</span>
                        </div>
                      )}
                      
                      <div className="group-date">
                        สร้างเมื่อ {new Date(group.createdAt).toLocaleDateString('th-TH')}
                      </div>
                      
                      {/* 🔥 ปุ่มแก้ไข */}
                      <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
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

        {/* 🔥 Modal แสดงตารางเวลา */}
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

        {/* 🔥 Modal เลือก Schedule ที่จะแก้ไข */}
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