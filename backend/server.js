const express = require('express');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.TERMINAL_PORT || 8126;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'terminal-backend' });
});

const server = app.listen(PORT, () => {
  console.log(`Terminal Backend running on port ${PORT}`);
});

// WebSocket server for terminal connections
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('New terminal connection');
  
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Terminal backend connected'
  }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Terminal command:', data);
      
      // For now, just echo back
      ws.send(JSON.stringify({
        type: 'output',
        data: `Echo: ${data.command || data}`
      }));
    } catch (error) {
      console.error('Error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Terminal connection closed');
  });
});