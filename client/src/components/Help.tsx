import { useState } from 'react'
import { TABS_INFO, SCORES_INFO, OUTCOMES_INFO, DAILY_RHYTHM, FAQS, TIPS } from '../data/help'
import { alpha } from '../lib/color'

export default function Help() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="help-page">

      {/* ── Hero ── */}
      <div className="help-hero">
        <span className="help-hero-emoji">📖</span>
        <div className="help-hero-title">DECODE Manual</div>
        <div className="help-hero-sub">Direction · Execute · Close · Observe · Develop · Evolve</div>
      </div>

      {/* ── The DECODE framework ── */}
      <div className="help-section-block">
        <div className="help-section-eyebrow">The framework</div>
        <div className="help-big-text">
          DECODE is an acronym. Each letter is a step in your daily and weekly cycle.
        </div>
        <div className="help-decode-steps">
          <div className="help-decode-step"><span className="help-decode-letter" style={{ color: 'var(--work)' }}>D</span><div><strong>Direction</strong> — Pick one task each for Work, Future, Body. Know what matters today.</div></div>
          <div className="help-decode-step"><span className="help-decode-letter" style={{ color: 'var(--future)' }}>E</span><div><strong>Execute</strong> — Go do the work. The app stays out of your way until evening.</div></div>
          <div className="help-decode-step"><span className="help-decode-letter" style={{ color: 'var(--body)' }}>C</span><div><strong>Close</strong> — Rate the day: WIN, PARTIAL, or MISS. Score focus and mood. Be honest.</div></div>
          <div className="help-decode-step"><span className="help-decode-letter" style={{ color: 'var(--accent)' }}>O</span><div><strong>Observe</strong> — Your dashboard and trends reveal patterns you can't see day-to-day.</div></div>
          <div className="help-decode-step"><span className="help-decode-letter" style={{ color: 'var(--partial)' }}>D</span><div><strong>Develop</strong> — Use weekly anchors and AI coaching to build on what works.</div></div>
          <div className="help-decode-step"><span className="help-decode-letter" style={{ color: 'var(--win)' }}>E</span><div><strong>Evolve</strong> — Week over week, small corrections compound into real change.</div></div>
        </div>
      </div>

      {/* ── The core idea ── */}
      <div className="help-section-block">
        <div className="help-section-eyebrow">The core idea</div>
        <div className="help-big-text">
          Most people lose direction not because they don't care — but because <em>everything feels equally urgent</em>.
        </div>
        <div className="help-body-text">
          DECODE forces you to pick <strong>one thing per category</strong> each day and track it simply.
          Morning check-in, evening close. Under 10 minutes a day. All data stored in BigQuery — yours forever.
        </div>
        <div className="help-time-pills">
          <div className="help-time-pill" style={{ borderColor: 'var(--work)',   color: 'var(--work)'   }}>☀️ Morning — 3 min</div>
          <div className="help-time-pill" style={{ borderColor: 'var(--body)',   color: 'var(--body)'   }}>🌙 Evening — 5 min</div>
          <div className="help-time-pill" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>📅 Sunday — 5 min</div>
          <div className="help-time-pill" style={{ borderColor: 'var(--win)',    color: 'var(--win)'    }}>🥗 Each meal — 10 sec</div>
        </div>
      </div>

      {/* ── All tabs ── */}
      <div className="help-section-block">
        <div className="help-section-eyebrow">The tabs</div>
        <div className="help-section-title">What each tab does</div>

        {TABS_INFO.map(t => (
          <div className="help-tab-row" key={t.name}>
            <div className="help-tab-row-icon" style={{ background: alpha(t.color, 10), border: `1px solid ${alpha(t.color, 20)}` }}>
              <span>{t.icon}</span>
            </div>
            <div className="help-tab-row-body">
              <div className="help-tab-row-header">
                <span className="help-tab-row-name" style={{ color: t.color }}>{t.name}</span>
                <span className="help-tab-row-when">{t.when}</span>
              </div>
              <div className="help-tab-row-what">{t.what}</div>
              <div className="help-tab-row-how">
                <span className="help-how-label">How: </span>{t.how}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Scores & outcomes ── */}
      <div className="help-section-block">
        <div className="help-section-eyebrow">Metrics</div>
        <div className="help-section-title">What the numbers mean</div>

        <div className="help-scores-grid">
          {SCORES_INFO.map(s => (
            <div className="help-score-card" key={s.label} style={{ borderColor: alpha(s.color, 20) }}>
              <div className="help-score-card-top" style={{ background: alpha(s.color, 6) }}>
                <span className="help-score-icon">{s.icon}</span>
                <div>
                  <div className="help-score-label" style={{ color: s.color }}>{s.label}</div>
                  <div className="help-score-when">Logged at {s.when.toLowerCase()}</div>
                </div>
              </div>
              <div className="help-score-desc">{s.desc}</div>
              <div className="help-score-bar-wrap">
                <div className="help-score-bar-track">
                  <div className="help-score-bar-fill" style={{ background: `linear-gradient(to right, var(--miss), ${s.color})` }} />
                </div>
                <div className="help-score-bar-labels">
                  <span>1</span><span>5</span><span>10</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="help-outcomes">
          {OUTCOMES_INFO.map(o => (
            <div className="help-outcome-row" key={o.label} style={{ borderLeftColor: o.color }}>
              <span className="help-outcome-emoji">{o.emoji}</span>
              <div>
                <div className="help-outcome-label" style={{ color: o.color }}>{o.label}</div>
                <div className="help-outcome-desc">{o.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── AI features ── */}
      <div className="help-section-block">
        <div className="help-section-eyebrow">AI features</div>
        <div className="help-section-title">How Claude is used</div>

        {[
          {
            icon: '🤖', color: '#ce93d8', title: 'AI Coach (Coach tab)',
            points: [
              'Reads your last 30 days of BigQuery data',
              'Identifies patterns — e.g. "Your WIN days happen when energy is 7+ AND body habit is done"',
              'Gives a performance score (1–10) and one specific action for this week',
              'Needs 3–4 days of data minimum — best after 2+ weeks',
              'Each report is cached for 6 hours to save API quota',
            ],
          },
          {
            icon: '🥗', color: 'var(--win)', title: 'Nutrition AI (Food tab)',
            points: [
              'Photo scan: take or upload a photo → Claude identifies food and estimates nutrition',
              'Text estimate: type a dish name → Claude estimates a typical serving',
              'Returns calories, protein, carbs, fat, fiber, sugar, sodium',
              'Always review and edit before saving — AI estimates can be off by 10–20%',
              'Manual entry is also available if you prefer to fill in yourself',
            ],
          },
        ].map(f => (
          <div className="help-ai-card" key={f.title} style={{ borderColor: alpha(f.color, 20) }}>
            <div className="help-ai-header" style={{ background: alpha(f.color, 6) }}>
              <span className="help-ai-icon">{f.icon}</span>
              <div className="help-ai-title" style={{ color: f.color }}>{f.title}</div>
            </div>
            <ul className="help-ai-points">
              {f.points.map((p, i) => (
                <li key={i} className="help-ai-point">
                  <span className="help-ai-dot" style={{ background: f.color }} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ── Daily rhythm ── */}
      <div className="help-section-block">
        <div className="help-section-eyebrow">Habit</div>
        <div className="help-section-title">Your daily rhythm</div>

        <div className="help-rhythm-visual">
          {DAILY_RHYTHM.map((r, i) => (
            <div className="help-rhythm-row" key={i}>
              <div className="help-rhythm-left">
                <div className="help-rhythm-dot" style={{ background: r.color, boxShadow: `0 0 8px ${alpha(r.color, 30)}` }} />
                {i < DAILY_RHYTHM.length - 1 && <div className="help-rhythm-line" />}
              </div>
              <div className="help-rhythm-content">
                <div className="help-rhythm-time">{r.time}</div>
                <div className="help-rhythm-action">
                  <span className="help-rhythm-icon">{r.icon}</span>
                  <span className="help-rhythm-text" style={{ color: r.color === 'var(--muted2)' ? 'var(--muted2)' : 'var(--text)' }}>{r.action}</span>
                  <span className="help-rhythm-tab">{r.detail}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="help-tip-callout">
          <span className="help-tip-callout-icon">💡</span>
          <div>
            <strong>Make it automatic:</strong> Set a phone reminder at 8am and 9pm.
            Two taps a day is the entire system. Enable push notifications to get these automatically.
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="help-section-block">
        <div className="help-section-eyebrow">Help</div>
        <div className="help-section-title">Common questions</div>

        <div className="help-faqs">
          {FAQS.map((f, i) => (
            <div
              key={i}
              className={`help-faq-item ${openFaq === i ? 'open' : ''}`}
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <div className="help-faq-q">
                <span>{f.q}</span>
                <span className="help-faq-arrow">{openFaq === i ? '−' : '+'}</span>
              </div>
              {openFaq === i && <div className="help-faq-a">{f.a}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Tips ── */}
      <div className="help-section-block">
        <div className="help-section-eyebrow">For lazy people</div>
        <div className="help-section-title">Tips to make this effortless</div>

        {TIPS.map((t, i) => (
          <div className="help-tip-row" key={i}>
            <div className="help-tip-row-icon">{t.icon}</div>
            <div>
              <div className="help-tip-row-title">{t.tip}</div>
              <div className="help-tip-row-detail">{t.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="help-footer">
        Direction · Execute · Close · Observe · Develop · Evolve
      </div>
    </div>
  )
}