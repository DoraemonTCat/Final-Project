import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import Sidebar from "./Sidebar";

const Dashboard = () => {
  // =====================================================
  // STATE MANAGEMENT
  // =====================================================
  const [selectedPage, setSelectedPage] = useState('');
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    newCustomersToday: 0,
    activeCustomers7Days: 0,
    totalConversations: 0,
    totalMessagesSent: 0,
    avgResponseTime: '0',
    growthRate: 0
  });
  const [customersByDate, setCustomersByDate] = useState([]);
  const [customersByType, setCustomersByType] = useState([]);
  const [inactivityData, setInactivityData] = useState([]);
  const [messageSchedules, setMessageSchedules] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [retargetTiers, setRetargetTiers] = useState([]);

  // =====================================================
  // DATA FETCHING FUNCTIONS
  // =====================================================
  
  // โหลดข้อมูลเพจ
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

  // โหลดสถิติหลัก
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

  // โหลดข้อมูลประเภทลูกค้า
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

  // โหลดข้อมูล Schedules
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

  // โหลดข้อมูล Retarget Tiers
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

  // โหลดกิจกรรมล่าสุด
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
        else if (diffHours > 0) timeAgo = `${diffHours} ชั่วโมงที่แล้ว`;
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
  
  useEffect(() => {
    fetchPages();
  }, []);

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

  // =====================================================
  // UI COMPONENTS
  // =====================================================
  
  // สีสำหรับ Pie Chart
  const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4299e1', '#48bb78', '#ed8936'];

  // Custom Tooltip สำหรับ Charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ margin: '4px 0', color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

   
//  Load Data เมื่อ selectedPage เปลี่ยน
useEffect(() => {
  const handlePageChange = (event) => {
    const newPageId = event.detail.pageId;
    setSelectedPage(newPageId);
  };
  window.addEventListener('pageChanged', handlePageChange);

  // โหลดเพจครั้งแรก
  fetchPages();

  return () => {
    window.removeEventListener('pageChanged', handlePageChange);
  };
}, []);


  // =====================================================
  // MAIN RENDER
  // =====================================================
  

  return (

    
    <div style={{
      minHeight: '100vh',
      background: '#f5f7fa',
      paddingLeft: '240px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif'
    }}>
      {/* Header Section */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '40px',
        color: 'white'
      }}>

        <div>
         <Sidebar />
        </div>
        
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            📊 Dashboard ภาพรวมระบบ
          </h1>
          <p style={{ opacity: 0.9, margin: 0 }}>
            ข้อมูลสถิติและการวิเคราะห์สำหรับการตัดสินใจทางธุรกิจ
          </p>
          
          {/* Page Selector */}
          
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          {/* Total Customers Card */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '100px',
              height: '100px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '50%',
              opacity: '0.1'
            }}></div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: '#718096', fontSize: '14px', margin: '0 0 8px 0' }}>
                    ลูกค้าทั้งหมด
                  </p>
                  <h2 style={{ fontSize: '32px', fontWeight: '700', margin: 0, color: '#2d3748' }}>
                    {stats.totalCustomers.toLocaleString()}
                  </h2>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  👥
                </div>
              </div>
              {stats.growthRate > 0 && (
                <div style={{
                  marginTop: '12px',
                  fontSize: '12px',
                  color: '#48bb78',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>↑</span>
                  <span>{stats.growthRate}% จากสัปดาห์ที่แล้ว</span>
                </div>
              )}
            </div>
          </div>

          {/* New Customers Today */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '100px',
              height: '100px',
              background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
              borderRadius: '50%',
              opacity: '0.1'
            }}></div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: '#718096', fontSize: '14px', margin: '0 0 8px 0' }}>
                    ลูกค้าใหม่วันนี้
                  </p>
                  <h2 style={{ fontSize: '32px', fontWeight: '700', margin: 0, color: '#2d3748' }}>
                    {stats.newCustomersToday}
                  </h2>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  🆕
                </div>
              </div>
            </div>
          </div>

          {/* Active Customers */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '100px',
              height: '100px',
              background: 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)',
              borderRadius: '50%',
              opacity: '0.1'
            }}></div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: '#718096', fontSize: '14px', margin: '0 0 8px 0' }}>
                    ลูกค้าที่ Active (7 วัน)
                  </p>
                  <h2 style={{ fontSize: '32px', fontWeight: '700', margin: 0, color: '#2d3748' }}>
                    {stats.activeCustomers7Days}
                  </h2>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  ⚡
                </div>
              </div>
            </div>
          </div>

          {/* Messages Sent */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.07)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '100px',
              height: '100px',
              background: 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)',
              borderRadius: '50%',
              opacity: '0.1'
            }}></div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: '#718096', fontSize: '14px', margin: '0 0 8px 0' }}>
                    ข้อความที่ส่ง
                  </p>
                  <h2 style={{ fontSize: '32px', fontWeight: '700', margin: 0, color: '#2d3748' }}>
                    {stats.totalMessagesSent.toLocaleString()}
                  </h2>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #ed8936 0%, #dd6b20 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  💬
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '20px',
          marginBottom: '20px'
        }}>
          {/* Customer Growth Chart */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.07)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600', color: '#2d3748' }}>
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
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.07)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600', color: '#2d3748' }}>
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
            <div style={{ marginTop: '20px' }}>
              {customersByType.map((entry, index) => (
                <div key={entry.name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    backgroundColor: COLORS[index % COLORS.length],
                    borderRadius: '2px',
                    marginRight: '8px'
                  }}></div>
                  <span style={{ fontSize: '14px', color: '#4a5568' }}>
                    {entry.name} ({entry.value})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '20px',
          marginBottom: '20px'
        }}>
          {/* Inactivity Distribution */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.07)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600', color: '#2d3748' }}>
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
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.07)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600', color: '#2d3748' }}>
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
              <div style={{
                height: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a0aec0'
              }}>
                ยังไม่มีข้อมูล Schedule
              </div>
            )}
          </div>

          {/* Retarget Tiers */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.07)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600', color: '#2d3748' }}>
              🎯 Retarget Tiers
            </h3>
            {retargetTiers.length > 0 ? (
              <div>
                {retargetTiers.map((tier, index) => (
                  <div key={tier.id} style={{
                    marginBottom: '16px',
                    padding: '12px',
                    background: `linear-gradient(135deg, ${COLORS[index % COLORS.length]}15 0%, ${COLORS[index % COLORS.length]}05 100%)`,
                    borderRadius: '8px',
                    borderLeft: `4px solid ${COLORS[index % COLORS.length]}`
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{
                        fontWeight: '600',
                        color: '#2d3748',
                        fontSize: '14px'
                      }}>
                        {tier.tier_name}
                      </span>
                      <span style={{
                        background: COLORS[index % COLORS.length],
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {tier.days_since_last_contact} วัน
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                height: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a0aec0'
              }}>
                ยังไม่มีข้อมูล Tiers
              </div>
            )}
          </div>
        </div>

        {/* Recent Activities Table */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.07)'
        }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600', color: '#2d3748' }}>
            🔔 กิจกรรมล่าสุด
          </h3>
          {recentActivities.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#4a5568'
                    }}>ลูกค้า</th>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#4a5568'
                    }}>กิจกรรม</th>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#4a5568'
                    }}>ประเภท</th>
                    <th style={{
                      textAlign: 'left',
                      padding: '12px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#4a5568'
                    }}>เวลา</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivities.map((activity, index) => (
                    <tr key={activity.id} style={{
                      borderBottom: '1px solid #e2e8f0',
                      transition: 'background 0.2s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f7fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: '600'
                          }}>
                            {activity.name.charAt(0)}
                          </div>
                          <span style={{ fontSize: '14px', color: '#2d3748' }}>
                            {activity.name}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          background: activity.action === 'ลูกค้าใหม่' ? '#c6f6d5' : '#bee3f8',
                          color: activity.action === 'ลูกค้าใหม่' ? '#276749' : '#2c5282',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: '500'
                        }}>
                          {activity.action}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', color: '#4a5568' }}>
                        {activity.type}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', color: '#718096' }}>
                        {activity.time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: '#a0aec0'
            }}>
              ยังไม่มีกิจกรรมล่าสุด
            </div>
          )}
        </div>

       

      </div>
    </div>
  );
};

export default Dashboard;