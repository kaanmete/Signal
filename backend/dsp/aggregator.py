"""
Statistical Aggregation Engine
Implements FR-18 through FR-20, FR-24
"""
from typing import Optional


AUDIO_WEIGHT = 0.45  # FR-20: weighted aggregation
VIDEO_WEIGHT = 0.55


def compute_probability_score(
    audio_score: Optional[float],
    video_score: Optional[float],
    audio_enabled: bool = True,
    video_enabled: bool = True,
) -> float:
    """Compute final deepfake probability (0-100). FR-20."""
    if audio_enabled and video_enabled and audio_score is not None and video_score is not None:
        raw = AUDIO_WEIGHT * audio_score + VIDEO_WEIGHT * video_score
    elif audio_enabled and audio_score is not None:
        raw = audio_score
    elif video_enabled and video_score is not None:
        raw = video_score
    else:
        raw = 0.0
    return float(round(min(raw * 100, 100.0), 2))


def compute_verdict(probability: float) -> tuple[str, str]:
    """Return (verdict_label, confidence_label) based on probability."""
    if probability >= 70:
        return "LIKELY MANIPULATED", "High"
    elif probability >= 40:
        return "INCONCLUSIVE", "Medium"
    else:
        return "LIKELY AUTHENTIC", "Low"


def correlate_timestamps(
    audio_anomaly_times: list,
    video_anomaly_times: list,
    window_s: float = 0.5,
) -> tuple[list, int]:
    """
    Correlate audio and video anomaly timestamps within window_s.
    Returns (correlated_bands, sync_mismatch_count). FR-19.
    """
    correlated = []
    matched_video = set()

    for at in audio_anomaly_times:
        for vi, vt in enumerate(video_anomaly_times):
            if vi not in matched_video and abs(at - vt) <= window_s:
                correlated.append({
                    "start": round(min(at, vt) - 0.1, 2),
                    "end": round(max(at, vt) + 0.1, 2),
                })
                matched_video.add(vi)
                break

    sync_mismatches = len(audio_anomaly_times) + len(video_anomaly_times) - 2 * len(correlated)
    sync_mismatches = max(0, sync_mismatches)
    return correlated, sync_mismatches


def build_full_results(
    job_id: str,
    filename: str,
    file_type: str,
    file_size: int,
    audio_results: Optional[dict],
    video_results: Optional[dict],
    opts: dict,
    processing_time: float,
) -> dict:
    """Assemble complete results object for API response and DB storage."""
    # Audio is "ok" when it ran and produced a score. Video is "ok" when it ran
    # and produced a score (an error stub is still surfaced to the UI so the
    # user can see what went wrong, but doesn't contribute to probability).
    audio_ok = (
        opts.get("audio", True)
        and audio_results is not None
        and "audio_score" in audio_results
    )
    video_ok = (
        opts.get("video", True)
        and video_results is not None
        and "video_score" in video_results
    )
    # Decide whether to surface video results at all (even if errored).
    video_surface = opts.get("video", True) and video_results is not None

    audio_enabled = audio_ok
    video_enabled = video_ok

    audio_score = audio_results.get("audio_score") if audio_ok else None
    video_score = video_results.get("video_score") if video_ok else None

    probability = compute_probability_score(audio_score, video_score, audio_enabled, video_enabled)
    verdict, confidence = compute_verdict(probability)

    audio_anomaly_times = []
    video_anomaly_times = []

    if audio_enabled:
        audio_anomaly_times = audio_results.get("phase_anomaly_times", [])
    if video_enabled:
        video_anomaly_times = video_results.get("spatial_anomaly_times", [])

    if audio_enabled and video_enabled:
        correlated_events, sync_mismatches = correlate_timestamps(
            audio_anomaly_times, video_anomaly_times
        )
    else:
        correlated_events, sync_mismatches = [], 0

    audio_events_tl = [{"t": t, "sev": "high" if t < 20 else "med"} for t in audio_anomaly_times[:8]]
    video_events_tl = [{"t": t, "sev": "high" if t < 20 else "med"} for t in video_anomaly_times[:8]]

    duration = 0.0
    if audio_enabled:
        duration = max(duration, audio_results.get("duration", 0.0))
    if video_enabled:
        duration = max(duration, video_results.get("duration", 0.0))

    audio_anomaly_count = audio_results.get("anomaly_count", 0) if audio_enabled else 0
    video_anomaly_count = video_results.get("anomaly_count", 0) if video_enabled else 0

    # All anomalies for table display
    all_anomalies = []
    if audio_enabled:
        all_anomalies.extend(audio_results.get("anomaly_list", []))
    if video_enabled:
        all_anomalies.extend(video_results.get("anomaly_list", []))
    all_anomalies.sort(key=lambda x: x.get("time_s", 0))

    return {
        "id": job_id,
        "filename": filename,
        "status": "completed",
        "deepfake_probability": probability,
        "verdict": verdict,
        "confidence": confidence,
        "audio_anomalies": audio_anomaly_count,
        "video_anomalies": video_anomaly_count,
        "sync_mismatches": sync_mismatches,
        "all_anomalies": all_anomalies,
        "audio": audio_results if audio_results is not None else None,
        # Surface video_results even when they only contain an error stub, so
        # the UI can tell the user the video pipeline ran but failed.
        "video": video_results if video_surface else None,
        "correlation": {
            "sync_mismatches": sync_mismatches,
            "correlated_events": correlated_events,
            "audio_events": audio_events_tl,
            "video_events": video_events_tl,
            "duration": duration,
        },
        "metadata": {
            "file_type": file_type,
            "file_size": file_size,
            "duration": duration,
            "processing_time": round(processing_time, 2),
            "audio_weight": AUDIO_WEIGHT,
            "video_weight": VIDEO_WEIGHT,
        },
    }
