import React from 'react';
import '../CSS/Dashboard.css';
import Sidebar from './Sidebar';

function Dashboard() {
  return (
    
    
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      <h1>Dashboard</h1>
      <p>ยินดีต้อนรับสู่หน้าหลักของระบบ!</p>
    </div>

   
  );
}

export default Dashboard;