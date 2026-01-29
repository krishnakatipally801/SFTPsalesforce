import express from 'express';
import fs from 'fs';
import path from 'path';
import SftpClient from 'ssh2-sftp-client';

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   MIDDLEWARE
========================================================= */

// Allow large payloads (base64 files)
app.use(express.json({ limit: '50mb' }));

/* =========================================================
   SFTP CONFIG (HARDCODED FOR NOW)
   👉 Move to process.env later
========================================================= */

const SFTP_CONFIG = {
  host: 'sftp.agentiq.co',        // 🔁 CHANGE
  port: 22,
  username: 'mymax-user',           // 🔁 CHANGE
  privateKey: `
-----BEGIN RSA PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACCB6y6PuxK3l5NYtQFmZu2RkL8td5dfj+4dDnWdyd4jlAAAAJDKT/ODyk/z
gwAAAAtzc2gtZWQyNTUxOQAAACCB6y6PuxK3l5NYtQFmZu2RkL8td5dfj+4dDnWdyd4jlA
AAAEA187oBXDhI+Y0/JFWs+cgfN9o+QKcC/6/Mwa9ooprd7IHrLo+7EreXk1i1AWZm7ZGQ
vy13l1+P7h0OdZ3J3iOUAAAACm15bWF4LXVzZXIBAgM=
-----END RSA PRIVATE KEY-----
`,
  remoteDir: '/incoming'           // 🔁 CHANGE
};

/* =========================================================
   SFTP UPLOAD HELPER
========================================================= */

async function uploadToSftp({ fileName, fileBuffer }) {
  const sftp = new SftpClient();

  console.log('🔵 [SFTP] Initializing connection...');
  console.log(`🔵 [SFTP] Target file: ${fileName}`);
  console.log(`🔵 [SFTP] File size: ${fileBuffer.length} bytes`);

  try {
    await sftp.connect({
      host: SFTP_CONFIG.host,
      port: SFTP_CONFIG.port,
      username: SFTP_CONFIG.username,
      privateKey: SFTP_CONFIG.privateKey
    });

    console.log('✅ [SFTP] Connected successfully');

    const remotePath = `${SFTP_CONFIG.remoteDir}/${fileName}`;
    console.log(`🔵 [SFTP] Uploading to ${remotePath}...`);

    await sftp.put(fileBuffer, remotePath);

    console.log('✅ [SFTP] File upload completed');
  } catch (error) {
    console.error('❌ [SFTP] Upload failed');
    console.error(error);
    throw error;
  } finally {
    try {
      await sftp.end();
      console.log('🔵 [SFTP] Connection closed');
    } catch (closeErr) {
      console.warn('⚠️ [SFTP] Failed to close connection cleanly');
      console.warn(closeErr);
    }
  }
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

/* =========================================================
   FILE UPLOAD ENDPOINT
========================================================= */

app.post('/api/upload', async (req, res) => {
  console.log('===================================================');
  console.log('📥 [UPLOAD] Incoming request received');

  try {
    const { fileName, fileBody } = req.body;

    console.log('🔵 [UPLOAD] Payload keys:', Object.keys(req.body || {}));

    if (!fileName || !fileBody) {
      console.warn('⚠️ [UPLOAD] Missing fileName or fileBody');

      return res.status(400).json({
        success: false,
        message: 'Missing fileName or fileBody'
      });
    }

    console.log(`🔵 [UPLOAD] File name: ${fileName}`);

    // Base64 → Buffer
    let fileBuffer;
    try {
      fileBuffer = Buffer.from(fileBody, 'base64');
      console.log(
        `🔵 [UPLOAD] Base64 decoded successfully (${fileBuffer.length} bytes)`
      );
    } catch (decodeErr) {
      console.error('❌ [UPLOAD] Base64 decoding failed');
      console.error(decodeErr);

      return res.status(400).json({
        success: false,
        message: 'Invalid base64 fileBody'
      });
    }

    // Upload to SFTP
    console.log('🔵 [UPLOAD] Starting SFTP upload...');
    await uploadToSftp({
      fileName,
      fileBuffer
    });

    console.log('✅ [UPLOAD] File processed successfully');

    return res.json({
      success: true,
      message: 'File received and uploaded to SFTP',
      fileName,
      size: fileBuffer.length
    });

  } catch (error) {
    console.error('❌ [UPLOAD] Unexpected error occurred');
    console.error(error);

    return res.status(500).json({
      success: false,
      message: 'File upload failed',
      error: error.message
    });
  } finally {
    console.log('📤 [UPLOAD] Request completed');
    console.log('===================================================');
  }
});

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {
  console.log('==============================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('==============================================');
});
