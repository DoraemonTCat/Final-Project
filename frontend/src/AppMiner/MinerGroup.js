import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../CSS/MinerGroup.css';
import { fetchPages } from "../Features/Tool";
import Sidebar from "./Sidebar";

// Constants
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

// Sub-components
const GroupFormModal = ({ show, onClose, onSave, selectedPageInfo }) => {
  const [formData, setFormData] = useState({
    name: '',
    ruleDescription: '',
    keywords: '',
    examples: ''
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      alert("กรุณากรอกชื่อกลุ่ม");
      return;
    }
    onSave(formData);
    setFormData({ name: '', ruleDescription: '', keywords: '', examples: '' });
  };

  const handleClose = () => {
    setFormData({ name: '', ruleDescription: '', keywords: '', examples: '' });
    onClose();
  };

  if (!show) return null;

  return (
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
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
            value={formData.ruleDescription}
            onChange={(e) => setFormData({ ...formData, ruleDescription: e.target.value })}
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
            value={formData.keywords}
            onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
            className="group-name-input"
          />
        </div>

        <div style={{ marginBottom: '20px', marginTop: '-24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#4a5568' }}>
            ตัวอย่างการจำแนกประเภท (แต่ละบรรทัดคือ 1 ตัวอย่าง)
          </label>
          <textarea
            placeholder="เช่น ลูกค้าที่พิมพ์ว่า 'สนใจ' หรือ 'ราคาเท่าไหร่' จะถูกจัดเข้ากลุ่มนี้&#10;ลูกค้าที่ถามเกี่ยวกับสินค้าโดยตรง"
            value={formData.examples}
            onChange={(e) => setFormData({ ...formData, examples: e.target.value })}
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
            onClick={handleSubmit}
            className="save-btn"
            disabled={!formData.name.trim()}
          >
            บันทึก
          </button>
          <button onClick={handleClose} className="cancel-btn">
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
};

const EditGroupForm = ({ group, onSave, onCancel }) => {
  const [editData, setEditData] = useState({
    type_name: group.type_name || group.name || '',
    rule_description: group.rule_description || '',
    keywords: Array.isArray(group.keywords) ? group.keywords.join(', ') : group.keywords || '',
    examples: Array.isArray(group.examples) ? group.examples.join('\n') : group.examples || ''
  });

  return (
    <div style={{ marginBottom: '12px', width: '100%' }}>
      {group.isDefault ? (
        // สำหรับ default group - แก้ไขได้เฉพาะชื่อ
        <>
          <input
            type="text"
            value={editData.type_name}
            onChange={(e) => setEditData({ ...editData, type_name: e.target.value })}
            onKeyPress={(e) => e.key === 'Enter' && onSave(editData)}
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
            <button onClick={() => onSave(editData)} className="edit-save-btn">
              บันทึก
            </button>
            <button onClick={onCancel} className="edit-cancel-btn">
              ยกเลิก
            </button>
          </div>
        </>
      ) : (
        // สำหรับ user group - แก้ไขได้ทุกฟิลด์
        <>
          <input
            type="text"
            value={editData.type_name}
            onChange={(e) => setEditData({ ...editData, type_name: e.target.value })}
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
            value={editData.rule_description}
            onChange={(e) => setEditData({ ...editData, rule_description: e.target.value })}
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
            value={editData.keywords}
            onChange={(e) => setEditData({ ...editData, keywords: e.target.value })}
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
            value={editData.examples}
            onChange={(e) => setEditData({ ...editData, examples: e.target.value })}
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
            <button onClick={() => onSave(editData)} className="edit-save-btn">
              บันทึก
            </button>
            <button onClick={onCancel} className="edit-cancel-btn">
              ยกเลิก
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const GroupCard = ({ 
  group, 
  isSelected, 
  isEditing, 
  scheduleCount,
  onToggleSelect, 
  onStartEdit, 
  onDelete, 
  onEditMessages, 
  onViewSchedules,
  onSaveEdit,
  onCancelEdit
}) => {
  const isDefault = group.isDefault;
  
  return (
    <div className={`group-card ${isDefault ? 'default-group' : ''} ${isSelected ? 'selected' : ''}`}>
      {isDefault && <div className="default-badge">พื้นฐาน</div>}
      
      <div className="group-checkbox">
        <input
          type="checkbox"
          id={`group-${group.id}`}
          checked={isSelected}
          onChange={() => onToggleSelect(group.id)}
        />
        <label htmlFor={`group-${group.id}`}></label>
      </div>
      
      <div className="group-content">
        <div className="group-icon">{group.icon || '👥'}</div>
        
        {isEditing ? (
          <EditGroupForm 
            group={group}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
          />
        ) : (
          <>
            <h3 className="group-name">{group.type_name || group.name}</h3>
            
            {group.rule_description && (
              <p className="group-description">{group.rule_description}</p>
            )}
            
            {group.keywords && !isDefault && (
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
        
        {scheduleCount > 0 && (
          <div className="schedule-info" onClick={(e) => {
            e.stopPropagation();
            onViewSchedules(group);
          }}>
            <span>⏰ มีการตั้งเวลา {scheduleCount} รายการ</span>
          </div>
        )}
        
        <div className="group-meta">
          <div className="group-date">
            {isDefault ? 'กลุ่มพื้นฐานของระบบ' : 
             `สร้างเมื่อ ${group.created_at ? new Date(group.created_at).toLocaleDateString('th-TH') : 'ไม่ทราบ'}`}
          </div>
        </div>
        
        <div className="group-actions">
          <button onClick={(e) => {
            e.stopPropagation();
            onStartEdit(group);
          }} className="action-btn edit-name-btn">
            ✏️ {isDefault ? 'แก้ไขชื่อ' : 'แก้ไข'}
          </button>
          <button onClick={(e) => {
            e.stopPropagation();
            onEditMessages(group.id);
          }} className="action-btn edit-message-btn">
            💬 {isDefault ? 'แก้ไขข้อความ' : 'ข้อความ'}
          </button>
        </div>
      </div>
      
      {!isDefault && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(group.id);
          }}
          className="delete-btn"
          title="ลบกลุ่ม"
        >
          🗑️
        </button>
      )}
    </div>
  );
};

const ScheduleModal = ({ show, schedules, groupName, onClose, onDeleteSchedule }) => {
  if (!show) return null;

  const weekDays = [
    { id: 0, name: 'อาทิตย์', short: 'อา' },
    { id: 1, name: 'จันทร์', short: 'จ' },
    { id: 2, name: 'อังคาร', short: 'อ' },
    { id: 3, name: 'พุธ', short: 'พ' },
    { id: 4, name: 'พฤหัสบดี', short: 'พฤ' },
    { id: 5, name: 'ศุกร์', short: 'ศ' },
    { id: 6, name: 'เสาร์', short: 'ส' }
  ];

  return (
    <div className="add-group-modal">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <h3>⏰ ตารางเวลาของกลุ่ม: {groupName}</h3>
        <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '20px' }}>
          {schedules.map((schedule, index) => (
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
                  {schedule?.repeat?.type && schedule.repeat.type !== 'once' && (
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
                  onClick={() => onDeleteSchedule(schedule.id)}
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
            onClick={onClose}
            className="cancel-btn"
            style={{ width: '100%' }}
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper functions
const getPageDbId = async (pageId) => {
  try {
    const response = await fetch('http://localhost:8000/pages/');
    if (!response.ok) throw new Error('Failed to fetch pages');
    
    const pagesData = await response.json();
    const currentPage = pagesData.find(p => p.page_id === pageId || p.id === pageId);
    
    return currentPage ? currentPage.ID : null;
  } catch (error) {
    console.error('Error getting page DB ID:', error);
    return null;
  }
};

const getSchedulesForPage = (pageId) => {
  if (!pageId) return [];
  const key = `miningSchedules_${pageId}`;
  return JSON.parse(localStorage.getItem(key) || '[]');
};

const saveSchedulesForPage = (pageId, schedules) => {
  if (!pageId) return;
  const key = `miningSchedules_${pageId}`;
  localStorage.setItem(key, JSON.stringify(schedules));
};

// Main Component
function MinerGroup() {
  const navigate = useNavigate();
  
  // State Management
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [customerGroups, setCustomerGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [showAddGroupForm, setShowAddGroupForm] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [viewingGroupSchedules, setViewingGroupSchedules] = useState([]);
  const [viewingGroupName, setViewingGroupName] = useState('');
  const [groupScheduleCounts, setGroupScheduleCounts] = useState({});

  // Helper methods
  const getGroupSchedules = async (groupId) => {
    try {
      if (groupId && groupId.toString().startsWith('default_')) {
        const scheduleKey = `defaultGroupSchedules_${selectedPage}_${groupId}`;
        const localSchedules = JSON.parse(localStorage.getItem(scheduleKey) || '[]');
        return localSchedules;
      }
      
      const dbId = await getPageDbId(selectedPage);
      if (!dbId) return [];
      
      const response = await fetch(`http://localhost:8000/message-schedules/group/${dbId}/${groupId}`);
      if (!response.ok) return [];
      
      const schedules = await response.json();
      return schedules;
    } catch (error) {
      console.error('Error fetching group schedules:', error);
      return [];
    }
  };

  const fetchCustomerGroups = async (pageId) => {
    setLoading(true);
    try {
      const pagesResponse = await fetch('http://localhost:8000/pages/');
      if (!pagesResponse.ok) throw new Error('Failed to fetch pages');
      
      const pagesData = await pagesResponse.json();
      const currentPage = pagesData.find(p => p.page_id === pageId || p.id === pageId);
      
      if (!currentPage) {
        console.error('Cannot find page for pageId:', pageId);
        setCustomerGroups(DEFAULT_GROUPS);
        return;
      }

      const response = await fetch(`http://localhost:8000/customer-groups/${currentPage.ID}`);
      if (!response.ok) {
        console.error('Failed to fetch customer groups:', response.status);
        throw new Error('Failed to fetch customer groups');
      }
      
      const data = await response.json();
      
      const formattedGroups = await Promise.all(data.map(async group => {
        const messageCount = await getGroupMessageCount(pageId, group.id);
        
        return {
          id: group.id,
          type_name: group.type_name,
          isDefault: false,
          rule_description: group.rule_description || '',
          keywords: Array.isArray(group.keywords) ? group.keywords.join(', ') : group.keywords || '',
          examples: Array.isArray(group.examples) ? group.examples.join('\n') : group.examples || '',
          created_at: group.created_at,
          customer_count: group.customer_count || 0,
          is_active: group.is_active !== false,
          message_count: messageCount
        };
      }));
      
      const allGroups = [...DEFAULT_GROUPS, ...formattedGroups];
      setCustomerGroups(allGroups);
    } catch (error) {
      console.error('Error fetching customer groups:', error);
      setCustomerGroups(DEFAULT_GROUPS);
    } finally {
      setLoading(false);
    }
  };

  const getGroupMessageCount = async (pageId, groupId) => {
    try {
      const dbId = await getPageDbId(pageId);
      if (!dbId) return 0;
      
      const response = await fetch(`http://localhost:8000/group-messages/${dbId}/${groupId}`);
      if (!response.ok) return 0;
      
      const messages = await response.json();
      return messages.length;
    } catch (error) {
      console.error('Error getting message count:', error);
      return 0;
    }
  };

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
      const pagesResponse = await fetch('http://localhost:8000/pages/');
      if (!pagesResponse.ok) throw new Error('Failed to fetch pages');
      
      const pagesData = await pagesResponse.json();
      const currentPage = pagesData.find(p => p.page_id === selectedPage);
      
      if (!currentPage) {
        alert("ไม่พบข้อมูลเพจในระบบ กรุณาเชื่อมต่อเพจใหม่");
        return;
      }

      const requestBody = {
        page_id: currentPage.ID,
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
        
        setCustomerGroups(prev => prev.map(group => {
          if (group.id === editingGroupId) {
            return { ...group, type_name: editData.type_name };
          }
          return group;
        }));
        
        alert("แก้ไขชื่อกลุ่มพื้นฐานสำเร็จ!");
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
      setSelectedGroups(prev => prev.filter(id => id !== groupId));
      
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

  const handleViewSchedules = async (group) => {
    const schedules = await getGroupSchedules(group.id);
    setViewingGroupSchedules(schedules);
    setViewingGroupName(group.type_name || group.name);
    setShowScheduleModal(true);
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (window.confirm("คุณต้องการลบตารางเวลานี้หรือไม่?")) {
      try {
        const currentGroup = customerGroups.find(g => g.id === viewingGroupSchedules[0]?.groupId);
        
        if (currentGroup && currentGroup.id.toString().startsWith('default_')) {
          const scheduleKey = `defaultGroupSchedules_${selectedPage}_${currentGroup.id}`;
          const localSchedules = JSON.parse(localStorage.getItem(scheduleKey) || '[]');
          const updatedSchedules = localSchedules.filter(s => s.id !== scheduleId);
          localStorage.setItem(scheduleKey, JSON.stringify(updatedSchedules));
          
          setViewingGroupSchedules(updatedSchedules);
          
          if (updatedSchedules.length === 0) {
            setShowScheduleModal(false);
          }
        } else {
          const response = await fetch(`http://localhost:8000/message-schedules/${scheduleId}`, {
            method: 'DELETE'
          });
          
          if (!response.ok) throw new Error('Failed to delete schedule');
          
          const groupId = viewingGroupSchedules[0]?.groupId || selectedGroups[0]?.id;
          const schedules = await getGroupSchedules(groupId);
          setViewingGroupSchedules(schedules);
          
          if (schedules.length === 0) {
            setShowScheduleModal(false);
          }
        }
      } catch (error) {
        console.error('Error deleting schedule:', error);
        alert('เกิดข้อผิดพลาดในการลบตารางเวลา');
      }
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

  const toggleGroupSelection = (groupId) => {
    setSelectedGroups(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      }
      return [...prev, groupId];
    });
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
    const loadScheduleCounts = async () => {
      const counts = {};
      
      for (const group of customerGroups) {
        try {
          const schedules = await getGroupSchedules(group.id);
          counts[group.id] = schedules.length;
        } catch (error) {
          counts[group.id] = 0;
        }
      }
      
      setGroupScheduleCounts(counts);
    };
    
    if (customerGroups.length > 0) {
      loadScheduleCounts();
    }
  }, [customerGroups, selectedPage]);

  useEffect(() => {
    if (selectedPage) {
      fetchCustomerGroups(selectedPage);
      setSelectedGroups([]);
    } else {
      setCustomerGroups([]);
      setSelectedGroups([]);
    }
  }, [selectedPage]);

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
              {filteredDefaultGroups.length > 0 && (
                <div className="default-groups-section">
                  <h3 className="section-title">
                    <span className="section-icon">⭐</span>
                    กลุ่มพื้นฐาน
                  </h3>
                  <div className="groups-grid">
                    {filteredDefaultGroups.map((group) => (
                      <GroupCard
                        key={group.id}
                        group={group}
                        isSelected={selectedGroups.includes(group.id)}
                        isEditing={editingGroupId === group.id}
                        scheduleCount={groupScheduleCounts[group.id] || 0}
                        onToggleSelect={toggleGroupSelection}
                        onStartEdit={handleStartEdit}
                        onDelete={handleDeleteGroup}
                        onEditMessages={handleEditMessages}
                        onViewSchedules={handleViewSchedules}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={() => setEditingGroupId(null)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filteredDefaultGroups.length > 0 && filteredUserGroups.length > 0 && (
                <div className="groups-divider">
                  <div className="divider-line"></div>
                  <span className="divider-text">กลุ่มที่คุณสร้าง</span>
                  <div className="divider-line"></div>
                </div>
              )}

              {filteredUserGroups.length > 0 && (
                <div className="user-groups-section">
                  <div className="groups-grid">
                    {filteredUserGroups.map((group) => (
                      <GroupCard
                        key={group.id}
                        group={group}
                        isSelected={selectedGroups.includes(group.id)}
                        isEditing={editingGroupId === group.id}
                        scheduleCount={groupScheduleCounts[group.id] || 0}
                        onToggleSelect={toggleGroupSelection}
                        onStartEdit={handleStartEdit}
                        onDelete={handleDeleteGroup}
                        onEditMessages={handleEditMessages}
                        onViewSchedules={handleViewSchedules}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={() => setEditingGroupId(null)}
                      />
                    ))}
                  </div>
                </div>
              )}

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