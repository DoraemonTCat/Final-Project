import React, { useEffect, useState } from "react";
import '../CSS/Popup.css';
import { getMessageSetsByPage, getMessagesBySetId } from '../Features/Tool';
import MessagePopup from './MessagePopup';

// FontAwesome
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons';

const Popup = ({ onClose, onConfirm, count, selectedPage }) => {
    const [messageSets, setMessageSets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewingSetName, setViewingSetName] = useState('');
    const [showMessagePopup, setShowMessagePopup] = useState(false);
    const [messages, setMessages] = useState([]);

    // เก็บ id ชุดข้อความที่เลือก
    const [checkedSetIds, setCheckedSetIds] = useState([]);

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

    // toggle checkbox
    const toggleCheckbox = (setId) => {
        setCheckedSetIds(prev => 
            prev.includes(setId) ? prev.filter(id => id !== setId) : [...prev, setId]
        );
    };

    // ฟังก์ชันที่เรียกตอนกดยืนยัน
    const handleConfirm = () => {
        if(checkedSetIds.length === 0){
            alert("กรุณาเลือกชุดข้อความที่ต้องการส่ง");
            return;
        }
        onConfirm(checkedSetIds);
        onClose();
    };

    return (
        <div className="popup-overlay">
            <div className="popup-content">
                <button className="popup-close" onClick={onClose}>✖</button>
                <h2>ยืนยันการขุด</h2>
                <p>คุณต้องการขุด {count} รายการใช่ไหม?</p>

                {loading ? (
                    <p>⏳ กำลังโหลดชุดข้อความ...</p>
                ) : (
                    <ul className="message-list">
                        {messageSets.map((set) => (
                            <li key={set.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    checked={checkedSetIds.includes(set.id)}
                                    onChange={() => toggleCheckbox(set.id)}
                                />
                                <span style={{ flexGrow: 1 }}>
                                    <strong>{set.set_name}</strong> — {new Date(set.created_at).toLocaleString()}
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
                                {showMessagePopup && (
                                    <MessagePopup
                                        onClose={() => setShowMessagePopup(false)}
                                        messages={messages}
                                        setName={viewingSetName}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                <button
                    className="popup-confirm"
                    onClick={handleConfirm}
                >
                    ✅ ยืนยัน
                </button>
            </div>
        </div>
    );
};

export default Popup;