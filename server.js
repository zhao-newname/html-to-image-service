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
    // 修改点 1: 将默认视口尺寸更新为您设计稿的尺寸，以便在未提供宽高时获得最佳效果
    await page.setViewport({ width: width || 1240, height: height || 1660 });

    // ========================================================================
    // --- 核心修改部分：用更智能的方式处理HTML和CSS ---
    // ========================================================================
    //
    // 旧逻辑（已删除）:
    // const fullHtml = `
    //   <!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css || ''}</style></head>
    //   <body>${html}</body></html>
    // `;
    //
    // 新逻辑:
    // 1. 将您从 Make.com 传入的 CSS 代码包裹在一个 <style> 标签里。
    const styleTag = `<style>${css || ''}</style>`;

    // 2. 将这个 <style> 标签“注入”到您传入的完整 HTML 的 </head> 标签之前。
    //    这种方法可以完美保留您原始 HTML 的所有结构，包括 <meta> 和 <link> 标签，
    //    从而确保字体能够被正确加载。
    const finalHtml = html.includes('</head>')
      ? html.replace('</head>', `${styleTag}</head>`)
      : html;
    // ========================================================================
    // --- 核心修改结束 ---
    // ========================================================================

    // 使用我们智能处理过的、包含所有字体链接和样式的最终HTML来设置页面内容
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });

    const imageBuffer = await page.screenshot({ type: 'png' });

    // 这部分逻辑保持不变
    const finalFilename = customFilename ? path.basename(customFilename) : `${uuidv4()}.png`;
    const filepath = path.join(tempDir, finalFilename);
    fs.writeFileSync(filepath, imageBuffer);
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
