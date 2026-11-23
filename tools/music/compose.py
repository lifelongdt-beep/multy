"""Echo Rush 배경음악 작곡기: 월드 12곡 + 왕 4곡을 MIDI로 만들고 FluidSynth(General MIDI 사운드폰트)로 실제 악기 소리로 렌더링한다.
사용:  python3 tools/music/compose.py [곡 id ...]   (없으면 전부)
필요:  pip install mido · apt install fluidsynth fluid-soundfont-gm ffmpeg
곡 설계(조·빠르기·화음 진행·드럼)는 src/music.js 의 SONGS / BOSS_STYLE 과 같게 맞췄다. 결과: assets/music/<id>.mp3 (32마디, 끊김 없이 반복)"""
import mido, random, subprocess, os, sys, tempfile

SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'music')
SCALES = {'major': [0,2,4,5,7,9,11], 'minor': [0,2,3,5,7,8,10], 'dorian': [0,2,3,5,7,9,10], 'mixolydian': [0,2,4,5,7,9,10],
          'lydian': [0,2,4,6,7,9,11], 'harmonic': [0,2,3,5,7,8,11], 'phrygian': [0,1,3,5,7,8,10]}
D = {   # music.js 의 드럼 패턴 (16칸, x 강 / o 약)
  'pop':     ('x.......x.o.....', '....x.......x...', 'x.x.x.x.x.x.x.x.'), 'soft':  ('x.........x.....', '....o.......o...', '..o...o...o...o.'),
  'swing':   ('x.....x...x.....', '....x.......x..o', 'x..ox..ox..ox..o'), 'train': ('x...x...x...x...', '....x.......x...', 'xoxoxoxoxoxoxoxo'),
  'lofi':    ('x......x..x.....', '....x.......x...', '..o...o...o...oo'), 'dance': ('x...x...x...x...', '....x.......x...', '..x...x...x...x.'),
  'box':     ('x...............', '................', '....o.......o...'), 'tropic':('x..x..x...x..x..', '....x.......x...', 'x.oxx.oxx.oxx.ox'),
  'air':     ('x.......x.......', '....o.......o...', 'o.o.o.o.o.o.o.o.'), 'gentle':('x.......x.......', '........o.......', '..o...o...o...o.'),
  'folk':    ('x.....x.x.......', '....x.......x...', 'x.xxx.xxx.xxx.xx'), 'rock':  ('x.x...x.x.x.....', '....x.......x...', 'xxxxxxxxxxxxxxxx'),
  'boss':    ('x...x...x...x.x.', '....x.......x.xx', 'xxxxxxxxxxxxxxxx'), 'spiral':('x..x..x...x..x..', '....x.......x...', 'x.xxx.xxx.xxx.xx'),
  'march':   ('x.x.x.x.x.x.x.x.', '....x..x....x.xx', 'x.x.x.x.x.x.x.x.'), 'express':('x..xx..xx..xx..x', '....x.......x...', 'xoxxxoxxxoxxxoxx'),
}
# 악기: General MIDI 번호(0부터). lead=A구간 멜로디, lead2=B구간 멜로디, chords=화음, bass=베이스, extra=B구간 꾸밈(없으면 None)
SONGS = {
  'school':   dict(bpm=112, root=60, scale='major',      prog=[0,4,5,3], style='melody', drums='pop',    seed=11,  lead=9,   lead2=73,  chords=0,  bass=33, extra=45),   # 글로켄슈필·플루트·피아노·피치카토
  'academy':  dict(bpm=100, root=57, scale='dorian',     prog=[0,3,6,4], style='arp',    drums='soft',   seed=23,  lead=12,  lead2=71,  chords=4,  bass=35, extra=None), # 마림바·클라리넷·일렉피아노
  'office':   dict(bpm=96,  root=53, scale='major',      prog=[1,4,0,5], style='melody', drums='swing',  seed=37,  lead=11,  lead2=59,  chords=4,  bass=32, extra=None, seven=True, swing=0.33),   # 비브라폰·뮤트 트럼펫 (재즈)
  'subway':   dict(bpm=120, root=52, scale='minor',      prog=[0,5,2,6], style='arp',    drums='train',  seed=41,  lead=27,  lead2=81,  chords=48, bass=34, extra=None), # 클린 기타·신스 리드·현악
  'home':     dict(bpm=80,  root=61, scale='major',      prog=[3,2,1,4], style='bell',   drums='lofi',   seed=53,  lead=10,  lead2=4,   chords=4,  bass=33, extra=None, seven=True),   # 오르골·일렉피아노 (로파이)
  'gym':      dict(bpm=128, root=55, scale='mixolydian', prog=[0,6,3,0], style='melody', drums='dance',  seed=67,  lead=80,  lead2=61,  chords=61, bass=38, extra=None), # 신스 리드·브라스
  'library':  dict(bpm=88,  root=62, scale='major',      prog=[0,5,3,4], style='bell',   drums='box',    seed=71,  lead=10,  lead2=8,   chords=46, bass=42, extra=None), # 오르골·첼레스타·하프·첼로
  'beach':    dict(bpm=104, root=58, scale='major',      prog=[0,3,4,0], style='melody', drums='tropic', seed=83,  lead=114, lead2=73,  chords=24, bass=32, extra=None), # 스틸드럼·플루트·나일론 기타
  'airport':  dict(bpm=110, root=63, scale='lydian',     prog=[0,1,4,0], style='arp',    drums='air',    seed=97,  lead=8,   lead2=73,  chords=89, bass=35, extra=None), # 첼레스타·플루트·따뜻한 패드
  'hospital': dict(bpm=92,  root=57, scale='major',      prog=[0,2,3,4], style='bell',   drums='gentle', seed=101, lead=11,  lead2=68,  chords=48, bass=42, extra=None), # 비브라폰·오보에·현악
  'mountain': dict(bpm=108, root=50, scale='dorian',     prog=[0,6,3,0], style='melody', drums='folk',   seed=113, lead=75,  lead2=110, chords=25, bass=32, extra=None), # 팬플루트·피들·통기타
  'stage':    dict(bpm=124, root=64, scale='major',      prog=[0,4,5,3], style='melody', drums='rock',   seed=127, lead=29,  lead2=81,  chords=18, bass=34, extra=None), # 오버드라이브 기타·신스·오르간
  # 왕 4곡 (패턴별)
  'boss-exam':   dict(bpm=140, root=57, scale='harmonic', prog=[0,0,5,4], progB=[0,3,4,4], style='melody', drums='boss',    seed=201, lead=44, lead2=6,  chords=48, bass=38, extra=47),   # 트레몰로 현·하프시코드·팀파니 (긴장)
  'boss-spiral': dict(bpm=128, root=55, scale='phrygian', prog=[0,1,0,6], progB=[0,1,3,1], style='arp',    drums='spiral',  seed=211, lead=8,  lead2=71, chords=52, bass=38, extra=None),  # 첼레스타·클라리넷·합창 (소용돌이)
  'boss-charge': dict(bpm=150, root=52, scale='minor',    prog=[0,5,6,4], progB=[0,6,5,6], style='melody', drums='march',   seed=221, lead=61, lead2=56, chords=48, bass=39, extra=47),   # 브라스·트럼펫·팀파니 (돌진)
  'boss-lane':   dict(bpm=145, root=50, scale='dorian',   prog=[0,6,5,6], progB=[0,3,6,4], style='arp',    drums='express', seed=231, lead=81, lead2=30, chords=50, bass=38, extra=None),  # 신스 리드·디스토션 기타 (질주)
}
TPB = 480; BAR = TPB * 4

def chord_of(s, deg, seven=False):
    sc = s['scale']; S = SCALES[sc]
    def n(d): o, k = divmod(d, 7); return s['root'] + S[k] + 12 * o
    ns = [n(deg), n(deg + 2), n(deg + 4)] + ([n(deg + 6)] if seven else [])
    while min(ns) > s['root'] + 4: ns = [x - 12 for x in ns]
    return ns

def compose(sid):
    s = SONGS[sid]; random.seed(s['seed']); seven = s.get('seven', False); boss = sid.startswith('boss')
    A = s['prog'] * 2
    B = (s.get('progB') or [s['prog'][2], s['prog'][3], s['prog'][0], s['prog'][1]]) * 2
    if not boss: B[-2:] = [4, 0] if s['prog'][0] == 0 else [4, s['prog'][0]]   # B 끝은 딸림→으뜸으로 돌아와 처음과 이어짐
    form = A + B + A + B
    S = SCALES[s['scale']]
    pool = [s['root'] + 12 + 12 * o + iv for o in range(-1, 2) for iv in S]; pool = [p for p in pool if s['root'] + 7 <= p <= s['root'] + 31]
    ev = {}
    def add(tr, st, dur, n, v): ev.setdefault(tr, []).append((int(st), int(max(30, dur)), n, v))
    motif = {}   # 구간마다 2마디 리듬 모티프를 만들어 되풀이 → 기억에 남는 멜로디
    def rhythm(sec):
        if sec not in motif:
            r = random.Random(s['seed'] * 7 + (sec == 'B'))
            pats = [[2,1,1,2,2], [1,1,2,1,1,2], [2,2,1,1,2], [3,1,2,2], [1,1,1,1,2,2]]
            motif[sec] = (r.choice(pats), r.choice(pats))
        return motif[sec]
    prev = pool[len(pool) // 2]
    for b, deg in enumerate(form):
        st = b * BAR; ch = chord_of(s, deg, seven); sec = 'A' if (b % 16) < 8 else 'B'
        # 화음: A=2박마다, B=1박마다(조금 더 움직임). 보스는 8분음표로 몰아침
        step = TPB // 2 if boss else (TPB * 2 if sec == 'A' else TPB)
        for k in range(0, BAR, step):
            for n in ch: add('chords', st + k, step - 25, n, 56 if k % (TPB * 2) == 0 else 46)
        # 베이스: 근음 + 5도 (보스는 8분음표)
        root = ch[0] - 12
        bpat = [root, root, root + 7, root] if not boss else [root, root, root + 12, root, root, root + 7, root, root + 12]
        bl = BAR // len(bpat)
        for k, n in enumerate(bpat): add('bass', st + k * bl, bl - 30, n, 84)
        # 멜로디
        lead = 'lead' if sec == 'A' else 'lead2'
        if s['style'] == 'arp':   # 화음음을 16분음표로 오르내림 (A 구간), B는 모티프 멜로디
            if sec == 'A':
                arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 24 if len(ch) < 4 else ch[3] + 12]
                for k in range(16): add('lead', st + k * TPB // 4, TPB // 4 - 20, arp[[0,1,2,3,2,1,0,1][k % 8]], 64 if k % 4 else 76)
                continue_mel = False
            else: continue_mel = True
        else: continue_mel = True
        if continue_mel:
            if s['style'] == 'bell' and sec == 'A':   # 오르골처럼 드문드문 길게
                for k, d in enumerate([0, TPB * 1.5, TPB * 3]):
                    cands = [p for p in pool if p % 12 in [c % 12 for c in ch]]
                    n = min(cands, key=lambda x: abs(x - prev) + random.random() * 4); prev = n
                    add(lead, st + d, TPB * 1.4, n + 12, 70)
            else:
                rh = rhythm(sec)[b % 2]; t = 0
                for d8 in rh:
                    d = d8 * TPB // 2
                    if t >= BAR: break
                    strong = t % TPB == 0
                    cands = [p for p in pool if (p % 12 in [c % 12 for c in ch])] if strong else [p for p in pool if abs(p - prev) <= 4 and p != prev]
                    if not cands: cands = pool
                    n = min(cands, key=lambda x: abs(x - prev) + random.random() * 3.5)
                    if b % 8 == 7 and t >= TPB * 2: n = min([p for p in pool if p % 12 == ch[0] % 12], key=lambda x: abs(x - prev))   # 구절 끝은 화음 뿌리음
                    add(lead, st + t, d - 30, n, 80 if strong else 70); prev = n; t += d
        if s.get('extra') is not None and sec == 'B':   # 꾸밈: 피치카토 아르페지오 / 팀파니
            if s['extra'] == 47:
                for k in (0, 2): add('extra', st + k * TPB, TPB, ch[0] - 12, 90)
            else:
                arp = ch + [ch[1] + 12]
                for k in range(8): add('extra', st + k * TPB // 2, TPB // 2 - 30, arp[k % len(arp)] + 12, 52)
    # 드럼 (채널 10): 패턴 + 8마디마다 필인 + 구간 시작 크래시
    kpat, spat, hpat = D[s['drums']]; sw = s.get('swing', 0)
    for b in range(len(form)):
        st = b * BAR
        for i in range(16):
            off = st + i * TPB // 4 + (sw * TPB // 4 if i % 2 else 0)
            for pat, note, hv, lv in ((kpat, 36, 92, 66), (spat, 38, 80, 52), (hpat, 42, 52, 34)):
                c = pat[i]
                if c != '.': add('drum', off, 60, note, hv if c == 'x' else lv)
        if b % 8 == 7:
            for k in range(8): add('drum', st + TPB * 2 + k * TPB // 4, 50, 38 if k % 2 == 0 else 45, 48 + k * 5)
        if b in (8, 24): add('drum', st, 400, 49, 70)
    mid = mido.MidiFile(ticks_per_beat=TPB)
    t0 = mido.MidiTrack(); mid.tracks.append(t0); t0.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(s['bpm'])))
    chans = {'lead': (0, s['lead'], 92), 'lead2': (1, s['lead2'], 88), 'chords': (2, s['chords'], 72), 'bass': (3, s['bass'], 92), 'extra': (4, s.get('extra') or 0, 78), 'drum': (9, 0, 80)}
    for name, evs in ev.items():
        ch, prog, vol = chans[name]; tr = mido.MidiTrack(); mid.tracks.append(tr)
        if ch != 9: tr.append(mido.Message('program_change', channel=ch, program=prog, time=0))
        tr.append(mido.Message('control_change', channel=ch, control=7, value=vol, time=0))
        tr.append(mido.Message('control_change', channel=ch, control=91, value=34, time=0))
        msgs = []
        for st, dur, n, v in evs:
            msgs.append((st, 1, mido.Message('note_on', channel=ch, note=max(0, min(127, n)), velocity=v)))
            msgs.append((st + dur, 0, mido.Message('note_off', channel=ch, note=max(0, min(127, n)), velocity=0)))
        msgs.sort(key=lambda x: (x[0], x[1])); now = 0
        for at, _, m in msgs: m.time = at - now; now = at; tr.append(m)
    return mid, len(form) * 4 * 60 / s['bpm']

def render(sid):
    mid, L = compose(sid)
    with tempfile.TemporaryDirectory() as d:
        mp, wav, loop = os.path.join(d, 'a.mid'), os.path.join(d, 'a.wav'), os.path.join(d, 'l.wav')
        mid.save(mp)
        subprocess.run(['fluidsynth', '-ni', '-g', '0.7', '-r', '44100', '-F', wav, SF2, mp], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # 끝의 울림을 곡 처음에 겹쳐 끊김 없이 반복되게 + 음량 맞춤
        fc = f"[0]atrim=0:{L:.4f},asetpts=PTS-STARTPTS[b];[0]atrim=start={L:.4f},asetpts=PTS-STARTPTS[t];[b][t]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-19:TP=-2[o]"
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-filter_complex', fc, '-map', '[o]', '-ar', '44100', loop], check=True)
        os.makedirs(OUT, exist_ok=True)
        dst = os.path.join(OUT, sid + '.mp3')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', loop, '-c:a', 'libmp3lame', '-b:a', '80k', dst], check=True)
    print(f'{sid:13s} {L:5.1f}s  {os.path.getsize(dst) // 1024} KB')

if __name__ == '__main__':
    for sid in (sys.argv[1:] or list(SONGS)): render(sid)
