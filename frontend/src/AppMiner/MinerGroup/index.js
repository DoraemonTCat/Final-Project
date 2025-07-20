// MinerGroup/index.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPages } from '../../Features/Tool';
import Sidebar from '../Sidebar';
import { useGroups } from './hooks/useGroups';
import { useSchedules } from './hooks/useSchedules';
import { getPageDbId, getSchedulesForPage, saveSchedulesForPage } from './utils/helpers';

// Import Components
import SearchSection from './components/SearchSection';
import GroupFormModal from './components/GroupFormModal';
import GroupsGrid from './components/GroupsGrid';
import ActionBar from './components/ActionBar';
import EmptyState from './components/EmptyState';
import ScheduleModal from './components/ScheduleModal';

import '../../CSS/MinerGroup.css';

/**
 * MinerGroup Component
 * หน้าหลักสำหรับจัดการกลุ่มลูกค้า
 * 
 * หน้าที่หลัก:
 * 1. แสดงรายการกลุ่มลูกค้า (default groups และ user groups)
 * 2. สร้าง/แก้ไข/ลบกลุ่มลูกค้า
 * 3. เลือกกลุ่มเพื่อตั้งค่าข้อความ
 * 4. แสดงและจัดการ schedules ของแต่ละกลุ่ม
 */
function MinerGroup() {
  const navigate = useNavigate();
  
  // State Management
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddGroupForm, setShowAddGroupForm] = useState(false);

  // Custom Hooks
  const {
    customerGroups,
    selectedGroups,
    loading,
    editingGroupId,
    setEditingGroupId,
    toggleGroupSelection,
    fetchCustomerGroups
  } = useGroups(selectedPage);

  const {
    groupScheduleCounts,
    viewingGroupSchedules,
    viewingGroupName,
    showScheduleModal,
    setShowScheduleModal,
    handleViewSchedules,
    handleDeleteSchedule
  } = useSchedules(customerGroups, selectedPage);

  // Event Handlers
  const handlePageChange = (e) => {
    const pageId = e.target.value;
    setSelectedPage(pageId);
    localStorage.setItem("selectedPage", pageId);
  };

  const handleAddGroup = async (formData) => {
    if (!selectedPage) {
      alert("กรุณาเลือกเพจก่อนสร้างกลุ่ม");
      return;
    }

    try {
      const dbId = await getPageDbId(selectedPage);
      if (!dbId) {
        alert("ไม่พบข้อมูลเพจในระบบ กรุณาเชื่อมต่อเพจใหม่");
        return;
      }

      const requestBody = {
        page_id: dbId,
        type_name: formData.name.trim(),
        rule_description: formData.ruleDescription.trim() || "",
        keywords: formData.keywords.trim().split(',').map(k => k.trim()).filter(k => k),
        examples: formData.examples.trim().split('\n').map(e => e.trim()).filter(e => e)
      };

      const response = await fetch('http://localhost:8000/customer-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.detail || 'Failed to create customer group');
      }
      
      await fetchCustomerGroups(selectedPage);
      setShowAddGroupForm(false);
    } catch (error) {
      console.error('Error creating customer group:', error);
      alert(`เกิดข้อผิดพลาดในการสร้างกลุ่ม: ${error.message}`);
    }
  };

  const handleStartEdit = (group) => {
    setEditingGroupId(group.id);
  };

  const handleSaveEdit = async (editData) => {
    if (!editData.type_name.trim()) {
      alert("กรุณากรอกชื่อกลุ่ม");
      return;
    }

    try {
      if (editingGroupId.toString().startsWith('default_')) {
        const customNamesKey = `defaultGroupCustomNames_${selectedPage}`;
        const customNames = JSON.parse(localStorage.getItem(customNamesKey) || '{}');
        customNames[editingGroupId] = editData.type_name;
        localStorage.setItem(customNamesKey, JSON.stringify(customNames));
        
        await fetchCustomerGroups(selectedPage);
      } else {
        const response = await fetch(`http://localhost:8000/customer-groups/${editingGroupId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type_name: editData.type_name.trim(),
            rule_description: editData.rule_description.trim(),
            keywords: editData.keywords.split(',').map(k => k.trim()).filter(k => k),
            examples: editData.examples.split('\n').map(e => e.trim()).filter(e => e)
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to update customer group');
        }
        
        await fetchCustomerGroups(selectedPage);
      }
      
      setEditingGroupId(null);
    } catch (error) {
      console.error('Error updating customer group:', error);
      alert(`เกิดข้อผิดพลาดในการแก้ไขกลุ่ม: ${error.message}`);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    const group = customerGroups.find(g => g.id === groupId);
    
    if (group && group.isDefault) {
      alert("ไม่สามารถลบกลุ่มพื้นฐานได้");
      return;
    }
    
    const confirmMessage = "คุณต้องการลบกลุ่มนี้หรือไม่?\n\n⚠️ คำเตือน:\n- ข้อมูลกลุ่มจะถูกลบออกจากฐานข้อมูลถาวร\n- ข้อความที่ตั้งค่าไว้สำหรับกลุ่มนี้จะถูกลบ\n- การกระทำนี้ไม่สามารถย้อนกลับได้";
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/customer-groups/${groupId}?hard_delete=true`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete customer group');
      }
      
      const schedules = getSchedulesForPage(selectedPage);
      const updatedSchedules = schedules.filter(schedule => 
        !schedule.groups.includes(groupId)
      );
      saveSchedulesForPage(selectedPage, updatedSchedules);
      
      const messageKey = `groupMessages_${selectedPage}_${groupId}`;
      localStorage.removeItem(messageKey);
      
      await fetchCustomerGroups(selectedPage);
      
    } catch (error) {
      console.error('Error deleting customer group:', error);
      alert(`เกิดข้อผิดพลาดในการลบกลุ่ม: ${error.message}`);
    }
  };

  const handleEditMessages = (groupId) => {
    const schedules = getSchedulesForPage(groupId);
    const group = customerGroups.find(g => g.id === groupId);
    
    localStorage.setItem("selectedCustomerGroups", JSON.stringify([groupId]));
    localStorage.setItem("selectedCustomerGroupsPageId", selectedPage);
    
    if (schedules.length > 1) {
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

  // Effects
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

  useEffect(() => {
    fetchPages()
      .then(setPages)
      .catch(err => console.error("ไม่สามารถโหลดเพจได้:", err));
  }, []);

  // Computed values
  const selectedPageInfo = selectedPage ? pages.find(p => p.id === selectedPage) : null;
  const defaultGroups = customerGroups.filter(g => g.isDefault);
  const userGroups = customerGroups.filter(g => !g.isDefault);
  
  const filteredDefaultGroups = defaultGroups.filter(group =>
    (group.type_name || group.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredUserGroups = userGroups.filter(group =>
    (group.type_name || group.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Render
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
          <SearchSection 
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            disabled={!selectedPage}
          />
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

        <GroupFormModal 
          show={showAddGroupForm}
          onClose={() => setShowAddGroupForm(false)}
          onSave={handleAddGroup}
          selectedPageInfo={selectedPageInfo}
        />

        <div className="groups-container">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>กำลังโหลดข้อมูล...</p>
            </div>
          ) : !selectedPage ? (
            <EmptyState selectedPage={selectedPage} />
          ) : (
            <>
              <GroupsGrid
                defaultGroups={filteredDefaultGroups}
                userGroups={filteredUserGroups}
                selectedGroups={selectedGroups}
                editingGroupId={editingGroupId}
                groupScheduleCounts={groupScheduleCounts}
                onToggleSelect={toggleGroupSelection}
                onStartEdit={handleStartEdit}
                onDelete={handleDeleteGroup}
                onEditMessages={handleEditMessages}
                onViewSchedules={handleViewSchedules}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingGroupId(null)}
              />

              <ActionBar
                selectedCount={selectedGroups.length}
                onProceed={handleProceed}
                disabled={selectedGroups.length === 0}
              />
            </>
          )}
        </div>

        <ScheduleModal 
          show={showScheduleModal}
          schedules={viewingGroupSchedules}
          groupName={viewingGroupName}
          onClose={() => setShowScheduleModal(false)}
          onDeleteSchedule={handleDeleteSchedule}
        />
      </div>
    </div>
  );
}

export default MinerGroup;