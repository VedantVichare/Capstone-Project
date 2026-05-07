import { useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import './LandingPage.css'
import previewImg from '../assets/dashboard-preview.png'

const CONDITIONS = [
  'Atelectasis', 'Cardiomegaly', 'Effusion', 'Infiltration', 'Mass', 'Nodule',
  'Pneumonia', 'Pneumothorax', 'Consolidation', 'Edema', 'Emphysema',
  'Fibrosis', 'Pleural Thickening', 'Hernia',
]

const STEPS = [
  { num: '01', title: 'Upload Your X-Ray',       body: 'Drop a JPEG or PNG chest X-ray — no special equipment or technical knowledge needed.' },
  { num: '02', title: 'DenseNet121 Inference',    body: 'A model trained on 100,000+ NIH chest X-rays scans for 14 clinically significant conditions simultaneously.' },
  { num: '03', title: 'Grad-CAM Localisation',    body: 'Heatmaps highlight exactly which regions drove each prediction — full transparency into the AI decision.' },
  { num: '04', title: 'LLM Report Generated',     body: 'A large language model synthesises the findings into a structured, plain-English radiology report.' },
]

const AUDIENCE = [
  { icon: '🏥', who: 'Radiologists', desc: 'Reduce report turnaround time. Use AI-generated structured reports as a first-pass draft and focus your expertise where it matters most.' },
  { icon: '🧑‍⚕️', who: 'Clinicians',   desc: 'Get instant structured findings from chest X-rays with spatial localisation — clear enough to act on, detailed enough to trust.' },
  { icon: '👤', who: 'Patients',     desc: 'Understand your own X-ray results without waiting days. Plain-English explanations of every finding detected.' },
]

export default function LandingPage({ onLogout }) {
  const navigate = useNavigate()
  const orbRef   = useRef(null)

  useEffect(() => {
    const handle = (e) => {
      if (!orbRef.current) return
      const x = (e.clientX / window.innerWidth  - 0.5) * 28
      const y = (e.clientY / window.innerHeight - 0.5) * 28
      orbRef.current.style.transform = `translate(${x}px, ${y}px)`
    }
    window.addEventListener('mousemove', handle)
    return () => window.removeEventListener('mousemove', handle)
  }, [])

  return (
    <div className="lp">

      {/* ── ambient background (fixed, shared across both folds) ── */}
      <div className="lp-bg">
        <div className="lp-orb lp-orb1" ref={orbRef} />
        <div className="lp-orb lp-orb2" />
        <div className="lp-grid" />
      </div>

      {/* ── sticky nav ── */}
<nav className="lp-nav">
  <div className="lp-nav-logo">
    <span className="lp-cross">✚</span> PneumaVision
  </div>
  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
    <button className="lp-nav-btn" onClick={() => navigate('/analyze')}>
      Analyze Your X-Ray
    </button>
    <button
      className="lp-nav-btn"
      onClick={onLogout}
      style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#a0aec0' }}
    >
      Log Out
    </button>
  </div>
</nav>
      {/* ════════════════════════════════════════
          FOLD 1 — Hero + Conditions
      ════════════════════════════════════════ */}
      <section className="lp-fold lp-fold1">
        <div className="lp-fold1-inner">

          {/* ── LEFT col: hero text + conditions ── */}
          <div className="lp-hero-col">
            <div className="lp-hero">
              <h1 className="lp-title">
                Chest X-Ray Analysis in Seconds!<br />
              </h1>
              <p className="lp-sub">
                Our methodology uses a DenseNet121 deep learning model and Grad-CAM
                visualisation to detect 14 chest conditions — then generates a
                structured radiology report you can actually understand with the help of an LLM.
              </p>
              <div className="lp-actions">
                <button className="lp-btn-primary" onClick={() => navigate('/analyze')}>
                  Analyse Your X-Ray
                </button>
                <a className="lp-btn-ghost" href="#fold2">See How It Works ↓</a>
              </div>
            </div>

            {/* conditions */}
            <div className="lp-conditions-block">
              <div className="lp-block-label">14 Conditions Detected</div>
              <div className="lp-chips">
                {CONDITIONS.map(c => (
                  <span className="lp-chip" key={c}>{c}</span>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT col: dashboard preview ── */}
          <div className="lp-preview-col">
            <div className="lp-preview-frame">
              <img
                src={previewImg}
                alt="PneumaVision dashboard showing Grad-CAM heatmaps and radiology report"
                className="lp-preview-img"
              />
              <div className="lp-preview-shine" />
            </div>
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════
          FOLD 2 — Pipeline + Audience
      ════════════════════════════════════════ */}
      <section className="lp-fold lp-fold2" id="fold2">
        <div className="lp-fold2-inner">

          {/* pipeline steps */}
          <div className="lp-fold2-col">
            <div className="lp-section-label">How It Works</div>
            <h2 className="lp-section-title">Four steps from image to insight</h2>
            <div className="lp-steps">
              {STEPS.map(s => (
                <div className="lp-step" key={s.num}>
                  <span className="lp-step-num">{s.num}</span>
                  <div>
                    <div className="lp-step-title">{s.title}</div>
                    <div className="lp-step-body">{s.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* audience */}
          <div className="lp-fold2-col">
            <div className="lp-section-label">Who It Helps</div>
            <h2 className="lp-section-title">Built for everyone</h2>
            <div className="lp-audience">
              {AUDIENCE.map(a => (
                <div className="lp-audience-card" key={a.who}>
                  <div className="lp-audience-icon">{a.icon}</div>
                  <div>
                    <div className="lp-audience-who">{a.who}</div>
                    <div className="lp-audience-desc">{a.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA at bottom of fold 2 */}
            <button className="lp-btn-primary lp-cta-btn" onClick={() => navigate('/analyze')}>
              Get Started Now →
            </button>
          </div>

        </div>

        {/* footer inside fold 2 */}
        <footer className="lp-footer">
          <span className="lp-cross">✚</span> PneumaVision &nbsp;·&nbsp;
          <span>For research and educational purposes only. Not a substitute for professional medical advice.</span>
        </footer>
      </section>

    </div>
  )
}