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
  const [isDefaultGroupSetup, setIsDefaultGroupSetup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [pageDbId, setPageDbId] = useState(null);
  const navigate = useNavigate();

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // ฟังก์ชันดึง page ID จาก database
  const getPageDbId = async (pageId) => {
    try {
      const response = await fetch('http://localhost:8000/pages/');
      if (!response.ok) throw new Error('Failed to fetch pages');
      
      const pagesData = await response.json();
      const currentPage = pagesData.find(p => p.page_id === pageId || p.id === pageId);
      
      if (currentPage) {
        return currentPage.ID; // Integer ID จาก database
      }
      return null;
    } catch (error) {
      console.error('Error getting page DB ID:', error);
      return null;
    }
  };

  //  ฟังก์ชันกำหนด icon สำหรับ knowledge types
  const isKnowledgeGroup = (groupId) => {
  return groupId && groupId.toString().startsWith('knowledge_');
};


  // ฟังก์ชันดึงข้อความจาก database
  const loadMessagesFromDatabase = async (pageId, groupId) => {
  try {
    setLoading(true);
    
    // ตรวจสอบว่าเป็น knowledge group หรือไม่
    if (isKnowledgeGroup(groupId)) {
      // ดึง knowledge_id จาก group id
      const knowledgeId = groupId.replace('knowledge_', '');
      
      const response = await fetch(`http://localhost:8000/knowledge-group-messages/${pageId}/${knowledgeId}`);
      if (!response.ok) throw new Error('Failed to load messages');
      
      const messages = await response.json();
      
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        type: msg.message_type,
        content: msg.content,
        order: msg.display_order,
        dbId: msg.id
      }));
      
      setMessageSequence(formattedMessages);
    } else {
      // สำหรับ user groups ใช้วิธีเดิม
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
        dbId: msg.id
      }));
      
      setMessageSequence(formattedMessages);
    }
  } catch (error) {
    console.error('Error loading messages:', error);
    setMessageSequence([]);
  } finally {
    setLoading(false);
  }
};

  // ฟังก์ชันดึงกลุ่มลูกค้าตาม page ID
  const getGroupsForPage = (pageId) => {
    if (!pageId) return [];
    const key = `customerGroups_${pageId}`;
    const userGroups = JSON.parse(localStorage.getItem(key) || '[]');
    
    const DEFAULT_GROUPS = [
      { id: 'default_1', name: 'กลุ่มคนหาย', isDefault: true },
      { id: 'default_2', name: 'กลุ่มคนหายนาน', isDefault: true },
      { id: 'default_3', name: 'กลุ่มคนหายนานมาก', isDefault: true }
    ];
    
    const defaultGroupsWithMessages = DEFAULT_GROUPS.map(group => {
      const customNamesKey = `defaultGroupCustomNames_${pageId}`;
      const customNames = JSON.parse(localStorage.getItem(customNamesKey) || '{}');
      
      return {
        ...group,
        name: customNames[group.id] || group.name
      };
    });
    
    return [...defaultGroupsWithMessages, ...userGroups];
  };

  // แก้ไขใน useEffect ที่โหลด selectedGroups
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
      console.log('Selected group IDs:', selectedGroupIds);
      
      if (savedPage) {
        setSelectedPage(savedPage);
        
        const dbId = await getPageDbId(savedPage);
        setPageDbId(dbId);
        
        if (selectedGroupIds.length > 0) {
          // ✅ ตรวจสอบว่าเป็น knowledge group หรือไม่
          const isKnowledgeGroupSelected = selectedGroupIds.some(id => 
            id && id.toString().startsWith('knowledge_')
          );
          
          if (isKnowledgeGroupSelected) {
            // โหลด knowledge groups
            try {
              const response = await fetch(`http://localhost:8000/page-customer-type-knowledge/${savedPage}`);
              if (response.ok) {
                const knowledgeTypes = await response.json();
                
                // กรองเฉพาะ knowledge groups ที่ถูกเลือก
                const selectedKnowledgeGroups = knowledgeTypes.filter(kt => 
                  selectedGroupIds.includes(kt.id)
                );
                
                // แปลงข้อมูลให้อยู่ในรูปแบบที่ component ใช้
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
                
                // โหลดข้อความจาก database
                if (formattedGroups.length > 0) {
                  const groupId = formattedGroups[0].id;
                  setSelectedGroupId(groupId);
                  await loadMessagesFromDatabase(savedPage, groupId);
                }
              }
            } catch (error) {
              console.error('Error loading knowledge groups:', error);
            }
          } else {
            // สำหรับ user groups - ดึงข้อมูลจาก database
              const response = await fetch(`http://localhost:8000/customer-groups/${dbId}`);
              if (response.ok) {
                const allGroups = await response.json();
                const selectedGroupsData = allGroups.filter(g => 
                  selectedGroupIds.includes(g.id)
                );
                
                // แปลงข้อมูลให้อยู่ในรูปแบบที่ component ใช้
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
                
                // โหลดข้อความจาก database สำหรับกลุ่มแรก
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

  // ฟังก์ชันเพิ่มข้อความและบันทึกลง database ทันที
  const addToSequence = async () => {
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
      console.error('No selected groups found');
      alert("กรุณาเลือกกลุ่มลูกค้า");
      return;
    }
    
    const firstGroup = selectedGroups[0];
    if (!firstGroup) {
      console.error('First group is undefined');
      return;
    }
    
    const groupId = firstGroup.id || selectedGroupId;
    
    console.log('Group ID:', groupId);
    console.log('Is Knowledge Group:', isKnowledgeGroup(groupId));
    console.log('Selected Page:', selectedPage);
    
    // ตรวจสอบว่าเป็น knowledge group หรือไม่
    if (isKnowledgeGroup(groupId) && selectedPage) {
      // ตรวจสอบว่า selectedPage มีค่าและไม่ใช่ undefined
      if (!selectedPage) {
        alert("กรุณาเลือกเพจก่อน");
        return;
      }
      
      const messageData = {
        page_id: selectedPage,  // ส่งเป็น string
        customer_type_custom_id: groupId,  // ส่ง "knowledge_xxx" format
        message_type: currentInput.type,
        content: currentInput.content || currentInput.file?.name || '',
     
        display_order: messageSequence.length
      };

      console.log('Sending knowledge group message:', messageData);

      const response = await fetch('http://localhost:8000/knowledge-group-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      });

      const responseData = await response.json();
      console.log('Response:', response.status, responseData);

      if (!response.ok) {
        console.error('API Error:', responseData);
        throw new Error(responseData.detail || 'Failed to save message');
      }
      
      const newItem = {
        id: responseData.id,
        type: responseData.message_type,
        content: responseData.content,
        order: responseData.display_order,
        dbId: responseData.id
      };

      setMessageSequence(prev => [...prev, newItem]);
      console.log('Knowledge group message added successfully');
      
    } else if (selectedGroupId && firstGroup && !firstGroup.isDefault && pageDbId) {
      // สำหรับ user groups (โค้ดเดิม)
      const messageData = {
        page_id: pageDbId,
        customer_type_custom_id: selectedGroupId,
        message_type: currentInput.type,
        content: currentInput.content || currentInput.file?.name || '',
        display_order: messageSequence.length
      };

      const response = await fetch('http://localhost:8000/group-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error('Failed to save message');
      }
      
      const savedMessage = await response.json();
      
      const newItem = {
        id: savedMessage.id,
        type: savedMessage.message_type,
        content: savedMessage.content,
        order: savedMessage.display_order,
        dbId: savedMessage.id
      };

      setMessageSequence(prev => [...prev, newItem]);
    } else {
      // สำหรับ default group (localStorage)
      const newItem = {
        id: Date.now(),
        type: currentInput.type,
        content: currentInput.content || currentInput.file?.name || '',
        file: currentInput.file,
        preview: currentInput.preview,
        order: messageSequence.length
      };

      setMessageSequence(prev => [...prev, newItem]);
    }

    // Reset input
    if (currentInput.preview) {
      URL.revokeObjectURL(currentInput.preview);
    }
    setCurrentInput({
      type: 'text',
      content: '',
      file: null,
      preview: null
    });

  } catch (error) {
    console.error('Error adding message:', error);
    alert('เกิดข้อผิดพลาดในการเพิ่มข้อความ: ' + error.message);
  } finally {
    setLoading(false);
  }
};

  // ฟังก์ชันลบข้อความจาก database
  const removeFromSequence = async (id) => {
  const itemToDelete = messageSequence.find(item => item.id === id);
  
  if (!itemToDelete) return;

  try {
    // ✅ ตรวจสอบว่ามี selectedGroups หรือไม่
    if (itemToDelete.dbId && selectedGroups && selectedGroups.length > 0) {
      const firstGroup = selectedGroups[0];
      const groupId = firstGroup?.id || selectedGroupId;
      
      if (groupId && isKnowledgeGroup(groupId)) {
        // สำหรับ knowledge groups
        const response = await fetch(`http://localhost:8000/knowledge-group-messages/${itemToDelete.dbId}`, {
          method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete message');
      } else if (firstGroup && !firstGroup.isDefault) {
        // สำหรับ user groups
        const response = await fetch(`http://localhost:8000/group-messages/${itemToDelete.dbId}`, {
          method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete message');
      }
    }

    // Clean up preview if exists
    if (itemToDelete.preview) {
      URL.revokeObjectURL(itemToDelete.preview);
    }

    // Remove from UI
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

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));

    if (dragIndex === dropIndex) return;

    const newSequence = [...messageSequence];
    const draggedItem = newSequence[dragIndex];

    newSequence.splice(dragIndex, 1);
    newSequence.splice(dropIndex, 0, draggedItem);

    // อัพเดท order
    newSequence.forEach((item, index) => {
      item.order = index;
    });

    setMessageSequence(newSequence);

    // อัพเดท order ใน database สำหรับกลุ่มที่ไม่ใช่ default
    if (selectedGroups[0] && !selectedGroups[0].isDefault && pageDbId) {
      try {
        // อัพเดท display_order สำหรับแต่ละข้อความ
        const updatePromises = newSequence.map(item => {
          if (item.dbId) {
            return fetch(`http://localhost:8000/group-messages/${item.dbId}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                display_order: item.order
              })
            });
          }
          return Promise.resolve();
        });

        await Promise.all(updatePromises);
      } catch (error) {
        console.error('Error updating message order:', error);
      }
    }
  };

  // ฟังก์ชันบันทึกข้อความสำหรับ default groups
  const saveMessagesForDefaultGroup = () => {
    if (selectedGroups[0] && selectedGroups[0].isDefault) {
      const selectedGroupIds = selectedGroups.map(g => g.id);
      
      selectedGroupIds.forEach(groupId => {
        const defaultMessageKey = `defaultGroupMessages_${selectedPage}_${groupId}`;
        localStorage.setItem(defaultMessageKey, JSON.stringify(messageSequence));
      });
    }
  };

  const saveMessages = () => {
    if (messageSequence.length === 0) {
      alert("กรุณาเพิ่มข้อความอย่างน้อย 1 ข้อความ");
      return;
    }

    // ตรวจสอบว่ามี selectedGroups หรือไม่
    if (!selectedGroups || selectedGroups.length === 0) {
      alert("กรุณาเลือกกลุ่มลูกค้า");
      return;
    }

    // สำหรับ default groups ใช้ localStorage
    if (selectedGroups[0] && selectedGroups[0].isDefault) {
      saveMessagesForDefaultGroup();
      console.log("บันทึกข้อความสำเร็จ!");
    } else {
      // สำหรับ user groups ข้อความถูกบันทึกใน database แล้วตอนเพิ่ม
      alert("ข้อความถูกบันทึกอัตโนมัติ!");
    }
  };

  const saveAndProceed = () => {
    if (messageSequence.length === 0) {
      alert("กรุณาเพิ่มข้อความอย่างน้อย 1 ข้อความ");
      return;
    }

    // ตรวจสอบว่ามี selectedGroups หรือไม่
    if (!selectedGroups || selectedGroups.length === 0) {
      alert("กรุณาเลือกกลุ่มลูกค้า");
      navigate('/MinerGroup');
      return;
    }

    // สำหรับ default groups บันทึกใน localStorage
    if (selectedGroups[0] && selectedGroups[0].isDefault) {
      saveMessagesForDefaultGroup();
    }

    // บันทึกข้อความสำหรับ schedule
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
                >
                  💾 บันทึกข้อความ
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

        <div className="action-buttons_D">
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

