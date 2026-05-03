import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import './AnalyzePage.css'

const API_URL = 'http://localhost:8000/analyze'

const PRIORITY_META = {
  high:     { label: 'High Priority',     color: 'var(--high)',     dot: '#fc8181' },
  moderate: { label: 'Moderate Priority', color: 'var(--moderate)', dot: '#f6ad55' },
  low:      { label: 'Low Priority',      color: 'var(--low)',      dot: '#68d391' },
}

export default function AnalyzePage() {
  const navigate = useNavigate()
  const inputRef  = useRef(null)
  const resultsRef = useRef(null)

  const [file,     setFile]     = useState(null)
  const [preview,  setPreview]  = useState(null)
  const [dragging, setDragging] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [progress, setProgress] = useState('')
  const [error,    setError]    = useState(null)
  const [result,   setResult]   = useState(null)  // { gradcam_image, report, predictions }

  /* ── file selection ── */
  const handleFile = (f) => {
    if (!f) return
    const ok = ['image/jpeg', 'image/jpg', 'image/png'].includes(f.type)
    if (!ok) { setError('Please upload a JPEG or PNG image.'); return }
    setError(null)
    setResult(null)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const onInputChange  = (e) => handleFile(e.target.files[0])
  const onDrop         = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }, [])
  const onDragOver     = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave    = () => setDragging(false)

  /* ── submit ── */
  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    const steps = [
      'Uploading image…',
      'Running DenseNet121 inference…',
      'Computing Grad-CAM heatmaps…',
      'Generating radiology report…',
    ]
    let si = 0
    setProgress(steps[si])
    const interval = setInterval(() => {
      si = Math.min(si + 1, steps.length - 1)
      setProgress(steps[si])
    }, 4000)

    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await axios.post(API_URL, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
      clearInterval(interval)
      setLoading(false)
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (err) {
      clearInterval(interval)
      setLoading(false)
      setError(
        err.response?.data?.detail ||
        'Something went wrong. Make sure the backend is running on port 8000.'
      )
    }
  }

  const reset = () => {
    setFile(null); setPreview(null); setResult(null); setError(null)
  }

  /* ── render ── */
  return (
    <div className="ap">

      {/* ambient bg */}
      <div className="ap-bg">
        <div className="ap-orb ap-orb1" />
        <div className="ap-orb ap-orb2" />
        <div className="ap-grid" />
      </div>

      {/* nav */}
      <nav className="ap-nav">
        <button className="ap-nav-back" onClick={() => navigate('/')}>
          ← Back
        </button>
        <div className="ap-nav-logo">
          <span className="ap-cross">✚</span> PneumaVision
        </div>
        <div style={{ width: 80 }} />
      </nav>

      <div className="ap-body container">

        {/* page header */}
        <div className="ap-header">
          <div className="ap-section-label">Chest X-Ray Analyzer</div>
          <h1 className="ap-title">Upload &amp; Analyse</h1>
          <p className="ap-subtitle">
            Upload a chest X-ray image to receive AI-generated findings and a structured radiology report.
          </p>
        </div>

        {/* upload zone */}
        {!result && (
          <div
            className={`ap-dropzone ${dragging ? 'ap-dropzone--drag' : ''} ${preview ? 'ap-dropzone--has-preview' : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => !preview && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={onInputChange}
            />

            {preview ? (
              <div className="ap-preview-wrap">
                <img src={preview} alt="X-Ray preview" className="ap-preview-img" />
                <div className="ap-preview-info">
                  <span className="ap-preview-name">{file?.name}</span>
                  <span className="ap-preview-size">
                    {(file?.size / 1024).toFixed(0)} KB
                  </span>
                  <button className="ap-preview-change" onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}>
                    Change image
                  </button>
                </div>
              </div>
            ) : (
              <div className="ap-dropzone-inner">
                <div className="ap-dropzone-icon">
                  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="36" height="36" rx="6" stroke="currentColor" strokeWidth="2"/>
                    <path d="M16 30 L22 22 L27 28 L31 24 L36 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="18" cy="18" r="2.5" fill="currentColor"/>
                    <path d="M24 12 L24 8 M24 8 L21 11 M24 8 L27 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="ap-dropzone-title">Drop your X-ray here</p>
                <p className="ap-dropzone-sub">or <span>click to browse</span> — JPEG, PNG up to 20 MB</p>
              </div>
            )}
          </div>
        )}

        {error && <div className="ap-error">{error}</div>}

        {/* analyze button */}
        {file && !result && (
          <div className="ap-actions">
            <button className="ap-btn-analyze" onClick={handleAnalyze} disabled={loading}>
              {loading ? (
                <span className="ap-loading-row">
                  <span className="ap-spinner" />
                  {progress}
                </span>
              ) : 'Analyse X-Ray →'}
            </button>
            {!loading && (
              <button className="ap-btn-reset" onClick={reset}>Clear</button>
            )}
          </div>
        )}

        {/* ── results ── */}
        {result && (
          <div className="ap-results" ref={resultsRef}>

            {/* top bar */}
            <div className="ap-results-header">
              <div>
                <div className="ap-section-label">Analysis Complete</div>
                <h2 className="ap-results-title">
                  {result.num_findings} Finding{result.num_findings !== 1 ? 's' : ''} Detected
                </h2>
              </div>
              <button className="ap-btn-reset" onClick={reset}>New Analysis</button>
            </div>

            {/* two-column: original + gradcam */}
            <div className="ap-images-row">
              <div className="ap-img-card">
                <div className="ap-img-label">Original X-Ray</div>
                <img src={preview} alt="Original X-Ray" className="ap-result-img" />
              </div>
              <div className="ap-img-card">
                <div className="ap-img-label">Grad-CAM Visualisation</div>
                <img
                  src={`data:image/png;base64,${result.gradcam_image}`}
                  alt="Grad-CAM"
                  className="ap-result-img"
                />
              </div>
            </div>

            {/* findings table */}
            <div className="ap-section-block">
              <h3 className="ap-block-title">Findings</h3>
              {result.report.findings?.length > 0 ? (
                <div className="ap-findings">
                  {result.report.findings.map((f, i) => {
                    const pm = PRIORITY_META[f.clinical_priority] || PRIORITY_META.low
                    return (
                      <div className="ap-finding-card" key={i}>
                        <div className="ap-finding-top">
                          <span className="ap-finding-name">{f.condition}</span>
                          <span className="ap-finding-priority" style={{ color: pm.color, borderColor: pm.color }}>
                            <span className="ap-finding-dot" style={{ background: pm.dot }} />
                            {pm.label}
                          </span>
                        </div>
                        <div className="ap-finding-meta">
                          <div className="ap-finding-meta-item">
                            <span className="ap-meta-label">Confidence</span>
                            <div className="ap-conf-bar-wrap">
                              <div
                                className="ap-conf-bar"
                                style={{ width: `${(f.confidence * 100).toFixed(1)}%`, background: pm.dot }}
                              />
                            </div>
                            <span className="ap-meta-val">{(f.confidence * 100).toFixed(1)}%</span>
                          </div>
                          <div className="ap-finding-meta-item">
                            <span className="ap-meta-label">Location</span>
                            <span className="ap-meta-val ap-meta-location">{f.anatomical_location}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="ap-no-findings">No findings above threshold detected.</p>
              )}
            </div>

            {/* not detected */}
            {result.report.not_detected?.length > 0 && (
              <div className="ap-section-block">
                <h3 className="ap-block-title">Not Detected</h3>
                <div className="ap-not-detected-grid">
                  {result.report.not_detected.map((nd, i) => (
                    <div className="ap-nd-chip" key={i}>
                      <span className="ap-nd-name">{nd.condition}</span>
                      <span className="ap-nd-score">{(nd.raw_score * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* impression */}
            {result.report.impression && (
              <div className="ap-section-block ap-impression-block">
                <h3 className="ap-block-title">Radiologist Impression</h3>
                <blockquote className="ap-impression">
                  {result.report.impression}
                </blockquote>
              </div>
            )}

            {/* disclaimer */}
            {result.report.disclaimer && (
              <div className="ap-disclaimer">
                <span className="ap-disclaimer-icon">⚠</span>
                {result.report.disclaimer}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}