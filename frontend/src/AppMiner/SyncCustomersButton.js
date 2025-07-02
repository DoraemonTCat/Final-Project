import React, { useState } from 'react';

export default function SyncCustomersButton({ selectedPage, onSyncComplete }) {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
    period: 'all' // all, today, week, month, custom
  });

  const handleSync = async () => {
    if (!selectedPage) {
      alert('กรุณาเลือกเพจก่อน');
      return;
    }

    setSyncing(true);
    setSyncStatus(null);

    try {
      // เตรียม query parameters สำหรับช่วงเวลา
      let queryParams = '';
      if (dateRange.period === 'custom' && dateRange.startDate && dateRange.endDate) {
        queryParams = `?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`;
      } else if (dateRange.period !== 'all') {
        queryParams = `?period=${dateRange.period}`;
      }

      const response = await fetch(`http://localhost:8000/sync-customers/${selectedPage}${queryParams}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const result = await response.json();
      
      setSyncStatus({
        type: 'success',
        message: `Sync สำเร็จ! ดึงข้อมูล ${result.synced} คน`
      });

      // รีเซ็ตการเลือกช่วงเวลา
      setShowDateFilter(false);
      setDateRange({
        startDate: '',
        endDate: '',
        period: 'all'
      });

      // เรียก callback เพื่อ refresh ข้อมูล พร้อมส่งข้อมูลช่วงเวลา
      if (onSyncComplete) {
        onSyncComplete(dateRange);
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
      default:
        return '';
    }
    
    return startDate.toISOString().split('T')[0];
  };

  return (
    <div className="sync-container" style={{ marginBottom: '20px', position: 'relative' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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

        <button
          onClick={() => setShowDateFilter(!showDateFilter)}
          disabled={syncing}
          style={{
            padding: '12px 20px',
            background: 'white',
            color: '#4a5568',
            border: '2px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.3s ease'
          }}
        >
          📅 {dateRange.period === 'all' ? 'ทั้งหมด' : 
              dateRange.period === 'today' ? 'วันนี้' :
              dateRange.period === 'week' ? '7 วันที่แล้ว' :
              dateRange.period === 'month' ? '1 เดือนที่แล้ว' :
              dateRange.period === '3months' ? '3 เดือนที่แล้ว' :
              dateRange.period === '6months' ? '6 เดือนที่แล้ว' :
              dateRange.period === 'year' ? '1 ปีที่แล้ว' :
              'กำหนดเอง'}
          <span style={{ fontSize: '12px' }}>{showDateFilter ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* Date Filter Dropdown */}
      {showDateFilter && (
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
          minWidth: '350px',
          zIndex: 1000
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#2d3748', fontSize: '16px' }}>
            เลือกช่วงเวลาที่ต้องการ Sync
          </h4>

          {/* Quick Period Selection */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { value: 'all', label: 'ทั้งหมด' },
                { value: 'today', label: 'วันนี้' },
                { value: 'week', label: '7 วัน' },
                { value: 'month', label: '1 เดือน' },
                { value: '3months', label: '3 เดือน' },
                { value: '6months', label: '6 เดือน' },
                { value: 'year', label: '1 ปี' },
                { value: 'custom', label: 'กำหนดเอง' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => handlePeriodChange(option.value)}
                  style={{
                    padding: '8px 12px',
                    background: dateRange.period === option.value ? '#4299e1' : '#f7fafc',
                    color: dateRange.period === option.value ? 'white' : '#4a5568',
                    border: `1px solid ${dateRange.period === option.value ? '#4299e1' : '#e2e8f0'}`,
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          {dateRange.period === 'custom' && (
            <div style={{ 
              padding: '16px', 
              background: '#f7fafc', 
              borderRadius: '8px',
              marginBottom: '16px'
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
            </div>
          )}

          {/* Preview */}
          <div style={{
            padding: '12px',
            background: '#e6f3ff',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#2b6cb0'
          }}>
            <strong>ช่วงเวลาที่เลือก:</strong> {
              dateRange.period === 'all' ? 'ดึงข้อมูลทั้งหมด' :
              dateRange.period === 'today' ? `เฉพาะวันนี้ (${getTodayDate()})` :
              dateRange.period === 'custom' && dateRange.startDate && dateRange.endDate ? 
                `${new Date(dateRange.startDate).toLocaleDateString('th-TH')} - ${new Date(dateRange.endDate).toLocaleDateString('th-TH')}` :
              dateRange.period === 'custom' ? 'กรุณาเลือกวันที่' :
              `${getDateFromPeriod(dateRange.period)} - ${getTodayDate()}`
            }
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setShowDateFilter(false);
                setDateRange({ startDate: '', endDate: '', period: 'all' });
              }}
              style={{
                padding: '8px 16px',
                background: '#e2e8f0',
                color: '#4a5568',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              ยกเลิก
            </button>
            <button
              onClick={() => {
                setShowDateFilter(false);
                handleSync();
              }}
              disabled={dateRange.period === 'custom' && (!dateRange.startDate || !dateRange.endDate)}
              style={{
                padding: '8px 16px',
                background: '#4299e1',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                opacity: dateRange.period === 'custom' && (!dateRange.startDate || !dateRange.endDate) ? 0.5 : 1
              }}
            >
              ตกลง
            </button>
          </div>
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