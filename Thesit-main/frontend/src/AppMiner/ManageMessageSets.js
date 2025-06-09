import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchPages, getMessageSetsByPage, connectFacebook } from '../Features/Tool';
import '../CSS/Default.css';

function ManageMessageSets() {
    const [pages, setPages] = useState([]);
    const [selectedPage, setSelectedPage] = useState('');
    const [messageSets, setMessageSets] = useState([]);
    const [loading, setLoading] = useState(false);

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
                    )
                    )
                    }
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
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default ManageMessageSets;