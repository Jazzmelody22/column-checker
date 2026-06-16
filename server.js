require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { extractTextFromUrl } = require('./lib/extractText');
const { runRuleFilter } = require('./lib/ruleFilter');
const { runAiCheck } = require('./lib/aiCheck');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE_PASSWORD = process.env.SITE_PASSWORD;

if (!SITE_PASSWORD) {
  console.error('오류: SITE_PASSWORD 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.');
  process.exit(1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || SITE_PASSWORD,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' },
  })
);

// 로그인 페이지에서 사용하는 CSS는 인증 없이 제공
app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'style.css'));
});

// 로그인 라우트
app.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  if (req.body.password === SITE_PASSWORD) {
    req.session.authenticated = true;
    return res.redirect('/');
  }
  res.redirect('/login?error=1');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// 인증 미들웨어 — 아래 모든 라우트에 적용
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  return res.redirect('/login');
}

app.use(requireAuth);

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/check', async (req, res) => {
  const { type, content } = req.body;

  if (!type || !content || !content.trim()) {
    return res.status(400).json({ error: '입력값이 없습니다.' });
  }

  let text;
  if (type === 'url') {
    try {
      text = await extractTextFromUrl(content.trim());
    } catch (err) {
      return res.status(422).json({ error: err.message });
    }
  } else {
    text = content.trim();
  }

  let ruleViolations = [];
  try {
    ruleViolations = runRuleFilter(text);
  } catch (err) {
    return res.status(500).json({ error: `규칙 검사 오류: ${err.message}` });
  }

  let aiViolations = [];
  try {
    aiViolations = await runAiCheck(text);
  } catch (err) {
    return res.status(500).json({ error: `AI 검사 오류: ${err.message}` });
  }

  const violations = [...ruleViolations, ...aiViolations];
  const overall = violations.length === 0 ? '적합' : '부적합';

  res.json({ overall, violations });
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
