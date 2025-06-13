import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../CSS/GroupDefault.css';
import { fetchPages, connectFacebook } from "../Features/Tool";

function GroupDefault() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messageSequence, setMessageSequence] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [currentInput, setCurrentInput] = useState({
    type: 'text',
    content: '',
    file: null,
    preview: null
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  useEffect(() => {
    // โหลดกลุ่มที่เลือกจากหน้าก่อน
    const groups = JSON.parse(localStorage.getItem("selectedCustomerGroups") || '[]');
    const allGroups = JSON.parse(localStorage.getItem("customerGroups") || '[]');
    const selectedGroupsData = allGroups.filter(g => groups.includes(g.id));
    setSelectedGroups(selectedGroupsData);

    const savedPage = localStorage.getItem("selectedPage");
    if (savedPage) {
      setSelectedPage(savedPage);
    }

    fetchPages()
      .then(setPages)
      .catch(err => console.error("ไม่สามารถโหลดเพจได้:", err));

    // โหลดข้อความที่บันทึกไว้ (ถ้ามี)
    const savedMessages = JSON.parse(localStorage.getItem("groupMessages") || '[]');
    if (savedMessages.length > 0) {
      setMessageSequence(savedMessages);
    }
  }, []);

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

  const saveAndProceed = () => {
    if (messageSequence.length === 0) {
      alert("กรุณาเพิ่มข้อความอย่างน้อย 1 ข้อความ");
      return;
    }

    // บันทึกข้อความลง localStorage
    localStorage.setItem("groupMessages", JSON.stringify(messageSequence));

    // อัพเดทข้อความในแต่ละกลุ่ม
    const allGroups = JSON.parse(localStorage.getItem("customerGroups") || '[]');
    const selectedGroupIds = JSON.parse(localStorage.getItem("selectedCustomerGroups") || '[]');
    
    const updatedGroups = allGroups.map(group => {
      if (selectedGroupIds.includes(group.id)) {
        return { ...group, messages: messageSequence };
      }
      return group;
    });

    localStorage.setItem("customerGroups", JSON.stringify(updatedGroups));
    
    // ไปหน้าตั้งเวลา
    navigate('/GroupSchedule');
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'text': return '💬';
      case 'image': return '🖼️';
      case 'video': return '📹';
      default: return '📄';
    }
  };

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
          <a href="#" className="nav-link">
            <span className="nav-icon">🔧</span>
            Setting
          </a>
        </nav>
      </aside>

      <div className="group-default-container">
        <div className="group-default-header">
          <h1 className="group-default-title">
            <span className="title-icon">💬</span>
            ตั้งค่าข้อความสำหรับกลุ่มที่เลือก
          </h1>
          <div className="breadcrumb">
            <span className="breadcrumb-item">1. เลือกกลุ่ม</span>
            <span className="breadcrumb-separator">›</span>
            <span className="breadcrumb-item active">2. ตั้งค่าข้อความ</span>
            <span className="breadcrumb-separator">›</span>
            <span className="breadcrumb-item">3. ตั้งเวลา</span>
          </div>
        </div>

        <div className="selected-groups-info">
          <h3>กลุ่มที่เลือก:</h3>
          <div className="selected-groups-list">
            {selectedGroups.map(group => (
              <span key={group.id} className="group-badge">
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
            </div>

            <div className="sequence-hint">
              💡 ลากและวางเพื่อจัดลำดับใหม่
            </div>

            {loading ? (
              <div className="loading-state">
                🔄 กำลังโหลด...
              </div>
            ) : messageSequence.length === 0 ? (
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
            ถัดไป: ตั้งเวลาส่ง
            <span className="arrow-icon">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupDefault;