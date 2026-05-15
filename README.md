# Lumina AI — Resume Analyzer

An AI-powered resume screening system built with CrewAI, FastAPI, and React. Upload multiple resumes, provide a job description, and get a ranked list of top candidates with scores, strengths, gaps, and hiring recommendations.

---

## How It Works

1. User uploads resume files (PDF, DOCX, TXT) and pastes a job description
2. FastAPI receives the files and extracts text in memory
3. Four CrewAI agents run sequentially:
   - **Resume Parser** — extracts name, email, phone, skills, experience
   - **Job Analyst** — breaks down the job requirements
   - **Scorer** — scores each candidate 0–100
   - **Report Generator** — produces a structured JSON report
4. Results are displayed in the React UI and a downloadable HTML report is generated

---

## Project Structure

```
├── main.py              # Core AI pipeline (CrewAI agents + resume parsing)
├── api.py               # FastAPI backend (file upload, endpoints)
├── requirements.txt     # Python dependencies
├── .env                 # Environment variables (not committed)
├── .env.example         # Example env file
└── frontend/
    ├── src/
    │   ├── App.jsx      # Main React UI
    │   ├── main.jsx     # React entry point
    │   └── index.css    # Tailwind + theme config
    ├── package.json
    └── vite.config.js
```

---

## Setup

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd <project-folder>
```

### 2. Create a virtual environment and install Python dependencies

```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

pip install -r requirements.txt
```

### 3. Set up environment variables

Copy `.env.example` to `.env` and add your OpenAI API key:

```bash
cp .env.example .env
```

```env
OPENAI_API_KEY=sk-...
```

### 4. Install frontend dependencies

```bash
cd frontend
npm install
```

---

## Running the App

You need two terminals running at the same time.

**Terminal 1 — Backend:**
```bash
uvicorn api:app --reload
```
Backend runs at `http://localhost:8000`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs at `http://localhost:5173`

Open `http://localhost:5173` in your browser.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `POST` | `/run` | Run analysis (multipart/form-data: `files`, `job_description`) |
| `GET` | `/download-report` | Download the generated HTML report |
| `GET` | `/docs` | Interactive API docs (Swagger UI) |

---

## Supported Resume Formats

- PDF (`.pdf`)
- Word Document (`.docx`, `.doc`)
- Plain Text (`.txt`)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Agents | CrewAI + GPT-4o-mini |
| Backend | FastAPI + Uvicorn |
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS v4 |
| Animations | Motion (Framer Motion) |
| Icons | Lucide React |
| PDF Parsing | PyPDF2 |
| DOCX Parsing | docx2txt |

---

## Notes

- Resumes are processed **in memory** — no files are saved to disk
- Analysis typically takes **1–3 minutes** depending on the number of resumes
- The downloaded report (`resume_results.html`) is saved in the project root after each analysis

---

## License

Apache 2.0
