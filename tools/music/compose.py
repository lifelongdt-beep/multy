"""Echo Rush 배경음악 작곡기 (3판)
월드 12곡 + 메인 화면 1곡: 조용하지만 상큼하고 신나게 — 밝은 장조, 통통 튀는 리듬(엇박·스트럼·보사노바·피치카토), 장조 5음계 멜로디, 월드마다 다른 악기.
왕 4곡: 정말 무섭게 — 낮은 현악 오스티나토·금관·팀파니·타이코에 불협화음 합창, 소름 돋는 첼레스타, 효과음 신스, 심장 박동, 시타르 등.
연주 세기·박자를 사람처럼 미세하게 흔든다. FluidSynth + FluidR3 General MIDI 사운드폰트로 렌더링.
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
HARPSI, CLAV, XYLO, ACCORDION, HARMONICA, MUTEGTR, SLAP, FINGER = 6, 7, 13, 21, 22, 28, 36, 33
PICCOLO, WHISTLE, KALIMBA, BANJO, SITAR, FIDDLE, SYNBRASS = 72, 78, 108, 105, 104, 110, 62
ATMOS, GOBLIN, ECHOFX, SWEEP, VOICEOOH, SYNBASS = 99, 101, 102, 95, 53, 38
CELLO, CONTRA = 42, 43

# 월드 곡 (+ 메인 화면): lead=멜로디(A), lead2=멜로디(B), comp=반주 악기·스타일, bass=베이스 악기·스타일, bell=꾸밈, perc=타악 스타일
WORLD = {
  'menu':     dict(bpm=116, root=65, scale='major',      prog=[0,4,5,3], lead=WHISTLE,   lead2=GLOCK,    comp=(NYLON, 'strum'),   bass=(ABASS, 'bounce'),  bell=GLOCK,   perc='clap',   seed=7),    # 메인: 휘슬·기타 스트럼·글로켄
  'school':   dict(bpm=120, root=60, scale='major',      prog=[0,4,5,3], lead=XYLO,      lead2=PICCOLO,  comp=(PIZZ, 'offbeat'),  bass=(PIZZ, 'bounce'),   bell=GLOCK,   perc='clap',   seed=11),   # 아침 등교: 실로폰·피콜로·피치카토
  'academy':  dict(bpm=112, root=67, scale='major',      prog=[0,3,4,0], lead=MARIMBA,   lead2=KALIMBA,  comp=(HARPSI, 'arp'),     bass=(FINGER, 'bounce'), bell=None,    perc='tick',   seed=23),   # 사각사각 공부: 마림바·칼림바·하프시코드·우드블록
  'office':   dict(bpm=120, root=53, scale='major',      prog=[1,4,0,5], lead=VIBES,     lead2=CLARINET, comp=(EP, 'jazz'),       bass=(ABASS, 'walk'),    bell=None,    perc='brush',  swing=0.3, seed=37),   # 경쾌한 재즈 업무
  'subway':   dict(bpm=126, root=64, scale='mixolydian', prog=[0,6,3,0], lead=HARMONICA, lead2=WHISTLE,  comp=(MUTEGTR, 'chug'),   bass=(SLAP, 'bounce'),   bell=None,    perc='train',  seed=41),   # 덜컹덜컹 퇴근길: 하모니카·뮤트 기타
  'home':     dict(bpm=104, root=61, scale='major',      prog=[0,5,1,4], lead=EP,        lead2=MUSICBOX, comp=(NYLON, 'bossa'),   bass=(FINGER, 'bossa'),  bell=None,    perc='bossa',  seed=53),   # 포근한 저녁 보사노바
  'gym':      dict(bpm=128, root=55, scale='mixolydian', prog=[0,6,3,0], lead=TRUMPET,   lead2=SYNBRASS, comp=(BRASS, 'offbeat'), bass=(SLAP, 'bounce'),   bell=None,    perc='dance',  seed=67),   # 운동 에너지: 브라스 스탭
  'library':  dict(bpm=108, root=62, scale='major',      prog=[0,5,3,4], lead=MUSICBOX,  lead2=CELESTA,  comp=(PIZZ, 'pizz'),     bass=(PIZZ, 'bounce'),   bell=None,    perc='tri',    seed=71),   # 조용하고 상큼한 오르골
  'beach':    dict(bpm=112, root=58, scale='major',      prog=[0,3,4,0], lead=STEELDRUM, lead2=WHISTLE,  comp=(NYLON, 'strum'),   bass=(ABASS, 'bounce'),  bell=MARIMBA, perc='island', seed=83),   # 칼립소: 스틸드럼·휘슬·콩가
  'airport':  dict(bpm=116, root=63, scale='lydian',     prog=[0,1,4,0], lead=FLUTE,     lead2=GLOCK,    comp=(PIANO, 'offbeat'), bass=(FRETLESS, 'bounce'), bell=CELESTA, perc='light', seed=97),  # 설레는 여행: 플루트·피아노 엇박
  'hospital': dict(bpm=100, root=57, scale='major',      prog=[0,2,3,4], lead=KALIMBA,   lead2=OBOE,     comp=(HARP, 'arp'),      bass=(PIZZ, 'bounce'),   bell=None,    perc='tri',    seed=101),  # 따뜻한 회복: 칼림바·하프
  'mountain': dict(bpm=118, root=62, scale='mixolydian', prog=[0,6,3,0], lead=FIDDLE,    lead2=PANFLUTE, comp=(BANJO, 'arp'),     bass=(ABASS, 'bounce'),  bell=None,    perc='folk',   seed=113),  # 하이킹: 밴조·피들·팬플루트
  'stage':    dict(bpm=124, root=64, scale='major',      prog=[0,4,5,3], lead=BRASS,     lead2=ACCORDION, comp=(PIANO, 'offbeat'), bass=(FINGER, 'bounce'), bell=GLOCK,   perc='dance',  seed=127),  # 축제 무대: 브라스·피아노·글로켄
}
# 왕 곡: 정말 무섭게 (다양한 공포 악기)
BOSS = {
  'boss-exam':   dict(bpm=120, root=57, scale='harmonic', prog=[0,0,5,4], progB=[0,1,4,4], ost='16', lead=HORN,    drums='war',    extras=['tick', 'creep', 'heart'], seed=201),   # 시험: 째깍째깍 시계·소름 돋는 첼레스타·심장 박동
  'boss-spiral': dict(bpm=100, root=55, scale='phrygian', prog=[0,1,0,6], progB=[0,1,3,1], ost='trip', lead=SITAR,  drums='slow',   extras=['swirl', 'fx', 'creep'], seed=211),      # 나선: 시타르·하프 소용돌이·효과음 신스
  'boss-charge': dict(bpm=140, root=52, scale='minor',    prog=[0,5,6,4], progB=[0,1,6,4], ost='8', lead=TRUMPET,   drums='march',  extras=['heart', 'stab'], seed=221),              # 돌진: 트럼펫·행진 북·금관 스탭
  'boss-lane':   dict(bpm=150, root=50, scale='minor',    prog=[0,6,5,6], progB=[0,1,6,4], ost='16', lead=SYNBRASS, drums='drive2', extras=['growl', 'fx'], seed=231),               # 레인: 몰아치는 현악·거친 신스
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

PERC = {   # 16칸: (드럼 번호, 패턴, 세기) — 조용하지만 통통 튀게
  'clap':   [(36, 'x.......x.......', 58), (39, '....x.......x...', 46), (70, 'x.x.x.x.x.x.x.x.', 26)],          # 킥·박수·마라카스
  'tick':   [(36, 'x.......x.......', 50), (76, '..x...x...x...x.', 44), (77, 'x.......x.......', 30), (70, 'x.x.x.x.x.x.x.x.', 22)],   # 우드블록 째깍
  'brush':  [(36, 'x.........x.....', 50), (38, '....o.......o...', 36), (51, 'x..xx..xx..xx..x', 40)],          # 재즈 브러시·라이드
  'train':  [(36, 'x...x...x...x...', 54), (39, '....x.......x...', 40), (82, 'xoxoxoxoxoxoxoxo', 30)],          # 덜컹덜컹 셰이커
  'bossa':  [(36, 'x..x....x..x....', 50), (37, '..x..x....x..x..', 40), (70, 'x.x.x.x.x.x.x.x.', 24)],          # 보사노바
  'dance':  [(36, 'x...x...x...x...', 62), (39, '....x.......x...', 52), (42, '..x...x...x...x.', 34)],
  'tri':    [(81, 'x.......x.......', 34), (70, '..x...x...x...x.', 22)],                                            # 트라이앵글
  'island': [(36, 'x..x..x...x..x..', 52), (63, '..x...x...x.x...', 44), (75, 'x..x..x...x.....', 40), (70, 'x.x.x.x.x.x.x.x.', 26)],   # 콩가·클라베스
  'light':  [(36, 'x.......x.......', 54), (37, '....x.......x...', 40), (70, 'x.x.x.x.x.x.x.x.', 26)],
  'folk':   [(36, 'x.....x.x.......', 56), (54, '....x.......x...', 42), (70, 'x.x.x.x.x.x.x.x.', 24)],          # 탬버린
}
PENTA_MAJOR = {0, 2, 4, 7, 9}   # 장조 5음계: 밝고 상큼

def comp_part(song, style, st, ch, root):
    """반주 스타일: 짧고 통통 튀게 (우울하지 않게 긴 음을 피함)"""
    up = [n + 12 for n in ch[:3]]
    if style == 'offbeat':   # 엇박 화음 (따-닥 따-닥)
        for k in range(4):
            for n in up: song.add('comp', st + k * TPB + TPB // 2, TPB // 3, n, 52)
    elif style == 'strum':   # 기타 스트럼: 다운·다운업·업다운업
        for at, v in ((0, 58), (1, 50), (1.5, 44), (2.5, 46), (3, 52), (3.5, 44)):
            for i, n in enumerate(sorted(ch[:3] + [ch[0] + 12])): song.add('comp', st + int(at * TPB) + i * 12, TPB // 2, n, v)
    elif style == 'bossa':   # 보사노바 당김음
        for at in (0, 1.5, 3, 3.5 - 1, 2.5):
            for n in ch: song.add('comp', st + int(at * TPB), TPB // 2, n, 46)
    elif style == 'arp':     # 16분음표 통통 펼침 (하프시코드·밴조·하프)
        pat = [ch[0], ch[2], up[0], ch[1] + 12, up[2], ch[1] + 12, up[0], ch[2]]
        for k in range(16): song.add('comp', st + k * TPB // 4, TPB // 4, pat[k % 8], 50 if k % 4 == 0 else 38)
    elif style == 'pizz':    # 피치카토 8분음표
        pat = [ch[0], ch[2], up[0], ch[2], ch[1], ch[2], up[0], ch[2]]
        for k in range(8): song.add('comp', st + k * TPB // 2, TPB // 3, pat[k] + 12, 52 if k % 2 == 0 else 42)
    elif style == 'chug':    # 뮤트 기타 덜컹덜컹
        for k in range(8):
            for n in (ch[0], ch[2]): song.add('comp', st + k * TPB // 2, TPB // 4, n, 54 if k % 2 == 0 else 40)
    elif style == 'jazz':    # 재즈 컴핑 (2·4박, 7화음)
        for at in (1, 2.5, 3):
            for n in ch: song.add('comp', st + int(at * TPB), TPB // 2, n + 12, 46)

def bass_part(song, style, st, ch, nxt, root):
    bn = ch[0] - 12 if ch[0] - 12 >= root - 20 else ch[0]
    bn -= 12
    if style == 'walk':      # 재즈 워킹: 4분음표로 다음 화음까지 걸어감
        tgt = nxt[0] - 24
        for k, n in enumerate([bn, bn + 4, bn + 7, tgt + (1 if tgt < bn else -1)]): song.add('bass', st + k * TPB, TPB - 40, n, 70)
    elif style == 'bossa':
        for at, n, d in ((0, bn, 1.4), (1.5, bn + 7, 0.5), (2, bn + 7, 1.4), (3.5, bn, 0.5)): song.add('bass', st + int(at * TPB), int(d * TPB), n, 66)
    else:                    # 통통: 뿌리음 · 옥타브 · 5도 · 다가가는 음
        for at, n, d in ((0, bn, 0.7), (1.5, bn + 12, 0.4), (2, bn + 7, 0.7), (3, bn, 0.4), (3.5, bn + 12, 0.4)): song.add('bass', st + int(at * TPB), int(d * TPB), n, 70)

def melody_bright(song, ph, form, s, pool, prev, lead):
    """상큼한 멜로디: 8분음표·당김음 리듬, 장조 5음계 음을 강박에, 짧게 끊어 통통 튀게. 4마디 구절의 끝은 화음음으로 길게"""
    r = song.r
    rhythms = [[0.5, 0.5, 1, 0.5, 1, 0.5], [1, 0.5, 0.5, 1, 1], [0.75, 0.25, 0.5, 0.5, 1, 1], [0.5, 1, 0.5, 0.5, 0.5, 1], [1.5, 0.5, 1, 1]]
    motif = [r.choice(rhythms), r.choice(rhythms)]
    S = SCALES[s['scale']]
    for bi, deg in enumerate(form[ph:ph + 4]):
        st = (ph + bi) * BAR; ch = chord(s, deg, '3'); pcs = [c % 12 for c in ch]
        last = bi == 3; rh = [1, 1, 2] if last else motif[bi % 2]; t = 0
        for beats in rh:
            d = int(beats * TPB); strong = t % TPB == 0
            if strong: cands = [p for p in pool if p % 12 in pcs and ((p - s['root']) % 12) in PENTA_MAJOR | {pcs[0] - s['root'] % 12}] or [p for p in pool if p % 12 in pcs]
            else: cands = [p for p in pool if 0 < abs(p - prev) <= 4 and ((p - s['root']) % 12) in PENTA_MAJOR] or pool
            n = min(cands, key=lambda x: abs(x - prev) + r.random() * 3 + (1 if x == prev else 0))
            if r.random() < 0.1 and not strong: t += d; continue
            stacc = 0.95 if (last and beats >= 2) else 0.6   # 짧게 끊어 상큼하게
            song.add(lead, st + t, int(d * stacc), n, 74 if strong else 64); prev = n; t += d
    return prev

def compose_world(sid):
    s = WORLD[sid]; song = Song(s); r = song.r
    A = s['prog'] * 2
    B = [s['prog'][2], s['prog'][3], s['prog'][0], s['prog'][1], s['prog'][2], s['prog'][3], 4, s['prog'][0]]
    form = A + B + A + B
    root = s['root']; S = SCALES[s['scale']]
    pool = [root + iv + 12 * o for o in range(0, 3) for iv in S]; pool = [p for p in pool if root + 7 <= p <= root + 26]
    prev = pool[len(pool) // 2]
    for b, deg in enumerate(form):
        st = b * BAR; sec = 'A' if (b % 16) < 8 else 'B'
        ch = chord(s, deg, '7' if s['comp'][1] in ('jazz', 'bossa') else '3')
        nxt = chord(s, form[(b + 1) % len(form)], '3')
        comp_part(song, s['comp'][1], st, ch, root)
        bass_part(song, s['bass'][1], st, ch, nxt, root)
        if s.get('bell') is not None and b % 2 == 1:   # 꾸밈: 짧은 반짝 두 음
            song.add('bell', st + TPB * 3, TPB // 2, ch[2] + 24, 50); song.add('bell', st + TPB * 3 + TPB // 2, TPB // 2, ch[0] + 24, 46)
        if sec == 'B' and b % 4 == 0:   # B구간: 가벼운 높은 현 화음이 살짝 (밝게 펼침, 짧게)
            for n in ch[:3]: song.add('pad', st, TPB * 2, n + 12, 34)
    for ph in range(0, len(form), 4):
        sec = 'A' if (ph % 16) < 8 else 'B'
        prev = melody_bright(song, ph, form, s, pool, prev, 'lead' if sec == 'A' else 'lead2')
    if s['perc']:
        sw = s.get('swing', 0)
        for b in range(len(form)):
            st = b * BAR
            for note, pat, vel in PERC[s['perc']]:
                for i, c in enumerate(pat):
                    if c == '.': continue
                    off = st + i * TPB // 4 + (sw * TPB // 4 if i % 2 else 0)
                    song.add('perc', off, 80, note, vel if c == 'x' else vel * 0.65)
            if b in (8, 24): song.add('perc', st, 600, 49, 44)
    chans = {'lead': (0, s['lead'], 96, 48, 10), 'lead2': (1, s['lead2'], 92, 48, 10), 'comp': (2, s['comp'][0], 80, 40, 14), 'pad': (3, STRINGS, 60, 60, 20),
             'bass': (4, s['bass'][0], 90, 30, 0), 'bell': (5, s.get('bell') or GLOCK, 64, 60, 10), 'perc': (9, 0, 72, 30, 0)}
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
        if sec == 'B': song.add('choir', st, BAR - 10, v[0] + 1, 58)   # 반음 부딪힘(불협화음): 소름 돋게
        # 3) 금관 (호른·트롬본) 화음: 2분음표 강세, 튜바는 뿌리음
        bv = voice_lead(brass_prev, ch, root - 12, root + 4); brass_prev = bv
        for half in (0, 1):
            vel = 84 if half == 0 else 72
            for n in bv: song.add('brass', st + half * TPB * 2, TPB * 2 - 60, n, vel)
        song.add('tuba', st, TPB * 2 - 40, lo, 90); song.add('tuba', st + TPB * 2, TPB * 2 - 40, lo, 80)
        # 4) 높은 현악 트레몰로 (A) / 주제 선율 (B: 호른·트럼펫으로 엄숙하게)
        if sec == 'A':
            song.add('trem', st, BAR - 20, ch[2] + 12, 58); song.add('trem', st, BAR - 20, ch[0] + 24, 52)
        ex = s.get('extras', [])
        if 'swirl' in ex:   # 소용돌이: 하프 펼침
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
        if 'tick' in ex:
            for i in range(8): song.add('drum', st + i * TPB // 2, 60, 76 if i % 2 == 0 else 77, 70)   # 째깍째깍 (우드블록)
        # 공포 꾸밈들
        if 'creep' in ex and b % 2 == 0:   # 소름 돋는 첼레스타: 높은 곳에서 반음씩 어긋나는 오르골
            for k, n in enumerate([ch[0] + 24, ch[0] + 25, ch[2] + 24, ch[0] + 25]): song.add('creep', st + k * TPB, TPB - 60, n, 50)
        if 'heart' in ex:   # 심장 박동 (쿵-쿵, 낮게)
            for at in (0, 0.35, 2, 2.35): song.add('drum', st + int(at * TPB), 120, 35, 88 if at in (0, 2) else 66)
        if 'fx' in ex and b % 4 == 0:   # 효과음 신스: 으스스한 공기 · 도깨비 소리
            song.add('fx', st, BAR * 4 - 40, ch[0], 70); song.add('fx2', st + TPB * 2, BAR * 2, ch[0] + 13, 56)
        if 'growl' in ex:   # 거친 신스 베이스 8분음표
            for k in range(8): song.add('growl', st + k * TPB // 2, TPB // 2 - 40, lo + (12 if k % 4 == 2 else 0), 80)
        if 'stab' in ex and b % 2 == 1:   # 금관 스탭 (빠-밤!)
            for n in bv: song.add('stabs', st + TPB * 3, TPB // 3, n + 12, 104); song.add('stabs', st + TPB * 3 + TPB // 2, TPB // 3, n + 12, 110)
    # 주제 선율 (B 구간): 엄숙한 2분·점4분 리듬, 화음 뿌리음·5도 위주로 무겁게
    for ph in range(0, len(form), 4):
        if (ph % 16) < 8: continue
        for bi, deg in enumerate(form[ph:ph + 4]):
            st = (ph + bi) * BAR; ch = chord(s, deg, '3'); top = ch[0] + 12
            rh = [(0, 2, top), (2, 1.5, ch[2] + 12 if ch[2] + 12 - top < 9 else ch[2]), (3.5, 0.5, ch[1] + 12)] if bi % 2 == 0 else [(0, 3, ch[2] + 12 if ch[2] < ch[0] + 8 else ch[2]), (3, 1, top)]
            for at, beats, n in rh: song.add('lead', st + int(at * TPB), int(beats * TPB) - 40, n, 96)
    chans = {'ost': (0, CELLO, 100, 50, 0), 'ost2': (1, CONTRA, 96, 50, 0), 'choir': (2, CHOIR, 84, 90, 20), 'brass': (3, TROMBONE, 88, 70, 10),
             'tuba': (4, TUBA, 90, 60, 0), 'trem': (5, TREMOLO, 70, 80, 10), 'harp': (6, HARP, 78, 80, 10), 'timp': (7, TIMPANI, 104, 70, 0),
             'taiko': (8, TAIKO, 92, 60, 0), 'hit': (10, HIT, 84, 80, 0), 'lead': (11, s['lead'], 100, 70, 10), 'drum': (9, 0, 82, 50, 0),
             'creep': (12, CELESTA, 76, 100, 30), 'fx': (13, ATMOS, 70, 90, 30), 'fx2': (14, GOBLIN, 64, 90, 30), 'growl': (15, SYNBASS, 84, 30, 0), 'stabs': (15, BRASS, 96, 60, 0)}
    return song.save(chans, s['bpm']), len(form) * 4 * 60 / s['bpm']

def render(sid):
    mid, L = (compose_boss if sid in BOSS else compose_world)(sid)
    with tempfile.TemporaryDirectory() as d:
        mp, wav, loop = os.path.join(d, 'a.mid'), os.path.join(d, 'a.wav'), os.path.join(d, 'l.wav')
        mid.save(mp)
        subprocess.run(['fluidsynth', '-ni', '-g', '0.6', '-r', '44100', '-R', '1', '-C', '1', '-F', wav, SF2, mp], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        lufs = -17 if sid in BOSS else -21   # 월드는 조용하게, 왕은 크게
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
