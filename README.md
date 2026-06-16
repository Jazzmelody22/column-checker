# 칼럼 콘텐츠 검사기

19세 미만 학생 대상 칼럼을 붙여넣거나 URL을 입력하면, 사전 정의된 기준에 따라 "적합" / "부적합"을 판별해 주는 로컬 실행용 웹앱입니다.

## 사전 준비

- [Node.js](https://nodejs.org/) 18 이상 설치
- Google Gemini API 키 발급 (https://aistudio.google.com/apikey)

## 실행 방법

```bash
# 1. 프로젝트 폴더에서 의존성 설치
npm install

# 2. 환경 변수 파일 생성
cp .env.example .env

# 3. .env 파일을 열어 값 입력
# GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# SITE_PASSWORD=사용할_비밀번호
# SESSION_SECRET=긴_랜덤_문자열  (예: openssl rand -base64 32 출력값)

# 4. 서버 실행
node server.js

# 5. 브라우저에서 접속 → 비밀번호 입력 후 이용
# http://localhost:3000
```

## 비밀번호 보호

외부 배포 시 `.env`의 두 값을 반드시 설정하세요:

| 변수 | 설명 |
|------|------|
| `SITE_PASSWORD` | 사이트 접속 비밀번호. 팀원에게 별도로 공유 |
| `SESSION_SECRET` | 세션 서명 키. 충분히 길고 무작위한 문자열 사용 |

- 로그인하면 브라우저를 닫기 전까지 세션이 유지됩니다.
- `/logout` 접속 시 로그아웃됩니다.
- `SITE_PASSWORD`가 설정되지 않으면 서버가 시작되지 않습니다.

## 검사 기준

| 기준 | 판별 방식 |
|------|-----------|
| 노출/성적 묘사 | Gemini AI 판단 |
| 술/담배 관련 단어 | 키워드 리스트 매칭 + AI 우회 표현 탐지 |
| 욕설/은어 (초성 변형 포함) | 금칙어 리스트 매칭 + AI 탐지 |
| 특정 회사명/강사 추천 | 금지 리스트 매칭 + AI 탐지 |

## 검사 기준 파일 관리

`data/` 폴더의 두 YAML 파일을 VS Code 등으로 직접 열어 편집하세요. 서버 재시작 없이 즉시 반영됩니다.

| 파일 | 역할 |
|------|------|
| `data/keywords.yaml` | 규칙 기반 검사 기준 (키워드·정규식·글자수 등) |
| `data/prompts.yaml` | AI 검사에 사용할 시스템 프롬프트 |

---

### keywords.yaml 관리

`data/keywords.yaml`를 열어 항목을 추가·삭제·수정합니다.

#### 글자수 기준 변경

```yaml
min_chars_no_space: 800   # 공백 제외 최소 글자수
```

숫자만 바꾸면 됩니다.

#### 키워드 추가/삭제 (nonstudy_keywords, ask_keywords)

```yaml
nonstudy_keywords:
  - 데이트
  - 연애
  - 추가할단어   # ← 이 줄을 추가
```

들여쓰기(스페이스 2칸)와 `- ` 형식을 맞춰야 합니다.

#### 개인정보(PII) 패턴 수정

```yaml
pii:
  phone: "(01[016789])[-\\s]?\\d{3,4}[-\\s]?\\d{4}"
  email: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}"
```

정규식 문자열로 작성합니다. 백슬래시는 `\\`로 이스케이프해야 합니다.

#### 정규식 패턴 추가/삭제 (copyright_patterns, adult_patterns, forbidden_capture)

```yaml
copyright_patterns:
  - "무단(전재|배포)"
  - "저작권"
  - "추가할\\s?패턴"   # ← 정규식 패턴 추가
```

---

### prompts.yaml 관리

`data/prompts.yaml`의 `default_prompt` 내용을 수정하면 AI 검사 지시문이 바뀝니다.

- `### 1. 이미지 분석` ~ `### 4. 커뮤니티 가이드라인 위반` 섹션 아래 항목을 추가·삭제하세요.
- `## 응답 형식` 섹션은 코드에서 자동으로 제거되고 JSON 출력 형식으로 대체됩니다. 해당 섹션은 수정해도 적용되지 않으니 참고용으로만 두거나 삭제해도 됩니다.
- YAML의 `|` 블록 스칼라 형식이므로 들여쓰기(스페이스 2칸)를 반드시 유지하세요.

```yaml
default_prompt: |
  당신은 교육 서비스 운영팀의 콘텐츠 모니터링 담당자입니다.
  ...
  ### 4. 커뮤니티 가이드라인 위반
  - 새로운 항목 추가 가능   # ← 이 줄 추가
```

## 주의사항

- AI 판단은 참고용이며, 최종 확인은 담당자가 직접 해주세요.
- API 호출 비용이 발생합니다 (Google AI Studio 요금제 확인).
- HTTPS 환경에서 운영할 경우 `cookie: { secure: true }` 옵션을 server.js에 추가하세요.
