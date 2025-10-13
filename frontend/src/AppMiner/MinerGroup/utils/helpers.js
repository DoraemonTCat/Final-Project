// MinerGroup/utils/helpers.js
export const getPageDbId = async (pageId) => {
  try {
    const response = await fetch('http://localhost:8000/pages/');
    if (!response.ok) throw new Error('Failed to fetch pages');
    
    const data = await response.json();
    const pagesData = data.pages || []; // ✅ เข้าถึง array ที่อยู่ใน key "pages"

    const currentPage = pagesData.find(
      p => p.page_id === pageId || p.id === pageId
    );

    return currentPage ? currentPage.ID : null;
  } catch (error) {
    console.error('Error getting page DB ID:', error);
    return null;
  }
};

export const getSchedulesForPage = (pageId) => {
  if (!pageId) return [];
  const key = `miningSchedules_${pageId}`;
  return JSON.parse(localStorage.getItem(key) || '[]');
};

export const saveSchedulesForPage = (pageId, schedules) => {
  if (!pageId) return;
  const key = `miningSchedules_${pageId}`;
  localStorage.setItem(key, JSON.stringify(schedules));
};