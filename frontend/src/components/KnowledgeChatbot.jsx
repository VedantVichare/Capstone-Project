import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import './KnowledgeChatbot.css'

const API_URL = '${import.meta.env.VITE_API_URL}/knowledge-chat'

const SUGGESTIONS = [
  'What is Cardiomegaly?',
  'How is Pneumonia detected on X-ray?',
  'How can I prevent Emphysema?',
  'What are symptoms of Pleural Effusion?',
  'When should I see a doctor for Fibrosis?',
]

export default function KnowledgeChatbot() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hi! I'm your chest health assistant. Ask me anything about the 14 conditions PneumaVision can detect — symptoms, causes, prevention, and more.",
    },
  ])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const buildHistory = (msgs) =>
    msgs
      .slice(1)
      .map(m => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: [m.text],
      }))

  const sendMessage = async (text) => {
    const question = text.trim()
    if (!question || loading) return

    const userMsg     = { role: 'user', text: question }
    const updatedMsgs = [...messages, userMsg]
    setMessages(updatedMsgs)
    setInput('')
    setLoading(true)

    try {
      const { data } = await axios.post(API_URL, {
        question,
        history: buildHistory(updatedMsgs),
      })
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer }])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: '⚠️ Could not reach the server. Please make sure the backend is running.',
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

  const handleClear = () => {
    setMessages([{
      role: 'assistant',
      text: "Hi! I'm your chest health assistant. Ask me anything about the 14 conditions PneumaVision can detect — symptoms, causes, prevention, and more.",
    }])
    setInput('')
  }

  return (
    <aside className="kcb">

      {/* ── Header ── */}
      <div className="kcb-header">
        <div className="kcb-header-left">
          <div className="kcb-avatar">✚</div>
          <div>
            <div className="kcb-title">Health Assistant</div>
            <div className="kcb-subtitle">Knowledge Base · 14 Conditions</div>
          </div>
        </div>
        <button className="kcb-clear" onClick={handleClear} title="Clear chat">
          ↺
        </button>
      </div>

      {/* ── Messages ── */}
      <div className="kcb-messages">
        {messages.map((m, i) => (
          <div key={i} className={`kcb-msg kcb-msg--${m.role}`}>
            {m.role === 'assistant' && (
              <div className="kcb-msg-avatar">✚</div>
            )}
            <div className="kcb-msg-bubble">{m.text}</div>
          </div>
        ))}

        {loading && (
          <div className="kcb-msg kcb-msg--assistant">
            <div className="kcb-msg-avatar">✚</div>
            <div className="kcb-msg-bubble kcb-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Suggestions ── */}
      {messages.length === 1 && (
        <div className="kcb-suggestions">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              className="kcb-suggestion"
              onClick={() => sendMessage(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      <div className="kcb-input-row">
        <textarea
          ref={inputRef}
          className="kcb-input"
          placeholder="Ask about any chest condition…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading}
        />
        <button
          className="kcb-send"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
        >
          ↑
        </button>
      </div>

    </aside>
  )
}