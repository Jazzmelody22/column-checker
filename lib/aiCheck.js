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
발견된 위반 사항과, 전체 콘텐츠에 대한 요약을 아래 JSON 형식으로만 응답하세요. 다른 설명, 마크다운, 추가 텍스트는 포함하지 마세요.
{
  "summary": {
    "studyRelatedPercent": 0,
    "category": "콘텐츠의 성격을 한 단어/짧은 구로 표현 (예: 문제풀이형, 동기부여형, 정보전달형, 일상형, 후기형 등 자유롭게 판단)",
    "comment": "전체 내용에 대한 한 줄 종합 의견",
    "contentSummary": "실제로 어떤 내용을 다루는지 구체적으로 서술 (예: 무슨 과목/문제를 어떻게 풀이하는지, 어떤 부분이 몇 % 정도 비중으로 포함되어 있는지 등을 구체적으로)"
  },
  "violations": [{"category":"텍스트 분석 또는 법적/윤리적 문제 또는 커뮤니티 가이드라인 위반","matched":"감지된 표현","context":"해당 문장 발췌(짧게)","reason":"위반 판단 근거"}]
}
studyRelatedPercent는 전체 내용 중 학습(공부법, 문제풀이, 강의 후기, 동기부여 등 학습 관련) 내용이 차지하는 비율을 0~100 사이의 정수로 추정해 넣으세요.
contentSummary는 "수학 미적분 수능 기출 2025학년도 6번 문제를 손으로 3가지 버전으로 풀어주고 있고, 하단에 본인이 대학에서 먹는 음식 소개가 30% 정도 길이로 포함되어 있음"처럼, 실제로 어떤 내용이 어떤 비중으로 들어있는지 구체적으로 설명하세요. 추상적인 표현(예: "학습 콘텐츠임") 대신 과목, 주제, 문제 번호, 풀이 방식, 부가 내용의 종류와 대략적인 비중을 구체적으로 적으세요.
위반 항목이 없으면 violations 배열을 비워두고, summary는 항상 채워주세요.`;
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

const violations = (parsed.violations || []).map((v) => ({ ...v, source: 'ai' }));
  const summary = parsed.summary || null;
  return { violations, summary };
}


module.exports = { runAiCheck };
