import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchPages, getMessageSetsByPage, connectFacebook, updateMessageSet, deleteMessageSet } from '../Features/Tool';
import '../CSS/ManageMessageSets.css';

function ManageMessageSets() {
    const [pages, setPages] = useState([]);
    const [selectedPage, setSelectedPage] = useState('');
    const [messageSets, setMessageSets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('newest');
    // 1. เพิ่ม state สำหรับควบคุม dropdown (เพิ่มในส่วนบนของ component)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // เพิ่มฟังก์ชัน toggle
    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

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

    const handleStartEdit = (set) => {
        setEditingId(set.id);
        setEditingName(set.set_name);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditingName('');
    };

    const handleSaveEdit = async (setId) => {
        if (!editingName.trim()) {
            alert('กรุณากรอกชื่อชุดข้อความ');
            return;
        }

        try {
            await updateMessageSet(setId, editingName);
            
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

    const handleDelete = async (setId, setName) => {
        if (!window.confirm(`คุณต้องการลบชุดข้อความ "${setName}" หรือไม่?\nการลบจะไม่สามารถย้อนกลับได้`)) {
            return;
        }

        try {
            await deleteMessageSet(setId);
            
            setMessageSets(prevSets => prevSets.filter(set => set.id !== setId));
            
            
            console.log(`ชุดข้อความ ${setName} ถูกลบเรียบร้อยแล้ว`);
        } catch (err) {
            console.error('ไม่สามารถลบชุดข้อความได้:', err);
            alert('เกิดข้อผิดพลาดในการลบชุดข้อความ');
        }
    };

    // ฟิลเตอร์และเรียงลำดับข้อมูล
    const filteredAndSortedSets = messageSets
        .filter(set => set.set_name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            if (sortOrder === 'newest') {
                return b.id - a.id;
            } else if (sortOrder === 'oldest') {
                return a.id - b.id;
            } else if (sortOrder === 'name') {
                return a.set_name.localeCompare(b.set_name);
            }
            return 0;
        });

    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h3 className="sidebar-title">
                        
                             📋 ตารางการขุด
                    </h3>
                </div>
                
                <div className="connection-section">
                    <button onClick={connectFacebook} className="connect-btn facebook-btn">
                        <svg width="15" height="20" viewBox="0 0 320 512" fill="#fff" className="fb-icon">
                            <path d="M279.14 288l14.22-92.66h-88.91V127.91c0-25.35 12.42-50.06 52.24-50.06H293V6.26S259.5 0 225.36 0c-73.22 0-121 44.38-121 124.72v70.62H22.89V288h81.47v224h100.2V288z" />
                        </svg>
                        <span>เชื่อมต่อ Facebook</span>
                    </button>
                </div>

                <div className="page-selector-section">
                    <label className="select-label">เลือกเพจ</label>
                    <select value={selectedPage} onChange={handlePageChange} className="select-page">
                        <option value="">-- เลือกเพจ --</option>
                        {pages.map((page) => (
                            <option key={page.id} value={page.id}>
                                {page.name}
                            </option>
                        ))}
                    </select>
                </div>

                <nav className="sidebar-nav">
                    <Link to="/App" className="nav-link">
                        <span className="nav-icon">🏠</span>
                        หน้าแรก
                    </Link>
                    <Link to="/Set_Miner" className="nav-link">
                        <span className="nav-icon">⚙️</span>
                        ตั้งค่าระบบขุด
                    </Link>
                    <a href="#" className="nav-link">
                        <span className="nav-icon">📊</span>
                        Dashboard
                    </a>
                    <a href="#" className="nav-link">
                        <span className="nav-icon">🔧</span>
                        Setting
                    </a>
                </nav>
            </aside>

            <main className="main-content">
                <div className="content-header">
                    <h1 className="page-title">
                        <span className="title-icon">📂</span>
                        รายการชุดข้อความที่ตั้งไว้
                    </h1>
                    {selectedPage && (
                        <div className="selected-page-info">
                            <span className="info-label">เพจที่เลือก:</span>
                            <span className="info-value">
                                {pages.find(p => p.id === selectedPage)?.name || 'ยังไม่ได้เลือกเพจ'}
                            </span>
                        </div>
                    )}
                </div>

                <div className="content-controls">
                    <div className="search-section">
                        <div className="search-box">
                            <span className="search-icon">🔍</span>
                            <input
                                type="text"
                                placeholder="ค้นหาชุดข้อความ..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>
                        <select 
                            value={sortOrder} 
                            onChange={(e) => setSortOrder(e.target.value)}
                            className="sort-select"
                        >
                            <option value="newest">ใหม่ล่าสุด</option>
                            <option value="oldest">เก่าที่สุด</option>
                            
                        </select>
                    </div>
                    <button onClick={() => navigate('/default')} className="add-btn">
                        <span className="btn-icon">➕</span>
                        เพิ่มชุดข้อความ
                    </button>
                </div>

                <div className="content-body">
                    {!selectedPage ? (
                        <div className="empty-state">
                            <div className="empty-icon">📋</div>
                            <h3>กรุณาเลือกเพจ</h3>
                          
                        </div>
                            
                    ) : loading ? (
                        <div className="loading-state">
                            <div className="loading-spinner"></div>
                            <p>กำลังโหลดข้อมูล...</p>
                        </div>
                    ) : filteredAndSortedSets.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📭</div>
                            <h3>ไม่พบชุดข้อความ</h3>
                            <p>{searchTerm ? 'ไม่พบชุดข้อความที่ตรงกับคำค้นหา' : 'ยังไม่มีชุดข้อความสำหรับเพจนี้'}</p>
                            {!searchTerm && (
                                <button onClick={() => navigate('/default')} className="empty-add-btn">
                                    เริ่มสร้างชุดข้อความแรก
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="message-sets-grid">
                            {filteredAndSortedSets.map((set, index) => (
                                <div key={set.id} className="message-set-card">
                                    <div className="card-header">
                                        <span className="card-number">{index + 1}</span>
                                        <div className="card-actions">
                                            <button
                                                onClick={() => navigate(`/default?setId=${set.id}`)}
                                                className="action-btn edit-btn"
                                                title="แก้ไขชุดข้อความ"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handleDelete(set.id, set.set_name)}
                                                className="action-btn delete-btn"
                                                title="ลบชุดข้อความ"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                    <div className="card-body">
                                        <div className="card-icon">📌</div>
                                        <h3 className="card-title">{set.set_name}</h3>
                                        <div className="card-meta">
                                            <span className="meta-item">
                                               {/* <span className="meta-icon">📝</span>
                                                {set.message_count || 0} ข้อความ */}
                                            </span>
                                            <span className="meta-item">
                                               {/* <span className="meta-icon">📅</span>
                                                {new Date(set.created_at || Date.now()).toLocaleDateString('th-TH')}*/}
                                               
                                            </span>
                                        </div>
                                    </div>
                                    <div className="card-footer">
                                        <button
                                            onClick={() => navigate(`/default?setId=${set.id}`)}
                                            className="view-btn"
                                        >
                                            ดูรายละเอียด
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="content-footer">
                    <Link to="/Set_Miner" className="back-button">
                        <span className="back-icon">←</span>
                        กลับไปหน้าตั้งค่าระบบขุด
                    </Link>
                </div>
            </main>
        </div>
    );
}

export default ManageMessageSets;