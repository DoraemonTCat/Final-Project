import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchPages, getMessageSetsByPage, connectFacebook, updateMessageSet, deleteMessageSet } from '../Features/Tool';
import '../CSS/ManageMessageSets.css';

function ManageMessageSets() {
    const [pages, setPages] = useState([]);
    const [selectedPage, setSelectedPage] = useState('');
    const [messageSets, setMessageSets] = useState([]);
    const [loading, setLoading] = useState(false);
    // เพิ่ม state สำหรับการแก้ไข
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState('');

    const navigate = useNavigate();

    useEffect(() => {
        const loadPages = async () => {
            try {
                const pagesData = await fetchPages();
                setPages(pagesData);

                const savedPage = localStorage.getItem('selectedPage');
                if (savedPage && pagesData.some(page => page.id === savedPage)) {
                    setSelectedPage(savedPage);
                }
            } catch (err) {
                console.error('ไม่สามารถโหลดเพจได้:', err);
            }
        };

        loadPages();
    }, []);

    useEffect(() => {
        const loadMessageSets = async () => {
            if (!selectedPage) return;
            setLoading(true);
            try {
                const sets = await getMessageSetsByPage(selectedPage);
                setMessageSets(sets);
            } catch (err) {
                console.error('ไม่สามารถโหลดชุดข้อความ:', err);
            } finally {
                setLoading(false);
            }
        };

        loadMessageSets();
    }, [selectedPage]);

    const handlePageChange = (e) => {
        const pageId = e.target.value;
        setSelectedPage(pageId);
        localStorage.setItem('selectedPage', pageId);
    };

    // ฟังก์ชันเริ่มแก้ไข
    const handleStartEdit = (set) => {
        setEditingId(set.id);
        setEditingName(set.set_name);
    };

    // ฟังก์ชันยกเลิกการแก้ไข
    const handleCancelEdit = () => {
        setEditingId(null);
        setEditingName('');
    };

    // ฟังก์ชันบันทึกการแก้ไข
    const handleSaveEdit = async (setId) => {
        if (!editingName.trim()) {
            alert('กรุณากรอกชื่อชุดข้อความ');
            return;
        }

        try {
            await updateMessageSet(setId, editingName);
            
            // อัพเดท state
            setMessageSets(prevSets => 
                prevSets.map(set => 
                    set.id === setId ? { ...set, set_name: editingName } : set
                )
            );
            
            setEditingId(null);
            setEditingName('');
            alert('แก้ไขชื่อชุดข้อความสำเร็จ');
        } catch (err) {
            console.error('ไม่สามารถแก้ไขชุดข้อความได้:', err);
            alert('เกิดข้อผิดพลาดในการแก้ไขชุดข้อความ');
        }
    };

    // ฟังก์ชันลบชุดข้อความ (แก้ไข syntax)
    const handleDelete = async (setId, setName) => {
        if (!window.confirm(`คุณต้องการลบชุดข้อความ "${setName}" หรือไม่?\nการลบจะไม่สามารถย้อนกลับได้`)) {
            return;
        }

        try {
            await deleteMessageSet(setId);
            
            // อัพเดท state
            setMessageSets(prevSets => prevSets.filter(set => set.id !== setId));
            
            alert('ลบชุดข้อความสำเร็จ');
        } catch (err) {
            console.error('ไม่สามารถลบชุดข้อความได้:', err);
            alert('เกิดข้อผิดพลาดในการลบชุดข้อความ');
        }
    };

    return (
        <div className="app-container">
            <aside className="sidebar">
                <h3 className="sidebar-title">ช่องทางเชื่อมต่อ</h3>
                <button onClick={connectFacebook} className="BT">
                    <svg width="15" height="20" viewBox="0 0 320 512" fill="#fff" className="fb-icon">
                        <path d="M279.14 288l14.22-92.66h-88.91V127.91c0-25.35 12.42-50.06 52.24-50.06H293V6.26S259.5 0 225.36 0c-73.22 0-121 44.38-121 124.72v70.62H22.89V288h81.47v224h100.2V288z" />
                    </svg>
                </button>
                <hr />
                <select value={selectedPage} onChange={handlePageChange} className="select-page">
                    <option value="">-- เลือกเพจ --</option>
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
            <div className="message-settings-container">
                <h1 className="header">📂 รายการชุดข้อความที่ตั้งไว้</h1>
                <p style={{ textAlign: "center" }}><strong>เพจที่เลือก:</strong> {pages.find(p => p.id === selectedPage)?.name || 'ยังไม่ได้เลือกเพจ'}</p>

                <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                    <button onClick={() => navigate('/default')} className="add-btn">➕ เพิ่มชุดข้อความ</button>
                </div>

                {loading ? (
                    <p>🔄 กำลังโหลด...</p>
                ) : messageSets.length === 0 ? (
                    <p>⚠️ ยังไม่มีชุดข้อความสำหรับเพจนี้</p>
                ) : (
                    <ul className="sequence-list">
                        {messageSets.map((set, index) => (
                            <li key={set.id} className="sequence-item sequence-item-saved">
                                <div className="sequence-order">{index + 1}</div>
                                <div className="sequence-content">
                                    <div className="sequence-type">📌 ชุดข้อความ</div>
                                    <div className="sequence-text">{set.set_name}</div>
                                </div>
                                
                                {/* ปุ่มควบคุม */}
                                <div style={{ 
                                    display: 'flex', 
                                    gap: '8px',
                                    marginLeft: 'auto'
                                }}>
                                    <button
                                        onClick={() => navigate(`/default?setId=${set.id}`)}
                                        style={{
                                            backgroundColor: '#f39c12',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            padding: '6px 12px',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                        title="แก้ไขชุดข้อความ"
                                    >
                                        ✏️ แก้ไขชุด
                                    </button>
                                    <button
                                        onClick={() => handleDelete(set.id, set.set_name)}
                                        style={{
                                            backgroundColor: '#e74c3c',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            padding: '6px 12px',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                        title="ลบชุดข้อความ"
                                    >
                                        🗑️ ลบ
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <div style={{ marginTop: '30px', textAlign: 'center' }}>
                    <Link to="/Set_Miner" className="back-button">
                        ← กลับไปหน้าตั้งค่าระบบขุด
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default ManageMessageSets;