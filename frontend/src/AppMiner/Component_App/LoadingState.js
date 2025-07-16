// components/LoadingState.js
// =====================================================
// COMPONENT: LoadingState
// PURPOSE: แสดงสถานะกำลังโหลดข้อมูล
// FEATURES:
// - แสดง loading spinner
// - แสดงข้อความกำลังโหลด
// =====================================================
export const LoadingState = () => (
  <div className="loading-container">
    <div className="loading-spinner"></div>
    <p className="loading-text">กำลังโหลดข้อมูล...</p>
  </div>
);

export default LoadingState; // ✅
