/* eslint-disable react/button-has-type */
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { useState } from 'react';

function StreamDashboard() {
  const [status, setStatus] = useState('Idle');
  const [isStreaming, setIsStreaming] = useState(false);

  // State for the Input URL (Pre-filled for convenience)
  const [rtspUrl, setRtspUrl] = useState(
    'rtsp://192.168.0.103:8080/h264_ulaw.sdp',
  );

  const handleStartStream = async () => {
    if (!rtspUrl.trim()) {
      setStatus('Error: Please enter a valid RTSP URL');
      return;
    }

    setStatus('Initializing Security Protocols...');

    try {
      // PASS THE URL TO THE BACKEND HERE
      const result = await window.electron.ipcRenderer.invoke(
        'start-stream',
        rtspUrl,
      );
      console.log('Stream Result:', result);

      if (result.status && result.status.includes('Error')) {
        setStatus('Connection Failed: ' + result.error);
      } else {
        setStatus('SECURE LINK ESTABLISHED');
        setIsStreaming(true);
      }
    } catch (error) {
      console.error(error);
      setStatus('System Failure');
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>
        Vector Vision <span style={{ fontSize: '0.5em' }}>CONNECTOR</span>
      </h1>

      {!isStreaming ? (
        // STATE 1: IDLE / INPUT
        <div style={styles.card}>
          <p style={{ marginBottom: '10px', color: '#ccc' }}>
            Enter Camera Source URL
          </p>

          {/* INPUT FIELD */}
          <input
            type="text"
            value={rtspUrl}
            onChange={(e) => setRtspUrl(e.target.value)}
            style={styles.input}
            placeholder="rtsp://192.168.x.x:8080/..."
          />

          <button onClick={handleStartStream} style={styles.buttonStart}>
            ACTIVATE SYSTEM
          </button>

          <p style={{ marginTop: '15px', color: '#aaa', fontSize: '0.9rem' }}>
            {status}
          </p>
        </div>
      ) : (
        // STATE 2: ACTIVE
        <div style={styles.activeCard}>
          <div style={styles.pulse}></div>
          <h2 style={{ color: '#0f0', margin: '20px 0' }}>
            ● LIVE BROADCASTING
          </h2>
          <p>Stream Source:</p>
          <p
            style={{
              color: '#00f3ff',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              marginBottom: '20px',
            }}
          >
            {rtspUrl}
          </p>

          <div
            style={{
              marginTop: '30px',
              padding: '15px',
              background: '#000',
              borderRadius: '5px',
            }}
          >
            <p style={{ fontSize: '0.9em', color: '#ccc' }}>
              Status: <strong>Online</strong>
            </p>
            <p style={{ fontSize: '0.9em', color: '#ccc' }}>
              Uptime: <strong>00:01:24</strong>
            </p>
          </div>

          <button disabled style={styles.buttonActive}>
            SYSTEM ACTIVE
          </button>
        </div>
      )}
    </div>
  );
}

// --- STYLES ---
const styles = {
  container: {
    padding: '40px',
    textAlign: 'center' as const,
    color: 'white',
    backgroundColor: '#1a1a1a',
    minHeight: '100vh',
    fontFamily: 'Segoe UI, sans-serif',
  },
  title: {
    letterSpacing: '2px',
    marginBottom: '40px',
  },
  card: {
    background: '#2a2a2a',
    padding: '40px',
    borderRadius: '15px',
    maxWidth: '450px',
    margin: '0 auto',
    boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
  },
  activeCard: {
    background: '#1e2e1e',
    padding: '40px',
    borderRadius: '15px',
    maxWidth: '500px',
    margin: '0 auto',
    border: '2px solid #0f0',
    boxShadow: '0 0 30px rgba(0, 255, 0, 0.1)',
  },
  input: {
    width: '100%',
    padding: '12px',
    marginBottom: '20px',
    borderRadius: '5px',
    border: '1px solid #555',
    backgroundColor: '#111',
    color: '#00f3ff',
    fontFamily: 'monospace',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  buttonStart: {
    padding: '15px 40px',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '30px',
    transition: 'all 0.3s',
    width: '100%',
  },
  buttonActive: {
    marginTop: '20px',
    padding: '10px 30px',
    fontSize: '14px',
    backgroundColor: 'transparent',
    color: '#0f0',
    border: '1px solid #0f0',
    borderRadius: '30px',
    opacity: 0.7,
  },
  pulse: {
    width: '15px',
    height: '15px',
    borderRadius: '50%',
    background: '#0f0',
    margin: '0 auto',
    boxShadow: '0 0 0 0 rgba(0, 255, 0, 0.7)',
    animation: 'pulse-green 2s infinite',
  },
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StreamDashboard />} />
      </Routes>
    </Router>
  );
}
