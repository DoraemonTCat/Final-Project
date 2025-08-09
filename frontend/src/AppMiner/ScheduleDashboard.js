import React, { useState, useEffect } from 'react';
import '../CSS/ScheduleDashboard.css';
import Sidebar from "./Sidebar";

function ScheduleDashboard() {
  const [selectedPage, setSelectedPage] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [activeSchedules, setActiveSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageDbId, setPageDbId] = useState(null);
  const [knowledgeGroupStatuses, setKnowledgeGroupStatuses] = useState({});

  // กลุ่ม Default IDs
  const DEFAULT_GROUP_IDS = ['default_1', 'default_2', 'default_3'];

  // ฟังก์ชันดึง page DB ID
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

  // ฟังก์ชันดึงสถานะของ knowledge groups
  const fetchKnowledgeGroupStatuses = async (pageId) => {
    try {
      const response = await fetch(`http://localhost:8000/page-customer-type-knowledge/${pageId}`);
      if (response.ok) {
        const knowledgeGroups = await response.json();
        const statuses = {};
        knowledgeGroups.forEach(group => {
          statuses[group.knowledge_id] = group.is_enabled !== false;
        });
        setKnowledgeGroupStatuses(statuses);
        console.log('📊 Knowledge group statuses:', statuses);
        return statuses;
      }
      return {};
    } catch (error) {
      console.error('Error fetching knowledge group statuses:', error);
      return {};
    }
  };

  // ฟังก์ชันตรวจสอบว่า knowledge group ถูกปิดหรือไม่
  const isKnowledgeGroupEnabled = (knowledgeId) => {
    const numericId = parseInt(knowledgeId.toString().replace('knowledge_', ''));
    return knowledgeGroupStatuses[numericId] !== false;
  };

  useEffect(() => {
    const savedPage = localStorage.getItem("selectedPage");
    if (savedPage) {
      setSelectedPage(savedPage);
      loadAllSchedules(savedPage);
      loadActiveSchedules(savedPage);
    }
  }, []);

  useEffect(() => {
    const handleKnowledgeGroupChange = async (event) => {
      console.log('📡 Received knowledge group status change:', event.detail);
      
      // ตรวจสอบว่าเป็น page เดียวกันหรือไม่
      if (event.detail.pageId === selectedPage) {
        const { knowledgeId, isEnabled, groupName } = event.detail;
        
        // อัพเดท local state ทันที
        setKnowledgeGroupStatuses(prev => ({
          ...prev,
          [knowledgeId]: isEnabled
        }));
        
        // แสดง notification (optional)
        console.log(`✅ กลุ่ม "${groupName}" ${isEnabled ? 'เปิด' : 'ปิด'}ใช้งานแล้ว`);
        
        // รอให้ backend อัพเดทเสร็จ แล้วโหลดข้อมูลใหม่
        setTimeout(async () => {
          await loadAllSchedules(selectedPage);
          await loadActiveSchedules(selectedPage);
        }, 300);
      }
    };

    // ลงทะเบียน event listener
    window.addEventListener('knowledgeGroupStatusChanged', handleKnowledgeGroupChange);

    // Cleanup
    return () => {
      window.removeEventListener('knowledgeGroupStatusChanged', handleKnowledgeGroupChange);
    };
  }, [selectedPage]); // Re-register เมื่อ selectedPage เปลี่ยน

  // โหลดข้อมูลเมื่อ component mount หรือเมื่อเปลี่ยน page
  useEffect(() => {
    const savedPage = localStorage.getItem("selectedPage");
    if (savedPage) {
      setSelectedPage(savedPage);
      loadAllData(savedPage);
    }
  }, []);

  // ฟังก์ชันโหลดข้อมูลทั้งหมด
  const loadAllData = async (pageId) => {
    if (pageId) {
      await fetchKnowledgeGroupStatuses(pageId);
      await loadAllSchedules(pageId);
      await loadActiveSchedules(pageId);
    }
  };

  // ฟังก์ชันโหลด active schedules
  const loadActiveSchedules = async (pageId) => {
    try {
      const response = await fetch(`http://localhost:8000/active-schedules/${pageId}`);
      if (!response.ok) throw new Error('Failed to load active schedules');
      const data = await response.json();
      const activeIds = data.active_schedules.map(s => s.id);
      setActiveSchedules(activeIds);
    } catch (error) {
      console.error('Error loading active schedules:', error);
    }
  };

  // ฟังก์ชันโหลด schedules จากทั้ง localStorage และ database
  const loadAllSchedules = async (pageId) => {
    setLoading(true);
    try {
      // ดึงสถานะ knowledge groups ล่าสุด
      const statuses = await fetchKnowledgeGroupStatuses(pageId);
      
      const response = await fetch(`http://localhost:8000/all-schedules/${pageId}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Raw schedules data:', data);
        
        if (data.schedules && data.schedules.length > 0) {
          const formattedSchedules = data.schedules.map(group => {
            const firstSchedule = group.schedules[0] || {};
            
            const inactivityPeriod = extractInactivityPeriod(firstSchedule.send_after_inactive);
            const inactivityUnit = extractInactivityUnit(firstSchedule.send_after_inactive);
            
            return {
              id: `${group.group_type}_${group.group_id}_${firstSchedule.send_type}`,
              type: convertScheduleType(firstSchedule.send_type),
              groups: [group.group_id],
              groupNames: [group.group_name],
              groupType: group.group_type,
              messages: group.messages.sort((a, b) => a.order - b.order),
              messageCount: group.messages.length,
              date: firstSchedule.scheduled_at ? 
                new Date(firstSchedule.scheduled_at).toISOString().split('T')[0] : null,
              time: firstSchedule.scheduled_at ? 
                new Date(firstSchedule.scheduled_at).toTimeString().slice(0, 5) : null,
              inactivityPeriod: inactivityPeriod,
              inactivityUnit: inactivityUnit,
              repeat: {
                type: firstSchedule.frequency || 'once',
                endDate: null
              },
              createdAt: firstSchedule.created_at,
              updatedAt: firstSchedule.updated_at,
              source: 'database',
              dbScheduleIds: group.all_schedule_ids || [],
              isKnowledge: group.group_type === 'knowledge',
              isUserCreated: group.group_type === 'user_created',
              scheduleCount: group.schedule_count || 1
            };
          });
          
          // 🔥 กรอง schedules ของ knowledge groups ที่ถูกปิด
          const filteredSchedules = formattedSchedules.filter(schedule => {
            if (schedule.isKnowledge) {
              const knowledgeId = schedule.groups[0];
              const numericId = parseInt(knowledgeId.toString().replace('knowledge_', ''));
              const isEnabled = statuses[numericId] !== false;
              
              if (!isEnabled) {
                console.log(`🚫 Hiding disabled knowledge group schedule: ${schedule.groupNames[0]}`);
                return false;
              }
            }
            return true;
          });
          
          console.log(`✅ Showing ${filteredSchedules.length} of ${formattedSchedules.length} schedules`);
          setSchedules(filteredSchedules);
          return;
        }
      }
      
      // Fallback method
      console.log('Using fallback method...');
      const dbId = await getPageDbId(pageId);
      setPageDbId(dbId);
      
      const localSchedules = loadLocalSchedules(pageId);
      const dbSchedules = await loadDatabaseSchedules(dbId);
      const allSchedules = [...localSchedules, ...dbSchedules];
      
      // กรอง schedules ตาม statuses
      const filteredSchedules = allSchedules.filter(schedule => {
        if (schedule.isKnowledge) {
          const knowledgeId = schedule.groups[0] || schedule.groupId;
          const numericId = parseInt(knowledgeId.toString().replace('knowledge_', ''));
          return statuses[numericId] !== false;
        }
        return true;
      });
      
      // กรองให้เหลือ schedule เดียวต่อกลุ่ม
      const uniqueSchedules = [];
      const seenGroups = new Set();
      
      filteredSchedules.forEach(schedule => {
        const groupKey = schedule.groups.join(',');
        if (!seenGroups.has(groupKey)) {
          seenGroups.add(groupKey);
          uniqueSchedules.push(schedule);
        }
      });
      
      setSchedules(uniqueSchedules);
      
    } catch (error) {
      console.error('Error loading schedules:', error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  // โหลด schedules จาก localStorage สำหรับ default groups
  const loadLocalSchedules = (pageId) => {
    const key = `miningSchedules_${pageId}`;
    const savedSchedules = JSON.parse(localStorage.getItem(key) || '[]');

    // กรองเฉพาะ default groups
    const defaultSchedules = savedSchedules.filter(sch =>
      sch.groups?.some(gid => DEFAULT_GROUP_IDS.includes(gid))
    );

    // เพิ่มชื่อกลุ่ม
    return defaultSchedules.map(schedule => {
      const groupNames = schedule.groups.map(groupId => {
        if (groupId === 'default_1') return 'กลุ่มคนหาย';
        if (groupId === 'default_2') return 'กลุ่มคนหายนาน';
        if (groupId === 'default_3') return 'กลุ่มคนหายนานมาก';
        return 'ไม่ระบุ';
      });

      return {
        ...schedule,
        groupNames,
        source: 'localStorage'
      };
    });
  };

  // โหลด schedules จาก database สำหรับ user groups
  const loadDatabaseSchedules = async (dbId) => {
  if (!dbId) return [];

  try {
    // 1. ดึงกลุ่มทั้งหมดของ page (รวม knowledge groups)
    const groupsResponse = await fetch(`http://localhost:8000/customer-groups/${dbId}`);
    const knowledgeResponse = await fetch(`http://localhost:8000/page-customer-type-knowledge/${selectedPage}`);
    
    let allGroups = [];
    
    // เพิ่ม user groups
    if (groupsResponse.ok) {
      const userGroups = await groupsResponse.json();
      allGroups = [...userGroups];
    }
    
    // เพิ่ม knowledge groups
    if (knowledgeResponse.ok) {
      const knowledgeGroups = await knowledgeResponse.json();
      const formattedKnowledgeGroups = knowledgeGroups
        .filter(kg => kg.is_enabled !== false)
        .map(kg => ({
          id: `knowledge_${kg.knowledge_id}`,
          type_name: kg.type_name,
          isKnowledge: true
        }));
      allGroups = [...allGroups, ...formattedKnowledgeGroups];
    }

    // 2. ดึง schedules ของแต่ละกลุ่ม
    const allSchedules = [];
    
    for (const group of allGroups) {
      try {
        // สร้าง group ID สำหรับค้นหา schedules
        const searchGroupId = group.isKnowledge ? 
          `group_knowledge_${group.id.replace('knowledge_', '')}` : 
          group.id;
        
        const schedulesResponse = await fetch(`http://localhost:8000/message-schedules/group/${dbId}/${searchGroupId}`);
        if (schedulesResponse.ok) {
          const groupSchedules = await schedulesResponse.json();
          
          if (groupSchedules.length > 0) {
            const firstSchedule = groupSchedules[0];
            
            // ดึงข้อความของกลุ่ม
            let messages = [];
            let messageCount = 0;
            
            if (group.isKnowledge) {
              const knowledgeId = group.id.replace('knowledge_', '');
              const messagesResponse = await fetch(`http://localhost:8000/knowledge-group-messages/${selectedPage}/${knowledgeId}`);
              if (messagesResponse.ok) {
                messages = await messagesResponse.json();
                messageCount = messages.length;
              }
            } else {
              const messagesResponse = await fetch(`http://localhost:8000/group-messages/${dbId}/${group.id}`);
              if (messagesResponse.ok) {
                messages = await messagesResponse.json();
                messageCount = messages.length;
              }
            }
            
            // แปลงรูปแบบข้อมูล
            const formattedSchedule = {
              id: `group_${searchGroupId}`,
              type: convertScheduleType(firstSchedule.send_type),
              groups: [group.id],
              groupNames: [group.type_name],
              messages: messages.map(msg => ({
                type: msg.message_type,
                content: msg.content,
                order: msg.display_order
              })),
              messageCount: messageCount,
              date: firstSchedule.scheduled_at ? new Date(firstSchedule.scheduled_at).toISOString().split('T')[0] : null,
              time: firstSchedule.scheduled_at ? new Date(firstSchedule.scheduled_at).toTimeString().slice(0, 5) : null,
              inactivityPeriod: extractInactivityPeriod(firstSchedule.send_after_inactive),
              inactivityUnit: extractInactivityUnit(firstSchedule.send_after_inactive),
              repeat: {
                type: firstSchedule.frequency || 'once',
                endDate: null
              },
              createdAt: firstSchedule.created_at,
              updatedAt: firstSchedule.updated_at,
              source: 'database',
              dbScheduleIds: groupSchedules.map(s => s.id),
              groupId: group.id,
              isKnowledge: group.isKnowledge || false
            };
            
            allSchedules.push(formattedSchedule);
          }
        }
      } catch (error) {
        console.error(`Error loading schedules for group ${group.id}:`, error);
      }
    }

    return allSchedules;
  } catch (error) {
    console.error('Error loading database schedules:', error);
    return [];
  }
};

  // แปลง schedule type จาก database เป็น frontend format
  const convertScheduleType = (dbType) => {
    const typeMap = {
      'immediate': 'immediate',
      'scheduled': 'scheduled',
      'after_inactive': 'user-inactive'
    };
    return typeMap[dbType] || dbType;
  };

  // ดึงตัวเลขจาก send_after_inactive string
  const extractInactivityPeriod = (sendAfterInactive) => {
  if (!sendAfterInactive) return '0';
  
  // ถ้าเป็น string format "X days" หรือ "X hours" etc.
  const match = sendAfterInactive.match(/(\d+)\s+(\w+)/);
  if (match) {
    return match[1]; // คืนค่าตัวเลข
  }
  
  // ถ้าเป็น format เก่า (timedelta string)
  const oldMatch = sendAfterInactive.match(/(\d+)/);
  return oldMatch ? oldMatch[1] : '0';
};

  // ดึงหน่วยเวลาจาก send_after_inactive string
  const extractInactivityUnit = (sendAfterInactive) => {
  if (!sendAfterInactive) return 'days';
  
  // ถ้าเป็น string format "X days" หรือ "X hours" etc.
  const match = sendAfterInactive.match(/(\d+)\s+(\w+)/);
  if (match) {
    return match[2]; // คืนค่าหน่วย (days, hours, minutes, etc.)
  }
  
  // ถ้าเป็น format เก่า ให้พยายามหาหน่วย
  if (sendAfterInactive.includes('minute')) return 'minutes';
  if (sendAfterInactive.includes('hour')) return 'hours';
  if (sendAfterInactive.includes('day')) return 'days';
  if (sendAfterInactive.includes('week')) return 'weeks';
  if (sendAfterInactive.includes('month')) return 'months';
  
  return 'days'; // default
};

 

  const getScheduleStatus = (schedule) => {
    const isActive = activeSchedules.includes(schedule.id);

    if (schedule.type === 'immediate') return 'ส่งข้อความแล้ว';
    if (schedule.type === 'user-inactive') return isActive ? 'กำลังทำงาน' : 'หยุดชั่วคราว';
    if (schedule.type === 'scheduled') {
      const scheduleTime = new Date(`${schedule.date}T${schedule.time}`);
      if (scheduleTime > new Date()) return isActive ? 'กำลังทำงาน' : 'หยุดชั่วคราว';
      return 'ส่งข้อความแล้ว';
    }
    return 'ไม่ทราบสถานะ';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ส่งแล้ว': return '#48bb78';
      case 'กำลังทำงาน': return '#4299e1';
      case 'รอส่ง': return '#ed8936';
      case 'หยุดชั่วคราว': return '#e53e3e';
      default: return '#718096';
    }
  };

  const toggleScheduleStatus = async (schedule) => {
    const status = getScheduleStatus(schedule);

    try {
      if (status === 'กำลังทำงาน') {
        const response = await fetch('http://localhost:8000/schedule/deactivate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            page_id: selectedPage,
            schedule_id: schedule.id
          })
        });

        
      } else {
        const response = await fetch('http://localhost:8000/schedule/activate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            page_id: selectedPage,
            schedule: {
              ...schedule,
              pageId: selectedPage
            }
          })
        });

      }

      await loadActiveSchedules(selectedPage);

    } catch (error) {
      console.error('Error toggling schedule:', error);
      alert("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
    }
  };

  const viewScheduleDetails = (schedule) => {
    setSelectedSchedule(schedule);
    setShowDetailModal(true);
  };

  const getScheduleDescription = (schedule) => {
  if (schedule.type === 'immediate') return 'ส่งทันที';
  
  if (schedule.type === 'scheduled') {
    const date = schedule.date ? new Date(schedule.date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : 'ไม่ระบุวันที่';
    const time = schedule.time || 'ไม่ระบุเวลา';
    return `${date} เวลา ${time} น.`;
  }
  
  if (schedule.type === 'user-inactive') {
    const period = schedule.inactivityPeriod || '0';
    const unit = schedule.inactivityUnit || 'days';
    
    // แปลงหน่วยเป็นภาษาไทย
    const unitText = 
      unit === 'minutes' ? 'นาที' :
      unit === 'hours' ? 'ชั่วโมง' :
      unit === 'days' ? 'วัน' :
      unit === 'weeks' ? 'สัปดาห์' :
      unit === 'months' ? 'เดือน' : unit;
    
    // ถ้าเป็น 0 ให้แสดงข้อความพิเศษ
    if (period === '0' || period === 0) {
      return 'ไม่ได้ตั้งเวลา';
    }
    
    return `${period} ${unitText}`;
  }
  
  return '-';
};

  const deleteSchedule = async (schedule) => {
  if (!window.confirm('คุณต้องการลบตารางเวลานี้หรือไม่?')) return;

  try {
    if (schedule.source === 'database') {
      // ลบ schedules ทั้งหมดที่เกี่ยวข้องกับกลุ่มนี้
      if (schedule.dbScheduleIds && schedule.dbScheduleIds.length > 0) {
        console.log(`🗑️ Deleting ${schedule.dbScheduleIds.length} schedules`);
        
        for (const scheduleId of schedule.dbScheduleIds) {
          const response = await fetch(`http://localhost:8000/message-schedules/${scheduleId}`, {
            method: 'DELETE'
          });
          
          if (!response.ok) {
            console.error(`Failed to delete schedule ${scheduleId}`);
          }
        }
        
        console.log('✅ All related schedules deleted');
      }
    } else {
      // ลบจาก localStorage
      const key = `miningSchedules_${selectedPage}`;
      const savedSchedules = JSON.parse(localStorage.getItem(key) || '[]');
      const updatedSchedules = savedSchedules.filter(s => s.id !== schedule.id);
      localStorage.setItem(key, JSON.stringify(updatedSchedules));
    }

    await loadAllSchedules(selectedPage);
    alert('ลบตารางเวลาสำเร็จ!');
  } catch (error) {
    console.error('Error deleting schedule:', error);
    alert('เกิดข้อผิดพลาดในการลบตารางเวลา');
  }
};

  const goToMinerGroup = () => {
    window.location.href = '/MinerGroup';
  };

  const goBack = () => {
    window.location.href = '/MinerGroup';
  };

  const isDefaultGroup = (groupIds) => {
    return groupIds.some(id => DEFAULT_GROUP_IDS.includes(id));
  };

  // คำนวณจำนวนข้อความสำหรับ schedule
  const getMessageCount = (schedule) => {
    if (schedule.messages && Array.isArray(schedule.messages)) {
      return schedule.messages.length;
    }
    // สำหรับ database schedules ที่อาจไม่มีข้อความ
    return schedule.messageCount || 0;
  };

  // เพิ่มฟังก์ชันตรวจสอบ knowledge group
  const isKnowledgeGroup = (groupId) => {
    return groupId && (groupId.toString().startsWith('knowledge_') || groupId.toString().includes('knowledge'));
  };

  return (
    <div className="app-container">
      <Sidebar />

      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1 className="dashboard-title">
            <span className="title-icon">📊</span>
            Dashboard การส่งข้อความ
          </h1>
          
        </div>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-info">
              <div className="stat-value">{schedules.length}</div>
              <div className="stat-label">ตารางเวลาทั้งหมด</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <div className="stat-value">
                {schedules.filter(s => getScheduleStatus(s) === 'ส่งแล้ว').length}
              </div>
              <div className="stat-label">ส่งแล้ว</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-info">
              <div className="stat-value">
                {schedules.filter(s => getScheduleStatus(s) === 'กำลังทำงาน').length}
              </div>
              <div className="stat-label">กำลังทำงาน</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">⏸️</div>
            <div className="stat-info">
              <div className="stat-value">
                {schedules.filter(s => getScheduleStatus(s) === 'หยุดชั่วคราว').length}
              </div>
              <div className="stat-label">หยุดชั่วคราว</div>
            </div>
          </div>
        </div>

        <div className="schedules-table">
          <h2>รายการตารางเวลา</h2>
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>กำลังโหลดข้อมูล...</p>
            </div>
          ) : schedules.length === 0 ? (
            <div className="empty-table">
              <p>ยังไม่มีตารางเวลาสำหรับเพจนี้</p>
              <button onClick={goToMinerGroup} className="create-link">
                สร้างตารางเวลาใหม่
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th >ชื่อกลุ่ม</th>
                  <th style={{paddingLeft:"30px"}}>ประเภท</th>
                  <th>เงื่อนไข</th>
                  <th>จำนวนข้อความ</th>
                  
                  <th style={{paddingLeft:"40px"}}>สถานะ</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule, index) => {
                  const status = getScheduleStatus(schedule);
                  const isDefault = isDefaultGroup(schedule.groups || []);
                  const isKnowledge = schedule.isKnowledge || isKnowledgeGroup(schedule.groupId);
                  
                  return (
                    <tr key={`${schedule.source}-${schedule.id}`} className={isKnowledge ? 'knowledge-schedule-row' : isDefault ? 'default-schedule-row' : ''}>
                      <td>
                        <div className="group-names-cell">
                          {schedule.groupNames?.join(', ') || 'ไม่ระบุ'}
                          {isKnowledge && (
                            <span className="knowledge-badge-small">พื้นฐาน</span>
                          )}
                          {isDefault && !isKnowledge && (
                            <span className="default-badge-small">พื้นฐาน</span>
                          )}
                        </div>
                      </td>
                      <td >
                        {schedule.type === 'immediate' && '⚡ ส่งทันที'}
                        {schedule.type === 'scheduled' && '📅 ตามเวลา'}
                        {schedule.type === 'user-inactive' && '🕰️ User หาย'}
                      </td>
                      <td>{getScheduleDescription(schedule)}</td>
                      <td style={{paddingLeft:"60px"}}>{getMessageCount(schedule) || schedule.messageCount || 0}</td>
                      
                      <td>
                        <span 
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(status) }}
                        >
                          {status}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="action-btn view-btn"
                          onClick={() => viewScheduleDetails(schedule)}
                        >
                          👁️ ดู
                        </button>
                        {status !== 'ส่งแล้ว' && (
                          <button 
                            className="action-btn toggle-btn"
                            onClick={() => toggleScheduleStatus(schedule)}
                          >
                            {status === 'กำลังทำงาน' ? '⏸️ หยุด' : '▶️ เริ่ม'}
                          </button>
                        )}
                        <button 
                          className="action-btn delete-btn"
                          onClick={() => deleteSchedule(schedule)}
                        >
                          🗑️ ลบ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* Modal แสดงรายละเอียด */}
      {showDetailModal && selectedSchedule && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 รายละเอียดตารางเวลา</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>✖</button>
            </div>
            
            <div className="modal-body">
              <div className="detail-section">
                <h4>ข้อมูลทั่วไป</h4>
                <p><strong>กลุ่ม:</strong> {selectedSchedule.groupNames?.join(', ') || 'ไม่ระบุ'}
                  {selectedSchedule.isKnowledge && (
                    <span className="knowledge-badge-small" style={{ marginLeft: '8px' }}>พื้นฐาน</span>
                  )}
                </p>
                <p><strong>ประเภท:</strong> {
                  selectedSchedule.type === 'immediate' ? 'ส่งทันที' :
                  selectedSchedule.type === 'scheduled' ? 'ตามเวลา' : 'User หายไป'
                }</p>
                <p><strong>เงื่อนไข:</strong> {getScheduleDescription(selectedSchedule)}</p>
                
                {selectedSchedule.repeat && selectedSchedule.repeat.type !== 'once' && (
                  <p><strong>ทำซ้ำ:</strong> {
                    selectedSchedule.repeat.type === 'daily' ? 'ทุกวัน' :
                    selectedSchedule.repeat.type === 'weekly' ? 'ทุกสัปดาห์' : 'ทุกเดือน'
                  }</p>
                )}
              </div>

              <div className="detail-section">
                <h4>ข้อความในกลุ่ม ({getMessageCount(selectedSchedule)} ข้อความ)</h4>
                <div className="messages-list">
                  {selectedSchedule.messages && selectedSchedule.messages.length > 0 ? (
                    selectedSchedule.messages.map((msg, idx) => (
                      <div key={idx} className="message-item">
                        <span className="message-number">{idx + 1}.</span>
                        <span className="message-type">
                          {msg.type === 'text' ? '💬' : msg.type === 'image' ? '🖼️' : '📹'}
                        </span>
                        <span className="message-content">
                          {msg.type === 'text' ? msg.content : `[${msg.type.toUpperCase()}] ${msg.content}`}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#718096', fontStyle: 'italic' }}>ไม่มีข้อมูลข้อความ</p>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h4>สถานะและการตั้งค่า</h4>
                <p><strong>สถานะปัจจุบัน:</strong> 
                  <span style={{ 
                    color: getStatusColor(getScheduleStatus(selectedSchedule)),
                    fontWeight: 'bold',
                    marginLeft: '8px'
                  }}>
                    {getScheduleStatus(selectedSchedule)}
                  </span>
                </p>
                <p><strong>จำนวน Schedule IDs:</strong> {selectedSchedule.dbScheduleIds?.length || 0} รายการ</p>
                <p><strong>สร้างเมื่อ:</strong> {new Date(selectedSchedule.createdAt || Date.now()).toLocaleString('th-TH')}</p>
                {selectedSchedule.updatedAt && (
                  <p><strong>แก้ไขล่าสุด:</strong> {new Date(selectedSchedule.updatedAt).toLocaleString('th-TH')}</p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-btn" onClick={() => setShowDetailModal(false)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .source-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .source-badge.database {
          background: #e6f3ff;
          color: #2b6cb0;
        }
        
        .source-badge.localStorage {
          background: #fef3c7;
          color: #92400e;
        }
        
        .action-btn.delete-btn {
          background: #fee;
          color: #e53e3e;
          border: 1px solid #fc8181;
        }
        
        .action-btn.delete-btn:hover {
          background: #fed7d7;
        }
        
        .loading-state {
          text-align: center;
          padding: 60px 20px;
        }
        
        .loading-spinner {
          display: inline-block;
          width: 40px;
          height: 40px;
          border: 4px solid #f3f4f6;
          border-top: 4px solid #4299e1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default ScheduleDashboard;