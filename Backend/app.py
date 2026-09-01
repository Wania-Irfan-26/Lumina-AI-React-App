import os
import io
import json

import PyPDF2
import docx2txt

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from dotenv import load_dotenv

load_dotenv()

from main import build_crew, generate_html_chart

app = FastAPI(title="AI Resume Analyzer API")

# Allow configuring allowed origins via env var for production
# e.g. ALLOWED_ORIGINS=https://your-app.vercel.app
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in _raw_origins.split(",")] if _raw_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store report relative to this file, safe for any deployment environment
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HTML_REPORT_PATH = os.path.join(BASE_DIR, "resume_results.html")


# ─────────────────────────────────────────────
# IN-MEMORY RESUME LOADER
# ─────────────────────────────────────────────

async def load_resumes_from_uploads(files: List[UploadFile]) -> dict:
    """Read uploaded files in memory and extract text by type."""
    resumes = {}

    for file in files:
        raw = await file.read()
        name = os.path.splitext(file.filename)[0]
        ext = os.path.splitext(file.filename)[1].lower()
        content = ""

        try:
            if ext == ".pdf":
                reader = PyPDF2.PdfReader(io.BytesIO(raw))
                content = "".join(page.extract_text() or "" for page in reader.pages).strip()

            elif ext in (".docx", ".doc"):
                # docx2txt.process accepts a file-like object
                content = docx2txt.process(io.BytesIO(raw)).strip()

            elif ext == ".txt":
                content = raw.decode("utf-8", errors="ignore").strip()

        except Exception as e:
            # Skip unreadable files rather than crashing the whole request
            print(f"[warn] Could not read {file.filename}: {e}")
            continue

        if content:
            resumes[name] = {"path": file.filename, "content": content}

    return resumes


# ─────────────────────────────────────────────
# PIPELINE WRAPPER (upload-based)
# ─────────────────────────────────────────────

async def run_pipeline_from_uploads(files: List[UploadFile], job_description: str, top_n: int = 10) -> dict:
    """Load resumes from uploads, run CrewAI pipeline, return report dict."""
    resumes = await load_resumes_from_uploads(files)

    if not resumes:
        raise ValueError("No readable resumes found. Supported formats: PDF, DOCX, TXT")

    if not job_description.strip():
        raise ValueError("Job description cannot be empty.")

    raw_result = build_crew(resumes, job_description, top_n)

    try:
        start = raw_result.find("{")
        end = raw_result.rfind("}") + 1
        report = json.loads(raw_result[start:end])
        report["total_resumes_analyzed"] = len(resumes)
        # Enforce the requested count hard — don't rely on the AI to slice correctly
        if "top_candidates" in report:
            report["top_candidates"] = report["top_candidates"][:top_n]
    except Exception:
        report = {
            "job_summary": "Analysis complete",
            "total_resumes_analyzed": len(resumes),
            "top_candidates": [],
            "raw_output": raw_result[:2000],
        }

    generate_html_chart(report, HTML_REPORT_PATH)

    return report


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "running", "docs": "/docs", "endpoints": ["POST /run", "GET /download-report"]}


@app.post("/run")
async def run_app(
    files: List[UploadFile] = File(...),
    job_description: str = Form(...),
    top_n: int = Form(10),
):
    try:
        report = await run_pipeline_from_uploads(files, job_description, top_n)
        return {"output": report}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")


@app.get("/download-report")
def download_report():
    if not os.path.exists(HTML_REPORT_PATH):
        raise HTTPException(status_code=404, detail="Report not found. Run an analysis first.")
    return FileResponse(
        path=HTML_REPORT_PATH,
        media_type="text/html",
        filename="resume_results.html",
    )
