import React, { useState } from 'react';

export default function SyncCustomersButton({ selectedPage, onSyncComplete }) {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  const handleSync = async () => {
    if (!selectedPage) {
      alert('กรุณาเลือกเพจก่อน');
      return;
    }

    setSyncing(true);
    setSyncStatus(null);

    try {
      const response = await fetch(`http://localhost:8000/sync-customers/${selectedPage}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const result = await response.json();
     

      // เรียก callback เพื่อ refresh ข้อมูล
      if (onSyncComplete) {
        onSyncComplete();
      }

    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus({
        type: 'error',
        message: 'เกิดข้อผิดพลาดในการ sync ข้อมูล'
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="sync-container" style={{ marginBottom: '20px' }}>
      <button
        onClick={handleSync}
        disabled={syncing || !selectedPage}
        className="sync-btn"
        style={{
          padding: '12px 24px',
          background: syncing ? '#cbd5e0' : 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: syncing ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 6px rgba(66, 153, 225, 0.2)',
          transition: 'all 0.3s ease'
        }}
      >
        <span className={syncing ? 'spinning' : ''}>🔄</span>
        {syncing ? 'กำลัง Sync...' : 'Sync ข้อมูลจาก Facebook'}
      </button>

      {syncStatus && (
        <div
          style={{
            marginTop: '10px',
            padding: '12px',
            borderRadius: '6px',
            fontSize: '14px',
            background: syncStatus.type === 'success' ? '#c6f6d5' : '#fed7d7',
            color: syncStatus.type === 'success' ? '#276749' : '#742a2a',
            border: `1px solid ${syncStatus.type === 'success' ? '#9ae6b4' : '#feb2b2'}`
          }}
        >
          {syncStatus.type === 'success' ? '✅' : '❌'} {syncStatus.message}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .spinning {
          display: inline-block;
          animation: spin 1s linear infinite;
        }
        
        .sync-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(66, 153, 225, 0.3);
        }
      `}</style>
    </div>
  );
}