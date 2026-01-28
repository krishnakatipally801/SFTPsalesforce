import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();

// Allow large payloads (adjust if needed)
app.use(express.json({ limit: '50mb' }));

app.post('/api/upload', async (req, res) => {
  try {
    const { fileName, contentType, fileBody } = req.body;

    if (!fileName || !fileBody) {
      return res.status(400).json({
        success: false,
        message: 'Missing fileName or fileBody'
      });
    }

    // Decode base64
    const buffer = Buffer.from(fileBody, 'base64');

    // TEMP: save locally (for testing)
    const uploadPath = path.join('/tmp', fileName);
    fs.writeFileSync(uploadPath, buffer);

    console.log(`Received file: ${fileName}, size=${buffer.length}`);

    return res.status(200).json({
      success: true,
      message: 'File received successfully',
      fileName,
      size: buffer.length
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Health check (useful for Azure)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
