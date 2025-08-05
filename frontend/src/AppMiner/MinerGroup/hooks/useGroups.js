// MinerGroup/hooks/useGroups.js
import { useState, useEffect } from 'react';
import { getPageDbId } from '../utils/helpers';
import { getPageCustomerTypeKnowledge } from '../../../Features/Tool';

/**
 * useGroups Hook
 * จัดการ state และ logic ที่เกี่ยวกับกลุ่มลูกค้า
 * - โหลดข้อมูลกลุ่มจาก API (รวม knowledge types)
 * - จัดการการสร้าง/แก้ไข/ลบกลุ่ม
 * - จัดการการเลือกกลุ่ม
 */
export const useGroups = (selectedPage) => {
  const [customerGroups, setCustomerGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [knowledgeGroups, setKnowledgeGroups] = useState([]); // เพิ่ม state สำหรับ knowledge groups

  const fetchCustomerGroups = async (pageId) => {
    setLoading(true);
    try {
      const dbId = await getPageDbId(pageId);
      if (!dbId) {
        setCustomerGroups([]);
        return;
      }

      // 1. ดึง knowledge types สำหรับ page นี้
      let knowledgeTypes = [];
      try {
        const knowledgeData = await getPageCustomerTypeKnowledge(pageId);
        knowledgeTypes = knowledgeData.map(kt => ({
          ...kt,
          isKnowledge: true,
          icon: getKnowledgeIcon(kt.type_name), // ฟังก์ชันสำหรับกำหนด icon
          created_at: new Date().toISOString(), // ใช้วันที่ปัจจุบัน
          customer_count: 0, // จะต้องนับจาก database
          is_active: true,
          message_count: 0
        }));
        setKnowledgeGroups(knowledgeTypes);
      } catch (error) {
        console.error('Error fetching knowledge types:', error);
        // ถ้าดึง knowledge types ไม่ได้ ให้ใช้ array ว่าง
        knowledgeTypes = [];
      }

      // 2. ดึง user groups (คงเดิม)
      const response = await fetch(`http://localhost:8000/customer-groups/${dbId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch customer groups');
      }
      
      const data = await response.json();
      
      const formattedGroups = await Promise.all(data.map(async group => {
        const messageCount = await getGroupMessageCount(pageId, group.id);
        
        return {
          id: group.id,
          type_name: group.type_name,
          isDefault: false,
          isKnowledge: false, // ระบุว่าไม่ใช่ knowledge type
          rule_description: group.rule_description || '',
          keywords: Array.isArray(group.keywords) ? group.keywords.join(', ') : group.keywords || '',
          examples: Array.isArray(group.examples) ? group.examples.join('\n') : group.examples || '',
          created_at: group.created_at,
          customer_count: group.customer_count || 0,
          is_active: group.is_active !== false,
          message_count: messageCount
        };
      }));
      
      // 3. รวม knowledge types และ user groups
      const allGroups = [...knowledgeTypes, ...formattedGroups];
      setCustomerGroups(allGroups);
      
    } catch (error) {
      console.error('Error fetching customer groups:', error);
      setCustomerGroups([]);
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันกำหนด icon ตาม type name
  const getKnowledgeIcon = (typeName) => {
    const iconMap = {
      'สอบถามข้อมูล': '❓',
      'สนใจสินค้า': '🛒',
      'ต้องการติดต่อ': '📞',
      'ร้องเรียน': '😤',
      'ชื่นชม': '👍',
      'อื่นๆ': '📌'
    };
    return iconMap[typeName] || '📋';
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

  const toggleGroupSelection = (groupId) => {
    setSelectedGroups(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      }
      return [...prev, groupId];
    });
  };

  useEffect(() => {
    if (selectedPage) {
      fetchCustomerGroups(selectedPage);
      setSelectedGroups([]);
    } else {
      setCustomerGroups([]);
      setSelectedGroups([]);
    }
  }, [selectedPage]);

  return {
    customerGroups,
    selectedGroups,
    loading,
    editingGroupId,
    setEditingGroupId,
    toggleGroupSelection,
    fetchCustomerGroups,
    knowledgeGroups // export knowledge groups แยก
  };
};