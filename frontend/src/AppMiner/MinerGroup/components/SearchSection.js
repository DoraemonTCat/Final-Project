// MinerGroup/components/SearchSection.js
import React from 'react';

/**
 * SearchSection Component
 * จัดการส่วนการค้นหากลุ่มลูกค้า
 * - แสดง input สำหรับค้นหา
 * - รับค่าการค้นหาและส่งกลับไปยัง parent component
 */
const SearchSection = ({ searchTerm, onSearchChange, disabled }) => {
  return (
    <div className="search-section">
      <div className="search-box">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          placeholder="    ค้นหากลุ่มลูกค้า..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
          disabled={disabled}  style={{paddingLeft: '50px'}}
        />
      </div>
    </div>
  );
};

export default SearchSection;