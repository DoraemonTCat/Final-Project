import React, { useEffect, useState } from "react";
import '../CSS/Popup.css';
import { getMessageSetsByPage, getMessagesBySetId } from '../Features/Tool';
import MessagePopup from './MessagePopup';

// FontAwesome
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';

const Popup = ({ onClose, onConfirm, count, selectedPage }) => {
    const [messageSets, setMessageSets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewingSetName, setViewingSetName] = useState('');
    const [showMessagePopup, setShowMessagePopup] = useState(false);
    const [messages, setMessages] = useState([]);

    // เก็บ id ชุดข้อความที่เลือกพร้อมลำดับ
    const [selectedSets, setSelectedSets] = useState([]);

    useEffect(() => {
        if (!selectedPage) return;

        const loadMessageSets = async () => {
            setLoading(true);
            try {
                const sets = await getMessageSetsByPage(selectedPage);
                setMessageSets(sets);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        loadMessageSets();
    }, [selectedPage]);

    const handleViewMessages = async (setId, setName) => {
        try {
            const data = await getMessagesBySetId(setId);
            setMessages(data);
            setViewingSetName(setName);
            setShowMessagePopup(true);
        } catch (err) {
            console.error('ไม่สามารถโหลดข้อความ:', err);
            alert('โหลดข้อความไม่สำเร็จ');
        }
    };

    // toggle checkbox - อัพเดทให้จัดการลำดับด้วย
    const toggleCheckbox = (setId, setName) => {
        setSelectedSets(prev => {
            const existing = prev.find(item => item.id === setId);
            if (existing) {
                // ถ้ามีแล้ว ให้ลบออก
                return prev.filter(item => item.id !== setId);
            } else {
                // ถ้ายังไม่มี ให้เพิ่มเข้าไปท้ายสุด
                return [...prev, { id: setId, name: setName, order: prev.length + 1 }];
            }
        });
    };

    // ฟังก์ชันเลื่อนลำดับขึ้น
    const moveUp = (index) => {
        if (index === 0) return;
        setSelectedSets(prev => {
            const newList = [...prev];
            [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
            // อัพเดท order
            return newList.map((item, idx) => ({ ...item, order: idx + 1 }));
        });
    };

    // ฟังก์ชันเลื่อนลำดับลง
    const moveDown = (index) => {
        if (index === selectedSets.length - 1) return;
        setSelectedSets(prev => {
            const newList = [...prev];
            [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
            // อัพเดท order
            return newList.map((item, idx) => ({ ...item, order: idx + 1 }));
        });
    };

    // ฟังก์ชันที่เรียกตอนกดยืนยัน
    const handleConfirm = () => {
        if(selectedSets.length === 0){
            alert("กรุณาเลือกชุดข้อความที่ต้องการส่ง");
            return;
        }
        // ส่งเฉพาะ ID ตามลำดับที่จัดไว้
        const orderedIds = selectedSets.map(set => set.id);
        onConfirm(orderedIds);
        onClose();
    };

    return (
        <div className="popup-overlay">
            <div className="popup-content" style={{ maxWidth: '600px' }}>
                <button className="popup-close" onClick={onClose}>✖</button>
                <h2>ยืนยันการขุด</h2>
                <p>คุณต้องการขุด {count} รายการใช่ไหม?</p>

                <div style={{ display: 'flex', gap: '20px' }}>
                    {/* คอลัมน์ซ้าย - รายการทั้งหมด */}
                    <div style={{ flex: 1 }}>
                        <h4>เลือกชุดข้อความ:</h4>
                        {loading ? (
                            <p>⏳ กำลังโหลดชุดข้อความ...</p>
                        ) : (
                            <ul className="message-list" style={{ maxHeight: '300px' }}>
                                {messageSets.map((set) => (
                                    <li key={set.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedSets.some(item => item.id === set.id)}
                                            onChange={() => toggleCheckbox(set.id, set.set_name)}
                                        />
                                        <span style={{ flexGrow: 1 }}>
                                            <strong>{set.set_name}</strong>
                                        </span>

                                        <button
                                            title="ดูชุดข้อความ"
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '16px'
                                            }}
                                            onClick={() => handleViewMessages(set.id, set.set_name)}
                                        >
                                            <FontAwesomeIcon icon={faEye} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* คอลัมน์ขวา - ลำดับที่เลือก */}
                    <div style={{ flex: 1 }}>
                        <h4>ลำดับการส่ง:</h4>
                        {selectedSets.length === 0 ? (
                            <p style={{ color: '#666', fontStyle: 'italic' }}>
                                ยังไม่ได้เลือกชุดข้อความ
                            </p>
                        ) : (
                            <ul className="ordered-list" style={{ 
                                listStyle: 'none', 
                                padding: 0,
                                maxHeight: '300px',
                                overflowY: 'auto',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                padding: '10px'
                            }}>
                                {selectedSets.map((set, index) => (
                                    <li key={set.id} style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '8px',
                                        marginBottom: '8px',
                                        padding: '8px',
                                        backgroundColor: '#f5f5f5',
                                        borderRadius: '4px'
                                    }}>
                                        <span style={{ 
                                            fontWeight: 'bold',
                                            color: '#666',
                                            minWidth: '24px'
                                        }}>
                                            {index + 1}.
                                        </span>
                                        <span style={{ flexGrow: 1 }}>
                                            {set.name}
                                        </span>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                                onClick={() => moveUp(index)}
                                                disabled={index === 0}
                                                style={{
                                                    background: 'none',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '4px',
                                                    cursor: index === 0 ? 'not-allowed' : 'pointer',
                                                    padding: '4px 8px',
                                                    opacity: index === 0 ? 0.5 : 1
                                                }}
                                                title="เลื่อนขึ้น"
                                            >
                                                <FontAwesomeIcon icon={faArrowUp} />
                                            </button>
                                            <button
                                                onClick={() => moveDown(index)}
                                                disabled={index === selectedSets.length - 1}
                                                style={{
                                                    background: 'none',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '4px',
                                                    cursor: index === selectedSets.length - 1 ? 'not-allowed' : 'pointer',
                                                    padding: '4px 8px',
                                                    opacity: index === selectedSets.length - 1 ? 0.5 : 1
                                                }}
                                                title="เลื่อนลง"
                                            >
                                                <FontAwesomeIcon icon={faArrowDown} />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {selectedSets.length > 0 && (
                            <p style={{ 
                                marginTop: '10px', 
                                fontSize: '12px', 
                                color: '#666',
                                fontStyle: 'italic'
                            }}>
                                💡 ชุดข้อความจะถูกส่งตามลำดับจากบนลงล่าง
                            </p>
                        )}
                    </div>
                </div>

                <button
                    className="popup-confirm"
                    onClick={handleConfirm}
                    style={{ marginTop: '20px' }}
                >
                    ✅ ยืนยัน ({selectedSets.length} ชุด)
                </button>
            </div>

            {showMessagePopup && (
                <MessagePopup
                    onClose={() => setShowMessagePopup(false)}
                    messages={messages}
                    setName={viewingSetName}
                />
            )}
        </div>
    );
};

export default Popup;