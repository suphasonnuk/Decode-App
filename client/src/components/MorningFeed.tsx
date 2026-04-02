import { useState } from 'react'
import { getTodayFeed, FEED_CATEGORY_STYLE } from '../data/daily-feed'
import type { FeedItem } from '../data/daily-feed'

const TYPE_LABEL: Record<string, string> = {
  quote: 'Quote', fact: 'Fact', tip: 'Tip', paper: 'Research', insight: 'Insight',
}

function FeedCard({ item, index }: { item: FeedItem; index: number }) {
  const [expanded, setExpanded] = useState(index === 0)
  const catStyle = FEED_CATEGORY_STYLE[item.category]

  return (
    <div
      className="feed-card"
      style={{ '--feed-color': item.color } as React.CSSProperties}
      onClick={() => setExpanded(p => !p)}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(p => !p) } }}
    >
      <div className="feed-card-header">
        <div className="feed-card-left">
          <span className="feed-card-icon">{catStyle.icon}</span>
          <div>
            <div className="feed-card-meta">
              <span className="feed-card-cat" style={{ color: item.color }}>{catStyle.label}</span>
              <span className="feed-card-sep">·</span>
              <span className="feed-card-type">{TYPE_LABEL[item.type] || item.type}</span>
            </div>
            <div className="feed-card-title">{item.title}</div>
          </div>
        </div>
        <span className="feed-card-chevron">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="feed-card-body">
          <p className="feed-card-text">{item.body}</p>
          <div className="feed-card-source" style={{ color: item.color }}>
            — {item.source}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MorningFeed() {
  const items = getTodayFeed()

  if (items.length === 0) return null

  return (
    <div className="morning-feed">
      <div className="morning-feed-header">
        <span className="morning-feed-icon">📰</span>
        <div>
          <div className="morning-feed-title">DECODE Briefing</div>
          <div className="morning-feed-sub">Fuel for your Direction today</div>
        </div>
      </div>
      <div className="morning-feed-cards">
        {items.map((item, i) => (
          <FeedCard key={`${item.category}-${item.title}`} item={item} index={i} />
        ))}
      </div>
    </div>
  )
}
