import os
import json
import glob
from dotenv import load_dotenv
load_dotenv()  # ← loads your .env file automatically
import argparse
from pathlib import Path
from crewai import Agent, Task, Crew, Process, LLM
from crewai_tools import FileReadTool
import PyPDF2
import docx2txt
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table
from rich import print as rprint

console = Console()

# ─────────────────────────────────────────────
# OPENAI LLM CONFIG
# ─────────────────────────────────────────────
openai_llm = LLM(
    model="gpt-4o-mini",
    api_key=os.environ.get("OPENAI_API_KEY"),
)

# ─────────────────────────────────────────────
# RESUME READER UTILITY
# ─────────────────────────────────────────────

def read_resume(filepath: str) -> str:
    """Read resume content from PDF or DOCX."""
    ext = Path(filepath).suffix.lower()
    try:
        if ext == ".pdf":
            text = ""
            with open(filepath, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text += page.extract_text() or ""
            return text.strip()
        elif ext in [".docx", ".doc"]:
            return docx2txt.process(filepath).strip()
        elif ext == ".txt":
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                return f.read().strip()
        else:
            return ""
    except Exception as e:
        console.print(f"[red]Error reading {filepath}: {e}[/red]")
        return ""


def load_resumes_from_folder(folder_path: str) -> dict:
    """Load all resumes from a given folder."""
    supported = ["*.pdf", "*.docx", "*.doc", "*.txt"]
    resumes = {}

    for pattern in supported:
        for filepath in glob.glob(os.path.join(folder_path, pattern)):
            name = Path(filepath).stem
            content = read_resume(filepath)
            if content:
                resumes[name] = {"path": filepath, "content": content}

    return resumes


# ─────────────────────────────────────────────
# CREWAI AGENTS & TASKS
# ─────────────────────────────────────────────

def build_crew(resumes: dict, job_description: str, top_n: int = 10) -> str:
    """Build and run the CrewAI crew to analyze resumes."""

    resumes_text = ""
    for name, data in resumes.items():
        resumes_text += f"\n\n--- RESUME: {name} ---\n{data['content'][:3000]}"

    # Agent 1: Resume Parser
    parser_agent = Agent(
        role="Resume Parser",
        goal="Extract structured information from each resume including name, email, phone, skills, experience, education, and years of experience.",
        backstory="You are an expert HR data extractor with years of experience parsing resumes from various formats. You are meticulous and never miss contact details.",
        verbose=False,
        allow_delegation=False,
        llm=openai_llm,
    )

    # Agent 2: Job Analyst
    job_analyst = Agent(
        role="Job Requirements Analyst",
        goal="Deeply understand the job description and extract must-have skills, preferred skills, experience requirements, and keywords.",
        backstory="You are a seasoned technical recruiter who can instantly identify what matters most in a job description and what separates a great fit from a mediocre one.",
        verbose=False,
        allow_delegation=False,
        llm=openai_llm,
    )

    # Agent 3: Resume Scorer
    scorer_agent = Agent(
        role="Resume Scoring Specialist",
        goal="Score each candidate from 0-100 based on how well their resume matches the job requirements. Be fair, data-driven, and consistent.",
        backstory="You are an AI recruiting engine that objectively scores candidates. You weight skills match (40%), experience relevance (30%), education (15%), and overall presentation (15%).",
        verbose=False,
        allow_delegation=False,
        llm=openai_llm,
    )

    # Agent 4: Report Generator
    report_agent = Agent(
        role="Recruitment Report Generator",
        goal="Generate a final structured JSON report listing top candidates with scores, reasons, and contact information.",
        backstory="You create clear, actionable recruitment reports. Your output is always valid JSON that can be parsed programmatically.",
        verbose=False,
        allow_delegation=False,
        llm=openai_llm,
    )

    # Tasks
    task_parse = Task(
        description=f"""
        Parse ALL the following resumes and extract for each:
        - Full Name
        - Email address
        - Phone number
        - LinkedIn or GitHub URL (if present)
        - Top 10 skills
        - Years of total experience
        - Most recent job title
        - Education (degree + institution)

        RESUMES:
        {resumes_text}
        """,
        agent=parser_agent,
        expected_output="A structured summary of all candidates with their parsed information."
    )

    task_analyze_job = Task(
        description=f"""
        Analyze this job description and extract:
        - Required skills (must-have)
        - Preferred skills (nice-to-have)
        - Minimum years of experience
        - Education requirements
        - Key responsibilities keywords
        - Industry/domain keywords

        JOB DESCRIPTION:
        {job_description}
        """,
        agent=job_analyst,
        expected_output="A detailed breakdown of job requirements and scoring criteria."
    )

    task_score = Task(
        description="""
        Using the parsed resume data and job requirements analysis from previous tasks,
        score EVERY candidate from 0 to 100.

        Scoring breakdown:
        - Skills match: 40 points
        - Experience relevance: 30 points  
        - Education: 15 points
        - Presentation/clarity: 15 points

        For each candidate provide:
        - Score (0-100)
        - Top 3 strengths matching the job
        - Top 2 gaps or weaknesses
        - One-line hiring recommendation
        """,
        agent=scorer_agent,
        expected_output="Scored list of all candidates with detailed reasoning.",
        context=[task_parse, task_analyze_job]
    )

    task_report = Task(
        description=f"""
        Generate a FINAL JSON report of the TOP {top_n} candidates (score >= 50, max {top_n}).
        
        Return ONLY valid JSON in this exact format:
        {{
          "job_summary": "one line summary of the role",
          "total_resumes_analyzed": <number>,
          "top_candidates": [
            {{
              "rank": 1,
              "name": "Full Name",
              "score": 85,
              "email": "email@example.com",
              "phone": "+1234567890",
              "linkedin": "url or N/A",
              "current_title": "Current Job Title",
              "years_experience": 5,
              "top_skills": ["skill1", "skill2", "skill3"],
              "strengths": ["strength1", "strength2", "strength3"],
              "gaps": ["gap1", "gap2"],
              "recommendation": "One-line hiring recommendation"
            }}
          ]
        }}

        Return ONLY the JSON object. No markdown, no explanation.
        """,
        agent=report_agent,
        expected_output="Valid JSON report of top candidates.",
        context=[task_parse, task_analyze_job, task_score]
    )

    crew = Crew(
        agents=[parser_agent, job_analyst, scorer_agent, report_agent],
        tasks=[task_parse, task_analyze_job, task_score, task_report],
        process=Process.sequential,
        verbose=False
    )

    result = crew.kickoff()
    return str(result)


# ─────────────────────────────────────────────
# OUTPUT: CHART HTML
# ─────────────────────────────────────────────

def generate_html_chart(report: dict, output_path: str):
    """Generate a clean HTML report matching the app's color theme."""
    candidates = report.get("top_candidates", [])
    job_summary = report.get("job_summary", "Job Role")
    total = report.get("total_resumes_analyzed", len(candidates))
    avg_score = round(sum(c.get("score", 0) for c in candidates) / len(candidates)) if candidates else 0
    top_score = candidates[0].get("score", 0) if candidates else 0

    cards = ""
    for c in candidates:
        score = c.get("score", 0)
        score_color = "#16a34a" if score >= 75 else "#d97706" if score >= 50 else "#dc2626"
        score_bg = "#dcfce7" if score >= 75 else "#fef3c7" if score >= 50 else "#fee2e2"
        skills = ", ".join(c.get("top_skills", [])[:6]) or "N/A"
        strengths = "".join(f"<li>{s}</li>" for s in c.get("strengths", []))
        gaps = "".join(f"<li>{g}</li>" for g in c.get("gaps", []))
        rec = c.get("recommendation", "")
        cards += f"""
        <div class="card">
          <div class="card-top">
            <div class="card-left">
              <div class="rank">#{c.get('rank','?')}</div>
              <div>
                <div class="name">{c.get('name','Unknown')}</div>
                <div class="title-role">{c.get('current_title','N/A')}</div>
              </div>
            </div>
            <div class="score-badge" style="background:{score_bg};color:{score_color}">{score} / 100</div>
          </div>
          <div class="card-body">
            <div class="meta-row">
              <span>✉ {c.get('email','N/A')}</span>
              <span>📞 {c.get('phone','N/A')}</span>
              <span>⏱ {c.get('years_experience','?')} yrs experience</span>
            </div>
            <div class="skills-row"><strong>Skills:</strong> {skills}</div>
            <div class="two-col">
              <div><div class="col-label">Strengths</div><ul>{strengths}</ul></div>
              <div><div class="col-label">Gaps</div><ul>{gaps}</ul></div>
            </div>
            {f'<div class="rec">💡 {rec}</div>' if rec else ''}
          </div>
        </div>"""

    metadata_rows = "".join(
        f"""<tr>
          <td><strong>{c.get('name','Unknown')}</strong></td>
          <td>{c.get('current_title','N/A')}</td>
          <td>{c.get('email','N/A')}</td>
          <td>{c.get('phone','N/A')}</td>
          <td><span style="font-weight:700;color:{'#16a34a' if c.get('score',0)>=75 else '#d97706' if c.get('score',0)>=50 else '#dc2626'}">{c.get('score',0)}</span></td>
        </tr>"""
        for c in candidates
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Resume Analysis Report</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@700;800&display=swap" rel="stylesheet"/>
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family:'Inter',sans-serif; background:#f8f9fa; color:#2d3335; font-size:14px; line-height:1.6; }}

  /* Header */
  .header {{ background:#fff; border-bottom:1px solid #dee3e6; padding:40px 48px 32px; }}
  .header-top {{ display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; }}
  .brand {{ font-family:'Manrope',sans-serif; font-size:1rem; font-weight:800; color:#1a7a4a; letter-spacing:-0.02em; margin-bottom:8px; }}
  .header h1 {{ font-family:'Manrope',sans-serif; font-size:1.7rem; font-weight:800; color:#2d3335; margin-bottom:4px; }}
  .header .role {{ color:#5a6062; font-size:0.95rem; }}
  .stats {{ display:flex; gap:16px; flex-wrap:wrap; margin-top:24px; }}
  .stat {{ background:#ebeef0; border-radius:10px; padding:14px 20px; min-width:110px; }}
  .stat-num {{ font-family:'Manrope',sans-serif; font-size:1.5rem; font-weight:800; color:#1a7a4a; }}
  .stat-label {{ font-size:0.7rem; color:#5a6062; text-transform:uppercase; letter-spacing:0.08em; margin-top:2px; }}

  /* Content */
  .content {{ padding:32px 48px 48px; max-width:1100px; margin:0 auto; }}
  .section-title {{ font-family:'Manrope',sans-serif; font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.15em; color:#5a6062; margin-bottom:16px; padding-bottom:10px; border-bottom:2px solid #dee3e6; }}

  /* Candidate Card */
  .card {{ background:#fff; border:1px solid #dee3e6; border-left:4px solid #1a7a4a; border-radius:12px; margin-bottom:16px; overflow:hidden; }}
  .card-top {{ display:flex; justify-content:space-between; align-items:center; padding:20px 24px; gap:16px; }}
  .card-left {{ display:flex; align-items:center; gap:16px; }}
  .rank {{ font-family:'Manrope',sans-serif; font-size:1.3rem; font-weight:800; color:#1a7a4a; min-width:36px; }}
  .name {{ font-family:'Manrope',sans-serif; font-size:1rem; font-weight:700; color:#2d3335; }}
  .title-role {{ font-size:0.82rem; color:#5a6062; margin-top:2px; }}
  .score-badge {{ font-family:'Manrope',sans-serif; font-size:0.9rem; font-weight:800; padding:6px 14px; border-radius:999px; white-space:nowrap; }}
  .card-body {{ padding:0 24px 20px; border-top:1px solid #ebeef0; }}
  .meta-row {{ display:flex; gap:24px; flex-wrap:wrap; padding:12px 0; font-size:0.82rem; color:#1a7a4a; }}
  .skills-row {{ font-size:0.82rem; color:#5a6062; padding:8px 0 12px; border-bottom:1px solid #ebeef0; }}
  .skills-row strong {{ color:#2d3335; }}
  .two-col {{ display:grid; grid-template-columns:1fr 1fr; gap:16px; padding:12px 0; font-size:0.82rem; }}
  .col-label {{ font-size:0.7rem; font-weight:600; text-transform:uppercase; letter-spacing:0.08em; color:#5a6062; margin-bottom:6px; }}
  .two-col ul {{ padding-left:16px; color:#5a6062; }}
  .two-col li {{ margin-bottom:3px; }}
  .rec {{ background:#ebeef0; border-left:3px solid #1a7a4a; padding:10px 14px; border-radius:0 8px 8px 0; font-size:0.82rem; color:#2d3335; margin-top:10px; font-style:italic; }}

  /* Footer */
  .footer {{ text-align:center; padding:24px 48px; color:#5a6062; font-size:0.78rem; border-top:1px solid #dee3e6; }}

  /* Metadata Table */
  .meta-table {{ width:100%; border-collapse:collapse; background:#fff; border-radius:12px; overflow:hidden; border:1px solid #dee3e6; font-size:0.83rem; }}
  .meta-table th {{ background:#ebeef0; padding:11px 16px; text-align:left; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#5a6062; }}
  .meta-table td {{ padding:12px 16px; border-bottom:1px solid #f1f4f5; color:#2d3335; }}
  .meta-table tr:last-child td {{ border-bottom:none; }}
  .meta-table tr:hover td {{ background:#f8f9fa; }}

  @media print {{
    body {{ background:#fff; }}
    .content, .header {{ padding:24px; }}
    .card {{ break-inside:avoid; }}
  }}
</style>
</head>
<body>

<div class="header">
  <div class="brand">Lumina AI</div>
  <div class="header-top">
    <div>
      <h1>Resume Analysis Report</h1>
      <div class="role">{job_summary}</div>
    </div>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-num">{total}</div><div class="stat-label">Resumes Scanned</div></div>
    <div class="stat"><div class="stat-num">{len(candidates)}</div><div class="stat-label">Top Matches</div></div>
    <div class="stat"><div class="stat-num">{top_score}</div><div class="stat-label">Top Score</div></div>
    <div class="stat"><div class="stat-num">{avg_score}</div><div class="stat-label">Avg Score</div></div>
  </div>
</div>

<div class="content">
  <div class="section-title">Top Candidates</div>
  {cards}
  <div class="section-title" style="margin-top:40px">Candidate Metadata Index</div>
  <table>
    <thead>
      <tr>
        <th>Candidate</th>
        <th>Title</th>
        <th>Email</th>
        <th>Phone</th>
        <th>Score</th>
      </tr>
    </thead>
    <tbody>
      {metadata_rows}
    </tbody>
  </table>
</div>

<div class="footer">Generated by Lumina AI &nbsp;·&nbsp; {total} resumes analyzed &nbsp;·&nbsp; © 2026 Lumina AI</div>

</body>
</html>"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)




# ─────────────────────────────────────────────
# PIPELINE ENTRYPOINT (used by API and CLI)
# ─────────────────────────────────────────────

def run_pipeline(user_input: str) -> dict:
    """
    Reusable pipeline entry point for API and CLI use.

    user_input format: "folder_path|job_description"
    Returns the parsed report dict.
    """
    if "|" not in user_input:
        raise ValueError("user_input must be in format: 'folder_path|job_description'")

    folder_path, job_description = user_input.split("|", 1)
    folder_path = folder_path.strip()
    job_description = job_description.strip()

    if not os.path.isdir(folder_path):
        raise ValueError(f"Folder not found: {folder_path}")

    resumes = load_resumes_from_folder(folder_path)
    if not resumes:
        raise ValueError("No resumes found. Supported formats: PDF, DOCX, TXT")

    if not job_description:
        raise ValueError("Job description cannot be empty.")

    raw_result = build_crew(resumes, job_description)

    try:
        start = raw_result.find("{")
        end = raw_result.rfind("}") + 1
        report = json.loads(raw_result[start:end])
        report["total_resumes_analyzed"] = len(resumes)
    except Exception:
        report = {
            "job_summary": "Analysis complete",
            "total_resumes_analyzed": len(resumes),
            "top_candidates": [],
            "raw_output": raw_result[:2000],
        }

    # Generate HTML report as a side effect
    output_html = os.path.join(os.getcwd(), "resume_results.html")
    generate_html_chart(report, output_html)

    return report