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
        proxy: {
            "/api": "http://localhost:8080",
            "/socket.io": {
                target: "http://localhost:8080",
                ws: true
            }
        },
        // Allow Cloudflare tunnels
        allowedHosts: [
            ".trycloudflare.com",
            "app.wolfkrypt.me",
            "localhost"
        ],
        hmr: {
            // Use the tunnel domain for HMR in production
            clientPort: 443,
            protocol: 'wss'
        }
    }
});