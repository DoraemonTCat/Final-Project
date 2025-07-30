import React, { useState } from 'react';

export default function SyncCustomersButton({ selectedPage, onSyncComplete }) {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [showSyncOptions, setShowSyncOptions] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
    period: 'all' // all, today, week, month, custom, imported_1y, imported_2y, etc.
  });

  const executeSyncWithPeriod = async (selectedPeriod = dateRange.period) => {
    if (!selectedPage) {
      alert('กรุณาเลือกเพจก่อน');
      return;
    }

    // ปิด dropdown
    setShowSyncOptions(false);
    setSyncing(true);
    setSyncStatus(null);

    try {
      let endpoint = '';
      let queryParams = '';

      // ตรวจสอบว่าเป็นการ sync แบบ imported หรือไม่
      if (selectedPeriod.startsWith('imported_')) {
        // ดึงจำนวนปีจาก period เช่น imported_1y -> 1
        const years = parseInt(selectedPeriod.replace('imported_', '').replace('y', ''));
        // ใช้ POST method และส่ง years ใน query parameters
        endpoint = `http://localhost:8000/sync-customers/${selectedPage}?years=${years}&compare_to=installed_at&imported=true`;
      } else {
        // Sync แบบปกติ
        endpoint = `http://localhost:8000/sync-customers/${selectedPage}`;
        
        // เตรียม query parameters สำหรับช่วงเวลา
        if (selectedPeriod === 'custom' && dateRange.startDate && dateRange.endDate) {
          queryParams = `?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`;
        } else if (selectedPeriod !== 'all') {
          queryParams = `?period=${selectedPeriod}`;
        }
        
        endpoint += queryParams;
      }

      const response = await fetch(endpoint, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const result = await response.json();
      
      setSyncStatus({
        type: 'success',
        message: `Sync สำเร็จ! ${result.synced || 0} ข้อมูล${result.details ? ` (ใหม่: ${result.details.created || 0}, อัพเดท: ${result.details.updated || 0})` : ''}`
      });

      // รีเซ็ตการเลือกช่วงเวลา
      setDateRange({
        startDate: '',
        endDate: '',
        period: 'all'
      });

      // เรียก callback เพื่อ refresh ข้อมูล
      if (onSyncComplete) {
        onSyncComplete({ period: selectedPeriod });
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

  const handlePeriodChange = (period) => {
    setDateRange(prev => ({
      ...prev,
      period,
      startDate: period === 'custom' ? prev.startDate : '',
      endDate: period === 'custom' ? prev.endDate : ''
    }));
  };

  const handleQuickSync = (period) => {
    handlePeriodChange(period);
    executeSyncWithPeriod(period);
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const getDateFromPeriod = (period) => {
    const today = new Date();
    let startDate = new Date();
    
    switch(period) {
      case 'today':
        startDate = today;
        break;
      case 'week':
        startDate.setDate(today.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(today.getMonth() - 1);
        break;
      case '3months':
        startDate.setMonth(today.getMonth() - 3);
        break;
      case '6months':
        startDate.setMonth(today.getMonth() - 6);
        break;
      case 'year':
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      case 'imported_1y':
        return 'ข้อมูลย้อนหลัง 1 ปีก่อนติดตั้งระบบ';
      case 'imported_2y':
        return 'ข้อมูลย้อนหลัง 2 ปีก่อนติดตั้งระบบ';
      case 'imported_3y':
        return 'ข้อมูลย้อนหลัง 3 ปีก่อนติดตั้งระบบ';
      default:
        return '';
    }
    
    return startDate.toISOString().split('T')[0];
  };

  return (
    <div className="sync-container" style={{ marginBottom: '20px', position: 'relative' }}>
      <button
        onClick={() => setShowSyncOptions(!showSyncOptions)}
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
        {!syncing && <span style={{ fontSize: '12px', marginLeft: '4px' }}>▼</span>}
      </button>

      {/* Sync Options Dropdown */}
      {showSyncOptions && !syncing && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          marginTop: '8px',
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          padding: '20px',
          minWidth: '400px',
          zIndex: 1000
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#2d3748', fontSize: '16px' }}>
            เลือกช่วงเวลาที่ต้องการ Sync
          </h4>

          {/* Quick Sync All Button */}
          <button
            onClick={() => handleQuickSync('all')}
            style={{
              width: '100%',
              padding: '12px',
              marginBottom: '16px',
              background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            ⚡ Sync ข้อมูลทั้งหมด
          </button>

          {/* Current Data Section */}
          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 12px 0', color: '#4a5568', fontSize: '14px' }}>
              📊 ข้อมูลปัจจุบัน
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {[
                { value: 'today', label: 'วันนี้' },
                { value: 'week', label: '7 วัน' },
                { value: 'month', label: '1 เดือน' },
                { value: '3months', label: '3 เดือน' },
                { value: '6months', label: '6 เดือน' },
                { value: 'year', label: '1 ปี' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => handleQuickSync(option.value)}
                  style={{
                    padding: '8px 12px',
                    background: '#f7fafc',
                    color: '#4a5568',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#4299e1';
                    e.target.style.color = 'white';
                    e.target.style.borderColor = '#4299e1';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#f7fafc';
                    e.target.style.color = '#4a5568';
                    e.target.style.borderColor = '#e2e8f0';
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Custom Date Range */}
            <button
              onClick={() => handlePeriodChange('custom')}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: dateRange.period === 'custom' ? '#4299e1' : '#f7fafc',
                color: dateRange.period === 'custom' ? 'white' : '#4a5568',
                border: `1px solid ${dateRange.period === 'custom' ? '#4299e1' : '#e2e8f0'}`,
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginBottom: dateRange.period === 'custom' ? '12px' : '0'
              }}
            >
              📅 กำหนดช่วงเวลาเอง
            </button>

            {dateRange.period === 'custom' && (
              <div style={{ 
                padding: '16px', 
                background: '#f7fafc', 
                borderRadius: '8px',
                marginTop: '12px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '6px', 
                      fontSize: '13px', 
                      color: '#4a5568',
                      fontWeight: '500'
                    }}>
                      วันที่เริ่มต้น
                    </label>
                    <input
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                      max={getTodayDate()}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '6px', 
                      fontSize: '13px', 
                      color: '#4a5568',
                      fontWeight: '500'
                    }}>
                      วันที่สิ้นสุด
                    </label>
                    <input
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                      min={dateRange.startDate}
                      max={getTodayDate()}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                </div>
                <button
                  onClick={() => executeSyncWithPeriod('custom')}
                  disabled={!dateRange.startDate || !dateRange.endDate}
                  style={{
                    width: '100%',
                    marginTop: '12px',
                    padding: '8px 16px',
                    background: (!dateRange.startDate || !dateRange.endDate) ? '#cbd5e0' : '#4299e1',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: (!dateRange.startDate || !dateRange.endDate) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Sync ช่วงเวลาที่เลือก
                </button>
              </div>
            )}
          </div>

          <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />

          {/* Historical Data Section */}
          <div>
            <h5 style={{ margin: '0 0 12px 0', color: '#4a5568', fontSize: '14px' }}>
              📥 ข้อมูลย้อนหลัง (ก่อนติดตั้งระบบ)
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { value: 'imported_1y', label: '📥 1 ปี' },
                { value: 'imported_2y', label: '📥 2 ปี' },
                { value: 'imported_3y', label: '📥 3 ปี' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => handleQuickSync(option.value)}
                  style={{
                    padding: '8px 12px',
                    background: '#f7fafc',
                    color: '#4a5568',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#764ba2';
                    e.target.style.color = 'white';
                    e.target.style.borderColor = '#764ba2';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#f7fafc';
                    e.target.style.color = '#4a5568';
                    e.target.style.borderColor = '#e2e8f0';
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: '#fef5e7',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#8b6914'
            }}>
              <strong>⚠️ หมายเหตุ:</strong> การดึงข้อมูลย้อนหลังจะดึงเฉพาะลูกค้าที่เคยส่งข้อความก่อนติดตั้งระบบ
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={() => setShowSyncOptions(false)}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'none',
              border: 'none',
              fontSize: '20px',
              color: '#718096',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.background = '#f7fafc'}
            onMouseLeave={(e) => e.target.style.background = 'none'}
          >
            ✕
          </button>
        </div>
      )}

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

      <style>{`
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