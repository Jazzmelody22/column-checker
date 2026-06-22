let activeTab = 'text';

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.input-area').forEach((a) => a.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${activeTab}`).classList.add('active');
  });
});

document.getElementById('btn-check').addEventListener('click', runCheck);

async function runCheck() {
  const btn = document.getElementById('btn-check');
  const loading = document.getElementById('loading');
  const resultEl = document.getElementById('result');
  const errorBox = document.getElementById('error-box');

  const content =
    activeTab === 'text'
      ? document.getElementById('input-text').value.trim()
      : document.getElementById('input-url').value.trim();

  if (!content) {
    alert('텍스트 또는 URL을 입력해주세요.');
    return;
  }

  btn.disabled = true;
  loading.style.display = 'block';
  resultEl.style.display = 'none';
  errorBox.style.display = 'none';

  try {
    const res = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: activeTab, content }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '서버 오류가 발생했습니다.');
    }

    renderResult(data);
  } catch (err) {
    errorBox.textContent = '오류: ' + err.message;
    errorBox.style.display = 'block';
  } finally {
    btn.disabled = false;
    loading.style.display = 'none';
  }
}

function getCategoryClass(category) {
  if (category === '노출/성적묘사') return 'cat-sexual';
  if (category === '욕설/은어') return 'cat-slang';
  if (category === '회사명' || category === '강사명') return 'cat-company';
  if (category === '술/담배') return 'cat-substance';
  if (category === '글자수 미달') return 'cat-length';
  if (category === '개인신상/Vlog') return 'cat-personal';
  return '';
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderResult(data) {
  const resultEl = document.getElementById('result');
  const verdictEl = document.getElementById('verdict-badge');
  const container = document.getElementById('violations-container');

  const isPass = data.overall === '적합';
  verdictEl.innerHTML = `<div class="verdict ${isPass ? 'pass' : 'fail'}">${isPass ? '✅ 적합' : '❌ 부적합'}</div>`;

if (data.summary) {
    verdictEl.innerHTML += `
      <div class="summary-box">
        <div class="summary-row">
          <span class="summary-label">학습 관련 비율</span>
          <span class="summary-value">${data.summary.studyRelatedPercent}%</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">콘텐츠 성격</span>
          <span class="summary-tag summary-tag-bold">${esc(data.summary.category)}</span>
        </div>
        <div class="summary-comment summary-comment-bold">${esc(data.summary.comment)}</div>
        <div class="summary-spacer"></div>
        <div class="summary-content-title">내용 요약</div>
        <div class="summary-content-text summary-content-bold">${esc(data.summary.contentSummary)}</div>
      </div>`;
  }


  if (isPass) {
    container.innerHTML = '<p style="color:#16a34a;font-size:0.95rem;">위반 항목이 발견되지 않았습니다.</p>';
  } else {
    const items = data.violations
      .map(
        (v) => `
      <div class="violation-card">
        <div class="violation-header">
          <span class="badge-category ${getCategoryClass(v.category)}">${esc(v.category)}</span>
          <span class="badge-source ${v.source === 'rule' ? 'rule' : 'ai'}">${v.source === 'rule' ? '규칙 매칭' : 'AI 판단'}</span>
        </div>
        <div class="violation-field"><strong>감지 표현:</strong> <span class="highlight">${esc(v.matched)}</span></div>
        <div class="violation-field"><strong>문맥:</strong> ${esc(v.context)}</div>
        <div class="violation-field"><strong>판단 근거:</strong> ${esc(v.reason)}</div>
      </div>`
      )
      .join('');

    container.innerHTML = `<p class="section-title">위반 항목 (${data.violations.length}건)</p>${items}`;
  }

  resultEl.style.display = 'block';
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  renderImageResults(data.imageResults);
 initMessageSection(data);
}

function renderImageResults(imageResults) {
  const container = document.getElementById('image-results-container');
  if (!container) return; 
  if (!imageResults || imageResults.length === 0) {
    container.innerHTML = '';
    return;
  }

  const harmful = imageResults.filter((r) => r.harmful);
  const failed = imageResults.filter((r) => r.error);

  let html = `
    <div style="margin-top:20px;">
      <p class="section-title">🖼️ 이미지 검사 결과 (${imageResults.length}장 중 유해 ${harmful.length}건)</p>`;

  if (harmful.length === 0) {
    html += `<p style="color:#16a34a;font-size:0.95rem;margin-bottom:8px;">유해 이미지가 발견되지 않았습니다.</p>`;
  }

  harmful.forEach((img) => {
    html += `
      <div class="image-result-card">
        <img class="image-thumb" src="${esc(img.url)}" alt="유해 이미지"
             onerror="this.style.display='none'" />
        <div class="image-result-body">
          <div class="image-result-header">
            <span class="badge-harmful">⚠️ 유해</span>
            ${(img.categories || []).map((c) => `<span class="badge-img-cat">${esc(c)}</span>`).join('')}
          </div>
          <div class="violation-field" style="margin-top:6px;">
            <strong>판단 근거:</strong> ${esc(img.reason || '')}
          </div>
        </div>
      </div>`;
  });

  if (failed.length > 0) {
    html += `<p style="color:#94a3b8;font-size:0.83rem;margin-top:8px;">분석 실패 이미지: ${failed.length}장</p>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}

// 쪽지 작성 관련
let lastCheckData = null;
let selectedMsgType = null;

function initMessageSection(data) {
  lastCheckData = data;
  selectedMsgType = null;
  document.getElementById('message-section').style.display = 'block';
  document.getElementById('message-output').style.display = 'none';
  document.getElementById('btn-generate-msg').disabled = true;
  document.querySelectorAll('.msg-type-btn').forEach((btn) => {
    btn.classList.remove('active');
    btn.addEventListener('click', () => {
      document.querySelectorAll('.msg-type-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMsgType = btn.dataset.type;
      document.getElementById('btn-generate-msg').disabled = false;
    });
  });
}

document.getElementById('btn-generate-msg').addEventListener('click', async () => {
  if (!selectedMsgType || !lastCheckData) return;

  const btn = document.getElementById('btn-generate-msg');
  const loadingEl = document.getElementById('message-loading');
  const outputEl = document.getElementById('message-output');

  btn.disabled = true;
  loadingEl.style.display = 'block';
  outputEl.style.display = 'none';

  try {
    const res = await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: lastCheckData.title || '',
        messageType: selectedMsgType,
        violations: lastCheckData.violations || [],
        imageResults: lastCheckData.imageResults || [],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '쪽지 생성 실패');

    document.getElementById('message-text').value = data.message;
    outputEl.style.display = 'block';
  } catch (err) {
    alert('오류: ' + err.message);
  } finally {
    btn.disabled = false;
    loadingEl.style.display = 'none';
  }
});

document.getElementById('btn-copy-msg').addEventListener('click', () => {
  const text = document.getElementById('message-text').value;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-copy-msg');
    btn.textContent = '✅ 복사됨!';
    setTimeout(() => (btn.textContent = '📋 복사하기'), 2000);
  });
});
