// Performance utilities for face liveness detection
import * as tf from '@tensorflow/tfjs';

export const PERFORMANCE_CONFIG = {
  MODEL_INPUT_SIZE: 224,
  DETECTION_INTERVAL: 100, // ms
  MAX_FPS: 30,
  WARMUP_FRAMES: 5
};

export const optimizeTensorFlow = async () => {
  try {
    // Set WebGL backend for GPU acceleration
    await tf.setBackend('webgl');

    // Enable WebGL optimizations
    tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
    tf.env().set('WEBGL_PACK', true);
    tf.env().set('WEBGL_USE_SHAPES_UNIFORMS', true);

    // Log backend info (reduced verbosity)
    console.log('TensorFlow.js initialized with', tf.getBackend(), 'backend');

    return true;
  } catch (error) {
    console.warn('WebGL optimization failed, falling back to CPU:', error);
    return false;
  }
};

export const createOptimizedModel = () => {
  // Create a lightweight model for demo purposes
  // In production, load a pre-trained quantized model
  const model = tf.sequential({
    layers: [
      tf.layers.conv2d({
        inputShape: [PERFORMANCE_CONFIG.MODEL_INPUT_SIZE, PERFORMANCE_CONFIG.MODEL_INPUT_SIZE, 3],
        filters: 16, // Reduced filters for performance
        kernelSize: 3,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
      }),
      tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }),
      tf.layers.conv2d({
        filters: 32,
        kernelSize: 3,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
      }),
      tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }),
      tf.layers.flatten(),
      tf.layers.dropout({ rate: 0.5 }),
      tf.layers.dense({ units: 64, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.3 }),
      tf.layers.dense({ units: 2, activation: 'softmax' })
    ]
  });

  // Compile with optimized settings
  model.compile({
    optimizer: tf.train.adam(0.0001), // Lower learning rate
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  return model;
};

export const preloadResources = async () => {
  // Preload MediaPipe WASM files
  const mediaPipeFiles = [
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_wasm_bin.js'
  ];

  const preloadPromises = mediaPipeFiles.map(file => {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = file;
      link.onload = resolve;
      link.onerror = reject;
      document.head.appendChild(link);
    });
  });

  try {
    await Promise.all(preloadPromises);
    console.log('MediaPipe resources preloaded successfully');
  } catch (error) {
    console.warn('Failed to preload some resources:', error);
  }
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Memory management utilities
export const disposeTensors = (tensors) => {
  if (Array.isArray(tensors)) {
    tensors.forEach(tensor => {
      if (tensor && tensor.dispose) {
        tensor.dispose();
      }
    });
  } else if (tensors && tensors.dispose) {
    tensors.dispose();
  }
};

export const getMemoryInfo = () => {
  return {
    numTensors: tf.memory().numTensors,
    numBytes: tf.memory().numBytes,
    numDataBuffers: tf.memory().numDataBuffers,
    unreliable: tf.memory().unreliable
  };
};

// FPS monitoring
export class FPSMonitor {
  constructor() {
    this.frames = 0;
    this.lastTime = performance.now();
    this.fps = 0;
  }

  tick() {
    this.frames++;
    const now = performance.now();
    const delta = now - this.lastTime;

    if (delta >= 1000) {
      this.fps = Math.round((this.frames * 1000) / delta);
      this.frames = 0;
      this.lastTime = now;
    }

    return this.fps;
  }

  getFPS() {
    return this.fps;
  }
}
