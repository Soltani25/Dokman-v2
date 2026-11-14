const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' })); 
app.use(express.static(__dirname));

const BASE = { noWarnings: true, jsRuntimes: 'node' };
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

// پاکسازی خودکار فایل‌های کوکی قدیمی (بعد از 10 دقیقه)
setInterval(() => {
    try {
        const files = fs.readdirSync(tmpDir);
        const now = Date.now();
        files.forEach(f => {
            try {
                const filePath = path.join(tmpDir, f);
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > 10 * 60 * 1000) fs.unlinkSync(filePath);
            } catch(e) {}
        });
    } catch(e) {}
}, 60 * 1000);

// ۱. دریافت اطلاعات و دسته‌بندی تمام فرمت‌ها
app.post('/api/videos', async (req, res) => {
    const { url, cookies } = req.body;
    if (!url) return res.status(400).json({ status: 'error', message: 'لینک ارسال نشده.' });

    const sessionId = crypto.randomUUID();
    const cookiePath = path.join(tmpDir, `${sessionId}.txt`);
    const opts = { ...BASE, dumpSingleJson: true };
    
    // اگر کوکی ارسال شده بود
    if (cookies && cookies.trim().length > 20) {
        fs.writeFileSync(cookiePath, cookies);
        opts.cookies = cookiePath;
    }

    try {
        const data = await youtubedl(url, opts);

        // جلوگیری از پردازش پلی‌لیست (برای جلوگیری از کرش)
        if (data.entries && Array.isArray(data.entries) && data.entries.length > 0) {
            if (fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath);
            return res.status(400).json({ status: 'error', message: 'لطفاً لینک یک ویدیوی تکی را وارد کنید.' });
        }

        const allFormats = [];
        const seenQualities = new Set();

        if (data.formats) {
            data.formats.forEach(f => {
                if (f.ext === 'mhtml' || f.format_note === 'storyboard') return;

                let type = 'other';
                if (f.vcodec !== 'none' && f.acodec !== 'none') type = 'muxed'; // صدا و تصویر
                else if (f.vcodec !== 'none' && f.acodec === 'none') type = 'video'; // بدون صدا
                else if (f.vcodec === 'none' && f.acodec !== 'none') type = 'audio'; // فقط صدا

                // جلوگیری از فرمت‌های تکراری
                const uniqueKey = `${type}-${f.height || f.format_note}-${f.ext}`;
                if (seenQualities.has(uniqueKey)) return;
                seenQualities.add(uniqueKey);

                let size = 'نامشخص';
                if (f.filesize) size = `${(f.filesize / 1024 / 1024).toFixed(1)} MB`;
                else if (f.filesize_approx) size = `~${(f.filesize_approx / 1024 / 1024).toFixed(1)} MB`;

                allFormats.push({
                    itag: f.format_id,
                    type: type,
                    quality: f.resolution || (f.height ? `${f.height}p` : (f.format_note || 'نامشخص')),
                    ext: f.ext,
                    size: size,
                    fps: f.fps || '',
                    note: f.format_note || ''
                });
            });
        }

        // مرتب‌سازی هوشمند
        allFormats.sort((a, b) => {
            const order = { muxed: 1, video: 2, audio: 3 };
            if (order[a.type] !== order[b.type]) return order[a.type] - order[b.type];
            if (a.type === 'audio') return (parseInt(b.note) || 0) - (parseInt(a.note) || 0);
            return (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0);
        });

        let thumbnail = data.thumbnail || '';
        if (data.thumbnails && data.thumbnails.length > 0) thumbnail = data.thumbnails[data.thumbnails.length - 1].url;

        res.json({ 
            status: 'ok',
            title: data.title || 'Media',
            thumbnail: thumbnail,
            duration: data.duration || 0,
            uploader: data.uploader || data.channel || 'نامشخص',
            formats: allFormats,
            sessionId: sessionId,
            sourceUrl: url
        });

    } catch (error) {
        console.error('EXTRACT_ERROR:', error.stderr || error.message);
        if (fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath);
        res.status(500).json({ status: 'error', message: 'خطا در پردازش: ' + ((error.stderr || error.message) + '').slice(0, 100) });
    }
});

// ۲. مسیر استریم و دانلود
app.get('/api/stream/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const itag = req.query.itag;
    const url = req.query.url;
    const type = req.query.type; 
    const cookiePath = path.join(tmpDir, `${sessionId}.txt`);

    if (!url) return res.status(400).send('Missing URL');
    
    let opts = { ...BASE, quiet: true };
    if (fs.existsSync(cookiePath)) opts.cookies = cookiePath;

    if (type === 'mp3') {
        // تنظیمات تبدیل به MP3
        opts.format = 'bestaudio/best';
        opts.extractAudio = true;
        opts.audioFormat = 'mp3';
        opts.audioQuality = '0'; 
        opts.output = '-';
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="audio.mp3"`);
    } else {
        // دانلود مستقیم فرمت
        opts.format = itag;
        opts.output = '-';
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="media-${itag}.${type === 'audio' ? 'm4a' : 'mp4'}"`);
    }

    try {
        const p = youtubedl.exec(url, opts);
        p.catch(() => {}); 
        
        res.on('close', () => {
            try { p.kill('SIGKILL'); } catch (e) {}
            if (fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath);
        });

        p.stdout.pipe(res);
    } catch (error) {
        if (!res.headersSent) res.status(500).end();
    }
});

app.get('/', (req, res) => res.send('✅ Dokman V9 is Live!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
