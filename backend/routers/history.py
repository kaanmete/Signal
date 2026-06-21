"""
Analysis history and PDF report generation. FR-24.
"""
import io
import json
import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import Analysis, get_db

router = APIRouter()


@router.get("/history")
def get_history(db: Session = Depends(get_db)):
    """Return all completed/failed analyses for the history page."""
    records = (
        db.query(Analysis)
        .order_by(Analysis.created_at.desc())
        .limit(100)
        .all()
    )
    result = []
    for r in records:
        dur = ""
        if r.results_json:
            try:
                data = json.loads(r.results_json)
                secs = data.get("metadata", {}).get("duration", 0)
                if secs:
                    mins = int(secs // 60)
                    sec_rem = int(secs % 60)
                    dur = f"{mins}:{sec_rem:02d}"
            except Exception:
                pass

        verdict_key = "low"
        if r.deepfake_probability is not None:
            if r.deepfake_probability >= 70:
                verdict_key = "high"
            elif r.deepfake_probability >= 40:
                verdict_key = "med"

        result.append({
            "id": r.id,
            "name": r.filename,
            "kind": r.file_type,
            "icon": "🎬" if r.file_type == "video" else "🎙",
            "date": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
            "dur": dur,
            "prob": r.deepfake_probability or 0.0,
            "verdict": verdict_key,
            "status": r.status,
        })
    return result


@router.delete("/history/{analysis_id}")
def delete_analysis(analysis_id: str, db: Session = Depends(get_db)):
    record = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(record)
    db.commit()
    return {"deleted": analysis_id}


@router.get("/report/{job_id}")
def download_report(job_id: str, db: Session = Depends(get_db)):
    """Generate and download a forensic PDF report. FR-24."""
    record = db.query(Analysis).filter(Analysis.id == job_id).first()
    if not record or record.status != "completed":
        raise HTTPException(status_code=404, detail="Results not found or not completed")

    results = {}
    if record.results_json:
        results = json.loads(record.results_json)

    pdf_bytes = _generate_pdf_report(record, results)
    filename = f"forensic_report_{record.filename}_{job_id[:8]}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


def _generate_pdf_report(record: Analysis, results: dict) -> bytes:
    """Generate comprehensive forensic PDF with reportlab. FR-24."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle("title", parent=styles["Heading1"],
                                  fontSize=18, spaceAfter=6, textColor=colors.HexColor("#1e40af"))
    h2_style = ParagraphStyle("h2", parent=styles["Heading2"],
                               fontSize=13, spaceBefore=12, spaceAfter=4,
                               textColor=colors.HexColor("#1e3a8a"))
    normal = styles["Normal"]
    mono_style = ParagraphStyle("mono", parent=normal, fontName="Courier", fontSize=9)
    small = ParagraphStyle("small", parent=normal, fontSize=9, textColor=colors.HexColor("#64748b"))

    story = []

    # Header
    story.append(Paragraph("Deepfake Forensic Analysis Report", title_style))
    story.append(Paragraph("CENG 384 — Signal Processing | Forensic Analysis Engine", small))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#3b82f6")))
    story.append(Spacer(1, 0.3*cm))

    # Summary table
    prob = results.get("deepfake_probability", record.deepfake_probability or 0)
    verdict = results.get("verdict", record.verdict or "UNKNOWN")
    conf = results.get("confidence", "—")
    audio_anom = results.get("audio_anomalies", record.audio_anomalies or 0)
    video_anom = results.get("video_anomalies", record.video_anomalies or 0)
    sync = results.get("sync_mismatches", record.sync_mismatches or 0)
    proc_time = results.get("metadata", {}).get("processing_time", "—")

    color_verdict = colors.HexColor("#dc2626") if prob >= 70 else (
        colors.HexColor("#d97706") if prob >= 40 else colors.HexColor("#16a34a"))

    story.append(Paragraph("1. Executive Summary", h2_style))
    summary_data = [
        ["Parameter", "Value"],
        ["File", record.filename],
        ["File Type", record.file_type.capitalize()],
        ["File Size", f"{(record.file_size or 0) / 1024:.1f} KB"],
        ["Analysis Date", record.created_at.strftime("%Y-%m-%d %H:%M UTC") if record.created_at else "—"],
        ["Processing Time", f"{proc_time}s" if isinstance(proc_time, (int, float)) else str(proc_time)],
        ["Deepfake Probability", f"{prob:.2f}%"],
        ["Verdict", verdict],
        ["Confidence Level", conf],
        ["Audio Anomalies", str(audio_anom)],
        ["Video Anomalies", str(video_anom)],
        ["A/V Sync Mismatches", str(sync)],
    ]
    t = Table(summary_data, colWidths=[6*cm, 11*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e40af")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("BACKGROUND", (0, 6), (-1, 6), colors.HexColor("#fef2f2")),
        ("TEXTCOLOR", (1, 6), (1, 6), color_verdict),
        ("FONTNAME", (1, 6), (1, 6), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.4*cm))

    # Audio analysis section
    audio = results.get("audio")
    if audio:
        story.append(Paragraph("2. Audio DSP Analysis", h2_style))
        audio_data = [
            ["Metric", "Value", "Assessment"],
            ["Sample Rate", f"{audio.get('sample_rate', 16000)} Hz", "FR-04: Normalized to 16 kHz"],
            ["Duration", f"{audio.get('duration', 0):.2f} s", "—"],
            ["STFT Window", audio.get("stft_window", "hamming").capitalize(), "FR-07: Hamming window, 25ms"],
            ["MFCC Count", str(audio.get("mfcc_count", 13)), "FR-09: 13 coefficients"],
            ["Phase Variance Max", f"{audio.get('phase_variance_max', 0):.3f}", "FR-10: Continuity tracking"],
            ["HF Band Energy Ratio (>8kHz)", f"{audio.get('hf_ratio', 0):.4f}", "FR-12: Vocoder artifact check"],
            ["Vocoder Detected", str(audio.get("vocoder_detected", False)), "FR-12"],
            ["MFCC Ratio", f"{audio.get('mfcc_ratio', 0):.3f}", "FR-18: Vocal tract constraint"],
            ["Vocal Tract Anomaly", str(audio.get("vocal_tract_anomaly", False)), "FR-18"],
            ["SNR", f"{audio.get('snr', 0):.1f} dB", "Signal quality"],
            ["Audio Score", f"{audio.get('audio_score', 0)*100:.2f}%", "Component score"],
        ]
        t2 = Table(audio_data, colWidths=[6*cm, 4*cm, 7*cm])
        t2.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        story.append(t2)
        story.append(Spacer(1, 0.3*cm))

        # Audio anomalies
        anomalies = audio.get("anomaly_list", [])
        if anomalies:
            story.append(Paragraph("Audio Anomaly Events", h2_style))
            anom_data = [["Time", "Type", "Severity", "Confidence"]]
            for a in anomalies:
                anom_data.append([
                    a.get("time", "—"), a.get("type", "—"),
                    a.get("severity", "—").upper(), f"{a.get('confidence', 0):.2f}"
                ])
            t3 = Table(anom_data, colWidths=[3*cm, 8*cm, 3*cm, 3*cm])
            t3.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#374151")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]))
            story.append(t3)

    # Video analysis section
    video = results.get("video")
    if video:
        story.append(Spacer(1, 0.3*cm))
        story.append(Paragraph("3. Video Spatial Analysis", h2_style))
        video_data = [
            ["Metric", "Value", "Assessment"],
            ["Frame Rate", f"{video.get('fps', 30):.1f} fps", "FR-06: Standard 30 fps"],
            ["Total Frames", str(video.get("frame_count", 0)), "—"],
            ["Frames Analyzed", str(video.get("frames_analyzed", 0)), "Sampled"],
            ["Duration", f"{video.get('duration', 0):.2f} s", "—"],
            ["Face Detected", str(video.get("face_detected", False)), "FR-13: Haar cascade"],
            ["Color Space", video.get("color_space", "YCbCr"), "FR-14: YCbCr conversion"],
            ["DCT Block Size", f"{video.get('dct_block_size', 8)}×{video.get('dct_block_size', 8)}", "FR-15"],
            ["DCT HF Energy", f"{video.get('dct_hf_energy', 0):.4f}", "FR-16: High-freq AC coefficients"],
            ["Blending Score", f"{video.get('blending_score', 0):.4f}", "FR-17: Laplacian boundary"],
            ["Laplacian Mean", f"{video.get('laplacian_mean', 0):.2f}", "FR-17"],
            ["YCbCr Variance", f"{video.get('ycbcr_variance', 0):.6f}", "FR-14: Chrominance"],
            ["Video Score", f"{video.get('video_score', 0)*100:.2f}%", "Component score"],
        ]
        t4 = Table(video_data, colWidths=[6*cm, 4*cm, 7*cm])
        t4.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        story.append(t4)

    # Aggregation
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph("4. Statistical Aggregation", h2_style))
    meta = results.get("metadata", {})
    agg_data = [
        ["Parameter", "Value"],
        ["Audio Weight", f"{meta.get('audio_weight', 0.45):.0%}"],
        ["Video Weight", f"{meta.get('video_weight', 0.55):.0%}"],
        ["Final Deepfake Probability", f"{prob:.2f}%"],
        ["Verdict", verdict],
        ["Correlated A/V Events", str(len(results.get("correlation", {}).get("correlated_events", [])))],
    ]
    t5 = Table(agg_data, colWidths=[8*cm, 9*cm])
    t5.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#374151")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(t5)

    # Footer
    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#94a3b8")))
    story.append(Paragraph(
        f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} | "
        "Deepfake Forensic Analysis Engine | CENG 384 Signal Processing",
        small
    ))

    doc.build(story)
    return buf.getvalue()
