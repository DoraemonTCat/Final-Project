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

  useEffect(() => {
    if (customerGroups.length > 0) {
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