const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send(`
    <div style="font-family:sans-serif; text-align:center; padding-top:50px;">
      <h1>BNN Social Command Center</h1>
      <p style="color: green; font-weight: bold;">Status: Online & Ready</p>
    </div>
  `);
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'active', timestamp: new Date() });
});

app.listen(port, () => {
  console.log(`BNN Social Hub running on port ${port}`);
});
