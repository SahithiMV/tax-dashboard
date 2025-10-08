# server/app/db.py
import os
from dotenv import load_dotenv
from sqlalchemy import (
    create_engine, Column, Integer, String, Date, Float, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, sessionmaker

# Load .env so DATABASE_URL is available to both the app and Alembic
load_dotenv()

# Use psycopg3 driver (you installed psycopg, not psycopg2)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://localhost:5432/taxdash")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()

# --- Models ---------------------------------------------------------------

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)

class TaxProfileDB(Base):
    __tablename__ = "tax_profiles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filing_status = Column(String, nullable=False)
    federal_st_rate = Column(Float, nullable=False)
    federal_lt_rate = Column(Float, nullable=False)
    state_code = Column(String, nullable=False)
    state_st_rate = Column(Float, nullable=False)
    state_lt_rate = Column(Float, nullable=False)
    niit_rate = Column(Float, nullable=True)
    carry_forward_losses = Column(Float, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_tax_profiles_user_id"),
    )

class LotDB(Base):
    __tablename__ = "lots"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    cost_per_share = Column(Float, nullable=False)
    purchase_date = Column(Date, nullable=False)
    account = Column(String, nullable=True)
