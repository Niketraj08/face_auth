import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';

const useFaceDetection = () => {
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceLandmarks, setFaceLandmarks] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);

  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);

  const onResults = useCallback((results) => {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];
      setFaceLandmarks(landmarks);
      setFaceDetected(true);
    } else {
      setFaceDetected(false);
      setFaceLandmarks(null);
    }
  }, []);

  const initializeFaceDetection = useCallback(async () => {
    try {
      // Initialize FaceMesh
      faceMeshRef.current = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
      });

      // Temporarily suppress MediaPipe logs during initialization
      const originalConsoleLog = console.log;
      const originalConsoleWarn = console.warn;
      const originalConsoleInfo = console.info;

      // Create a filter function to suppress MediaPipe logs
      const filterMediaPipeLogs = (method) => {
        return (...args) => {
          const message = args.join(' ');
          // Suppress MediaPipe internal logs but keep our app logs
          if (message.includes('face_mesh_solution_simd_wasm_bin.js') ||
              message.includes('gl_context') ||
              message.includes('WebGL context') ||
              message.includes('OpenGL')) {
            return; // Suppress MediaPipe logs
          }
          return method.apply(console, args);
        };
      };

      console.log = filterMediaPipeLogs(originalConsoleLog);
      console.warn = filterMediaPipeLogs(originalConsoleWarn);
      console.info = filterMediaPipeLogs(originalConsoleInfo);

      faceMeshRef.current.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      // Restore console methods after initialization
      setTimeout(() => {
        console.log = originalConsoleLog;
        console.warn = originalConsoleWarn;
        console.info = originalConsoleInfo;
        console.log('✅ Face detection ready');
      }, 3000);

      // Suppress verbose MediaPipe logging
      console.log('FaceMesh initialized successfully');

      faceMeshRef.current.onResults(onResults);
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      console.error('Error initializing face detection:', err);
      setError('Failed to initialize face detection');
    }
  }, [onResults]);

  const startDetection = useCallback((videoElement) => {
    if (!faceMeshRef.current || !videoElement) return;

    try {
      // Create a simple camera loop instead of using Camera class
      const processFrame = async () => {
        if (faceMeshRef.current && videoElement) {
          await faceMeshRef.current.send({ image: videoElement });
          requestAnimationFrame(processFrame);
        }
      };

      // Start processing frames
      processFrame();
    } catch (err) {
      console.error('Error starting face detection:', err);
      setError('Failed to start face detection');
    }
  }, []);

  const stopDetection = useCallback(() => {
    // No camera object to stop - the requestAnimationFrame loop will stop naturally
    // when faceMeshRef.current becomes null or videoElement is not available
  }, []);

  useEffect(() => {
    initializeFaceDetection();

    return () => {
      stopDetection();
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
    };
  }, [initializeFaceDetection, stopDetection]);

  return {
    faceDetected,
    faceLandmarks,
    isInitialized,
    error,
    startDetection,
    stopDetection
  };
};

export default useFaceDetection;
