import React from "react";
import "../CSS/Popup.css"; // สร้างหรือเพิ่มตามต้องการ

const MessagePopup = ({ messages, setName, onClose }) => {
    return (
        <div className="popup-overlay">
            <div className="popup-content">
                <h3>ชุดข้อความ: {setName}</h3>

                <ul
                    className="message-preview-list"
                    style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}
                >
                    {messages.map((msg, index) => (
                        <li key={msg.id}>
                            <span>#{msg.display_order}:</span>{' '}
                            {msg.message_type === 'text' && <p>{msg.content}</p>}
                            {msg.message_type === 'image' && (
                                <img
                                    src={`http://localhost:8000/images/${msg.content.replace('[IMAGE] ', '')}`}
                                    alt="preview"
                                    style={{ maxWidth: '100%' }}
                                />
                            )}
                            {msg.message_type === 'video' && (
                                <video controls style={{ maxWidth: '100%' }}>
                                    <source
                                        src={`http://localhost:8000/videos/${msg.content.replace('[VIDEO] ', '')}`}
                                        type="video/mp4"
                                    />
                                    เบราว์เซอร์ของคุณไม่รองรับวิดีโอ
                                </video>
                            )}
                        </li>
                    ))}
                </ul>

                <button onClick={onClose}>ปิด</button>
            </div>
        </div>
    );
};

export default MessagePopup;