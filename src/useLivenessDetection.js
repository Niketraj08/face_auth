import { useEffect, useRef, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { optimizeTensorFlow, createOptimizedModel, PERFORMANCE_CONFIG, disposeTensors } from './utils/performance';

const useLivenessDetection = () => {
  const [isLive, setIsLive] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState(null);

  const modelRef = useRef(null);
  const faceHistoryRef = useRef([]);

  const initializeModel = useCallback(async () => {
    try {
      // Optimize TensorFlow.js for performance
      await optimizeTensorFlow();

      // Create optimized model
      modelRef.current = createOptimizedModel();

      // Warm up the model with dummy data
      const warmupTensor = tf.zeros([1, PERFORMANCE_CONFIG.MODEL_INPUT_SIZE, PERFORMANCE_CONFIG.MODEL_INPUT_SIZE, 3]);
      for (let i = 0; i < PERFORMANCE_CONFIG.WARMUP_FRAMES; i++) {
        await modelRef.current.predict(warmupTensor);
      }
      warmupTensor.dispose();

      setIsModelLoaded(true);
      setError(null);
      console.log('Liveness detection model initialized and warmed up');
    } catch (err) {
      console.error('Error initializing liveness model:', err);
      setError('Failed to initialize liveness detection model');
    }
  }, []);

  const createDemoModel = async () => {
    // Create a simple demo model that simulates liveness detection
    // In production, replace this with actual model loading
    const model = tf.sequential();

    model.add(tf.layers.conv2d({
      inputShape: [224, 224, 3],
      filters: 32,
      kernelSize: 3,
      activation: 'relu'
    }));

    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 2, activation: 'softmax' }));

    // Compile the model with dummy optimizer and loss
    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  };

  // Passive liveness detection: texture analysis
  const analyzeTexture = useCallback(async (faceTensor) => {
    if (!faceTensor) return 0;

    try {
      // Convert to grayscale for texture analysis
      const gray = tf.mean(faceTensor, -1, true);

      // Apply Laplacian filter to detect edges/texture
      const laplacian = tf.conv2d(
        gray.expandDims(-1),
        tf.tensor4d([[[[0, 1, 0], [1, -4, 1], [0, 1, 0]]]], [3, 3, 1, 1]),
        [1, 1], 'same'
      );

      const variance = tf.moments(laplacian).variance;
      const textureScore = await variance.data();

      disposeTensors([gray, laplacian, variance]);

      // Higher texture score indicates more detailed/real face
      return textureScore[0] > 0.01 ? 1 : 0;
    } catch (error) {
      console.error('Texture analysis failed:', error);
      return 0;
    }
  }, []);

  // Passive liveness detection: motion analysis
  const analyzeMotion = useCallback((currentFace, previousFaces) => {
    if (!currentFace || previousFaces.length < 3) return 0;

    try {
      let totalMotion = 0;
      let motionCount = 0;

      // Compare current face with recent frames
      for (let i = 0; i < Math.min(previousFaces.length, 3); i++) {
        const prevFace = previousFaces[i];

        // Calculate mean squared difference
        const diff = tf.squaredDifference(currentFace, prevFace);
        const meanDiff = tf.mean(diff);

        totalMotion += meanDiff.dataSync()[0];
        motionCount++;

        diff.dispose();
        meanDiff.dispose();
      }

      const avgMotion = totalMotion / motionCount;

      // Low motion might indicate static image/video
      return avgMotion > 0.001 ? 1 : 0;
    } catch (error) {
      console.error('Motion analysis failed:', error);
      return 0;
    }
  }, []);

  // Frequency domain analysis for detecting digital artifacts
  const analyzeFrequencyDomain = useCallback(async (faceTensor) => {
    if (!faceTensor) return 0;

    try {
      // Convert to frequency domain using FFT
      const fft = tf.spectral.fft2d(faceTensor);
      const magnitude = tf.abs(fft);

      // Analyze high-frequency components (digital artifacts appear in high frequencies)
      const highFreqEnergy = tf.sum(tf.slice(magnitude, [0, 112, 0], [-1, 112, -1]));

      const totalEnergy = tf.sum(magnitude);
      const artifactRatio = highFreqEnergy.div(totalEnergy);

      const ratio = await artifactRatio.data();

      disposeTensors([fft, magnitude, highFreqEnergy, totalEnergy, artifactRatio]);

      // High artifact ratio might indicate digital manipulation
      return ratio[0] < 0.3 ? 1 : 0; // Lower ratio = more natural image
    } catch (error) {
      console.error('Frequency analysis failed:', error);
      return 0;
    }
  }, []);

  // Enhanced spoof detection combining multiple passive methods
  const detectSpoofing = useCallback(async (faceTensor, faceHistory = []) => {
    if (!faceTensor) return { isSpoof: true, confidence: 0, reasons: ['No face data'] };

    const textureScore = await analyzeTexture(faceTensor);
    const motionScore = analyzeMotion(faceTensor, faceHistory);
    const frequencyScore = await analyzeFrequencyDomain(faceTensor);

    const totalScore = (textureScore + motionScore + frequencyScore) / 3;
    const isSpoof = totalScore < 0.5;

    const reasons = [];
    if (textureScore < 0.5) reasons.push('Low texture detail');
    if (motionScore < 0.5) reasons.push('Insufficient motion');
    if (frequencyScore < 0.5) reasons.push('Digital artifacts detected');

    return {
      isSpoof,
      confidence: totalScore,
      reasons
    };
  }, [analyzeTexture, analyzeMotion, analyzeFrequencyDomain]);

  const detectLiveness = useCallback(async (faceImageTensor) => {
    if (!modelRef.current || !isModelLoaded) {
      setError('Model not loaded');
      return;
    }

    try {
      // Security validation: Check tensor dimensions and values
      if (!faceImageTensor || faceImageTensor.shape.length !== 3) {
        throw new Error('Invalid face tensor format');
      }

      // Additional security checks
      const tensorStats = await getTensorStats(faceImageTensor);
      if (tensorStats.hasInvalidValues) {
        throw new Error('Face image contains invalid data');
      }

      // Store face in history for motion analysis (keep last 5 frames)
      faceHistoryRef.current.push(faceImageTensor.clone());
      if (faceHistoryRef.current.length > 5) {
        const oldFace = faceHistoryRef.current.shift();
        oldFace.dispose();
      }

      // Passive liveness detection first (faster and more reliable for some attacks)
      const passiveResult = await detectSpoofing(faceImageTensor, faceHistoryRef.current.slice(0, -1));

      if (passiveResult.isSpoof) {
        console.log('Passive detection: Spoof detected:', passiveResult.reasons);
        setIsLive(false);
        setConfidence(1 - passiveResult.confidence);
        return {
          isLive: false,
          confidence: 1 - passiveResult.confidence,
          spoofReasons: passiveResult.reasons
        };
      }

      // Preprocess the face image tensor
      const processedTensor = preprocessFaceImage(faceImageTensor);

      // Run inference with timeout
      const inferencePromise = modelRef.current.predict(processedTensor);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Inference timeout')), 5000)
      );

      const predictions = await Promise.race([inferencePromise, timeoutPromise]);

      // Get the prediction results
      const predictionData = await predictions.data();
      const liveProbability = predictionData[1]; // Assuming index 1 is live probability
      const spoofProbability = predictionData[0]; // Assuming index 0 is spoof probability

      // Validate prediction results
      if (isNaN(liveProbability) || isNaN(spoofProbability)) {
        throw new Error('Invalid prediction results');
      }

      // Combine active and passive results
      const activeConfidence = Math.max(liveProbability, spoofProbability);
      const combinedConfidence = (activeConfidence + passiveResult.confidence) / 2;

      const isLiveResult = liveProbability > spoofProbability && !passiveResult.isSpoof;

      // Additional security: Check for suspiciously high confidence
      if (combinedConfidence > 0.99) {
        console.warn('Unusually high confidence detected - possible spoof attempt');
      }

      setIsLive(isLiveResult);
      setConfidence(combinedConfidence);

      // Clean up tensors
      disposeTensors([processedTensor, predictions]);

      return {
        isLive: isLiveResult,
        confidence: combinedConfidence,
        passiveScore: passiveResult.confidence,
        spoofReasons: passiveResult.isSpoof ? passiveResult.reasons : []
      };
    } catch (err) {
      console.error('Error during liveness detection:', err);
      setError('Failed to perform liveness detection');
      return null;
    }
  }, [isModelLoaded, detectSpoofing]);

  // Security utility: Get tensor statistics for validation
  const getTensorStats = async (tensor) => {
    const data = await tensor.data();
    let min = Infinity;
    let max = -Infinity;
    let hasInvalidValues = false;

    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      if (isNaN(val) || !isFinite(val)) {
        hasInvalidValues = true;
        break;
      }
      min = Math.min(min, val);
      max = Math.max(max, val);
    }

    return { min, max, hasInvalidValues };
  };

  const preprocessFaceImage = (faceTensor) => {
    // Resize to 224x224 and normalize
    return tf.image.resizeBilinear(faceTensor, [224, 224])
      .div(255.0)
      .expandDims(0); // Add batch dimension
  };

  const extractFaceFromVideo = (videoElement, landmarks) => {
    if (!videoElement || !landmarks || landmarks.length === 0) return null;

    try {
      // Calculate face bounding box from landmarks
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      landmarks.forEach(landmark => {
        minX = Math.min(minX, landmark.x);
        minY = Math.min(minY, landmark.y);
        maxX = Math.max(maxX, landmark.x);
        maxY = Math.max(maxY, landmark.y);
      });

      // Add padding around the face
      const padding = 0.2; // 20% padding
      const width = maxX - minX;
      const height = maxY - minY;

      minX = Math.max(0, minX - width * padding);
      minY = Math.max(0, minY - height * padding);
      maxX = Math.min(1, maxX + width * padding);
      maxY = Math.min(1, maxY + height * padding);

      // Convert normalized coordinates to pixel coordinates
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;

      const faceX = minX * videoWidth;
      const faceY = minY * videoHeight;
      const faceWidth = (maxX - minX) * videoWidth;
      const faceHeight = (maxY - minY) * videoHeight;

      // Create canvas for face extraction
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 224;
      canvas.height = 224;

      // Draw the face region to canvas
      ctx.drawImage(
        videoElement,
        faceX, faceY, faceWidth, faceHeight, // Source rectangle
        0, 0, canvas.width, canvas.height   // Destination rectangle
      );

      // Convert to tensor
      const tensor = tf.browser.fromPixels(canvas);

      // Validate tensor
      if (tensor.shape[0] !== 224 || tensor.shape[1] !== 224) {
        tensor.dispose();
        throw new Error('Face extraction produced incorrect dimensions');
      }

      return tensor;
    } catch (err) {
      console.error('Error extracting face:', err);
      return null;
    }
  };

  useEffect(() => {
    initializeModel();

    return () => {
      if (modelRef.current) {
        modelRef.current.dispose();
      }
    };
  }, [initializeModel]);

  return {
    isLive,
    confidence,
    isModelLoaded,
    error,
    detectLiveness,
    extractFaceFromVideo
  };
};

export default useLivenessDetection;
