// MinerGroup/utils/constants.js
export const DEFAULT_GROUPS = [
  {
    id: 'default_1',
    type_name: 'กลุ่มคนหาย',
    isDefault: true,
    rule_description: 'สำหรับลูกค้าที่หายไปไม่นาน',
    icon: '🕐',
    created_at: new Date('2024-01-01').toISOString()
  },
  {
    id: 'default_2',
    type_name: 'กลุ่มคนหายนาน',
    isDefault: true,
    rule_description: 'สำหรับลูกค้าที่หายไปนาน',
    icon: '⏰',
    created_at: new Date('2024-01-01').toISOString()
  },
  {
    id: 'default_3',
    type_name: 'กลุ่มคนหายนานมาก',
    isDefault: true,
    rule_description: 'สำหรับลูกค้าที่หายไปนานมาก',
    icon: '📅',
    created_at: new Date('2024-01-01').toISOString()
  }
];

export const DEFAULT_GROUP_IDS = ['default_1', 'default_2', 'default_3'];