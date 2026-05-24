import React, { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export default function DocumentManager() {
  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success', 'error', 'uploading'
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef(null);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (isUploading) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (isUploading) return;
    const files = e.target.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current.click();
  };

  const uploadFile = async (file) => {
    const validExtensions = ['.pdf', '.txt', '.md'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(extension)) {
      setUploadStatus('error');
      setUploadMessage('Only PDF, TXT, or MD files are supported.');
      return;
    }

    setIsUploading(true);
    setUploadStatus('uploading');
    setUploadMessage(`Processing and chunking "${file.name}"...`);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (response.ok) {
        setUploadStatus('success');
        setUploadMessage(`Successfully indexed! Created ${data.chunks_created} vector chunks inside ChromaDB.`);
        fetchDocuments(); // Refresh document list
      } else {
        setUploadStatus('error');
        setUploadMessage(data.detail || 'Failed to parse and index document.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setUploadMessage('Failed to communicate with RAG server.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (filename) => {
    if (window.confirm(`Are you sure you want to delete "${filename}" from the RAG knowledge base?`)) {
      try {
        const response = await fetch(`${API_BASE}/documents?filename=${encodeURIComponent(filename)}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          fetchDocuments(); // Refresh
        } else {
          alert('Failed to delete document from database.');
        }
      } catch (error) {
        console.error('Delete error:', error);
        alert('Could not connect to backend to complete deletion.');
      }
    }
  };

  return (
    <div className="doc-manager-grid">
      {/* Upload Zone Panel */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ marginBottom: '16px', color: 'var(--gold-light)' }}>Ingest CFA Materials</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
          Upload official CFA curriculum PDFs, mock exam textbooks, or customized study notes. The RAG engine will automatically parse pages, split them recursively into overlapping paragraphs, generate embeddings, and write them into the vector database.
        </p>

        <div 
          className="doc-upload-box" 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileSelect}
            accept=".pdf,.txt,.md"
          />
          <div className="upload-icon">📥</div>
          <h4 className="upload-title">Drag & Drop Files</h4>
          <p className="upload-subtitle">or click to browse local files (PDF, TXT, MD)</p>
        </div>

        {uploadStatus && (
          <div 
            style={{
              marginTop: '20px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.9rem',
              border: '1px solid',
              borderColor: uploadStatus === 'success' ? 'var(--accent-green)' : uploadStatus === 'error' ? 'var(--accent-red)' : 'var(--gold-primary)',
              background: uploadStatus === 'success' ? 'var(--accent-green-glow)' : uploadStatus === 'error' ? 'var(--accent-red-glow)' : 'rgba(212, 175, 55, 0.05)',
              color: uploadStatus === 'success' ? 'var(--text-primary)' : uploadStatus === 'error' ? 'var(--text-primary)' : 'var(--gold-light)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            {uploadStatus === 'uploading' && <div className="spinner" style={{ width: '16px', height: '16px', borderThickness: '2px' }}></div>}
            <span>{uploadMessage}</span>
          </div>
        )}
      </div>

      {/* Loaded Documents Panel */}
      <div className="glass-card doc-list-panel">
        <div className="doc-list-header">
          <h3 style={{ color: 'var(--gold-light)' }}>Indexed Knowledge Base</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{documents.length} Files</span>
        </div>

        {documents.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: '0.95rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📚</div>
            <span>No documents indexed yet. The vector database is empty. Upload curriculum PDFs above to get started!</span>
          </div>
        ) : (
          <div className="doc-list">
            {documents.map((doc, idx) => (
              <div key={idx} className="doc-item">
                <div className="doc-info">
                  <div className="doc-name">📄 {doc.filename}</div>
                  <div className="doc-meta">
                    <span>📑 {doc.chunks_count} Vector Chunks</span>
                    <span>•</span>
                    <span>📖 {doc.pages_count} Pages / Sections</span>
                  </div>
                </div>
                <button 
                  className="doc-delete-btn" 
                  onClick={() => handleDelete(doc.filename)}
                  title="Remove from database"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
