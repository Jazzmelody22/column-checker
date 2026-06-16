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
}
