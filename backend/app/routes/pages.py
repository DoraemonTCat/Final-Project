from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import schemas, crud
from app.database.database import get_db

router = APIRouter()

@router.post("/pages/", response_model=schemas.FacebookPageOut)
def create_page(page: schemas.FacebookPageCreate, db: Session = Depends(get_db)):
    result = crud.create_page(db, page)
    if not result:
        raise HTTPException(status_code=400, detail="Page already exists")
    return result

@router.get("/pages/", response_model=list[schemas.FacebookPageOut])
def read_pages(db: Session = Depends(get_db)):
    return crud.get_pages(db)

@router.get("/pages/{page_id}", response_model=schemas.FacebookPageOut)
def read_page(page_id: str, db: Session = Depends(get_db)):
    page = crud.get_page(db, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page

@router.put("/pages/{page_id}", response_model=schemas.FacebookPageOut)
def update_page(page_id: str, page: dict, db: Session = Depends(get_db)):
    updated = crud.update_page(db, page_id, page)
    if not updated:
        raise HTTPException(status_code=404, detail="Page not found")
    return updated

@router.delete("/pages/{page_id}")
def delete_page(page_id: str, db: Session = Depends(get_db)):
    deleted = crud.delete_page(db, page_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Page not found")
    return {"status": "deleted"}