import { defineConfig, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';
import { createApi } from './server/api.ts';
import { closeReportModel } from './server/report-model.ts';
import { dataDirectory } from './server/store.ts';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'financien-local-api',
      configureServer(server) {
        server.middlewares.use(createApi());
        server.httpServer?.once('close', closeReportModel);
      },
      configurePreviewServer(server) {
        server.middlewares.use(createApi());
        server.httpServer.once('close', closeReportModel);
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 4317,
    strictPort: true,
    cors: false,
    fs: { deny: ['.env', '.env.*', '*.{crt,pem,pdf,sqlite}', '**/.git/**', '**/.private/**', `${normalizePath(dataDirectory())}/**`] },
  },
  preview: { host: '127.0.0.1', port: 4317, strictPort: true, cors: false },
});
