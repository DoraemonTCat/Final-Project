// frontend/src/AppMiner/MinerGroup/hooks/useSchedules.js
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
      
      const isKnowledge = groupId && groupId.toString().startsWith('knowledge_');
      const searchGroupId = isKnowledge ? 
        `group_knowledge_${groupId.replace('knowledge_', '')}` : 
        groupId;
      
      console.log(`Fetching schedules for group: ${searchGroupId}, isKnowledge: ${isKnowledge}`);
      
      const response = await fetch(`http://localhost:8000/message-schedules/group/${dbId}/${searchGroupId}`);
      
      if (!response.ok) {
        console.error(`Failed to fetch schedules for group ${searchGroupId}: ${response.status}`);
        return [];
      }
      
      const schedules = await response.json();
      console.log('Raw schedules from DB:', schedules);
      
      // แปลงข้อมูลจาก database format เป็น frontend format
      return schedules.map(schedule => {
        // แปลง send_after_inactive เป็นข้อความที่อ่านง่าย
        let inactivityDescription = '';
        if (schedule.send_after_inactive) {
          const parts = schedule.send_after_inactive.split(' ');
          if (parts.length >= 2) {
            const value = parts[0];
            const unit = parts[1];
            
            // แปลงหน่วยเป็นภาษาไทย
            const unitInThai = 
              unit.includes('minute') ? 'นาที' :
              unit.includes('hour') ? 'ชั่วโมง' :
              unit.includes('day') ? 'วัน' :
              unit.includes('week') ? 'สัปดาห์' :
              unit.includes('month') ? 'เดือน' : unit;
            
            inactivityDescription = `ส่งเมื่อ User หายไป ${value} ${unitInThai}`;
          }
        }
        
        return {
          id: schedule.id,
          type: schedule.send_type === 'immediate' ? 'immediate' : 
                schedule.send_type === 'scheduled' ? 'scheduled' : 'user-inactive',
          date: schedule.scheduled_at ? new Date(schedule.scheduled_at).toISOString().split('T')[0] : null,
          time: schedule.scheduled_at ? new Date(schedule.scheduled_at).toTimeString().substr(0, 5) : null,
          inactivityPeriod: schedule.send_after_inactive ? 
            parseInt(schedule.send_after_inactive.split(' ')[0]) : null,
          inactivityUnit: schedule.send_after_inactive ? 
            schedule.send_after_inactive.split(' ')[1].replace(/s$/, '') : null,
          inactivityDescription: inactivityDescription,
          send_after_inactive: schedule.send_after_inactive,
          repeat: {
            type: schedule.frequency || 'once',
            endDate: null
          },
          groups: [groupId],
          groupId: groupId,
          isKnowledge: isKnowledge
        };
      });
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
    console.log('Schedules for viewing:', schedules);
    
    // เพิ่มการประมวลผลข้อมูล schedule เพิ่มเติม
    const processedSchedules = schedules.map(schedule => {
      // ถ้าเป็น user-inactive และมี send_after_inactive
      if (schedule.type === 'user-inactive' && schedule.send_after_inactive) {
        const parts = schedule.send_after_inactive.split(' ');
        if (parts.length >= 2) {
          const value = parts[0];
          const unit = parts[1];
          
          // สร้าง description ที่ชัดเจน
          const unitInThai = 
            unit.includes('minute') ? 'นาที' :
            unit.includes('hour') ? 'ชั่วโมง' :
            unit.includes('day') ? 'วัน' :
            unit.includes('week') ? 'สัปดาห์' :
            unit.includes('month') ? 'เดือน' : unit;
          
          schedule.displayText = `ส่งเมื่อ User หายไป ${value} ${unitInThai}`;
        }
      } else if (schedule.type === 'scheduled') {
        const date = schedule.date ? new Date(schedule.date).toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }) : 'ไม่ระบุวันที่';
        const time = schedule.time || 'ไม่ระบุเวลา';
        schedule.displayText = `ส่งตามเวลา: ${date} เวลา ${time} น.`;
      } else if (schedule.type === 'immediate') {
        schedule.displayText = 'ส่งทันที';
      }
      
      return schedule;
    });
    
    setViewingGroupSchedules(processedSchedules);
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
          
          // Process schedules เหมือนใน handleViewSchedules
          const processedSchedules = schedules.map(schedule => {
            if (schedule.type === 'user-inactive' && schedule.send_after_inactive) {
              const parts = schedule.send_after_inactive.split(' ');
              if (parts.length >= 2) {
                const value = parts[0];
                const unit = parts[1];
                const unitInThai = 
                  unit.includes('minute') ? 'นาที' :
                  unit.includes('hour') ? 'ชั่วโมง' :
                  unit.includes('day') ? 'วัน' :
                  unit.includes('week') ? 'สัปดาห์' :
                  unit.includes('month') ? 'เดือน' : unit;
                
                schedule.displayText = `ส่งเมื่อ User หายไป ${value} ${unitInThai}`;
              }
            } else if (schedule.type === 'scheduled') {
              const date = schedule.date ? new Date(schedule.date).toLocaleDateString('th-TH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : 'ไม่ระบุวันที่';
              const time = schedule.time || 'ไม่ระบุเวลา';
              schedule.displayText = `ส่งตามเวลา: ${date} เวลา ${time} น.`;
            } else if (schedule.type === 'immediate') {
              schedule.displayText = 'ส่งทันที';
            }
            return schedule;
          });
          
          setViewingGroupSchedules(processedSchedules);
          
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