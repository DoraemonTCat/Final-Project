// MinerGroup/components/EditGroupForm.js
import React, { useState } from 'react';

/**
 * EditGroupForm Component
 * จัดการฟอร์มแก้ไขข้อมูลกลุ่ม
 * - รองรับการแก้ไขทั้ง default group และ user group
 * - Default group แก้ไขได้เฉพาะชื่อ
 * - User group แก้ไขได้ทุกฟิลด์
 */
const EditGroupForm = ({ group, onSave, onCancel }) => {
  const [editData, setEditData] = useState({
    type_name: group.type_name || group.name || '',
    rule_description: group.rule_description || '',
    keywords: Array.isArray(group.keywords) ? group.keywords.join(', ') : group.keywords || '',
    examples: Array.isArray(group.examples) ? group.examples.join('\n') : group.examples || ''
  });

  // ตรวจสอบว่าเป็น knowledge group หรือไม่
  const isKnowledgeGroup = group.isKnowledge;
  const isDefaultGroup = group.isDefault;

   // สำหรับ knowledge groups - แก้ไขได้เฉพาะชื่อและคำอธิบาย
  if (isKnowledgeGroup) {
    return (
      <div style={{ marginBottom: '12px', width: '100%' }}>
        <input
          type="text"
          value={editData.type_name}
          onChange={(e) => setEditData({ ...editData, type_name: e.target.value })}
          onKeyPress={(e) => e.key === 'Enter' && onSave(editData)}
          placeholder="ชื่อกลุ่ม"
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '18px',
            fontWeight: '600',
            textAlign: 'center',
            border: '2px solid #4299e1',
            borderRadius: '6px',
            outline: 'none',
            marginBottom: '8px'
          }}
          autoFocus
        />
        
        <textarea
          value={editData.rule_description}
          onChange={(e) => setEditData({ ...editData, rule_description: e.target.value })}
          placeholder="คำอธิบายกฎการจัดกลุ่ม"
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '14px',
            border: '2px solid #e2e8f0',
            borderRadius: '6px',
            outline: 'none',
            minHeight: '60px',
            marginBottom: '8px',
            resize: 'vertical'
          }}
        />
        
        <input
          type="text"
          value={editData.keywords}
          onChange={(e) => setEditData({ ...editData, keywords: e.target.value })}
          placeholder="Keywords (คั่นด้วย ,)"
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '14px',
            border: '2px solid #e2e8f0',
            borderRadius: '6px',
            outline: 'none',
            marginBottom: '8px'
          }}
        />
        
        <textarea
          value={editData.examples}
          onChange={(e) => setEditData({ ...editData, examples: e.target.value })}
          placeholder="ตัวอย่าง (แต่ละบรรทัดคือ 1 ตัวอย่าง)"
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '14px',
            border: '2px solid #e2e8f0',
            borderRadius: '6px',
            outline: 'none',
            minHeight: '80px',
            marginBottom: '8px',
            resize: 'vertical'
          }}
        />
        
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button onClick={() => onSave(editData)} className="edit-save-btn">
            บันทึก
          </button>
          <button onClick={onCancel} className="edit-cancel-btn">
            ยกเลิก
          </button>
        </div>
      </div>
    );
  }

  // สำหรับ default groups - แก้ไขได้เฉพาะชื่อ
  if (isDefaultGroup) {
    return (
      <div style={{ marginBottom: '12px', width: '100%' }}>
        <input
          type="text"
          value={editData.type_name}
          onChange={(e) => setEditData({ ...editData, type_name: e.target.value })}
          onKeyPress={(e) => e.key === 'Enter' && onSave(editData)}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '18px',
            fontWeight: '600',
            textAlign: 'center',
            border: '2px solid #667eea',
            borderRadius: '6px',
            outline: 'none'
          }}
          autoFocus
        />
        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button onClick={() => onSave(editData)} className="edit-save-btn">
            บันทึก
          </button>
          <button onClick={onCancel} className="edit-cancel-btn">
            ยกเลิก
          </button>
        </div>
      </div>
    );
  }

  // สำหรับ user group - แก้ไขได้ทุกฟิลด์
  return (
    <div style={{ marginBottom: '12px', width: '100%' }}>
      {/* โค้ดเดิมสำหรับ user groups */}
      <input
        type="text"
        value={editData.type_name}
        onChange={(e) => setEditData({ ...editData, type_name: e.target.value })}
        placeholder="ชื่อกลุ่ม"
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: '18px',
          fontWeight: '600',
          textAlign: 'center',
          border: '2px solid #667eea',
          borderRadius: '6px',
          outline: 'none',
          marginBottom: '8px'
        }}
      />
      
      <textarea
        value={editData.rule_description}
        onChange={(e) => setEditData({ ...editData, rule_description: e.target.value })}
        placeholder="คำอธิบายกฎ"
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: '14px',
          border: '2px solid #e2e8f0',
          borderRadius: '6px',
          outline: 'none',
          minHeight: '60px',
          marginBottom: '8px',
          resize: 'vertical'
        }}
      />
      
      <input
        type="text"
        value={editData.keywords}
        onChange={(e) => setEditData({ ...editData, keywords: e.target.value })}
        placeholder="Keywords (คั่นด้วย ,)"
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: '14px',
          border: '2px solid #e2e8f0',
          borderRadius: '6px',
          outline: 'none',
          marginBottom: '8px'
        }}
      />
      
      <textarea
        value={editData.examples}
        onChange={(e) => setEditData({ ...editData, examples: e.target.value })}
        placeholder="ตัวอย่าง (แต่ละบรรทัดคือ 1 ตัวอย่าง)"
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: '14px',
          border: '2px solid #e2e8f0',
          borderRadius: '6px',
          outline: 'none',
          minHeight: '80px',
          marginBottom: '8px',
          resize: 'vertical'
        }}
      />
      
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button onClick={() => onSave(editData)} className="edit-save-btn">
          บันทึก
        </button>
        <button onClick={onCancel} className="edit-cancel-btn">
          ยกเลิก
        </button>
      </div>
    </div>
  );
};

export default EditGroupForm;