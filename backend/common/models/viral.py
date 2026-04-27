from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer
from common.database.db_session import Base
from datetime import datetime
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class ViralMomentum(Base):
    __tablename__ = "viral_momentum"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_rid = Column(String, ForeignKey("users.rid"), unique=True)
    activated_at = Column(DateTime, default=datetime.utcnow)
    referral_count_72h = Column(Integer, default=0)
    bonus_awarded = Column(Boolean, default=False)
    bonus_awarded_at = Column(DateTime, nullable=True)

class CourseScholarship(Base):
    __tablename__ = "course_scholarships"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_rid = Column(String, ForeignKey("users.rid"))
    course_id = Column(String, ForeignKey("courses.id"))
    referral_enrollment_count = Column(Integer, default=0)
    scholarship_active = Column(Boolean, default=False)
    awarded_at = Column(DateTime, nullable=True)
