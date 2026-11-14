const express = require('express');
const ytdl = require('ytdl-core');
const app = express();

const defaultOptions = {
    requestOptions: {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Referer': 'https://www.youtube.com/'
        }
    },
    highWaterMark: 1024 * 1024 // 1MB buffer
};

app.get('/', (req, res) => {
    res.send('✅ Dokman V2 Server is Live! Streaming Mode.');
});

// Endpoint استریم ویدیو
app.get('/api/video/:id', async (req, res) => {
    try {
        const videoId = req.params.id;
        const url = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const info = await ytdl.getInfo(url, { ...defaultOptions, lang: 'fa' });
        const format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'audioandvideo' });

        if (!format) {
            return res.status(404).json({ error: 'No suitable format found' });
        }

        // تنظیم هدر برای پخش آنلاین
        res.setHeader('Content-Type', format.mimeType);
        
        // باز کردن استریم و ارسال به کاربر
        const stream = ytdl(url, { ...defaultOptions, format: format });
        stream.pipe(res);

    } catch (error) {
        console.error('YTDL Error:', error.message);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});
