import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import './DoctorPortal.css'

const API = '${import.meta.env.VITE_API_URL}'

const PRIORITY_META = {
  high:     { label: 'High',     color: '#fc8181' },
  moderate: { label: 'Moderate', color: '#f6ad55' },
  low:      { label: 'Low',      color: '#68d391' },
}

export default function DoctorPortal() {
  const navigate = useNavigate()

  // Doctor is set by AuthPage on successful doctor login — redirect if missing
  const [doctor]   = useState(() => JSON.parse(localStorage.getItem('doctor') || 'null'))
  const [reports,  setReports]  = useState([])
  const [selected, setSelected] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    if (!doctor) { navigate('/auth'); return }
    fetchReports()
  }, [])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/doctor/reports`)
      setReports(data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  const openReport = (r) => {
    setSelected(r)
    setFeedback(r.feedback || '')
    setSavedMsg('')
  }

  const submitFeedback = async () => {
    if (!feedback.trim()) return
    setSaving(true)
    setSavedMsg('')
    try {
      await axios.post(`${API}/doctor/feedback`, {
        report_id:    selected.id,
        doctor_email: doctor.email,
        feedback:     feedback.trim(),
      })
      setSavedMsg('Feedback saved successfully.')
      setReports(prev => prev.map(r =>
        r.id === selected.id ? { ...r, has_feedback: true, feedback: feedback.trim() } : r
      ))
      setSelected(prev => ({ ...prev, has_feedback: true, feedback: feedback.trim() }))
    } catch {
      setSavedMsg('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = () => {
    localStorage.removeItem('doctor')
    navigate('/login')
  }

  if (!doctor) return null

  return (
    <div className="dp-portal">

      {/* ── Sidebar ── */}
      <aside className="dp-sidebar">
        <div className="dp-sidebar-logo"><span className="dp-cross">✚</span> PneumaVision</div>
        <div className="dp-sidebar-role">Doctor Portal</div>

        <div className="dp-sidebar-doctor">
          <div className="dp-doctor-avatar">{doctor?.name?.[0] ?? 'D'}</div>
          <div>
            <div className="dp-doctor-name">{doctor?.name}</div>
            <div className="dp-doctor-email">{doctor?.email}</div>
          </div>
        </div>

        <div className="dp-sidebar-label">Patient Reports</div>
        {loading && <div className="dp-sidebar-loading">Loading…</div>}

        <div className="dp-report-list">
          {reports.map(r => (
            <button
              key={r.id}
              className={`dp-report-item ${selected?.id === r.id ? 'dp-report-item--active' : ''}`}
              onClick={() => openReport(r)}
            >
              <div className="dp-report-item-top">
                <span className="dp-report-patient">{r.name}</span>
                {r.has_feedback
                  ? <span className="dp-badge dp-badge--done">✓ Reviewed</span>
                  : <span className="dp-badge dp-badge--pending">Pending</span>
                }
              </div>
              <div className="dp-report-item-meta">
                {r.age   && <span>{r.age} yrs</span>}
                {r.sex   && <span> · {r.sex}</span>}
                {r.sent_at && <span> · {new Date(r.sent_at).toLocaleDateString()}</span>}
              </div>
            </button>
          ))}
          {!loading && reports.length === 0 && (
            <div className="dp-empty">No reports sent yet.</div>
          )}
        </div>

        <button className="dp-btn-logout" onClick={handleSignOut}>Sign Out</button>
      </aside>

      {/* ── Main ── */}
      <main className="dp-main">
        {!selected ? (
          <div className="dp-placeholder">
            <div className="dp-placeholder-icon">🩺</div>
            <p>Select a patient report from the sidebar to review it.</p>
          </div>
        ) : (
          <div className="dp-report-view">

            <div className="dp-report-header">
              <div>
                <h2 className="dp-report-name">{selected.name}</h2>
                <span className="dp-report-meta-row">
                  {selected.age && <span>{selected.age} yrs</span>}
                  {selected.sex && <span> · {selected.sex}</span>}
                  {selected.created_at && (
                    <span> · {new Date(selected.created_at).toLocaleDateString()}</span>
                  )}
                </span>
              </div>
            </div>

            <div className="dp-report-body">

              <div className="dp-images-col">
                {selected.xray_image && (
                  <div className="dp-img-card">
                    <div className="dp-img-label">Original X-Ray</div>
                    <img
                      src={`data:image/png;base64,${selected.xray_image}`}
                      alt="X-Ray" className="dp-img"
                      onClick={() => setLightbox(`data:image/png;base64,${selected.xray_image}`)}
                      style={{ cursor: 'zoom-in' }}
                    />
                  </div>
                )}
                {selected.gradcam_image && (
                  <div className="dp-img-card">
                    <div className="dp-img-label">Grad-CAM Visualisation</div>
                    <img
                      src={`data:image/png;base64,${selected.gradcam_image}`}
                      alt="Grad-CAM" className="dp-img"
                      onClick={() => setLightbox(`data:image/png;base64,${selected.gradcam_image}`)}
                      style={{ cursor: 'zoom-in' }}
                    />
                  </div>
                )}
              </div>

              <div className="dp-detail-col">

                <div className="dp-section">
                  <h3 className="dp-section-title">Findings</h3>
                  {selected.report?.findings?.length > 0 ? (
                    <div className="dp-findings">
                      {selected.report.findings.map((f, i) => {
                        const pm = PRIORITY_META[f.clinical_priority] || PRIORITY_META.low
                        return (
                          <div className="dp-finding" key={i}>
                            <div className="dp-finding-top">
                              <span className="dp-finding-name">{f.condition}</span>
                              <span className="dp-finding-priority" style={{ color: pm.color }}>
                                <span className="dp-finding-dot" style={{ background: pm.color }} />
                                {pm.label}
                              </span>
                            </div>
                            <div className="dp-finding-bar-row">
                              <div className="dp-bar-wrap">
                                <div className="dp-bar" style={{ width: `${(f.confidence*100).toFixed(1)}%`, background: pm.color }} />
                              </div>
                              <span className="dp-bar-val">{(f.confidence*100).toFixed(1)}%</span>
                            </div>
                            <div className="dp-finding-loc">{f.anatomical_location}</div>
                          </div>
                        )
                      })}
                    </div>
                  ) : <p className="dp-empty">No findings above threshold.</p>}
                </div>

                {selected.report?.impression && (
                  <div className="dp-section">
                    <h3 className="dp-section-title">AI Impression</h3>
                    <blockquote className="dp-impression">{selected.report.impression}</blockquote>
                  </div>
                )}

                <div className="dp-section dp-feedback-section">
                  <h3 className="dp-section-title">Your Feedback</h3>
                  <textarea
                    className="dp-feedback-input"
                    rows={5}
                    placeholder="Write your clinical feedback for the patient here…"
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                  />
                  <div className="dp-feedback-actions">
                    {savedMsg && (
                      <span className={`dp-saved-msg ${savedMsg.includes('Failed') ? 'dp-saved-msg--err' : ''}`}>
                        {savedMsg}
                      </span>
                    )}
                    <button
                      className="dp-btn-primary dp-btn-submit"
                      onClick={submitFeedback}
                      disabled={saving || !feedback.trim()}
                    >
                      {saving ? 'Saving…' : selected.has_feedback ? 'Update Feedback' : 'Submit Feedback'}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </main>

      {lightbox && (
        <div className="dp-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Fullscreen" className="dp-lightbox-img" />
          <button className="dp-lightbox-close">✕</button>
        </div>
      )}
    </div>
  )
}