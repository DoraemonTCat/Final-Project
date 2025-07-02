import React from 'react';

export default function DateFilterBadge({ dateRange, onClear }) {
  if (!dateRange || dateRange.period === 'all') return null;

  const getFilterText = () => {
    switch (dateRange.period) {
      case 'today':
        return 'วันนี้';
      case 'week':
        return '7 วันที่แล้ว';
      case 'month':
        return '1 เดือนที่แล้ว';
      case '3months':
        return '3 เดือนที่แล้ว';
      case '6months':
        return '6 เดือนที่แล้ว';
      case 'year':
        return '1 ปีที่แล้ว';
      case 'custom':
        if (dateRange.startDate && dateRange.endDate) {
          return `${new Date(dateRange.startDate).toLocaleDateString('th-TH')} - ${new Date(dateRange.endDate).toLocaleDateString('th-TH')}`;
        }
        return 'กำหนดเอง';
      default:
        return '';
    }
  };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      border: '1px solid #f59e0b',
      borderRadius: '20px',
      fontSize: '14px',
      fontWeight: '500',
      color: '#92400e'
    }}>
      <span>📅 กำลังแสดง: {getFilterText()}</span>
      <button
        onClick={onClear}
        style={{
          background: 'none',
          border: 'none',
          color: '#92400e',
          cursor: 'pointer',
          fontSize: '16px',
          padding: '0 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.2)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
        }}
      >
        ✕
      </button>
    </div>
  );
}