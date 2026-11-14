const express = require('express');
const cors = require('cors');
const youtubedl = require('yt-dlp-exec');
const app = express();

app.use(cors());

app.get('/', (req, res) => {
    res.send('✅ Dokman Server is Live and Working!');
});

app.get('/download', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'لینک خالی است' });

    try {
        console.log("Processing URL:", url);
        
        const output = await youtubedl(url, {
            // فرمت 18 معمولاً یک فایل MP4 کامل (صدا+تصویر) است که برای گوشی عالی است
            // اگر نبود، بهترین فرمت موجود را می‌گیرد
            format: '18/best[ext=mp4]/best', 
            getUrl: true,
            noWarnings: true,
            noCallHome: true,
            // این خط جادویی باعث می‌شود یوتیوب فکر کند درخواست از یک گوشی اندروید یا iOS می‌آید
            extractorArgs: 'youtube:player_client=android,ios,web_safari' 
        });
        
        const directUrl = output.trim().split('\n')[0];
        res.json({ url: directUrl });
        
    } catch (error) {
        console.error('DETAILED_ERROR:', error.message);
        // اگر باز هم بلاک شد، پیام دقیق‌تری می‌دهیم
        res.status(500).json({ error: 'یوتیوب آی‌پی سرور را بلاک کرده است.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
