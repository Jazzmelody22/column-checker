const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateMessage({ title, messageType, violations, imageResults }) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const criteriaPath = path.join(__dirname, '..', 'data', 'criteria.md');
  const criteria = fs.readFileSync(criteriaPath, 'utf-8');

  const violationSummary = (violations || [])
    .map((v) => `- [${v.category}] ${v.matched}: ${v.reason}`)
    .join('\n') || '없음';

  const harmfulImages = (imageResults || [])
    .filter((r) => r.harmful)
    .map((r) => `- 유해 이미지 (${(r.categories || []).join(', ')}): ${r.reason}`)
    .join('\n') || '없음';

  const typeLabel = {
    수정: '수정 요청',
    지양: '지양 안내',
    삭제: '삭제 안내',
    글자수미달: '글자수 미달 안내',
  }[messageType] || messageType;

  const prompt = `당신은 메가스터디 QCC 운영팀 담당자입니다. 아래 정보를 바탕으로 게시자에게 보낼 쪽지를 작성하세요.

## 쪽지 유형: ${typeLabel}
## 칼럼 제목: ${title || '(제목 없음)'}
## 발견된 위반 사항:
${violationSummary}
## 유해 이미지:
${harmfulImages}
## QCC 모니터링 기준 (참고):
${criteria}

## 쪽지 작성 규칙:
- 첫 줄: "안녕하세요, 큐브입니다."
- 둘째 줄: "먼저 QCC를 작성해 주셔서 감사드립니다."
- 셋째 줄: 칼럼 제목([${title}])을 언급하며 안내 사항이 있음을 알림
- 본문: 위반 내용과 조치 사항을 구체적이고 정중하게 안내
  · 수정 요청이면 구체적 수정 사항과 기한(쪽지 발송일 기준 7일) 포함
  · 지양 안내면 앞으로 해당 내용을 지양해 달라고 요청
  · 삭제 안내면 삭제 이유와 조치 내용 설명
  · 글자수 미달이면 정산 기준과 보완 방법 안내
- 마지막 줄: "감사합니다. :)"
- 전체 톤: 정중하고 친절하게, 예시처럼 자연스러운 구어체로

쪽지 내용만 출력하세요. 다른 설명 없이.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

module.exports = { generateMessage };