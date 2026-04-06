require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');

const app = require('./src/app');
const features = require('./src/shared/flags/features');

const PORT = process.env.PORT || 3001;

// Dev: serve CA cert over plain HTTP on port 3002 so iPhone can download before trusting the cert
if (process.env.NODE_ENV !== 'production') {
  const caPath = path.join(__dirname, '../certs/rootCA.crt');
  const caApp = express();
  caApp.get('/ca.crt', (req, res) => res.download(caPath, 'primID-dev-ca.crt'));
  http.createServer(caApp).listen(3002, '0.0.0.0', () =>
    console.log(`CA cert available at http://<your-local-ip>:3002/ca.crt`)
  );
}

const certPath = path.join(__dirname, '../certs/cert.pem');
const keyPath = path.join(__dirname, '../certs/key.pem');
const useHttps = fs.existsSync(certPath) && fs.existsSync(keyPath);

const server = useHttps
  ? https.createServer({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }, app)
      .listen(PORT, '0.0.0.0', () => {
        console.log(`primID backend running on port ${PORT} (HTTPS)`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
        console.log('Feature flags:', features);
      })
  : app.listen(PORT, '0.0.0.0', () => {
      console.log(`primID backend running on port ${PORT} (HTTP)`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
      console.log('Feature flags:', features);
    });

function gracefulShutdown(signal) {
  console.log(`${signal} received: shutting down...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = app;
