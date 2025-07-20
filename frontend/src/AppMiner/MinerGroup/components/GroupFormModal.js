// MinerGroup/components/GroupFormModal.js
import React, { useState } from 'react';

/**
 * GroupFormModal Component
 * จัดการ Modal สำหรับสร้างกลุ่มลูกค้าใหม่
 * - แสดงฟอร์มสำหรับกรอกข้อมูลกลุ่ม
 * - Validate และส่งข้อมูลกลับไปยัง parent
 */
const GroupFormModal = ({ show, onClose, onSave, selectedPageInfo }) => {
  const [formData, setFormData] = useState({
    name: '',
    ruleDescription: '',
    keywords: '',
    examples: ''
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      alert("กรุณากรอกชื่อกลุ่ม");
      return;
    }
    onSave(formData);
    setFormData({ name: '', ruleDescription: '', keywords: '', examples: '' });
  };

  const handleClose = () => {
    setFormData({ name: '', ruleDescription: '', keywords: '', examples: '' });
    onClose();
  };

  if (!show) return null;

  return (
    <div className="add-group-modal">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <h3>สร้างกลุ่มลูกค้าใหม่{selectedPageInfo && ` - ${selectedPageInfo.name}`}</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#4a5568' }}>
            ชื่อกลุ่มลูกค้า <span style={{ color: '#e53e3e' }}>*</span>
          </label>
          <input
            type="text"
            placeholder="เช่น ลูกค้าสนใจสินค้า"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="group-name-input"
            autoFocus
          />
        </div>

        <div style={{ marginBottom: '20px' , marginTop: '-30px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#4a5568' }}>
            คำอธิบายกฎการจัดกลุ่ม
          </label>
          <textarea
            placeholder="อธิบายกฎที่ใช้ในการจำแนกลูกค้ากลุ่มนี้..."
            value={formData.ruleDescription}
            onChange={(e) => setFormData({ ...formData, ruleDescription: e.target.value })}
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '16px',
              minHeight: '80px',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px', marginTop: '-30px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#4a5568' }}>
            คีย์เวิร์ดสำหรับจัดกลุ่มอัตโนมัติ
          </label>
          <input
            type="text"
            placeholder="เช่น สวัสดี, สนใจ, ราคา (คั่นด้วยคอมม่า)"
            value={formData.keywords}
            onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
            className="group-name-input"
          />
        </div>

        <div style={{ marginBottom: '20px', marginTop: '-30px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#4a5568' }}>
            ตัวอย่างการจำแนกประเภท
          </label>
          <textarea
            placeholder="เช่น ลูกค้าที่พิมพ์ว่า 'สนใจ' หรือ 'ราคาเท่าไหร่'"
            value={formData.examples}
            onChange={(e) => setFormData({ ...formData, examples: e.target.value })}
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '16px',
              minHeight: '80px',
              resize: 'vertical'
            }}
          />
        </div>

        <div className="modal-actions">
          <button
            onClick={handleSubmit}
            className="save-btn"
            disabled={!formData.name.trim()}
          >
            บันทึก
          </button>
          <button onClick={handleClose} className="cancel-btn">
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupFormModal;