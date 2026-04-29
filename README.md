# 수학놀이 — 7살을 위한 수학 게임

링크 클릭 한 번으로 바로 플레이하는 웹 기반 수학 게임. 7살 아이의 수학적 직관을 길러주기 위해 만들었다.

기초 산수(덧셈/뺄셈/도형/패턴)에 더해, ML 수학 교과서의 핵심 직관(벡터·확률·그래디언트·행렬 변환)을 어린이 눈높이로 번역한 미니게임 7종이 들어 있다.

## 게임 목록

| # | 게임 | 다루는 직관 |
|---|---|---|
| 1 | 🎈 숫자 풍선 | 덧셈/뺄셈 |
| 2 | 🔺 도형 친구 | 분류 — 본질 vs 우연적 속성 |
| 3 | 🟦 다음에 올 건? | 패턴/규칙 인식 |
| 4 | ⭐ 별 모으기 | 벡터 (방향+거리=위치) |
| 5 | ⛰️ 공 굴리기 | 그래디언트 (내리막=정답 방향) |
| 6 | 🍬 사탕 뽑기 | 확률 (반복 시행 → 빈도) |
| 7 | 🪞 거울 격자 | 행렬 변환 (대칭/회전) |

상세 설계: [docs/concept.md](docs/concept.md)
이론적 출처: [ML_수학_교과서/](ML_수학_교과서/)

## 기술 스택

- **Vanilla HTML/CSS/JS** — 의존성 0, 빌드 도구 없음
- ES Modules (`<script type="module">`)
- Canvas 2D + SVG (게임에 따라)
- Web Audio API (효과음을 코드로 합성. 외부 음원 파일 없음)
- `localStorage` (게임별 최고 별 저장)

## 로컬 실행

ES Modules는 `file://` 에서 로드되지 않으므로 간단한 HTTP 서버가 필요하다.

```bash
# Python
python -m http.server 8000

# 또는 Node
npx serve .
```

브라우저에서 `http://localhost:8000` 열기.

## GitHub Pages 배포

1. 이 폴더를 GitHub 리포지토리로 push
2. Settings → Pages → Source: `Deploy from a branch`
3. Branch: `main` / Folder: `/ (root)`
4. 1~2분 후 `https://<사용자>.github.io/<리포>/` 에서 플레이 가능

## 폴더 구조

```
수학게임/
├── index.html              # 진입점
├── style.css               # 전역 스타일
├── main.js                 # 메뉴 라우팅
├── games/
│   ├── balloons.js         # 1. 숫자 풍선
│   ├── shapes.js           # 2. 도형 친구
│   ├── pattern.js          # 3. 패턴
│   ├── arrow_quest.js      # 4. 별 모으기 (벡터)
│   ├── ball_valley.js      # 5. 공 굴리기 (그래디언트)
│   ├── candy_jar.js        # 6. 사탕 뽑기 (확률)
│   └── mirror_grid.js      # 7. 거울 격자 (행렬)
├── shared/
│   ├── score.js            # 별 점수 (localStorage)
│   ├── audio.js            # Web Audio 효과음
│   └── celebrate.js        # 색종이 애니메이션
├── docs/concept.md         # 게임별 룰·디자인 원칙
└── ML_수학_교과서/         # 이론적 출처 (학부 수준 ML 수학)
```

## 게임 추가하는 법

1. `games/<id>.js` 새로 만들고 `mountGame(container, { gameId, onStarsChange, backToMenu })` 함수 export
2. `main.js` 의 `GAMES` 배열에 `{ id, emoji, name, loader }` 추가
3. 끝. 메뉴에 자동으로 카드 등장.

각 게임은 다음 공통 규약을 지킨다:
- 정답: `playGood()` + 별 획득
- 오답: `playBad()` + `.shake` 클래스 (야단치는 화면 X)
- 클리어: `playFanfare()` + `burstConfetti()`
- 점수 저장: `setStarsIfBetter(gameId, stars)` (1~3)
