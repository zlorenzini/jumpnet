#!/usr/bin/env node
/**
 * clients/node/test-upload.js
 *
 * Sends a labeled image to POST /dataset/upload and prints the response.
 *
 * Usage:
 *   node test-upload.js                          # uses built-in test image
 *   node test-upload.js path/to/image.jpg        # uses a real file
 *   JUMPNET_URL=http://other:4080 node test-upload.js
 *
 * Requires: Node.js 20+ (native fetch)
 */

import { readFileSync, existsSync } from 'node:fs';

const JUMPNET  = process.env.JUMPNET_URL ?? 'http://localhost:4080';
const DATASET  = process.env.DATASET     ?? 'test-dataset';
const LABEL    = process.env.LABEL       ?? 'test-label';
const IMG_PATH = process.argv[2];

// Minimal 1×1 white JPEG (no external dependency needed for smoke-testing)
const TINY_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U' +
  'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC' +
  'AABAAEDAQIRAAQAAQIB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/' +
  'xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';

async function uploadFile(imagePath) {
  const buf      = readFileSync(imagePath);
  const filename = imagePath.split(/[\\/]/).pop();
  const boundary = `----JumpNetTestBoundary${Date.now()}`;
  const CRLF     = '\r\n';

  const field = (name, value) =>
    Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`);

  const fileHead = Buffer.from(
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
    `Content-Type: image/jpeg${CRLF}${CRLF}`
  );
  const tail = Buffer.from(`${CRLF}--${boundary}--${CRLF}`);
  const body = Buffer.concat([field('dataset', DATASET), field('label', LABEL), fileHead, buf, tail]);

  return fetch(`${JUMPNET}/dataset/upload`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
}

async function uploadBase64() {
  return fetch(`${JUMPNET}/dataset/upload`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ dataset: DATASET, label: LABEL, image: TINY_JPEG_B64, filename: 'test.jpg' }),
  });
}

async function main() {
  console.log(`JumpNet: ${JUMPNET}`);
  console.log(`Dataset: ${DATASET} / Label: ${LABEL}`);

  let res;
  if (IMG_PATH) {
    if (!existsSync(IMG_PATH)) { console.error(`File not found: ${IMG_PATH}`); process.exit(1); }
    console.log(`Uploading file: ${IMG_PATH}`);
    res = await uploadFile(IMG_PATH);
  } else {
    console.log('No file provided — uploading built-in 1×1 test JPEG via JSON base64.');
    res = await uploadBase64();
  }

  const body = await res.json().catch(() => ({}));
  console.log(`\nHTTP ${res.status}`);
  console.log(JSON.stringify(body, null, 2));

  if (!res.ok) process.exit(1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
