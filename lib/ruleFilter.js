const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function loadKeywords() {
  const filePath = path.join(__dirname, '..', 'data', 'keywords.yaml');
  return yaml.load(fs.readFileSync(filePath, 'utf-8'));
}

function contextAt(text, index, matchLen, radius = 40) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + matchLen + radius);
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
}

function contextOf(text, keyword, radius = 40) {
  const idx = text.indexOf(keyword);
  return idx === -1 ? '' : contextAt(text, idx, keyword.length, radius);
}

function matchKeywords(text, keywords, category, reasonFn) {
  const violations = [];
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      violations.push({
        category,
        source: 'rule',
        matched: keyword,
        context: contextOf(text, keyword),
        reason: reasonFn(keyword),
      });
    }
  }
  return violations;
}

function matchPatterns(text, patterns, category, reasonFn) {
  const violations = [];
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'i');
    const m = regex.exec(text);
    if (m) {
      violations.push({
        category,
        source: 'rule',
        matched: m[0],
        context: contextAt(text, m.index, m[0].length),
        reason: reasonFn(pattern),
      });
    }
  }
  return violations;
}

function runRuleFilter(text) {
  const kw = loadKeywords();
  const violations = [];

  // 글자수 검사 (공백 제외)
  const charCount = text.replace(/\s/g, '').length;
  if (charCount < kw.min_chars_no_space) {
    violations.push({
      category: '글자수 미달',
      source: 'rule',
      matched: `${charCount}자 (공백 제외)`,
      context: '',
      reason: `최소 기준(${kw.min_chars_no_space}자, 공백 제외) 미달`,
    });
  }

  // 학습 무관 키워드
  violations.push(
    ...matchKeywords(text, kw.nonstudy_keywords, '학습무관', (k) => `학습 무관 키워드 "${k}" 감지`)
  );

  // 1:1 유도 문구
  violations.push(
    ...matchKeywords(text, kw.ask_keywords, '1:1 유도', (k) => `1:1 질문 유도 문구 "${k}" 감지`)
  );

  // 개인정보(PII) — 복수 매칭 허용
  for (const [type, pattern] of Object.entries(kw.pii)) {
    const regex = new RegExp(pattern, 'gi');
    let m;
    while ((m = regex.exec(text)) !== null) {
      violations.push({
        category: '개인정보노출',
        source: 'rule',
        matched: m[0],
        context: contextAt(text, m.index, m[0].length),
        reason: `개인정보(${type}) 패턴 감지`,
      });
    }
  }

  // 저작권
  violations.push(
    ...matchPatterns(text, kw.copyright_patterns, '저작권', () => '저작권 관련 표현 감지')
  );

  // 성인/노출
  violations.push(
    ...matchPatterns(text, kw.adult_patterns, '성인/노출', () => '성인/노출 관련 표현 감지')
  );

  // 관리자 쪽지 캡처
  violations.push(
    ...matchPatterns(text, kw.forbidden_capture, '관리자 쪽지 캡처', () => '관리자 쪽지 캡처 관련 표현 감지')
  );

  return violations;
}

module.exports = { runRuleFilter };
