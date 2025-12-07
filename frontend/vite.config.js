import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        host: '0.0.0.0', // Bind to all network interfaces for tunnel
        port: 5173,
        strictPort: true,
        allowedHosts: ['app.wolfkrypt.me', 'localhost', '127.0.0.1'],
        proxy: {
            "/api": "https://api.wolfkrypt.me",
            "/socket.io": {
                target: "https://api.wolfkrypt.me",
                ws: true
            }
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    // Vendor chunks - separate large dependencies
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'chart-vendor': ['lightweight-charts'],
                    'socket-vendor': ['socket.io-client'],
                    'framer-vendor': ['framer-motion'],
                    
                    // Only chunk lazy-loaded pages for code splitting
                    'chart': ['./src/page/Chart/TradingChart.jsx'],
                }
            }
        },
        chunkSizeWarningLimit: 1000, // Increase limit to 1000kb temporarily
        sourcemap: false, // Disable sourcemaps in production for smaller files
        minify: 'esbuild', // Use esbuild (faster, built-in, no extra dependency)
    }
});