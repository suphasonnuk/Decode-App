import { useState } from 'react'
import Help from './Help'

interface Props {
  theme: 'light' | 'dark'
  onThemeToggle: () => void
  onTabChange: (t: string) => void
  onProfileView: () => void
  onExportView: () => void
}

export default function More({ theme, onThemeToggle, onTabChange, onProfileView, onExportView }: Props) {
  const [showHelp, setShowHelp] = useState(false)

  if (showHelp) {
    return (
      <div>
        <button className="back-btn" onClick={() => setShowHelp(false)}>
          ← Back to More
        </button>
        <Help />
      </div>
    )
  }

  return (
    <div>
      <div className="page-intro">
        <div className="page-intro-title">More</div>
        <div className="page-intro-sub">Settings, profile, and help</div>
      </div>

      {/* Settings Section */}
      <div className="card">
        <div className="card-label">Settings</div>

        <button className="more-option-btn" onClick={onThemeToggle}>
          <span className="more-option-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          <div className="more-option-content">
            <div className="more-option-label">Theme</div>
            <div className="more-option-value">{theme === 'light' ? 'Light' : 'Dark'}</div>
          </div>
          <span className="more-option-arrow">›</span>
        </button>

        <button className="more-option-btn" onClick={onProfileView}>
          <span className="more-option-icon">👤</span>
          <div className="more-option-content">
            <div className="more-option-label">Profile & Body Metrics</div>
            <div className="more-option-desc">Update your personal information</div>
          </div>
          <span className="more-option-arrow">›</span>
        </button>

        <button className="more-option-btn" onClick={onExportView}>
          <span className="more-option-icon">📦</span>
          <div className="more-option-content">
            <div className="more-option-label">Export & Backup</div>
            <div className="more-option-desc">Download your data as CSV or JSON</div>
          </div>
          <span className="more-option-arrow">›</span>
        </button>
      </div>

      {/* Help & Support */}
      <div className="card">
        <div className="card-label">Help & Support</div>

        <button className="more-option-btn" onClick={() => setShowHelp(true)}>
          <span className="more-option-icon">❓</span>
          <div className="more-option-content">
            <div className="more-option-label">Help & Documentation</div>
            <div className="more-option-desc">How to use DECODE</div>
          </div>
          <span className="more-option-arrow">›</span>
        </button>
      </div>

      {/* Quick Access Cards */}
      <div className="card">
        <div className="card-label">Quick Access</div>

        <button className="more-option-btn" onClick={() => onTabChange('trends')}>
          <span className="more-option-icon">📊</span>
          <div className="more-option-content">
            <div className="more-option-label">Trends & Analytics</div>
          </div>
          <span className="more-option-arrow">›</span>
        </button>

        <button className="more-option-btn" onClick={() => onTabChange('coach')}>
          <span className="more-option-icon">🤖</span>
          <div className="more-option-content">
            <div className="more-option-label">AI Coach</div>
          </div>
          <span className="more-option-arrow">›</span>
        </button>

        <button className="more-option-btn" onClick={() => onTabChange('nutrition')}>
          <span className="more-option-icon">🥗</span>
          <div className="more-option-content">
            <div className="more-option-label">Nutrition Tracker</div>
          </div>
          <span className="more-option-arrow">›</span>
        </button>

        <button className="more-option-btn" onClick={() => onTabChange('coffee')}>
          <span className="more-option-icon">☕</span>
          <div className="more-option-content">
            <div className="more-option-label">Coffee Log</div>
          </div>
          <span className="more-option-arrow">›</span>
        </button>

        <button className="more-option-btn" onClick={() => onTabChange('decode')}>
          <span className="more-option-icon">🔬</span>
          <div className="more-option-content">
            <div className="more-option-label">Decode Yourself</div>
          </div>
          <span className="more-option-arrow">›</span>
        </button>
      </div>

      <div className="more-footer">
        <div className="more-footer-logo">DECODE</div>
        <div className="more-footer-tagline">Direction · Execute · Close · Observe · Develop · Evolve</div>
      </div>
    </div>
  )
}
