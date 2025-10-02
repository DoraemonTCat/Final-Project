import React, { useEffect, useState } from "react";
import '../../CSS/Popup.css';
import { getMessageSetsByPage, getMessagesBySetId } from '../../Features/Tool';
import MessagePopup from '../MessagePopup';
import DailyMiningLimit from './DailyMiningLimit';

// FontAwesome
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faGripVertical, faClock, faUsers } from '@fortawesome/free-solid-svg-icons';

const Popup = ({ onClose, onConfirm, count, selectedPage, remainingMines, currentMiningCount, dailyMiningLimit, onLimitChange }) => {
    const [messageSets, setMessageSets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewingSetName, setViewingSetName] = useState('');
    const [showMessagePopup, setShowMessagePopup] = useState(false);
    const [messages, setMessages] = useState([]);
    const [selectedSets, setSelectedSets] = useState([]);

    // ✅ เพิ่ม State สำหรับความถี่การขุด
    const [batchSize, setBatchSize] = useState(20); // จำนวนคนต่อรอบ
    const [delayMinutes, setDelayMinutes] = useState(60); // เวลาหน่วง (นาที)

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

    const toggleCheckbox = (setId, setName) => {
        setSelectedSets(prev => {
            const existing = prev.find(item => item.id === setId);
            if (existing) {
                return prev.filter(item => item.id !== setId);
            } else {
                return [...prev, { id: setId, name: setName, order: prev.length + 1 }];
            }
        });
    };

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

            return newList.map((item, index) => ({
                ...item,
                order: index + 1
            }));
        });
    };

    const handleConfirm = () => {
        if(selectedSets.length === 0){
            alert("กรุณาเลือกชุดข้อความที่ต้องการส่ง");
            return;
        }

        // ✅ ส่งข้อมูลความถี่ไปด้วย
        const orderedIds = selectedSets.map(set => set.id);
        onConfirm(orderedIds, { batchSize, delayMinutes });
        onClose();
    };

    const exceedsLimit = remainingMines !== undefined && count > remainingMines;

    // ✅ คำนวณจำนวนรอบและเวลาโดยประมาณ
    const totalBatches = Math.ceil(count / batchSize);
    const estimatedMinutes = (totalBatches - 1) * delayMinutes;

    // ========== ✅ FREQUENCY PRESETS (ใส่ตรงนี้) ==========
    const frequencyPresets = [
        { name: '🚀 เร็ว', batch: 50, delay: 30 },
        { name: '⚡ ปกติ', batch: 20, delay: 60 },
        { name: '🐢 ช้า', batch: 10, delay: 120 },
        { name: '🎯 ปลอดภัย', batch: 5, delay: 180 }
    ];

    const applyPreset = (preset) => {
        setBatchSize(preset.batch);
        setDelayMinutes(preset.delay);
    };

    return (
        <div className="popup-overlay">
            <div className="popup-content" style={{ maxWidth: '800px', width: '90vw' }}>
                <button className="popup-close" onClick={onClose}>✖</button>
                <h2>⚙️ ยืนยันการขุด</h2>
                
                {/* Daily Mining Limit */}
                {currentMiningCount !== undefined && dailyMiningLimit !== undefined && (
                    <DailyMiningLimit
                        currentCount={currentMiningCount}
                        dailyLimit={dailyMiningLimit}
                        compact={true}
                        onLimitChange={onLimitChange}
                    />
                )}
                
                {/* Mining limit warning */}
                {remainingMines !== undefined && (
                    <div className={`mining-limit-info ${exceedsLimit ? 'warning' : 'info'}`}>
                        <span className="limit-icon">{exceedsLimit ? '⚠️' : '💎'}</span>
                        <span>
                            {exceedsLimit 
                                ? `คุณเลือก ${count} รายการ แต่สามารถขุดได้อีก ${remainingMines} ครั้งเท่านั้น`
                                : `คุณสามารถขุดได้อีก ${remainingMines} ครั้งในวันนี้`
                            }
                        </span>
                    </div>
                )}

                {/* ========== ✅ FREQUENCY CONTROL PANEL ========== */}
                <div className="frequency-control-panel">
                    <h3 style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        marginBottom: '15px',
                        color: '#ffffffff'
                    }}>
                        <FontAwesomeIcon icon={faClock} />
                        ⚙️ ควบคุมความถี่การขุด
                    </h3
                    >
                    
                    {/* ✅ ✅ PRESETS SECTION (ใส่ตรงนี้) ✅ ✅ */}
                    <div className="frequency-presets">
                        <label style={{ marginBottom: '10px', display: 'block' }}>
                            ⚡ ค่าตั้งต้น:
                        </label>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            {frequencyPresets.map((preset, index) => (
                                <button
                                    key={index}
                                    onClick={() => applyPreset(preset)}
                                    style={{
                                        padding: '8px 16px',
                                        border: 'none',
                                        borderRadius: '20px',
                                        background: 'rgba(255, 255, 255, 0.2)',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        transition: 'all 0.3s ease'
                                    }}
                                    onMouseOver={(e) => {
                                        e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                                        e.target.style.transform = 'scale(1.05)';
                                    }}
                                    onMouseOut={(e) => {
                                        e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                                        e.target.style.transform = 'scale(1)';
                                    }}
                                >
                                    {preset.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="frequency-settings">
                        <div className="frequency-input-group">
                            <label>
                                <FontAwesomeIcon icon={faUsers} style={{ marginRight: '8px' }} />
                                จำนวนคนต่อรอบ:
                            </label>
                            <input 
                                type="number"
                                value={batchSize}
                                onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
                                min="1"
                                max={count}
                                style={{
                                    padding: '8px 12px',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    width: '100px'
                                }}
                            />
                            <span className="input-hint">คน</span>
                        </div>

                        <div className="frequency-input-group">
                            <label>
                                <FontAwesomeIcon icon={faClock} style={{ marginRight: '8px' }} />
                                เวลาหน่วงระหว่างรอบ:
                            </label>
                            <input 
                                type="number"
                                value={delayMinutes}
                                onChange={(e) => setDelayMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                                min="0"
                                style={{
                                    padding: '8px 12px',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    width: '100px'
                                }}
                            />
                            <span className="input-hint">นาที</span>
                        </div>
                    </div>

                
                    
                       
                   
                </div>

                <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
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
                    disabled={exceedsLimit}
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