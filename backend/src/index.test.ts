// test.ts
const ws = new WebSocket('ws://localhost:3500/ws');

// 1. Connection opened event
ws.onopen = () => {
  console.log('🚀 Connected to Elysia WebSocket Server!');
  
  // Send a test message as soon as we connect
  console.log('📤 Sending: "Hello Server!"');
  ws.send('Hello Server!');
};

// 2. Message received event (This catches what your server sends back)
ws.onmessage = (event) => {
  console.log(`📥 Received from server: "${event.data}"`);
  
  // Close the connection nicely after receiving the echo response
  ws.close();
};

// 3. Connection closed event
ws.onclose = () => {
  console.log('🔌 Connection closed safely.');
};

// 4. Error event
ws.onerror = (error) => {
  console.error('❌ WebSocket Error:', error);
};
