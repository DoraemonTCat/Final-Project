import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPages } from '../../Features/Tool';
import Sidebar from '../Sidebar';
import { useGroups } from './hooks/useGroups';
import { useSchedules } from './hooks/useSchedules';
import { getPageDbId, getSchedulesForPage, saveSchedulesForPage } from './utils/helpers';
import '../../CSS/MinerGroup.css';

// Lazy load components - ย้ายมาอยู่หลัง imports ทั้งหมด
const SearchSection = lazy(() => import('./components/SearchSection'));
const GroupFormModal = lazy(() => import('./components/GroupFormModal'));
const GroupsGrid = lazy(() => import('./components/GroupsGrid'));
const ActionBar = lazy(() => import('./components/ActionBar'));
const EmptyState = lazy(() => import('./components/EmptyState'));
const ScheduleModal = lazy(() => import('./components/ScheduleModal'));
const GroupDetailModal = lazy(() => import('./components/GroupDetailModal'));
const KnowledgeSettingsModal = lazy(() => import('./components/KnowledgeSettingsModal'));
const EditGroupModal = lazy(() => import('./components/EditGroupModal'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="loading-state">
    <div className="loading-spinner"></div>
  </div>
);

function MinerGroup() {
  const navigate = useNavigate();
  
  // State Management
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddGroupForm, setShowAddGroupForm] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedGroupDetail, setSelectedGroupDetail] = useState(null);
  const [showKnowledgeSettings, setShowKnowledgeSettings] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);

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

  // Memoized callbacks
  const handlePageChange = useCallback((e) => {
    const pageId = e.target.value;
    setSelectedPage(pageId);
    localStorage.setItem("selectedPage", pageId);
  }, []);

  const handleAddGroup = useCallback(async (formData) => {
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
  }, [selectedPage, fetchCustomerGroups]);

  const handleStartEdit = useCallback((group) => {
    setEditingGroup(group);
    setShowEditModal(true);
  }, []);

  const handleSaveEdit = useCallback(async (editData) => {
    if (!editData.type_name.trim()) {
      alert("กรุณากรอกชื่อกลุ่ม");
      return;
    }

    try {
      if (editingGroup && editingGroup.isKnowledge) {
        const knowledgeId = editingGroup.id.toString().replace('knowledge_', '');
        
        const response = await fetch(`http://localhost:8000/customer-type-knowledge/${knowledgeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type_name: editData.type_name.trim(),
            rule_description: editData.rule_description?.trim() || '',
            keywords: editData.keywords || '',
            examples: editData.examples || ''
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to update knowledge type');
        }
        
        const result = await response.json();
        alert(result.message || 'อัพเดทข้อมูลสำเร็จ');
        
      } else if (editingGroup && editingGroup.id.toString().startsWith('default_')) {
        const customNamesKey = `defaultGroupCustomNames_${selectedPage}`;
        const customNames = JSON.parse(localStorage.getItem(customNamesKey) || '{}');
        customNames[editingGroup.id] = editData.type_name;
        localStorage.setItem(customNamesKey, JSON.stringify(customNames));
        
      } else {
        const response = await fetch(`http://localhost:8000/customer-groups/${editingGroup.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type_name: editData.type_name.trim(),
            rule_description: editData.rule_description?.trim() || '',
            keywords: editData.keywords.split(',').map(k => k.trim()).filter(k => k),
            examples: editData.examples.split('\n').map(e => e.trim()).filter(e => e)
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to update customer group');
        }
      }
      
      setShowEditModal(false);
      setEditingGroup(null);
      await fetchCustomerGroups(selectedPage);
      
    } catch (error) {
      console.error('Error updating group:', error);
      alert(`เกิดข้อผิดพลาดในการแก้ไข: ${error.message}`);
    }
  }, [editingGroup, selectedPage, fetchCustomerGroups]);

  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditingGroup(null);
  }, []);

  const handleDeleteGroup = useCallback(async (groupId) => {
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
  }, [customerGroups, selectedPage, fetchCustomerGroups]);

  const handleEditMessages = useCallback((groupId) => {
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
  }, [customerGroups, selectedPage, navigate]);

  const handleProceed = useCallback(() => {
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
  }, [selectedPage, selectedGroups, navigate]);

  const handleViewDetails = useCallback((group) => {
    setSelectedGroupDetail(group);
    setShowDetailModal(true);
  }, []);

  // Effects
  useEffect(() => {
    const handlePageChangeEvent = (event) => {
      const pageId = event.detail.pageId;
      setSelectedPage(pageId);
    };

    window.addEventListener('pageChanged', handlePageChangeEvent);
    
    const savedPage = localStorage.getItem("selectedPage");
    if (savedPage) {
      setSelectedPage(savedPage);
    }

    return () => {
      window.removeEventListener('pageChanged', handlePageChangeEvent);
    };
  }, []);

  useEffect(() => {
    fetchPages()
      .then(setPages)
      .catch(err => console.error("ไม่สามารถโหลดเพจได้:", err));
  }, []);

  // Memoized values
  const selectedPageInfo = useMemo(() => 
    selectedPage ? pages.find(p => p.id === selectedPage) : null,
    [selectedPage, pages]
  );

  const defaultGroups = useMemo(() => 
    customerGroups.filter(g => g.isDefault),
    [customerGroups]
  );

  const knowledgeGroups = useMemo(() => 
    customerGroups.filter(g => g.isKnowledge),
    [customerGroups]
  );

  const userGroups = useMemo(() => 
    customerGroups.filter(g => !g.isKnowledge && !g.isDefault),
    [customerGroups]
  );

  const filteredKnowledgeGroups = useMemo(() => 
    knowledgeGroups.filter(group =>
      (group.type_name || group.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [knowledgeGroups, searchTerm]
  );

  const filteredDefaultGroups = useMemo(() => 
    defaultGroups.filter(group =>
      (group.type_name || group.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [defaultGroups, searchTerm]
  );

  const filteredUserGroups = useMemo(() => 
    userGroups.filter(group =>
      (group.type_name || group.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [userGroups, searchTerm]
  );

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
          <Suspense fallback={<LoadingFallback />}>
            <SearchSection 
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              disabled={!selectedPage}
            />
          </Suspense>
          <div className="control-buttons">
            {selectedPage && (
              <button 
                onClick={() => setShowKnowledgeSettings(true)}
                className="knowledge-settings-btn"
                title="ตั้งค่ากลุ่มพื้นฐาน"
              >
                <span className="btn-icon">⚙️</span>
                กลุ่มพื้นฐาน
              </button>
            )}
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
        </div>

        <Suspense fallback={<LoadingFallback />}>
          {showAddGroupForm && (
            <GroupFormModal 
              show={showAddGroupForm}
              onClose={() => setShowAddGroupForm(false)}
              onSave={handleAddGroup}
              selectedPageInfo={selectedPageInfo}
            />
          )}
        </Suspense>

        <div className="groups-container">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
            </div>
          ) : !selectedPage ? (
            <Suspense fallback={<LoadingFallback />}>
              <EmptyState selectedPage={selectedPage} />
            </Suspense>
          ) : (
            <>
              <Suspense fallback={<LoadingFallback />}>
                <GroupsGrid
                  defaultGroups={filteredKnowledgeGroups}
                  userGroups={filteredUserGroups}
                  selectedGroups={selectedGroups}
                  editingGroupId={null}
                  groupScheduleCounts={groupScheduleCounts}
                  onToggleSelect={toggleGroupSelection}
                  onStartEdit={handleStartEdit}
                  onDelete={handleDeleteGroup}
                  onEditMessages={handleEditMessages}
                  onViewSchedules={handleViewSchedules}
                  onSaveEdit={() => {}}
                  onCancelEdit={() => {}}
                  onViewDetails={handleViewDetails}
                />
              </Suspense>

              <Suspense fallback={<LoadingFallback />}>
                {showEditModal && (
                  <EditGroupModal 
                    show={showEditModal}
                    group={editingGroup}
                    onSave={handleSaveEdit}
                    onClose={handleCloseEditModal}
                  />
                )}
              </Suspense>

              <Suspense fallback={<LoadingFallback />}>
                <ActionBar
                  selectedCount={selectedGroups.length}
                  onProceed={handleProceed}
                  disabled={selectedGroups.length === 0}
                />
              </Suspense>

              <Suspense fallback={<LoadingFallback />}>
                {showKnowledgeSettings && (
                  <KnowledgeSettingsModal 
                    show={showKnowledgeSettings}
                    onClose={() => setShowKnowledgeSettings(false)}
                    pageId={selectedPage}
                    knowledgeGroups={customerGroups.filter(g => g.isKnowledge)}
                    onToggle={() => fetchCustomerGroups(selectedPage)}
                  />
                )}
              </Suspense>
            </>
          )}
        </div>

        <Suspense fallback={<LoadingFallback />}>
          {showScheduleModal && (
            <ScheduleModal 
              show={showScheduleModal}
              schedules={viewingGroupSchedules}
              groupName={viewingGroupName}
              onClose={() => setShowScheduleModal(false)}
              onDeleteSchedule={handleDeleteSchedule}
            />
          )}
        </Suspense>

        <Suspense fallback={<LoadingFallback />}>
          {showDetailModal && (
            <GroupDetailModal 
              show={showDetailModal}
              group={selectedGroupDetail}
              onClose={() => setShowDetailModal(false)}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}

export default memo(MinerGroup);