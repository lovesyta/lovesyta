// 카페24 Node.js 호스팅용 시작 파일 (카페24는 web.js를 기본 실행 파일로 사용합니다)
// 카페24에서 할당해 주는 포트(보통 8001)를 기본값으로 쓰고, server.js를 그대로 실행합니다.
process.env.PORT = process.env.PORT || '8001';
require('./server.js');
