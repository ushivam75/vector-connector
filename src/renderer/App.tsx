/* eslint-disable react/button-has-type */
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { useState } from 'react';

// This component handles the Streaming UI
function StreamDashboard() {
  const [status, setStatus] = useState('Idle');
  const [streamUrl, setStreamUrl] = useState('');

  const handleStartStream = async () => {
    setStatus('Starting Engine...');

    try {
      // 1. Call the Main Process to start go2rtc
      // We send 'null' so it uses the TEST_RTSP_URL we hardcoded in main.ts
      const result = await window.electron.ipcRenderer.invoke(
        'start-stream',
        null,
      );
      // console.log(result);

      setStatus('Stream Active');

      console.log('Full Result:', result);
      // result.url is the PUBLIC ngrok link
      // We add /webrtc.html?src=camera1 to the end of it
      if (result.url) {
        setStreamUrl(`${result.url}/webrtc.html?src=camera1`);
      }
    } catch (error) {
      console.error(error);
      setStatus('Error Starting Stream');
    }
  };

  return (
    <div
      style={{
        padding: '20px',
        textAlign: 'center',
        color: 'white',
        backgroundColor: '#222',
        minHeight: '100vh',
      }}
    >
      <h1>Vector Vision Bridge</h1>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={handleStartStream}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: 'pointer',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
          }}
        >
          START STREAMING
        </button>
      </div>

      <p>
        Status: <strong>{status}</strong>
      </p>

      {/* The Video Player Area */}
      {streamUrl && (
        <div style={{ marginTop: '30px', border: '2px solid #007bff' }}>
          <h3>Live Feed</h3>
          {/* We embed the go2rtc WebRTC player inside an iframe */}
          <iframe
            src={streamUrl}
            title="Live Stream"
            width="100%"
            height="500px"
            style={{ border: 'none' }}
            allow="autoplay; fullscreen"
          />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StreamDashboard />} />
      </Routes>
    </Router>
  );
}
