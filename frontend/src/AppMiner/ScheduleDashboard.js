import React, { useState, useEffect, useMemo } from 'react';
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
  const [showKnowledgeGroups, setShowKnowledgeGroups] = useState(true);
  const [showUserGroups, setShowUserGroups] = useState(true);
  const [draggedSchedule, setDraggedSchedule] = useState(null);
  const [dragOverSchedule, setDragOverSchedule] = useState(null);
  
  // 🆕 States สำหรับการค้นหาและกรอง
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // กลุ่ม Default IDs
  const DEFAULT_GROUP_IDS = ['default_1', 'default_2', 'default_3'];

  // ฟังชันค์รับ event เปลี่ยนหน้า
  useEffect(() => {
  const handlePageChange = (event) => {
    const newPageId = event.detail.pageId;
    setSelectedPage(newPageId);
    localStorage.setItem("selectedPage", newPageId);
    loadAllData(newPageId);
  };

  window.addEventListener('pageChanged', handlePageChange);

  return () => {
    window.removeEventListener('pageChanged', handlePageChange);
  };
}, []);
  
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
        return statuses;
      }
      return {};
    } catch (error) {
      console.error('Error fetching knowledge group statuses:', error);
      return {};
    }
  };

  // useEffect ที่โหลดข้อมูลตอน mount
  useEffect(() => {
    const savedPage = localStorage.getItem("selectedPage");
    if (savedPage && savedPage !== selectedPage) {
      setSelectedPage(savedPage);
      loadAllData(savedPage);
    } else if (savedPage) {
      loadAllData(savedPage);
    }
  }, []);

  useEffect(() => {
    const handleKnowledgeGroupChange = async (event) => {
      if (event.detail.pageId === selectedPage) {
        const { knowledgeId, isEnabled } = event.detail;
        
        setKnowledgeGroupStatuses(prev => ({
          ...prev,
          [knowledgeId]: isEnabled
        }));
        
        setTimeout(async () => {
          await loadAllSchedules(selectedPage);
          await loadActiveSchedules(selectedPage);
        }, 300);
      }
    };

    window.addEventListener('knowledgeGroupStatusChanged', handleKnowledgeGroupChange);
    return () => {
      window.removeEventListener('knowledgeGroupStatusChanged', handleKnowledgeGroupChange);
    };
  }, [selectedPage]);

  // โหลดข้อมูลทั้งหมด
  const loadAllData = async (pageId) => {
    if (pageId) {
      await fetchKnowledgeGroupStatuses(pageId);
      await loadAllSchedules(pageId);
      await loadActiveSchedules(pageId);
    }
  };

  // โหลด active schedules
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

  // โหลด schedules ทั้งหมด (ฟังก์ชันยาวมาก ตัดให้สั้นลง)
  const loadAllSchedules = async (pageId) => {
    setLoading(true);
    try {
      const statuses = await fetchKnowledgeGroupStatuses(pageId);
      const response = await fetch(`http://localhost:8000/all-schedules/${pageId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.schedules && data.schedules.length > 0) {
          const formattedSchedules = data.schedules.map(group => {
            const firstSchedule = group.schedules[0] || {};
            
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
              inactivityPeriod: extractInactivityPeriod(firstSchedule.send_after_inactive),
              inactivityUnit: extractInactivityUnit(firstSchedule.send_after_inactive),
              repeat: {
                type: firstSchedule.frequency || 'once',
                endDate: null
              },
              createdAt: firstSchedule.created_at,
              updatedAt: firstSchedule.updated_at,
              source: 'database',
              dbScheduleIds: group.all_schedule_ids || [],
              isKnowledge: group.group_type === 'knowledge',
              isUserCreated: group.group_type === 'user_created'
            };
          });
          
          const filteredSchedules = formattedSchedules.filter(schedule => {
            if (schedule.isKnowledge) {
              const knowledgeId = schedule.groups[0];
              const numericId = parseInt(knowledgeId.toString().replace('knowledge_', ''));
              return statuses[numericId] !== false;
            }
            return true;
          });
          
          setSchedules(filteredSchedules);
        }
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const convertScheduleType = (dbType) => {
    const typeMap = {
      'immediate': 'immediate',
      'scheduled': 'scheduled',
      'after_inactive': 'user-inactive'
    };
    return typeMap[dbType] || dbType;
  };

  const extractInactivityPeriod = (sendAfterInactive) => {
    if (!sendAfterInactive) return '0';
    const match = sendAfterInactive.match(/(\d+)\s+(\w+)/);
    return match ? match[1] : '0';
  };

  const extractInactivityUnit = (sendAfterInactive) => {
    if (!sendAfterInactive) return 'days';
    const match = sendAfterInactive.match(/(\d+)\s+(\w+)/);
    if (match) return match[2];
    
    if (sendAfterInactive.includes('minute')) return 'minutes';
    if (sendAfterInactive.includes('hour')) return 'hours';
    if (sendAfterInactive.includes('day')) return 'days';
    if (sendAfterInactive.includes('week')) return 'weeks';
    if (sendAfterInactive.includes('month')) return 'months';
    
    return 'days';
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
        await fetch('http://localhost:8000/schedule/deactivate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page_id: selectedPage, schedule_id: schedule.id })
        });
      } else {
        await fetch('http://localhost:8000/schedule/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            page_id: selectedPage,
            schedule: { ...schedule, pageId: selectedPage }
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
      
      const unitText = 
        unit === 'minutes' ? 'นาที' :
        unit === 'hours' ? 'ชั่วโมง' :
        unit === 'days' ? 'วัน' :
        unit === 'weeks' ? 'สัปดาห์' :
        unit === 'months' ? 'เดือน' : unit;
      
      return period === '0' || period === 0 ? 'ไม่ได้ตั้งเวลา' : `${period} ${unitText}`;
    }
    
    return '-';
  };

  // 🆕 Filter และ Sort schedules
  const processedSchedules = useMemo(() => {
    let filtered = [...schedules];

    // ค้นหาด้วยชื่อกลุ่ม
    if (searchTerm) {
      filtered = filtered.filter(schedule => 
        schedule.groupNames?.some(name => 
          name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // กรองตามประเภท
    if (filterType !== 'all') {
      filtered = filtered.filter(schedule => schedule.type === filterType);
    }

    // กรองตามสถานะ
    if (filterStatus !== 'all') {
      filtered = filtered.filter(schedule => {
        const status = getScheduleStatus(schedule);
        return filterStatus === 'active' ? status === 'กำลังทำงาน' :
               filterStatus === 'paused' ? status === 'หยุดชั่วคราว' :
               filterStatus === 'sent' ? status === 'ส่งข้อความแล้ว' : true;
      });
    }

    // เรียงลำดับ
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.groupNames?.[0] || '').localeCompare(b.groupNames?.[0] || '');
        case 'type':
          return a.type.localeCompare(b.type);
        case 'status':
          return getScheduleStatus(a).localeCompare(getScheduleStatus(b));
        case 'messages':
          return b.messageCount - a.messageCount;
        default:
          return 0;
      }
    });

    return filtered;
  }, [schedules, searchTerm, filterType, filterStatus, sortBy]);

  // แยก schedules ตามประเภท
  const categorizedSchedules = useMemo(() => {
    const knowledge = [];
    const user = [];
    
    processedSchedules.forEach(schedule => {
      if (schedule.isKnowledge || 
          (schedule.groupId && schedule.groupId.toString().includes('knowledge')) ||
          (schedule.groups && schedule.groups[0] && schedule.groups[0].toString().includes('knowledge'))) {
        knowledge.push(schedule);
      } else {
        user.push(schedule);
      }
    });
    
    return { knowledge, user };
  }, [processedSchedules]);

  // 🆕 Render Grid View
  const renderGridView = (scheduleList, groupType) => {
    return (
      <div className="schedules-grid">
        {scheduleList.map(schedule => {
          const status = getScheduleStatus(schedule);
          return (
            <div key={schedule.id} className="schedule-card">
              <div className="card-header">
                <h4>{schedule.groupNames?.join(', ')}</h4>
                {groupType === 'knowledge' && (
                  <span className="knowledge-badge-small">พื้นฐาน</span>
                )}
              </div>
              
              <div className="card-body">
                <div className="card-info">
                  <span className="info-label">ประเภท:</span>
                  <span className="info-value">
                    {schedule.type === 'immediate' && '⚡ ส่งทันที'}
                    {schedule.type === 'scheduled' && '📅 ตามเวลา'}
                    {schedule.type === 'user-inactive' && '🕰️ User หาย'}
                  </span>
                </div>
                
                <div className="card-info">
                  <span className="info-label">เงื่อนไข:</span>
                  <span className="info-value">{getScheduleDescription(schedule)}</span>
                </div>
                
                <div className="card-info">
                  <span className="info-label">ข้อความ:</span>
                  <span className="info-value">{schedule.messageCount} ข้อความ</span>
                </div>
                
                <div className="card-status">
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(status) }}
                  >
                    {status}
                  </span>
                </div>
              </div>
              
              <div className="card-footer">
                <button 
                  className="card-btn view-btn"
                  onClick={() => viewScheduleDetails(schedule)}
                >
                  ดูรายละเอียด
                </button>
                {status !== 'ส่งข้อความแล้ว' && (
                  <button 
                    className="card-btn toggle-btn"
                    onClick={() => toggleScheduleStatus(schedule)}
                  >
                    {status === 'กำลังทำงาน' ? 'หยุด' : 'เริ่ม'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
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

        {/* 🆕 Search and Filter Bar */}
        <div className="search-filter-bar">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder=" ค้นหาชื่อกลุ่ม..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input" style={{paddingLeft: '45px'}}
            />
            {searchTerm && (
              <button 
                className="clear-search"
                onClick={() => setSearchTerm('')}
              >
                ✕
              </button>
            )}
          </div>

          <div className="filter-controls">
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="filter-select"
            >
              <option value="all">ทุกประเภท</option>
              <option value="immediate">⚡ ส่งทันที</option>
              <option value="scheduled">📅 ตามเวลา</option>
              <option value="user-inactive">🕰️ User หาย</option>
            </select>

            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="active">✅ กำลังทำงาน</option>
              <option value="paused">⏸️ หยุดชั่วคราว</option>
              <option value="sent">📨 ส่งแล้ว</option>
            </select>

            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="name">เรียงตามชื่อ</option>
              <option value="type">เรียงตามประเภท</option>
              <option value="status">เรียงตามสถานะ</option>
              <option value="messages">เรียงตามจำนวนข้อความ</option>
            </select>


          </div>
        </div>

        {/* 🆕 Quick Stats */}
        <div className="quick-stats">
          <div className="stat-pill">
            <span className="stat-icon">📊</span>
            <span className="stat-text">ทั้งหมด: {processedSchedules.length}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-icon">📚</span>
            <span className="stat-text">กลุ่มพื้นฐาน: {categorizedSchedules.knowledge.length}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-icon">👥</span>
            <span className="stat-text">User สร้าง: {categorizedSchedules.user.length}</span>
          </div>
          <div className="stat-pill active">
            <span className="stat-icon">✅</span>
            <span className="stat-text">
              กำลังทำงาน: {processedSchedules.filter(s => getScheduleStatus(s) === 'กำลังทำงาน').length}
            </span>
          </div>
        </div>

        {/* Results Summary */}
        {searchTerm && (
          <div className="search-results-summary">
            พบ {processedSchedules.length} รายการที่ตรงกับ "{searchTerm}"
          </div>
        )}

        {/* Main Content */}
        <div className="schedules-container">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>กำลังโหลดข้อมูล...</p>
            </div>
          ) : processedSchedules.length === 0 ? (
            <div className="empty-state">
              <p>ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา</p>
             
            </div>
          ) : (
            <>
              {/* Knowledge Groups Section */}
              {categorizedSchedules.knowledge.length > 0 && (
                <div className="schedule-section knowledge-section">
                  <div 
                    className="section-header"
                    style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                    onClick={() => setShowKnowledgeGroups(!showKnowledgeGroups)}
                  >
                    <h3>
                      <span className="collapse-icon">
                        {showKnowledgeGroups ? '▼' : '▶'}
                      </span>
                      📚 กลุ่มพื้นฐาน
                      <span className="badge">{categorizedSchedules.knowledge.length}</span>
                    </h3>
                  </div>
                  {showKnowledgeGroups && (
                    <div className="section-content">
                      {renderGridView(categorizedSchedules.knowledge, 'knowledge')}
                    </div>
                  )}
                </div>
              )}

              {/* User Groups Section */}
              {categorizedSchedules.user.length > 0 && (
                <div className="schedule-section user-section">
                  <div 
                    className="section-header"
                    style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}
                    onClick={() => setShowUserGroups(!showUserGroups)}
                  >
                    <h3>
                      <span className="collapse-icon">
                        {showUserGroups ? '▼' : '▶'}
                      </span>
                      👥 กลุ่ม User สร้าง
                      <span className="badge">{categorizedSchedules.user.length}</span>
                    </h3>
                  </div>
                  {showUserGroups && (
                    <div className="section-content">
                      {renderGridView(categorizedSchedules.user, 'user')}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail Modal */}
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
                <p><strong>กลุ่ม:</strong> {selectedSchedule.groupNames?.join(', ')}
                  {selectedSchedule.isKnowledge && (
                    <span className="knowledge-badge-small" style={{ marginLeft: '8px' }}>พื้นฐาน</span>
                  )}
                </p>
                <p><strong>ประเภท:</strong> {
                  selectedSchedule.type === 'immediate' ? 'ส่งทันที' :
                  selectedSchedule.type === 'scheduled' ? 'ตามเวลา' : 'User หายไป'
                }</p>
                <p><strong>เงื่อนไข:</strong> {getScheduleDescription(selectedSchedule)}</p>
              </div>

              <div className="detail-section">
                <h4>ข้อความในกลุ่ม ({selectedSchedule.messageCount} ข้อความ)</h4>
                <div className="messages-list">
                  {selectedSchedule.messages?.map((msg, idx) => (
                    <div key={idx} className="message-item">
                      <span className="message-number">{idx + 1}.</span>
                      <span className="message-type">
                        {msg.type === 'text' ? '💬' : msg.type === 'image' ? '🖼️' : '📹'}
                      </span>
                      <span className="message-content">
                        {msg.type === 'text' ? msg.content : `[${msg.type.toUpperCase()}] ${msg.content}`}
                      </span>
                    </div>
                  ))}
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
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-btn" onClick={() => setShowDetailModal(false)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default ScheduleDashboard;