"""
database.py
-----------
This file configures the database connection for the MindEcho backend.
It loads environment variables, creates the SQLAlchemy/SQLModel engine,
initializes the database tables, and provides a session generator that
is used by FastAPI routes to interact with the SQLite database.
"""

from sqlmodel import SQLModel, Session, create_engine
from dotenv import load_dotenv
import os

# Load environment variables such as DATABASE_URL and SMTP settings from .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./mindecho.db")

# Create the main database engine; check_same_thread=False is needed for SQLite with FastAPI
engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

# Create all tables defined in the SQLModel models
def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

# Provide a database session for each request
def get_session():
    with Session(engine) as session:
        yield session