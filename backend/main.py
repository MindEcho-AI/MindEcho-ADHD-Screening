from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.models.database import create_db_and_tables
from app.routers import auth, users, children, assessments, analysis

app = FastAPI(
    title="MindEcho API",
    description="ADHD behavioral and cognitive screening platform",
    version="1.0.0",
)

# ─── CORS — allows frontend at localhost:5173 to talk to backend ──────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(children.router)
app.include_router(assessments.router)
app.include_router(analysis.router)

# ─── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    os.makedirs("./uploads", exist_ok=True)
    print("✓ MindEcho API started — http://localhost:8000")
    print("✓ API docs available at http://localhost:8000/docs")


@app.get("/")
def root():
    return {"message": "MindEcho API is running", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
