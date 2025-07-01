const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
// 使用 express.json() 中间件来解析JSON格式的请求体
app.use(express.json({ limit: '10mb' })); // 限制请求体大小为10MB

// 创建一个POST路由，用于接收HTML并生成图片
app.post('/generate', async (req, res) => {
  const { html, width, height } = req.body;

  if (!html) {
    return res.status(400).send({ error: 'HTML content is required in the request body.' });
  }

  let browser;
  try {
    // 启动一个无头浏览器实例
    // '--no-sandbox' 和 '--disable-setuid-sandbox' 参数在很多云平台是必需的
    browser = await puppeteer.launch({ 
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });

    const page = await browser.newPage();

    // 设置视口（图片尺寸）
    await page.setViewport({ 
      width: width || 1280,  // 如果请求中没提供宽度，默认为1280px
      height: height || 720  // 如果请求中没提供高度，默认为720px
    });

    // 设置页面内容
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // 截取整个页面的屏幕快照，并获取其二进制数据
    const imageBuffer = await page.screenshot({ type: 'png' });

    // 将图片数据发送回客户端
    res.set('Content-Type', 'image/png');
    res.send(imageBuffer);

  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).send({ error: 'Failed to generate image.' });
  } finally {
    // 确保浏览器实例总是被关闭
    if (browser) {
      await browser.close();
    }
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
