import React, { useEffect, useState } from "react";
import '../../CSS/Popup.css';
import { getMessageSetsByPage, getMessagesBySetId } from '../../Features/Tool';
import MessagePopup from '../MessagePopup';

// FontAwesome
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faGripVertical } from '@fortawesome/free-solid-svg-icons';

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

    // 🚀 ฟังก์ชันสำหรับ Drag and Drop
    const handleDragStart = (e, index) => {
        e.dataTransfer.setData('text/plain', index.toString());
        e.currentTarget.classList.add('drag-start');
    };

    const handleDragEnd = (e) => {
        e.currentTarget.classList.remove('drag-start');
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));

        if (dragIndex === dropIndex) return;

        setSelectedSets(prev => {
            const newList = [...prev];
            const draggedItem = newList[dragIndex];

            newList.splice(dragIndex, 1);
            newList.splice(dropIndex, 0, draggedItem);

            // อัพเดท order ใหม่
            return newList.map((item, index) => ({
                ...item,
                order: index + 1
            }));
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
            <div className="popup-content" style={{ maxWidth: '700px', width: '90vw' }}>
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
                        <h4 style={{textAlign:"center"}}>ลำดับการส่ง:</h4>
                        {selectedSets.length === 0 ? (
                            <div className="empty-selection">
                                ยังไม่ได้เลือกชุดข้อความ
                            </div>
                        ) : (
                            <div>
                                <div className="drag-hint">
                                    💡 ลากและวางเพื่อจัดลำดับใหม่
                                </div>
                                <ul className="ordered-list">
                                    {selectedSets.map((set, index) => (
                                        <li 
                                            key={set.id} 
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, index)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, index)}
                                            className="draggable-item"
                                        >
                                            {/* Drag Handle */}
                                            <div className="drag-handle">
                                                <FontAwesomeIcon icon={faGripVertical} />
                                            </div>

                                            <span className="sequence-order-number">
                                                {index + 1}.
                                            </span>
                                            
                                            <span className="sequence-name">
                                                {set.name}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
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