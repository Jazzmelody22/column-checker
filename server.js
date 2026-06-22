require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { extractTextFromUrl } = require('./lib/extractText');
const { runRuleFilter } = require('./lib/ruleFilter');
const { runAiCheck } = require('./lib/aiCheck');
const { runImageCheck } = require('./lib/imageCheck');

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
  let imageUrls = [];
  let title = '';  

  if (type === 'url') {
    try {
      // ✅ { text, imageUrls } 구조로 받기
      ({ text, imageUrls, title } = await extractTextFromUrl(content.trim()));
    } catch (err) {
      return res.status(422).json({ error: err.message });
    }
  } else {
    text = content.trim();
    // 직접 입력은 이미지 없음
  }

  // 텍스트 규칙 검사
  let ruleViolations = [];
  try {
    ruleViolations = runRuleFilter(text);
  } catch (err) {
    return res.status(500).json({ error: `규칙 검사 오류: ${err.message}` });
  }

  // 텍스트 AI 검사
  let aiResult = { violations: [], summary: null };
  try {
    aiResult = await runAiCheck(text);
  } catch (err) {
    return res.status(500).json({ error: `AI 검사 오류: ${err.message}` });
  }

  // ✅ 이미지 검사 (URL 입력 + 이미지 존재 시)
  let imageResults = [];
  if (type === 'url' && imageUrls.length > 0) {
    try {
      imageResults = await runImageCheck(imageUrls);
    } catch (err) {
      // 이미지 검사 실패해도 텍스트 결과는 반환
      imageResults = [{ error: `이미지 검사 오류: ${err.message}` }];
    }
  }

  const violations = [...ruleViolations, ...aiResult.violations];
  const hasHarmfulImage = imageResults.some((r) => r.harmful);
  const overall =
    violations.length === 0 && !hasHarmfulImage ? '적합' : '부적합';

  res.json({ overall, violations, summary: aiResult.summary, imageResults, title });
});

const { generateMessage } = require('./lib/messageGen');

app.post('/api/message', async (req, res) => {
  const { title, messageType, violations, imageResults } = req.body;
  if (!messageType) return res.status(400).json({ error: '쪽지 유형을 선택하세요.' });
  try {
    const message = await generateMessage({ title, messageType, violations, imageResults });
    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: `쪽지 생성 오류: ${err.message}` });
  }
});


app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
