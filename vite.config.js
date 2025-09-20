import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/functions',
      'react',
      'react-dom',
      'react-router-dom'
    ]
  },
  build: {
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate Firebase for better caching
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions'],
          // Separate charting libraries
          charts: ['chart.js', 'react-chartjs-2', 'chartjs-adapter-date-fns'],
          // Separate utilities
          utils: ['date-fns', 'uuid', 'react-icons'],
          // React ecosystem
          react: ['react', 'react-dom', 'react-router-dom', 'prop-types'],
          // Other libraries
          vendor: ['gsap', 'react-window', 'react-window-infinite-loader', 'react-swipeable']
        },
        // Optimize chunk file names for better caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Enable source maps for better debugging in production
    sourcemap: false,
    // Use terser for better minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true, // Remove debugger statements
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      }
    },
    // Optimize CSS
    cssCodeSplit: true,
    // Enable gzip compression
    reportCompressedSize: true
  },
  // Performance optimizations
  server: {
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..']
    }
  },
  // Enable esbuild for faster builds
  esbuild: {
    drop: ['console', 'debugger'], // Remove console and debugger in production
    legalComments: 'none' // Remove legal comments
  }
})
