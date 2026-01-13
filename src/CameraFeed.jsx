import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';

const CameraFeed = ({ onVideoReady, width = 640, height = 480 }) => {
  const webcamRef = useRef(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState(null);

  const videoConstraints = {
    width: width,
    height: height,
    facingMode: "user"
  };

  const handleUserMedia = () => {
    setIsCameraReady(true);
    setError(null);
    if (onVideoReady && webcamRef.current) {
      onVideoReady(webcamRef.current.video);
    }
  };

  const handleUserMediaError = (error) => {
    console.error('Camera error:', error);
    setError('Unable to access camera. Please check permissions and try again.');
    setIsCameraReady(false);
  };

  return (
    <div className="camera-container">
      {error && (
        <div className="error-message" style={{
          color: 'red',
          padding: '10px',
          marginBottom: '10px',
          border: '1px solid red',
          borderRadius: '4px',
          backgroundColor: '#ffe6e6'
        }}>
          {error}
        </div>
      )}

      <Webcam
        ref={webcamRef}
        audio={false}
        videoConstraints={videoConstraints}
        onUserMedia={handleUserMedia}
        onUserMediaError={handleUserMediaError}
        style={{
          width: '100%',
          maxWidth: `${width}px`,
          height: 'auto',
          borderRadius: '12px',
          border: '2px solid rgba(102, 126, 234, 0.3)'
        }}
      />

      {!isCameraReady && !error && (
        <div className="loading-message" style={{
          textAlign: 'center',
          padding: '20px',
          color: '#666'
        }}>
          Initializing camera...
        </div>
      )}
    </div>
  );
};

export default CameraFeed;
