const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.post('/generate', async (req, res) => {
  // 从请求体中解构出 html, css, width, 和 height
  const { html, css, width, height } = req.body;

  if (!html) {
    return res.status(400).send({ error: 'HTML content is required in the request body.' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: width || 1280,
      height: height || 720
    });

    // 将传入的HTML和CSS组合成一个完整的HTML文档
    // 即使不提供css字段，`css || ''`也能确保代码正常运行
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            ${css || ''}
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    // 设置页面的内容为我们组合好的完整HTML
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    const imageBuffer = await page.screenshot({ type: 'png' });

    res.set('Content-Type', 'image/png');
    res.send(imageBuffer);

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
