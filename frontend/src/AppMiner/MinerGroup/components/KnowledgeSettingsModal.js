import React, { useState, useEffect } from 'react';

const KnowledgeSettingsModal = ({ show, onClose, pageId, knowledgeGroups, onToggle }) => {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    if (knowledgeGroups.length > 0) {
      const initialSettings = {};
      knowledgeGroups.forEach(group => {
        initialSettings[group.knowledge_id] = group.is_enabled !== false;
      });
      setSettings(initialSettings);
    }
  }, [knowledgeGroups]);

  const handleToggle = async (knowledgeId) => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8000/page-customer-type-knowledge/${pageId}/${knowledgeId}/toggle`,
        { method: 'PUT' }
      );

      if (!response.ok) throw new Error('Failed to toggle');

      const result = await response.json();
      
      // อัพเดท local state
      setSettings(prev => ({
        ...prev,
        [knowledgeId]: result.is_enabled
      }));

      // 🔥 ส่ง custom event เพื่อแจ้งให้ทุก component รู้ว่ามีการเปลี่ยนแปลง
      window.dispatchEvent(new CustomEvent('knowledgeGroupStatusChanged', {
        detail: {
          knowledgeId: knowledgeId,
          isEnabled: result.is_enabled,
          pageId: pageId,
          groupName: knowledgeGroups.find(g => g.knowledge_id === knowledgeId)?.type_name || 'Unknown'
        }
      }));

      console.log(`📡 Dispatched event: Knowledge group ${knowledgeId} is now ${result.is_enabled ? 'enabled' : 'disabled'}`);

      // เรียก callback เพื่ออัพเดทข้อมูลใน parent (MinerGroup)
      onToggle();

    } catch (error) {
      console.error('Error toggling knowledge type:', error);
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ');
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content knowledge-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <span className="settings-icon">⚙️</span>
            ตั้งค่ากลุ่มพื้นฐาน
          </h2>
          <button className="modal-close-btn" onClick={onClose}>✖</button>
        </div>

        <div className="modal-body">
          <p className="settings-description">
            เลือกกลุ่มพื้นฐานที่ต้องการใช้งานสำหรับเพจนี้
            <br />
            <small style={{ color: '#e53e3e' }}>
              ⚠️ การปิดกลุ่มจะทำให้ schedule ที่เกี่ยวข้องถูกซ่อนจาก Dashboard ทันที
            </small>
          </p>

          <div className="knowledge-list">
            {knowledgeGroups.map((group) => (
              <div key={group.id} className={`knowledge-item ${!settings[group.knowledge_id] ? 'disabled' : ''}`}>
                <div className="knowledge-info">
                  <span className="knowledge-icon">{group.icon || '📋'}</span>
                  <div className="knowledge-details">
                    <h4 className="knowledge-name">{group.type_name}</h4>
                    <p className="knowledge-description">
                      {group.rule_description || 'ไม่มีคำอธิบาย'}
                    </p>
                    
                  </div>
                </div>
                
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings[group.knowledge_id] || false}
                    onChange={() => handleToggle(group.knowledge_id)}
                    disabled={loading}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            ))}
          </div>

          {knowledgeGroups.length === 0 && (
            <div className="empty-knowledge">
              <p>ไม่พบกลุ่มพื้นฐานในระบบ</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="close-btn" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>

      <style jsx>{`
        .knowledge-settings-modal {
          max-width: 600px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          padding: 24px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
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

        .settings-icon {
          font-size: 28px;
        }

        .modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }

        .settings-description {
          color: #718096;
          margin-bottom: 24px;
        }

        .knowledge-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .knowledge-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }

        .knowledge-info {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          flex: 1;
        }

        .knowledge-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        .knowledge-details {
          flex: 1;
        }

        .knowledge-name {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
          color: #2d3748;
        }

        .knowledge-description {
          margin: 0;
          font-size: 14px;
          color: #718096;
          line-height: 1.5;
        }

        /* Toggle Switch Styles */
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 24px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #cbd5e0;
          transition: .4s;
          border-radius: 24px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }

        input:checked + .toggle-slider {
          background-color: #48bb78;
        }

        input:disabled + .toggle-slider {
          opacity: 0.5;
          cursor: not-allowed;
        }

        input:checked + .toggle-slider:before {
          transform: translateX(26px);
        }

        .empty-knowledge {
          text-align: center;
          padding: 40px;
          color: #718096;
        }

        .modal-footer {
          padding: 20px 24px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
        }

        .close-btn {
          padding: 12px 32px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .close-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(102, 126, 234, 0.3);
        }
        
      `}</style>
    </div>
  );
};

export default KnowledgeSettingsModal;