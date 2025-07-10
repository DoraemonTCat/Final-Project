import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../CSS/GroupSchedule.css';
import { fetchPages, connectFacebook } from "../Features/Tool";
import Sidebar from "./Sidebar"; 


function GroupSchedule() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [scheduleType, setScheduleType] = useState('immediate'); // immediate, scheduled, user-inactive
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [inactivityPeriod, setInactivityPeriod] = useState('1'); // จำนวนเวลาที่หายไป
  const [inactivityUnit, setInactivityUnit] = useState('days'); // หน่วยเวลา (hours, days, weeks, months)
  const [repeatType, setRepeatType] = useState('once'); // once, daily, weekly, monthly
  const [repeatCount, setRepeatCount] = useState(1);
  const [repeatDays, setRepeatDays] = useState([]);
  const [endDate, setEndDate] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const navigate = useNavigate();
  const [messageIds, setMessageIds] = useState([]);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const weekDays = [
    { id: 0, name: 'อาทิตย์', short: 'อา' },
    { id: 1, name: 'จันทร์', short: 'จ' },
    { id: 2, name: 'อังคาร', short: 'อ' },
    { id: 3, name: 'พุธ', short: 'พ' },
    { id: 4, name: 'พฤหัสบดี', short: 'พฤ' },
    { id: 5, name: 'ศุกร์', short: 'ศ' },
    { id: 6, name: 'เสาร์', short: 'ส' }
  ];

  const SCHEDULE_TYPE_MAP = {
  'immediate': 'immediate',
  'scheduled': 'scheduled',
  'user-inactive': 'after_inactive'
};

  // เพิ่ม useEffect เพื่อดึง message IDs และโหลด schedule data
  useEffect(() => {
    const loadGroupMessages = async () => {
      if (!selectedPage || selectedGroups.length === 0) return;
      
      // ถ้าเป็น default group ไม่ต้องโหลด message IDs
      if (selectedGroups[0].id && selectedGroups[0].id.toString().startsWith('default_')) {
        return;
      }
      
      try {
        const dbId = await getPageDbId(selectedPage);
        if (!dbId) return;
        
        const groupId = selectedGroups[0].id;
        const response = await fetch(`http://localhost:8000/group-messages/${dbId}/${groupId}`);
        if (response.ok) {
          const messages = await response.json();
          const ids = messages.map(msg => msg.id);
          setMessageIds(ids);
          console.log('Loaded message IDs:', ids);
        }
      } catch (error) {
        console.error('Error loading group messages:', error);
      }
    };
    
    loadGroupMessages();
  }, [selectedPage, selectedGroups]);

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

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // 🔥 ฟังก์ชันดึงกลุ่มลูกค้าตาม page ID (รองรับ default groups)
  const getGroupsForPage = (pageId) => {
    if (!pageId) return [];
    const key = `customerGroups_${pageId}`;
    const userGroups = JSON.parse(localStorage.getItem(key) || '[]');
    
    // 🔥 ดึงข้อมูล default groups
    const DEFAULT_GROUPS = [
      { id: 'default_1', name: 'กลุ่มคนหาย', isDefault: true },
      { id: 'default_2', name: 'กลุ่มคนหายนาน', isDefault: true },
      { id: 'default_3', name: 'กลุ่มคนหายนานมาก', isDefault: true }
    ];
    
    const defaultGroupsWithCustomNames = DEFAULT_GROUPS.map(group => {
      const customNamesKey = `defaultGroupCustomNames_${pageId}`;
      const customNames = JSON.parse(localStorage.getItem(customNamesKey) || '{}');
      
      return {
        ...group,
        name: customNames[group.id] || group.name
      };
    });
    
    return [...defaultGroupsWithCustomNames, ...userGroups];
  };

  // 🔥 ฟังก์ชันบันทึกตารางการส่งตาม page ID
  const saveSchedulesForPage = (pageId, schedules) => {
    if (!pageId) return;
    const key = `miningSchedules_${pageId}`;
    localStorage.setItem(key, JSON.stringify(schedules));
  };

  // 🔥 ฟังก์ชันดึงตารางการส่งตาม page ID
  const getSchedulesForPage = (pageId) => {
    if (!pageId) return [];
    const key = `miningSchedules_${pageId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  };

  useEffect(() => {
    const loadSelectedGroups = async () => {
      // 🔥 ตรวจสอบว่า page ID ตรงกันหรือไม่
      const selectedPageId = localStorage.getItem("selectedCustomerGroupsPageId");
      const savedPage = localStorage.getItem("selectedPage");
      
      if (selectedPageId && selectedPageId !== savedPage) {
        alert("กลุ่มลูกค้าที่เลือกมาจากเพจอื่น กรุณากลับไปเลือกใหม่");
        navigate('/MinerGroup');
        return;
      }

      // โหลดกลุ่มที่เลือก
      const selectedGroupIds = JSON.parse(localStorage.getItem("selectedCustomerGroups") || '[]');
      
      if (savedPage) {
        setSelectedPage(savedPage);
        
        // ดึง page DB ID
        const dbId = await getPageDbId(savedPage);
        
        if (selectedGroupIds.length > 0 && dbId) {
          try {
            // ตรวจสอบว่าเป็น default group หรือไม่
            const isDefaultGroup = selectedGroupIds.some(id => 
              id === 'default_1' || id === 'default_2' || id === 'default_3'
            );
            
            if (isDefaultGroup) {
              // สำหรับ default groups
              const DEFAULT_GROUPS = [
                { id: 'default_1', name: 'กลุ่มคนหาย', isDefault: true },
                { id: 'default_2', name: 'กลุ่มคนหายนาน', isDefault: true },
                { id: 'default_3', name: 'กลุ่มคนหายนานมาก', isDefault: true }
              ];
              
              const selectedDefaultGroups = DEFAULT_GROUPS.filter(g => 
                selectedGroupIds.includes(g.id)
              );
              
              // เพิ่มชื่อที่กำหนดเอง
              const customNamesKey = `defaultGroupCustomNames_${savedPage}`;
              const customNames = JSON.parse(localStorage.getItem(customNamesKey) || '{}');
              
              const groupsWithCustomNames = selectedDefaultGroups.map(group => ({
                ...group,
                name: customNames[group.id] || group.name
              }));
              
              setSelectedGroups(groupsWithCustomNames);
              
              // โหลด schedules จาก localStorage สำหรับ default group
              if (groupsWithCustomNames.length > 0) {
                const groupId = groupsWithCustomNames[0].id;
                const scheduleKey = `defaultGroupSchedules_${savedPage}_${groupId}`;
                const savedSchedules = JSON.parse(localStorage.getItem(scheduleKey) || '[]');
                
                if (savedSchedules.length > 0 && editingScheduleId) {
                  const schedule = savedSchedules.find(s => s.id === editingScheduleId);
                  if (schedule) {
                    setScheduleType(schedule.type || 'immediate');
                    setScheduleDate(schedule.date || new Date().toISOString().split('T')[0]);
                    setScheduleTime(schedule.time || new Date().toTimeString().slice(0, 5));
                    setInactivityPeriod(schedule.inactivityPeriod || '1');
                    setInactivityUnit(schedule.inactivityUnit || 'days');
                    setRepeatType(schedule.repeat?.type || 'once');
                    setRepeatDays(schedule.repeat?.days || []);
                    setEndDate(schedule.repeat?.endDate || '');
                  }
                }
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
                  isDefault: false
                }));
                
                setSelectedGroups(formattedGroups);
                
                // โหลด schedules จาก database สำหรับกลุ่มแรก
                if (formattedGroups.length > 0 && editingScheduleId) {
                  const groupId = formattedGroups[0].id;
                  const schedulesResponse = await fetch(`http://localhost:8000/message-schedules/group/${dbId}/${groupId}`);
                  if (schedulesResponse.ok) {
                    const schedules = await schedulesResponse.json();
                    const schedule = schedules.find(s => s.id === editingScheduleId);
                    
                    if (schedule) {
                      setScheduleType(schedule.send_type || 'immediate');
                      
                      if (schedule.scheduled_at) {
                        const scheduledDate = new Date(schedule.scheduled_at);
                        setScheduleDate(scheduledDate.toISOString().split('T')[0]);
                        setScheduleTime(scheduledDate.toTimeString().slice(0, 5));
                      }
                      
                      if (schedule.send_after_inactive) {
                        // Parse "1 days" -> period: 1, unit: days
                        const parts = schedule.send_after_inactive.split(' ');
                        if (parts.length >= 2) {
                          setInactivityPeriod(parts[0]);
                          setInactivityUnit(parts[1].replace(/s$/, ''));
                        }
                      }
                      
                      setRepeatType(schedule.frequency || 'once');
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error loading groups:', error);
          }
        }
      } else {
        // ถ้าไม่มีการบันทึกไว้ ใช้ค่า default
        setDefaultScheduleValues();
      }
    };

    loadSelectedGroups();
    
    // 🔥 ตรวจสอบว่าเป็นการแก้ไขหรือไม่
    const editingId = localStorage.getItem("editingScheduleId");
    if (editingId) {
      setEditingScheduleId(parseInt(editingId));
    }

    fetchPages()
      .then(setPages)
      .catch(err => console.error("ไม่สามารถโหลดเพจได้:", err));
  }, [navigate]);

  // 🔥 ฟังก์ชันตั้งค่า default
  const setDefaultScheduleValues = () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timeStr = today.toTimeString().slice(0, 5);
    setScheduleDate(dateStr);
    setScheduleTime(timeStr);
  };

  const handlePageChange = (e) => {
    const pageId = e.target.value;
    setSelectedPage(pageId);
    localStorage.setItem("selectedPage", pageId);
  };

  const toggleWeekDay = (dayId) => {
    setRepeatDays(prev => {
      if (prev.includes(dayId)) {
        return prev.filter(id => id !== dayId);
      }
      return [...prev, dayId];
    });
  };

  const validateSchedule = () => {
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
  };

  // แก้ไขฟังก์ชัน saveSchedule
  // แก้ไขส่วนของฟังก์ชัน saveSchedule ในบริเวณบรรทัดที่ 400-450

const saveSchedule = async () => {
  if (!validateSchedule()) return;
  
  setSavingSchedule(true);
  
  try {
    // ตรวจสอบว่าเป็น default group หรือไม่
    const isDefaultGroup = selectedGroups.some(g => g.id && g.id.toString().startsWith('default_'));
    
    if (isDefaultGroup) {
      // สำหรับ default groups บันทึกใน localStorage
      const groupId = selectedGroups[0].id;
      const scheduleData = {
        id: editingScheduleId || Date.now(),
        groupId: groupId,
        type: scheduleType,
        date: scheduleDate,
        time: scheduleTime,
        inactivityPeriod: scheduleType === 'user-inactive' ? inactivityPeriod : null,
        inactivityUnit: scheduleType === 'user-inactive' ? inactivityUnit : null,
        repeat: {
          type: repeatType,
          count: repeatCount,
          days: repeatDays,
          endDate: endDate
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const scheduleKey = `defaultGroupSchedules_${selectedPage}_${groupId}`;
      const existingSchedules = JSON.parse(localStorage.getItem(scheduleKey) || '[]');
      
      if (editingScheduleId) {
        // แก้ไข schedule ที่มีอยู่
        const index = existingSchedules.findIndex(s => s.id === editingScheduleId);
        if (index !== -1) {
          existingSchedules[index] = scheduleData;
        }
      } else {
        // เพิ่ม schedule ใหม่
        existingSchedules.push(scheduleData);
      }
      
      localStorage.setItem(scheduleKey, JSON.stringify(existingSchedules));
      alert(editingScheduleId ? "แก้ไขการตั้งเวลาสำเร็จ!" : "บันทึกการตั้งเวลาสำเร็จ!");
      
    } else {
      // สำหรับ user groups บันทึกใน database
      if (!messageIds || messageIds.length === 0) {
        // ถ้าไม่มี messageIds ให้ลองดึงใหม่
        const dbId = await getPageDbId(selectedPage);
        if (!dbId) {
          alert('ไม่พบข้อมูลเพจในระบบ');
          return;
        }
        
        const groupId = selectedGroups[0].id;
        const response = await fetch(`http://localhost:8000/group-messages/${dbId}/${groupId}`);
        if (!response.ok) {
          alert('ไม่พบข้อความในกลุ่มนี้ กรุณาตั้งค่าข้อความก่อน');
          navigate('/GroupDefault');
          return;
        }
        
        const messages = await response.json();
        const ids = messages.map(msg => msg.id);
        setMessageIds(ids);
        
        if (ids.length === 0) {
          alert('ไม่พบข้อความในกลุ่มนี้');
          return;
        }
      }
      
      // ถ้าเป็นการแก้ไข ลบ schedules เดิมก่อน
      if (editingScheduleId) {
        try {
          await fetch(`http://localhost:8000/message-schedules/${editingScheduleId}`, {
            method: 'DELETE'
          });
        } catch (error) {
          console.error('Error deleting old schedule:', error);
        }
      }
      
      const schedulePromises = messageIds.map(async (messageId) => {
        // 🔥 แก้ไขการส่งข้อมูลให้ตรงกับ database constraint
        const scheduleData = {
          customer_type_message_id: messageId,
          send_type: SCHEDULE_TYPE_MAP[scheduleType],
          scheduled_at: scheduleType === 'scheduled' ? `${scheduleDate}T${scheduleTime}:00` : null,
          send_after_inactive: scheduleType === 'user-inactive' ? `${inactivityPeriod} ${inactivityUnit}` : null, // ส่งเป็น string
          frequency: repeatType
        };
        
        console.log('Saving schedule data:', scheduleData);
        
        const response = await fetch('http://localhost:8000/message-schedules', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(scheduleData)
        });
        
        if (!response.ok) {
          const error = await response.json();
          console.error('Schedule save error:', error);
          throw new Error(`Failed to save schedule: ${error.detail || 'Unknown error'}`);
        }
        
        return response.json();
      });
      
      const results = await Promise.all(schedulePromises);
      console.log('All schedules saved:', results);
      alert(editingScheduleId ? "แก้ไขการตั้งเวลาสำเร็จ!" : "บันทึกการตั้งเวลาสำเร็จ!");
    }
    
    // เคลียร์ข้อมูลและกลับไปหน้ากลุ่ม
    localStorage.removeItem("selectedCustomerGroups");
    localStorage.removeItem("selectedCustomerGroupsPageId");
    localStorage.removeItem("editingScheduleId");
    
    navigate('/MinerGroup');
    
  } catch (error) {
    console.error('Error saving schedule:', error);
    alert('เกิดข้อผิดพลาดในการบันทึกการตั้งเวลา: ' + error.message);
  } finally {
    setSavingSchedule(false);
  }
};

  const getScheduleSummary = () => {
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
      }
      
      if (endDate) {
        summary += ` จนถึง ${new Date(endDate).toLocaleDateString('th-TH')}`;
      }
    }
    
    return summary;
  };

  // เพิ่มฟังก์ชันดึง page DB ID
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

  const selectedPageInfo = pages.find(p => p.id === selectedPage);
  const isForDefaultGroup = selectedGroups.some(g => g.isDefault); // 🔥 ตรวจสอบว่าเป็น default group

  return (
    <div className="app-container">
       <Sidebar />

      <div className="schedule-container">
        <div className="schedule-header">
          <h1 className="schedule-title">
            <span className="title-icon">⏰</span>
            {editingScheduleId ? 'แก้ไขการตั้งเวลา' : 
             isForDefaultGroup ? 'ตั้งเวลาและความถี่การส่ง - กลุ่มพื้นฐาน' :
             'ตั้งเวลาและความถี่การส่ง'}
            {selectedPageInfo && (
              <span style={{ fontSize: '18px', color: '#718096', marginLeft: '10px' }}>
                - {selectedPageInfo.name}
              </span>
            )}
          </h1>
          <div className="breadcrumb">
            <span className="breadcrumb-item">1. เลือกกลุ่ม</span>
            <span className="breadcrumb-separator">›</span>
            <span className="breadcrumb-item">2. ตั้งค่าข้อความ</span>
            <span className="breadcrumb-separator">›</span>
            <span className="breadcrumb-item active">3. ตั้งเวลา</span>
          </div>
        </div>

        <div className="schedule-summary">
          <h3>สรุปการตั้งค่า:</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">เพจ:</span>
              <span className="summary-value">{selectedPageInfo?.name || '-'}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">กลุ่มที่เลือก:</span>
              <span className="summary-value">
                {selectedGroups.map(g => (
                  <span key={g.id}>
                    {g.isDefault && '⭐ '}
                    {g.name}
                  </span>
                )).reduce((prev, curr, i) => [prev, i > 0 && ', ', curr], [])}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">จำนวนข้อความ:</span>
              <span className="summary-value">
                {isForDefaultGroup 
                  ? JSON.parse(localStorage.getItem(`defaultGroupMessages_${selectedPage}_${selectedGroups[0]?.id}`) || '[]').length 
                  : messageIds.length
                } ข้อความ
              </span>
            </div>
          </div>
        </div>

        <div className="schedule-form">
          <div className="form-section">
            <h3 className="section-title">🕐 เวลาที่ต้องการส่ง</h3>
            
            <div className="schedule-type-selector">
              <label className="radio-option">
                <input
                  type="radio"
                  name="scheduleType"
                  value="immediate"
                  checked={scheduleType === 'immediate'}
                  onChange={(e) => setScheduleType(e.target.value)}
                />
                <span className="radio-label">
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
                />
                <span className="radio-label">
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
                />
                <span className="radio-label">
                  <span className="radio-icon">🕰️</span>
                  ตามระยะเวลาที่หาย
                </span>
              </label>
            </div>

            {scheduleType === 'scheduled' && (
              <div className="datetime-inputs">
                <div className="form-group">
                  <label className="form-label">วันที่:</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">เวลา:</label>
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

          <div className="form-section">
            <h3 className="section-title">🔄 ความถี่ในการส่ง</h3>
            
            <div className="repeat-type-selector">
              <label className="radio-option">
                <input
                  type="radio"
                  name="repeatType"
                  value="once"
                  checked={repeatType === 'once'}
                  onChange={(e) => setRepeatType(e.target.value)}
                />
                <span className="radio-label">ครั้งเดียว</span>
              </label>
              
              <label className="radio-option">
                <input
                  type="radio"
                  name="repeatType"
                  value="daily"
                  checked={repeatType === 'daily'}
                  onChange={(e) => setRepeatType(e.target.value)}
                />
                <span className="radio-label">ทุกวัน</span>
              </label>
              
              <label className="radio-option">
                <input
                  type="radio"
                  name="repeatType"
                  value="weekly"
                  checked={repeatType === 'weekly'}
                  onChange={(e) => setRepeatType(e.target.value)}
                />
                <span className="radio-label">ทุกสัปดาห์</span>
              </label>
              
              <label className="radio-option">
                <input
                  type="radio"
                  name="repeatType"
                  value="monthly"
                  checked={repeatType === 'monthly'}
                  onChange={(e) => setRepeatType(e.target.value)}
                />
                <span className="radio-label">ทุกเดือน</span>
              </label>
            </div>

            {repeatType === 'weekly' && (
              <div className="weekdays-selector">
                <label className="form-label">เลือกวันที่ต้องการส่ง:</label>
                <div className="weekdays-grid">
                  {weekDays.map(day => (
                    <button
                      key={day.id}
                      type="button"
                      className={`weekday-btn ${repeatDays.includes(day.id) ? 'active' : ''}`}
                      onClick={() => toggleWeekDay(day.id)}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {repeatType !== 'once' && (
              <div className="repeat-options">
                <div className="form-group">
                  <label className="form-label">สิ้นสุดวันที่ (ไม่บังคับ):</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={scheduleDate || new Date().toISOString().split('T')[0]}
                    className="form-input"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="schedule-preview">
            <h3 className="preview-title">📋 สรุปการตั้งเวลา</h3>
            <div className="preview-content">
              {getScheduleSummary()}
            </div>
          </div>

          <div className="action-buttons">
            <Link to="/GroupDefault" className="back-btn">
              ← กลับ
            </Link>
            <button
                onClick={saveSchedule}
                className="save-schedule-btn"
                disabled={savingSchedule}>
                <span className="btn-icon">💾</span>
                {savingSchedule ? 'กำลังบันทึก...' : (editingScheduleId ? 'บันทึกการแก้ไข' : 'บันทึกการตั้งค่า')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GroupSchedule;