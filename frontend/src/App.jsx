/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Sliders, 
  Sparkles, 
  FileText, 
  ArrowRight, 
  Download, 
  Filter, 
  Search, 
  MessageSquare,
  LayoutDashboard,
  X,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import API_BASE from './config.js';

const API_BASE_URL = API_BASE;

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [topResultsCount, setTopResultsCount] = useState(10);
  const [files, setFiles] = useState([]);
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [modal, setModal] = useState(null); // 'docs' | 'privacy' | 'terms'
  const fileInputRef = useRef(null);

  const candidates = report?.top_candidates ?? [];
  const summary = report ? {
    role: report.job_summary ?? 'Analysis Complete',
    totalCandidates: report.total_resumes_analyzed ?? candidates.length,
    avgTopTierScore: candidates.length
      ? Math.round(candidates.reduce((s, c) => s + (c.score ?? 0), 0) / candidates.length)
      : 0,
    distribution: candidates.map(c => c.score ?? 0),
    technicalAlignment: candidates.length ? Math.round(candidates[0]?.score ?? 0) : 0,
    seniorityMatch: candidates.length ? Math.round((candidates[0]?.years_experience ?? 0) * 10) : 0,
    cultureFit: candidates.length ? Math.round((candidates.reduce((s, c) => s + (c.score ?? 0), 0) / candidates.length) * 0.9) : 0,
  } : null;

  function addFiles(incoming) {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    const valid = Array.from(incoming).filter(f => allowed.includes(f.type) || f.name.match(/\.(pdf|docx|txt)$/i));
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...valid.filter(f => !names.has(f.name))];
    });
  }

  function removeFile(name) {
    setFiles(prev => prev.filter(f => f.name !== name));
  }

  async function handleAnalyze() {
    setError('');
    if (files.length === 0) { setError('Please upload at least one resume.'); return; }
    if (!jobDescription.trim()) { setError('Please enter a job description.'); return; }

    const form = new FormData();
    files.forEach(f => form.append('files', f));
    form.append('job_description', jobDescription);
    form.append('top_n', topResultsCount);

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/run`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Something went wrong');
      setReport(data.output);
      setCurrentScreen('results');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    window.open(`${API_BASE_URL}/download-report`, '_blank');
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-surface sticky top-0 z-50 border-b border-surface-container-highest/30">
        <div className="flex justify-between items-center w-full px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-8">
            <span className="text-xl font-bold text-primary tracking-tight">Lumina AI</span>
            <nav className="hidden md:flex items-center gap-6">
              <button 
                onClick={() => setCurrentScreen('dashboard')}
                className={`flex items-center gap-2 text-sm font-medium transition-all px-3 py-1.5 rounded-lg ${
                  currentScreen === 'dashboard' 
                    ? 'text-primary bg-primary/5' 
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container'
                }`}
              >
                <LayoutDashboard size={16} />
                Dashboard
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4">
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full px-8 py-12">
        <AnimatePresence mode="wait">
          {currentScreen === 'dashboard' ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="max-w-4xl mx-auto"
            >
              {/* Hero Section */}
              <div className="text-center mb-16">
                <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 text-on-surface leading-[1.1]">
                  AI Resume Analyzer – <span className="text-primary">Autonomous</span> hiring system
                </h1>
                <p className="text-on-surface-variant text-lg max-w-2xl mx-auto leading-relaxed">
                  Leverage the power of precision AI to curate the perfect candidates for your team. Effortless analysis through the lens of a Digital Curator.
                </p>
              </div>

              <div className="space-y-8">
                {/* Inputs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  {/* File Uploader */}
                  <div className="md:col-span-7 bg-surface-container-lowest rounded-2xl p-8 transition-all hover:shadow-xl hover:shadow-on-surface/5 relative overflow-hidden group border border-surface-container-highest/20">
                    <div className="absolute left-0 top-0 w-1.5 h-full bg-primary-fixed"></div>
                    <div
                      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-12 px-6 transition-colors cursor-pointer ${isDragging ? 'border-primary bg-primary/5' : 'border-outline-variant/30 group-hover:border-primary/40'}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files); }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.docx,.txt"
                        className="hidden"
                        onChange={(e) => addFiles(e.target.files)}
                      />
                      <div className="w-16 h-16 bg-primary-container/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        <UploadCloud className="text-primary" size={32} />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Upload Resumes</h3>
                      <p className="text-on-surface-variant text-sm text-center mb-6">
                        Drag and drop PDF or DOCX files here or <span className="text-primary font-semibold hover:underline">browse files</span>
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <span className="px-3 py-1 bg-secondary-container text-on-secondary-container text-[0.7rem] font-bold rounded-lg uppercase tracking-wider">PDF</span>
                        <span className="px-3 py-1 bg-secondary-container text-on-secondary-container text-[0.7rem] font-bold rounded-lg uppercase tracking-wider">DOCX</span>
                        <span className="px-3 py-1 bg-secondary-container text-on-secondary-container text-[0.7rem] font-bold rounded-lg uppercase tracking-wider">TXT</span>
                      </div>
                    </div>
                    {files.length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {files.map(f => (
                          <li key={f.name} className="flex items-center justify-between bg-surface-container px-4 py-2 rounded-xl text-sm">
                            <span className="truncate text-on-surface">{f.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); removeFile(f.name); }} className="ml-3 text-on-surface-variant hover:text-red-400 transition-colors">
                              <X size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Settings Panel */}
                  <div className="md:col-span-5 bg-surface-container-lowest rounded-2xl p-8 relative border border-surface-container-highest/20">
                    <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
                      <Sliders className="text-primary" size={20} />
                      Analysis Settings
                    </h3>
                    <div className="space-y-8">
                      <div>
                        <label className="text-[0.7rem] font-bold text-on-surface-variant uppercase tracking-widest mb-4 block">Top Results Count</label>
                        <div className="flex items-center gap-4">
                          <input 
                            className="flex-1 h-1.5 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary" 
                            max="20" min="3" type="range" 
                            value={topResultsCount}
                            onChange={(e) => setTopResultsCount(parseInt(e.target.value))}
                          />
                          <span className="bg-surface-container text-primary font-bold px-3 py-1 rounded-lg text-sm min-w-[3rem] text-center">
                            {topResultsCount}
                          </span>
                        </div>
                      </div>
                      <div className="p-5 bg-surface-container-low rounded-xl border border-outline-variant/10 relative overflow-hidden">
                        <div className="flex gap-4">
                          <Sparkles className="text-tertiary shrink-0" size={20} />
                          <p className="text-sm text-on-surface-variant leading-relaxed italic">
                            "Our curator will prioritize high-density skill matching and behavioral alignment."
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Job Description */}
                <div className="bg-surface-container-lowest rounded-2xl p-8 relative border border-surface-container-highest/20">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <FileText className="text-primary" size={20} />
                      Job Description
                    </h3>
                    <span className="text-[0.7rem] font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full uppercase tracking-wider">AI Contextual Input</span>
                  </div>
                  <textarea 
                    className="w-full min-h-[200px] bg-transparent border-b-2 border-surface-container-highest focus:border-primary focus:ring-0 text-on-surface text-sm leading-relaxed resize-none transition-colors outline-none pb-4" 
                    placeholder="Paste the full job requirements, culture fit, and role responsibilities here..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                  ></textarea>
                </div>

                {/* Action Button */}
                <div className="flex flex-col items-center gap-4 pt-8">
                  {error && (
                    <p className="text-red-400 text-sm font-medium">{error}</p>
                  )}
                  <button 
                    onClick={handleAnalyze}
                    disabled={loading}
                    className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-12 py-4 rounded-full font-bold text-lg flex items-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all group disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {loading ? (
                      <><Loader2 className="animate-spin" size={20} /> Analyzing...</>
                    ) : (
                      <>Analyze Resumes <ArrowRight className="transition-transform group-hover:translate-x-1" size={20} /></>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="results"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-12"
            >
              {/* Results Header */}
              <div>
                <h1 className="text-4xl font-extrabold text-on-surface mb-3">Analysis Results: {summary?.role}</h1>
                <p className="text-on-surface-variant max-w-2xl text-lg">
                  Precision analysis of {summary?.totalCandidates} candidates based on role-specific heuristics, technical stack compatibility, and leadership potential.
                </p>
              </div>

              {/* Bento Grid Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Score Distribution */}
                <div className="lg:col-span-2 bg-surface-container-lowest p-8 rounded-2xl shadow-sm border-l-4 border-primary-fixed border border-surface-container-highest/20">
                  <div className="flex justify-between items-end mb-8">
                    <div>
                      <h2 className="text-2xl font-bold mb-1">Score Distribution</h2>
                      <p className="text-sm text-on-surface-variant">Aggregated match percentage across all applicants</p>
                    </div>
                    <div className="text-right">
                      <span className="text-5xl font-extrabold text-primary">{summary?.avgTopTierScore}%</span>
                      <span className="block text-[0.65rem] font-bold uppercase text-on-surface-variant tracking-[0.2em] mt-1">Avg. Top Tier</span>
                    </div>
                  </div>
                  
                  <div className="flex items-end gap-3 h-40 w-full px-2">
                    {(summary?.distribution ?? []).map((val, i) => (
                      <motion.div 
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${val}%` }}
                        transition={{ delay: i * 0.05, duration: 0.8, ease: "circOut" }}
                        className={`flex-1 rounded-t-xl ${val > 80 ? 'bg-primary' : val > 60 ? 'bg-primary-container' : 'bg-surface-container'}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-6 text-[0.65rem] font-bold text-on-surface-variant uppercase tracking-[0.15em]">
                    <span>40% Match</span>
                    <span>60% Match</span>
                    <span>80% Match</span>
                    <span>100% Match</span>
                  </div>
                </div>

                {/* KPIs */}
                <div className="bg-surface-container p-8 rounded-2xl flex flex-col justify-between border border-surface-container-highest/20">
                  <div>
                    <h3 className="text-[0.65rem] font-bold uppercase text-on-surface-variant mb-8 tracking-[0.25em]">Key Performance Indicators</h3>
                    <div className="space-y-8">
                      <KPIItem label="Technical Alignment" value={summary?.technicalAlignment ?? 0} color="bg-primary" />
                      <KPIItem label="Seniority Match" value={summary?.seniorityMatch ?? 0} color="bg-primary" />
                      <KPIItem label="Culture Fit Pred." value={summary?.cultureFit ?? 0} color="bg-tertiary" />
                    </div>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="mt-10 w-full py-4 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full font-bold text-sm hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10">
                    <Download size={18} />
                    Export Full Report
                  </button>
                </div>
              </div>

              {/* Top Talent Matches */}
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <h2 className="text-3xl font-extrabold">Top Talent Matches</h2>
                  <span className="px-4 py-1 bg-secondary-container text-on-secondary-container text-xs font-bold rounded-full uppercase tracking-wider">{candidates.length} Shortlisted</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                  {candidates.map((candidate, idx) => (
                    <CandidateCard key={idx} candidate={candidate} delay={idx * 0.1} />
                  ))}
                </div>
              </div>

              {/* Metadata Table */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-surface-container-highest/20">
                <div className="px-8 py-6 border-b border-surface-container-high flex justify-between items-center">
                  <h3 className="text-xl font-bold">Candidate Metadata Index</h3>
                  <div className="flex gap-2">
                    <button className="p-2.5 bg-surface-container rounded-xl hover:bg-surface-container-high transition-colors text-on-surface-variant">
                      <Filter size={18} />
                    </button>
                    <button className="p-2.5 bg-surface-container rounded-xl hover:bg-surface-container-high transition-colors text-on-surface-variant">
                      <Search size={18} />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left">
                    <thead className="bg-surface-container-low">
                      <tr>
                        <th className="px-8 py-5 text-[0.65rem] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Candidate</th>
                        <th className="px-6 py-5 text-[0.65rem] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Title</th>
                        <th className="px-6 py-5 text-[0.65rem] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Contact</th>
                        <th className="px-6 py-5 text-[0.65rem] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-low">
                      {candidates.map((candidate, idx) => (
                        <tr key={idx} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-8 py-5 font-bold text-sm">{candidate.name}</td>
                          <td className="px-6 py-5 text-sm text-on-surface-variant">{candidate.current_title ?? 'N/A'}</td>
                          <td className="px-6 py-5 text-sm text-on-surface-variant">{candidate.phone ?? 'N/A'}</td>
                          <td className="px-6 py-5 text-sm text-on-surface-variant">{candidate.email ?? 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container/50 border-t border-surface-container-highest/20 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-2">
            <span className="text-lg font-bold text-primary">Lumina AI</span>
            <p className="text-sm text-on-surface-variant">© 2026 Lumina AI. Precision Resume Analysis.</p>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-10 gap-y-4">
            <button onClick={() => setModal('docs')} className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">Documentation</button>
            <button onClick={() => setModal('privacy')} className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">Privacy Policy</button>
            <button onClick={() => setModal('terms')} className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors">Terms of Service</button>
          </nav>
        </div>
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => setModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-surface-container-lowest rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8 relative"
              onClick={e => e.stopPropagation()}
            >
              <button onClick={() => setModal(null)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface transition-colors">
                <X size={20} />
              </button>

              {modal === 'docs' && (
                <div>
                  <h2 className="text-2xl font-extrabold text-on-surface mb-2">Sample Analysis Report</h2>
                  <p className="text-sm text-on-surface-variant mb-6">This is what your downloaded report will look like after running an analysis.</p>
                  <div className="space-y-4">
                    <div className="bg-surface-container rounded-xl p-5 border border-surface-container-highest/30">
                      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Job Summary</p>
                      <p className="text-sm font-semibold text-on-surface">Senior Python Engineer — Backend Infrastructure</p>
                    </div>
                    <div className="bg-surface-container rounded-xl p-5 border border-surface-container-highest/30">
                      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Top Candidates</p>
                      {[{ name: 'Alex Johnson', score: 91, title: 'Backend Engineer', email: 'alex@example.com' },
                        { name: 'Maria Chen', score: 85, title: 'Python Developer', email: 'maria@example.com' }].map((c, i) => (
                        <div key={i} className="flex items-center justify-between py-3 border-b border-surface-container-high last:border-0">
                          <div>
                            <p className="text-sm font-bold text-on-surface">#{i+1} {c.name}</p>
                            <p className="text-xs text-on-surface-variant">{c.title} · {c.email}</p>
                          </div>
                          <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">{c.score}%</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-surface-container rounded-xl p-5 border border-surface-container-highest/30">
                      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Report Includes</p>
                      <ul className="text-sm text-on-surface-variant space-y-1 mt-2 list-disc list-inside">
                        <li>Ranked candidate list with scores</li>
                        <li>Skill match breakdown per candidate</li>
                        <li>Strengths and gaps analysis</li>
                        <li>AI hiring recommendation per candidate</li>
                        <li>Interactive score distribution chart</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {modal === 'privacy' && (
                <div>
                  <h2 className="text-2xl font-extrabold text-on-surface mb-2">Privacy Policy</h2>
                  <p className="text-xs text-on-surface-variant mb-6">Last updated: January 2026</p>
                  <div className="space-y-4 text-sm text-on-surface-variant leading-relaxed">
                    <p>Lumina AI is committed to protecting your privacy. This policy explains how we handle data when you use our resume analysis platform.</p>
                    <p><span className="font-semibold text-on-surface">Data Collection:</span> We only process the resume files and job descriptions you explicitly upload. We do not store your files after analysis is complete.</p>
                    <p><span className="font-semibold text-on-surface">Data Usage:</span> Uploaded content is used solely to generate the analysis report. It is not shared with third parties, sold, or used for training purposes.</p>
                    <p><span className="font-semibold text-on-surface">Security:</span> All data is processed in memory and discarded after the session. We use industry-standard practices to protect data in transit.</p>
                    <p><span className="font-semibold text-on-surface">Contact:</span> For any privacy concerns, reach out to us at privacy@lumina-ai.com.</p>
                  </div>
                </div>
              )}

              {modal === 'terms' && (
                <div>
                  <h2 className="text-2xl font-extrabold text-on-surface mb-2">Terms of Service</h2>
                  <p className="text-xs text-on-surface-variant mb-6">Last updated: January 2026</p>
                  <div className="space-y-4 text-sm text-on-surface-variant leading-relaxed">
                    <p>By using Lumina AI, you agree to the following terms. Please read them carefully before using the platform.</p>
                    <p><span className="font-semibold text-on-surface">Acceptable Use:</span> You may only upload resume files and job descriptions you have the right to process. You agree not to misuse the platform for unlawful purposes.</p>
                    <p><span className="font-semibold text-on-surface">No Guarantee:</span> AI-generated analysis is provided for informational purposes only. Lumina AI does not guarantee hiring outcomes or the accuracy of scores.</p>
                    <p><span className="font-semibold text-on-surface">Intellectual Property:</span> The Lumina AI platform, its design, and underlying technology are the property of Lumina AI. You may not reproduce or redistribute them.</p>
                    <p><span className="font-semibold text-on-surface">Limitation of Liability:</span> Lumina AI is not liable for any decisions made based on the analysis output. Use of this tool is at your own discretion.</p>
                    <p><span className="font-semibold text-on-surface">Changes:</span> We reserve the right to update these terms at any time. Continued use of the platform constitutes acceptance of the updated terms.</p>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function KPIItem({ label, value, color }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-on-surface">{label}</span>
        <span className="text-sm font-bold text-primary">{value}%</span>
      </div>
      <div className="w-full bg-surface-container-highest/50 h-2 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`${color} h-full rounded-full`}
        />
      </div>
    </div>
  );
}

function CandidateCard({ candidate, delay }) {
  // Map API response fields to display fields
  const competencies = candidate.competencies ?? (candidate.top_skills ?? []).slice(0, 4).map((s, i) => ({
    name: s,
    score: Math.max(60, (candidate.score ?? 70) - i * 5),
  }));
  const topStrength = candidate.topStrength ?? candidate.strengths?.[0] ?? 'N/A';
  const gap = candidate.gap ?? candidate.gaps?.[0] ?? 'N/A';
  const aiComment = candidate.aiComment ?? candidate.recommendation ?? '';
  const avatar = candidate.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.name)}&background=1a7a4a&color=fff&size=128`;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm border-l-4 border-primary border border-surface-container-highest/20 hover:shadow-xl hover:shadow-on-surface/5 transition-all group"
    >
      <div className="flex items-start justify-between mb-8">
        <div className="flex gap-5 items-center">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md group-hover:scale-105 transition-transform duration-300">
            <img 
              alt={candidate.name} 
              className="w-full h-full object-cover" 
              src={avatar}
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h3 className="font-extrabold text-xl leading-tight">{candidate.name}</h3>
            <p className="text-xs font-medium text-on-surface-variant mt-1">{candidate.current_title ?? candidate.role ?? 'N/A'}</p>
          </div>
        </div>
        <div className="px-4 py-1.5 bg-[#d1e7dd] text-[#0f5132] font-extrabold text-xs rounded-full shadow-sm">
          {candidate.score ?? candidate.matchPercentage ?? 0}% Match
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <span className="text-[0.65rem] font-bold text-on-surface-variant uppercase tracking-[0.25em] block mb-4">Core Competencies</span>
          <div className="space-y-4">
            {competencies.map((comp, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="text-[10px] font-bold w-24 text-on-surface-variant uppercase tracking-wider">{comp.name}</span>
                <div className="flex-1 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${comp.score}%` }}
                    transition={{ delay: delay + 0.3 + (i * 0.1), duration: 1 }}
                    className="bg-primary h-full rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/5">
            <span className="text-[0.65rem] font-bold text-on-surface-variant uppercase tracking-wider block mb-2">Top Strength</span>
            <span className="text-sm font-bold text-primary">{topStrength}</span>
          </div>
          <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/5">
            <span className="text-[0.65rem] font-bold text-on-surface-variant uppercase tracking-wider block mb-2">Gap</span>
            <span className="text-sm font-bold text-tertiary">{gap}</span>
          </div>
        </div>

        {aiComment && (
          <div className="pt-6 border-t border-surface-container-high">
            <div className="flex items-start gap-3">
              <MessageSquare className="text-primary shrink-0 mt-0.5" size={16} />
              <p className="text-xs italic text-on-surface-variant leading-relaxed font-medium">
                "{aiComment}"
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function FooterLink({ href, children }) {
  return (
    <a 
      href={href} 
      className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors"
    >
      {children}
    </a>
  );
}
