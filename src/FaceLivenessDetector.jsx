import React, { useEffect, useRef, useState } from 'react';
import CameraFeed from './CameraFeed';
import useFaceDetection from './useFaceDetection';
import useLivenessDetection from './useLivenessDetection';
import useLivenessChecks from './useLivenessChecks';
import { FPSMonitor } from './utils/performance';

const FaceLivenessDetector = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [detectionResult, setDetectionResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fps, setFps] = useState(0);
  const fpsMonitorRef = useRef(null);

  const {
    faceDetected,
    faceLandmarks,
    isInitialized: faceDetectionInitialized,
    error: faceDetectionError,
    startDetection,
    stopDetection
  } = useFaceDetection();

  const {
    isLive,
    confidence,
    isModelLoaded,
    error: livenessError,
    detectLiveness,
    extractFaceFromVideo
  } = useLivenessDetection();

  const {
    blinkDetected,
    headTurnDetected,
    smileDetected,
    currentAction,
    actionProgress,
    checkLivenessAction,
    resetChecks,
    getActionInstruction,
    isComplete
  } = useLivenessChecks();

  // Handle video ready
  const handleVideoReady = (video) => {
    videoRef.current = video;
    startDetection(video);

    // Initialize FPS monitor
    fpsMonitorRef.current = new FPSMonitor();

    // Start FPS monitoring
    const updateFPS = () => {
      if (fpsMonitorRef.current) {
        const currentFps = fpsMonitorRef.current.tick();
        setFps(currentFps);
        requestAnimationFrame(updateFPS);
      }
    };
    updateFPS();
  };

  // Draw face landmarks on canvas
  const drawFaceLandmarks = () => {
    if (!canvasRef.current || !faceLandmarks || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;

    // Set canvas size to match video element's display size (not video resolution)
    const videoRect = video.getBoundingClientRect();
    canvas.width = videoRect.width;
    canvas.height = videoRect.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scale factor to convert normalized coordinates to canvas coordinates
    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;

    // Draw face landmarks as larger, more visible dots
    faceLandmarks.forEach(landmark => {
      // Convert normalized coordinates (0-1) to actual pixel coordinates
      const x = landmark.x * canvas.width;
      const y = landmark.y * canvas.height;

      // Draw smaller dots for better visibility
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fillStyle = '#00ff00';
      ctx.fill();

      // Add a subtle glow effect
      ctx.shadowColor = '#00ff00';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0; // Reset shadow
    });

    console.log(`Drew ${faceLandmarks.length} face landmarks`);
  };

  // Draw a message when no face is detected
  const drawNoFaceMessage = () => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const videoRect = videoRef.current.getBoundingClientRect();
    canvas.width = videoRect.width;
    canvas.height = videoRect.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw "No face detected" message
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(canvas.width / 2 - 100, canvas.height / 2 - 25, 200, 50);

    ctx.fillStyle = '#dc3545';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No face detected', canvas.width / 2, canvas.height / 2 + 5);
  };

  // Process liveness detection
  const processLivenessDetection = async () => {
    if (!faceLandmarks || !videoRef.current || isProcessing) return;

    setIsProcessing(true);

    try {
      // Extract face from video
      const faceTensor = extractFaceFromVideo(videoRef.current, faceLandmarks);

      if (faceTensor) {
        // Run liveness detection
        const result = await detectLiveness(faceTensor);
        faceTensor.dispose();

        if (result) {
          setDetectionResult({
            isLive: result.isLive,
            confidence: result.confidence,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Error in liveness detection:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle start verification
  const handleStartVerification = () => {
    setDetectionResult(null);
    resetChecks();
  };

  // Handle complete verification
  const handleCompleteVerification = async () => {
    await processLivenessDetection();
  };

  // Draw landmarks when face is detected or show no face message
  useEffect(() => {
    if (faceDetected && faceLandmarks) {
      drawFaceLandmarks();
      checkLivenessAction(faceLandmarks);
    } else {
      // Draw "no face detected" message when no face is found
      drawNoFaceMessage();
    }
  }, [faceDetected, faceLandmarks, checkLivenessAction]);

  // Auto-complete when all actions are done
  useEffect(() => {
    if (isComplete && !detectionResult) {
      handleCompleteVerification();
    }
  }, [isComplete, detectionResult]);

  return (
    <div className="face-liveness-detector">
      {/* UIDAI Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '30px',
        padding: '20px',
        background: 'linear-gradient(135deg, #1a365d 0%, #2d3748 100%)',
        borderRadius: '12px',
        color: 'white'
      }}>
        <div style={{
          fontSize: '1.8rem',
          fontWeight: '700',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px'
        }}>
          🏛️ UIDAI - Unique Identification Authority of India
        </div>
        <div style={{
          fontSize: '1.4rem',
          fontWeight: '500',
          opacity: '0.9'
        }}>
          Aadhaar Face Authentication Platform
        </div>
        <div style={{
          fontSize: '0.9rem',
          marginTop: '8px',
          opacity: '0.8'
        }}>
          Secure Biometric Verification System
        </div>

        {/* Version/Mode Indicator */}
        <div style={{
          fontSize: '0.8rem',
          marginTop: '10px',
          padding: '4px 12px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          display: 'inline-block',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          🔧 Liveness Detection v3.3 Mode
        </div>
      </div>

      <h1 style={{
        textAlign: 'center',
        color: '#2c3e50',
        marginBottom: '30px',
        fontSize: '2.2rem',
        fontWeight: '600',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }}>
        Face Liveness Detection
      </h1>

      {/* UIDAI Compliance Notice */}
      <div style={{
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: 'rgba(255, 248, 220, 0.9)',
        borderRadius: '8px',
        border: '1px solid rgba(255, 193, 7, 0.3)',
        fontSize: '0.9rem',
        color: '#856404'
      }}>
        <div style={{ fontWeight: '600', marginBottom: '5px' }}>
          🔒 Secure Verification Process
        </div>
        <div>
          Your biometric data is processed locally in your browser and never stored or transmitted.
          This verification complies with UIDAI security standards.
        </div>
      </div>

      {/* Status Information */}
      <div className="status-info" style={{
        marginBottom: '20px',
        padding: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '12px',
        border: '1px solid rgba(102, 126, 234, 0.1)',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ marginBottom: '10px' }}>
          <strong>Face Detection:</strong>
          <span style={{ color: faceDetected ? '#28a745' : '#dc3545', marginLeft: '10px' }}>
            {faceDetectionInitialized ? (faceDetected ? '✅ Face Detected' : '❌ No face detected') : '⏳ Initializing camera...'}
          </span>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <strong>AI Model Status:</strong>
          <span style={{ color: isModelLoaded ? '#28a745' : '#ffc107', marginLeft: '10px' }}>
            {isModelLoaded ? '✅ Liveness model ready' : '⏳ Loading AI model...'}
          </span>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <strong>Verification Method:</strong>
          <span style={{ marginLeft: '10px', color: '#007bff' }}>
            Active + Passive Liveness Detection
          </span>
        </div>

        <div>
          <strong>Current Instruction:</strong>
          <span style={{ marginLeft: '10px', color: '#007bff', fontWeight: '500' }}>
            {getActionInstruction() || 'Initializing system...'}
          </span>
        </div>
      </div>

      {/* Hidden status for screen readers */}
      <div id="verification-status" className="sr-only" aria-live="polite">
        {faceDetectionInitialized ? (faceDetected ? 'Face detected' : 'No face detected') : 'Initializing camera'}
        {isModelLoaded ? 'AI model ready' : 'Loading AI model'}
        Current instruction: {getActionInstruction()}
      </div>

      {/* Progress Bar */}
      <div className="progress-container" style={{ marginBottom: '20px' }}>
        <div
          role="progressbar"
          aria-valuenow={actionProgress}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Face verification progress"
          style={{
            width: '100%',
            height: '24px',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '2px solid rgba(102, 126, 234, 0.2)'
          }}
        >
          <div style={{
            width: `${actionProgress}%`,
            height: '100%',
            background: actionProgress === 100
              ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            transition: 'width 0.5s ease-in-out',
            borderRadius: '8px'
          }} />
        </div>
        <div style={{
          textAlign: 'center',
          marginTop: '8px',
          fontSize: '16px',
          color: '#2c3e50',
          fontWeight: '500'
        }}>
          Verification Progress: {actionProgress}%
        </div>
      </div>

      {/* Camera Feed */}
      <div className="camera-container" style={{
        position: 'relative',
        marginBottom: '20px',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <CameraFeed
          onVideoReady={handleVideoReady}
          width={320}
          height={240}
        />

        {/* Canvas overlay for landmarks */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            borderRadius: '12px',
            zIndex: 10
          }}
        />
      </div>

      {/* Action Status */}
      <div className="action-status" style={{
        display: 'flex',
        justifyContent: 'space-around',
        marginBottom: '20px',
        padding: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '12px',
        border: '1px solid rgba(102, 126, 234, 0.1)',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '24px',
            marginBottom: '5px'
          }}>
            {blinkDetected ? '👁️' : '👁️‍🗨️'}
          </div>
          <div style={{ fontSize: '12px', color: blinkDetected ? '#28a745' : '#6c757d' }}>
            Blink
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '24px',
            marginBottom: '5px'
          }}>
            {headTurnDetected ? '👤' : '👤‍🗨️'}
          </div>
          <div style={{ fontSize: '12px', color: headTurnDetected ? '#28a745' : '#6c757d' }}>
            Head Turn
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '24px',
            marginBottom: '5px'
          }}>
            {smileDetected ? '😊' : '😐'}
          </div>
          <div style={{ fontSize: '12px', color: smileDetected ? '#28a745' : '#6c757d' }}>
            Smile
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="controls" style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '15px',
        marginBottom: '20px'
      }}>
        <button
          onClick={handleStartVerification}
          disabled={!faceDetectionInitialized || !isModelLoaded}
          aria-label="Start Aadhaar face verification process"
          aria-describedby="verification-status"
          style={{
            padding: '12px 24px',
            background: (!faceDetectionInitialized || !isModelLoaded)
              ? '#6c757d'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: (!faceDetectionInitialized || !isModelLoaded) ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: '500',
            boxShadow: (!faceDetectionInitialized || !isModelLoaded)
              ? 'none'
              : '0 4px 15px rgba(102, 126, 234, 0.3)',
            transition: 'all 0.3s ease',
            opacity: (!faceDetectionInitialized || !isModelLoaded) ? 0.6 : 1
          }}
        >
          🏁 Start Aadhaar Verification
        </button>

        {isComplete && !detectionResult && (
          <button
            onClick={handleCompleteVerification}
            disabled={isProcessing}
            aria-label="Complete the face liveness verification process"
            aria-describedby="verification-progress"
            style={{
              padding: '12px 24px',
              background: isProcessing
                ? '#6c757d'
                : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              boxShadow: isProcessing
                ? 'none'
                : '0 4px 15px rgba(40, 167, 69, 0.3)',
              transition: 'all 0.3s ease',
              opacity: isProcessing ? 0.6 : 1
            }}
          >
            {isProcessing ? '🔄 Processing Results...' : '✅ Complete Aadhaar Verification'}
          </button>
        )}
      </div>

      {/* Results */}
      {detectionResult && (
        <div
          className="results"
          role="alert"
          aria-live="assertive"
          style={{
            padding: '25px',
            backgroundColor: detectionResult.isLive
              ? 'rgba(40, 167, 69, 0.1)'
              : 'rgba(220, 53, 69, 0.1)',
            border: `2px solid ${detectionResult.isLive ? '#28a745' : '#dc3545'}`,
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: detectionResult.isLive
              ? '0 8px 25px rgba(40, 167, 69, 0.2)'
              : '0 8px 25px rgba(220, 53, 69, 0.2)'
          }}
        >
          <div style={{
            fontSize: '3rem',
            marginBottom: '15px'
          }}>
            {detectionResult.isLive ? '✅' : '❌'}
          </div>

          <h2 style={{
            color: detectionResult.isLive ? '#155724' : '#721c24',
            marginBottom: '15px',
            fontSize: '1.8rem',
            fontWeight: '600'
          }}>
            {detectionResult.isLive ? 'Live Face Verified' : 'Authentication Failed'}
          </h2>

          <p style={{
            color: detectionResult.isLive ? '#155724' : '#721c24',
            marginBottom: '15px',
            fontSize: '1rem'
          }}>
            {detectionResult.isLive
              ? 'Your face liveness has been successfully verified for Aadhaar authentication.'
              : 'Face spoofing detected. Please ensure you are using a live face for authentication.'
            }
          </p>

          <div style={{ marginBottom: '10px', fontSize: '0.9rem' }}>
            <strong>Liveness Confidence:</strong> {(detectionResult.confidence * 100).toFixed(2)}%
          </div>

          <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '15px' }}>
            Verification completed at: {new Date(detectionResult.timestamp).toLocaleString()}
          </div>

          {detectionResult.isLive && (
            <div style={{
              backgroundColor: 'rgba(40, 167, 69, 0.1)',
              padding: '10px',
              borderRadius: '6px',
              fontSize: '0.9rem',
              color: '#155724'
            }}>
              ✅ Your Aadhaar authentication is now complete. You may proceed with your transaction.
            </div>
          )}
        </div>
      )}

      {/* Error Messages */}
      {(faceDetectionError || livenessError) && (
        <div
          className="error"
          role="alert"
          aria-live="assertive"
          style={{
            padding: '20px',
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            border: '2px solid #dc3545',
            borderRadius: '12px',
            color: '#721c24',
            textAlign: 'center',
            marginTop: '20px',
            boxShadow: '0 4px 15px rgba(220, 53, 69, 0.2)'
          }}
        >
          <strong>⚠️ System Error:</strong> {faceDetectionError || livenessError}
          <div style={{ fontSize: '0.9rem', marginTop: '10px' }}>
            Please refresh the page and try again. If the problem persists, contact UIDAI support.
          </div>
        </div>
      )}

      {/* UIDAI Footer */}
      <div style={{
        marginTop: '40px',
        padding: '20px',
        backgroundColor: 'rgba(26, 54, 93, 0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(26, 54, 93, 0.1)',
        textAlign: 'center',
        fontSize: '0.85rem',
        color: '#4a5568'
      }}>
        <div style={{ fontWeight: '600', marginBottom: '10px', color: '#1a365d' }}>
          🏛️ UIDAI - Unique Identification Authority of India
        </div>
        <div style={{ marginBottom: '8px' }}>
          This face authentication system is designed to prevent identity fraud and ensure secure Aadhaar verification.
        </div>
        <div style={{ marginBottom: '8px' }}>
          <strong>Compliance:</strong> Meets UIDAI security standards | <strong>Privacy:</strong> No biometric data stored
        </div>
        <div style={{ fontSize: '0.8rem', opacity: '0.7' }}>
          For support: Visit <a href="https://uidai.gov.in" target="_blank" rel="noopener noreferrer" style={{ color: '#1a365d' }}>uidai.gov.in</a> | Helpline: 1947
        </div>
      </div>
    </div>
  );
};

export default FaceLivenessDetector;
