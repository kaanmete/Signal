import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager
from typing import Dict

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routers import upload, history

# Global job progress queues: job_id -> asyncio.Queue
job_queues: Dict[str, asyncio.Queue] = {}
# Store the current event loop for cross-thread access
_main_loop: asyncio.AbstractEventLoop = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _main_loop
    _main_loop = asyncio.get_running_loop()
    init_db()
    os.makedirs(os.path.join(os.path.dirname(__file__), "uploads"), exist_ok=True)
    yield


app = FastAPI(title="Deepfake Forensic Analysis Engine", version="1.0.0", lifespan=lifespan)

_origins_env = os.getenv("ALLOWED_ORIGINS", "")
_default_origins = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]
_allowed_origins = [o.strip() for o in _origins_env.split(",") if o.strip()] or _default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api")
app.include_router(history.router, prefix="/api")


def get_main_loop() -> asyncio.AbstractEventLoop:
    return _main_loop


def create_job_queue(job_id: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    job_queues[job_id] = q
    return q


def get_job_queue(job_id: str):
    return job_queues.get(job_id)


@app.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    """
    Job-scoped progress stream.
    Important: the queue is NOT removed when the WebSocket disconnects.
    React StrictMode + page navigation cause spurious disconnects, and the
    background analysis thread keeps pushing messages. Removing the queue on
    disconnect would orphan the worker and break reconnection. We only remove
    the queue once the terminal message (done or error) has been delivered.
    """
    await websocket.accept()
    queue = job_queues.get(job_id)
    if not queue:
        await websocket.send_json({"error": "Job not found", "done": True})
        await websocket.close()
        return

    terminal_delivered = False
    try:
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=120.0)
                await websocket.send_json(msg)
                if msg.get("done") or msg.get("error"):
                    terminal_delivered = True
                    break
            except asyncio.TimeoutError:
                # Keep-alive ping; lets the client know we're still here.
                try:
                    await websocket.send_json({"ping": True})
                except Exception:
                    break
    except WebSocketDisconnect:
        # Client went away mid-stream; keep the queue so they can reconnect.
        pass
    finally:
        if terminal_delivered:
            job_queues.pop(job_id, None)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
