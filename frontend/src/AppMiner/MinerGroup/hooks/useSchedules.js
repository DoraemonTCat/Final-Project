// MinerGroup/hooks/useSchedules.js
import { useState, useEffect } from 'react';
import { getPageDbId } from '../utils/helpers';

/**
 * useSchedules Hook
 * จัดการ state และ logic ที่เกี่ยวกับตารางเวลา
 * - โหลด schedule counts
 * - จัดการการลบ schedule
 */
export const useSchedules = (customerGroups, selectedPage) => {
  const [groupScheduleCounts, setGroupScheduleCounts] = useState({});
  const [viewingGroupSchedules, setViewingGroupSchedules] = useState([]);
  const [viewingGroupName, setViewingGroupName] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);

  // ฟังก์ชันสำหรับดึง schedules จาก localStorage (สำหรับ default groups และ user groups)
  const getLocalSchedules = (groupId) => {
    const miningSchedules = JSON.parse(localStorage.getItem(`miningSchedules_${selectedPage}`) || '[]');
    return miningSchedules.filter(schedule => 
      schedule.groups && schedule.groups.includes(groupId)
    );
  };

  // ฟังก์ชันสำหรับดึง schedules จาก database
  const getDatabaseSchedules = async (groupId) => {
  try {
    const dbId = await getPageDbId(selectedPage);
    if (!dbId) return [];
    
    // ตรวจสอบว่าเป็น knowledge group หรือไม่
    const isKnowledge = groupId && groupId.toString().startsWith('knowledge_');
    
    // ไม่ต้องแปลง format - ส่ง groupId ตรงๆ
    const searchGroupId = groupId;
    
    console.log(`Fetching schedules for group: ${searchGroupId}, isKnowledge: ${isKnowledge}`);
    
    const response = await fetch(`http://localhost:8000/message-schedules/group/${dbId}/${searchGroupId}`);
    
    if (!response.ok) {
      console.error(`Failed to fetch schedules for group ${searchGroupId}: ${response.status}`);
      return [];
    }
    
    const schedules = await response.json();
    
    // แปลงข้อมูลจาก database format เป็น frontend format
    return schedules.map(schedule => ({
      id: schedule.id,
      type: schedule.send_type === 'immediate' ? 'immediate' : 
            schedule.send_type === 'scheduled' ? 'scheduled' : 'user-inactive',
      date: schedule.scheduled_at ? new Date(schedule.scheduled_at).toISOString().split('T')[0] : null,
      time: schedule.scheduled_at ? new Date(schedule.scheduled_at).toTimeString().substr(0, 5) : null,
      inactivityPeriod: schedule.send_after_inactive ? 
        parseInt(schedule.send_after_inactive.split(' ')[0]) : null,
      inactivityUnit: schedule.send_after_inactive ? 
        schedule.send_after_inactive.split(' ')[1].replace(/s$/, '') : null,
      repeat: {
        type: schedule.frequency || 'once',
        endDate: null
      },
      groups: [groupId],
      groupId: groupId,
      isKnowledge: isKnowledge
    }));
  } catch (error) {
    console.error('Error fetching database schedules:', error);
    return [];
  }
};

  const getGroupSchedules = async (groupId) => {
    try {
      // 1. ดึงจาก localStorage ก่อน (ทั้ง default และ user groups)
      const localSchedules = getLocalSchedules(groupId);
      
      // 2. ถ้าเป็น user group และไม่มีใน localStorage ให้ดึงจาก database
      if (!groupId.toString().startsWith('default_') && localSchedules.length === 0) {
        const dbSchedules = await getDatabaseSchedules(groupId);
        return dbSchedules;
      }
      
      return localSchedules;
    } catch (error) {
      console.error('Error fetching group schedules:', error);
      return [];
    }
  };

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

  const handleViewSchedules = async (group) => {
    const schedules = await getGroupSchedules(group.id);
    setViewingGroupSchedules(schedules);
    setViewingGroupName(group.type_name || group.name);
    setShowScheduleModal(true);
  };

  const handleDeleteSchedule = async (scheduleId) => {
  if (window.confirm("คุณต้องการลบตารางเวลานี้หรือไม่?")) {
    try {
      const currentGroupId = viewingGroupSchedules[0]?.groups?.[0] || viewingGroupSchedules[0]?.groupId;
      
      // ตรวจสอบประเภทกลุ่ม
      const isKnowledge = currentGroupId && currentGroupId.toString().startsWith('knowledge_');
      const isDefault = currentGroupId && currentGroupId.toString().startsWith('default_');
      
      if (isDefault) {
        // จัดการ localStorage สำหรับ default groups
        const miningSchedules = JSON.parse(localStorage.getItem(`miningSchedules_${selectedPage}`) || '[]');
        const updatedSchedules = miningSchedules.filter(s => s.id !== scheduleId);
        localStorage.setItem(`miningSchedules_${selectedPage}`, JSON.stringify(updatedSchedules));
        
        const groupSchedules = updatedSchedules.filter(s => 
          s.groups && s.groups.includes(currentGroupId)
        );
        setViewingGroupSchedules(groupSchedules);
        
        if (groupSchedules.length === 0) {
          setShowScheduleModal(false);
        }
        
        await loadScheduleCounts();
      } else {
        // ลบจาก database สำหรับทั้ง user groups และ knowledge groups
        const response = await fetch(`http://localhost:8000/message-schedules/${scheduleId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete schedule');
        
        const schedules = await getGroupSchedules(currentGroupId);
        setViewingGroupSchedules(schedules);
        
        if (schedules.length === 0) {
          setShowScheduleModal(false);
        }
        
        await loadScheduleCounts();
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      alert('เกิดข้อผิดพลาดในการลบตารางเวลา');
    }
  }
};

  useEffect(() => {
    if (customerGroups.length > 0 && selectedPage) {
      loadScheduleCounts();
    }
  }, [customerGroups, selectedPage]);

  return {
    groupScheduleCounts,
    viewingGroupSchedules,
    viewingGroupName,
    showScheduleModal,
    setShowScheduleModal,
    handleViewSchedules,
    handleDeleteSchedule
  };
};