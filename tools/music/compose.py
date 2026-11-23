"""Echo Rush 배경음악 작곡기 (2판: 오케스트라·어쿠스틱 편성)
월드 12곡: 고급스럽고 상쾌하게 — 길게 이어지는 현악 화음(7화음), 피아노·하프 펼침화음, 노래하듯 긴 멜로디, 가벼운 타악기.
왕 4곡: 웅장하고 엄습하게 — 낮은 현악 오스티나토, 호른·트롬본·튜바, 합창, 팀파니·타이코.
연주 세기·박자를 사람처럼 미세하게 흔들고, 잔향을 넉넉히 준다. FluidSynth + FluidR3 General MIDI 사운드폰트로 렌더링.
사용:  python3 tools/music/compose.py [곡 id ...]   (없으면 전부)
필요:  pip install mido · apt install fluidsynth fluid-soundfont-gm ffmpeg
결과:  assets/music/<id>.mp3 (32마디, 끊김 없이 반복)"""
import mido, random, subprocess, os, sys, tempfile

SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'music')
SCALES = {'major': [0,2,4,5,7,9,11], 'minor': [0,2,3,5,7,8,10], 'dorian': [0,2,3,5,7,9,10], 'mixolydian': [0,2,4,5,7,9,10],
          'lydian': [0,2,4,6,7,9,11], 'harmonic': [0,2,3,5,7,8,11], 'phrygian': [0,1,3,5,7,8,10]}
TPB = 480; BAR = TPB * 4
# GM 악기 번호 (0부터)
PIANO, EP, CELESTA, GLOCK, MUSICBOX, VIBES, MARIMBA = 0, 4, 8, 9, 10, 11, 12
NYLON, STEEL, ABASS, FRETLESS = 24, 25, 32, 35
STRINGS, SLOWSTR, TREMOLO, PIZZ, HARP, TIMPANI = 48, 49, 44, 45, 46, 47
CHOIR, VOICE, HIT = 52, 53, 55
TRUMPET, TROMBONE, TUBA, HORN, BRASS = 56, 57, 58, 60, 61
OBOE, CLARINET, FLUTE, PANFLUTE = 68, 71, 73, 75
WARMPAD, STEELDRUM, TAIKO = 89, 114, 116
CELLO, CONTRA = 42, 43

# 월드 곡: lead=멜로디, lead2=B구간 멜로디, keys=펼침화음, pad=긴 화음, bass, perc=타악 스타일
WORLD = {
  'school':   dict(bpm=108, root=60, scale='major',      prog=[0,4,5,3], lead=FLUTE,     lead2=CLARINET, keys=PIANO,   pad=STRINGS, bass=PIZZ,     perc='light',  bell=GLOCK,   seed=11),
  'academy':  dict(bpm=100, root=57, scale='dorian',     prog=[0,3,6,4], lead=CLARINET,  lead2=FLUTE,    keys=MARIMBA, pad=STRINGS, bass=FRETLESS, perc='light',  seed=23),
  'office':   dict(bpm=94,  root=53, scale='major',      prog=[1,4,0,5], lead=VIBES,     lead2=FLUTE,    keys=EP,      pad=SLOWSTR, bass=ABASS,    perc='brush',  swing=0.3, seed=37),
  'subway':   dict(bpm=112, root=52, scale='minor',      prog=[0,5,2,6], lead=PIANO,     lead2=OBOE,     keys=HARP,    pad=STRINGS, bass=CELLO,    perc='pulse',  seed=41),
  'home':     dict(bpm=78,  root=61, scale='major',      prog=[3,2,1,4], lead=EP,        lead2=VIBES,    keys=EP,      pad=WARMPAD, bass=FRETLESS, perc='lofi',   seed=53),
  'gym':      dict(bpm=122, root=55, scale='mixolydian', prog=[0,6,3,0], lead=HORN,      lead2=TRUMPET,  keys=PIANO,   pad=STRINGS, bass=ABASS,    perc='drive',  seed=67),
  'library':  dict(bpm=84,  root=62, scale='major',      prog=[0,5,3,4], lead=CELESTA,   lead2=FLUTE,    keys=HARP,    pad=SLOWSTR, bass=CELLO,    perc=None,     seed=71),
  'beach':    dict(bpm=104, root=58, scale='major',      prog=[0,3,4,0], lead=STEELDRUM, lead2=FLUTE,    keys=NYLON,   pad=WARMPAD, bass=ABASS,    perc='island', seed=83),
  'airport':  dict(bpm=106, root=63, scale='lydian',     prog=[0,1,4,0], lead=FLUTE,     lead2=OBOE,     keys=PIANO,   pad=WARMPAD, bass=FRETLESS, perc='light',  bell=CELESTA, seed=97),
  'hospital': dict(bpm=88,  root=57, scale='major',      prog=[0,2,3,4], lead=OBOE,      lead2=CLARINET, keys=HARP,    pad=SLOWSTR, bass=CELLO,    perc=None,     seed=101),
  'mountain': dict(bpm=104, root=50, scale='dorian',     prog=[0,6,3,0], lead=PANFLUTE,  lead2=FLUTE,    keys=STEEL,   pad=STRINGS, bass=ABASS,    perc='folk',   seed=113),
  'stage':    dict(bpm=118, root=64, scale='major',      prog=[0,4,5,3], lead=BRASS,     lead2=STRINGS,  keys=PIANO,   pad=STRINGS, bass=ABASS,    perc='drive',  bell=GLOCK,   seed=127),
}
# 왕 곡: 웅장하고 엄습하게
BOSS = {
  'boss-exam':   dict(bpm=112, root=57, scale='harmonic', prog=[0,0,5,4], progB=[0,3,4,4], ost='16', lead=HORN,     drums='war',    tick=True, seed=201),   # 째깍째깍 시계 + 긴장
  'boss-spiral': dict(bpm=100, root=55, scale='phrygian', prog=[0,1,0,6], progB=[0,1,3,1], ost='trip', lead=CHOIR,   drums='slow',   swirl=True, seed=211),  # 소용돌이 하프·첼레스타 + 합창
  'boss-charge': dict(bpm=132, root=52, scale='minor',    prog=[0,5,6,4], progB=[0,6,5,6], ost='8', lead=TRUMPET,   drums='march',  seed=221),               # 행진 북 + 브라스
  'boss-lane':   dict(bpm=140, root=50, scale='dorian',   prog=[0,6,5,6], progB=[0,3,6,4], ost='16', lead=HORN,     drums='drive2', seed=231),              # 몰아치는 현악
}

def degnote(s, d, base):
    S = SCALES[s['scale']]; o, k = divmod(d, 7); return base + S[k] + 12 * o

def chord(s, deg, kind='7'):
    """음계 도수 → 화음(뿌리 기준). kind: '3'=3화음, '7'=7화음, '9'=add9"""
    r = s['root']
    notes = [degnote(s, deg, r), degnote(s, deg + 2, r), degnote(s, deg + 4, r)]
    if kind in ('7', '9'): notes.append(degnote(s, deg + 6, r))
    if kind == '9': notes.append(degnote(s, deg + 8, r))
    return notes

def voice_lead(prev, target, lo, hi):
    """화음음들을 앞 화음과 가장 가깝게 배치 (부드럽게 이어지는 현악 화음)"""
    pcs = sorted(set(n % 12 for n in target))
    out = []
    ref = prev or [lo + 7, lo + 11, lo + 14, lo + 18]
    for i, pr in enumerate(ref[:len(pcs)]):
        best = None
        for pc in pcs:
            for o in range(lo // 12 - 1, hi // 12 + 2):
                n = pc + 12 * o
                if lo <= n <= hi and n not in out and (best is None or abs(n - pr) < abs(best - pr)): best = n
        out.append(best)
    for pc in pcs:   # 빠진 음이 있으면 채우기
        if not any(n % 12 == pc for n in out):
            n = pc + 12 * ((lo + hi) // 24); out.append(n)
    return sorted(out)

class Song:
    def __init__(self, s): self.s = s; self.ev = {}; self.r = random.Random(s['seed'])
    def add(self, tr, st, dur, n, v):
        r = self.r
        st += int(r.uniform(-8, 8)) if tr not in ('drum', 'perc') else int(r.uniform(-4, 4))   # 사람처럼 미세한 흔들림
        v = max(1, min(127, int(v + r.uniform(-6, 6))))
        self.ev.setdefault(tr, []).append((max(0, int(st)), int(max(40, dur)), max(0, min(127, n)), v))
    def save(self, chans, tempo):
        mid = mido.MidiFile(ticks_per_beat=TPB)
        t0 = mido.MidiTrack(); mid.tracks.append(t0); t0.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(tempo)))
        for name, evs in self.ev.items():
            ch, prog, vol, rev, cho = chans[name]; tr = mido.MidiTrack(); mid.tracks.append(tr)
            if ch != 9: tr.append(mido.Message('program_change', channel=ch, program=prog, time=0))
            for cc, val in ((7, vol), (91, rev), (93, cho), (10, 64)): tr.append(mido.Message('control_change', channel=ch, control=cc, value=val, time=0))
            msgs = []
            for st, dur, n, v in evs:
                msgs.append((st, 1, mido.Message('note_on', channel=ch, note=n, velocity=v)))
                msgs.append((st + dur, 0, mido.Message('note_off', channel=ch, note=n, velocity=0)))
            msgs.sort(key=lambda x: (x[0], x[1])); now = 0
            for at, _, m in msgs: m.time = at - now; now = at; tr.append(m)
        return mid

def melody_phrase(song, start_bar, chords_in_phrase, pool, prev, lead, answer):
    """4마디 노래: 긴 음 위주(2분·점4분·4분), 강박은 화음음, 약박은 이웃음. 대답 구절은 화음 뿌리음으로 끝냄"""
    r = song.r
    rhythms = [[2, 1, 1], [1.5, 0.5, 2], [1, 1, 2], [3, 1], [2, 2], [1, 0.5, 0.5, 2]]
    for bi, ch in enumerate(chords_in_phrase):
        st = (start_bar + bi) * BAR
        last = bi == len(chords_in_phrase) - 1
        rh = [4] if last else r.choice(rhythms)
        t = 0
        for i, beats in enumerate(rh):
            d = int(beats * TPB)
            strong = t % (TPB * 2) == 0
            pcs = [c % 12 for c in ch]
            if last and answer: cands = [p for p in pool if p % 12 == ch[0] % 12]
            elif strong or last: cands = [p for p in pool if p % 12 in pcs[:3]]
            else: cands = [p for p in pool if 0 < abs(p - prev) <= 3]
            if not cands: cands = pool
            n = min(cands, key=lambda x: abs(x - prev) + r.random() * 2.5 + (0.8 if x == prev else 0))
            if r.random() < 0.12 and not strong and not last: t += d; continue
            song.add(lead, st + t, d - 40, n, 78 if strong else 68); prev = n; t += d
    return prev

PERC = {   # 16칸: (악기번호, 패턴, 세기)
  'light':  [(36, 'x.......x.......', 62), (37, '....x.......x...', 46), (70, 'x.x.x.x.x.x.x.x.', 30)],          # 킥·림·마라카스
  'brush':  [(36, 'x.........x.....', 50), (38, '....o.......o...', 36), (51, 'x..xx..xx..xx..x', 40)],          # 재즈: 브러시·라이드
  'pulse':  [(36, 'x...x...x...x...', 58), (37, '....x.......x...', 40), (82, 'x.x.x.x.x.x.x.x.', 30)],          # 도시 맥박
  'lofi':   [(36, 'x......x..x.....', 60), (37, '....x.......x...', 44), (42, '..o...o...o...oo', 26)],
  'drive':  [(36, 'x...x...x...x...', 70), (38, '....x.......x...', 58), (42, 'x.x.x.x.x.x.x.x.', 34)],
  'island': [(36, 'x..x..x...x..x..', 54), (63, '..x...x...x.x...', 44), (70, 'x.x.x.x.x.x.x.x.', 30)],          # 콩가·마라카스
  'folk':   [(36, 'x.....x.x.......', 58), (54, '....x.......x...', 40), (70, 'x.x.x.x.x.x.x.x.', 26)],          # 탬버린
}

def compose_world(sid):
    s = WORLD[sid]; song = Song(s); r = song.r
    A = s['prog'] * 2
    B = [s['prog'][2], s['prog'][3], s['prog'][0], s['prog'][1], s['prog'][2], s['prog'][3], 4, s['prog'][0]]
    form = A + B + A + B
    root = s['root']; S = SCALES[s['scale']]
    pool = [root + iv + 12 * o for o in range(0, 3) for iv in S]; pool = [p for p in pool if root + 7 <= p <= root + 26]
    pad_prev = None; prev = pool[len(pool) // 2]
    for b, deg in enumerate(form):
        st = b * BAR; sec = 'A' if (b % 16) < 8 else 'B'
        ch = chord(s, deg, '7' if (deg % 7) in (0, 3, 1, 5) else '3')
        # 1) 긴 현악 화음 (부드럽게 이어 붙임), B구간은 한 옥타브 위 소리 더해 펼침
        v = voice_lead(pad_prev, ch, root - 5, root + 14); pad_prev = v
        for n in v: song.add('pad', st, BAR - 10, n, 52 if sec == 'A' else 60)
        if sec == 'B': song.add('pad', st, BAR - 10, v[-1] + 12, 44)
        # 2) 펼침화음 (피아노·하프·기타): 8분음표로 1-5-8-10-8-5 … 부드럽게
        arp = [ch[0] - 12, ch[2] - 12, ch[0], ch[1], ch[2], ch[1], ch[0], ch[2] - 12]
        for k in range(8): song.add('keys', st + k * TPB // 2, TPB // 2 + 120, arp[k], 54 if k % 4 == 0 else 44)
        # 3) 베이스: 2분음표 뿌리음 + 5도 (마디 끝에서 다음 화음으로 걸어감)
        bn = ch[0] - 24 if ch[0] - 24 >= root - 28 else ch[0] - 12
        song.add('bass', st, TPB * 2 - 40, bn, 74); song.add('bass', st + TPB * 2, TPB * 1.5, bn + 7, 64)
        song.add('bass', st + TPB * 3.5, TPB // 2 - 30, bn + (2 if r.random() < 0.5 else -1), 54)
        # 4) 꾸밈 종소리 (구절 끝)
        if s.get('bell') is not None and b % 4 == 3: song.add('bell', st + TPB * 3, TPB * 2, ch[0] + 24, 54)
    # 5) 멜로디: 4마디 구절(묻고 답하기)
    for ph in range(0, len(form), 4):
        sec = 'A' if (ph % 16) < 8 else 'B'
        chs = [chord(s, d, '7') for d in form[ph:ph + 4]]
        prev = melody_phrase(song, ph, chs, pool, prev, 'lead' if sec == 'A' else 'lead2', answer=(ph // 4) % 2 == 1)
    # 6) 가벼운 타악기 (A 첫 4마디는 쉬어 숨 쉬듯 시작)
    if s['perc']:
        sw = s.get('swing', 0)
        for b in range(len(form)):
            if b < 2: continue
            st = b * BAR
            for note, pat, vel in PERC[s['perc']]:
                for i, c in enumerate(pat):
                    if c == '.': continue
                    off = st + i * TPB // 4 + (sw * TPB // 4 if i % 2 else 0)
                    song.add('perc', off, 80, note, vel if c == 'x' else vel * 0.65)
            if b in (8, 24): song.add('perc', st, 600, 49, 52)   # 구간 시작: 은은한 심벌
    chans = {'lead': (0, s['lead'], 96, 72, 20), 'lead2': (1, s['lead2'], 92, 72, 20), 'keys': (2, s['keys'], 78, 64, 24), 'pad': (3, s['pad'], 70, 84, 30),
             'bass': (4, s['bass'], 88, 50, 0), 'bell': (5, s.get('bell') or GLOCK, 66, 90, 20), 'perc': (9, 0, 70, 40, 0)}
    return song.save(chans, s['bpm']), len(form) * 4 * 60 / s['bpm']

def compose_boss(sid):
    s = BOSS[sid]; song = Song(s); r = song.r
    A = s['prog'] * 2; B = s['progB'] * 2
    form = A + B + A + B
    root = s['root']
    pad_prev = None; brass_prev = None
    for b, deg in enumerate(form):
        st = b * BAR; sec = 'A' if (b % 16) < 8 else 'B'
        ch = chord(s, deg, '3')
        lo = ch[0] - 24
        # 1) 낮은 현악 오스티나토 (첼로 + 콘트라베이스 옥타브): 쉼 없이 몰아침
        if s['ost'] == '16':
            for k in range(16):
                n = lo + (0 if k % 4 != 3 else (7 if k % 8 == 3 else 12)); acc = k % 4 == 0
                song.add('ost', st + k * TPB // 4, TPB // 4 - 20, n + 12, 92 if acc else 70); song.add('ost2', st + k * TPB // 4, TPB // 4 - 20, n, 84 if acc else 62)
        elif s['ost'] == '8':
            for k in range(8):
                n = lo + (0 if k % 2 == 0 else 7)
                song.add('ost', st + k * TPB // 2, TPB // 2 - 30, n + 12, 92 if k % 2 == 0 else 74); song.add('ost2', st + k * TPB // 2, TPB // 2 - 30, n, 86)
        else:   # trip: 셋잇단 소용돌이
            for k in range(12):
                n = lo + [0, 7, 12][k % 3]
                song.add('ost', st + k * BAR // 12, BAR // 12 - 20, n + 12, 86 if k % 3 == 0 else 64); song.add('ost2', st + k * BAR // 12, BAR // 12 - 20, lo, 70)
        # 2) 합창: 긴 화음 (어둡고 넓게)
        v = voice_lead(pad_prev, ch, root - 3, root + 12); pad_prev = v
        for n in v: song.add('choir', st, BAR - 10, n, 62 if sec == 'A' else 74)
        # 3) 금관 (호른·트롬본) 화음: 2분음표 강세, 튜바는 뿌리음
        bv = voice_lead(brass_prev, ch, root - 12, root + 4); brass_prev = bv
        for half in (0, 1):
            vel = 84 if half == 0 else 72
            for n in bv: song.add('brass', st + half * TPB * 2, TPB * 2 - 60, n, vel)
        song.add('tuba', st, TPB * 2 - 40, lo, 90); song.add('tuba', st + TPB * 2, TPB * 2 - 40, lo, 80)
        # 4) 높은 현악 트레몰로 (A) / 주제 선율 (B: 호른·트럼펫으로 엄숙하게)
        if sec == 'A':
            song.add('trem', st, BAR - 20, ch[2] + 12, 58); song.add('trem', st, BAR - 20, ch[0] + 24, 52)
        if s.get('swirl'):   # 소용돌이: 하프 펼침
            arp = [ch[0], ch[1], ch[2], ch[0] + 12, ch[2], ch[1]]
            for k in range(12): song.add('harp', st + k * BAR // 12, BAR // 12 + 60, arp[k % 6] + 12, 58)
        # 5) 타악: 팀파니·타이코·오케스트라 히트
        if b % 8 == 0: song.add('hit', st, TPB, ch[0], 100)
        for beat in range(4):
            if s['drums'] in ('war', 'march', 'drive2') or beat % 2 == 0:
                song.add('timp', st + beat * TPB, TPB - 40, lo + 12 if beat % 2 == 0 else lo + 19, 96 if beat == 0 else 76)
        if b % 4 == 3:
            for k in range(8): song.add('timp', st + TPB * 2 + k * TPB // 4, TPB // 4, lo + 12, 60 + k * 6)   # 팀파니 롤
        tpat = {'war': 'x..x..x.x...x.x.', 'slow': 'x.......x..x....', 'march': 'x.x.x.x.x.x.xxx.', 'drive2': 'x..xx..xx..xx.xx'}[s['drums']]
        for i, c in enumerate(tpat):
            if c == 'x': song.add('taiko', st + i * TPB // 4, 200, 60, 96 if i % 4 == 0 else 74)
        if s['drums'] == 'march':
            for i in range(16): song.add('drum', st + i * TPB // 4, 60, 38, 70 if i % 4 == 0 else 40)   # 행진 스네어
        if s.get('tick'):
            for i in range(8): song.add('drum', st + i * TPB // 2, 60, 76 if i % 2 == 0 else 77, 70)   # 째깍째깍 (우드블록)
    # 주제 선율 (B 구간): 엄숙한 2분·점4분 리듬, 화음 뿌리음·5도 위주로 무겁게
    for ph in range(0, len(form), 4):
        if (ph % 16) < 8: continue
        for bi, deg in enumerate(form[ph:ph + 4]):
            st = (ph + bi) * BAR; ch = chord(s, deg, '3'); top = ch[0] + 12
            rh = [(0, 2, top), (2, 1.5, ch[2] + 12 if ch[2] + 12 - top < 9 else ch[2]), (3.5, 0.5, ch[1] + 12)] if bi % 2 == 0 else [(0, 3, ch[2] + 12 if ch[2] < ch[0] + 8 else ch[2]), (3, 1, top)]
            for at, beats, n in rh: song.add('lead', st + int(at * TPB), int(beats * TPB) - 40, n, 96)
    chans = {'ost': (0, CELLO, 100, 50, 0), 'ost2': (1, CONTRA, 96, 50, 0), 'choir': (2, CHOIR, 84, 90, 20), 'brass': (3, TROMBONE, 88, 70, 10),
             'tuba': (4, TUBA, 90, 60, 0), 'trem': (5, TREMOLO, 70, 80, 10), 'harp': (6, HARP, 78, 80, 10), 'timp': (7, TIMPANI, 104, 70, 0),
             'taiko': (8, TAIKO, 92, 60, 0), 'hit': (10, HIT, 84, 80, 0), 'lead': (11, s['lead'], 100, 70, 10), 'drum': (9, 0, 82, 50, 0)}
    return song.save(chans, s['bpm']), len(form) * 4 * 60 / s['bpm']

def render(sid):
    mid, L = (compose_boss if sid in BOSS else compose_world)(sid)
    with tempfile.TemporaryDirectory() as d:
        mp, wav, loop = os.path.join(d, 'a.mid'), os.path.join(d, 'a.wav'), os.path.join(d, 'l.wav')
        mid.save(mp)
        subprocess.run(['fluidsynth', '-ni', '-g', '0.6', '-r', '44100', '-R', '1', '-C', '1', '-F', wav, SF2, mp], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        lufs = -18 if sid in BOSS else -20
        eq = os.path.join(d, 'eq.wav')
        # 1) 음색 다듬기: 아주 낮은 웅웅거림 제거 · 탁한 중저음 살짝 줄이고 · 고음 살짝 밝게
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af', 'highpass=f=35,equalizer=f=300:t=q:w=1:g=-1.5,equalizer=f=9000:t=q:w=1:g=1.5', eq], check=True)
        # 2) 끝의 울림을 곡 처음에 겹쳐 끊김 없이 반복 + 음량 맞춤
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-t', f'{L:.4f}', '-i', eq, '-ss', f'{L:.4f}', '-i', eq,
                        '-filter_complex', f'[0][1]amix=inputs=2:duration=first:normalize=0,loudnorm=I={lufs}:TP=-1.5[o]', '-map', '[o]', '-ar', '44100', loop], check=True)
        os.makedirs(OUT, exist_ok=True)
        dst = os.path.join(OUT, sid + '.mp3')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', loop, '-c:a', 'libmp3lame', '-b:a', '96k', dst], check=True)
    print(f'{sid:13s} {L:5.1f}s  {os.path.getsize(dst) // 1024} KB')

if __name__ == '__main__':
    for sid in (sys.argv[1:] or list(WORLD) + list(BOSS)): render(sid)
