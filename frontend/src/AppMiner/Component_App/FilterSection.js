// components/FilterSection.js
// =====================================================
// COMPONENT: FilterSection
// PURPOSE: จัดการการกรองข้อมูลต่างๆ
// FEATURES:
// - กรองตามระยะเวลาที่หายไป
// - กรองตามหมวดหมู่ลูกค้า
// - กรองตาม Platform
// - กรองตามสถานะการขุด
// - กรองตามช่วงวันที่
// =====================================================

import React from 'react';

const FilterSection = ({ 
  showFilter, 
  onToggleFilter, 
  filters, 
  onFilterChange, 
  onApplyFilters, 
  onClearFilters 
}) => {
  const handleFilterChange = (field, value) => {
    onFilterChange({
      ...filters,
      [field]: value
    });
  };

  return (
    <div className="filter-section">
      <button
        className="filter-toggle-btn"
        onClick={onToggleFilter}
      >
        <span className="btn-icon">🔍</span>
        <span>ตัวกรองขั้นสูง</span>
        <span className={`toggle-arrow ${showFilter ? 'open' : ''}`}>▼</span>
      </button>

      {showFilter && (
        <div className="filter-panel">
          <div className="filter-grid">
            <div className="filter-group">
              <label className="filter-label">ระยะเวลาที่หายไป</label>
              <select
                className="filter-select"
                value={filters.disappearTime}
                onChange={(e) => handleFilterChange('disappearTime', e.target.value)}
              >
                <option value="">ทั้งหมด</option>
                <option value="1d">ภายใน 1 วัน</option>
                <option value="3d">ภายใน 3 วัน</option>
                <option value="7d">ภายใน 1 สัปดาห์</option>
                <option value="1m">ภายใน 1 เดือน</option>
                <option value="3m">ภายใน 3 เดือน</option>
                <option value="6m">ภายใน 6 เดือน</option>
                <option value="1y">ภายใน 1 ปี</option>
                <option value="over1y">มากกว่า 1 ปี</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">หมวดหมู่ลูกค้า</label>
              <select
                className="filter-select"
                value={filters.customerType}
                onChange={(e) => handleFilterChange('customerType', e.target.value)}
              >
                <option value="">ทั้งหมด</option>
                <option value="newCM">ลูกค้าใหม่</option>
                <option value="intrestCM">สนใจสินค้าสูง</option>
                <option value="dealDoneCM">ใกล้ปิดการขาย</option>
                <option value="exCM">ลูกค้าเก่า</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Platform</label>
              <select
                className="filter-select"
                value={filters.platformType}
                onChange={(e) => handleFilterChange('platformType', e.target.value)}
              >
                <option value="">ทั้งหมด</option>
                <option value="FB">Facebook</option>
                <option value="Line">Line</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">สถานะการขุด</label>
              <select
                className="filter-select"
                value={filters.miningStatus}
                onChange={(e) => handleFilterChange('miningStatus', e.target.value)}
              >
                <option value="">ทั้งหมด</option>
                <option value="0Mining">ยังไม่ขุด</option>
                <option value="Mining">ขุดแล้ว</option>
                <option value="returnCM">มีการตอบกลับ</option>
              </select>
            </div>

            <div className="filter-group date-range">
              <label className="filter-label">ช่วงวันที่</label>
              <div className="date-inputs">
                <input
                  type="date"
                  className="filter-input date-input"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  placeholder="วันที่เริ่มต้น"
                />
                <span className="date-separator">ถึง</span>
                <input
                  type="date"
                  className="filter-input date-input"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  placeholder="วันที่สิ้นสุด"
                />
              </div>
            </div>
          </div>

          <div className="filter-actions">
            <button onClick={onApplyFilters} className="apply-filter-btn">
              <span className="btn-icon">✨</span>
              ใช้ตัวกรอง
            </button>
            <button onClick={onClearFilters} className="clear-filter-btn">
              <span className="btn-icon">🗑️</span>
              ล้างตัวกรอง
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterSection;