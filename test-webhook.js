#!/usr/bin/env node

// Test script for the submitFormData webhook API
// Usage: node test-webhook.js <workflowId>

const https = require('https');

const WORKFLOW_ID = process.argv[2];
if (!WORKFLOW_ID) {
  console.error('Usage: node test-webhook.js <workflowId>');
  process.exit(1);
}

const WEBHOOK_URL = `https://us-central1-avacrm-6900e.cloudfunctions.net/submitFormData?workflowId=${WORKFLOW_ID}`;

// Sample form data - adjust based on your workflow configuration
const testFormData = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '+1234567890',
  message: 'This is a test form submission from the webhook test script',
  createdAt: new Date().toISOString()
};

console.log('Testing webhook API...');
console.log('URL:', WEBHOOK_URL);
console.log('Data:', JSON.stringify(testFormData, null, 2));

const postData = JSON.stringify(testFormData);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(WEBHOOK_URL, options, (res) => {
  console.log(`\nResponse Status: ${res.statusCode}`);
  console.log('Response Headers:', res.headers);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('\nResponse Body:');
      console.log(JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('\nResponse Body (raw):');
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request failed:', error.message);
});

req.write(postData);
req.end();