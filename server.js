require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
const port = process.env.PORT || 3000;

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY || '',
  appSecret: process.env.TWITTER_API_SECRET || '',
  accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
  accessSecret: process.env.TWITTER_ACCESS_SECRET || '',
});

let postsQueue = [];

// 1. File Upload Route
app.post('/api/upload', upload.single('mediaFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

// 2. AI Image Generator Endpoint
app.post('/api/generate-image', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });

  // Connect your preferred Image Generation API (e.g. OpenAI DALL-E, Stability, or pollinations.ai free tier)
  // Defaulting to a high-res generation via instant generative CDN:
  const encodedPrompt = encodeURIComponent(prompt.trim() + ' news editorial style 8k photorealistic');
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1200&height=675&nologo=true`;

  res.json({ success: true, url: imageUrl });
});

// 3. AI Text Adaptation Endpoint
app.post('/api/adapt', (req, res) => {
  const { title, body, url, tags } = req.body;
  if (!title && !body) return res.status(400).json({ error: 'Title or content required.' });

  const rawTags = tags ? tags.split(',').map(t => '#' + t.trim().replace(/^#/, '')).join(' ') : '#News #BNN';
  const fullText = `${title ? title + '\n\n' : ''}${body || ''}`.trim();

  res.json({
    success: true,
    previews: {
      facebook: `${fullText}\n\nRead more: ${url || 'https://thebestnewsnetwork.com'}\n\n${rawTags}`,
      twitter: `${title || body.substring(0, 140)}\n\n${url || ''} ${rawTags}`.slice(0, 275),
      linkedin: `📰 BREAKING: ${title}\n\n${body}\n\nFull coverage: ${url || 'https://thebestnewsnetwork.com'}\n\n${rawTags}`,
      instagram: `${title}\n.\n.\n${body}\n.\n.\n${rawTags}`,
      tiktok: `${title} ${rawTags}`,
      youtube: {
        title: (title || 'News Update').slice(0, 95),
        description: `${body}\n\n${url || 'https://thebestnewsnetwork.com'} #Shorts ${rawTags}`
      }
    }
  });
});

// 4. Publish Endpoint
app.post('/api/publish', async (req, res) => {
  const { platforms, payload, mediaUrl } = req.body;
  const dispatchResults = {};

  if (platforms.includes('X') && payload?.twitter) {
    try {
      if (!process.env.TWITTER_API_KEY) throw new Error('Twitter API credentials not configured.');
      const tweet = await twitterClient.v2.tweet(payload.twitter);
      dispatchResults.X = { status: 'Success', tweetId: tweet.data.id };
    } catch (err) {
      dispatchResults.X = { status: 'Failed', error: err.data || err.message || err };
    }
  }

  const newPost = {
    id: 'post_' + Date.now(),
    platforms,
    mediaUrl: mediaUrl || null,
    results: dispatchResults,
    status: Object.values(dispatchResults).some(r => r.status === 'Success') ? 'Published' : 'Completed (Simulated/Logged)',
    createdAt: new Date().toISOString()
  };

  postsQueue.unshift(newPost);
  res.json({ success: true, post: newPost });
});

app.get('/api/queue', (req, res) => res.json({ success: true, queue: postsQueue }));

// 5. Dashboard Frontend
app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8"><title>BNN Social Command Center</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-slate-950 text-slate-100 min-h-screen">
    <header class="border-b border-slate-800 bg-slate-900 px-6 py-4 flex justify-between items-center">
      <div class="flex items-center space-x-3">
        <span class="bg-indigo-600 text-xs px-2.5 py-1 rounded font-bold uppercase">BNN Hub</span>
        <h1 class="text-base font-bold">Cross-Platform Distribution</h1>
      </div>
      <div class="text-xs text-slate-400">social.thebestnewsnetwork.com</div>
    </header>

    <main class="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Content & Media Input Panel -->
      <section class="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 class="text-sm font-semibold border-b border-slate-800 pb-2">1. Story & Media Input</h2>
        
        <div>
          <label class="text-xs text-slate-400 font-medium">Headline</label>
          <input id="title" type="text" placeholder="Headline / Story Title" class="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500" />
        </div>

        <div>
          <label class="text-xs text-slate-400 font-medium">Article Content / Summary</label>
          <textarea id="body" rows="3" placeholder="Story text / Summary..." class="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"></textarea>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-slate-400 font-medium">Article URL</label>
            <input id="url" type="url" placeholder="https://thebestnewsnetwork.com/..." class="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label class="text-xs text-slate-400 font-medium">Tags</label>
            <input id="tags" type="text" placeholder="AI, Tech, Breaking" class="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500" />
          </div>
        </div>

        <!-- Image Management Box -->
        <div class="border border-slate-800 bg-slate-950 rounded-lg p-3 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-300">Featured Media</span>
            <div class="flex gap-2">
              <button onclick="setMediaMode('upload')" id="tab-upload" class="px-2.5 py-1 text-[11px] rounded bg-indigo-600 text-white font-semibold">Upload File</button>
              <button onclick="setMediaMode('generate')" id="tab-gen" class="px-2.5 py-1 text-[11px] rounded bg-slate-800 text-slate-300 font-semibold">✨ AI Generate</button>
            </div>
          </div>

          <!-- Upload View -->
          <div id="view-upload" class="space-y-2">
            <input type="file" id="media-file" accept="image/*,video/*" class="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer" />
            <button onclick="uploadMediaFile()" class="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded font-medium text-slate-200">Upload to Server</button>
          </div>

          <!-- AI Generation View -->
          <div id="view-gen" class="space-y-2 hidden">
            <input id="img-prompt" type="text" placeholder="Image description (or auto-built from title)..." class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500" />
            <button onclick="generateAIImage()" id="btn-gen-img" class="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs rounded font-medium text-white">✨ Generate Visual</button>
          </div>

          <!-- Media Preview Container -->
          <div id="media-preview-box" class="hidden relative rounded overflow-hidden border border-slate-800 max-h-48 bg-slate-900 flex items-center justify-center">
            <img id="active-media-preview" src="" alt="Post Visual" class="w-full h-auto object-cover max-h-48" />
            <button onclick="clearMedia()" class="absolute top-2 right-2 bg-rose-600/80 hover:bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded">Remove</button>
          </div>
        </div>

        <button onclick="generateAdaptations()" class="w-full bg-indigo-600 hover:bg-indigo-500 font-semibold py-2.5 rounded-lg text-sm transition">⚡ Adapt Copy for Platforms</button>
      </section>

      <!-- Distribution Panel -->
      <section class="lg:col-span-6 space-y-4 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 class="text-sm font-semibold border-b border-slate-800 pb-2">2. Target Channels & Preview</h2>
        <div class="grid grid-cols-3 gap-2 text-xs">
          <label class="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-lg"><input type="checkbox" id="chk-tw" checked class="text-indigo-600 rounded"><span>𝕏 (Twitter)</span></label>
          <label class="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-lg"><input type="checkbox" id="chk-fb" class="text-indigo-600 rounded"><span>Facebook</span></label>
          <label class="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-lg"><input type="checkbox" id="chk-li" class="text-indigo-600 rounded"><span>LinkedIn</span></label>
        </div>

        <div>
          <label class="text-xs text-slate-400 font-bold uppercase">X Post Preview (Editable):</label>
          <textarea id="tw-preview" rows="3" class="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"></textarea>
        </div>

        <div>
          <label class="text-xs text-slate-400 font-bold uppercase">LinkedIn Preview (Editable):</label>
          <textarea id="li-preview" rows="3" class="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"></textarea>
        </div>

        <button onclick="publishContent()" id="btn-publish" class="w-full bg-emerald-600 hover:bg-emerald-500 font-semibold py-2.5 rounded-lg text-sm transition">🚀 Dispatch Now</button>
      </section>

      <!-- History -->
      <section class="lg:col-span-12 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 class="text-sm font-semibold border-b border-slate-800 pb-2 mb-3">3. Dispatch Activity</h2>
        <div id="queue-list" class="space-y-2 text-xs"></div>
      </section>
    </main>

    <script>
      let currentPreviews = {};
      let activeMediaUrl = null;

      function setMediaMode(mode) {
        document.getElementById('view-upload').classList.toggle('hidden', mode !== 'upload');
        document.getElementById('view-gen').classList.toggle('hidden', mode !== 'generate');
        document.getElementById('tab-upload').className = mode === 'upload' ? 'px-2.5 py-1 text-[11px] rounded bg-indigo-600 text-white font-semibold' : 'px-2.5 py-1 text-[11px] rounded bg-slate-800 text-slate-300 font-semibold';
        document.getElementById('tab-gen').className = mode === 'generate' ? 'px-2.5 py-1 text-[11px] rounded bg-indigo-600 text-white font-semibold' : 'px-2.5 py-1 text-[11px] rounded bg-slate-800 text-slate-300 font-semibold';
      }

      async function uploadMediaFile() {
        const fileInput = document.getElementById('media-file');
        if (!fileInput.files[0]) return alert('Select a file first.');

        const formData = new FormData();
        formData.append('mediaFile', fileInput.files[0]);

        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
          activeMediaUrl = data.url;
          displayMedia(data.url);
        }
      }

      async function generateAIImage() {
        let prompt = document.getElementById('img-prompt').value;
        if (!prompt) prompt = document.getElementById('title').value;
        if (!prompt) return alert('Enter a prompt or headline first.');

        const btn = document.getElementById('btn-gen-img');
        btn.disabled = true;
        btn.innerText = 'Generating Visual...';

        try {
          const res = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
          });
          const data = await res.json();
          if (data.success) {
            activeMediaUrl = data.url;
            displayMedia(data.url);
          }
        } finally {
          btn.disabled = false;
          btn.innerText = '✨ Generate Visual';
        }
      }

      function displayMedia(url) {
        const box = document.getElementById('media-preview-box');
        const img = document.getElementById('active-media-preview');
        img.src = url;
        box.classList.remove('hidden');
      }

      function clearMedia() {
        activeMediaUrl = null;
        document.getElementById('active-media-preview').src = '';
        document.getElementById('media-preview-box').classList.add('hidden');
        document.getElementById('media-file').value = '';
      }

      async function generateAdaptations() {
        const title = document.getElementById('title').value;
        const body = document.getElementById('body').value;
        const url = document.getElementById('url').value;
        const tags = document.getElementById('tags').value;

        const res = await fetch('/api/adapt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, body, url, tags })
        });
        const data = await res.json();
        if (data.success) {
          currentPreviews = data.previews;
          document.getElementById('tw-preview').value = currentPreviews.twitter || '';
          document.getElementById('li-preview').value = currentPreviews.linkedin || '';
        }
      }

      async function publishContent() {
        const btn = document.getElementById('btn-publish');
        btn.disabled = true;
        btn.innerText = 'Publishing...';

        const platforms = [];
        if (document.getElementById('chk-tw').checked) platforms.push('X');
        if (document.getElementById('chk-fb').checked) platforms.push('Facebook');
        if (document.getElementById('chk-li').checked) platforms.push('LinkedIn');

        currentPreviews.twitter = document.getElementById('tw-preview').value;
        currentPreviews.linkedin = document.getElementById('li-preview').value;

        try {
          await fetch('/api/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platforms, payload: currentPreviews, mediaUrl: activeMediaUrl })
          });
          await loadQueue();
        } finally {
          btn.disabled = false;
          btn.innerText = '🚀 Dispatch Now';
        }
      }

      async function loadQueue() {
        const res = await fetch('/api/queue');
        const data = await res.json();
        const list = document.getElementById('queue-list');
        if (data.queue.length > 0) {
          list.innerHTML = data.queue.map(item => \`
            <div class="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded">
              <div class="flex items-center space-x-3">
                \${item.mediaUrl ? '<img src="' + item.mediaUrl + '" class="w-10 h-10 object-cover rounded border border-slate-800"/>' : ''}
                <div>
                  <span class="font-bold text-indigo-400">\${item.platforms.join(', ')}</span>
                  <span class="text-slate-500 ml-2">\${new Date(item.createdAt).toLocaleTimeString()}</span>
                  \${item.results?.X?.tweetId ? '<span class="ml-2 text-sky-400">Tweet ID: ' + item.results.X.tweetId + '</span>' : ''}
                  \${item.results?.X?.error ? '<span class="ml-2 text-rose-400 font-mono">Error: ' + JSON.stringify(item.results.X.error) + '</span>' : ''}
                </div>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/50">\${item.status}</span>
            </div>
          \`).join('');
        }
      }
      loadQueue();
    </script>
  </body>
  </html>
  `);
});

app.listen(port, () => console.log(`BNN Social Hub running on port ${port}`));
