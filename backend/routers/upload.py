"""
File upload, sample generation, and analysis job management. FR-01 through FR-24.
"""
import asyncio
import json
import os
import tempfile
import threading
import time
import uuid
from datetime import datetime

import numpy as np
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import Analysis, SessionLocal, get_db
from dsp.audio_processor import (
    extract_audio_from_video,
    run_audio_analysis,
)
from dsp.video_processor import run_video_analysis
from dsp.aggregator import build_full_results

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _is_video(filename: str) -> bool:
    return filename.lower().split(".")[-1] in {"mp4", "mov", "avi", "mkv", "webm"}


def _is_audio(filename: str) -> bool:
    return filename.lower().split(".")[-1] in {"wav", "mp3", "flac", "ogg", "m4a", "aac"}


def _run_analysis_thread(
    job_id: str,
    file_path: str,
    filename: str,
    file_type: str,
    file_size: int,
    opts: dict,
    loop: asyncio.AbstractEventLoop,
):
    """Background thread: runs full DSP pipeline and pushes progress via WebSocket."""
    import main as app_module

    queue = app_module.job_queues.get(job_id)

    def push(msg: dict):
        if queue:
            asyncio.run_coroutine_threadsafe(queue.put(msg), loop)

    def progress_cb(stage, pct, msg):
        push({"stage": stage, "progress": pct, "msg": msg})

    db_session = None
    start_time = time.time()

    try:
        # --- Step 1: Upload/demux ---
        push({"stage": "upload", "progress": 10, "msg": f"File received: {filename} ({file_size // 1024} KB)"})
        time.sleep(0.3)

        audio_results = None
        video_results = None

        # --- Step 2: Audio pipeline ---
        if opts.get("audio", True):
            push({"stage": "norm", "progress": 15, "msg": "Preparing audio pipeline…"})
            audio_path = file_path

            if file_type == "video":
                push({"stage": "norm", "progress": 18, "msg": "Extracting audio stream from video…"})
                extracted = extract_audio_from_video(file_path)
                if extracted:
                    audio_path = extracted
                else:
                    push({"stage": "norm", "progress": 18, "msg": "No audio track found — skipping audio analysis"})
                    audio_path = None

            if audio_path:
                try:
                    audio_results = run_audio_analysis(audio_path, progress_cb=progress_cb)
                    push({"stage": "stft", "progress": 55, "msg": f"Audio analysis complete — score: {audio_results.get('audio_score', 0):.3f}"})
                except Exception as e:
                    push({"stage": "stft", "progress": 55, "msg": f"Audio analysis error: {e}"})
                finally:
                    if audio_path != file_path and os.path.exists(audio_path):
                        os.remove(audio_path)

        # --- Step 3: Video pipeline ---
        print(f"[upload] file_type={file_type} opts={opts}", flush=True)
        if opts.get("video", True) and file_type == "video":
            push({"stage": "frames", "progress": 60, "msg": "Starting video spatial analysis…"})
            print(f"[upload] entering video pipeline for {file_path}", flush=True)
            try:
                video_results = run_video_analysis(file_path, progress_cb=progress_cb)
                if video_results and "error" in video_results:
                    err = video_results["error"]
                    print(f"[upload] video pipeline returned error: {err}", flush=True)
                    push({"stage": "dct", "progress": 85,
                          "msg": f"Video pipeline returned error: {err}"})
                else:
                    score = video_results.get("video_score", 0) if video_results else 0
                    print(f"[upload] video analysis complete, score={score}", flush=True)
                    push({"stage": "dct", "progress": 85,
                          "msg": f"Video analysis complete — score: {score:.3f}"})
            except Exception as e:
                import traceback
                tb = traceback.format_exc()
                print(f"[upload] video EXCEPTION: {e}\n{tb}", flush=True)
                push({"stage": "dct", "progress": 85,
                      "msg": f"Video analysis error: {e}"})
                video_results = {"error": str(e)}
        elif file_type == "video" and not opts.get("video", True):
            print(f"[upload] video pipeline SKIPPED — opts.video=False", flush=True)
        elif file_type != "video":
            print(f"[upload] video pipeline SKIPPED — file_type={file_type}", flush=True)

        # --- Step 4: Aggregation ---
        push({"stage": "agg", "progress": 88, "msg": "Computing weighted probability score (FR-20)…"})
        processing_time = time.time() - start_time
        results = build_full_results(
            job_id=job_id,
            filename=filename,
            file_type=file_type,
            file_size=file_size,
            audio_results=audio_results,
            video_results=video_results,
            opts=opts,
            processing_time=processing_time,
        )
        push({"stage": "agg", "progress": 92, "msg": f"Deepfake probability: {results['deepfake_probability']:.1f}%"})

        # --- Step 5: Save to DB ---
        push({"stage": "report", "progress": 95, "msg": "Saving results to database…"})
        db = SessionLocal()
        try:
            record = db.query(Analysis).filter(Analysis.id == job_id).first()
            if record:
                record.status = "completed"
                record.completed_at = datetime.utcnow()
                record.deepfake_probability = results["deepfake_probability"]
                record.verdict = results["verdict"]
                record.audio_anomalies = results["audio_anomalies"]
                record.video_anomalies = results["video_anomalies"]
                record.sync_mismatches = results["sync_mismatches"]
                record.results_json = json.dumps(results)
                db.commit()
        finally:
            db.close()

        push({"stage": "report", "progress": 100, "msg": "Analysis complete!", "done": True, "results": results})

    except Exception as exc:
        db = SessionLocal()
        try:
            record = db.query(Analysis).filter(Analysis.id == job_id).first()
            if record:
                record.status = "failed"
                record.error_message = str(exc)
                db.commit()
        finally:
            db.close()
        push({"error": str(exc), "done": True})

    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    audio: str = Form("true"),
    video: str = Form("true"),
    deep: str = Form("false"),
    db: Session = Depends(get_db),
):
    """Accept file upload, create DB record, start async analysis. FR-01."""
    import main as app_module

    filename = file.filename or "unknown"
    file_ext = filename.split(".")[-1].lower()
    file_type = "video" if _is_video(filename) else "audio" if _is_audio(filename) else "unknown"
    print(f"[upload] /api/upload received: filename={filename!r} "
          f"file_type={file_type} audio={audio} video={video}", flush=True)

    if file_type == "unknown":
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_ext}")

    job_id = str(uuid.uuid4())

    # Save uploaded file
    dest_path = os.path.join(UPLOAD_DIR, f"{job_id}.{file_ext}")
    content = await file.read()
    file_size = len(content)

    # FR-01: validate size <= 2GB
    if file_size > 2 * 1024 ** 3:
        raise HTTPException(status_code=400, detail="File exceeds 2 GB limit")

    with open(dest_path, "wb") as f:
        f.write(content)

    # Create DB record
    record = Analysis(
        id=job_id,
        filename=filename,
        file_type=file_type,
        file_size=file_size,
        status="processing",
        created_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()

    opts = {
        "audio": audio.lower() == "true",
        "video": video.lower() == "true",
        "deep": deep.lower() == "true",
    }

    # Create WebSocket queue
    loop = asyncio.get_running_loop()
    app_module.create_job_queue(job_id)

    # Start background thread for DSP processing
    t = threading.Thread(
        target=_run_analysis_thread,
        args=(job_id, dest_path, filename, file_type, file_size, opts, loop),
        daemon=True,
    )
    t.start()

    return {"job_id": job_id, "filename": filename, "file_type": file_type}


@router.get("/results/{job_id}")
async def get_results(job_id: str, db: Session = Depends(get_db)):
    """Fetch full analysis results for a completed job."""
    record = db.query(Analysis).filter(Analysis.id == job_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Job not found")

    if record.status == "failed":
        raise HTTPException(status_code=500, detail=record.error_message or "Analysis failed")

    if record.status != "completed":
        return {"status": record.status, "job_id": job_id}

    if record.results_json:
        return json.loads(record.results_json)

    return {"status": "completed", "job_id": job_id}


@router.post("/sample")
async def analyze_sample(db: Session = Depends(get_db)):
    """Generate and analyze a synthetic sample audio file."""
    import main as app_module

    job_id = str(uuid.uuid4())
    sample_path = os.path.join(UPLOAD_DIR, f"{job_id}.wav")
    _generate_sample_audio(sample_path)

    record = Analysis(
        id=job_id,
        filename="sample_deepfake_demo.wav",
        file_type="audio",
        file_size=os.path.getsize(sample_path),
        status="processing",
        created_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()

    opts = {"audio": True, "video": False, "deep": False}
    loop = asyncio.get_running_loop()
    app_module.create_job_queue(job_id)

    t = threading.Thread(
        target=_run_analysis_thread,
        args=(job_id, sample_path, "sample_deepfake_demo.wav", "audio",
              os.path.getsize(sample_path), opts, loop),
        daemon=True,
    )
    t.start()

    return {"job_id": job_id, "filename": "sample_deepfake_demo.wav", "file_type": "audio"}


def _generate_sample_audio(output_path: str, duration: int = 15, sr: int = 16000):
    """Generate synthetic audio with manipulation artifacts for demo."""
    t = np.linspace(0, duration, duration * sr)

    # Natural voice-like harmonics
    fundamental = 150  # Hz
    signal = np.zeros_like(t)
    for harmonic in [1, 2, 3, 4, 5]:
        amp = 1.0 / harmonic
        signal += amp * np.sin(2 * np.pi * fundamental * harmonic * t)

    # Add vocoder artifact (sudden phase discontinuity at 1/3 and 2/3 of duration)
    cut1 = int(duration * sr // 3)
    cut2 = int(duration * sr * 2 // 3)
    signal[cut1:cut1 + 200] += 0.5 * np.random.randn(200)
    signal[cut2:cut2 + 200] += 0.5 * np.random.randn(200)

    # Add noise
    signal += 0.02 * np.random.randn(len(t))
    signal = signal / (np.max(np.abs(signal)) + 1e-10)

    # Write WAV
    import wave, struct
    samples = (signal * 32767).astype(np.int16)
    with wave.open(output_path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(samples.tobytes())
