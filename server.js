const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json({ limit: '10mb' }));

const tempDir = '/tmp/screenshots';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

app.use('/temp-images', express.static(tempDir));

app.post('/generate', async (req, res) => {
  // 从请求体中解构出所有参数，包括新增的 filename
  const { html, css, width, height, filename: customFilename } = req.body;

  if (!html) {
    return res.status(400).send({ error: 'HTML content is required.' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: width || 1280, height: height || 720 });

    const fullHtml = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css || ''}</style></head>
      <body>${html}</body></html>
    `;
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    const imageBuffer = await page.screenshot({ type: 'png' });

    // --- 核心改动在这里 ---
    // 1. 决定最终文件名：
    //    - 如果传入了 customFilename，就使用它（并进行安全处理）。
    //    - 否则，像以前一样生成一个唯一的UUID文件名。
    //    - 使用 path.basename() 可以防止路径遍历攻击，确保只使用文件名部分。
    const finalFilename = customFilename ? path.basename(customFilename) : `${uuidv4()}.png`;
    const filepath = path.join(tempDir, finalFilename);

    // 2. 将图片数据写入到使用最终文件名的文件中
    fs.writeFileSync(filepath, imageBuffer);

    // 3. 在返回的JSON中包含这个最终文件名
    res.json({ filename: finalFilename });

  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).send({ error: 'Failed to generate image.' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
