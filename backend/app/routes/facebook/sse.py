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

async def event_generator(page_id: str, db: Session) -> AsyncGenerator:
    """Generate SSE events for real-time updates"""
    client_id = f"{page_id}_{datetime.now().timestamp()}"
    active_connections[client_id] = True
    
    try:
        last_check = datetime.now()
        
        while active_connections.get(client_id, False):
            try:
                # Check for new/updated customers
                page = crud.get_page_by_page_id(db, page_id)
                if page:
                    # Get customers updated after last check
                    customers = crud.get_customers_updated_after(
                        db, page.ID, last_check
                    )
                    
                    if customers:
                        # Format data
                        updates = []
                        for customer in customers:
                            updates.append({
                                'id': customer.id,
                                'psid': customer.customer_psid,
                                'name': customer.name or f"User...{customer.customer_psid[-8:]}",
                                'first_interaction': customer.first_interaction_at.isoformat() if customer.first_interaction_at else None,
                                'last_interaction': customer.last_interaction_at.isoformat() if customer.last_interaction_at else None,
                                'source_type': customer.source_type,
                                'action': 'update'  # or 'new'
                            })
                        
                        # Send update event
                        yield f"data: {json.dumps({'type': 'customer_update', 'data': updates})}\n\n"
                        
                        last_check = datetime.now()
                
                # Send heartbeat every 30 seconds
                yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': datetime.now().isoformat()})}\n\n"
                
                await asyncio.sleep(5)  # Check every 5 seconds
                
            except Exception as e:
                logger.error(f"Error in SSE generator: {e}")
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                
    finally:
        # Clean up connection
        active_connections.pop(client_id, None)
        logger.info(f"SSE connection closed for {client_id}")

@router.get("/sse/customers/{page_id}")
async def customer_updates_stream(
    page_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """SSE endpoint for real-time customer updates"""
    
    async def event_stream():
        async for event in event_generator(page_id, db):
            if await request.is_disconnected():
                break
            yield event
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable Nginx buffering
        }
    )