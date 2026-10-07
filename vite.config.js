import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        // Fixed port + auto-open the default browser when the app is ready.
        port: 5177,
        open: true,
    },
    build: {
        chunkSizeWarningLimit: 1200,
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ['react', 'react-dom', 'react-router-dom'],
                    charts: ['recharts'],
                    motion: ['framer-motion'],
                    vendor: ['date-fns', 'jsbarcode', 'html2canvas', 'react-to-print', 'zustand'],
                },
            },
        },
    },
});
