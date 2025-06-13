import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../CSS/Default.css';
import {
  fetchPages, connectFacebook, saveMessageToDB, saveMessagesBatch
  , getMessagesBySetId, deleteMessageFromDB, createMessageSet, getMessageSetsByPage, updateMessageSet
} from "../Features/Tool";


function SetDefault() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messageSequence, setMessageSequence] = useState([]);
  const [selectedMessageSetId, setSelectedMessageSetId] = useState(null);
  const [messageSetName, setMessageSetName] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchParams] = useSearchParams();
  const [currentInput, setCurrentInput] = useState({
    type: 'text',
    content: '',
    file: null,
    preview: null
  });

  // 1. เพิ่ม state สำหรับควบคุม dropdown (เพิ่มในส่วนบนของ component)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // เพิ่มฟังก์ชัน toggle
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
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

  // โหลดข้อมูลถ้ามาจากโหมดแก้ไข
  useEffect(() => {
    const setId = searchParams.get('setId');
    if (setId && selectedPage) {
      loadExistingMessageSet(setId);
    }
  }, [searchParams, selectedPage]);

  const loadExistingMessageSet = async (setId) => {
    try {
      setLoading(true);
      setIsEditMode(true);
      setSelectedMessageSetId(parseInt(setId));

      // โหลดข้อมูลชุดข้อความ
      const sets = await getMessageSetsByPage(selectedPage);
      const currentSet = sets.find(s => s.id === parseInt(setId));
      if (currentSet) {
        setMessageSetName(currentSet.set_name);
      }

      // โหลดข้อความในชุด
      const messages = await getMessagesBySetId(setId);
      const sequenceData = messages.map((msg, index) => ({
        id: msg.id || Date.now() + index,
        type: msg.message_type || 'text',
        content: msg.content || msg.message,
        order: msg.display_order || index,
        originalData: msg
      }));
      setMessageSequence(sequenceData);
    } catch (err) {
      console.error("โหลดข้อมูลชุดข้อความล้มเหลว:", err);
      alert("ไม่สามารถโหลดข้อมูลชุดข้อความได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadMessages = async () => {
      if (selectedPage && !isEditMode) {
        setLoading(true);
        try {
          console.log(`🔄 กำลังโหลดข้อความสำหรับ page_id: ${selectedPage}`);
          const data = await getMessagesBySetId(selectedPage);
          console.log(`✅ โหลดข้อความสำเร็จ:`, data);

          const sequenceData = Array.isArray(data) ? data.map((msg, index) => ({
            id: msg.id || Date.now() + index,
            type: 'text',
            content: msg.message,
            order: index,
            originalData: msg
          })) : [];
          setMessageSequence(sequenceData);
        } catch (err) {
          console.error("โหลดข้อความล้มเหลว:", err);
          setMessageSequence([]);
        } finally {
          setLoading(false);
        }
      }
    };

    if (!isEditMode) {
      loadMessages();
    }
  }, [selectedPage, isEditMode]);

  const handlePageChange = (e) => {
    const pageId = e.target.value;
    console.log(`📄 เปลี่ยนเพจเป็น: ${pageId}`);
    setSelectedPage(pageId);

    if (pageId) {
      localStorage.setItem("selectedPage", pageId);
    } else {
      localStorage.removeItem("selectedPage");
    }

    setCurrentInput({
      type: 'text',
      content: '',
      file: null,
      preview: null
    });
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
    if (!selectedPage) {
      alert("กรุณาเลือกเพจก่อน");
      return;
    }

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

  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const saveMessageSequence = async () => {
    if (!messageSetName.trim()) {
      alert("กรุณากรอกชื่อชุดข้อความ");
      return;
    }
    if (!selectedPage) {
      alert("กรุณาเลือกเพจก่อน");
      return;
    }

    try {
      let setId = selectedMessageSetId;

      // ถ้าเป็นโหมดแก้ไข อัพเดทชื่อชุดข้อความ
      if (isEditMode && setId) {
        await updateMessageSet(setId, messageSetName.trim());
        
        // ลบข้อความเดิมทั้งหมดก่อน
        const oldMessages = messageSequence.filter(item => item.originalData);
        for (const msg of oldMessages) {
          if (msg.originalData?.id) {
            await deleteMessageFromDB(msg.originalData.id);
          }
        }
      } else if (!setId) {
        // ถ้ายังไม่มีชุดข้อความ ให้สร้างก่อน
        const newSet = await createMessageSet({
          page_id: selectedPage,
          set_name: messageSetName.trim()
        });
        setId = newSet.id;
        setSelectedMessageSetId(setId);
      }

      // บันทึกข้อความทั้งหมดใหม่
      const payloads = await Promise.all(messageSequence.map(async (item, index) => {
        let mediaData = null;

        if (item.file) {
          const base64 = await convertFileToBase64(item.file);
          if (item.type === 'image') {
            mediaData = {
              images1: [{ name: item.file.name, type: item.file.type, size: item.file.size, data: base64 }],
              videos: [],
              images2: []
            };
          } else if (item.type === 'video') {
            mediaData = {
              videos: [{ name: item.file.name, type: item.file.type, size: item.file.size, data: base64 }],
              images1: [],
              images2: []
            };
          }
        }

        const content = item.type === 'text' ? item.content : `[${item.type.toUpperCase()}] ${item.content}`;

        return {
          message_set_id: setId,
          page_id: selectedPage,
          message_type: item.type,
          content,
          display_order: index,
        };
      }));

      await saveMessagesBatch(payloads);
      alert(isEditMode ? "แก้ไขชุดข้อความสำเร็จ!" : "บันทึกข้อความสำเร็จ!");
      console.log("✅ บันทึกข้อความสำเร็จ");

      // โหลดข้อความใหม่
      const data = await getMessagesBySetId(setId);
      const sequenceData = data.map((msg, index) => ({
        id: msg.id || Date.now() + index,
        type: msg.message_type || 'text',
        content: msg.content || msg.message,
        order: msg.display_order || index,
        originalData: msg
      }));

      setMessageSequence(sequenceData);
      setIsEditMode(true);
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการบันทึก:", error);
      alert("เกิดข้อผิดพลาดในการบันทึก: " + error.message);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("คุณต้องการลบข้อความนี้หรือไม่?")) {
      return;
    }

    try {
      console.log(`🗑️ กำลังลบข้อความ ID: ${messageId}`);
      await deleteMessageFromDB(messageId);
      console.log(`✅ ลบข้อความสำเร็จ`);

      setMessageSequence(prevMessages => prevMessages.filter(msg => msg.originalData?.id !== messageId));

    } catch (err) {
      console.error("เกิดข้อผิดพลาดในการลบข้อความ:", err);
      alert("เกิดข้อผิดพลาดในการลบข้อความ");
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

  const selectedPageName = pages.find(page => page.id === selectedPage)?.name || "ไม่ได้เลือกเพจ";

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

      <div className="message-settings-container">
        <h1 className="header">
          {isEditMode ? "แก้ไขชุดข้อความ" : "ตั้งค่าลำดับข้อความ Default"}
        </h1>

        <div className="page-info">
          <p style={{ textAlign: "center" }}><strong>เพจที่เลือก:</strong> {selectedPageName}</p>
        </div>

        <div className="sequence-container">
          <div className="sequence-card">
            <h3 className="sequence-header">📝 {isEditMode ? "แก้ไขชื่อชุดข้อความ" : "ตั้งชื่อชุดข้อความ"}</h3>
            <div className="input-form">
              <label className="input-label">ชื่อชุดข้อความ:</label>
              <input
                type="text"
                value={messageSetName}
                onChange={(e) => setMessageSetName(e.target.value)}
                placeholder="กรอกชื่อชุดข้อความ..."
                className="input-text"
              />
            </div>
            <h3 className="sequence-header">✨ เพิ่มรายการใหม่</h3>

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
              disabled={!selectedPage}
              className="add-btn"
            >
              ➕ เพิ่มในลำดับ
            </button>
          </div>

          <div className="sequence-card">
            <div className="sequence-header-container">
              <h3 className="sequence-header">📋 ลำดับการส่ง </h3>
              <button
                onClick={saveMessageSequence}
                className="save-btn"
              >
                💾 {isEditMode ? "บันทึกการแก้ไข" : "บันทึกทั้งหมด"}
              </button>
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
                {selectedPage ?
                  "ยังไม่มีรายการในลำดับ เพิ่มข้อความหรือสื่อเข้ามาได้เลย!" :
                  "กรุณาเลือกเพจเพื่อเริ่มต้น"
                }
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
                    className={`sequence-item ${item.originalData ? 'sequence-item-saved' : ''}`}
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
                        {item.originalData && <span className="sequence-saved-label"> (บันทึกแล้ว)</span>}
                      </div>
                      <div className="sequence-text">
                        {item.content}
                      </div>
                    </div>

                    <button
                      onClick={() => item.originalData ?
                        handleDeleteMessage(item.originalData.id) :
                        removeFromSequence(item.id)
                      }
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

        <Link to="/manage-message-sets" className="back-button">
          ← กลับไปหน้ารายการชุดข้อความ
        </Link>
      </div>
    </div>
  );
}

export default SetDefault;