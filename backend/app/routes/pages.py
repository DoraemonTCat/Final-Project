# backend/app/routes/pages.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import schemas, crud
from app.database.database import get_db
from typing import List, Dict, Any
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# =============== Helper Functions ===============
def format_page_response(page) -> Dict[str, Any]:
    """Format page data for frontend compatibility"""
    return {
        "ID": page.ID,  # Integer ID from database
        "id": page.page_id,  # String page_id from Facebook
        "page_id": page.page_id,  # String page_id from Facebook
        "name": page.page_name,
        "page_name": page.page_name,
        "created_at": page.created_at.isoformat() if page.created_at else None
    }

# =============== API Endpoints ===============
@router.post("/pages/", response_model=schemas.FacebookPageOut)
def create_page(page: schemas.FacebookPageCreate, db: Session = Depends(get_db)):
    """Create new Facebook page"""
    result = crud.create_page(db, page)
    if not result:
        raise HTTPException(status_code=400, detail="Page already exists")
    return result

@router.get("/pages/")
def read_pages(db: Session = Depends(get_db)):
    """Get all Facebook pages with optimized format"""
    pages = crud.get_pages(db)
    return [format_page_response(page) for page in pages]

@router.get("/pages/{page_id}", response_model=schemas.FacebookPageOut)
def read_page(page_id: str, db: Session = Depends(get_db)):
    """Get single Facebook page by ID"""
    page = crud.get_page(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page

@router.put("/pages/{page_id}", response_model=schemas.FacebookPageOut)
def update_page(page_id: str, page: dict, db: Session = Depends(get_db)):
    """Update Facebook page"""
    updated = crud.update_page(db, page_id, page)
    if not updated:
        raise HTTPException(status_code=404, detail="Page not found")
    return updated

@router.delete("/pages/{page_id}")
def delete_page(page_id: str, db: Session = Depends(get_db)):
    """Delete Facebook page"""
    deleted = crud.delete_page(db, page_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Page not found")
    return {"status": "deleted"}
