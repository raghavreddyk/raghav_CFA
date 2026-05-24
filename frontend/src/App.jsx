import React, { useState, useEffect } from 'react';
import './App.css';
import ChatInterface from './components/ChatInterface';
import DocumentManager from './components/DocumentManager';
import FormulaWorkspace from './components/FormulaWorkspace';
import MockExam from './components/MockExam';
import InteractiveBackground from './components/InteractiveBackground';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [activeCitations, setActiveCitations] = useState([]);
  const [backendHealthy, setBackendHealthy] = useState(false);
  const [healthLoading, setHealthLoading] = useState(true);
  const [cfaLevel, setCfaLevel] = useState('Level I');
  const [isDark, setIsDark] = useState(true);

  // Monitor and toggle CSS theme classes on body
  useEffect(() => {
    if (isDark) {
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
    }
  }, [isDark]);

  // Check connection to the FastAPI backend on launch
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_BASE}/health`);
        if (response.ok) {
          setBackendHealthy(true);
        } else {
          setBackendHealthy(false);
        }
      } catch (error) {
        console.error('Backend connection failed:', error);
        setBackendHealthy(false);
      } finally {
        setHealthLoading(false);
      }
    };
    checkHealth();
  }, []);

  return (
    <div className="app-container animate-float-in">
      {/* High-Performance Neural Canvas background */}
      <InteractiveBackground />

      {/* Premium Header */}
      <header className="glass-card app-header" style={{ gap: '20px', flexWrap: 'wrap' }}>
        <div className="brand-section">
          <div className="brand-logo">
            CFA AI <span>Tutor</span>
          </div>
          <div className="brand-subtitle">Level I, II, III Financial Prep</div>
        </div>

        {/* CFA Level Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '700', fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>PREPARATION DEPTH:</span>
          <div style={{
            display: 'flex',
            background: 'var(--bg-obsidian)',
            padding: '3px',
            borderRadius: '30px',
            border: '1px solid var(--border-glass)'
          }}>
            {['Level I', 'Level II', 'Level III'].map((level) => (
              <button
                key={level}
                onClick={() => setCfaLevel(level)}
                style={{
                  background: cfaLevel === level ? 'var(--gradient-gold)' : 'transparent',
                  color: cfaLevel === level ? 'var(--bg-obsidian)' : 'var(--text-muted)',
                  border: 'none',
                  fontFamily: 'var(--font-display)',
                  fontWeight: '700',
                  fontSize: '0.75rem',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                  boxShadow: cfaLevel === level ? 'var(--shadow-gold)' : 'none'
                }}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {/* Modern Material Design 3 Toggle switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', fontFamily: 'var(--font-display)' }}>
              {isDark ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </span>
            <div 
              style={{
                position: 'relative',
                width: '48px',
                height: '24px',
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(26, 115, 232, 0.15)',
                borderRadius: '24px',
                border: '1.5px solid var(--border-glass)',
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
              onClick={() => setIsDark(!isDark)}
            >
              <div 
                style={{
                  position: 'absolute',
                  top: '2px',
                  left: isDark ? '2px' : '26px',
                  width: '17px',
                  height: '17px',
                  background: isDark ? 'var(--text-primary)' : 'var(--accent-blue)',
                  borderRadius: '50%',
                  boxShadow: 'var(--shadow-m3-1)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
            </div>
          </div>

          {/* Live Status Indicator */}
          <div className="status-indicator">
            {healthLoading ? (
              <>
                <div className="spinner" style={{ width: '10px', height: '10px', borderWidth: '1.5px' }}></div>
                <span>Auditing Core Connection...</span>
              </>
            ) : backendHealthy ? (
              <>
                <div className="status-dot"></div>
                <span>FastAPI Vector Server Connected</span>
              </>
            ) : (
              <>
                <div className="status-dot" style={{ backgroundColor: 'var(--accent-red)', boxShadow: '0 0 10px var(--accent-red)' }}></div>
                <span style={{ color: 'var(--accent-red)', fontWeight: '600' }}>FastAPI Offline (Start Backend)</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Tabs bar */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
        <nav className="app-nav">
          <button 
            className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            💬 AI Study Partner
          </button>
          <button 
            className={`nav-tab ${activeTab === 'formula' ? 'active' : ''}`}
            onClick={() => setActiveTab('formula')}
          >
            🔢 Formula Studio
          </button>
          <button 
            className={`nav-tab ${activeTab === 'exam' ? 'active' : ''}`}
            onClick={() => setActiveTab('exam')}
          >
            🎓 Mock Simulator
          </button>
          <button 
            className={`nav-tab ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            📚 Ingest Notes
          </button>
        </nav>
      </div>

      {/* Main Dashboard Panel Render */}
      <main className="dashboard-content">
        {activeTab === 'chat' && (
          <ChatInterface 
            activeCitations={activeCitations} 
            setActiveCitations={setActiveCitations} 
            cfaLevel={cfaLevel}
          />
        )}
        {activeTab === 'formula' && <FormulaWorkspace />}
        {activeTab === 'exam' && <MockExam cfaLevel={cfaLevel} />}
        {activeTab === 'documents' && <DocumentManager />}
      </main>
    </div>
  );
}
