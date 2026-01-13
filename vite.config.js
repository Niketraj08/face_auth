import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Optimize chunk splitting for better loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate TensorFlow.js into its own chunk
          'tensorflow': ['@tensorflow/tfjs', '@tensorflow/tfjs-backend-webgl'],
          // Separate MediaPipe into its own chunk
          'mediapipe': ['@mediapipe/face_mesh'],
          // React and related libraries
          'react-vendor': ['react', 'react-dom', 'react-webcam'],
        }
      }
    },
    // Optimize bundle size
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    // Set chunk size warnings
    chunkSizeWarningLimit: 1000
  },
  // Optimize development server
  server: {
    host: true,
    port: 5173,
    // Enable CORS for MediaPipe CDN
    cors: true
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-backend-webgl',
      '@mediapipe/face_mesh',
      'react-webcam'
    ],
    exclude: []
  },
  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  }
})