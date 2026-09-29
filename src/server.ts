
// Fisher-Yates shuffle for true uniform randomness under high-frequency simulations
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { marked } from 'marked';
import { getDatabase } from './db/database';
import { runSeed } from './db/seed';
import { BookingService } from './services/booking-service';
import { RosterService } from './services/roster-service';
import { RosterExportService } from './utils/roster-export';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(__dirname, '../public')));

// Initialize DB & Seed if empty
const db = getDatabase();
const classCount = db.prepare('SELECT COUNT(*) as count FROM trial_classes').get() as { count: number };
if (classCount.count === 0) {
  runSeed();
}

const bookingService = new BookingService(db);
const rosterService = new RosterService(db);

// API: List classes with availability
app.get('/api/classes', (req: Request, res: Response) => {
  const classes = rosterService.getAllClasses();
  res.json(classes);
});

// API: Reset dataset to initial clean state
app.post('/api/reset-seed', (req: Request, res: Response) => {
  runSeed();
  res.json({ message: 'Database reset to clean seed state successfully! Mars Rover Physics is reset to 3/4 confirmed students (1 seat remaining).' });
});

// API: Get Roster for a class (JSON)
app.get('/api/roster/:classId', (req: Request, res: Response) => {
  try {
    const roster = rosterService.getClassRoster(req.params.classId);
    res.json(roster);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// API: Teacher Roster Export (Clean Markdown Table)
app.get('/api/roster/:classId/markdown', (req: Request, res: Response) => {
  try {
    const roster = rosterService.getClassRoster(req.params.classId);
    const md = RosterExportService.rosterToFormattedMarkdown(roster);
    res.type('text/markdown').send(md);
  } catch (err: any) {
    res.status(404).send('Error: ' + err.message);
  }
});

// API: Teacher Roster Export Alias (/export)
app.get('/api/roster/:classId/export', (req: Request, res: Response) => {
  try {
    const roster = rosterService.getClassRoster(req.params.classId);
    const md = RosterExportService.rosterToFormattedMarkdown(roster);
    res.type('text/markdown').send(md);
  } catch (err: any) {
    res.status(404).send('Error: ' + err.message);
  }
});

// API: Book trial class (Standard 1-user flow)
app.post('/api/bookings', async (req: Request, res: Response) => {
  try {
    const result = await bookingService.bookTrialClass(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Multi-Mode Concurrency Simulator
app.post('/api/simulate-race', async (req: Request, res: Response) => {
  try {
    const mode = req.query.mode === 'peak_rush' ? 'peak_rush' : 'two_users';
    const targetClassId = (req.query.class_id as string) || 'tc_race_seat';
    const shouldReset = req.query.reset === 'true' || targetClassId === 'tc_race_seat';

    // If testing canonical race seat, ensure clean initial state
    if (shouldReset) {
      runSeed();
    }

    const trialClass = db.prepare('SELECT * FROM trial_classes WHERE id = ?').get(targetClassId) as any;
    if (!trialClass) {
      return res.status(404).json({ error: 'Target class not found: ' + targetClassId });
    }

    const getFormattedTime = () => new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS

    if (mode === 'two_users') {
      const overallStart = Date.now();

      // Dynamic candidate pool of diverse families for realistic unscripted simulation
      const familyPool = [
        { parent_id: 'p_rachel', student_id: 's_chloe', parent: 'Rachel Green', student: 'Chloe Green', age: 7 },
        { parent_id: 'p_kevin', student_id: 's_noah', parent: 'Kevin Zhao', student: 'Noah Zhao', age: 8 },
        { parent_id: 'p_marcus', student_id: 's_lucas', parent: 'Marcus Vance', student: 'Lucas Vance', age: 10 },
        { parent_id: 'p_elena', student_id: 's_sophia', parent: 'Elena Rostova', student: 'Sophia Rostova', age: 8 },
        { parent_id: 'p_tariq', student_id: 's_aisha', parent: 'Tariq Mansoor', student: 'Aisha Mansoor', age: 11 },
        { parent_id: 'p_sarah_sim', student_id: 's_liam', parent: 'Sarah Connor', student: 'Liam Connor', age: 9 },
        { parent_id: 'p_james', student_id: 's_ethan', parent: 'James Wilson', student: 'Ethan Wilson', age: 8 },
        { parent_id: 'p_clark_sim', student_id: 's_jonathan', parent: 'Clark Kent', student: 'Jonathan Kent', age: 9 },
      ];

      // Randomly shuffle and select two distinct competing families
      const shuffled = shuffleArray(familyPool);
      const candA = shuffled[0];
      const candB = shuffled[1];

      // Ensure parents and students exist in database
      const pStmt = db.prepare('INSERT OR IGNORE INTO parents (id, name, email) VALUES (?, ?, ?)');
      const sStmt = db.prepare('INSERT OR IGNORE INTO students (id, parent_id, name, age) VALUES (?, ?, ?, ?)');

      pStmt.run(candA.parent_id, candA.parent, candA.student_id + '@family.test');
      sStmt.run(candA.student_id, candA.parent_id, candA.student, candA.age);

      pStmt.run(candB.parent_id, candB.parent, candB.student_id + '@family.test');
      sStmt.run(candB.student_id, candB.parent_id, candB.student, candB.age);

      // Launch User A & User B concurrently
      const [userA, userB] = await Promise.all([
        (async () => {
          const t0 = Date.now();
          const timestamp = getFormattedTime();
          const res = await bookingService.bookTrialClass({
            trial_class_id: targetClassId,
            student_id: candA.student_id,
            parent_id: candA.parent_id,
            payment_token: 'tok_success',
            idempotency_key: 'live_race_' + candA.student_id + '_' + Date.now(),
          });
          return {
            user_label: `User A: ${candA.parent} (Child: ${candA.student}, Age ${candA.age})`,
            timestamp,
            latency_ms: Date.now() - t0,
            status: res.status,
            success: res.success,
            refund_issued: res.refund_issued || false,
            message: res.message
          };
        })(),
        (async () => {
          const t0 = Date.now();
          const timestamp = getFormattedTime();
          const res = await bookingService.bookTrialClass({
            trial_class_id: targetClassId,
            student_id: candB.student_id,
            parent_id: candB.parent_id,
            payment_token: 'tok_success',
            idempotency_key: 'live_race_' + candB.student_id + '_' + Date.now(),
          });
          return {
            user_label: `User B: ${candB.parent} (Child: ${candB.student}, Age ${candB.age})`,
            timestamp,
            latency_ms: Date.now() - t0,
            status: res.status,
            success: res.success,
            refund_issued: res.refund_issued || false,
            message: res.message
          };
        })()
      ]);

      const finalRoster = rosterService.getClassRoster(targetClassId);

      return res.json({
        mode: 'Two Users Competing for Seat (Ottodot Scenario)',
        target_class: trialClass.title,
        target_class_id: targetClassId,
        capacity: trialClass.capacity,
        concurrency_count: 2,
        dispatch_window_ms: Math.abs((userA.latency_ms || 0) - (userB.latency_ms || 0)),
        results: [userA, userB],
        final_roster_count: finalRoster.total_confirmed,
        final_available_seats: finalRoster.available_seats,
        invariants_preserved: finalRoster.total_confirmed <= trialClass.capacity,
      });
    } else {
      // 10 Realistic Parent Bots Hammering the System
      const botProfiles = [
        { bot_id: 'bot_01', parent: 'Sarah Connor', student: 'John Connor', age: 10 },
        { bot_id: 'bot_02', parent: 'Prof. Charles Xavier', student: 'Jean Grey', age: 9 },
        { bot_id: 'bot_03', parent: 'Bruce Wayne', student: 'Dick Grayson', age: 11 },
        { bot_id: 'bot_04', parent: 'Tony Stark', student: 'Peter Parker', age: 10 },
        { bot_id: 'bot_05', parent: 'Diana Prince', student: 'Donna Troy', age: 8 },
        { bot_id: 'bot_06', parent: 'Clark Kent', student: 'Jon Kent', age: 9 },
        { bot_id: 'bot_07', parent: 'Arthur Curry', student: 'Kaldur Ahm', age: 12 },
        { bot_id: 'bot_08', parent: 'Barry Allen', student: 'Wally West', age: 10 },
        { bot_id: 'bot_09', parent: 'Hal Jordan', student: 'Kyle Rayner', age: 11 },
        { bot_id: 'bot_10', parent: 'Oliver Queen', student: 'Roy Harper', age: 10 },
      ];

      const parentStmt = db.prepare('INSERT OR IGNORE INTO parents (id, name, email) VALUES (?, ?, ?)');
      const studentStmt = db.prepare('INSERT OR IGNORE INTO students (id, parent_id, name, age) VALUES (?, ?, ?, ?)');

      botProfiles.forEach(b => {
        parentStmt.run(b.bot_id + '_p', b.parent, b.bot_id + '@swarm-test.com');
        studentStmt.run(b.bot_id + '_s', b.bot_id + '_p', b.student, b.age);
      });

      // Dynamically shuffle the 10 bots so arrival order varies on each run
      const randomizedBots = shuffleArray(botProfiles);

      const swarmPromises = randomizedBots.map(async (b) => {
        // Organic sub-millisecond network jitter (0-5ms)
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 6)));
        const t0 = Date.now();
        const timestamp = getFormattedTime();
        const res = await bookingService.bookTrialClass({
          trial_class_id: targetClassId,
          student_id: b.bot_id + '_s',
          parent_id: b.bot_id + '_p',
          payment_token: 'tok_success',
          idempotency_key: 'peak_rush_' + b.bot_id + '_' + Date.now() + '_' + Math.random(),
        });
        return {
          bot_id: b.bot_id,
          parent: b.parent,
          student: b.student,
          timestamp,
          latency_ms: Date.now() - t0,
          status: res.status,
          success: res.success,
          refund_issued: res.refund_issued || false,
          message: res.message
        };
      });

      const results = await Promise.all(swarmPromises);
      const confirmedCount = results.filter(r => r.success && r.status === 'confirmed').length;
      const refundedCount = results.filter(r => !r.success && r.status === 'rejected_class_full' && r.refund_issued).length;
      const finalRoster = rosterService.getClassRoster(targetClassId);

      return res.json({
        mode: 'Peak Traffic Rush Hour (10 Concurrent Parent Bots Hammering Seat)',
        target_class: trialClass.title,
        target_class_id: targetClassId,
        capacity: trialClass.capacity,
        concurrency_count: 10,
        confirmed_count: confirmedCount,
        refunded_count: refundedCount,
        final_roster_count: finalRoster.total_confirmed,
        final_available_seats: finalRoster.available_seats,
        invariants_preserved: finalRoster.total_confirmed <= trialClass.capacity,
        details: results
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to render markdown files cleanly with Dark/Light Mode
function serveMarkdownFile(filename: string, title: string) {
  return (req: Request, res: Response) => {
    const filePath = path.resolve(__dirname, '../', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found: ' + filename);
    }
    const rawContent = fs.readFileSync(filePath, 'utf8');
    
    // If requested with ?raw=true or curl, send raw markdown
    if (req.query.raw === 'true' || !req.headers.accept?.includes('text/html')) {
      return res.type('text/markdown; charset=utf-8').send(rawContent);
    }

    // Parse Markdown to HTML via marked
    let renderedBody = marked.parse(rawContent) as string;
    renderedBody = renderedBody.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, (_, code) => {
      const decoded = code
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      return `<div class="mermaid text-center my-4 overflow-auto">${decoded}</div>`;
    });

    // Full High-Retention Dark / Light Page
    const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Ottodot Trial Booking Reliability</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    :root[data-theme="light"] {
      --bg-body: #f8fafc;
      --bg-card: #ffffff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --code-bg: #0f172a;
      --code-text: #38bdf8;
      --table-head: #f1f5f9;
      --blockquote-bg: #eff6ff;
      --blockquote-border: #3b82f6;
      --link-color: #2563eb;
    }
    :root[data-theme="dark"] {
      --bg-body: #0b0f19;
      --bg-card: #151d30;
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --border-color: #243048;
      --code-bg: #060911;
      --code-text: #7dd3fc;
      --table-head: #1c273e;
      --blockquote-bg: #13233e;
      --blockquote-border: #60a5fa;
      --link-color: #60a5fa;
    }
    body {
      background-color: var(--bg-body);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.68;
      transition: background-color 0.25s ease, color 0.25s ease;
    }
    .doc-container {
      max-width: 920px;
      margin: 25px auto;
      background: var(--bg-card);
      padding: 38px 46px;
      border-radius: 14px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      border: 1px solid var(--border-color);
      transition: background-color 0.25s ease, border-color 0.25s ease;
    }
    h1, h2, h3, h4 {
      color: var(--text-main);
      font-weight: 700;
      margin-top: 1.6rem;
      margin-bottom: 0.8rem;
    }
    h1 {
      border-bottom: 2px solid var(--border-color);
      padding-bottom: 10px;
      font-size: 1.85rem;
    }
    h2 {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 8px;
      font-size: 1.4rem;
    }
    h3 { font-size: 1.15rem; }
    p, li { color: var(--text-main); font-size: 1rem; }
    .text-muted { color: var(--text-muted) !important; }
    blockquote {
      border-left: 4px solid var(--blockquote-border);
      padding: 12px 18px;
      background: var(--blockquote-bg);
      border-radius: 0 8px 8px 0;
      margin: 16px 0;
      color: var(--text-main);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      border: 1px solid var(--border-color);
    }
    th, td {
      border: 1px solid var(--border-color);
      padding: 10px 14px;
      text-align: left;
    }
    th {
      background-color: var(--table-head);
      font-weight: 600;
    }
    pre {
      background: var(--code-bg);
      color: var(--code-text);
      padding: 14px 18px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'Cascadia Code', Consolas, monospace;
      font-size: 0.9rem;
      border: 1px solid var(--border-color);
      margin: 14px 0;
    }
    code:not(pre code) {
      background: var(--code-bg);
      color: var(--code-text);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Cascadia Code', Consolas, monospace;
      font-size: 0.88rem;
    }
    a { color: var(--link-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .theme-toggle-btn {
      border: 1px solid var(--border-color);
      background: var(--bg-card);
      color: var(--text-main);
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }
    .theme-toggle-btn:hover {
      opacity: 0.9;
      transform: scale(1.02);
    }
  </style>
</head>
<body class="py-3">
  <div class="container">
    <div class="doc-container">
      
      <!-- Top Action Bar -->
      <div class="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-2" style="border-color: var(--border-color) !important;">
        <div>
          <a href="/" class="btn btn-sm btn-outline-secondary">&larr; Back to App Dashboard</a>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button class="theme-toggle-btn" onclick="toggleTheme()">
            <span id="themeIcon">☀️</span> <span id="themeLabel">Light Mode</span>
          </button>
          <a href="/${filename}?raw=true" class="btn btn-sm btn-outline-primary">Raw .md</a>
          <a href="https://github.com/iRIANDI/ottodot-trial-booking/blob/main/${filename}" target="_blank" class="btn btn-sm btn-primary">View on GitHub</a>
        </div>
      </div>

      <!-- Rendered Markdown Content -->
      <div class="markdown-body">
        ${renderedBody}
      </div>

    </div>
  </div>

  <script>
    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('ottodot_theme', theme);
      const isDark = theme === 'dark';
      document.getElementById('themeIcon').innerText = isDark ? '☀️' : '🌙';
      document.getElementById('themeLabel').innerText = isDark ? 'Light Mode' : 'Dark Mode';
    }

    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    }

    // Initialize from saved preference, default to dark for optimal reading comfort
    const saved = localStorage.getItem('ottodot_theme') || 'dark';
    applyTheme(saved);
  </script>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    mermaid.initialize({
      startOnLoad: true,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose'
    });
  </script>
</body>
</html>`;
    res.type('text/html').send(html);
  };
}

// Serve documentation markdown endpoints
app.get('/SMART_GUIDE.md', serveMarkdownFile('SMART_GUIDE.md', 'Smart Guide (AI Steering & Invariants)'));
app.get('/README.md', serveMarkdownFile('README.md', 'Technical Documentation'));
app.get('/AI_USAGE.md', serveMarkdownFile('AI_USAGE.md', 'AI Usage & Reflection'));
app.get('/AGENTS.md', serveMarkdownFile('AGENTS.md', 'Agent Constitution & Rules'));

// Serve Dashboard
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

app.listen(port, () => {
  console.log('Ottodot Trial Booking Server running on http://localhost:' + port);
});
