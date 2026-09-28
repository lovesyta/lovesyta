// 사랑의 연탄천사 - 봉사신청 게시판 백엔드
// Node.js + Express + JSON 파일 저장소 (별도 DB 설치 없이 바로 실행 가능)
// DB(SQLite, MySQL 등)로 바꾸고 싶다면 readData() / writeData() 두 함수만 교체하면 됩니다.
//
// 보안 참고: 비밀글 비밀번호는 데모 수준으로 평문 비교합니다.
//    실제 운영 서비스로 쓰신다면 bcrypt 등으로 반드시 해시 처리하세요.
//
// 관리자 키(ADMIN_KEY): 봉사일정 캘린더에 일정을 등록/삭제할 수 있는 유일한 사람(관리자)을
// 구분하는 값입니다. 서버를 실행하기 전에 반드시 환경변수로 바꿔서 사용하세요.
//   예) Mac/Linux: ADMIN_KEY="나만아는비밀값" npm start
//       Windows(PowerShell): $env:ADMIN_KEY="나만아는비밀값"; npm start
// 환경변수를 설정하지 않으면 아래 기본값이 쓰이는데, 이 기본값은 누구나 알 수 있으므로
// 실제 운영 시에는 절대 그대로 쓰지 마세요.

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'yeontan-angel-2026';
// 데이터 저장 폴더: 배포 서버(Render 등)에서는 DATA_DIR 환경변수로 영구 디스크 경로(예: /var/data)를
// 지정합니다. 설정하지 않으면 지금처럼 프로젝트 안의 data 폴더를 씁니다.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, 'posts.json');
const SCHEDULE_FILE = path.join(DATA_DIR, 'schedule.json');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');
const RECEIPTS_FILE = path.join(DATA_DIR, 'receipts.json');

// 관리자만 글을 쓸 수 있는 게시판 / 누구나 글을 쓸 수 있는 게시판
const ADMIN_ONLY_BOARDS = ['notice', 'news', 'press'];
const PUBLIC_WRITE_BOARDS = ['contact'];
const ALL_BOARDS = ADMIN_ONLY_BOARDS.concat(PUBLIC_WRITE_BOARDS);

// 사진(base64)이 포함된 저장 요청을 받을 수 있도록 기본 1MB보다 넉넉하게 늘림
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- 데이터 읽기/쓰기 ----------
function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeData(posts) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2), 'utf-8');
}

function readSchedule() {
  try {
    const raw = fs.readFileSync(SCHEDULE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeSchedule(events) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(events, null, 2), 'utf-8');
}

function readContent() {
  try {
    const raw = fs.readFileSync(CONTENT_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function writeContent(map) {
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(map, null, 2), 'utf-8');
}

function readArticles() {
  try {
    const raw = fs.readFileSync(ARTICLES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeArticles(articles) {
  fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articles, null, 2), 'utf-8');
}

function readReceipts() {
  try {
    const raw = fs.readFileSync(RECEIPTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeReceipts(receipts) {
  fs.writeFileSync(RECEIPTS_FILE, JSON.stringify(receipts, null, 2), 'utf-8');
}

// 관리자 전용 API를 보호하는 미들웨어 — 요청 헤더의 x-admin-key 값이 서버의
// ADMIN_KEY와 일치할 때만 통과시킵니다.
function requireAdmin(req, res, next) {
  const key = req.get('x-admin-key');
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({ error: '관리자 인증이 필요합니다.' });
  }
  next();
}

// ---------- 유틸 ----------
function maskName(name) {
  if (!name) return '익명';
  const trimmed = String(name).trim();
  return trimmed.charAt(0) + '**';
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

// 공지사항/단체소식/언론보도/문의하기 게시판에서 쓰는 "YYYY-MM-DD HH:MM" 형식
function formatDateTime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

// 목록/일반 응답에 내보내도 되는 "공개" 필드만 추림 (개인정보 필드는 절대 포함하지 않음)
function toPublic(post) {
  return {
    id: post.id,
    title: post.title,
    author: post.author,
    date: post.date,
    views: post.views,
    secret: !!post.secret,
  };
}

// ---------- API ----------

// 봉사신청 목록 조회 (최신순) — 개인정보 필드는 응답에 포함되지 않음
app.get('/api/posts', (req, res) => {
  const posts = readData()
    .sort((a, b) => b.id - a.id)
    .map(toPublic);
  res.json(posts);
});

// 봉사신청 등록
app.post('/api/posts', (req, res) => {
  const {
    title,
    secret,
    author,
    password,
    orgName,
    phone,
    emergency,
    hopeDate,
    headcount,
  } = req.body || {};

  const required = { title, author, orgName, phone, emergency, hopeDate, headcount };
  for (const [key, value] of Object.entries(required)) {
    if (!value || !String(value).trim()) {
      return res.status(400).json({ error: `필수 항목이 비어 있습니다: ${key}` });
    }
  }

  if (secret && (!password || !String(password).trim())) {
    return res.status(400).json({ error: '비밀글로 설정하려면 비밀번호를 입력해야 합니다.' });
  }

  const posts = readData();
  const nextId = posts.length ? Math.max(...posts.map((p) => p.id)) + 1 : 1;

  const newPost = {
    id: nextId,
    title: String(title).trim(),
    secret: !!secret,
    password: secret ? String(password) : null,
    author: maskName(author),
    date: formatDate(new Date()),
    views: 0,
    // 개인정보 항목 — 목록/일반 응답에는 절대 노출되지 않고, 비밀번호 확인 후에만 전달됨
    orgName: String(orgName).trim(),
    phone: String(phone).trim(),
    emergency: String(emergency).trim(),
    hopeDate: String(hopeDate).trim(),
    headcount: String(headcount).trim(),
  };

  posts.push(newPost);
  writeData(posts);

  res.status(201).json(toPublic(newPost));
});

// 게시글 상세(개인정보 포함) 조회 — 비밀글이면 비밀번호가 맞거나, 관리자 키가 있어야 함
app.patch('/api/posts/:id/view', (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body || {};
  const adminKey = req.get('x-admin-key');
  const posts = readData();
  const post = posts.find((p) => p.id === id);

  if (!post) {
    return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  }

  if (post.secret) {
    const passwordOk = password && String(password) === String(post.password);
    const adminOk = adminKey && adminKey === ADMIN_KEY;
    if (!passwordOk && !adminOk) {
      return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    }
  }

  post.views = (post.views || 0) + 1;
  writeData(posts);

  res.json({
    id: post.id,
    title: post.title,
    author: post.author,
    date: post.date,
    views: post.views,
    orgName: post.orgName,
    phone: post.phone,
    emergency: post.emergency,
    hopeDate: post.hopeDate,
    headcount: post.headcount,
  });
});

// ---------- 관리자 인증 확인 ----------
// 프론트엔드에서 입력한 키가 맞는지만 확인하고, 맞으면 그 키를 그대로 이후 요청에 계속 사용합니다.
app.post('/api/admin/verify', requireAdmin, (req, res) => {
  res.json({ ok: true });
});

// ---------- 봉사일정 캘린더 API ----------

// 전체 일정 조회 (누구나 볼 수 있음)
app.get('/api/schedule', (req, res) => {
  const events = readSchedule().sort((a, b) => (a.date < b.date ? -1 : 1));
  res.json(events);
});

// 일정 등록 (관리자만 가능)
app.post('/api/schedule', requireAdmin, (req, res) => {
  const { date, title, status } = req.body || {};

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return res.status(400).json({ error: '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)' });
  }
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: '제목을 입력해 주세요.' });
  }

  const events = readSchedule();
  const nextId = events.length ? Math.max(...events.map((e) => e.id)) + 1 : 1;

  const newEvent = {
    id: nextId,
    date: String(date),
    title: String(title).trim(),
    status: status ? String(status).trim() : '모집중',
  };

  events.push(newEvent);
  writeSchedule(events);

  res.status(201).json(newEvent);
});

// 일정 삭제 (관리자만 가능)
app.delete('/api/schedule/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const events = readSchedule();
  const next = events.filter((e) => e.id !== id);

  if (next.length === events.length) {
    return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
  }

  writeSchedule(next);
  res.json({ ok: true });
});

// ---------- 페이지 콘텐츠(텍스트/사진) API ----------
// key 예: "about-intro", "donate-coal" 등 — 페이지별 탭을 식별하는 문자열

// 전체 콘텐츠 조회 (누구나 볼 수 있음) — { key: { text, images: [dataUrl, ...] }, ... } 형태
app.get('/api/content', (req, res) => {
  res.json(readContent());
});

// 콘텐츠 등록/수정 (관리자만 가능)
app.post('/api/content', requireAdmin, (req, res) => {
  const { key, text, images } = req.body || {};

  if (!key || !String(key).trim()) {
    return res.status(400).json({ error: 'key가 필요합니다.' });
  }
  if (images && !Array.isArray(images)) {
    return res.status(400).json({ error: 'images는 배열이어야 합니다.' });
  }

  const content = readContent();
  const entry = {
    text: text ? String(text) : '',
    images: Array.isArray(images) ? images.filter((s) => typeof s === 'string') : [],
  };
  content[String(key).trim()] = entry;
  writeContent(content);

  res.json(entry);
});

// ---------- 공지사항 / 단체소식 / 언론보도 / 문의하기 게시판 API ----------
// board 값: notice(공지사항), news(단체소식), press(언론보도), contact(문의하기)
// notice/news/press는 관리자만 글을 쓸 수 있고, contact는 누구나 글을 쓸 수 있습니다.

function articlePublic(article) {
  return {
    id: article.id,
    board: article.board,
    title: article.title,
    author: article.author,
    date: article.date,
    views: article.views,
    secret: !!article.secret,
    pinned: !!article.pinned,
  };
}

// 게시판별 목록 조회 (최신순) — 본문/사진은 포함하지 않음
app.get('/api/articles', (req, res) => {
  const board = req.query.board;
  if (!board || !ALL_BOARDS.includes(String(board))) {
    return res.status(400).json({ error: '유효하지 않은 게시판입니다.' });
  }
  const articles = readArticles()
    .filter((a) => a.board === board)
    .sort((a, b) => b.id - a.id)
    .map(articlePublic);
  res.json(articles);
});

// 글 등록 — notice/news/press는 관리자 키 필요, contact는 누구나 가능
app.post('/api/articles', (req, res) => {
  const { board, title, author, content, images, sourceUrl, secret, password, pinned } = req.body || {};

  if (!board || !ALL_BOARDS.includes(String(board))) {
    return res.status(400).json({ error: '유효하지 않은 게시판입니다.' });
  }

  if (ADMIN_ONLY_BOARDS.includes(board)) {
    const adminKey = req.get('x-admin-key');
    if (!adminKey || adminKey !== ADMIN_KEY) {
      return res.status(401).json({ error: '이 게시판은 관리자만 글을 쓸 수 있습니다.' });
    }
  }

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: '제목을 입력해 주세요.' });
  }
  if (images && !Array.isArray(images)) {
    return res.status(400).json({ error: 'images는 배열이어야 합니다.' });
  }

  let finalAuthor;
  if (ADMIN_ONLY_BOARDS.includes(board)) {
    finalAuthor = '관리자';
  } else {
    if (!author || !String(author).trim()) {
      return res.status(400).json({ error: '작성자를 입력해 주세요.' });
    }
    finalAuthor = maskName(author);
    if (secret && (!password || !String(password).trim())) {
      return res.status(400).json({ error: '비밀글로 설정하려면 비밀번호를 입력해야 합니다.' });
    }
  }

  const articles = readArticles();
  const nextId = articles.length ? Math.max(...articles.map((a) => a.id)) + 1 : 1;

  const newArticle = {
    id: nextId,
    board: String(board),
    title: String(title).trim(),
    author: finalAuthor,
    date: formatDateTime(new Date()),
    views: 0,
    content: content ? String(content) : '',
    images: Array.isArray(images) ? images.filter((s) => typeof s === 'string') : [],
    sourceUrl: sourceUrl ? String(sourceUrl).trim() : '',
    secret: PUBLIC_WRITE_BOARDS.includes(board) ? !!secret : false,
    password: PUBLIC_WRITE_BOARDS.includes(board) && secret ? String(password) : null,
    // "전체 게시판 상단 고정"은 관리자만 쓸 수 있는 게시판(공지/소식/보도)에서만 허용
    pinned: ADMIN_ONLY_BOARDS.includes(board) ? !!pinned : false,
  };

  articles.push(newArticle);
  writeArticles(articles);

  res.status(201).json(articlePublic(newArticle));
});

// 글 상세(본문/사진 포함) 조회 — 비밀글(문의하기)이면 비밀번호 또는 관리자 키가 있어야 함
app.patch('/api/articles/:id/view', (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body || {};
  const adminKey = req.get('x-admin-key');
  const articles = readArticles();
  const article = articles.find((a) => a.id === id);

  if (!article) {
    return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  }

  if (article.secret) {
    const passwordOk = password && String(password) === String(article.password);
    const adminOk = adminKey && adminKey === ADMIN_KEY;
    if (!passwordOk && !adminOk) {
      return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    }
  }

  article.views = (article.views || 0) + 1;
  writeArticles(articles);

  res.json({
    id: article.id,
    board: article.board,
    title: article.title,
    author: article.author,
    date: article.date,
    views: article.views,
    content: article.content,
    images: article.images,
    sourceUrl: article.sourceUrl,
    pinned: !!article.pinned,
  });
});

// 글 삭제 (관리자만 가능) — 공지/소식/보도의 잘못 올라간 글, 문의하기의 스팸 등을 정리할 때 사용
app.delete('/api/articles/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const articles = readArticles();
  const next = articles.filter((a) => a.id !== id);

  if (next.length === articles.length) {
    return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  }

  writeArticles(next);
  res.json({ ok: true });
});

// 상단 고정된 공지 목록 — 모든 게시판(봉사신청, 기부금 영수증 포함)의 목록 맨 위에 공통으로 표시됨
// 공지사항/단체소식/언론보도 글만 고정할 수 있으므로 항상 이 3개 게시판의 글만 나옵니다.
app.get('/api/pinned', (req, res) => {
  const pinned = readArticles()
    .filter((a) => a.pinned)
    .sort((a, b) => b.id - a.id)
    .slice(0, 5)
    .map((a) => ({ id: a.id, board: a.board, title: a.title, date: a.date }));
  res.json(pinned);
});

// 고정/고정 해제 (관리자만 가능) — 글쓰기 이후에도 상세 화면에서 토글할 수 있게 함
app.patch('/api/articles/:id/pin', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { pinned } = req.body || {};
  const articles = readArticles();
  const article = articles.find((a) => a.id === id);

  if (!article) {
    return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  }
  if (!ADMIN_ONLY_BOARDS.includes(article.board)) {
    return res.status(400).json({ error: '공지사항/단체소식/언론보도 글만 고정할 수 있습니다.' });
  }

  article.pinned = !!pinned;
  writeArticles(articles);

  res.json(articlePublic(article));
});

// ---------- 기부금 영수증 신청 게시판 API ----------
// 봉사신청 게시판과 동일한 구조: 목록에는 개인정보가 없고, 비밀번호(또는 관리자 키)로만
// 성명/연락처/이메일/기부일자/기부금액 같은 개인정보를 확인할 수 있습니다.

function receiptPublic(r) {
  return {
    id: r.id,
    title: r.title,
    author: r.author,
    date: r.date,
    views: r.views,
    secret: true,
  };
}

// 신청 목록 조회 (최신순) — 개인정보 필드는 응답에 포함되지 않음
app.get('/api/receipts', (req, res) => {
  const receipts = readReceipts()
    .sort((a, b) => b.id - a.id)
    .map(receiptPublic);
  res.json(receipts);
});

// 신청 등록 — 개인정보(성명/연락처/이메일/기부금액 등)를 다루므로 항상 비밀번호로 보호됩니다.
app.post('/api/receipts', (req, res) => {
  const { title, author, password, name, phone, email, donationDate, amount } = req.body || {};

  const required = { title, author, password, name, phone, email, donationDate, amount };
  for (const [key, value] of Object.entries(required)) {
    if (!value || !String(value).trim()) {
      return res.status(400).json({ error: `필수 항목이 비어 있습니다: ${key}` });
    }
  }

  const receipts = readReceipts();
  const nextId = receipts.length ? Math.max(...receipts.map((r) => r.id)) + 1 : 1;

  const newReceipt = {
    id: nextId,
    title: String(title).trim(),
    author: maskName(author),
    password: String(password),
    date: formatDateTime(new Date()),
    views: 0,
    // 개인정보 항목 — 목록/일반 응답에는 절대 노출되지 않고, 비밀번호 확인 후에만 전달됨
    name: String(name).trim(),
    phone: String(phone).trim(),
    email: String(email).trim(),
    donationDate: String(donationDate).trim(),
    amount: String(amount).trim(),
  };

  receipts.push(newReceipt);
  writeReceipts(receipts);

  res.status(201).json(receiptPublic(newReceipt));
});

// 신청 상세(개인정보 포함) 조회 — 비밀번호가 맞거나 관리자 키가 있어야 함
app.patch('/api/receipts/:id/view', (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body || {};
  const adminKey = req.get('x-admin-key');
  const receipts = readReceipts();
  const receipt = receipts.find((r) => r.id === id);

  if (!receipt) {
    return res.status(404).json({ error: '신청 내역을 찾을 수 없습니다.' });
  }

  const passwordOk = password && String(password) === String(receipt.password);
  const adminOk = adminKey && adminKey === ADMIN_KEY;
  if (!passwordOk && !adminOk) {
    return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
  }

  receipt.views = (receipt.views || 0) + 1;
  writeReceipts(receipts);

  res.json({
    id: receipt.id,
    title: receipt.title,
    author: receipt.author,
    date: receipt.date,
    views: receipt.views,
    name: receipt.name,
    phone: receipt.phone,
    email: receipt.email,
    donationDate: receipt.donationDate,
    amount: receipt.amount,
  });
});

app.listen(PORT, () => {
  console.log(`사랑의 연탄천사 서버가 실행 중입니다: http://localhost:${PORT}`);
});
