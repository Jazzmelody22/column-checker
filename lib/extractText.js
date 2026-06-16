const https = require('https');
const http = require('http');
const cheerio = require('cheerio');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('요청 시간 초과'));
    });
  });
}

async function extractTextFromUrl(url) {
  let html;
  try {
    html = await fetchUrl(url);
  } catch (err) {
    throw new Error(`URL 접근 실패: ${err.message}`);
  }

  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, aside, iframe, noscript').remove();

  const blocks = [];
  $('article, main, .content, .article-body, .post-body, #content').find('p, h1, h2, h3, h4, h5, h6').each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > 10) blocks.push(t);
  });

  if (blocks.length === 0) {
    $('p').each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 10) blocks.push(t);
    });
  }

  const text = blocks.join('\n').trim();
  if (!text) throw new Error('본문을 추출할 수 없습니다. 페이지 구조를 확인하거나 텍스트 직접 입력 방식을 사용하세요.');

  return text;
}

module.exports = { extractTextFromUrl };
