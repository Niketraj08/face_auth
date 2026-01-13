import { useEffect, useState } from 'react';
import FaceLivenessDetector from './FaceLivenessDetector'
import './App.css'

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // Register service worker for PWA functionality
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered successfully:', registration);
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error);
        });
    }

    // Check if running as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = window.navigator.standalone === true;
    setIsPWA(isStandalone || isInWebAppiOS);

    // Monitor online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="App">
      {/* Offline indicator */}
      {!isOnline && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#ffc107',
          color: '#856404',
          padding: '10px',
          textAlign: 'center',
          fontWeight: '500',
          zIndex: 1000,
          fontSize: '14px'
        }}>
          ⚠️ You are currently offline. Some features may be limited.
        </div>
      )}

      {/* PWA install prompt hint */}
      {isPWA && (
        <div style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          backgroundColor: 'rgba(26, 54, 93, 0.9)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          📱 PWA Mode
        </div>
      )}

      <FaceLivenessDetector isOnline={isOnline} />
    </div>
  )
}

export default App
