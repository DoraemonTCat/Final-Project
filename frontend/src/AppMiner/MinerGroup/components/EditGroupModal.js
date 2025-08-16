// MinerGroup/components/EditGroupModal.js
import React, { useState, useEffect } from 'react';

/**
 * EditGroupModal Component
 * Modal สำหรับแก้ไขรายละเอียดกลุ่มลูกค้า
 * - รองรับการแก้ไขทั้ง knowledge group, default group และ user group
 * - แสดงในรูปแบบ popup modal ที่สวยงาม
 */
const EditGroupModal = ({ show, group, onSave, onClose }) => {
  // State สำหรับเก็บข้อมูลที่กำลังแก้ไข
  const [editData, setEditData] = useState({
    type_name: '',
    rule_description: '',
    keywords: '',
    examples: ''
  });

  // Reset form เมื่อเปิด modal หรือเปลี่ยนกลุ่ม
  useEffect(() => {
    if (group) {
      setEditData({
        type_name: group.type_name || group.name || '',
        rule_description: group.rule_description || '',
        keywords: Array.isArray(group.keywords) ? group.keywords.join(', ') : group.keywords || '',
        examples: Array.isArray(group.examples) ? group.examples.join('\n') : group.examples || ''
      });
    }
  }, [group]);

  // ไม่แสดง modal ถ้า show = false หรือไม่มีข้อมูล group
  if (!show || !group) return null;

  // ตรวจสอบประเภทของกลุ่ม
  const isKnowledgeGroup = group.isKnowledge;
  const isDefaultGroup = group.isDefault;
  const isDisabled = isKnowledgeGroup && group.is_enabled === false;

  // ฟังก์ชันจัดการการบันทึก
  const handleSave = () => {
    if (!editData.type_name.trim()) {
      alert("กรุณากรอกชื่อกลุ่ม");
      return;
    }
    onSave(editData);
  };

  // ฟังก์ชันจัดการการยกเลิก
  const handleCancel = () => {
    // Reset form
    setEditData({
      type_name: group.type_name || group.name || '',
      rule_description: group.rule_description || '',
      keywords: Array.isArray(group.keywords) ? group.keywords.join(', ') : group.keywords || '',
      examples: Array.isArray(group.examples) ? group.examples.join('\n') : group.examples || ''
    });
    onClose();
  };

  return (
    <div className="edit-modal-overlay" onClick={handleCancel}>
      <div className="edit-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="edit-modal-header">
          <h2 className="edit-modal-title">
            <span className="edit-icon">✏️</span>
            แก้ไขรายละเอียดกลุ่ม
            {isKnowledgeGroup && <span className="badge-knowledge">กลุ่มพื้นฐาน</span>}
            {isDefaultGroup && <span className="badge-default">พื้นฐาน</span>}
          </h2>
          <button className="modal-close-btn" onClick={handleCancel}>✖</button>
        </div>

        {/* Body */}
        <div className="edit-modal-body">
          {/* ฟิลด์ชื่อกลุ่ม - แสดงเสมอ */}
          <div className="form-group">
            <label className="form-label">
              ชื่อกลุ่ม <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={editData.type_name}
              onChange={(e) => setEditData({ ...editData, type_name: e.target.value })}
              placeholder="กรอกชื่อกลุ่ม"
              disabled={isDisabled}
            />
          </div>

          {/* ฟิลด์คำอธิบาย - แสดงสำหรับทุกกลุ่มยกเว้น default */}
          {!isDefaultGroup && (
            <div className="form-group">
              <label className="form-label">คำอธิบายกฎการจัดกลุ่ม</label>
              <textarea
                className="form-textarea"
                value={editData.rule_description}
                onChange={(e) => setEditData({ ...editData, rule_description: e.target.value })}
                placeholder="อธิบายกฎที่ใช้ในการจำแนกลูกค้ากลุ่มนี้..."
                rows="3"
                disabled={isDisabled}
              />
            </div>
          )}

          {/* ฟิลด์ Keywords - แสดงสำหรับ knowledge และ user groups */}
          {!isDefaultGroup && (
            <div className="form-group">
              <label className="form-label">
                Keywords (คั่นด้วยคอมม่า)
                <span className="form-hint">ใช้สำหรับจัดกลุ่มอัตโนมัติ</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={editData.keywords}
                onChange={(e) => setEditData({ ...editData, keywords: e.target.value })}
                placeholder="เช่น สนใจ, ราคา, โปรโมชั่น"
                disabled={isDisabled}
              />
            </div>
          )}

          {/* ฟิลด์ตัวอย่าง - แสดงสำหรับ knowledge และ user groups */}
          {!isDefaultGroup && (
            <div className="form-group">
              <label className="form-label">
                ตัวอย่างการจำแนกประเภท
                <span className="form-hint">แต่ละบรรทัดคือ 1 ตัวอย่าง</span>
              </label>
              <textarea
                className="form-textarea"
                value={editData.examples}
                onChange={(e) => setEditData({ ...editData, examples: e.target.value })}
                placeholder="เช่น&#10;- ลูกค้าที่พิมพ์ว่า 'สนใจสินค้า'&#10;- ลูกค้าที่ถามว่า 'ราคาเท่าไหร่'"
                rows="4"
                disabled={isDisabled}
              />
            </div>
          )}

          {/* แสดงข้อความเมื่อกลุ่มถูกปิดใช้งาน */}
          {isDisabled && (
            <div className="disabled-notice">
              ⚠️ กลุ่มนี้ถูกปิดใช้งาน ไม่สามารถแก้ไขได้
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="edit-modal-footer">
          <button 
            className="btn-save" 
            onClick={handleSave}
            disabled={isDisabled || !editData.type_name.trim()}
          >
            <span className="btn-icon">💾</span>
            บันทึก
          </button>
          <button className="btn-cancel" onClick={handleCancel}>
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditGroupModal;