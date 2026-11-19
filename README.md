# multy — 퇴근 에코 (가제)

죽은 과거의 나와 함께 싸우는 2분짜리 한 손 서바이버.

- 기획서: [docs/GDD.md](docs/GDD.md)
- 프로토타입 (1~2주차, 학교 월드): [prototype/](prototype/)

## 프로토타입 실행
```bash
cd prototype && python3 -m http.server 8000   # → http://localhost:8000
```
- 이동: 화면 드래그 / 방향키 / WASD (공격은 자동)
- 한 판이 끝나면 이동 경로·강화 기록이 에코로 저장되어(localStorage) 다음 판에서 함께 싸웁니다. 최대 10명.

## 검증 (헤드리스)
```bash
node prototype/test.js   # 결정론, 에코 누적 효과, 에코 재생 정합성
```
구조: `sim.js`(DOM 없는 결정론 시뮬레이션, 60Hz 고정 타임스텝 + 시드 난수) / `index.html`(렌더·입력·UI).
