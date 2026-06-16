const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function buildSystemPrompt() {
  const filePath = path.join(__dirname, '..', 'data', 'prompts.yaml');
  const { default_prompt } = yaml.load(fs.readFileSync(filePath, 'utf-8'));

  // prompts.yaml의 텍스트 응답 형식 안내를 제거하고 JSON 형식으로 대체
  let base = default_prompt;
  const cutIdx = base.indexOf('## 응답 형식');
  if (cutIdx !== -1) base = base.slice(0, cutIdx).trimEnd();

  return `${base}

## 출력 형식 (JSON 필수)
이미지 분석(### 1)은 텍스트만 다루므로 제외합니다.
텍스트 기반 항목(### 2 텍스트 분석, ### 3 법적/윤리적 문제, ### 4 커뮤니티 가이드라인 위반)에서
발견된 위반 사항을 아래 JSON 형식으로만 응답하세요. 다른 설명, 마크다운, 추가 텍스트는 포함하지 마세요.

{"violations":[{"category":"텍스트 분석 또는 법적/윤리적 문제 또는 커뮤니티 가이드라인 위반","matched":"감지된 표현","context":"해당 문장 발췌(짧게)","reason":"위반 판단 근거"}]}

위반 항목이 없으면 violations 배열을 비워두세요.`;
}

function parseAiResponse(raw) {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(text);
}

async function runAiCheck(text) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: buildSystemPrompt(),
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  let raw;
  try {
    const result = await model.generateContent(`다음 본문을 검사하세요:\n\n${text}`);
    raw = result.response.text();
  } catch (err) {
    throw new Error(`Gemini API 호출 실패: ${err.message}`);
  }

  let parsed;
  try {
    parsed = parseAiResponse(raw);
  } catch {
    throw new Error(`AI 응답 파싱 실패. 원본 응답: ${raw.slice(0, 200)}`);
  }

  return (parsed.violations || []).map((v) => ({ ...v, source: 'ai' }));
}

module.exports = { runAiCheck };
