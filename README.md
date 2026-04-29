# 한글 단어 퍼즐

7살용 웹 한글 자모 단어 게임. 화면 위에 단어 그림이 나오고, 아래의 자모 조각을 빈 슬롯에 끌어다 놓아 글자를 완성한다.

> 리포 이름은 역사적 이유로 `MLMathGame` 이지만, 내용은 한글 자모 학습 게임이다.

## 플레이 방법

1. [https://gangdonglee.github.io/MLMathGame/](https://gangdonglee.github.io/MLMathGame/) 접속
2. **시작하기** 버튼 누르기
3. 그림 위 빈 자리에 자모 조각을 끌어다 놓기
4. 정답이면 슬롯에 박힘 → 음절이 합쳐져 한 글자로 변신
5. 모든 글자 완성하면 다음 라운드. 총 10라운드.

## 난이도 곡선

| 라운드 | 단어 형태 | 예시 |
|---|---|---|
| 1~2 | 1글자, 받침 없음 | 코, 해, 차 |
| 3~4 | 2글자, 받침 없음 | 거미, 우유 |
| 5~6 | 받침 등장 | 곰, 별, 손 |
| 7~8 | 쌍자음 또는 받침+2글자 | 토끼, 빵 |
| 9~10 | 3글자 또는 복합 모음 | 사과, 호랑이 |

## 기술

- **Vanilla HTML/CSS/JS** — 의존성 0, 빌드 도구 없음
- ES Modules
- 핵심 모듈: `shared/jamo.js` — 한글 유니코드 (`0xAC00 ~ 0xD7A3`) 분해/조합 엔진
- 효과음: Web Audio API 합성 (외부 파일 0)
- 발음: Web Speech API (한국어 TTS, 보조용)
- 점수: localStorage

## 폴더 구조

```
.
├── index.html
├── style.css
├── main.js                 # 시작 화면 ↔ 게임 라우팅
├── game.js                 # 게임 본체
├── shared/
│   ├── jamo.js             # 한글 자모 분해/조합 (핵심)
│   ├── tts.js              # 한국어 발음
│   ├── audio.js            # 효과음
│   ├── celebrate.js        # 색종이 애니메이션
│   └── score.js            # 별 점수 (localStorage)
├── data/
│   └── words.js            # 단어 풀 + 라운드 선택
└── .github/workflows/
    └── static.yml          # GitHub Pages 자동 배포
```

## 로컬 실행

ES Modules 는 `file://` 에서 안 됨. 간단한 HTTP 서버 필요:

```bash
python -m http.server 8000
# 또는
npx serve .
```

브라우저에서 `http://localhost:8000`.

## 배포

`main` 브랜치에 push 하면 GitHub Actions 가 자동으로 GitHub Pages 에 배포 (~1~2분).

## 단어 추가하기

[data/words.js](data/words.js) 의 `WORDS` 배열에 추가:

```js
{ word: "나무", emoji: "🌳", level: 2 },
```

레벨 1~5 (1 = 가장 쉬움, 5 = 가장 어려움). emoji 는 7살이 알아볼 만한 직관적인 것.
