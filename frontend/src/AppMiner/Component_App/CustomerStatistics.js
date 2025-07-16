// components/CustomerStatistics.js
// =====================================================
// COMPONENT: CustomerStatistics
// PURPOSE: แสดงสถิติของลูกค้าในเพจ
// FEATURES:
// - โหลดสถิติจาก API
// - แสดงจำนวนลูกค้าทั้งหมด
// - แสดงลูกค้าที่ active ในช่วงต่างๆ
// =====================================================

import React, { useState, useEffect } from 'react';

const CustomerStatistics = ({ selectedPage }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedPage) {
      loadStatistics();
    }
  }, [selectedPage]);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/customer-statistics/${selectedPage}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.statistics);
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!stats || loading) return null;

  return (
    <div className="customer-statistics">
      {/* Statistics display will be added based on requirements */}
    </div>
  );
};

export default CustomerStatistics;