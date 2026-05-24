import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const TOPICS = [
  { id: 'Ethical and Professional Standards', label: 'Ethical & Professional Standards' },
  { id: 'Quantitative Methods', label: 'Quantitative Methods' },
  { id: 'Economics', label: 'Economics' },
  { id: 'Financial Statement Analysis', label: 'Financial Statement Analysis' },
  { id: 'Corporate Issuers', label: 'Corporate Issuers' },
  { id: 'Equity Investments', label: 'Equity Investments' },
  { id: 'Fixed Income', label: 'Fixed Income' },
  { id: 'Derivatives', label: 'Derivatives' },
  { id: 'Alternative Investments', label: 'Alternative Investments' },
  { id: 'Portfolio Management and Wealth Planning', label: 'Portfolio Management & Wealth Planning' }
];

export default function MockExam({ cfaLevel }) {
  const [selectedTopic, setSelectedTopic] = useState('Ethical and Professional Standards');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState('gemini');
  
  // Scorecard state
  const [correctCount, setCorrectCount] = useState(0);
  const [totalAttempted, setTotalAttempted] = useState(0);

  const handleGenerateQuestion = async () => {
    setIsLoading(true);
    setCurrentQuestion(null);
    setSelectedOption(null);
    setIsSubmitted(false);

    try {
      const response = await fetch(`${API_BASE}/mock-exam/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: selectedTopic,
          provider: provider,
          cfa_level: cfaLevel
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate mock question');
      }

      const data = await response.json();
      setCurrentQuestion(data);
    } catch (error) {
      console.error('Error generating question:', error);
      alert('Could not connect to mock question API.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionSelect = (option) => {
    if (isSubmitted) return;
    setSelectedOption(option);
  };

  const handleSubmitAnswer = () => {
    if (!selectedOption || isSubmitted) return;
    
    setIsSubmitted(true);
    setTotalAttempted((prev) => prev + 1);
    
    if (selectedOption === currentQuestion.correct_answer) {
      setCorrectCount((prev) => prev + 1);
    }
  };

  const getOptionClassName = (opt) => {
    if (!isSubmitted) {
      return selectedOption === opt ? 'selected' : '';
    }
    
    const isCorrect = currentQuestion.correct_answer === opt;
    const isSelected = selectedOption === opt;
    
    if (isCorrect) return 'correct';
    if (isSelected && !isCorrect) return 'wrong';
    return '';
  };

  return (
    <div className="exam-container">
      {/* Session Scorecard */}
      <div 
        className="glass-card" 
        style={{ 
          padding: '12px 24px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid var(--border-glass)' 
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.25rem' }}>🎓</span>
          <span style={{ fontWeight: '700', fontFamily: 'var(--font-display)', color: 'var(--gold-light)' }}>
            CFA SESSION SCORECARD
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: '600' }}>
          Correct Ratio: <span style={{ color: 'var(--gold-primary)', fontSize: '1.1rem' }}>
            {totalAttempted > 0 ? `${((correctCount / totalAttempted) * 100).toFixed(0)}%` : '0%'}
          </span>
          <span style={{ color: 'var(--text-muted)', marginLeft: '10px', fontSize: '0.85rem' }}>
            ({correctCount} / {totalAttempted} Questions)
          </span>
        </div>
      </div>

      {/* Setup Control Room */}
      {!currentQuestion && !isLoading && (
        <div className="glass-card exam-setup">
          <h2 style={{ color: 'var(--gold-primary)' }}>Mock Question Generator</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', fontSize: '0.95rem' }}>
            Generate high-yield CFA-style practice questions pulled from the curriculum vector knowledge base. Test your qualitative and quantitative reasoning under exam-realistic conditions.
          </p>

          <div className="topic-selector">
            {TOPICS.map((topic) => (
              <button
                key={topic.id}
                className={`topic-pill ${selectedTopic === topic.id ? 'active' : ''}`}
                onClick={() => setSelectedTopic(topic.id)}
              >
                {topic.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>LLM Engine:</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              style={{
                background: 'var(--bg-obsidian)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-glass)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-display)',
                fontWeight: '600'
              }}
            >
              <option value="gemini">Gemini Flash (Instant)</option>
              <option value="groq">Groq Llama 3 (Sub-Second)</option>
              <option value="openai">OpenAI GPT-4 (Scholarly)</option>
            </select>
          </div>

          <button onClick={handleGenerateQuestion} className="btn-blue">
            Generate Practice Question
          </button>
        </div>
      )}

      {/* Loader */}
      {isLoading && (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
          <span style={{ color: 'var(--gold-light)', fontStyle: 'italic' }}>
            Retrieving curriculum vectors & structuring realistic scenario...
          </span>
        </div>
      )}

      {/* Interactive Question Card */}
      {currentQuestion && (
        <div className="glass-card exam-question-card">
          <div className="exam-question-header">
            <span>TOPIC: {selectedTopic.toUpperCase()}</span>
            <span>CFA CURRICULUM PRACTICE</span>
          </div>

          <div className="exam-question-text">
            {currentQuestion.question}
          </div>

          {/* Options */}
          <div className="options-list">
            {Object.entries(currentQuestion.options).map(([optKey, optVal]) => (
              <button
                key={optKey}
                className={`option-btn ${getOptionClassName(optKey)}`}
                onClick={() => handleOptionSelect(optKey)}
                disabled={isSubmitted}
              >
                <div className="option-badge">{optKey}</div>
                <div>{optVal}</div>
              </button>
            ))}
          </div>

          {/* Action Pad */}
          <div className="exam-actions">
            {!isSubmitted ? (
              <button 
                onClick={handleSubmitAnswer} 
                className="btn-blue" 
                disabled={!selectedOption}
              >
                Submit Answer
              </button>
            ) : (
              <button onClick={handleGenerateQuestion} className="btn-blue">
                Next Practice Question
              </button>
            )}
          </div>

          {/* Review Panel */}
          {isSubmitted && (
            <div className="exam-explanation">
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedOption === currentQuestion.correct_answer ? (
                  <span style={{ color: 'var(--accent-green)' }}>✓ Correct Evaluation</span>
                ) : (
                  <span style={{ color: 'var(--accent-red)' }}>✗ Incorrect Evaluation</span>
                )}
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '6px', whiteSpace: 'pre-line' }}>
                {currentQuestion.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
