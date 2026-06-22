const https = require('https');
const http = require('http');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 이미지를 buffer로 가져오기
function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return fetchImageBuffer(res.headers.location)
            .then(resolve)
            .catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const mimeType = (res.headers['content-type'] || 'image/jpeg')
          .split(';')[0]
          .trim();
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () =>
          resolve({ buffer: Buffer.concat(chunks), mimeType })
        );
      }
    );
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('이미지 로딩 시간 초과'));
    });
  });
}

const PROMPT = `이 이미지를 분석하여 청소년 유해 콘텐츠 포함 여부를 판단하세요.
확인 항목: 노출/선정적 이미지, 음주/술병, 흡연/담배, 문신, 폭력/혐오, 기타 유해 요소
아래 JSON 형식만 응답하세요 (다른 텍스트 없이):
{
  "harmful": true 또는 false,
  "categories": ["해당 항목들"],
  "reason": "판단 근거 한 문장"
}`;

async function runImageCheck(imageUrls) {
  if (!imageUrls || imageUrls.length === 0) return [];

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const results = [];

  for (const url of imageUrls) {
    try {
      const { buffer, mimeType } = await fetchImageBuffer(url);
      const base64 = buffer.toString('base64');

      const result = await model.generateContent([
        { inlineData: { data: base64, mimeType } },
        PROMPT,
      ]);

      const raw = result.response.text().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(raw);
      results.push({ url, harmful: parsed.harmful, categories: parsed.categories, reason: parsed.reason });
    } catch (err) {
      // 분석 실패한 이미지는 에러 표시 후 계속 진행
      results.push({ url, harmful: false, error: `분석 실패: ${err.message}` });
    }
  }

  return results;
}

module.exports = { runImageCheck };