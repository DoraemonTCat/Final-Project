from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import schemas, crud
from app.database.database import get_db

router = APIRouter()

# API สำหรับจัดการ Facebook Pages
@router.post("/pages/", response_model=schemas.FacebookPageOut)
def create_page(page: schemas.FacebookPageCreate, db: Session = Depends(get_db)):
    result = crud.create_page(db, page)
    if not result:
        raise HTTPException(status_code=400, detail="Page already exists")
    return result

# API สำหรับดึงข้อมูล Facebook Pages ทั้งหมด
@router.get("/pages/")
def read_pages(db: Session = Depends(get_db)):
    pages = crud.get_pages(db)
    # แปลงให้อยู่ในรูปแบบที่ frontend ต้องการ
    result = []
    for page in pages:
        result.append({
            "ID": page.ID,  # Integer ID จาก database
            "id": page.page_id,  # String page_id จาก Facebook
            "page_id": page.page_id,  # String page_id จาก Facebook
            "name": page.page_name,
            "page_name": page.page_name,
            "created_at": page.created_at.isoformat() if page.created_at else None
        })
    return result

# API สำหรับดึงข้อมูล Facebook Page ตาม page_id
@router.get("/pages/{page_id}", response_model=schemas.FacebookPageOut)
def read_page(page_id: str, db: Session = Depends(get_db)):
    page = crud.get_page(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page

# API สำหรับอัพเดตข้อมูล Facebook Page
@router.put("/pages/{page_id}", response_model=schemas.FacebookPageOut)
def update_page(page_id: str, page: dict, db: Session = Depends(get_db)):
    updated = crud.update_page(db, page_id, page)
    if not updated:
        raise HTTPException(status_code=404, detail="Page not found")
    return updated

# API สำหรับลบ Facebook Page
@router.delete("/pages/{page_id}")
def delete_page(page_id: str, db: Session = Depends(get_db)):
    deleted = crud.delete_page(db, page_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Page not found")
    return {"status": "deleted"}