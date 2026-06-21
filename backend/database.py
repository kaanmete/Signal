from sqlalchemy import create_engine, Column, String, Float, Integer, Boolean, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "deepfake_forensics.db")
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Analysis(Base):
    __tablename__ = "analyses"
    id = Column(String, primary_key=True)
    filename = Column(String)
    file_type = Column(String)  # 'audio' or 'video'
    file_size = Column(Integer)
    status = Column(String, default="pending")  # pending, processing, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    deepfake_probability = Column(Float, nullable=True)
    verdict = Column(String, nullable=True)
    audio_anomalies = Column(Integer, default=0)
    video_anomalies = Column(Integer, default=0)
    sync_mismatches = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    results_json = Column(Text, nullable=True)  # full JSON results blob


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
