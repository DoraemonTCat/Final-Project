import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../CSS/GroupDefault.css';
import { 
  fetchPages, 
  getCustomerGroups, 
  saveGroupMessages, 
  getGroupMessages 
} from "../Features/Tool";
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentGroupId, setCurrentGroupId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const pagesData = await fetchPages();
        setPages(pagesData);

        // ตรวจสอบว่าเป็นโหมดแก้ไขหรือไม่
        const editMode = localStorage.getItem("editingMode");
        const scheduleId = localStorage.getItem("editingScheduleId");
        
        if (editMode === "true" || scheduleId) {
          setIsEditMode(true);
          if (scheduleId) {
            setEditingScheduleId(parseInt(scheduleId));
          }
          localStorage.removeItem("editingMode");
        }

        // โหลดกลุ่มที่เลือก
        const selectedGroupIds = JSON.parse(localStorage.getItem("selectedCustomerGroups") || '[]');
        const savedPage = localStorage.getItem("selectedPage");
        
        if (savedPage) {
          setSelectedPage(savedPage);
          
          // ดึงข้อมูลกลุ่มจาก database
          const pagesResponse = await fetch('http://localhost:8000/pages/');
          const pagesData = await pagesResponse.json();
          const currentPage = pagesData.find(p => p.page_id === savedPage);
          
          if (currentPage) {
            const groupsData = await getCustomerGroups(currentPage.ID);
            const selectedGroupsData = groupsData.filter(g => selectedGroupIds.includes(g.id));
            setSelectedGroups(selectedGroupsData);
            
            // ถ้ามีกลุ่มเดียว ให้โหลดข้อความของกลุ่มนั้น
            if (selectedGroupsData.length === 1 && selectedGroupsData[0].messages) {
              setCurrentGroupId(selectedGroupsData[0].id);
              const messages = await getGroupMessages(selectedGroupsData[0].id);
              setMessageSequence(messages);
            }
          }
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };

    loadInitialData();
  }, []);

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

  // บันทึกข้อความลง database
  const saveMessages = async () => {
    if (messageSequence.length === 0) {
      alert("กรุณาเพิ่มข้อความอย่างน้อย 1 ข้อความ");
      return;
    }

    if (!currentGroupId && selectedGroups.length === 1) {
      setCurrentGroupId(selectedGroups[0].id);
    }

    if (!currentGroupId) {
      alert("กรุณาเลือกกลุ่มลูกค้า");
      return;
    }

    setLoading(true);
    try {
      await saveGroupMessages(currentGroupId, messageSequence);
     
    } catch (error) {
      console.error('Error saving messages:', error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อความ");
    } finally {
      setLoading(false);
    }
  };

  const saveAndProceed = async () => {
    if (messageSequence.length === 0) {
      alert("กรุณาเพิ่มข้อความอย่างน้อย 1 ข้อความ");
      return;
    }

    await saveMessages();

    // ถ้าเป็นโหมดแก้ไขและมี scheduleId ให้ไปหน้าตั้งเวลาเพื่อแก้ไขต่อ
    if (isEditMode && editingScheduleId) {
      localStorage.setItem("editingScheduleId", editingScheduleId.toString());
      navigate('/GroupSchedule');
    } else if (isEditMode && !editingScheduleId) {
      // ถ้าเป็นการแก้ไขข้อความอย่างเดียว
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

  return (
    <div className="app-container">
      <Sidebar />

      <div className="group-default-container">
        <div className="group-default-header">
          <h1 className="group-default-title">
            <span className="title-icon">💬</span>
            {isEditMode ? 'แก้ไขข้อความของกลุ่ม' : 'ตั้งค่าข้อความสำหรับกลุ่มที่เลือก'}
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
          <h3>{isEditMode ? 'กำลังแก้ไขกลุ่ม' : 'กลุ่มที่เลือก'} ({selectedPageInfo?.name}):</h3>
          <div className="selected-groups-list">
            {selectedGroups.map(group => (
              <span key={group.id} className="group-badge">
                {group.type_name}
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
              disabled={loading}
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
                disabled={loading}
              >
                {loading ? '⏳ กำลังบันทึก...' : '💾 บันทึกข้อความ'}
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
                      disabled={loading}
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
            disabled={messageSequence.length === 0 || loading}
          >
            {loading ? '⏳ กำลังบันทึก...' : 
             isEditMode ? 
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