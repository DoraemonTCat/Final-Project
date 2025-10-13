import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchPages } from "../Features/Tool";
import Sidebar from "./Sidebar";
import '../CSS/GroupSchedule.css';

// Memoized WeekDay Component
const WeekDaySelector = memo(({ repeatDays, onToggleDay }) => {
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
    <div className="weekdays-grid">
      {weekDays.map(day => (
        <button
          key={day.id}
          type="button"
          className={`weekday-btn ${repeatDays.includes(day.id) ? 'weekday-btn-active' : ''}`}
          onClick={() => onToggleDay(day.id)}
        >
          {day.short}
        </button>
      ))}
    </div>
  );
});

function GroupSchedule() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [scheduleType, setScheduleType] = useState('immediate');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [inactivityPeriod, setInactivityPeriod] = useState('1');
  const [inactivityUnit, setInactivityUnit] = useState('days');
  const [repeatType, setRepeatType] = useState('once');
  const [repeatCount, setRepeatCount] = useState(1);
  const [repeatDays, setRepeatDays] = useState([]);
  const [endDate, setEndDate] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const navigate = useNavigate();
  const [messageIds, setMessageIds] = useState([]);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Cache for page DB IDs
  const pageDbIdCache = useMemo(() => new Map(), []);

  const SCHEDULE_TYPE_MAP = {
    'immediate': 'immediate',
    'scheduled': 'scheduled',
    'user-inactive': 'after_inactive'
  };

  const toggleWeekDay = useCallback((dayId) => {
    setRepeatDays(prev => {
      if (prev.includes(dayId)) {
        return prev.filter(id => id !== dayId);
      }
      return [...prev, dayId];
    });
  }, []);

  const handlePageChange = useCallback((event) => {
    const pageId = event.detail.pageId;
    setSelectedPage(pageId);
  }, []);

  useEffect(() => {
    window.addEventListener('pageChanged', handlePageChange);
    
    const savedPage = localStorage.getItem("selectedPage");
    if (savedPage) {
      setSelectedPage(savedPage);
    }

    return () => {
      window.removeEventListener('pageChanged', handlePageChange);
    };
  }, [handlePageChange]);

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen(prev => !prev);
  }, []);

  const isKnowledgeGroup = useCallback((groupId) => {
    return groupId && groupId.toString().startsWith('knowledge_');
  }, []);

const getPageDbId = useCallback(async (pageId) => {
  if (pageDbIdCache.has(pageId)) {
    return pageDbIdCache.get(pageId);
  }

  try {
    const response = await fetch('http://localhost:8000/pages/');
    if (!response.ok) throw new Error('Failed to fetch pages');
    
    const data = await response.json();
    const pagesData = data.pages || []; // ✅ เข้าถึง array ที่อยู่ใน key "pages"

    const currentPage = pagesData.find(
      p => p.page_id === pageId || p.id === pageId
    );

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

  // Load message IDs
  useEffect(() => {
    const loadGroupMessages = async () => {
      if (!selectedPage || selectedGroups.length === 0) return;
      
      try {
        const dbId = await getPageDbId(selectedPage);
        if (!dbId) return;
        
        const groupId = selectedGroups[0].id;
        
        if (isKnowledgeGroup(groupId)) {
          const knowledgeId = groupId.replace('knowledge_', '');
          const response = await fetch(`http://localhost:8000/knowledge-group-messages/${selectedPage}/${knowledgeId}`);
          if (response.ok) {
            const messages = await response.json();
            const ids = messages.map(msg => msg.id);
            setMessageIds(ids);
          }
        } else {
          const response = await fetch(`http://localhost:8000/group-messages/${dbId}/${groupId}`);
          if (response.ok) {
            const messages = await response.json();
            const ids = messages.map(msg => msg.id);
            setMessageIds(ids);
          }
        }
      } catch (error) {
        console.error('Error loading group messages:', error);
      }
    };
    
    loadGroupMessages();
  }, [selectedPage, selectedGroups, getPageDbId, isKnowledgeGroup]);

  // Load selected groups
  useEffect(() => {
    const loadSelectedGroups = async () => {
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
        
        if (selectedGroupIds.length > 0 && dbId) {
          try {
            const isKnowledge = selectedGroupIds.some(id => isKnowledgeGroup(id));
            
            if (isKnowledge) {
              const response = await fetch(`http://localhost:8000/page-customer-type-knowledge/${savedPage}`);
              if (response.ok) {
                const allKnowledgeTypes = await response.json();
                const selectedKnowledgeGroups = allKnowledgeTypes.filter(kt => 
                  selectedGroupIds.includes(kt.id)
                );
                
                const formattedGroups = selectedKnowledgeGroups.map(group => ({
                  id: group.id,
                  name: group.type_name,
                  type_name: group.type_name,
                  isKnowledge: true,
                  isDefault: false
                }));
                
                setSelectedGroups(formattedGroups);
                
                if (formattedGroups.length > 0 && editingScheduleId) {
                  await loadExistingSchedule(dbId, formattedGroups[0].id);
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
                  isKnowledge: false
                }));
                
                setSelectedGroups(formattedGroups);
                
                if (formattedGroups.length > 0 && editingScheduleId) {
                  await loadExistingSchedule(dbId, formattedGroups[0].id);
                }
              }
            }
          } catch (error) {
            console.error('Error loading groups:', error);
          }
        }
      } else {
        setDefaultScheduleValues();
      }
    };

    loadSelectedGroups();
    
    const editingId = localStorage.getItem("editingScheduleId");
    if (editingId) {
      setEditingScheduleId(parseInt(editingId));
    }

    fetchPages()
      .then(setPages)
      .catch(err => console.error("ไม่สามารถโหลดเพจได้:", err));
  }, [navigate, editingScheduleId, getPageDbId, isKnowledgeGroup]);

  const loadExistingSchedule = useCallback(async (dbId, groupId) => {
    try {
      const searchGroupId = isKnowledgeGroup(groupId) ? 
        `group_knowledge_${groupId.replace('knowledge_', '')}` : 
        groupId;
      
      const schedulesResponse = await fetch(`http://localhost:8000/message-schedules/group/${dbId}/${searchGroupId}`);
      if (schedulesResponse.ok) {
        const schedules = await schedulesResponse.json();
        
        if (schedules.length > 0) {
          const schedule = schedules[0];
          
          setScheduleType(schedule.send_type || 'immediate');
          
          if (schedule.scheduled_at) {
            const scheduledDate = new Date(schedule.scheduled_at);
            setScheduleDate(scheduledDate.toISOString().split('T')[0]);
            setScheduleTime(scheduledDate.toTimeString().slice(0, 5));
          }
          
          if (schedule.send_after_inactive) {
            const parts = schedule.send_after_inactive.split(' ');
            if (parts.length >= 2) {
              setInactivityPeriod(parts[0]);
              setInactivityUnit(parts[1].replace(/s$/, ''));
            }
          }
          
          setRepeatType(schedule.frequency || 'once');
        }
      }
    } catch (error) {
      console.error('Error loading existing schedule:', error);
    }
  }, [isKnowledgeGroup]);

  const setDefaultScheduleValues = useCallback(() => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timeStr = today.toTimeString().slice(0, 5);
    setScheduleDate(dateStr);
    setScheduleTime(timeStr);
  }, []);

  const validateSchedule = useCallback(() => {
    if (scheduleType === 'scheduled') {
      if (!scheduleDate || !scheduleTime) {
        alert("กรุณาเลือกวันที่และเวลา");
        return false;
      }

      const scheduleDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
      if (scheduleDateTime <= new Date()) {
        alert("กรุณาเลือกเวลาในอนาคต");
        return false;
      }
    }

    if (scheduleType === 'user-inactive') {
      if (!inactivityPeriod || inactivityPeriod < 1) {
        alert("กรุณากำหนดระยะเวลาที่หายไป");
        return false;
      }
    }

    if (repeatType === 'weekly' && repeatDays.length === 0) {
      alert("กรุณาเลือกวันที่ต้องการส่งซ้ำ");
      return false;
    }

    if (repeatType !== 'once' && endDate) {
      const end = new Date(endDate);
      const start = new Date(scheduleDate);
      if (end <= start) {
        alert("วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น");
        return false;
      }
    }

    return true;
  }, [scheduleType, scheduleDate, scheduleTime, inactivityPeriod, repeatType, repeatDays, endDate]);

  const deleteKnowledgeGroupSchedules = useCallback(async (pageId, knowledgeId) => {
    try {
      const response = await fetch(
        `http://localhost:8000/message-schedules/knowledge-group/${pageId}/${knowledgeId}`,
        { method: 'DELETE' }
      );
      
      if (!response.ok) {
        throw new Error('Failed to delete schedules');
      }
      
      const result = await response.json();
      console.log('✅ Deleted schedules:', result);
      return result;
    } catch (error) {
      console.error('Error deleting knowledge group schedules:', error);
      throw error;
    }
  }, []);

  const deleteExistingSchedules = useCallback(async (dbId, dbGroupId) => {
    try {
      const existingSchedulesResponse = await fetch(
        `http://localhost:8000/message-schedules/group/${dbId}/${dbGroupId}`
      );
      
      if (existingSchedulesResponse.ok) {
        const existingSchedules = await existingSchedulesResponse.json();
        
        for (const oldSchedule of existingSchedules) {
          await fetch(`http://localhost:8000/message-schedules/${oldSchedule.id}`, {
            method: 'DELETE'
          });
        }
      }
    } catch (error) {
      console.error('❌ Error deleting old schedules:', error);
    }
  }, []);

  const loadMessageIds = useCallback(async (dbId, groupId, isKnowledge) => {
    try {
      let response;
      
      if (isKnowledge) {
        const knowledgeId = groupId.replace('knowledge_', '');
        response = await fetch(`http://localhost:8000/knowledge-group-messages/${selectedPage}/${knowledgeId}`);
      } else {
        response = await fetch(`http://localhost:8000/group-messages/${dbId}/${groupId}`);
      }
      
      if (response.ok) {
        const messages = await response.json();
        const ids = messages.map(msg => msg.id);
        setMessageIds(ids);
        return ids;
      }
      
      return [];
    } catch (error) {
      console.error('Error loading message IDs:', error);
      return [];
    }
  }, [selectedPage]);

  const saveSchedule = useCallback(async () => {
    if (!validateSchedule()) return;
    
    setSavingSchedule(true);
    
    try {
      const dbId = await getPageDbId(selectedPage);
      if (!dbId) {
        alert('ไม่พบข้อมูลเพจในระบบ');
        return;
      }
      
      const groupId = selectedGroups[0].id;
      const isKnowledge = isKnowledgeGroup(groupId);
      
      if (isKnowledge) {
        const knowledgeId = groupId.replace('knowledge_', '');
        
        await deleteKnowledgeGroupSchedules(selectedPage, knowledgeId);
        
        const messagesResponse = await fetch(
          `http://localhost:8000/knowledge-group-messages/${selectedPage}/${knowledgeId}`
        );
        
        if (messagesResponse.ok) {
          const messages = await messagesResponse.json();
          const messageIds = messages.map(msg => msg.id);
          
          const schedulePromises = messageIds.map(async (messageId) => {
            const scheduleData = {
              customer_type_message_id: messageId,
              send_type: SCHEDULE_TYPE_MAP[scheduleType],
              scheduled_at: scheduleType === 'scheduled' ? 
                `${scheduleDate}T${scheduleTime}:00` : null,
              send_after_inactive: scheduleType === 'user-inactive' ? 
                `${inactivityPeriod} ${inactivityUnit}` : null,
              frequency: repeatType
            };
            
            const response = await fetch('http://localhost:8000/message-schedules', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(scheduleData)
            });
            
            if (!response.ok) {
              throw new Error('Failed to create schedule');
            }
            
            return response.json();
          });
          
          await Promise.all(schedulePromises);
        }
      } else {
        const dbGroupId = groupId;
        
        await deleteExistingSchedules(dbId, dbGroupId);
        
        if (!messageIds || messageIds.length === 0) {
          const ids = await loadMessageIds(dbId, groupId, isKnowledge);
          if (ids.length === 0) {
            alert('ไม่พบข้อความในกลุ่มนี้');
            navigate('/GroupDefault');
            return;
          }
        }
        
        const schedulePromises = messageIds.map(async (messageId) => {
          const scheduleData = {
            customer_type_message_id: messageId,
            send_type: SCHEDULE_TYPE_MAP[scheduleType],
            scheduled_at: scheduleType === 'scheduled' ? 
              `${scheduleDate}T${scheduleTime}:00` : null,
            send_after_inactive: scheduleType === 'user-inactive' ? 
              `${inactivityPeriod} ${inactivityUnit}` : null,
            frequency: repeatType
          };
          
          const response = await fetch('http://localhost:8000/message-schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scheduleData)
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to save schedule: ${error.detail || 'Unknown error'}`);
          }
          
          return response.json();
        });
        
        await Promise.all(schedulePromises);
      }
      
      alert("บันทึกการตั้งเวลาสำเร็จ!");
      
      localStorage.removeItem("selectedCustomerGroups");
      localStorage.removeItem("selectedCustomerGroupsPageId");
      localStorage.removeItem("editingScheduleId");
      
      navigate('/MinerGroup');
      
    } catch (error) {
      console.error('❌ Error saving schedule:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกการตั้งเวลา: ' + error.message);
    } finally {
      setSavingSchedule(false);
    }
  }, [
    validateSchedule, 
    getPageDbId, 
    selectedPage, 
    selectedGroups, 
    isKnowledgeGroup,
    deleteKnowledgeGroupSchedules,
    deleteExistingSchedules,
    messageIds,
    loadMessageIds,
    scheduleType,
    scheduleDate,
    scheduleTime,
    inactivityPeriod,
    inactivityUnit,
    repeatType,
    navigate,
    SCHEDULE_TYPE_MAP
  ]);

  const getScheduleSummary = useMemo(() => {
    const weekDays = [
      { id: 0, name: 'อาทิตย์', short: 'อา' },
      { id: 1, name: 'จันทร์', short: 'จ' },
      { id: 2, name: 'อังคาร', short: 'อ' },
      { id: 3, name: 'พุธ', short: 'พ' },
      { id: 4, name: 'พฤหัสบดี', short: 'พฤ' },
      { id: 5, name: 'ศุกร์', short: 'ศ' },
      { id: 6, name: 'เสาร์', short: 'ส' }
    ];

    if (scheduleType === 'immediate') return 'ส่งทันที';
    
    if (scheduleType === 'user-inactive') {
      let summary = `ส่งเมื่อ User หายไปเกิน ${inactivityPeriod} ${
        inactivityUnit === 'minutes' ? 'นาที' :
        inactivityUnit === 'hours' ? 'ชั่วโมง' :
        inactivityUnit === 'days' ? 'วัน' :
        inactivityUnit === 'weeks' ? 'สัปดาห์' : 'เดือน'
      }`;
      
      if (repeatType !== 'once') {
        summary += '\n';
        switch (repeatType) {
          case 'daily':
            summary += `ตรวจสอบและส่งซ้ำทุกวัน`;
            break;
          case 'weekly':
            summary += `ตรวจสอบและส่งซ้ำทุกสัปดาห์ วัน${repeatDays.map(d => weekDays.find(w => w.id === d)?.short).join(', ')}`;
            break;
          case 'monthly':
            summary += `ตรวจสอบและส่งซ้ำทุกเดือน`;
            break;
          default:
            break;
        }
        
        if (endDate) {
          summary += ` จนถึง ${new Date(endDate).toLocaleDateString('th-TH')}`;
        }
      }
      
      return summary;
    }
    
    let summary = `ส่งวันที่ ${new Date(scheduleDate).toLocaleDateString('th-TH')} เวลา ${scheduleTime} น.`;
    
    if (repeatType !== 'once') {
      summary += '\n';
      switch (repeatType) {
        case 'daily':
          summary += `ทำซ้ำทุกวัน`;
          break;
        case 'weekly':
          summary += `ทำซ้ำทุกสัปดาห์ วัน${repeatDays.map(d => weekDays.find(w => w.id === d)?.short).join(', ')}`;
          break;
        case 'monthly':
          summary += `ทำซ้ำทุกเดือน`;
          break;
        default:
          break;
      }
      
      if (endDate) {
        summary += ` จนถึง ${new Date(endDate).toLocaleDateString('th-TH')}`;
      }
    }
    
    return summary;
  }, [scheduleType, scheduleDate, scheduleTime, inactivityPeriod, inactivityUnit, repeatType, repeatDays, endDate]);

  const selectedPageInfo = useMemo(() => 
    pages.find(p => p.id === selectedPage),
    [pages, selectedPage]
  );
  
  const isForKnowledgeGroup = useMemo(() => 
    selectedGroups.some(g => g.isKnowledge),
    [selectedGroups]
  );

  return (
    <div style={{display: 'flex'}}>
      <Sidebar />
      
      <div className="schedule-container">
        <div className="background-pattern"></div>
        
        <div className="content-wrapper">
          <div className="schedule-header">
            <h1 className="schedule-title">
              <span className="title-icon">⏰</span>
              {editingScheduleId ? 'แก้ไขการตั้งเวลา' :  
               isForKnowledgeGroup ? 'ตั้งเวลาและความถี่การส่ง - กลุ่มพื้นฐาน' :
               'ตั้งเวลาและความถี่การส่ง'}
            </h1>
            <div className="breadcrumb">
              <span className="breadcrumb-item">1. เลือกกลุ่ม</span>
              <span className="breadcrumb-separator">›</span>
              <span className="breadcrumb-item">2. ตั้งค่าข้อความ</span>
              <span className="breadcrumb-separator">›</span>
              <span className="breadcrumb-item breadcrumb-active">3. ตั้งเวลา</span>
            </div>
          </div>

          <div className="schedule-summary">
            <h3 className="summary-title">📊 สรุปการตั้งค่า</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <div className="summary-label">เพจที่เลือก</div>
                <div className="summary-value">
                  📱 {selectedPageInfo?.name || '-'}
                </div>
              </div>
              <div className="summary-item">
                <div className="summary-label">กลุ่มเป้าหมาย</div>
                <div className="summary-value">
                  {selectedGroups.map(g => (
                    <span key={g.id}>
                      {g.isKnowledge ? '🧠' : '👥'} {g.name}
                    </span>
                  )).reduce((prev, curr, i) => [prev, i > 0 && ', ', curr], [])}
                </div>
              </div>
              <div className="summary-item">
                <div className="summary-label">จำนวนข้อความ</div>
                <div className="summary-value">
                  💬 {messageIds.length} ข้อความ
                </div>
              </div>
            </div>
          </div>

          <div className="schedule-form">
            <div className="form-section">
              <h3 className="section-title">
                <span className="section-title-icon">🕐</span>
                เวลาที่ต้องการส่ง
              </h3>
              
              <div className="schedule-type-selector">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="scheduleType"
                    value="immediate"
                    checked={scheduleType === 'immediate'}
                    onChange={(e) => setScheduleType(e.target.value)}
                    className="radio-input"
                  />
                  <span className={`radio-label ${scheduleType === 'immediate' ? 'radio-label-selected' : ''}`}>
                    <span className="radio-icon">⚡</span>
                    ส่งทันที
                  </span>
                </label>
                
                <label className="radio-option">
                  <input
                    type="radio"
                    name="scheduleType"
                    value="scheduled"
                    checked={scheduleType === 'scheduled'}
                    onChange={(e) => setScheduleType(e.target.value)}
                    className="radio-input"
                  />
                  <span className={`radio-label ${scheduleType === 'scheduled' ? 'radio-label-selected' : ''}`}>
                    <span className="radio-icon">📅</span>
                    กำหนดเวลา
                  </span>
                </label>

                <label className="radio-option">
                  <input
                    type="radio"
                    name="scheduleType"
                    value="user-inactive"
                    checked={scheduleType === 'user-inactive'}
                    onChange={(e) => setScheduleType(e.target.value)}
                    className="radio-input"
                  />
                  <span className={`radio-label ${scheduleType === 'user-inactive' ? 'radio-label-selected' : ''}`}>
                    <span className="radio-icon">🕰️</span>
                    ตามระยะเวลาที่หาย
                  </span>
                </label>
              </div>

              {scheduleType === 'scheduled' && (
                <div className="datetime-inputs">
                  <div className="form-group">
                    <label className="form-label">📅 วันที่</label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="form-input"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">⏰ เวลา</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
                )}

              {scheduleType === 'user-inactive' && (
                <div className="inactivity-settings">
                  <label className="form-label">ส่งข้อความเมื่อ User หายไปเกิน:</label>
                  <div className="inactivity-inputs">
                    <input
                      type="number"
                      value={inactivityPeriod}
                      onChange={(e) => setInactivityPeriod(e.target.value)}
                      min="1"
                      className="form-input inactivity-number"
                    />
                    <select
                      value={inactivityUnit}
                      onChange={(e) => setInactivityUnit(e.target.value)}
                      className="form-input inactivity-select"
                    >
                      <option value="minutes">นาที</option>
                      <option value="hours">ชั่วโมง</option>
                      <option value="days">วัน</option>
                      <option value="weeks">สัปดาห์</option>
                      <option value="months">เดือน</option>
                    </select>
                  </div>
                  <p className="inactivity-hint">
                    💡 ระบบจะตรวจสอบทุกๆ ชั่วโมง และส่งข้อความไปยัง User ที่ไม่มีการตอบกลับตามระยะเวลาที่กำหนด
                  </p>
                </div>
              )}
            </div>

            <div className="form-section form-section-last">
              <h3 className="section-title">
                <span className="section-title-icon">🔄</span>
                ความถี่ในการส่ง
              </h3>
              
              <div className="schedule-type-selector">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="repeatType"
                    value="once"
                    checked={repeatType === 'once'}
                    onChange={(e) => setRepeatType(e.target.value)}
                    className="radio-input"
                  />
                  <span className={`radio-label ${repeatType === 'once' ? 'radio-label-selected' : ''}`}>
                    ครั้งเดียว
                  </span>
                </label>
                
                <label className="radio-option">
                  <input
                    type="radio"
                    name="repeatType"
                    value="daily"
                    checked={repeatType === 'daily'}
                    onChange={(e) => setRepeatType(e.target.value)}
                    className="radio-input"
                  />
                  <span className={`radio-label ${repeatType === 'daily' ? 'radio-label-selected' : ''}`}>
                    ทุกวัน
                  </span>
                </label>
                
                <label className="radio-option">
                  <input
                    type="radio"
                    name="repeatType"
                    value="weekly"
                    checked={repeatType === 'weekly'}
                    onChange={(e) => setRepeatType(e.target.value)}
                    className="radio-input"
                  />
                  <span className={`radio-label ${repeatType === 'weekly' ? 'radio-label-selected' : ''}`}>
                    ทุกสัปดาห์
                  </span>
                </label>
                
                <label className="radio-option">
                  <input
                    type="radio"
                    name="repeatType"
                    value="monthly"
                    checked={repeatType === 'monthly'}
                    onChange={(e) => setRepeatType(e.target.value)}
                    className="radio-input"
                  />
                  <span className={`radio-label ${repeatType === 'monthly' ? 'radio-label-selected' : ''}`}>
                    ทุกเดือน
                  </span>
                </label>
              </div>

              {repeatType === 'weekly' && (
                <div style={{marginTop: '24px'}}>
                  <label className="form-label">เลือกวันที่ต้องการส่ง:</label>
                  <WeekDaySelector 
                    repeatDays={repeatDays}
                    onToggleDay={toggleWeekDay}
                  />
                </div>
              )}

              {repeatType !== 'once' && (
                <div style={{marginTop: '50px', marginBottom: '-45px'}}>
                  <div className="form-group">
                    <label className="form-label">
                      📆 สิ้นสุดวันที่ (ไม่บังคับ)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={scheduleDate || new Date().toISOString().split('T')[0]}
                      className="form-input"
                      style={{maxWidth: '250px'}}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="schedule-preview">
              <div className="preview-decoration"></div>
              <h3 className="preview-title">
                📋 สรุปการตั้งเวลา
              </h3>
              <div className="preview-content">
                {getScheduleSummary}
              </div>
            </div>
            
            <div className="action-buttons">
              <Link to="/GroupDefault" className="back-btn">
                ← กลับ
              </Link>
              
              <button
                onClick={saveSchedule}
                className="save-schedule-btn"
                disabled={savingSchedule}
                style={{marginLeft: 'auto'}}
              >
                <span className="btn-icon">💾</span>
                {savingSchedule ? 'กำลังบันทึก...' : (editingScheduleId ? 'บันทึกการแก้ไข' : 'บันทึกการตั้งค่า')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(GroupSchedule);