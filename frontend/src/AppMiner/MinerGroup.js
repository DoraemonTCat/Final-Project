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
  const [newGroupRuleDescription, setNewGroupRuleDescription] = useState("");
  const [newGroupKeywords, setNewGroupKeywords] = useState("");
  const [newGroupExamples, setNewGroupExamples] = useState("");
  const [showAddGroupForm, setShowAddGroupForm] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupData, setEditingGroupData] = useState({
    type_name: "",
    rule_description: "",
    keywords: "",
    examples: ""
  });
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [viewingGroupSchedules, setViewingGroupSchedules] = useState([]);
  const [viewingGroupName, setViewingGroupName] = useState('');
  const navigate = useNavigate();

  // 🔥 กลุ่ม Default ที่มีมาแต่แรก
  const DEFAULT_GROUPS = [
    {
      id: 'default_1',
      type_name: 'กลุ่มคนหาย',
      isDefault: true,
      rule_description: 'สำหรับลูกค้าที่หายไปไม่นาน',
      icon: '🕐',
      created_at: new Date('2024-01-01').toISOString()
    },
    {
      id: 'default_2', 
      type_name: 'กลุ่มคนหายนาน',
      isDefault: true,
      rule_description: 'สำหรับลูกค้าที่หายไปนาน',
      icon: '⏰',
      created_at: new Date('2024-01-01').toISOString()
    },
    {
      id: 'default_3',
      type_name: 'กลุ่มคนหายนานมาก',
      isDefault: true,
      rule_description: 'สำหรับลูกค้าที่หายไปนานมาก',
      icon: '📅',
      created_at: new Date('2024-01-01').toISOString()
    }
  ];

  // ฟังก์ชันดึงกลุ่มลูกค้าจาก Database
  const fetchCustomerGroups = async (pageId) => {
    setLoading(true);
    try {
      // ดึงข้อมูล pages ก่อนเพื่อหา ID ที่ถูกต้อง
      const pagesResponse = await fetch('http://localhost:8000/pages/');
      if (!pagesResponse.ok) throw new Error('Failed to fetch pages');
      
      const pagesData = await pagesResponse.json();
      console.log('Pages data:', pagesData);
      
      // หา page ที่ตรงกับ pageId (string page_id จาก Facebook)
      const currentPage = pagesData.find(p => p.page_id === pageId || p.id === pageId);
      
      if (!currentPage) {
        console.error('Cannot find page for pageId:', pageId);
        console.error('Available pages:', pagesData);
        setCustomerGroups(DEFAULT_GROUPS);
        return;
      }

      console.log('Found page:', currentPage);
      console.log('Using page ID (integer):', currentPage.ID);

      // ใช้ ID (integer) ในการดึงข้อมูล customer groups
      const response = await fetch(`http://localhost:8000/customer-groups/${currentPage.ID}`);
      if (!response.ok) {
        console.error('Failed to fetch customer groups:', response.status);
        throw new Error('Failed to fetch customer groups');
      }
      
      const data = await response.json();
      console.log('Customer groups from database:', data);
      
      // แปลงข้อมูลให้มีโครงสร้างเดียวกับ DEFAULT_GROUPS
      const formattedGroups = data.map(group => ({
        id: group.id,
        type_name: group.type_name,
        isDefault: false,
        rule_description: group.rule_description || '',
        keywords: Array.isArray(group.keywords) ? group.keywords.join(', ') : group.keywords || '',
        examples: Array.isArray(group.examples) ? group.examples.join('\n') : group.examples || '',
        created_at: group.created_at,
        customer_count: group.customer_count || 0,
        is_active: group.is_active !== false // default true if not specified
      }));
      
      // รวมกลุ่ม default กับกลุ่มจาก database
      const allGroups = [...DEFAULT_GROUPS, ...formattedGroups];
      console.log('All groups (default + user):', allGroups);
      
      setCustomerGroups(allGroups);
    } catch (error) {
      console.error('Error fetching customer groups:', error);
      // ถ้าดึงไม่ได้ให้แสดงแค่ default groups
      setCustomerGroups(DEFAULT_GROUPS);
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันดึงตารางการส่งตาม page ID
  const getSchedulesForPage = (pageId) => {
    if (!pageId) return [];
    const key = `miningSchedules_${pageId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  };

  // ฟังก์ชันบันทึกตารางการส่งตาม page ID
  const saveSchedulesForPage = (pageId, schedules) => {
    if (!pageId) return;
    const key = `miningSchedules_${pageId}`;
    localStorage.setItem(key, JSON.stringify(schedules));
  };

  // ฟังก์ชันตรวจสอบว่ากลุ่มมีการตั้งเวลาไว้หรือไม่
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

  // โหลดกลุ่มลูกค้าเมื่อเปลี่ยนเพจ
  useEffect(() => {
    if (selectedPage) {
      fetchCustomerGroups(selectedPage);
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

  // ฟังก์ชันเพิ่มกลุ่มลูกค้าไปยัง Database
  const addCustomerGroup = async () => {
    if (!newGroupName.trim() || !selectedPage) {
      if (!selectedPage) alert("กรุณาเลือกเพจก่อนสร้างกลุ่ม");
      else alert("กรุณากรอกชื่อกลุ่ม");
      return;
    }

    try {
      // ดึงข้อมูล pages จาก backend เพื่อหา page_id ที่ถูกต้อง
      const pagesResponse = await fetch('http://localhost:8000/pages/', {
        method: 'GET'
      });
      
      if (!pagesResponse.ok) {
        throw new Error('Failed to fetch pages');
      }
      
      const pagesData = await pagesResponse.json();
      console.log('Pages data:', pagesData);
      
      // หา page ที่ตรงกับ selectedPage (ซึ่งเป็น string page_id)
      const currentPage = pagesData.find(p => p.page_id === selectedPage);
      
      if (!currentPage) {
        console.error('Cannot find page with page_id:', selectedPage);
        console.error('Available pages:', pagesData);
        alert("ไม่พบข้อมูลเพจในระบบ กรุณาเชื่อมต่อเพจใหม่");
        return;
      }

      console.log('Found page:', currentPage);
      console.log('Using page ID (integer):', currentPage.ID);

      const requestBody = {
        page_id: currentPage.ID, // ใช้ ID (integer) จาก database
        type_name: newGroupName.trim(),
        rule_description: newGroupRuleDescription.trim() || "",
        keywords: newGroupKeywords.trim().split(',').map(k => k.trim()).filter(k => k),
        examples: newGroupExamples.trim().split('\n').map(e => e.trim()).filter(e => e)
      };

      console.log('Request body:', requestBody);

      const response = await fetch('http://localhost:8000/customer-groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      console.log('Response:', response.status, responseData);

      if (!response.ok) {
        console.error('Failed to create customer group:', responseData);
        throw new Error(responseData.detail || 'Failed to create customer group');
      }
      
      // Refresh กลุ่มลูกค้า
      await fetchCustomerGroups(selectedPage);
      
      // Reset form
      setNewGroupName("");
      setNewGroupRuleDescription("");
      setNewGroupKeywords("");
      setNewGroupExamples("");
      setShowAddGroupForm(false);
      
      alert("สร้างกลุ่มลูกค้าสำเร็จ!");
    } catch (error) {
      console.error('Error creating customer group:', error);
      alert(`เกิดข้อผิดพลาดในการสร้างกลุ่ม: ${error.message}`);
    }
  };

  /// ฟังก์ชันลบกลุ่มลูกค้า
  const removeCustomerGroup = async (groupId) => {
    const group = customerGroups.find(g => g.id === groupId);
    
    if (group && group.isDefault) {
      alert("ไม่สามารถลบกลุ่มพื้นฐานได้");
      return;
    }
    
    if (!window.confirm("คุณต้องการลบกลุ่มนี้หรือไม่?")) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/customer-groups/${groupId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete customer group');
      }
      
      // Refresh กลุ่มลูกค้า
      await fetchCustomerGroups(selectedPage);
      
      // ลบออกจากการเลือก
      setSelectedGroups(prev => prev.filter(id => id !== groupId));
      
    
    } catch (error) {
      console.error('Error deleting customer group:', error);
      alert(`เกิดข้อผิดพลาดในการลบกลุ่ม: ${error.message}`);
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

  // ฟังก์ชันเริ่มการแก้ไขกลุ่ม
  
  const startEditGroup = (group) => {
    setEditingGroupId(group.id);
    setEditingGroupData({
      type_name: group.type_name || group.name || '', // แก้ไขให้ดึงชื่อที่ถูกต้อง
      rule_description: group.rule_description || '',
      keywords: Array.isArray(group.keywords) ? group.keywords.join(', ') : group.keywords || '',
      examples: Array.isArray(group.examples) ? group.examples.join('\n') : group.examples || ''
    });
  };

  // ฟังก์ชันบันทึกการแก้ไขกลุ่ม
  const saveEditGroup = async () => {
    if (!editingGroupData.type_name.trim()) {
      alert("กรุณากรอกชื่อกลุ่ม");
      return;
    }

    try {
      // ถ้าเป็น default group ให้บันทึกใน localStorage
      if (editingGroupId.startsWith('default_')) {
        const customNamesKey = `defaultGroupCustomNames_${selectedPage}`;
        const customNames = JSON.parse(localStorage.getItem(customNamesKey) || '{}');
        customNames[editingGroupId] = editingGroupData.type_name;
        localStorage.setItem(customNamesKey, JSON.stringify(customNames));
        
        // อัพเดทใน state
        setCustomerGroups(prev => prev.map(group => {
          if (group.id === editingGroupId) {
            return { ...group, type_name: editingGroupData.type_name };
          }
          return group;
        }));
        
        alert("แก้ไขชื่อกลุ่มพื้นฐานสำเร็จ!");
      } else {
        // ถ้าเป็นกลุ่มจาก database
        const response = await fetch(`http://localhost:8000/customer-groups/${editingGroupId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type_name: editingGroupData.type_name.trim(),
            rule_description: editingGroupData.rule_description.trim(),
            keywords: editingGroupData.keywords.split(',').map(k => k.trim()).filter(k => k),
            examples: editingGroupData.examples.trim() ? editingGroupData.examples.trim().split('\n').map(e => e.trim()).filter(e => e) : []
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to update customer group');
        }
        
        // Refresh กลุ่มลูกค้า
        await fetchCustomerGroups(selectedPage);
        
        alert("แก้ไขกลุ่มสำเร็จ!");
      }
      
      setEditingGroupId(null);
      setEditingGroupData({
        type_name: "",
        rule_description: "",
        keywords: "",
        examples: ""
      });
    } catch (error) {
      console.error('Error updating customer group:', error);
      alert(`เกิดข้อผิดพลาดในการแก้ไขกลุ่ม: ${error.message}`);
    }
  };

  // ฟังก์ชันยกเลิกการแก้ไข
  const cancelEdit = () => {
    setEditingGroupId(null);
    setEditingGroupData({
      type_name: "",
      rule_description: "",
      keywords: "",
      examples: ""
    });
  };

  // ฟังก์ชันแก้ไขข้อความในกลุ่ม
  const editGroupMessages = (groupId) => {
    const schedules = getGroupSchedules(groupId);
    const group = customerGroups.find(g => g.id === groupId);
    
    localStorage.setItem("selectedCustomerGroups", JSON.stringify([groupId]));
    localStorage.setItem("selectedCustomerGroupsPageId", selectedPage);
    
    if (schedules.length > 1) {
      // ถ้ามีหลาย schedule ให้เลือก
      alert("กลุ่มนี้มีการตั้งเวลาหลายรายการ กรุณาแก้ไขผ่านหน้า Dashboard");
      return;
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

  // ฟังก์ชันแสดงตารางเวลาของกลุ่ม
  const viewGroupSchedules = (group) => {
    const schedules = getGroupSchedules(group.id);
    setViewingGroupSchedules(schedules);
    setViewingGroupName(group.type_name || group.name);
    setShowScheduleModal(true);
  };

  // ฟังก์ชันลบตารางเวลา
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

  // แยกกลุ่ม default และ user groups สำหรับการแสดงผล
  const defaultGroups = customerGroups.filter(g => g.isDefault);
  const userGroups = customerGroups.filter(g => !g.isDefault);

  // Filter สำหรับการค้นหา
  const filteredDefaultGroups = defaultGroups.filter(group =>
    (group.type_name || group.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredUserGroups = userGroups.filter(group =>
    (group.type_name || group.name || '').toLowerCase().includes(searchTerm.toLowerCase())
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
            <div className="modal-content" style={{ maxWidth: '600px' }}>
              <h3>สร้างกลุ่มลูกค้าใหม่{selectedPageInfo && ` - ${selectedPageInfo.name}`}</h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#4a5568' }}>
                  ชื่อกลุ่มลูกค้า <span style={{ color: '#e53e3e' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น ลูกค้าสนใจสินค้า"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="group-name-input"
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '1px', marginTop: '-24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#4a5568' }}>
                  คำอธิบายกฎการจัดกลุ่ม
                </label>
                <textarea
                  placeholder="อธิบายกฎที่ใช้ในการจำแนกลูกค้ากลุ่มนี้..."
                  value={newGroupRuleDescription}
                  onChange={(e) => setNewGroupRuleDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#4a5568' }}>
                  คีย์เวิร์ดสำหรับจัดกลุ่มอัตโนมัติ
                </label>
                <input
                  type="text"
                  placeholder="เช่น สวัสดี, สนใจ, ราคา เมื่อลูกค้าพิมพ์คำเหล่านี้ ระบบจะจัดกลุ่มอัตโนมัติ"
                  value={newGroupKeywords}
                  onChange={(e) => setNewGroupKeywords(e.target.value)}
                  className="group-name-input"
                />
                
              </div>

              <div style={{ marginBottom: '20px' ,marginTop: '-24px'}}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#4a5568' }}>
                  ตัวอย่างการจำแนกประเภท (แต่ละบรรทัดคือ 1 ตัวอย่าง)
                </label>
                <textarea
                  placeholder="เช่น&#10;ลูกค้าที่พิมพ์ว่า 'สนใจ' หรือ 'ราคาเท่าไหร่' จะถูกจัดเข้ากลุ่มนี้&#10;ลูกค้าที่ถามเกี่ยวกับสินค้าโดยตรง"
                  value={newGroupExamples}
                  onChange={(e) => setNewGroupExamples(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                />
              </div>

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
                    setNewGroupRuleDescription("");
                    setNewGroupKeywords("");
                    setNewGroupExamples("");
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
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>กำลังโหลดข้อมูล...</p>
            </div>
          ) : !selectedPage ? (
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
              {/* แสดงกลุ่ม Default */}
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
                            <div style={{ marginBottom: '12px', width: '100%' }}>
                              <input
                                type="text"
                                value={editingGroupData.type_name}
                                onChange={(e) => setEditingGroupData({...editingGroupData, type_name: e.target.value})}
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
                            <h3 className="group-name">{group.type_name || group.name}</h3>
                          )}
                          
                          {group.rule_description && (
                            <p className="group-description">{group.rule_description}</p>
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

              {/* เส้นแบ่งระหว่างกลุ่ม */}
              {filteredDefaultGroups.length > 0 && filteredUserGroups.length > 0 && (
                <div className="groups-divider">
                  <div className="divider-line"></div>
                  <span className="divider-text">กลุ่มที่คุณสร้าง</span>
                  <div className="divider-line"></div>
                </div>
              )}

              {/* แสดงกลุ่มที่ User สร้าง */}
              {filteredUserGroups.length > 0 && (
                <div className="user-groups-section">
                  <div className="groups-grid">
                    {filteredUserGroups.map((group) => {
                      console.log('Rendering user group:', group);
                      return (
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
                              <div style={{ marginBottom: '12px', width: '100%' }}>
                                <input
                                  type="text"
                                  value={editingGroupData.type_name}
                                  onChange={(e) => setEditingGroupData({...editingGroupData, type_name: e.target.value})}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    fontSize: '18px',
                                    fontWeight: '600',
                                    textAlign: 'center',
                                    border: '2px solid #667eea',
                                    borderRadius: '6px',
                                    outline: 'none',
                                    marginBottom: '8px'
                                  }}
                                  placeholder="ชื่อกลุ่ม"
                                />
                                
                                <textarea
                                  value={editingGroupData.rule_description}
                                  onChange={(e) => setEditingGroupData({...editingGroupData, rule_description: e.target.value})}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    fontSize: '14px',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '6px',
                                    outline: 'none',
                                    minHeight: '60px',
                                    marginBottom: '8px',
                                    resize: 'vertical'
                                  }}
                                  placeholder="คำอธิบายกฎ"
                                />
                                
                                <input
                                  type="text"
                                  value={editingGroupData.keywords}
                                  onChange={(e) => setEditingGroupData({...editingGroupData, keywords: e.target.value})}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    fontSize: '14px',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '6px',
                                    outline: 'none',
                                    marginBottom: '8px'
                                  }}
                                  placeholder="Keywords (คั่นด้วย ,)"
                                />
                                
                                <textarea
                                  value={editingGroupData.examples}
                                  onChange={(e) => setEditingGroupData({...editingGroupData, examples: e.target.value})}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    fontSize: '14px',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '6px',
                                    outline: 'none',
                                    minHeight: '80px',
                                    marginBottom: '8px',
                                    resize: 'vertical'
                                  }}
                                  placeholder="ตัวอย่าง (แต่ละบรรทัดคือ 1 ตัวอย่าง)"
                                />
                                
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                  <button onClick={saveEditGroup} className="edit-save-btn">
                                    บันทึก
                                  </button>
                                  <button onClick={cancelEdit} className="edit-cancel-btn">
                                    ยกเลิก
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <h3 className="group-name">{group.type_name || group.name || 'ไม่มีชื่อ'}</h3>
                                {group.rule_description && (
                                  <p className="group-description">{group.rule_description}</p>
                                )}
                                {group.keywords && (
                                  <div className="group-keywords">
                                    {(() => {
                                      const keywordsList = typeof group.keywords === 'string' 
                                        ? group.keywords.split(',').map(k => k.trim()).filter(k => k)
                                        : Array.isArray(group.keywords) 
                                        ? group.keywords 
                                        : [];
                                      
                                      return keywordsList.slice(0, 3).map((keyword, idx) => (
                                        <span key={idx} className="keyword-tag">{keyword}</span>
                                      )).concat(
                                        keywordsList.length > 3 
                                          ? [<span key="more" className="more-keywords">+{keywordsList.length - 3}</span>]
                                          : []
                                      );
                                    })()}
                                  </div>
                                )}
                              </>
                            )}
                            
                            {getGroupSchedules(group.id).length > 0 && (
                              <div className="schedule-info" onClick={(e) => {
                                e.stopPropagation();
                                viewGroupSchedules(group);
                              }}>
                                <span>⏰ มีการตั้งเวลา {getGroupSchedules(group.id).length} รายการ</span>
                              </div>
                            )}
                            
                            <div className="group-meta">
                              <div className="group-date">
                                สร้างเมื่อ {group.created_at ? new Date(group.created_at).toLocaleDateString('th-TH') : 'ไม่ทราบ'}
                              </div>
                             
                            </div>
                            
                            <div className="group-actions">
                              <button onClick={(e) => {
                                e.stopPropagation();
                                startEditGroup(group);
                              }} className="action-btn edit-name-btn">
                                ✏️ แก้ไข
                              </button>
                              <button onClick={(e) => {
                                e.stopPropagation();
                                editGroupMessages(group.id);
                              }} className="action-btn edit-message-btn">
                                💬 ข้อความ
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
                      );
                    })}
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
                      </div>
                      <button
                        onClick={() => deleteSchedule(schedule.id)}
                        style={{
                          background: '#fee',
                          color: '#e53e3e',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ ลบ
                      </button>
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
      </div>
    </div>
  );
}

export default SetMiner;