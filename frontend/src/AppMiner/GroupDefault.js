import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../CSS/GroupDefault.css';
import { fetchPages, connectFacebook, fileToBase64 } from "../Features/Tool";
import Sidebar from "./Sidebar";

// Memoized components
const MessageItem = memo(({ item, index, onDragStart, onDragEnd, onDragOver, onDrop, onRemove, loading }) => {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      className="sequence-item"
    >
      <div className="sequence-order">{index + 1}</div>
      <div className="sequence-icon">
        {item.type === 'text' ? '💬' : item.type === 'image' ? '🖼️' : '📹'}
      </div>
      <div className="sequence-content">
        <div className="sequence-type">
          {item.type === 'text' ? 'ข้อความ' : item.type === 'image' ? 'รูปภาพ' : 'วิดีโอ'}
          {item.dbId && <span className="sequence-saved-label"> (บันทึกแล้ว)</span>}
        </div>
        <div className="sequence-text">{item.content}</div>
        {item.type === 'image' && <ImagePreview item={item} />}
      </div>
      <button
        onClick={() => onRemove(item.id)}
        className="sequence-delete-btn"
        title="ลบรายการนี้"
        disabled={loading}
      >
        🗑️
      </button>
    </div>
  );
});

const ImagePreview = memo(({ item }) => {
  if (item.preview) {
    return (
      <img 
        src={item.preview} 
        alt="Preview" 
        style={{ 
          maxWidth: '100px', 
          maxHeight: '100px', 
          marginTop: '5px',
          borderRadius: '4px',
          border: '1px solid #ddd'
        }} 
      />
    );
  } else if (item.imageBase64) {
    return (
      <img 
        src={item.imageBase64} 
        alt="Saved" 
        style={{ 
          maxWidth: '100px', 
          maxHeight: '100px', 
          marginTop: '5px',
          borderRadius: '4px',
          border: '1px solid #ddd'
        }} 
      />
    );
  }
  return null;
});

function GroupDefault() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [messageSequence, setMessageSequence] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [currentInput, setCurrentInput] = useState({
    type: 'text',
    content: '',
    file: null,
    preview: null,
    imageFile: null
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [isDefaultGroupSetup, setIsDefaultGroupSetup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [pageDbId, setPageDbId] = useState(null);
  const navigate = useNavigate();

  // Cache for page DB IDs
  const pageDbIdCache = useMemo(() => new Map(), []);

  // Optimized function with caching
  const getPageDbId = useCallback(async (pageId) => {
    if (pageDbIdCache.has(pageId)) {
      return pageDbIdCache.get(pageId);
    }

    try {
      const response = await fetch('http://localhost:8000/pages/');
      if (!response.ok) throw new Error('Failed to fetch pages');
      
      const pagesData = await response.json();
      const currentPage = pagesData.find(p => p.page_id === pageId || p.id === pageId);
      
      if (currentPage) {
        pageDbIdCache.set(pageId, currentPage.ID);
        return currentPage.ID;
      }
      return null;
    } catch (error) {
      console.error('Error getting page DB ID:', error);
      return null;
    }
  }, [pageDbIdCache]);

  const isKnowledgeGroup = useCallback((groupId) => {
    return groupId && groupId.toString().startsWith('knowledge_');
  }, []);

  // Optimized message loading with error boundary
  const loadMessagesFromDatabase = useCallback(async (pageId, groupId) => {
    try {
      setLoading(true);
      
      if (isKnowledgeGroup(groupId)) {
        const knowledgeId = groupId.replace('knowledge_', '');
        const response = await fetch(`http://localhost:8000/knowledge-group-messages/${pageId}/${knowledgeId}`);
        if (!response.ok) throw new Error('Failed to load messages');
        
        const messages = await response.json();
        const formattedMessages = messages.map(msg => ({
          id: msg.id,
          type: msg.message_type,
          content: msg.content,
          order: msg.display_order,
          dbId: msg.id,
          hasImage: msg.has_image || msg.has_media || false,
          imageBase64: msg.image_base64 || msg.media_base64 || null
        }));
        
        setMessageSequence(formattedMessages);
      } else {
        const dbId = await getPageDbId(pageId);
        if (!dbId) {
          console.error('Cannot find page DB ID');
          return;
        }

        const response = await fetch(`http://localhost:8000/group-messages/${dbId}/${groupId}`);
        if (!response.ok) throw new Error('Failed to load messages');
        
        const messages = await response.json();
        const formattedMessages = messages.map(msg => ({
          id: msg.id,
          type: msg.message_type,
          content: msg.content,
          order: msg.display_order,
          dbId: msg.id,
          hasImage: msg.has_image || msg.has_media || false,
          imageBase64: msg.image_base64 || msg.media_base64 || null
        }));
        
        setMessageSequence(formattedMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessageSequence([]);
    } finally {
      setLoading(false);
    }
  }, [getPageDbId, isKnowledgeGroup]);

  // Load selected groups - optimized with single effect
  useEffect(() => {
    const loadSelectedGroups = async () => {
      try {
        const editMode = localStorage.getItem("editingMode");
        const scheduleId = localStorage.getItem("editingScheduleId");
        const isFromDefaultGroup = localStorage.getItem("isDefaultGroupSetup");
        
        if (isFromDefaultGroup === "true") {
          setIsDefaultGroupSetup(true);
          localStorage.removeItem("isDefaultGroupSetup");
        }
        
        if (editMode === "true" || scheduleId) {
          setIsEditMode(true);
          if (scheduleId) {
            setEditingScheduleId(parseInt(scheduleId));
          }
          localStorage.removeItem("editingMode");
        }

        const selectedPageId = localStorage.getItem("selectedCustomerGroupsPageId");
        const savedPage = localStorage.getItem("selectedPage");
        
        if (selectedPageId && selectedPageId !== savedPage) {
          alert("กลุ่มลูกค้าที่เลือกมาจากเพจอื่น กรุณากลับไปเลือกใหม่");
          navigate('/MinerGroup');
          return;
        }

        const selectedGroupIds = JSON.parse(localStorage.getItem("selectedCustomerGroups") || '[]');
        
        if (savedPage) {
          setSelectedPage(savedPage);
          
          const dbId = await getPageDbId(savedPage);
          setPageDbId(dbId);
          
          if (selectedGroupIds.length > 0) {
            const isKnowledgeGroupSelected = selectedGroupIds.some(id => 
              id && id.toString().startsWith('knowledge_')
            );
            
            if (isKnowledgeGroupSelected) {
              const response = await fetch(`http://localhost:8000/page-customer-type-knowledge/${savedPage}`);
              if (response.ok) {
                const knowledgeTypes = await response.json();
                const selectedKnowledgeGroups = knowledgeTypes.filter(kt => 
                  selectedGroupIds.includes(kt.id)
                );
                
                const formattedGroups = selectedKnowledgeGroups.map(group => ({
                  id: group.id,
                  name: group.type_name,
                  type_name: group.type_name,
                  isDefault: false,
                  isKnowledge: true,
                  rule_description: group.rule_description || '',
                  keywords: group.keywords || '',
                  examples: group.examples || ''
                }));
                
                setSelectedGroups(formattedGroups);
                
                if (formattedGroups.length > 0) {
                  const groupId = formattedGroups[0].id;
                  setSelectedGroupId(groupId);
                  await loadMessagesFromDatabase(savedPage, groupId);
                }
              }
            } else {
              const response = await fetch(`http://localhost:8000/customer-groups/${dbId}`);
              if (response.ok) {
                const allGroups = await response.json();
                const selectedGroupsData = allGroups.filter(g => 
                  selectedGroupIds.includes(g.id)
                );
                
                const formattedGroups = selectedGroupsData.map(group => ({
                  id: group.id,
                  name: group.type_name,
                  type_name: group.type_name,
                  isDefault: false,
                  rule_description: group.rule_description || '',
                  keywords: Array.isArray(group.keywords) ? group.keywords.join(', ') : group.keywords || '',
                  examples: Array.isArray(group.examples) ? group.examples.join('\n') : group.examples || ''
                }));
                
                setSelectedGroups(formattedGroups);
                
                if (formattedGroups.length > 0) {
                  const groupId = formattedGroups[0].id;
                  setSelectedGroupId(groupId);
                  await loadMessagesFromDatabase(savedPage, groupId);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error in loadSelectedGroups:', error);
      }
    };

    loadSelectedGroups();
  }, [navigate, getPageDbId, loadMessagesFromDatabase]);

  const handlePageChange = useCallback((e) => {
    const pageId = e.target.value;
    setSelectedPage(pageId);
    localStorage.setItem("selectedPage", pageId);
  }, []);

  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setCurrentInput(prev => ({
      ...prev,
      file,
      preview,
      content: file.name,
      imageFile: file
    }));
  }, []);

  // Optimized add sequence function
  const addToSequence = useCallback(async () => {
  if (currentInput.type === 'text' && !currentInput.content.trim()) {
    alert("กรุณากรอกข้อความ");
    return;
  }

  if ((currentInput.type === 'image' || currentInput.type === 'video') && !currentInput.file) {
    alert("กรุณาเลือกไฟล์");
    return;
  }

  try {
    setLoading(true);
    
    if (!selectedGroups || selectedGroups.length === 0) {
      alert("กรุณาเลือกกลุ่มลูกค้า");
      return;
    }
    
    const firstGroup = selectedGroups[0];
    const groupId = firstGroup.id || selectedGroupId;
    
    let imageBase64 = null;
    if (currentInput.imageFile && (currentInput.type === 'image' || currentInput.type === 'video')) {
      imageBase64 = await fileToBase64(currentInput.imageFile);
    }
    
    // บันทึกข้อความลง Database
    let savedMessage = null;
    
    if (isKnowledgeGroup(groupId) && selectedPage) {
      // Knowledge group message
      const messageData = {
        page_id: selectedPage,
        customer_type_custom_id: groupId,
        message_type: currentInput.type,
        content: currentInput.content || currentInput.file?.name || '',
        display_order: messageSequence.length,
        image_data_base64: imageBase64
      };

      const response = await fetch('http://localhost:8000/knowledge-group-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });

      if (!response.ok) {
        throw new Error('Failed to save message');
      }
      
      savedMessage = await response.json();
      
    } else if (selectedGroupId && firstGroup && !firstGroup.isDefault && pageDbId) {
      // User group message
      const messageData = {
        page_id: pageDbId,
        customer_type_custom_id: selectedGroupId,
        message_type: currentInput.type,
        content: currentInput.content || currentInput.file?.name || '',
        display_order: messageSequence.length,
        image_data_base64: imageBase64
      };

      const response = await fetch('http://localhost:8000/group-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });

      if (!response.ok) {
        throw new Error('Failed to save message');
      }
      
      savedMessage = await response.json();
    }
    
    // 🆕 ถ้าอยู่ใน Edit Mode และมีข้อความที่บันทึกแล้ว ให้เพิ่ม Schedule ให้ข้อความใหม่ด้วย
    if (isEditMode && savedMessage && savedMessage.id) {
      await addScheduleToNewMessage(savedMessage.id);
    }
    
    // เพิ่มเข้า UI
    const newItem = {
      id: savedMessage?.id || Date.now(),
      type: savedMessage?.message_type || currentInput.type,
      content: savedMessage?.content || currentInput.content,
      order: savedMessage?.display_order || messageSequence.length,
      dbId: savedMessage?.id,
      hasImage: savedMessage?.has_image || false,
      preview: currentInput.preview
    };

    setMessageSequence(prev => [...prev, newItem]);
    
    // Reset input
    if (currentInput.preview) {
      URL.revokeObjectURL(currentInput.preview);
    }
    
    setCurrentInput({
      type: 'text',
      content: '',
      file: null,
      preview: null,
      imageFile: null
    });

  } catch (error) {
    console.error('Error adding message:', error);
    alert('เกิดข้อผิดพลาดในการเพิ่มข้อความ: ' + error.message);
  } finally {
    setLoading(false);
  }
}, [currentInput, selectedGroups, selectedGroupId, messageSequence.length, selectedPage, pageDbId, isKnowledgeGroup, isEditMode]);

// 🆕 เพิ่มฟังก์ชันสร้าง Schedule สำหรับข้อความใหม่
const addScheduleToNewMessage = useCallback(async (messageId) => {
  try {
    // ดึง Schedule เดิมของกลุ่มนี้
    const groupId = selectedGroups[0].id;
    const dbId = await getPageDbId(selectedPage);
    
    let existingSchedule = null;
    
    if (isKnowledgeGroup(groupId)) {
      const searchGroupId = `group_knowledge_${groupId.replace('knowledge_', '')}`;
      const response = await fetch(`http://localhost:8000/message-schedules/group/${dbId}/${searchGroupId}`);
      if (response.ok) {
        const schedules = await response.json();
        existingSchedule = schedules[0];
      }
    } else {
      const response = await fetch(`http://localhost:8000/message-schedules/group/${dbId}/${groupId}`);
      if (response.ok) {
        const schedules = await response.json();
        existingSchedule = schedules[0];
      }
    }
    
    // ถ้ามี Schedule เดิมอยู่แล้ว ให้สร้าง Schedule แบบเดียวกันสำหรับข้อความใหม่
    if (existingSchedule) {
      const newScheduleData = {
        customer_type_message_id: messageId,
        send_type: existingSchedule.send_type,
        scheduled_at: existingSchedule.scheduled_at,
        send_after_inactive: existingSchedule.send_after_inactive,
        frequency: existingSchedule.frequency
      };
      
      const response = await fetch('http://localhost:8000/message-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newScheduleData)
      });
      
      if (response.ok) {
        console.log('✅ Schedule added to new message');
      }
    } else {
      // ถ้าไม่มี Schedule เดิม สร้าง default schedule (immediate)
      const defaultScheduleData = {
        customer_type_message_id: messageId,
        send_type: 'immediate',
        scheduled_at: null,
        send_after_inactive: null,
        frequency: 'once'
      };
      
      const response = await fetch('http://localhost:8000/message-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultScheduleData)
      });
      
      if (response.ok) {
        console.log('✅ Default schedule added to new message');
      }
    }
  } catch (error) {
    console.error('Error adding schedule to new message:', error);
    // ไม่ throw error เพื่อให้การเพิ่มข้อความยังสำเร็จ
  }
}, [selectedGroups, selectedPage, getPageDbId, isKnowledgeGroup]);

  // Optimized remove function
  const removeFromSequence = useCallback(async (id) => {
    const itemToDelete = messageSequence.find(item => item.id === id);
    if (!itemToDelete) return;

    try {
      if (itemToDelete.dbId && selectedGroups && selectedGroups.length > 0) {
        const firstGroup = selectedGroups[0];
        const groupId = firstGroup?.id || selectedGroupId;
        
        if (groupId && isKnowledgeGroup(groupId)) {
          const response = await fetch(`http://localhost:8000/knowledge-group-messages/${itemToDelete.dbId}`, {
            method: 'DELETE'
          });
          if (!response.ok) throw new Error('Failed to delete message');
        } else if (firstGroup && !firstGroup.isDefault) {
          const response = await fetch(`http://localhost:8000/group-messages/${itemToDelete.dbId}`, {
            method: 'DELETE'
          });
          if (!response.ok) throw new Error('Failed to delete message');
        }
      }

      if (itemToDelete.preview) {
        URL.revokeObjectURL(itemToDelete.preview);
      }

      setMessageSequence(prev => {
        const newSequence = prev.filter(item => item.id !== id);
        return newSequence.map((item, index) => ({
          ...item,
          order: index
        }));
      });

    } catch (error) {
      console.error('Error deleting message:', error);
      alert('เกิดข้อผิดพลาดในการลบข้อความ');
    }
  }, [messageSequence, selectedGroups, selectedGroupId, isKnowledgeGroup]);

  // Drag and Drop functions - optimized
  const handleDragStart = useCallback((e, index) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.currentTarget.classList.add('drag-start');
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.currentTarget.classList.remove('drag-start');
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(async (e, dropIndex) => {
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

    if (selectedGroups[0] && !selectedGroups[0].isDefault) {
      try {
        const updatePromises = newSequence.map(item => {
          if (item.dbId) {
            const groupId = selectedGroups[0].id;
            const endpoint = isKnowledgeGroup(groupId) 
              ? `http://localhost:8000/knowledge-group-messages/${item.dbId}`
              : `http://localhost:8000/group-messages/${item.dbId}`;
              
            return fetch(endpoint, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ display_order: item.order })
            });
          }
          return Promise.resolve();
        });

        await Promise.all(updatePromises);
      } catch (error) {
        console.error('Error updating message order:', error);
      }
    }
  }, [messageSequence, selectedGroups, isKnowledgeGroup]);

  const saveMessagesForDefaultGroup = useCallback(async () => {
    if (selectedGroups[0] && selectedGroups[0].isDefault) {
      const selectedGroupIds = selectedGroups.map(g => g.id);
      
      const messagesWithBase64 = await Promise.all(
        messageSequence.map(async (item) => {
          if (item.imageFile && (item.type === 'image' || item.type === 'video')) {
            const base64 = await fileToBase64(item.imageFile);
            return {
              ...item,
              imageBase64: base64,
              imageFile: null,
              file: null
            };
          }
          return item;
        })
      );
      
      selectedGroupIds.forEach(groupId => {
        const defaultMessageKey = `defaultGroupMessages_${selectedPage}_${groupId}`;
        localStorage.setItem(defaultMessageKey, JSON.stringify(messagesWithBase64));
      });
    }
  }, [selectedGroups, selectedPage, messageSequence]);

  const saveMessages = useCallback(async () => {
    if (messageSequence.length === 0) {
      alert("กรุณาเพิ่มข้อความอย่างน้อย 1 ข้อความ");
      return;
    }

    if (!selectedGroups || selectedGroups.length === 0) {
      alert("กรุณาเลือกกลุ่มลูกค้า");
      return;
    }

    if (selectedGroups[0] && selectedGroups[0].isDefault) {
      await saveMessagesForDefaultGroup();
      alert("บันทึกข้อความสำเร็จ!");
    } else {
      alert("ข้อความถูกบันทึกอัตโนมัติ!");
    }
  }, [messageSequence, selectedGroups, saveMessagesForDefaultGroup]);

  const saveAndProceed = useCallback(async () => {
    if (messageSequence.length === 0) {
      alert("กรุณาเพิ่มข้อความอย่างน้อย 1 ข้อความ");
      return;
    }

    if (!selectedGroups || selectedGroups.length === 0) {
      alert("กรุณาเลือกกลุ่มลูกค้า");
      navigate('/MinerGroup');
      return;
    }

    if (selectedGroups[0] && selectedGroups[0].isDefault) {
      await saveMessagesForDefaultGroup();
    }

    const messageKey = `groupMessages_${selectedPage}`;
    localStorage.setItem(messageKey, JSON.stringify(messageSequence));
    
    if (isEditMode && editingScheduleId) {
      localStorage.setItem("editingScheduleId", editingScheduleId.toString());
      navigate('/GroupSchedule');
    } else if (isEditMode && !editingScheduleId) {
      localStorage.removeItem("selectedCustomerGroups");
      localStorage.removeItem("selectedCustomerGroupsPageId");
      navigate('/MinerGroup');
    } else {
      navigate('/GroupSchedule');
    }
  }, [messageSequence, selectedGroups, selectedPage, isEditMode, editingScheduleId, saveMessagesForDefaultGroup, navigate]);

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen(prev => !prev);
  }, []);

  // Memoized values
  const selectedPageInfo = useMemo(() => 
    pages.find(p => p.id === selectedPage), 
    [pages, selectedPage]
  );
  
  const isSettingDefaultGroup = useMemo(() => 
    selectedGroups.some(g => g.isDefault), 
    [selectedGroups]
  );

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
                  preview: null,
                  imageFile: null
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
              {loading ? '⏳ กำลังบันทึก...' : '➕ เพิ่มในลำดับ'}
            </button>
          </div>

          <div className="config-card">
            <div className="sequence-header-container">
              <h3 className="config-header">📋 ลำดับการส่ง</h3>
              {isSettingDefaultGroup && (
                <button
                  onClick={saveMessages}
                  className="save-messages-btn"
                  disabled={loading}
                >
                  {loading ? '⏳ กำลังบันทึก...' : '💾 บันทึกข้อความ'}
                </button>
              )}
            </div>

            <div className="sequence-hint">
              💡 ลากและวางเพื่อจัดลำดับใหม่
              {!isSettingDefaultGroup && (
                <span style={{ marginLeft: '10px', color: '#48bb78' }}>
                  ✅ ข้อความจะถูกบันทึกอัตโนมัติ
                </span>
              )}
            </div>

            {loading && messageSequence.length === 0 ? (
              <div className="loading-state">
                ⏳ กำลังโหลดข้อความ...
              </div>
            ) : messageSequence.length === 0 ? (
              <div className="empty-state">
                ยังไม่มีข้อความในลำดับ เพิ่มข้อความหรือสื่อเข้ามาได้เลย!
              </div>
            ) : (
              <div className="sequence-list">
                {messageSequence.map((item, index) => (
                  <MessageItem
                    key={item.id}
                    item={item}
                    index={index}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onRemove={removeFromSequence}
                    loading={loading}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="action-buttons_D">
          <Link to="/MinerGroup" className="back-btn">
            ← กลับ
          </Link>
          <button
            onClick={saveAndProceed}
            className="proceed-btn"
            disabled={messageSequence.length === 0 || loading}
          >
            {loading ? '⏳ กำลังบันทึก...' : (
              isEditMode ? 
                (editingScheduleId ? 'ถัดไป: แก้ไขการตั้งเวลา' : 'บันทึกและกลับ') 
                : 'ถัดไป: ตั้งเวลาส่ง'
            )}
            <span className="arrow-icon">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(GroupDefault);