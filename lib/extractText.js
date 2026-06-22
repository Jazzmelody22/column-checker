const https = require('https');
const http = require('http');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

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
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const headerCharset = (res.headers['content-type'] || '').match(/charset=([^;]+)/i);
        let charset = headerCharset ? headerCharset[1].trim().toLowerCase() : null;
        if (!charset) {
          const metaSnippet = buffer.slice(0, 2000).toString('latin1');
          const metaCharset = metaSnippet.match(/charset=["']?([\w-]+)/i);
          charset = metaCharset ? metaCharset[1].toLowerCase() : 'utf-8';
        }
        if (charset.includes('utf-8') || charset.includes('utf8')) {
          resolve(buffer.toString('utf-8'));
        } else {
          resolve(iconv.decode(buffer, charset));
        }
      });
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

  // 메가스터디 QCC 페이지 전용: 제목 + 작성자정보 + 본문만 추출
  const title = $('.commonBoardView--subject').first().text().trim();
  if (title) blocks.push(title);

  const meta = $('.commonBoardView--items').first().text().replace(/\s+/g, ' ').trim();
  if (meta) blocks.push(meta);

const imageUrls = [];                                          // ✅ 추가
  const viewContents = $('.viewContents').first();
  if (viewContents.length) {
    viewContents.find('img').each((_, el) => {                 // ✅ 추가
      const src = $(el).attr('src') || $(el).attr('data-src');// ✅ 추가
      if (src && !src.startsWith('data:')) {                  // ✅ 추가
        try {                                                  // ✅ 추가
          const abs = src.startsWith('http')                  // ✅ 추가
            ? src : new URL(src, url).href;                   // ✅ 추가
          imageUrls.push(abs);                                // ✅ 추가
        } catch (_) {}                                        // ✅ 추가
      }                                                       // ✅ 추가
    });                                                       // ✅ 추가
    // 광고/공유 버튼 등 본문 내부에 섞여 들어올 수 있는 요소 제거
    viewContents.find('.castView__bottom_util, script, style').remove();

    const bodyText = viewContents
      .html()
      ?.split(/<br\s*\/?>/i)
      .map((line) => $('<div>').html(line).text().trim())
      .filter((line) => line.length > 0)
      .join('\n');
    if (bodyText) blocks.push(bodyText);
  }

  // 메가스터디 구조가 아닌 일반 페이지를 위한 fallback
  if (blocks.length === 0) {
    $('article, main, .content, .article-body, .post-body, #content').find('p, h1, h2, h3, h4, h5, h6').each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 10) blocks.push(t);
    });
  }
  if (blocks.length === 0) {
    $('p').each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 10) blocks.push(t);
    });
  }

  const text = blocks.join('\n').trim();
  if (!text) throw new Error('본문을 추출할 수 없습니다. 페이지 구조를 확인하거나 텍스트 직접 입력 방식을 사용하세요.');

 return { text, imageUrls,  title };   // ✅ 수정
}

module.exports = { extractTextFromUrl };

