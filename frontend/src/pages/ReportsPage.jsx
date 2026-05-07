import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import './ReportsPage.css'

const API = '${import.meta.env.VITE_API_URL}'

export default function ReportsPage() {
  const navigate  = useNavigate()
  const [reports,  setReports]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState(null)
  const [sending,  setSending]  = useState(null)   // report id currently being sent
  const [sentMsg,  setSentMsg]  = useState({})      // { [id]: message }
  const [lightbox, setLightbox] = useState(null)

  const storedUser = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    if (!storedUser.email) { navigate('/'); return }
    fetchReports()
  }, [])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/patient/reports`, {
        params: { email: storedUser.email }
      })
      setReports(data)
      if (data.length > 0 && !selected) setSelected(data[0])
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }

  const sendToDoctor = async (report) => {
    setSending(report.id)
    try {
      await axios.post(`${API}/doctor/send-report`, {
        report_id:     report.id,
        patient_email: storedUser.email,
      })
      setSentMsg(prev => ({ ...prev, [report.id]: 'Sent to doctor successfully!' }))
      setReports(prev => prev.map(r =>
        r.id === report.id ? { ...r, sent_to_doctor: true } : r
      ))
      if (selected?.id === report.id)
        setSelected(prev => ({ ...prev, sent_to_doctor: true }))
    } catch (err) {
      setSentMsg(prev => ({
        ...prev,
        [report.id]: err.response?.data?.detail || 'Failed to send.'
      }))
    } finally {
      setSending(null)
    }
  }

  const formatDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="rp">

      {/* ambient bg */}
      <div className="rp-bg">
        <div className="rp-orb rp-orb1" />
        <div className="rp-orb rp-orb2" />
      </div>

      {/* nav */}
      <nav className="rp-nav">
        <button className="rp-nav-back" onClick={() => navigate('/analyze')}>← Back</button>
        <div className="rp-nav-logo"><span className="rp-cross">✚</span> PneumaVision</div>
        <div style={{ width: 80 }} />
      </nav>

      <div className="rp-layout">

        {/* ── LEFT: report list ── */}
        <aside className="rp-sidebar">
          <div className="rp-sidebar-header">
            <h2 className="rp-sidebar-title">My Reports</h2>
            <span className="rp-sidebar-count">{reports.length}</span>
          </div>

          {loading ? (
            <div className="rp-loading">Loading reports…</div>
          ) : reports.length === 0 ? (
            <div className="rp-empty-state">
              <div className="rp-empty-icon">📋</div>
              <p>No reports yet. Go to the Analyse page to get started.</p>
              <button className="rp-btn-primary" onClick={() => navigate('/analyze')}>
                Analyse an X-Ray →
              </button>
            </div>
          ) : (
            <div className="rp-list">
              {reports.map(r => (
                <button
                  key={r.id}
                  className={`rp-list-item ${selected?.id === r.id ? 'rp-list-item--active' : ''}`}
                  onClick={() => setSelected(r)}
                >
                  <div className="rp-list-item-top">
                    <span className="rp-list-date">{formatDate(r.created_at)}</span>
                    <div className="rp-list-badges">
                      {r.has_feedback && (
                        <span className="rp-badge rp-badge--feedback">💬 Feedback</span>
                      )}
                      {r.sent_to_doctor && !r.has_feedback && (
                        <span className="rp-badge rp-badge--sent">Sent</span>
                      )}
                    </div>
                  </div>
                  <div className="rp-list-filename">{r.filename || 'X-Ray Report'}</div>
                  <div className="rp-list-findings">
                    {r.report?.findings?.length > 0
                      ? `${r.report.findings.length} finding${r.report.findings.length !== 1 ? 's' : ''} detected`
                      : 'No findings detected'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* ── RIGHT: detail view ── */}
        <main className="rp-detail">
          {!selected ? (
            <div className="rp-placeholder">Select a report to view details.</div>
          ) : (
            <div className="rp-detail-inner">

              {/* detail header */}
              <div className="rp-detail-header">
                <div>
                  <div className="rp-detail-label">Report</div>
                  <h2 className="rp-detail-title">{formatDate(selected.created_at)}</h2>
                </div>
                <div className="rp-detail-actions">
                  {!selected.sent_to_doctor ? (
                    <button
                      className="rp-btn-primary"
                      onClick={() => sendToDoctor(selected)}
                      disabled={sending === selected.id}
                    >
                      {sending === selected.id ? 'Sending…' : '📤 Send to Doctor'}
                    </button>
                  ) : (
                    <span className="rp-sent-label">
                      {selected.has_feedback ? '✓ Doctor reviewed' : '⏳ Awaiting doctor feedback'}
                    </span>
                  )}
                  {sentMsg[selected.id] && (
                    <span className={`rp-msg ${sentMsg[selected.id].includes('Failed') ? 'rp-msg--err' : 'rp-msg--ok'}`}>
                      {sentMsg[selected.id]}
                    </span>
                  )}
                </div>
              </div>

              {/* ── Doctor Feedback banner — shown prominently if exists ── */}
              {selected.has_feedback && selected.feedback && (
                <div className="rp-feedback-banner">
                  <div className="rp-feedback-banner-header">
                    <span className="rp-feedback-icon">💬</span>
                    <span className="rp-feedback-title">Doctor's Feedback</span>
                    {selected.feedback_at && (
                      <span className="rp-feedback-date">{formatDate(selected.feedback_at)}</span>
                    )}
                  </div>
                  <p className="rp-feedback-text">{selected.feedback}</p>
                </div>
              )}

              {/* images */}
              <div className="rp-images-row">
                {selected.xray_image && (
                  <div className="rp-img-card" onClick={() => setLightbox(`data:image/png;base64,${selected.xray_image}`)}>
                    <div className="rp-img-label">Original X-Ray</div>
                    <img src={`data:image/png;base64,${selected.xray_image}`} alt="X-Ray" className="rp-img" />
                  </div>
                )}
                {selected.gradcam_image && (
                  <div className="rp-img-card" onClick={() => setLightbox(`data:image/png;base64,${selected.gradcam_image}`)}>
                    <div className="rp-img-label">Grad-CAM</div>
                    <img src={`data:image/png;base64,${selected.gradcam_image}`} alt="Grad-CAM" className="rp-img" />
                  </div>
                )}
              </div>

              {/* findings */}
              {selected.report?.findings?.length > 0 && (
                <div className="rp-section">
                  <h3 className="rp-section-title">Findings</h3>
                  <div className="rp-findings-grid">
                    {selected.report.findings.map((f, i) => {
                      const colors = { high: '#fc8181', moderate: '#f6ad55', low: '#68d391' }
                      const c = colors[f.clinical_priority] || '#68d391'
                      return (
                        <div className="rp-finding" key={i} style={{ borderLeftColor: c }}>
                          <div className="rp-finding-name">{f.condition}</div>
                          <div className="rp-finding-row">
                            <div className="rp-bar-wrap">
                              <div className="rp-bar" style={{ width: `${(f.confidence*100).toFixed(1)}%`, background: c }} />
                            </div>
                            <span className="rp-bar-val">{(f.confidence*100).toFixed(1)}%</span>
                          </div>
                          <div className="rp-finding-loc">{f.anatomical_location}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* impression */}
              {selected.report?.impression && (
                <div className="rp-section">
                  <h3 className="rp-section-title">AI Impression</h3>
                  <blockquote className="rp-impression">{selected.report.impression}</blockquote>
                </div>
              )}

              {/* disclaimer */}
              {selected.report?.disclaimer && (
                <div className="rp-disclaimer">⚠ {selected.report.disclaimer}</div>
              )}

            </div>
          )}
        </main>
      </div>

      {/* lightbox */}
      {lightbox && (
        <div className="rp-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Fullscreen" className="rp-lightbox-img" />
          <button className="rp-lightbox-close">✕</button>
        </div>
      )}
    </div>
  )
}