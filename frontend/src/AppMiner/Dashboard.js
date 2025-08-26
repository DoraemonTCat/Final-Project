/**
 * Dashboard.js - Main Dashboard Component
 * ========================================
 * หน้า Dashboard หลักสำหรับแสดงภาพรวมระบบ
 * - แสดงสถิติลูกค้า
 * - กราฟแนวโน้ม
 * - ข้อมูลประเภทลูกค้า
 * - กิจกรรมล่าสุด
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Area, AreaChart 
} from 'recharts';
import Sidebar from "./Sidebar";
import '../CSS/Dashboard.css'; 

const Dashboard = () => {
  // =====================================================
  // STATE MANAGEMENT
  // =====================================================
  
  /**
   * State สำหรับจัดการข้อมูลต่างๆ
   */
  const [selectedPage, setSelectedPage] = useState('');
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // สถิติหลัก
  const [stats, setStats] = useState({
    totalCustomers: 0,
    newCustomersToday: 0,
    activeCustomers7Days: 0,
    totalConversations: 0,
    totalMessagesSent: 0,
    avgResponseTime: '0',
    growthRate: 0
  });
  
  // ข้อมูลกราฟและการแสดงผล
  const [customersByDate, setCustomersByDate] = useState([]);
  const [customersByType, setCustomersByType] = useState([]);
  const [inactivityData, setInactivityData] = useState([]);
  const [messageSchedules, setMessageSchedules] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [retargetTiers, setRetargetTiers] = useState([]);

  // =====================================================
  // DATA FETCHING FUNCTIONS
  // =====================================================
  
  /**
   * โหลดข้อมูลเพจทั้งหมด
   */
  const fetchPages = async () => {
    try {
      const response = await fetch('http://localhost:8000/pages');
      const data = await response.json();
      const pagesData = data.pages || data || [];
      setPages(pagesData);
      
      // เลือกเพจแรกอัตโนมัติ
      if (pagesData.length > 0) {
        const savedPage = localStorage.getItem("selectedPage");
        const pageToSelect = savedPage && pagesData.find(p => p.id === savedPage) 
          ? savedPage 
          : pagesData[0].id;
        setSelectedPage(pageToSelect);
      }
    } catch (error) {
      console.error('Error fetching pages:', error);
    }
  };

  /**
   * โหลดสถิติหลักของเพจ
   * @param {string} pageId - ID ของเพจที่ต้องการโหลดข้อมูล
   */
  const fetchMainStats = async (pageId) => {
    if (!pageId) return;
    
    try {
      // ดึงข้อมูลลูกค้า
      const customersRes = await fetch(`http://localhost:8000/fb-customers/by-page/${pageId}`);
      const customers = await customersRes.json();
      
      // ดึงสถิติลูกค้า
      const statsRes = await fetch(`http://localhost:8000/customer-statistics/${pageId}`);
      const statsData = await statsRes.json();
      
      // คำนวณสถิติ
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const newToday = customers.filter(c => {
        const createdDate = new Date(c.created_at);
        createdDate.setHours(0, 0, 0, 0);
        return createdDate.getTime() === today.getTime();
      }).length;
      
      // คำนวณอัตราการเติบโต (เทียบกับเมื่อ 7 วันที่แล้ว)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const customersSevenDaysAgo = customers.filter(c => 
        new Date(c.created_at) < sevenDaysAgo
      ).length;
      
      const growthRate = customersSevenDaysAgo > 0 
        ? ((customers.length - customersSevenDaysAgo) / customersSevenDaysAgo * 100).toFixed(1)
        : 0;
      
      setStats({
        totalCustomers: statsData?.statistics?.total_customers || customers.length,
        newCustomersToday: newToday,
        activeCustomers7Days: statsData?.statistics?.active_7days || 0,
        totalConversations: customers.length,
        totalMessagesSent: Math.floor(customers.length * 2.5), // Mock data
        avgResponseTime: '15 นาที', // Mock data
        growthRate: parseFloat(growthRate)
      });
      
      // จัดกลุ่มลูกค้าตามวันที่
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = customers.filter(c => 
          c.created_at && c.created_at.startsWith(dateStr)
        ).length;
        
        last7Days.push({
          date: date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
          customers: count
        });
      }
      setCustomersByDate(last7Days);
      
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  /**
   * โหลดข้อมูลประเภทลูกค้า
   * @param {string} pageId - ID ของเพจ
   */
  const fetchCustomerTypes = async (pageId) => {
    if (!pageId) return;
    
    try {
      const response = await fetch(`http://localhost:8000/fb-customers/by-page/${pageId}`);
      const customers = await response.json();
      
      // นับจำนวนลูกค้าตาม Knowledge Type
      const typeCount = {};
      customers.forEach(customer => {
        const typeName = customer.customer_type_knowledge_name || 'ยังไม่จัดกลุ่ม';
        typeCount[typeName] = (typeCount[typeName] || 0) + 1;
      });
      
      const pieData = Object.entries(typeCount).map(([name, value]) => ({
        name,
        value,
        percentage: ((value / customers.length) * 100).toFixed(1)
      }));
      
      setCustomersByType(pieData);
      
      // คำนวณข้อมูล Inactivity
      const inactivityRanges = [
        { name: '< 1 วัน', min: 0, max: 1, count: 0 },
        { name: '1-3 วัน', min: 1, max: 3, count: 0 },
        { name: '3-7 วัน', min: 3, max: 7, count: 0 },
        { name: '7-30 วัน', min: 7, max: 30, count: 0 },
        { name: '> 30 วัน', min: 30, max: Infinity, count: 0 }
      ];
      
      customers.forEach(customer => {
        if (customer.last_interaction_at) {
          const lastInteraction = new Date(customer.last_interaction_at);
          const now = new Date();
          const diffDays = Math.floor((now - lastInteraction) / (1000 * 60 * 60 * 24));
          
          const range = inactivityRanges.find(r => diffDays >= r.min && diffDays < r.max);
          if (range) range.count++;
        }
      });
      
      setInactivityData(inactivityRanges.map(r => ({
        name: r.name,
        value: r.count
      })));
      
    } catch (error) {
      console.error('Error fetching customer types:', error);
    }
  };

  /**
   * โหลดข้อมูล Message Schedules
   * @param {string} pageId - ID ของเพจ
   */
  const fetchSchedules = async (pageId) => {
    if (!pageId) return;
    
    try {
      // ดึงข้อมูล page ID จาก database
      const pageRes = await fetch('http://localhost:8000/pages/');
      const pagesData = await pageRes.json();
      const pageInfo = pagesData.find(p => p.page_id === pageId);
      
      if (pageInfo && pageInfo.ID) {
        const response = await fetch(`http://localhost:8000/all-schedules/${pageId}`);
        const data = await response.json();
        
        if (data.schedules) {
          // สรุปจำนวน schedules ตามประเภท
          const scheduleSummary = {
            immediate: 0,
            scheduled: 0,
            afterInactive: 0
          };
          
          data.schedules.forEach(group => {
            group.schedules.forEach(schedule => {
              if (schedule.send_type === 'immediate') scheduleSummary.immediate++;
              else if (schedule.send_type === 'scheduled') scheduleSummary.scheduled++;
              else if (schedule.send_type === 'after_inactive') scheduleSummary.afterInactive++;
            });
          });
          
          setMessageSchedules([
            { name: 'ส่งทันที', value: scheduleSummary.immediate, color: '#48bb78' },
            { name: 'ตั้งเวลา', value: scheduleSummary.scheduled, color: '#4299e1' },
            { name: 'เมื่อไม่ตอบ', value: scheduleSummary.afterInactive, color: '#ed8936' }
          ]);
        }
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  /**
   * โหลดข้อมูล Retarget Tiers
   * @param {string} pageId - ID ของเพจ
   */
  const fetchRetargetTiers = async (pageId) => {
    if (!pageId) return;
    
    try {
      const response = await fetch(`http://localhost:8000/retarget-tiers/${pageId}`);
      const data = await response.json();
      
      if (data.tiers) {
        setRetargetTiers(data.tiers);
      }
    } catch (error) {
      console.error('Error fetching retarget tiers:', error);
    }
  };

  /**
   * โหลดกิจกรรมล่าสุด
   * @param {string} pageId - ID ของเพจ
   */
  const fetchRecentActivities = async (pageId) => {
    if (!pageId) return;
    
    try {
      const response = await fetch(`http://localhost:8000/fb-customers/by-page/${pageId}`);
      const customers = await response.json();
      
      // เรียงตามเวลาล่าสุด
      const sortedCustomers = customers
        .filter(c => c.last_interaction_at)
        .sort((a, b) => new Date(b.last_interaction_at) - new Date(a.last_interaction_at))
        .slice(0, 10);
      
      const activities = sortedCustomers.map(customer => {
        const time = new Date(customer.last_interaction_at);
        const now = new Date();
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        let timeAgo = '';
        if (diffDays > 0) timeAgo = `${diffDays} วันที่แล้ว`;
        else if (diffHours > 0) timeAgo = `${diffHours} ชั่วโมง`;
        else if (diffMins > 0) timeAgo = `${diffMins} นาทีที่แล้ว`;
        else timeAgo = 'เมื่อสักครู่';
        
        return {
          id: customer.customer_psid,
          name: customer.name || 'ไม่ระบุชื่อ',
          action: customer.source_type === 'new' ? 'ลูกค้าใหม่' : 'ส่งข้อความ',
          time: timeAgo,
          type: customer.customer_type_knowledge_name || 'ยังไม่จัดกลุ่ม'
        };
      });
      
      setRecentActivities(activities);
      
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  // =====================================================
  // LIFECYCLE HOOKS
  // =====================================================
  
  /**
   * Initial load - โหลดข้อมูลเพจเมื่อ component mount
   */
  useEffect(() => {
    fetchPages();
  }, []);

  /**
   * โหลดข้อมูลทั้งหมดเมื่อเปลี่ยนเพจ
   */
  useEffect(() => {
    if (selectedPage) {
      setLoading(true);
      Promise.all([
        fetchMainStats(selectedPage),
        fetchCustomerTypes(selectedPage),
        fetchSchedules(selectedPage),
        fetchRetargetTiers(selectedPage),
        fetchRecentActivities(selectedPage)
      ]).finally(() => {
        setLoading(false);
      });
    }
  }, [selectedPage]);

  /**
   * จัดการเมื่อมีการเปลี่ยนเพจจากภายนอก
   */
  useEffect(() => {
    const handlePageChange = (event) => {
      const newPageId = event.detail.pageId;
      setSelectedPage(newPageId);
    };
    
    window.addEventListener('pageChanged', handlePageChange);

    return () => {
      window.removeEventListener('pageChanged', handlePageChange);
    };
  }, []);

  // =====================================================
  // UI COMPONENTS & HELPERS
  // =====================================================
  
  // สีสำหรับ Pie Chart
  const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4299e1', '#48bb78', '#ed8936'];

  /**
   * Custom Tooltip Component สำหรับ Charts
   */
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="main-custom-tooltip">
          <p className="main-tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="main-tooltip-value" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // =====================================================
  // MAIN RENDER
  // =====================================================

  return (
    <div className="main-dashboard-container">
      {/* Header Section */}
      <div className="main-dashboard-header">
        <div>
          <Sidebar />
        </div>
        
        <div className="main-dashboard-header-content">
          <h1 className="main-dashboard-title">
            📊 Dashboard ภาพรวมระบบ
          </h1>
          <p className="main-dashboard-subtitle">
            ข้อมูลสถิติและการวิเคราะห์สำหรับการตัดสินใจทางธุรกิจ
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-dashboard-content">
        
        {/* Stats Cards */}
        <div className="main-stats-grid">
          {/* Total Customers Card */}
          <div className="main-stat-card">
            <div className="main-stat-card-decoration main-stat-decoration-purple"></div>
            <div className="main-stat-content">
              <div className="main-stat-header">
                <div>
                  <p className="main-stat-label">ลูกค้าทั้งหมด</p>
                  <h2 className="main-stat-value">
                    {stats.totalCustomers.toLocaleString()}
                  </h2>
                </div>
                <div className="main-stat-icon-box main-stat-icon-purple">
                  👥
                </div>
              </div>
              {stats.growthRate > 0 && (
                <div className="main-stat-growth">
                  <span>↑</span>
                  <span>{stats.growthRate}% จากสัปดาห์ที่แล้ว</span>
                </div>
              )}
            </div>
          </div>

          {/* New Customers Today */}
          <div className="main-stat-card">
            <div className="main-stat-card-decoration main-stat-decoration-green"></div>
            <div className="main-stat-content">
              <div className="main-stat-header">
                <div>
                  <p className="main-stat-label">ลูกค้าใหม่วันนี้</p>
                  <h2 className="main-stat-value">
                    {stats.newCustomersToday}
                  </h2>
                </div>
                <div className="main-stat-icon-box main-stat-icon-green">
                  🆕
                </div>
              </div>
            </div>
          </div>

          {/* Active Customers */}
          <div className="main-stat-card">
            <div className="main-stat-card-decoration main-stat-decoration-blue"></div>
            <div className="main-stat-content">
              <div className="main-stat-header">
                <div>
                  <p className="main-stat-label">ลูกค้าที่ Active (7 วัน)</p>
                  <h2 className="main-stat-value">
                    {stats.activeCustomers7Days}
                  </h2>
                </div>
                <div className="main-stat-icon-box main-stat-icon-blue">
                  ⚡
                </div>
              </div>
            </div>
          </div>

          {/* Messages Sent */}
          <div className="main-stat-card">
            <div className="main-stat-card-decoration main-stat-decoration-orange"></div>
            <div className="main-stat-content">
              <div className="main-stat-header">
                <div>
                  <p className="main-stat-label">ข้อความที่ส่ง</p>
                  <h2 className="main-stat-value">
                    {stats.totalMessagesSent.toLocaleString()}
                  </h2>
                </div>
                <div className="main-stat-icon-box main-stat-icon-orange">
                  💬
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="main-charts-row main-charts-row-2col">
          {/* Customer Growth Chart */}
          <div className="main-chart-card">
            <h3 className="main-chart-title">
              📈 แนวโน้มลูกค้าใหม่ (7 วันล่าสุด)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={customersByDate}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#718096" />
                <YAxis stroke="#718096" />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="customers"
                  stroke="#667eea"
                  fill="url(#colorGradient)"
                  strokeWidth={2}
                />
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#667eea" stopOpacity={0} />
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Customer Types Pie Chart */}
          <div className="main-chart-card">
            <h3 className="main-chart-title">
              🎯 หมวดหมู่ลูกค้า
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={customersByType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {customersByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Legend */}
            <div className="main-pie-legend">
              {customersByType.map((entry, index) => (
                <div key={entry.name} className="main-pie-legend-item">
                  <div 
                    className="main-pie-legend-color"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span className="main-pie-legend-text">
                    {entry.name} ({entry.value})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="main-charts-row main-charts-row-3col">
          {/* Inactivity Distribution */}
          <div className="main-chart-card">
            <h3 className="main-chart-title">
              ⏰ ระยะเวลาที่ลูกค้าหายไป
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={inactivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#718096" fontSize={12} />
                <YAxis stroke="#718096" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#764ba2" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Message Schedules */}
          <div className="main-chart-card">
            <h3 className="main-chart-title">
              📅 ประเภทการส่งข้อความ
            </h3>
            {messageSchedules.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={messageSchedules}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {messageSchedules.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ marginTop: '10px' }}>
                  {messageSchedules.map((item, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                      fontSize: '14px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          backgroundColor: item.color,
                          borderRadius: '50%'
                        }}></div>
                        <span style={{ color: '#4a5568' }}>{item.name}</span>
                      </div>
                      <span style={{ fontWeight: '600', color: '#2d3748' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="main-empty-state">
                ยังไม่มีข้อมูล Schedule
              </div>
            )}
          </div>

          {/* Retarget Tiers */}
          <div className="main-chart-card">
            <h3 className="main-chart-title">
              🎯 Retarget Tiers
            </h3>
            {retargetTiers.length > 0 ? (
              <div>
                {retargetTiers.map((tier, index) => (
                  <div 
                    key={tier.id} 
                    className="main-tier-item"
                    style={{
                      background: `linear-gradient(135deg, ${COLORS[index % COLORS.length]}15 0%, ${COLORS[index % COLORS.length]}05 100%)`,
                      borderLeft: `4px solid ${COLORS[index % COLORS.length]}`
                    }}
                  >
                    <span className="main-tier-name">
                      {tier.tier_name}
                    </span>
                    <span 
                      className="main-tier-days"
                      style={{ background: COLORS[index % COLORS.length] }}
                    >
                      {tier.days_since_last_contact} วัน
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="main-empty-state">
                ยังไม่มีข้อมูล Tiers
              </div>
            )}
          </div>
        </div>

        {/* Recent Activities Table */}
        <div className="main-chart-card">
          <h3 className="main-chart-title">
            🔔 กิจกรรมล่าสุด
          </h3>
          {recentActivities.length > 0 ? (
            <div className="main-table-container">
              <table className="main-activities-table">
                <thead>
                  <tr>
                    <th>ลูกค้า</th>
                    <th>กิจกรรม</th>
                    <th>ประเภท</th>
                    <th>เวลา</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivities.map((activity) => (
                    <tr key={activity.id}>
                      <td>
                        <div className="main-user-cell">
                          <div className="main-user-avatar">
                            {activity.name.charAt(0)}
                          </div>
                          <span className="main-user-name">
                            {activity.name}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`main-activity-badge ${
                          activity.action === 'ลูกค้าใหม่' 
                            ? 'main-activity-badge-new' 
                            : 'main-activity-badge-message'
                        }`}>
                          {activity.action}
                        </span>
                      </td>
                      <td className="main-activity-type">
                        {activity.type}
                      </td>
                      <td className="main-activity-time">
                        {activity.time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="main-empty-state-large">
              ยังไม่มีกิจกรรมล่าสุด
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Dashboard;