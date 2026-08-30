require('dotenv').config();
const express = require('express');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Twitter API Client (OAuth 1.0a User Context)
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY || '',
  appSecret: process.env.TWITTER_API_SECRET || '',
  accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
  accessSecret: process.env.TWITTER_ACCESS_SECRET || '',
});

let postsQueue = [];

// AI Adaptation Endpoint
app.post('/api/adapt', (req, res) => {
  const { title, body, url, tags } = req.body;
  if (!title && !body) return res.status(400).json({ error: 'Title or content required.' });

  const rawTags = tags ? tags.split(',').map(t => '#' + t.trim().replace(/^#/, '')).join(' ') : '#News #BNN';
  const fullText = `${title ? title + '\n\n' : ''}${body || ''}`.trim();

  res.json({
    success: true,
    previews: {
      facebook: `${fullText}\n\nRead more: ${url || 'https://thebestnewsnetwork.com'}\n\n${rawTags}`,
      twitter: `${title || body.substring(0, 150)}\n\n${url || ''} ${rawTags}`.slice(0, 275),
      linkedin: `📰 BREAKING: ${title}\n\n${body}\n\nSource: ${url || 'https://thebestnewsnetwork.com'}\n\n${rawTags}`,
      instagram: `${title}\n.\n.\n${body}\n.\n.\n${rawTags}`,
      tiktok: `${title} ${rawTags}`,
      youtube: {
        title: (title || 'News Update').slice(0, 95),
        description: `${body}\n\n${url || 'https://thebestnewsnetwork.com'} #Shorts ${rawTags}`
      }
    }
  });
});

// Live Multi-Platform Dispatch
app.post('/api/publish', async (req, res) => {
  const { platforms, payload } = req.body;
  const dispatchResults = {};

  // 1. Dispatch to X (Twitter)
  if (platforms.includes('X') && payload?.twitter) {
    try {
      if (!process.env.TWITTER_API_KEY) {
        throw new Error('Twitter API credentials not configured in environment.');
      }
      const tweet = await twitterClient.v2.tweet(payload.twitter);
      dispatchResults.X = { status: 'Success', tweetId: tweet.data.id };
    } catch (err) {
      dispatchResults.X = { status: 'Failed', error: err.data || err.message || err };
    }
  }

  // Record dispatch log
  const newPost = {
    id: 'post_' + Date.now(),
    platforms,
    results: dispatchResults,
    status: Object.values(dispatchResults).some(r => r.status === 'Success') ? 'Published' : 'Completed (Simulated/Logged)',
    createdAt: new Date().toISOString()
  };

  postsQueue.unshift(newPost);
  res.json({ success: true, post: newPost });
});

app.get('/api/queue', (req, res) => {
  res.json({ success: true, queue: postsQueue });
});

// UI Dashboard Route
app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8"><title>BNN Social Hub</title>
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
      <section class="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 class="text-sm font-semibold border-b border-slate-800 pb-2">Master Article Input</h2>
        <input id="title" type="text" placeholder="Headline / Story Title" class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500" />
        <textarea id="body" rows="4" placeholder="Story text / Summary..." class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"></textarea>
        <div class="grid grid-cols-2 gap-3">
          <input id="url" type="url" placeholder="Article Link" class="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500" />
          <input id="tags" type="text" placeholder="Tags (e.g. Breaking, Tech)" class="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500" />
        </div>
        <button onclick="generateAdaptations()" class="w-full bg-indigo-600 hover:bg-indigo-500 font-semibold py-2.5 rounded-lg text-sm transition">⚡ Generate Tailored Post</button>
      </section>

      <section class="lg:col-span-6 space-y-4 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 class="text-sm font-semibold border-b border-slate-800 pb-2">Target Channels</h2>
        <div class="grid grid-cols-3 gap-2 text-xs">
          <label class="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-lg"><input type="checkbox" id="chk-tw" checked class="text-indigo-600 rounded"><span>𝕏 (Twitter)</span></label>
          <label class="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-lg"><input type="checkbox" id="chk-fb" class="text-indigo-600 rounded"><span>Facebook</span></label>
          <label class="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-lg"><input type="checkbox" id="chk-li" class="text-indigo-600 rounded"><span>LinkedIn</span></label>
        </div>
        <div>
          <label class="text-xs text-slate-400 font-bold uppercase">X Post Preview (Editable):</label>
          <textarea id="tw-preview" rows="3" class="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"></textarea>
        </div>
        <button onclick="publishContent()" id="btn-publish" class="w-full bg-emerald-600 hover:bg-emerald-500 font-semibold py-2.5 rounded-lg text-sm transition">🚀 Dispatch Now</button>
      </section>

      <section class="lg:col-span-12 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 class="text-sm font-semibold border-b border-slate-800 pb-2 mb-3">Dispatch Activity</h2>
        <div id="queue-list" class="space-y-2 text-xs"></div>
      </section>
    </main>

    <script>
      let currentPreviews = {};

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

        try {
          const res = await fetch('/api/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platforms, payload: currentPreviews })
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
              <div>
                <span class="font-bold text-indigo-400">\${item.platforms.join(', ')}</span>
                <span class="text-slate-500 ml-2">\${new Date(item.createdAt).toLocaleTimeString()}</span>
                \${item.results?.X?.tweetId ? '<span class="ml-2 text-sky-400">Tweet ID: ' + item.results.X.tweetId + '</span>' : ''}
                \${item.results?.X?.error ? '<span class="ml-2 text-rose-400 font-mono">Error: ' + JSON.stringify(item.results.X.error) + '</span>' : ''}
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
