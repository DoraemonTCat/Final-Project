// MinerGroup/hooks/useGroups.js
import { useState, useEffect } from 'react';
import { DEFAULT_GROUPS } from '../utils/constants';
import { getPageDbId } from '../utils/helpers';

/**
 * useGroups Hook
 * จัดการ state และ logic ที่เกี่ยวกับกลุ่มลูกค้า
 * - โหลดข้อมูลกลุ่มจาก API
 * - จัดการการสร้าง/แก้ไข/ลบกลุ่ม
 * - จัดการการเลือกกลุ่ม
 */
export const useGroups = (selectedPage) => {
  const [customerGroups, setCustomerGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);

  const fetchCustomerGroups = async (pageId) => {
    setLoading(true);
    try {
      const dbId = await getPageDbId(pageId);
      if (!dbId) {
        setCustomerGroups(DEFAULT_GROUPS);
        return;
      }

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
    fetchCustomerGroups
  };
};