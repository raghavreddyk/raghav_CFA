import React, { useState, useRef, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

// Initialize Web Speech SpeechRecognition safely
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
}

export default function ChatInterface({ activeCitations, setActiveCitations, cfaLevel }) {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      content: "Welcome, Candidate! I am your **CFA Tutor** AI. I'm primed to help you master Ethics, Quant, Equity, Portfolio Management, and other curriculum areas.\n\nYou can ask me specific questions or toggle the **RAG curriculum search** to query official materials. Try asking me: *'What does Standard I(A) say about Knowledge of the Law?'*",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [ragEnabled, setRagEnabled] = useState(true);
  const [provider, setProvider] = useState('gemini');
  const [isLoading, setIsLoading] = useState(false);
  
  // File attachments state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);
  
  // Voice Assistant state
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState(null);
  const [autoSpeak, setAutoSpeak] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Handle Speech-to-Text (Voice Dictation)
  const handleToggleListening = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser. Please try Chrome or Safari.");
      return;
    }
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognition.start();
    }
  };

  useEffect(() => {
    if (!recognition) return;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputText((prev) => prev + (prev ? ' ' : '') + transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    };
  }, []);

  // Handle Text-to-Speech (Read Aloud)
  const handleSpeakText = (text, index) => {
    if (window.speechSynthesis.speaking && speakingMessageIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingMessageIndex(null);
      return;
    }

    // Cancel current speech
    window.speechSynthesis.cancel();

    // Clean text of markdown and equation markers for high-quality speech rendering
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\$\$(.*?)\$\$/gs, '$1')
      .replace(/\$(.*?)\$/g, '$1');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';

    const voices = window.speechSynthesis.getVoices();
    const tutorVoice = voices.find(v => 
      v.name.includes("Google US English") || 
      v.name.includes("Samantha") || 
      v.name.includes("Natural")
    ) || voices[0];
    
    if (tutorVoice) {
      utterance.voice = tutorVoice;
    }

    utterance.onend = () => {
      setSpeakingMessageIndex(null);
    };

    utterance.onerror = () => {
      setSpeakingMessageIndex(null);
    };

    setSpeakingMessageIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  // Clean up any ongoing speech synthesis on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles((prev) => [...prev, ...files]);
    e.target.value = ''; // Reset input so same file can be selected again
  };

  const removeSelectedFile = (idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // Helper to parse double dollars ($$ eq $$) and single dollars ($ eq $) for premium math block display
  const formatMessageText = (text) => {
    if (!text) return '';
    
    // Split text by $$ blocks
    const blocks = text.split(/\$\$(.*?)\$\$/gs);
    return blocks.map((part, idx) => {
      if (idx % 2 === 1) {
        // Render block math equation
        return (
          <div key={idx} className="math-block">
            {part.trim()}
          </div>
        );
      }
      
      // For standard text inside a block, replace inline $eq$ with code style
      const inlineParts = part.split(/\$(.*?)\$/g);
      return (
        <span key={idx}>
          {inlineParts.map((subPart, subIdx) => {
            if (subIdx % 2 === 1) {
              return <code key={subIdx} style={{ color: 'var(--gold-light)', padding: '0 4px', fontStyle: 'italic' }}>{subPart}</code>;
            }
            
            // Format bold text (**text**) inside messages
            const boldParts = subPart.split(/\*\*(.*?)\*\*/g);
            return boldParts.map((boldText, boldIdx) => {
              if (boldIdx % 2 === 1) {
                return <strong key={boldIdx} style={{ color: 'var(--gold-light)' }}>{boldText}</strong>;
              }
              // Format italic text (*text*)
              const italicParts = boldText.split(/\*(.*?)\*/g);
              return italicParts.map((italicText, italicIdx) => {
                if (italicIdx % 2 === 1) {
                  return <em key={italicIdx}>{italicText}</em>;
                }
                return italicText;
              });
            });
          })}
        </span>
      );
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() && selectedFiles.length === 0) return;

    setIsLoading(true);
    const textPrompt = inputText;
    setInputText('');

    // Process attachments
    const attachmentsPayload = [];
    const attachmentsToRender = [];
    
    try {
      for (const file of selectedFiles) {
        const base64Data = await convertFileToBase64(file);
        attachmentsPayload.push({
          filename: file.name,
          content_type: file.type,
          base64_data: base64Data
        });
        attachmentsToRender.push({
          name: file.name,
          type: file.type,
          previewUrl: file.type.startsWith('image/') ? base64Data : null
        });
      }
    } catch (err) {
      console.error("Failed to parse attachments:", err);
      alert("Failed to read attached file(s). Please try again.");
      setIsLoading(false);
      return;
    }

    const userMessage = {
      role: 'user',
      content: textPrompt,
      attachments: attachmentsToRender,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setSelectedFiles([]); // Clear attachment picker list

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textPrompt,
          provider: provider,
          rag_enabled: ragEnabled,
          cfa_level: cfaLevel,
          attachments: attachmentsPayload
        })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      
      const aiMessage = {
        role: 'ai',
        content: data.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: data.provider_used
      };

      setMessages((prev) => {
        const next = [...prev, aiMessage];
        if (autoSpeak) {
          setTimeout(() => handleSpeakText(data.response, next.length - 1), 100);
        }
        return next;
      });
      
      // Update citation panel if citations are returned
      if (data.citations && data.citations.length > 0) {
        setActiveCitations(data.citations);
      } else {
        if (ragEnabled) {
          setActiveCitations([]);
        }
      }

    } catch (error) {
      console.error('Error communicating with backend:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: '⚠️ **Connection Error**: I could not reach the FastAPI server. Please make sure the backend server is running on `http://localhost:8000`.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-wrapper">
      {/* Main Chat Panel */}
      <div className="glass-card chat-main">
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.role}`}>
              <div className={`message-meta ${msg.role}-meta`}>
                <span>{msg.role === 'user' ? 'Candidate' : `CFA Tutor AI (${msg.provider || provider})`}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {msg.role === 'ai' && (
                    <button
                      type="button"
                      className="speak-btn"
                      onClick={() => handleSpeakText(msg.content, index)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: speakingMessageIndex === index ? 'var(--accent-blue)' : 'var(--text-muted)',
                        fontSize: '0.9rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        transition: 'var(--transition-fast)'
                      }}
                      title={speakingMessageIndex === index ? "Stop reading" : "Read aloud"}
                    >
                      {speakingMessageIndex === index ? '🔊' : '🔈'}
                      {speakingMessageIndex === index && (
                        <span style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
                          <span style={{ width: '2px', height: '6px', background: 'var(--accent-blue)', display: 'inline-block' }}></span>
                          <span style={{ width: '2px', height: '10px', background: 'var(--accent-blue)', display: 'inline-block' }}></span>
                          <span style={{ width: '2px', height: '6px', background: 'var(--accent-blue)', display: 'inline-block' }}></span>
                        </span>
                      )}
                    </button>
                  )}
                  <span>{msg.timestamp}</span>
                </span>
              </div>
              <div style={{ whiteSpace: 'pre-line' }}>
                {formatMessageText(msg.content)}
              </div>
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="message-attachments" style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginTop: '10px',
                  borderTop: msg.content ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  paddingTop: msg.content ? '8px' : '0'
                }}>
                  {msg.attachments.map((att, attIdx) => (
                    <div key={attIdx} className="message-attachment-item" style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-glass)',
                      maxWidth: '100%'
                    }}>
                      {att.previewUrl ? (
                        <img 
                          src={att.previewUrl} 
                          alt={att.name} 
                          style={{
                            maxWidth: '220px',
                            maxHeight: '150px',
                            borderRadius: 'var(--radius-sm)',
                            objectFit: 'contain'
                          }}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <span>📄</span>
                          <span style={{ fontWeight: '500' }}>{att.name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="chat-message ai animate-float-in" style={{ opacity: 0.85, width: '65%' }}>
              <div className="message-meta ai-meta">
                <span>CFA Tutor is compiling explanation...</span>
              </div>
              <div className="skeleton-container" style={{ marginTop: '8px' }}>
                <div className="skeleton-line skeleton-pulse"></div>
                <div className="skeleton-line medium skeleton-pulse" style={{ marginTop: '8px' }}></div>
                <div className="skeleton-line short skeleton-pulse" style={{ marginTop: '8px' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Selected Files Preview Bar */}
        {selectedFiles.length > 0 && (
          <div className="selected-files-bar" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '8px 16px',
            marginBottom: '10px',
            background: 'rgba(0,0,0,0.15)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-glass)'
          }}>
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="selected-file-pill" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                padding: '4px 10px',
                borderRadius: '100px',
                fontSize: '0.8rem',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-secondary)'
              }}>
                <span>{file.type.startsWith('image/') ? '🖼️' : '📄'}</span>
                <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeSelectedFile(idx)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    padding: '0 2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="chat-input-area">
          <button
            type="button"
            className="attachment-trigger-btn"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              transition: 'var(--transition-fast)',
              padding: '4px',
              marginRight: '8px'
            }}
            title="Attach file (Image, PDF, TXT)"
          >
            📎
          </button>
          <button
            type="button"
            className={`mic-trigger-btn ${isListening ? 'listening' : ''}`}
            onClick={handleToggleListening}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isListening ? 'var(--accent-red)' : 'var(--text-muted)',
              transition: 'var(--transition-fast)',
              padding: '4px',
              marginRight: '8px'
            }}
            title={isListening ? "Listening... click to stop" : "Dictate with voice"}
          >
            🎙️
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            multiple
            accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp,.gif"
          />
          <input
            type="text"
            className="chat-input"
            placeholder={isLoading ? "Tutor is writing..." : "Ask a CFA question, e.g. 'What is DuPont analysis?'"}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
          />
          <button type="submit" className="btn-blue" style={{ padding: '8px 20px', fontSize: '0.85rem' }} disabled={isLoading}>
            Send
          </button>
        </form>

        {/* Configurations */}
        <div className="chat-controls">
          <div className="chat-toggles" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <label className="toggle-container">
              <input
                type="checkbox"
                checked={ragEnabled}
                onChange={() => setRagEnabled(!ragEnabled)}
              />
              <span>Use RAG (Curriculum Search)</span>
            </label>
            <label className="toggle-container">
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={() => setAutoSpeak(!autoSpeak)}
              />
              <span>🎙️ Auto-Speak Answers</span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Inference:</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              style={{
                background: 'var(--bg-obsidian)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-glass)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-display)',
                fontWeight: '600'
              }}
            >
              <option value="gemini">Gemini Flash (Blistering Fast)</option>
              <option value="groq">Groq Llama 3 (Sub-Second)</option>
              <option value="openai">OpenAI GPT-4 (Detailed)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Citations Sidebar Panel */}
      <div className="glass-card sidebar-citations">
        <h3>Curriculum References</h3>
        {activeCitations.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>
            No references loaded for the current response. Ask a question with RAG enabled to retrieve textbook citations.
          </p>
        ) : (
          <div className="citations-list">
            {activeCitations.map((cit, idx) => (
              <div key={idx} className="citation-card">
                <div className="citation-source">📄 {cit.source}</div>
                <div className="citation-page">Section / Page: {cit.page}</div>
                <div className="citation-preview">
                  "{cit.preview}"
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
