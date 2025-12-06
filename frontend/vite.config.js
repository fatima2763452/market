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
      
    }
});