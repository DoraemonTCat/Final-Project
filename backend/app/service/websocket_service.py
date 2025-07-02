import socketio
import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

# สร้าง Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',  # อนุญาตทุก origin (ปรับตามความต้องการ)
    logger=True,
    engineio_logger=True
)

# สร้าง Socket.IO ASGI app
socket_app = socketio.ASGIApp(sio, socketio_path='/socket.io/')

# เก็บ client connections
connected_clients: Dict[str, List[str]] = {}  # {page_id: [sid1, sid2, ...]}

@sio.event
async def connect(sid, environ):
    """เมื่อ client เชื่อมต่อ"""
    logger.info(f"Client connected: {sid}")
    await sio.emit('connected', {'message': 'Connected to server'}, to=sid)

@sio.event
async def disconnect(sid):
    """เมื่อ client ตัดการเชื่อมต่อ"""
    logger.info(f"Client disconnected: {sid}")
    # ลบ client จากทุก page
    for page_id, clients in connected_clients.items():
        if sid in clients:
            clients.remove(sid)

@sio.event
async def subscribe_page(sid, data):
    """Client subscribe เพื่อรับข้อมูลของ page ที่เลือก"""
    page_id = data.get('page_id')
    if not page_id:
        return
    
    # เพิ่ม client เข้าไปใน page group
    if page_id not in connected_clients:
        connected_clients[page_id] = []
    
    if sid not in connected_clients[page_id]:
        connected_clients[page_id].append(sid)
    
    logger.info(f"Client {sid} subscribed to page {page_id}")
    await sio.emit('subscribed', {'page_id': page_id}, to=sid)

@sio.event
async def unsubscribe_page(sid, data):
    """Client unsubscribe จาก page"""
    page_id = data.get('page_id')
    if page_id in connected_clients and sid in connected_clients[page_id]:
        connected_clients[page_id].remove(sid)
    logger.info(f"Client {sid} unsubscribed from page {page_id}")

async def notify_new_customer(page_id: str, customer_data: Dict[str, Any]):
    """แจ้งเตือน clients ที่ subscribe page นี้ว่ามี customer ใหม่"""
    if page_id in connected_clients:
        for client_sid in connected_clients[page_id]:
            await sio.emit('new_customer', {
                'page_id': page_id,
                'customer': customer_data
            }, to=client_sid)
        logger.info(f"Notified {len(connected_clients[page_id])} clients about new customer")

async def notify_customer_update(page_id: str, customer_data: Dict[str, Any]):
    """แจ้งเตือน clients เมื่อมีการอัพเดทข้อมูล customer"""
    if page_id in connected_clients:
        for client_sid in connected_clients[page_id]:
            await sio.emit('customer_updated', {
                'page_id': page_id,
                'customer': customer_data
            }, to=client_sid)