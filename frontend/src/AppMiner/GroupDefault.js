import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../CSS/GroupDefault.css';
import { fetchPages, connectFacebook } from "../Features/Tool";
import Sidebar from "./Sidebar"; 

function GroupDefault() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [messageSequence, setMessageSequence] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [currentInput, setCurrentInput] = useState({
    type: 'text',
    content: '',
    file: null,
    preview: null
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [isDefaultGroupSetup, setIsDefaultGroupSetup] = useState(false); // 🔥 เพิ่ม state
  const navigate = useNavigate();

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // 🔥 ฟังก์ชันดึงกลุ่มลูกค้าตาม page ID
  const getGroupsForPage = (pageId) => {
    if (!pageId) return [];
    const key = `customerGroups_${pageId}`;
    const userGroups = JSON.parse(localStorage.getItem(key) || '[]');
    
    // 🔥 ดึงข้อมูล default groups พร้อมข้อความ
    const DEFAULT_GROUPS = [
      { id: 'default_1', name: 'กลุ่มคนหาย', isDefault: true },
      { id: 'default_2', name: 'กลุ่มคนหายนาน', isDefault: true },
      { id: 'default_3', name: 'กลุ่มคนหายนานมาก', isDefault: true }
    ];
    
    const defaultGroupsWithMessages = DEFAULT_GROUPS.map(group => {
      const messageKey = `defaultGroupMessages_${pageId}_${group.id}`;
      const savedMessages = JSON.parse(localStorage.getItem(messageKey) || '[]');
      
      // 🔥 ตรวจสอบชื่อที่ custom
      const customNamesKey = `defaultGroupCustomNames_${pageId}`;
      const customNames = JSON.parse(localStorage.getItem(customNamesKey) || '{}');
      
      return {
        ...group,
        name: customNames[group.id] || group.name,
        messages: savedMessages
      };
    });
    
    return [...defaultGroupsWithMessages, ...userGroups];
  };

  // 🔥 ฟังก์ชันบันทึกกลุ่มลูกค้าตาม page ID
  const saveGroupsForPage = (pageId, groups) => {
    if (!pageId) return;
    const key = `customerGroups_${pageId}`;
    const userGroups = groups.filter(g => !g.isDefault);
    localStorage.setItem(key, JSON.stringify(userGroups));
  };

  useEffect(() => {
    // 🔥 ตรวจสอบว่าเป็นโหมดแก้ไขหรือไม่
    const editMode = localStorage.getItem("editingMode");
    const scheduleId = localStorage.getItem("editingScheduleId");
    const isFromDefaultGroup = localStorage.getItem("isDefaultGroupSetup");
    
    if (isFromDefaultGroup === "true") {
      setIsDefaultGroupSetup(true);
      localStorage.removeItem("isDefaultGroupSetup"); // ลบหลังใช้
    }
    
    if (editMode === "true" || scheduleId) {
      setIsEditMode(true);
      if (scheduleId) {
        setEditingScheduleId(parseInt(scheduleId));
      }
      localStorage.removeItem("editingMode"); // ลบหลังใช้
    }

    // 🔥 ตรวจสอบว่า page ID ตรงกันหรือไม่
    const selectedPageId = localStorage.getItem("selectedCustomerGroupsPageId");
    const savedPage = localStorage.getItem("selectedPage");
    
    if (selectedPageId && selectedPageId !== savedPage) {
      alert("กลุ่มลูกค้าที่เลือกมาจากเพจอื่น กรุณากลับไปเลือกใหม่");
      navigate('/MinerGroup');
      return;
    }

    // โหลดกลุ่มที่เลือกจากหน้าก่อน
    const groups = JSON.parse(localStorage.getItem("selectedCustomerGroups") || '[]');
    const allGroups = getGroupsForPage(savedPage);
    const selectedGroupsData = allGroups.filter(g => groups.includes(g.id));
    setSelectedGroups(selectedGroupsData);

    if (savedPage) {
      setSelectedPage(savedPage);
    }

    fetchPages()
      .then(setPages)
      .catch(err => console.error("ไม่สามารถโหลดเพจได้:", err));

    // 🔥 โหลดข้อความที่บันทึกไว้
    const messageKey = `groupMessages_${savedPage}`;
    const savedMessages = JSON.parse(localStorage.getItem(messageKey) || '[]');
    
    if (savedMessages.length > 0) {
      setMessageSequence(savedMessages);
    } else if (selectedGroupsData.length > 0 && selectedGroupsData[0].messages) {
      // ถ้าไม่มีใน localStorage ให้โหลดจากกลุ่ม
      setMessageSequence(selectedGroupsData[0].messages);
    }
  }, [navigate]);

  const handlePageChange = (e) => {
    const pageId = e.target.value;
    setSelectedPage(pageId);
    localStorage.setItem("selectedPage", pageId);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setCurrentInput(prev => ({
      ...prev,
      file,
      preview,
      content: file.name
    }));
  };

  const addToSequence = () => {
    if (currentInput.type === 'text' && !currentInput.content.trim()) {
      alert("กรุณากรอกข้อความ");
      return;
    }

    if ((currentInput.type === 'image' || currentInput.type === 'video') && !currentInput.file) {
      alert("กรุณาเลือกไฟล์");
      return;
    }

    const newItem = {
      id: Date.now(),
      type: currentInput.type,
      content: currentInput.content || currentInput.file?.name || '',
      file: currentInput.file,
      preview: currentInput.preview,
      order: messageSequence.length
    };

    setMessageSequence(prev => [...prev, newItem]);

    if (currentInput.preview) {
      URL.revokeObjectURL(currentInput.preview);
    }
    setCurrentInput({
      type: 'text',
      content: '',
      file: null,
      preview: null
    });
  };

  const removeFromSequence = (id) => {
    setMessageSequence(prev => {
      const itemToDelete = prev.find(item => item.id === id);
      if (itemToDelete?.preview) {
        URL.revokeObjectURL(itemToDelete.preview);
      }

      const newSequence = prev.filter(item => item.id !== id);
      return newSequence.map((item, index) => ({
        ...item,
        order: index
      }));
    });
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.currentTarget.classList.add('drag-start');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('drag-start');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));

    if (dragIndex === dropIndex) return;

    const newSequence = [...messageSequence];
    const draggedItem = newSequence[dragIndex];

    newSequence.splice(dragIndex, 1);
    newSequence.splice(dropIndex, 0, draggedItem);

    newSequence.forEach((item, index) => {
      item.order = index;
    });

    setMessageSequence(newSequence);
  };

  // 🔥 ฟังก์ชันบันทึกเฉพาะข้อความ (รองรับ default groups)
  const saveMessages = () => {
    if (messageSequence.length === 0) {
      alert("กรุณาเพิ่มข้อความอย่างน้อย 1 ข้อความ");
      return;
    }

    // บันทึกข้อความลง localStorage แยกตามเพจ
    const messageKey = `groupMessages_${selectedPage}`;
    localStorage.setItem(messageKey, JSON.stringify(messageSequence));

    // อัพเดทข้อความในแต่ละกลุ่ม
    const allGroups = getGroupsForPage(selectedPage);
    const selectedGroupIds = JSON.parse(localStorage.getItem("selectedCustomerGroups") || '[]');
    
    // 🔥 บันทึกข้อความสำหรับ default groups แยก
    selectedGroupIds.forEach(groupId => {
      const group = allGroups.find(g => g.id === groupId);
      if (group && group.isDefault) {
        const defaultMessageKey = `defaultGroupMessages_${selectedPage}_${groupId}`;
        localStorage.setItem(defaultMessageKey, JSON.stringify(messageSequence));
      }
    });
    
    // อัพเดทข้อความสำหรับ user groups
    const updatedGroups = allGroups.map(group => {
      if (selectedGroupIds.includes(group.id) && !group.isDefault) {
        return { ...group, messages: messageSequence };
      }
      return group;
    });

    saveGroupsForPage(selectedPage, updatedGroups);
  
    console.log("ข้อความถูกบันทึกเรียบร้อยแล้ว:", messageSequence);
    alert("บันทึกข้อความสำเร็จ!");
  };

  const saveAndProceed = () => {
    if (messageSequence.length === 0) {
      alert("กรุณาเพิ่มข้อความอย่างน้อย 1 ข้อความ");
      return;
    }

    // บันทึกข้อความลง localStorage แยกตามเพจ
    const messageKey = `groupMessages_${selectedPage}`;
    localStorage.setItem(messageKey, JSON.stringify(messageSequence));

    // อัพเดทข้อความในแต่ละกลุ่ม
    const allGroups = getGroupsForPage(selectedPage);
    const selectedGroupIds = JSON.parse(localStorage.getItem("selectedCustomerGroups") || '[]');
    
    // 🔥 บันทึกข้อความสำหรับ default groups แยก
    selectedGroupIds.forEach(groupId => {
      const group = allGroups.find(g => g.id === groupId);
      if (group && group.isDefault) {
        const defaultMessageKey = `defaultGroupMessages_${selectedPage}_${groupId}`;
        localStorage.setItem(defaultMessageKey, JSON.stringify(messageSequence));
      }
    });
    
    // อัพเดทข้อความสำหรับ user groups
    const updatedGroups = allGroups.map(group => {
      if (selectedGroupIds.includes(group.id) && !group.isDefault) {
        return { ...group, messages: messageSequence };
      }
      return group;
    });

    saveGroupsForPage(selectedPage, updatedGroups);
    
    // 🔥 ถ้าเป็นโหมดแก้ไขและมี scheduleId ให้ไปหน้าตั้งเวลาเพื่อแก้ไขต่อ
    if (isEditMode && editingScheduleId) {
      // ส่งต่อ scheduleId ไปหน้าตั้งเวลา
      localStorage.setItem("editingScheduleId", editingScheduleId.toString());
      navigate('/GroupSchedule');
    } else if (isEditMode && !editingScheduleId) {
      // ถ้าเป็นการแก้ไขข้อความอย่างเดียว (ไม่มี schedule)
      localStorage.removeItem("selectedCustomerGroups");
      localStorage.removeItem("selectedCustomerGroupsPageId");
      navigate('/MinerGroup');
    } else {
      // ไปหน้าตั้งเวลาแบบปกติ (สร้างใหม่)
      navigate('/GroupSchedule');
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'text': return '💬';
      case 'image': return '🖼️';
      case 'video': return '📹';
      default: return '📄';
    }
  };

  const selectedPageInfo = pages.find(p => p.id === selectedPage);

  // 🔥 ตรวจสอบว่ากำลังตั้งค่าสำหรับ default group หรือไม่
  const isSettingDefaultGroup = selectedGroups.some(g => g.isDefault);

  return (
    <div className="app-container">
      <Sidebar />

      <div className="group-default-container">
        <div className="group-default-header">
          <h1 className="group-default-title">
            <span className="title-icon">💬</span>
            {isEditMode ? 'แก้ไขข้อความของกลุ่ม' : 
             isSettingDefaultGroup ? 'ตั้งค่าข้อความสำหรับกลุ่มพื้นฐาน' : 
             'ตั้งค่าข้อความสำหรับกลุ่มที่เลือก'}
            {selectedPageInfo && (
              <span style={{ fontSize: '18px', color: '#718096', marginLeft: '10px' }}>
                - {selectedPageInfo.name}
              </span>
            )}
          </h1>
          <div className="breadcrumb">
            <span className="breadcrumb-item">1. เลือกกลุ่ม</span>
            <span className="breadcrumb-separator">›</span>
            <span className="breadcrumb-item active">2. ตั้งค่าข้อความ</span>
            {((!isEditMode) || (isEditMode && editingScheduleId)) && (
              <>
                <span className="breadcrumb-separator">›</span>
                <span className="breadcrumb-item">3. ตั้งเวลา</span>
              </>
            )}
          </div>
        </div>

        <div className="selected-groups-info">
          <h3>
            {isEditMode ? 'กำลังแก้ไขกลุ่ม' : 
             isSettingDefaultGroup ? '🌟 กลุ่มพื้นฐานที่เลือก' : 
             'กลุ่มที่เลือก'} 
            ({selectedPageInfo?.name}):
          </h3>
          <div className="selected-groups-list">
            {selectedGroups.map(group => (
              <span key={group.id} className={`group-badge ${group.isDefault ? 'default-badge' : ''}`}>
                {group.isDefault && '⭐ '}
                {group.name}
              </span>
            ))}
          </div>
        </div>

        <div className="message-config-container">
          <div className="config-card">
            <h3 className="config-header">✨ เพิ่มข้อความใหม่</h3>

            <div className="input-form">
              <label className="input-label">ประเภท:</label>
              <select
                value={currentInput.type}
                onChange={(e) => setCurrentInput(prev => ({
                  ...prev,
                  type: e.target.value,
                  content: '',
                  file: null,
                  preview: null
                }))}
                className="input-select"
              >
                <option value="text">💬 ข้อความ</option>
                <option value="image">🖼️ รูปภาพ</option>
                <option value="video">📹 วิดีโอ</option>
              </select>
            </div>

            {currentInput.type === 'text' ? (
              <div className="input-form">
                <label className="input-label">ข้อความ:</label>
                <textarea
                  value={currentInput.content}
                  onChange={(e) => setCurrentInput(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="กรอกข้อความที่ต้องการส่ง..."
                  className="input-textarea"
                />
              </div>
            ) : (
              <div className="input-form">
                <label className="input-label">เลือกไฟล์:</label>
                <input
                  type="file"
                  accept={currentInput.type === 'image' ? 'image/*' : 'video/*'}
                  onChange={handleFileUpload}
                  className="input-file"
                />
                {currentInput.preview && (
                  <div className="preview-container">
                    {currentInput.type === 'image' ? (
                      <img
                        src={currentInput.preview}
                        alt="Preview"
                        className="preview-image"
                      />
                    ) : (
                      <video
                        src={currentInput.preview}
                        controls
                        className="preview-video"
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={addToSequence}
              className="add-btn"
            >
              ➕ เพิ่มในลำดับ
            </button>
          </div>

          <div className="config-card">
            <div className="sequence-header-container">
              <h3 className="config-header">📋 ลำดับการส่ง</h3>
              <button
                onClick={saveMessages}
                className="save-messages-btn"
              >
                💾 บันทึกข้อความ
              </button>
            </div>

            <div className="sequence-hint">
              💡 ลากและวางเพื่อจัดลำดับใหม่
            </div>

            {messageSequence.length === 0 ? (
              <div className="empty-state">
                ยังไม่มีข้อความในลำดับ เพิ่มข้อความหรือสื่อเข้ามาได้เลย!
              </div>
            ) : (
              <div className="sequence-list">
                {messageSequence.map((item, index) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className="sequence-item"
                  >
                    <div className="sequence-order">
                      {index + 1}
                    </div>

                    <div className="sequence-icon">
                      {getTypeIcon(item.type)}
                    </div>

                    <div className="sequence-content">
                      <div className="sequence-type">
                        {item.type === 'text' ? 'ข้อความ' : item.type === 'image' ? 'รูปภาพ' : 'วิดีโอ'}
                      </div>
                      <div className="sequence-text">
                        {item.content}
                      </div>
                    </div>

                    <button
                      onClick={() => removeFromSequence(item.id)}
                      className="sequence-delete-btn"
                      title="ลบรายการนี้"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="action-buttons">
          <Link to="/MinerGroup" className="back-btn">
            ← กลับ
          </Link>
          <button
            onClick={saveAndProceed}
            className="proceed-btn"
            disabled={messageSequence.length === 0}
          >
            {isEditMode ? 
              (editingScheduleId ? 'ถัดไป: แก้ไขการตั้งเวลา' : 'บันทึกและกลับ') 
              : 'ถัดไป: ตั้งเวลาส่ง'}
            <span className="arrow-icon">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupDefault;