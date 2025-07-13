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

  
}