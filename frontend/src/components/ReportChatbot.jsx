import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import './ReportChatbot.css'

const API_URL = 'http://localhost:8000/report-chat'

const SUGGESTIONS = [
  'What conditions were detected?',
  'Where exactly is the Effusion located?',
  'Which finding has the highest confidence?',
  'What does the impression mean?',
]

export default function ReportChatbot({ report }) {
  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hi! I've read your radiology report and I'm here to help you understand it. What would you like to know?",
    },
  ])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Build Gemini-format history from messages (exclude the greeting)
  const buildHistory = (msgs) =>
    msgs
      .slice(1)                        // skip the initial greeting
      .map(m => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: [m.text],
      }))

  const sendMessage = async (text) => {
    const question = text.trim()
    if (!question || loading) return

    const userMsg = { role: 'user', text: question }
    const updatedMsgs = [...messages, userMsg]
    setMessages(updatedMsgs)
    setInput('')
    setLoading(true)

    try {
      const { data } = await axios.post(API_URL, {
        question,
        report,
        history: buildHistory(updatedMsgs),
      })
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer }])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: '⚠️ Sorry, I couldn\'t reach the server. Please make sure the backend is running.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="rcb-wrapper">

      {/* ── Chat panel ── */}
      {open && (
        <div className="rcb-panel">

          {/* header */}
          <div className="rcb-header">
            <div className="rcb-header-left">
              <div className="rcb-avatar">✚</div>
              <div>
                <div className="rcb-header-title">Report Assistant</div>
                <div className="rcb-header-sub">Answers based on your report only</div>
              </div>
            </div>
            <button className="rcb-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* messages */}
          <div className="rcb-messages">
            {messages.map((m, i) => (
              <div key={i} className={`rcb-msg rcb-msg--${m.role}`}>
                {m.role === 'assistant' && (
                  <div className="rcb-msg-avatar">✚</div>
                )}
                <div className="rcb-msg-bubble">{m.text}</div>
              </div>
            ))}

            {/* loading indicator */}
            {loading && (
              <div className="rcb-msg rcb-msg--assistant">
                <div className="rcb-msg-avatar">✚</div>
                <div className="rcb-msg-bubble rcb-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* suggestions — only show when just the greeting is visible */}
          {messages.length === 1 && (
            <div className="rcb-suggestions">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  className="rcb-suggestion"
                  onClick={() => sendMessage(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* input */}
          <div className="rcb-input-row">
            <textarea
              ref={inputRef}
              className="rcb-input"
              placeholder="Ask about your report…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
            />
            <button
              className="rcb-send"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
            >
              ↑
            </button>
          </div>

        </div>
      )}

      {/* ── Toggle button ── */}
      <button
        className={`rcb-toggle ${open ? 'rcb-toggle--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Ask about your report"
      >
        {open ? '✕' : (
          <>
            <span className="rcb-toggle-icon">💬</span>
            <span className="rcb-toggle-label">Ask about report</span>
          </>
        )}
      </button>

    </div>
  )
}