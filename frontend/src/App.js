import React, { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const [mode, setMode] = useState('normal'); 
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  // const [eraPrompt, setEraPrompt] = useState(''); // Removed
  const [resultImage, setResultImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastTs, setLastTs] = useState(0);

  const fileInputRef = useRef(null);
  const BACKEND_URL = 'http://localhost:8000';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'display') setMode('display');
    else if (view === 'controller') setMode('controller');
    else setMode('normal');
  }, []);

  useEffect(() => {
    if (mode !== 'display') return;
    const interval = setInterval(async () => {
      try {
        const statusRes = await fetch(`${BACKEND_URL}/stall/status`);
        const status = await statusRes.json();
        if (status.ts > lastTs) {
          const imgRes = await fetch(`${BACKEND_URL}/stall/latest`);
          if (imgRes.ok) {
            const blob = await imgRes.blob();
            setResultImage(URL.createObjectURL(blob));
            setLastTs(status.ts);
          }
        }
      } catch (e) { console.log("Waiting for new image..."); }
    }, 3000);
    return () => clearInterval(interval);
  }, [mode, lastTs]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResultImage(null);
    }
  };

  const handleTrigger = (type) => {
    if (type === 'camera') fileInputRef.current.setAttribute('capture', 'user');
    else fileInputRef.current.removeAttribute('capture');
    fileInputRef.current.click();
  };

  const handleSubmit = async () => {
    // Check for selectedImage only, eraPrompt is no longer needed
    if (!selectedImage) return setError("Please select an image.");
    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', selectedImage);
    // era_prompt and is_stall are removed from formData for this project
    // formData.append('era_prompt', eraPrompt);
    // formData.append('is_stall', mode === 'controller' ? 'true' : 'false');

    try {
      // Changed endpoint to /ghiblification/
      const res = await fetch(`${BACKEND_URL}/ghiblification/`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error("Ghiblification failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      setResultImage(url);
      if (mode === 'controller') alert("Transformation sent to main display!");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleDownload = async () => {
    if (!resultImage) return;
    
    try {
      if (mode === 'display') {
        // Download from /download/latest (if stall mode is still desired for display)
        const res = await fetch(`${BACKEND_URL}/download/latest`); 
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ghiblification_result.png';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const a = document.createElement('a');
        a.href = resultImage;
        a.download = 'ghiblification_result.png';
        a.click();
      }
    } catch (e) {
      console.error('Download failed:', e);
    }
  };

  return (
    <div className={`App view-${mode}`}>
      <header className="app-header">
        <h1 className="logo-text">Ghibli<span className="highlight">fier</span></h1> {/* Updated title */}
        {mode === 'display' && <span className="live-badge">LIVE DISPLAY</span>}
      </header>

      <main className="main-content">
        {mode !== 'display' && (
          <div className="input-panel card">
            <h2 className="panel-title">1. Upload Image</h2> {/* Updated title */}
            <div className="button-row">
              <button onClick={() => handleTrigger('camera')} className="action-button primary"><i className="fas fa-camera" /> Camera</button>
              <button onClick={() => handleTrigger('gallery')} className="action-button outline"><i className="fas fa-image" /> Gallery</button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageChange} style={{display:'none'}} accept="image/*" />
            
            {previewUrl && (
              <div className="preview-container">
                <img src={previewUrl} className="preview-box" alt="preview" />
                <button className="remove-btn" onClick={() => {setSelectedImage(null); setPreviewUrl(null)}}>×</button>
              </div>
            )}

            {/* Removed Era Description section */}
            {/* <h2 className="panel-title" style={{marginTop:'20px'}}>2. Era Description</h2>
            <select className="era-select" onChange={(e) => setEraPrompt(e.target.value)} disabled={loading}>
              {ERA_PRESETS.map(era => <option key={era.label} value={era.prompt}>{era.label}</option>)}
            </select> */}

            <button onClick={handleSubmit} className="action-button secondary" disabled={loading || !selectedImage}>
              {loading ? <i className="fas fa-spinner fa-spin" /> : "Ghiblify Image"} {/* Updated button text */}
            </button>
            {error && <p className="error-text">{error}</p>}
          </div>
        )}

        {mode !== 'controller' && (
          <div className={`output-panel card ${mode === 'display' ? 'full-screen' : ''}`}>
            <h2 className="panel-title">2. Result</h2> {/* Updated title to "2. Result" */}
            <div className="result-container">
              {resultImage ? (
                <>
                  <img src={resultImage} className="final-img" alt="result" />
                  <button onClick={handleDownload} className="download-btn">
                    <i className="fas fa-download" /> Download
                  </button>
                </>
              ) : (
                <div className="placeholder">
                  <i className="fas fa-wand-sparkles fa-3x" />
                  <p>{mode === 'display' ? "Ready for Input..." : "Ghibli art will appear here"}</p> {/* Updated placeholder text */}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
