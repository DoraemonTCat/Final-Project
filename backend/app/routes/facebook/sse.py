# backend/app/routes/facebook/sse.py
from fastapi import APIRouter, Request, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.database import crud
import asyncio
import json
from datetime import datetime
from typing import AsyncGenerator
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Store active connections
active_connections = {}

# เพิ่ม queue สำหรับ customer type updates
customer_type_update_queue = asyncio.Queue()

async def event_generator(page_id: str, db: Session) -> AsyncGenerator:
    """Generate SSE events for real-time updates"""
    client_id = f"{page_id}_{datetime.now().timestamp()}"
    active_connections[client_id] = True
    
    try:
        last_check = datetime.now()
        
        while active_connections.get(client_id, False):
            try:
                # ใช้ try-except และ rollback เมื่อเกิด error
                try:
                    # Check for customer type updates from queue
                    try:
                        update = await asyncio.wait_for(
                            customer_type_update_queue.get(), 
                            timeout=1.0
                        )
                        
                        if update.get('page_id') == page_id:
                            yield f"data: {json.dumps({'type': 'customer_type_update', 'data': [update]})}\n\n"
                            logger.info(f"Sent customer type update for {update['psid']}")
                            
                    except asyncio.TimeoutError:
                        pass
                    
                    # Check for new/updated customers
                    page = crud.get_page_by_page_id(db, page_id)
                    if page:
                        customers = crud.get_customers_updated_after(
                            db, page.id, last_check
                        )
                        
                        if customers:
                            updates = []
                            for customer in customers:
                                update_data = {
                                    'id': customer.id,
                                    'psid': customer.customer_psid,
                                    'name': customer.name or f"User...{customer.customer_psid[-8:]}",
                                    'first_interaction': customer.first_interaction_at.isoformat() if customer.first_interaction_at else None,
                                    'last_interaction': customer.last_interaction_at.isoformat() if customer.last_interaction_at else None,
                                    'source_type': customer.source_type,
                                    # User Groups
                                    'customer_type_custom_id': customer.customer_type_custom_id,
                                    'customer_type_name': customer.customer_type_custom.type_name if customer.customer_type_custom else None,
                                    # Knowledge Groups - เพิ่มข้อมูลนี้
                                    'customer_type_knowledge_id': customer.customer_type_knowledge_id,
                                    'customer_type_knowledge_name': customer.customer_type_knowledge.type_name if customer.customer_type_knowledge else None,
                                    'action': 'update'
                                }
                                updates.append(update_data)
                            
                            yield f"data: {json.dumps({'type': 'customer_update', 'data': updates})}\n\n"
                            last_check = datetime.now()
                    
                    # ทำ commit เพื่อ clear transaction
                    db.commit()
                    
                except Exception as e:
                    # Rollback transaction เมื่อเกิด error
                    db.rollback()
                    logger.error(f"Database error in SSE: {e}")
                    # Continue loop แทนที่จะ raise error
                
                # Send heartbeat
                yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': datetime.now().isoformat()})}\n\n"
                
                await asyncio.sleep(5)
                
            except Exception as e:
                logger.error(f"Error in SSE generator: {e}")
                # Rollback และ continue
                try:
                    db.rollback()
                except:
                    pass
                yield f"data: {json.dumps({'type': 'error', 'message': 'Connection error'})}\n\n"
                await asyncio.sleep(5)
                
    finally:
        active_connections.pop(client_id, None)
        logger.info(f"SSE connection closed for {client_id}")
        # ทำ rollback สุดท้ายก่อนปิด connection
        try:
            db.rollback()
        except:
            pass

# Helper function สำหรับส่ง customer type update
async def send_customer_type_update(page_id: str, psid: str, customer_type_name: str = None, customer_type_custom_id: int = None, customer_type_knowledge_name: str = None, customer_type_knowledge_id: int = None):
    """ส่ง customer type update ผ่าน SSE"""
    update = {
        'page_id': page_id,
        'psid': psid,
        'timestamp': datetime.now().isoformat()
    }
    
    # เพิ่มข้อมูล User Group ถ้ามี
    if customer_type_name is not None:
        update['customer_type_name'] = customer_type_name
    if customer_type_custom_id is not None:
        update['customer_type_custom_id'] = customer_type_custom_id
    
    # เพิ่มข้อมูล Knowledge Group ถ้ามี
    if customer_type_knowledge_name is not None:
        update['customer_type_knowledge_name'] = customer_type_knowledge_name
    if customer_type_knowledge_id is not None:
        update['customer_type_knowledge_id'] = customer_type_knowledge_id
    
    await customer_type_update_queue.put(update)
    logger.info(f"Queued customer type update for {psid}")

@router.get("/sse/customers/{page_id}")
async def customer_updates_stream(
    page_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """SSE endpoint for real-time customer updates"""
    
    # สร้าง generator function ใหม่ที่จัดการ db session อย่างถูกต้อง
    async def safe_event_stream():
        try:
            async for event in event_generator(page_id, db):
                if await request.is_disconnected():
                    break
                yield event
        except Exception as e:
            logger.error(f"SSE stream error: {e}")
        finally:
            # ทำ cleanup
            try:
                db.rollback()
                db.close()
            except:
                pass
    
    return StreamingResponse(
        safe_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )