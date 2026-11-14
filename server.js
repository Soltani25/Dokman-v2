const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const app = express();

app.use(cors());

const defaultOptions = {
    requestOptions: {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Referer': 'https://www.youtube.com/'
        }
    },
    highWaterMark: 1024 * 1024
};

app.get('/', (req, res) => {
    res.send('✅ Dokman V2 Server is Live! Direct Redirect Mode.');
});

app.get('/api/video/:id', async (req, res) => {
    try {
        const videoId = req.params.id;
        const url = `https://www.youtube.com/watch?v=${videoId}`;

        if (!ytdl.validateURL(url)) {
            return res.status(400).send('Invalid YouTube URL');
        }

        const info = await ytdl.getInfo(url, { ...defaultOptions, lang: 'fa' });
        const format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'audioandvideo' });

        if (!format || !format.url) {
            return res.status(404).send('No suitable format found');
        }

        // هدایت مستقیم به فایل MP4 در سرور گوگل
        res.redirect(format.url);

    } catch (error) {
        console.error('YTDL Error:', error.message);
        res.status(500).send('Error: Server blocked by YouTube or invalid link.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
