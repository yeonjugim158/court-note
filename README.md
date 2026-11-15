# 코트노트 (Court Note)

국내 농구(KBL, 대학농구 U-리그 남자부) 직관·집관을 달력에 사진 일기로 남기는 웹앱 프로토타입.

## 실행

```bash
npm install
npm run dev
```

- PC: http://localhost:5173
- 아이폰: PC와 같은 와이파이에 연결 후 `http://<PC의 와이파이 IP>:5173`
  (실행 시 터미널에 표시되는 `Network:` 주소)

## 경기 일정 업데이트

| 리그 | 방법 | 이유 |
|---|---|---|
| KBL | **자동** `npm run update:kbl` | kbl.or.kr 공개 일정 페이지를 브라우저로 읽음 (비공개 API 미사용) |
| 대학농구 | **수동** (요청 시 갱신) | kusf.or.kr의 robots.txt가 일반 자동 수집을 막고 있음 |

- `npm run update:kbl`: 지난달~시즌 종료(5월)를 확인하고 바뀐 경기만 반영, 변경 시 `meta.json`의 `updatedAt` 갱신
  - Windows는 Edge, 그 외는 Chrome 사용 (`BROWSER_CHANNEL`로 변경 가능)

## 배포 (GitHub Pages)

`.github/workflows/deploy.yml` 하나가 배포와 일정 업데이트를 모두 맡습니다.

- `main`에 push → 빌드 → GitHub Pages 배포
- 경기 시간대(KST 13:00~00:59) 30분마다 → KBL 일정 확인 → 확인 시각을 넣어 재배포 (바뀐 경기가 있으면 커밋도). 앱에는 "마지막 확인 시각"이 표시됨
- 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정해야 합니다.
- GitHub은 저장소에 60일간 커밋이 없으면 예약 실행을 멈춥니다. 비시즌(6~9월) 후 Actions 탭에서 다시 켜 주세요.

## 구조

| 경로 | 내용 |
|---|---|
| `src/data/teams.js` | 리그·팀·홈구장·팀컬러 |
| `src/data/games.js` | 경기 일정 로딩 |
| `src/data/schedule/meta.json` | 리그별 마지막 업데이트 시각·출처 |
| `scripts/update-kbl.mjs` | KBL 일정 자동 업데이트 스크립트 |
| `src/data/schedule/kbl.json` | KBL 일정·결과 (kbl.or.kr 기준, 2025-26·2026-27) |
| `src/data/schedule/uleague.json` | 대학농구 U-리그 남자부 일정·결과 (kusf.or.kr 기준, 2025·2026) |
| `src/lib/db.js` | 기기 내 저장소 (IndexedDB) |
| `src/lib/backup.js` | 백업 내보내기 / 불러오기 |
| `src/components/` | 달력, 기록 작성, 상세, 기록 목록, 통계, 설정 화면 |

## 메모

- 기록은 접속한 브라우저(기기)에만 저장됩니다. 주소(localhost / IP)가 달라지면 저장소도 따로입니다.
- 일정 JSON 한 줄 형식: `[날짜, 시간, 단계, 홈팀id, 원정팀id, 경기장, 홈점수, 원정점수]` (경기 전 점수는 `null`)
- 단계: `preseason` 오픈매치데이, `regular` 정규, `po` 플레이오프, `final` 챔프전, `semi`/`ufinal` 대학 4강/결승
- 포함하지 않은 경기: KBL D리그·EASL·올스타전 → 앱에서 "직접 입력"으로 기록
- KBL 2026-27 플레이오프 일정은 아직 미발표 (정규리그 종료 2027-04-11)
