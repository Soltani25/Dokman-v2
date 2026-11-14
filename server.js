const express = require('express');
const cors = require('cors');
const youtubedl = require('yt-dlp-exec');
const app = express();

app.use(cors());

// مسیر تست برای بررسی روشن بودن سرور
app.get('/', (req, res) => {
    res.send('✅ Dokman Server is Live and Working!');
});

// مسیر اصلی دانلود
app.get('/download', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'لینک خالی است' });

    try {
        const output = await youtubedl(url, {
            format: 'bestvideo+bestaudio/best', 
            getUrl: true,
            noWarnings: true
        });
        const directUrl = output.trim().split('\n')[0];
        res.json({ url: directUrl });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'خطا در پردازش لینک' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
