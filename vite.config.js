import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Split Three.js core and postprocessing into separate chunks.
        // The postprocessing chunk is only fetched if the device isn't reduced-motion.
        manualChunks(id) {
          if (id.includes('three/examples/jsm/postprocessing')) {
            return 'three-postfx';
          }
          if (id.includes('three/examples/jsm/loaders')) {
            return 'three-loaders';
          }
          if (id.includes('node_modules/three')) {
            return 'three-core';
          }
        },
      },
    },
    // Target modern browsers — avoids unnecessary polyfill weight
    target: 'es2020',
    // Warn if any single chunk exceeds 500 kB (Three.js core is ~600 kB, so chunked)
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 3000
  },
});
