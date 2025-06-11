import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../CSS/Set_Miner.css';
import { fetchPages, connectFacebook } from "../Features/Tool";

function SetMiner() {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [customerGroups, setCustomerGroups] = useState([]);
  const [individualCustomers, setIndividualCustomers] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [showAddGroupForm, setShowAddGroupForm] = useState(false);

  useEffect(() => {
    const savedPage = JSON.parse(localStorage.getItem("selectedPage") || '""');
    const savedGroups = JSON.parse(localStorage.getItem("customerGroups") || '[]');
    const savedIndividuals = JSON.parse(localStorage.getItem("individualCustomers") || '[]');
    
    if (savedPage) {
      setSelectedPage(savedPage);
    }
    setCustomerGroups(savedGroups);
    setIndividualCustomers(savedIndividuals);
    
    fetchPages()
      .then(setPages)
      .catch(err => console.error("ไม่สามารถโหลดเพจได้:", err));
  }, []);

  const handlePageChange = (e) => {
    const pageId = e.target.value;
    setSelectedPage(pageId);
    localStorage.setItem("selectedPage", JSON.stringify(pageId));
  };

  const addCustomerGroup = () => {
    if (newGroupName.trim()) {
      const newGroup = {
        id: Date.now(),
        name: newGroupName,
        customers: [],
        createdAt: new Date().toISOString()
      };
      const updatedGroups = [...customerGroups, newGroup];
      setCustomerGroups(updatedGroups);
      localStorage.setItem("customerGroups", JSON.stringify(updatedGroups));
      setNewGroupName("");
      setShowAddGroupForm(false);
    }
  };

  const removeCustomerGroup = (groupId) => {
    const updatedGroups = customerGroups.filter(group => group.id !== groupId);
    setCustomerGroups(updatedGroups);
    localStorage.setItem("customerGroups", JSON.stringify(updatedGroups));
  };

  const addIndividualCustomer = () => {
    const newCustomer = {
      id: Date.now(),
      name: "ลูกค้ารายใหม่",
      psid: "",
      createdAt: new Date().toISOString()
    };
    const updatedCustomers = [...individualCustomers, newCustomer];
    setIndividualCustomers(updatedCustomers);
    localStorage.setItem("individualCustomers", JSON.stringify(updatedCustomers));
  };

  const removeIndividualCustomer = (customerId) => {
    const updatedCustomers = individualCustomers.filter(customer => customer.id !== customerId);
    setIndividualCustomers(updatedCustomers);
    localStorage.setItem("individualCustomers", JSON.stringify(updatedCustomers));
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <h3 className="sidebar-title">ช่องทางเชื่อมต่อ</h3>
        <button onClick={connectFacebook} className="BT">
          <svg width="15" height="20" viewBox="0 0 320 512" fill="#fff" className="fb-icon">
            <path d="M279.14 288l14.22-92.66h-88.91V127.91c0-25.35 12.42-50.06 52.24-50.06H293V6.26S259.5 0 225.36 0c-73.22 0-121 44.38-121 124.72v70.62H22.89V288h81.47v224h100.2V288z" />
          </svg>
        </button>
        <hr />
        <select value={selectedPage} onChange={handlePageChange} className="select-page">
          
          {pages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.name}
            </option>
          ))}
        </select>
        <Link to="/App" className="title" style={{ marginLeft: "64px" }}>หน้าแรก</Link><br />
        <Link to="/Set_Miner" className="title" style={{ marginLeft: "50px" }}>ตั้งค่าระบบขุด</Link><br />
        <a href="#" className="title" style={{ marginLeft: "53px" }}>Dashboard</a><br />
        <a href="#" className="title" style={{ marginLeft: "66px" }}>Setting</a><br />
      </aside>

      {/* Main Content */}
      <div className="setminer-root">
        <div>
          <div className="text-center py-4 bg-gray-50" style={{marginLeft: "48%"}}>
            <h2 className="text-xl font-medium text-gray-800">ชื่อ Function ที่ใช้งานอยู่</h2>
          </div>
          
          <div style={{display: "flex", justifyContent: "space-around", marginTop: "20px"}}>
            {/* กลุ่มลูกค้า */}
            <div className="setminer-header" style={{marginLeft: "20%", width: "30%"}}>
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px"}}>
                <p style={{margin: 0, fontSize: "18px", fontWeight: "bold"}}>กลุ่มลูกค้า</p>
                <button 
                  onClick={() => setShowAddGroupForm(true)}
                  style={{
                    backgroundColor: "#4CAF50",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  + เพิ่มกลุ่ม
                </button>
              </div>

              {/* Form เพิ่มกลุ่มใหม่ */}
              {showAddGroupForm && (
                <div style={{
                  backgroundColor: "#f9f9f9",
                  padding: "15px",
                  borderRadius: "8px",
                  marginBottom: "15px",
                  border: "1px solid #ddd"
                }}>
                  <input
                    type="text"
                    placeholder="ชื่อกลุ่มลูกค้า"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: "4px",
                      border: "1px solid #ccc",
                      marginBottom: "10px"
                    }}
                  />
                  <div style={{display: "flex", gap: "10px"}}>
                    <button
                      onClick={addCustomerGroup}
                      style={{
                        backgroundColor: "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        padding: "8px 15px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      บันทึก
                    </button>
                    <button
                      onClick={() => {
                        setShowAddGroupForm(false);
                        setNewGroupName("");
                      }}
                      style={{
                        backgroundColor: "#f44336",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        padding: "8px 15px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}

              {/* รายการกลุ่มลูกค้า */}
              <div style={{maxHeight: "400px", overflowY: "auto"}}>
                {customerGroups.length === 0 ? (
                  <div style={{
                    textAlign: "center",
                    padding: "20px",
                    color: "#666",
                    fontStyle: "italic"
                  }}>
                    ยังไม่มีกลุ่มลูกค้า
                  </div>
                ) : (
                  customerGroups.map((group) => (
                    <div
                      key={group.id}
                      style={{
                        backgroundColor: "white",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        padding: "15px",
                        marginBottom: "10px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                      }}
                    >
                      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                        <div>
                          <h4 style={{margin: "0 0 5px 0", color: "#333"}}>{group.name}</h4>
                          <p style={{margin: 0, fontSize: "12px", color: "#666"}}>
                            จำนวนสมาชิก: {group.customers.length} คน
                          </p>
                        </div>
                        <button
                          onClick={() => removeCustomerGroup(group.id)}
                          style={{
                            backgroundColor: "#f44336",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            padding: "5px 10px",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          ลบ
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ลูกค้ารายคน */}
            <div className="setminer-header" style={{marginRight: "5%", width: "30%"}}>
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px"}}>
                <p style={{margin: 0, fontSize: "18px", fontWeight: "bold"}}>ลูกค้ารายคน</p>
                <button 
                  onClick={addIndividualCustomer}
                  style={{
                    backgroundColor: "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  + เพิ่มลูกค้า
                </button>
              </div>

              {/* รายการลูกค้ารายคน */}
              <div style={{maxHeight: "400px", overflowY: "auto"}}>
                {individualCustomers.length === 0 ? (
                  <div style={{
                    textAlign: "center",
                    padding: "20px",
                    color: "#666",
                    fontStyle: "italic"
                  }}>
                    ยังไม่มีลูกค้ารายคน
                  </div>
                ) : (
                  individualCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      style={{
                        backgroundColor: "white",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        padding: "15px",
                        marginBottom: "10px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                      }}
                    >
                      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                        <div>
                          <h4 style={{margin: "0 0 5px 0", color: "#333"}}>{customer.name}</h4>
                          <p style={{margin: 0, fontSize: "12px", color: "#666"}}>
                            PSID: {customer.psid || "ยังไม่ได้กำหนด"}
                          </p>
                        </div>
                        <button
                          onClick={() => removeIndividualCustomer(customer.id)}
                          style={{
                            backgroundColor: "#f44336",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            padding: "5px 10px",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          ลบ
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

            
            
            
        
        </div>
      </div>
    </div>
  );
}

export default SetMiner;