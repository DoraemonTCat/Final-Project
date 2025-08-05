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
        console.log('Knowledge data received:', knowledgeData); // เพิ่ม debug log
        
        knowledgeTypes = knowledgeData.map(kt => ({
          ...kt,
          id: kt.id || `knowledge_${kt.knowledge_id}`, // ตรวจสอบว่ามี id format ที่ถูกต้อง
          type_name: kt.type_name,
          name: kt.type_name, // เพิ่ม name field
          isKnowledge: true,
          icon: getKnowledgeIcon(kt.type_name),
          created_at: kt.created_at || new Date().toISOString(),
          customer_count: kt.customer_count || 0,
          is_active: kt.is_enabled !== false,
          message_count: 0,
          rule_description: kt.rule_description || '',
          keywords: kt.keywords || '',
          examples: kt.examples || ''
        }));
        
        console.log('Formatted knowledge types:', knowledgeTypes); // เพิ่ม debug log
        setKnowledgeGroups(knowledgeTypes);
      } catch (error) {
        console.error('Error fetching knowledge types:', error);
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
      'หักแล้งหาย': '💔',
      'หักแล้วคืนดี': '❤️',
      'หักแล้วคืนไม่ดี': '💢',
      'หักแล้วลืม': '😌',
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