"""
Video Spatial Analysis Pipeline
Implements FR-06, FR-13 through FR-17
"""
import os
import base64
import numpy as np
import cv2
from scipy.fft import dctn


FACE_CASCADE_PATH = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
DCT_BLOCK_SIZE = 8       # FR-15: 8x8 DCT blocks
TARGET_FPS = 30          # FR-06: extract at 30 fps

# Load once at module level — creating a new CascadeClassifier per frame is
# slow and, if the XML file is missing, triggers an assertion in detectMultiScale.
_face_cascade = cv2.CascadeClassifier(FACE_CASCADE_PATH)
if _face_cascade.empty():
    print(f"[video] WARNING: Haar cascade not found at '{FACE_CASCADE_PATH}' "
          "— face detection disabled, falling back to center crop")
    _face_cascade = None


def extract_frames(video_path: str, max_frames: int = 300, progress_cb=None):
    """Extract video frames at ~30fps. Returns list of BGR frames. FR-06.

    Robustness:
      - Some codecs (HEVC, VP9, fragmented MP4 from phones) return 0/-1 for
        CAP_PROP_FRAME_COUNT. We then can't pre-compute `step`, so we sample
        every Nth frame instead and decode adaptively.
      - We also keep going on transient read errors and only stop when several
        consecutive reads fail.
    """
    print(f"[video] extract_frames: opening {video_path}", flush=True)
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[video] extract_frames: cv2.VideoCapture FAILED to open file", flush=True)
        return [], 0.0, 0

    orig_fps = cap.get(cv2.CAP_PROP_FPS) or TARGET_FPS
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"[video] extract_frames: fps={orig_fps:.2f} total_frames={total_frames}", flush=True)

    # FR-06: sample at TARGET_FPS rate; max_frames caps the total analyzed count.
    # For a 30fps source, step=1 (every frame). For 60fps, step=2. Etc.
    if total_frames <= 0:
        step = max(1, round(orig_fps / TARGET_FPS)) if orig_fps > 0 else 1
    else:
        step = max(1, round(orig_fps / TARGET_FPS))

    frames = []
    idx = 0
    consecutive_fail = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            consecutive_fail += 1
            if consecutive_fail >= 5:
                break
            idx += 1
            continue
        consecutive_fail = 0
        if idx % step == 0:
            frames.append(frame)
            if progress_cb and len(frames) % 30 == 0:
                pct = int(len(frames) / max_frames * 100)
                progress_cb("frames", pct, f"Extracted frame {len(frames)} / ~{max_frames}")
        idx += 1
        if len(frames) >= max_frames:
            break

    cap.release()

    # Recover unknown counts after the fact.
    if total_frames <= 0:
        total_frames = idx
    duration = total_frames / orig_fps if orig_fps > 0 else 0.0
    print(f"[video] extract_frames: collected={len(frames)} duration={duration:.2f}s", flush=True)
    return frames, duration, total_frames


def detect_face(frame: np.ndarray):
    """Face detection using Haar cascade. FR-13."""
    fh, fw = frame.shape[:2]

    if _face_cascade is not None:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = _face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5,
            minSize=(30, 30), flags=cv2.CASCADE_SCALE_IMAGE
        )
        if len(faces) > 0:
            areas = [w * h for (x, y, w, h) in faces]
            largest_idx = int(np.argmax(areas))
            x, y, w, h = faces[largest_idx]
            return (int(x), int(y), int(w), int(h)), True

    # Cascade unavailable or no face found: return center-quarter crop as fallback
    margin_x, margin_y = fw // 4, fh // 4
    return (margin_x, margin_y, fw // 2, fh // 2), False


def convert_to_ycbcr(frame: np.ndarray) -> np.ndarray:
    """Convert BGR frame to YCbCr color space. FR-14."""
    return cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)


def apply_2d_dct_blocks(region: np.ndarray, block_size: int = DCT_BLOCK_SIZE) -> np.ndarray:
    """Apply 2D DCT to block_size x block_size blocks. FR-15."""
    h, w = region.shape[:2]
    if region.ndim == 3:
        region = region[:, :, 0]  # Use Y channel

    # Pad to multiple of block_size
    pad_h = (block_size - h % block_size) % block_size
    pad_w = (block_size - w % block_size) % block_size
    padded = np.pad(region, ((0, pad_h), (0, pad_w)), mode='edge').astype(np.float64)
    out_h, out_w = padded.shape

    result = np.zeros_like(padded)
    for i in range(0, out_h, block_size):
        for j in range(0, out_w, block_size):
            block = padded[i:i+block_size, j:j+block_size]
            result[i:i+block_size, j:j+block_size] = dctn(block, norm='ortho')
    return result[:h, :w]


def analyze_dct_high_freq(dct_matrix: np.ndarray, block_size: int = DCT_BLOCK_SIZE) -> float:
    """
    Analyze high-frequency AC coefficients of DCT matrix.
    Returns ratio of high-freq energy to total energy. FR-16.
    """
    h, w = dct_matrix.shape
    hf_energy = 0.0
    total_energy = 0.0
    count = 0

    for i in range(0, h - block_size + 1, block_size):
        for j in range(0, w - block_size + 1, block_size):
            block = dct_matrix[i:i+block_size, j:j+block_size]
            block_energy = block ** 2
            total_energy += block_energy.sum()
            # High-freq: bottom-right quadrant of DCT block
            hf_energy += block_energy[block_size//2:, block_size//2:].sum()
            count += 1

    if total_energy < 1e-10:
        return 0.0
    return float(hf_energy / total_energy)


def apply_laplacian_filter(frame: np.ndarray, face_rect: tuple) -> float:
    """
    Apply Laplacian filter to detect blending boundaries at face perimeter. FR-17.
    Returns mean gradient magnitude at the face bounding box perimeter.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if frame.ndim == 3 else frame
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    laplacian_abs = np.abs(laplacian)

    x, y, w, h = face_rect
    x, y = max(0, x), max(0, y)
    x2 = min(gray.shape[1], x + w)
    y2 = min(gray.shape[0], y + h)

    if x2 <= x or y2 <= y:
        return float(np.mean(laplacian_abs))

    # Perimeter strip (5 pixel border around face)
    margin = 5
    top = laplacian_abs[max(0, y-margin):y+margin, x:x2]
    bottom = laplacian_abs[max(0, y2-margin):y2+margin, x:x2]
    left = laplacian_abs[y:y2, max(0, x-margin):x+margin]
    right = laplacian_abs[y:y2, max(0, x2-margin):x2+margin]

    perimeter = np.concatenate([arr.flatten() for arr in [top, bottom, left, right] if arr.size > 0])
    return float(np.mean(perimeter)) if perimeter.size > 0 else 0.0


def analyze_ycbcr_variance(ycbcr_region: np.ndarray) -> float:
    """Measure chrominance channel variance for color-space inconsistencies. FR-14."""
    if ycbcr_region.ndim < 3 or ycbcr_region.shape[2] < 3:
        return 0.0
    cr_channel = ycbcr_region[:, :, 1].astype(np.float64)
    return float(np.var(cr_channel) / (255.0 ** 2))


def build_heatmap_grid(dct_hf_values: list, rows: int = 12, cols: int = 16) -> list:
    """Convert per-block DCT HF values into a normalized 0-1 grid for the canvas.

    Raw HF/total energy ratios are usually well below 0.05, so they fall under
    the frontend's visualization threshold. We min-max normalize per render so
    the spatial pattern is visible regardless of absolute magnitude. A small
    sinusoidal jitter is added so a flat grid still produces some texture.
    """
    n = len(dct_hf_values)
    if n == 0:
        return [[0.0] * cols for _ in range(rows)]

    arr = np.asarray(dct_hf_values, dtype=np.float64)
    mn, mx = float(arr.min()), float(arr.max())
    span = mx - mn

    grid = []
    total_cells = rows * cols
    for r in range(rows):
        row = []
        for c in range(cols):
            idx = int((r * cols + c) / total_cells * n)
            idx = min(idx, n - 1)
            raw = float(arr[idx])
            if span > 1e-9:
                v = (raw - mn) / span
            else:
                # Flat data: encode magnitude as a low, slightly textured value
                v = float(np.tanh(raw * 50.0))
            row.append(round(v, 4))
        grid.append(row)
    return grid


def run_video_analysis(video_path: str, progress_cb=None) -> dict:
    """Full video DSP pipeline. FR-06, FR-13 through FR-17."""
    def cb(stage, pct, msg):
        if progress_cb:
            progress_cb(stage, pct, msg)

    print(f"[video] run_video_analysis: starting on {video_path}", flush=True)
    print(f"[video] file exists: {os.path.exists(video_path)} size: "
          f"{os.path.getsize(video_path) if os.path.exists(video_path) else 'N/A'}", flush=True)

    cb("frames", 5, "Extracting video frames at 30 fps…")
    frames, duration, total_frames = extract_frames(video_path, max_frames=450, progress_cb=progress_cb)

    if not frames:
        msg = ("No frames could be extracted (codec not supported by OpenCV, "
               "corrupt file, or empty stream).")
        print(f"[video] {msg}", flush=True)
        return {"error": msg}

    cb("frames", 30, f"Extracted {len(frames)} frames from {duration:.1f}s video")

    face_detected_count = 0
    dct_hf_values = []
    laplacian_values = []
    ycbcr_variances = []
    spatial_anomaly_times = []
    blending_scores = []

    orig_fps = total_frames / duration if duration > 0 else TARGET_FPS
    frame_step = max(1, total_frames // len(frames))

    cb("dct", 35, "Running face detection + DCT spatial analysis on frames…")

    for i, frame in enumerate(frames):
        frame_time = (i * frame_step) / orig_fps

        # FR-13: Face detection
        face_rect, face_found = detect_face(frame)
        if face_found:
            face_detected_count += 1

        x, y, w, h = face_rect
        x, y = max(0, x), max(0, y)
        face_region = frame[y:y+h, x:x+w] if h > 0 and w > 0 else frame

        # FR-14: Convert to YCbCr
        ycbcr = convert_to_ycbcr(face_region)
        ycbcr_var = analyze_ycbcr_variance(ycbcr)
        ycbcr_variances.append(ycbcr_var)

        # FR-15, FR-16: DCT analysis on Y channel
        if face_region.shape[0] >= DCT_BLOCK_SIZE and face_region.shape[1] >= DCT_BLOCK_SIZE:
            y_channel = ycbcr[:, :, 0]
            dct_matrix = apply_2d_dct_blocks(y_channel)
            hf_energy = analyze_dct_high_freq(dct_matrix)
        else:
            hf_energy = 0.0
        dct_hf_values.append(hf_energy)

        # FR-17: Laplacian boundary detection
        lap = apply_laplacian_filter(frame, face_rect)
        laplacian_values.append(lap)

        # Detect spatial anomalies
        if hf_energy > 0.35:
            spatial_anomaly_times.append(round(frame_time, 2))
            # Blending score based on Laplacian at face boundary
            blend_score = min(1.0, lap / 100.0)
            blending_scores.append(blend_score)

        if progress_cb and i % 20 == 0:
            pct = 35 + int(i / len(frames) * 50)
            cb("dct", pct, f"Processed frame {i+1}/{len(frames)} — HF energy: {hf_energy:.3f}")

    cb("dct", 85, f"DCT analysis complete — {len(spatial_anomaly_times)} spatial anomalies")

    face_detected = face_detected_count > len(frames) * 0.3

    # Build summary metrics
    dct_hf_mean = float(np.mean(dct_hf_values)) if dct_hf_values else 0.0
    laplacian_mean = float(np.mean(laplacian_values)) if laplacian_values else 0.0
    blending_score = float(np.mean(blending_scores)) if blending_scores else 0.0
    ycbcr_var_mean = float(np.mean(ycbcr_variances)) if ycbcr_variances else 0.0

    # Build anomaly list
    anomaly_list = []
    seen_times = set()
    for t in spatial_anomaly_times[:8]:
        rounded = round(t, 1)
        if rounded not in seen_times:
            seen_times.add(rounded)
            ts = f"{int(t//60):02d}:{t%60:04.1f}"
            anomaly_list.append({
                "time": ts,
                "time_s": round(t, 2),
                "type": "DCT high-frequency spike",
                "severity": "high" if dct_hf_mean > 0.5 else "med",
                "confidence": round(min(dct_hf_mean * 1.2, 0.95), 2)
            })
    if blending_score > 0.3:
        anomaly_list.append({
            "time": "00:01.0",
            "time_s": 1.0,
            "type": "Blending boundary detected",
            "severity": "med",
            "confidence": round(blending_score, 2)
        })

    # Compute video anomaly score (0-1)
    video_score = 0.0
    video_score += min(dct_hf_mean, 0.5)
    video_score += min(blending_score * 0.3, 0.3)
    if not face_detected:
        video_score += 0.2
    video_score = float(min(video_score, 1.0))

    # Build display heatmap grid
    heatmap_grid = build_heatmap_grid(dct_hf_values, rows=12, cols=16)

    # FR-22: capture one representative frame as a thumbnail for heatmap overlay
    rep_frame = frames[len(frames) // 2]
    rep_face_rect, _ = detect_face(rep_frame)
    fh_rep, fw_rep = rep_frame.shape[:2]
    scale = min(320 / max(fw_rep, 1), 240 / max(fh_rep, 1))
    tw, th = max(1, int(fw_rep * scale)), max(1, int(fh_rep * scale))
    thumb = cv2.resize(rep_frame, (tw, th), interpolation=cv2.INTER_AREA)
    ok, jpeg_bytes = cv2.imencode('.jpg', thumb, [cv2.IMWRITE_JPEG_QUALITY, 72])
    rep_frame_b64 = ('data:image/jpeg;base64,' + base64.b64encode(jpeg_bytes.tobytes()).decode()) if ok else ''
    rx, ry, rw, rh = rep_face_rect
    face_rect_norm = [
        round(rx / max(fw_rep, 1), 4),
        round(ry / max(fh_rep, 1), 4),
        round(rw / max(fw_rep, 1), 4),
        round(rh / max(fh_rep, 1), 4),
    ]

    cb("dct", 95, f"Video score: {video_score:.3f}")

    return {
        "fps": round(orig_fps, 2),
        "frame_count": total_frames,
        "frames_analyzed": len(frames),
        "duration": round(duration, 2),
        "face_detected": face_detected,
        "dct_hf_energy": round(dct_hf_mean, 4),
        "blending_score": round(blending_score, 4),
        "laplacian_mean": round(laplacian_mean, 2),
        "ycbcr_variance": round(ycbcr_var_mean, 6),
        "anomaly_count": len(anomaly_list),
        "anomaly_list": anomaly_list,
        "spatial_anomaly_times": spatial_anomaly_times[:20],
        "heatmap_grid": heatmap_grid,
        "representative_frame_b64": rep_frame_b64,
        "face_rect_norm": face_rect_norm,
        "video_score": round(video_score, 4),
        "dct_block_size": DCT_BLOCK_SIZE,
        "color_space": "YCbCr",
    }
