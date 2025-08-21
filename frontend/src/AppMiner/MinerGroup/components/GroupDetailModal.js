// MinerGroup/components/GroupDetailModal.js
import React from 'react';

/**
 * GroupDetailModal Component
 * แสดง Modal รายละเอียดของกลุ่มลูกค้า
 * - แสดงคำอธิบายกฎการจัดกลุ่ม
 * - แสดงคีย์เวิร์ดสำหรับจัดกลุ่มอัตโนมัติ
 * - แสดงตัวอย่างการจำแนกประเภท
 */
const GroupDetailModal = ({ show, group, onClose }) => {
  if (!show || !group) return null;

  // แปลง keywords จาก string หรือ array เป็น array
  const getKeywordsArray = () => {
    if (!group.keywords) return [];
    if (Array.isArray(group.keywords)) return group.keywords;
    if (typeof group.keywords === 'string') {
      return group.keywords.split(',').map(k => k.trim()).filter(k => k);
    }
    return [];
  };

  // แปลง examples จาก string หรือ array เป็น array
  const getExamplesArray = () => {
    if (!group.examples) return [];
    if (Array.isArray(group.examples)) return group.examples;
    if (typeof group.examples === 'string') {
      return group.examples.split('\n').map(e => e.trim()).filter(e => e);
    }
    return [];
  };

  const keywords = getKeywordsArray();
  const examples = getExamplesArray();

  return (
    <div className="group-detail-modal-overlay" onClick={onClose}>
      <div className="group-detail-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <span className="detail-icon">📋</span>
            รายละเอียดกลุ่ม: {group.type_name || group.name}
          </h2>
          <button className="modal-close-btn" onClick={onClose}>✖</button>
        </div>
        
        <div className="modal-body">
          {/* คำอธิบายกฎการจัดกลุ่ม */}
          <div className="detail-section">
            <h3 className="section-header">
              <span className="section-icon">📝</span>
              คำอธิบายกฎการจัดกลุ่ม
            </h3>
            <div className="section-content">
              {group.rule_description ? (
                <p className="description-text">{group.rule_description}</p>
              ) : (
                <p className="empty-text">ไม่มีคำอธิบายกฎการจัดกลุ่ม</p>
              )}
            </div>
          </div>

          {/* คีย์เวิร์ดสำหรับจัดกลุ่มอัตโนมัติ */}
          <div className="detail-section">
            <h3 className="section-header">
              <span className="section-icon">🔑</span>
              คีย์เวิร์ดสำหรับจัดกลุ่มอัตโนมัติ
            </h3>
            <div className="section-content">
              {keywords.length > 0 ? (
                <div className="keywords-container">
                  {keywords.map((keyword, index) => (
                    <span key={index} className="keyword-badge">
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="empty-text">ไม่มีคีย์เวิร์ด</p>
              )}
            </div>
          </div>

          {/* ตัวอย่างการจำแนกประเภท */}
          <div className="detail-section">
            <h3 className="section-header">
              <span className="section-icon">💡</span>
              ตัวอย่างการจำแนกประเภท
            </h3>
            <div className="section-content">
              {examples.length > 0 ? (
                <ul className="examples-list">
                  {examples.map((example, index) => (
                    <li key={index} className="example-item">
                      <span className="example-number">{index + 1}.</span>
                      <span className="example-text">{example}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-text">ไม่มีตัวอย่าง</p>
              )}
            </div>
          </div>

          {/* ข้อมูลเพิ่มเติม */}
          <div className="detail-section">
            <h3 className="section-header">
              <span className="section-icon">ℹ️</span>
              ข้อมูลเพิ่มเติม
            </h3>
            <div className="section-content info-grid">
              <div className="info-item">
                <span className="info-label">สถานะ:</span>
                <span className={`info-value ${group.is_active !== false ? 'active' : 'inactive'}`}>
                  {group.is_active !== false ? '✅ ใช้งาน' : '⛔ ไม่ใช้งาน'}
                </span>
              </div>
              
              <div className="info-item">
                <span className="info-label">สร้างเมื่อ:</span>
                <span className="info-value">
                  {group.created_at ? new Date(group.created_at).toLocaleDateString('th-TH') : 'ไม่ทราบ'}
                </span>
              </div>
              
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="close-detail-btn" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

// CSS Styles สำหรับ GroupDetailModal
const modalStyles = `
/* Modal Overlay */
.group-detail-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

/* Modal Content */
.group-detail-modal-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  animation: slideIn 0.3s ease;
  display: flex;
  flex-direction: column;
}

/* Modal Header */
.modal-header {
  padding: 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);
}

.modal-title {
  font-size: 24px;
  font-weight: 700;
  color: #2d3748;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
}

.detail-icon {
  font-size: 28px;
}

.modal-close-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 8px;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

/* Modal Body */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

/* Detail Section */
.detail-section {
  margin-bottom: 32px;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e9ecef;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.section-header {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-icon {
  font-size: 20px;
}

.section-content {
  color: #4a5568;
}

/* Description Text */
.description-text {
  line-height: 1.6;
  margin: 0;
}

/* Empty Text */
.empty-text {
  color: #a0aec0;
  font-style: italic;
  margin: 0;
}

/* Keywords Container */
.keywords-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.keyword-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
}

/* Examples List */
.examples-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.example-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: white;
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid #e2e8f0;
}

.example-item:last-child {
  margin-bottom: 0;
}

.example-number {
  font-weight: 600;
  color: #667eea;
  flex-shrink: 0;
}

.example-text {
  line-height: 1.5;
}

/* Info Grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-label {
  font-weight: 600;
  color: #4a5568;
}

.info-value {
  color: #2d3748;
}

.info-value.active {
  color: #48bb78;
}

.info-value.inactive {
  color: #e53e3e;
}

/* Modal Footer */
.modal-footer {
  padding: 20px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  background: #f8f9fa;
}

.close-detail-btn {
  padding: 12px 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(102, 126, 234, 0.2);
}

.close-detail-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(102, 126, 234, 0.3);
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .group-detail-modal-content {
    width: 95%;
    max-height: 95vh;
  }
  
  .modal-title {
    font-size: 20px;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
}
`;

// เพิ่ม style element
if (typeof document !== 'undefined' && !document.getElementById('group-detail-modal-styles')) {
  const style = document.createElement('style');
  style.id = 'group-detail-modal-styles';
  style.textContent = modalStyles;
  document.head.appendChild(style);
}

export default GroupDetailModal;