from sqlalchemy.orm import Session
from app.database.models import FacebookPage
from app.database.schemas import FacebookPageCreate, FacebookPageUpdate
from sqlalchemy.exc import IntegrityError
import app.database.models as models, app.database.schemas as schemas

def get_page_by_id(db: Session, id: int):
    return db.query(FacebookPage).filter(FacebookPage.ID == id).first()

def get_page_by_page_id(db: Session, page_id: str):
    return db.query(models.FacebookPage).filter(models.FacebookPage.page_id == page_id).first()

def get_pages(db: Session, skip: int = 0, limit: int = 100):
    return db.query(FacebookPage).offset(skip).limit(limit).all()

def create_page(db: Session, page: schemas.FacebookPageCreate):
    db_page = models.FacebookPage(
        page_id=page.page_id,
        page_name=page.page_name
        # created_at จะถูกกำหนดอัตโนมัติใน DB
    )
    db.add(db_page)
    db.commit()
    db.refresh(db_page)
    return db_page

def update_page(db: Session, id: int, page_update: FacebookPageUpdate):
    db_page = db.query(FacebookPage).filter(FacebookPage.ID == id).first()
    if not db_page:
        return None
    if page_update.page_name is not None:
        db_page.page_name = page_update.page_name
    db.commit()
    db.refresh(db_page)
    return db_page

def delete_page(db: Session, id: int):
    db_page = db.query(FacebookPage).filter(FacebookPage.ID == id).first()
    if db_page:
        db.delete(db_page)
        db.commit()
    return db_page