# 구글 플레이 출시 순서 (유료 앱)

이 저장소는 안드로이드 앱을 **자동으로** 만들어요. main에 병합할 때마다 GitHub가
`echo-rush-test.apk`(폰에 바로 깔아 보는 시험용)와 `echo-rush-release.aab`(플레이 등록용)를 만듭니다.
아래는 **직접 해 주셔야 하는 일**이에요.

---

## 1. 시험용 APK를 폰에 깔아 보기 (지금 바로 가능)
1. GitHub 저장소 → **Actions** 탭 → 맨 위 **Android build** (초록 체크) 클릭
2. 아래 **Artifacts**의 `echo-rush-android-번호` 내려받기 → 압축 풀기
3. `echo-rush-test.apk`를 폰으로 옮겨 열기 (처음엔 "출처를 알 수 없는 앱 설치 허용"을 물어봐요)

## 2. 구글 플레이 개발자 계정 만들기
- https://play.google.com/console 에서 가입, 등록비 **25달러 (한 번만)**
- 개인 계정은 신분증 확인이 필요해요
- **유료 앱**을 팔려면 콘솔의 **결제 프로필(판매자 계정)**도 만들어야 해요 (정산 받을 은행 계좌)

## 3. 앱 서명 열쇠(업로드 키) 만들기 — 한 번만
플레이에 올리는 파일은 내 열쇠로 서명해야 해요. 열쇠는 **저장소에 올리지 않고** GitHub 비밀 값으로만 넣어요.

**PC에 Java(또는 안드로이드 스튜디오)가 있으면** 명령 창에서:
```
keytool -genkeypair -v -keystore echo-rush-upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
```
- 비밀번호 2개(열쇠 묶음·열쇠)와 이름 등을 물어봐요. **비밀번호와 파일은 꼭 따로 보관**하세요.
- 파일을 글자로 바꾸기 (비밀 값에 넣으려고):
  - 맥/리눅스: `base64 -i echo-rush-upload.keystore | pbcopy` (또는 `base64 -w0 echo-rush-upload.keystore`)
  - 윈도우 PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("echo-rush-upload.keystore")) | Set-Clipboard`

> 열쇠를 잃어버려도 괜찮아요: 플레이의 **앱 서명(Play App Signing)**을 쓰면 실제 서명 열쇠는 구글이 보관하고,
> 업로드 키는 콘솔에서 재설정을 요청할 수 있어요.

## 4. GitHub에 비밀 값 4개 넣기
저장소 → **Settings → Secrets and variables → Actions → New repository secret**

| 이름 | 값 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | 3번에서 글자로 바꾼 열쇠 파일 |
| `ANDROID_KEYSTORE_PASSWORD` | 열쇠 묶음 비밀번호 |
| `ANDROID_KEY_ALIAS` | `upload` (위 명령의 -alias 값) |
| `ANDROID_KEY_PASSWORD` | 열쇠 비밀번호 |

넣은 뒤 Actions → Android build → **Run workflow**를 누르면 서명된 `echo-rush-release.aab`가 나와요.

## 5. 플레이 콘솔에서 앱 만들기
1. **앱 만들기** → 이름 "에코 러시", 기본 언어 한국어, **게임**, **유료**
   - ⚠ 무료로 출시한 앱은 나중에 유료로 못 바꿔요. 처음부터 **유료**로.
2. **스토어 등록정보**: `docs/store/listing-ko.md`의 글과 `docs/store/`의 그림을 그대로 넣기
3. **앱 콘텐츠**: 개인정보 처리방침 주소, 데이터 보안(수집 없음), 콘텐츠 등급 설문, 광고 없음, 대상 연령
4. **가격**: 수익 창출 → 앱 가격 (국가별 가격은 자동 환산)

## 6. 비공개 테스트 → 정식 출시
- 새로 만든 **개인 개발자 계정**은 정식 출시 전에 **비공개 테스트를 테스터 12명 이상, 14일 연속**으로 해야 해요
  (2026년 기준 정책 — 콘솔 안내를 꼭 확인하세요). 친구 테스트를 이걸로 하면 딱 좋아요.
- **테스트 → 비공개 테스트 → 새 버전 만들기** → `echo-rush-release.aab` 올리기 → 테스터 이메일 등록
- 14일이 지나면 콘솔에서 **프로덕션 출시 신청** → 구글 검토(보통 며칠) → 출시

## 7. 웹 버전과 유료 앱
지금 공개 주소(https://lifelongdt-beep.github.io/multy/)에서는 누구나 **무료로 전체 게임**을 할 수 있어요.
유료 앱을 판다면 출시 전에 정해야 해요:
- **웹은 체험판으로**: 예) 학교·학원 두 월드만 열고 "전체 게임은 앱에서" 안내
- **웹 공개 중단**: GitHub Pages 끄기 (친구 테스트가 끝난 뒤)
