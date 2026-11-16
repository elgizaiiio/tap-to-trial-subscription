"""Liquid-glass motion-graphics renderer (Pillow frames piped to FFmpeg). Runs only inside the task sandbox."""
import os, json, math, re, glob, subprocess, tempfile, pathlib, urllib.request, urllib.parse, socket, ipaddress, wave
import numpy as np
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont, ImageFilter, features

ff = imageio_ffmpeg.get_ffmpeg_exe()
work = tempfile.mkdtemp(prefix='motion-', dir='/home/user')
C = CONFIG
short = 720 if C['resolution'] == '720p' else 1080
W, H = {'16:9': (short * 16 // 9, short), '9:16': (short, short * 16 // 9), '1:1': (short, short), '4:5': (short, short * 5 // 4)}[C['aspect_ratio']]
W, H = W // 2 * 2, H // 2 * 2
S = short / 1080
FPS = 30
PORTRAIT = H > W
scenes = C['scenes']
starts, t = [], 0.0
for s in scenes: starts.append(t); t += s['duration']
DURATION = t

def hexrgb(v): return tuple(int(v[i:i + 2], 16) for i in (1, 3, 5))
TH = C['theme']; BG, G1, G2, ACC = hexrgb(TH['background']), hexrgb(TH['glow1']), hexrgb(TH['glow2']), hexrgb(TH['accent'])

# ---------- safe asset fetch (same policy as the montage renderer) ----------
def public_host(url):
    host = urllib.parse.urlparse(url).hostname or ''
    for info in socket.getaddrinfo(host, 443):
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            raise ValueError('Asset host is not a public internet address')
class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not newurl.startswith('https://'): raise ValueError('Insecure asset redirect')
        public_host(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)
opener = urllib.request.build_opener(SafeRedirect)
def asset(source, label):
    if source.startswith('/home/user/'):
        real = pathlib.Path(source).resolve()
        if not str(real).startswith('/home/user/') or not real.is_file(): raise ValueError('Asset file missing: ' + source)
        return str(real)
    public_host(source)
    target = os.path.join(work, label)
    req = urllib.request.Request(source, headers={'User-Agent': 'CeyoMedia/2.0'})
    with opener.open(req, timeout=40) as r, open(target, 'wb') as out:
        size = 0
        while True:
            chunk = r.read(65536)
            if not chunk: break
            size += len(chunk)
            if size > 60 * 1024 * 1024: raise ValueError('Asset exceeds 60 MB')
            out.write(chunk)
    return target

def run(args, timeout=280):
    p = subprocess.run([ff, '-hide_banner', '-loglevel', 'error', '-y', *args], capture_output=True, text=True, timeout=timeout)
    if p.returncode: raise RuntimeError('Media render failed: ' + p.stderr[-1500:])

# ---------- type ----------
def font_file(weight):
    name = {'bold': 'IBMPlexSansArabic-Bold.ttf', 'semi': 'IBMPlexSansArabic-SemiBold.ttf', 'regular': 'IBMPlexSansArabic-Medium.ttf'}[weight]
    target = os.path.join('/home/user/.fonts', name)
    if not os.path.exists(target):
        try:
            os.makedirs('/home/user/.fonts', exist_ok=True)
            urllib.request.urlretrieve('https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsansarabic/' + name, target)
        except Exception:
            if os.path.exists(target): os.remove(target)
    if os.path.exists(target) and os.path.getsize(target) > 10000: return target
    found = glob.glob('/usr/share/fonts/**/DejaVuSans-Bold.ttf' if weight != 'regular' else '/usr/share/fonts/**/DejaVuSans.ttf', recursive=True)
    if not found: raise ValueError('Font missing')
    return found[0]
_fonts = {}
def font(weight, size):
    key = (weight, int(size))
    if key not in _fonts: _fonts[key] = ImageFont.truetype(font_file(weight), max(8, int(size)))
    return _fonts[key]
RAQM = features.check_feature('raqm')
AR = re.compile('[\u0590-\u08ff]')
def is_rtl(text): return bool(AR.search(text or ''))
def shape(text):
    if is_rtl(text) and not RAQM:
        import arabic_reshaper
        from bidi.algorithm import get_display
        return get_display(arabic_reshaper.reshape(text))
    return text
def dir_kw(text): return {'direction': 'rtl'} if is_rtl(text) and RAQM else {}
_measure = ImageDraw.Draw(Image.new('RGBA', (8, 8)))
def tw(text, f): return _measure.textlength(shape(text), font=f, **dir_kw(text))
def wrap(text, f, maxw):
    lines, line = [], []
    for word in text.split():
        trial = ' '.join(line + [word])
        if line and tw(trial, f) > maxw: lines.append(' '.join(line)); line = [word]
        else: line.append(word)
    if line: lines.append(' '.join(line))
    return lines or ['']

def text_sprite(text, weight, size, maxw, fill=(255, 255, 255, 255), align='center', max_lines=4, spacing=1.22):
    size = int(size)
    while True:
        f = font(weight, size)
        lines = wrap(text, f, maxw)
        if len(lines) <= max_lines or size <= 14: break
        size -= 2
    lh = int(size * spacing)
    width = int(min(maxw, max(tw(l, f) for l in lines)) + size * 0.3)
    img = Image.new('RGBA', (max(2, width), max(2, lh * len(lines) + int(size * 0.35))), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rtl = is_rtl(text)
    for i, l in enumerate(lines):
        lw = tw(l, f)
        a = align if align != 'start' else ('right' if rtl else 'left')
        x = {'center': (width - lw) / 2, 'left': 0, 'right': width - lw}[a]
        d.text((x, i * lh), shape(l), font=f, fill=fill, **dir_kw(l))
    return img

# ---------- glass primitives ----------
def shadowed(img, radius, blur, alpha=110, offset=None):
    pad = blur * 2
    offset = int(blur * 0.5) if offset is None else offset
    out = Image.new('RGBA', (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    sh = Image.new('RGBA', out.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((pad, pad + offset, pad + img.width, pad + img.height + offset), radius=radius, fill=(0, 0, 0, alpha))
    out = Image.alpha_composite(out, sh.filter(ImageFilter.GaussianBlur(blur)))
    out.alpha_composite(img, (pad, pad))
    return out

def glass(wd, ht, radius, tint=(255, 255, 255, 26), border=(255, 255, 255, 62), highlight=True):
    wd, ht = int(wd), int(ht)
    img = Image.new('RGBA', (wd, ht), (0, 0, 0, 0))
    mask = Image.new('L', (wd, ht), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, wd - 1, ht - 1), radius=radius, fill=255)
    base = Image.new('RGBA', (wd, ht), tint)
    if highlight:
        grad = np.linspace(46, 0, ht).astype(np.uint8)
        hl = Image.fromarray(np.repeat(grad[:, None], wd, 1), 'L')
        base = Image.alpha_composite(base, Image.merge('RGBA', (Image.new('L', (wd, ht), 255),) * 3 + (hl,)))
    img.paste(base, (0, 0), mask)
    ImageDraw.Draw(img).rounded_rectangle((0, 0, wd - 1, ht - 1), radius=radius, outline=border, width=max(1, int(2 * S)))
    return img

def gradient_pill(wd, ht, c1, c2, radius=None):
    wd, ht = int(wd), int(ht)
    x = np.linspace(0, 1, wd)[None, :, None]
    arr = (np.array(c1)[None, None, :] * (1 - x) + np.array(c2)[None, None, :] * x).repeat(ht, 0).astype(np.uint8)
    img = Image.fromarray(arr, 'RGB').convert('RGBA')
    mask = Image.new('L', (wd, ht), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, wd - 1, ht - 1), radius=radius if radius is not None else ht // 2, fill=255)
    img.putalpha(mask)
    return img

def mix(a, b, k): return tuple(int(a[i] * (1 - k) + b[i] * k) for i in range(3))

LOGO = None
if C.get('logo'):
    try: LOGO = Image.open(asset(C['logo'], 'logo')).convert('RGBA')
    except Exception: LOGO = None
def logo_sprite(size, radius_ratio=0.23):
    size = int(size)
    if LOGO is None:
        img = gradient_pill(size, size, G1, G2, radius=int(size * radius_ratio))
        letter = (C.get('brand') or 'C')[:1]
        f = font('bold', size * 0.55)
        ImageDraw.Draw(img).text((size / 2, size / 2), shape(letter), font=f, anchor='mm', fill=(255, 255, 255, 255))
        return img
    img = LOGO.copy(); img.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0)); canvas.alpha_composite(img, ((size - img.width) // 2, (size - img.height) // 2))
    mask = Image.new('L', (size, size), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * radius_ratio), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0)); out.paste(canvas, (0, 0), mask)
    return out

# ---------- motion ----------
def clamp(v, a=0.0, b=1.0): return max(a, min(b, v))
def spring(x):
    x = clamp(x)
    return 1 - math.exp(-6.5 * x) * math.cos(9.5 * x) if x < 1 else 1.0
def ease(x): x = clamp(x); return 1 - (1 - x) ** 3

class Item:
    """A sprite (static or time-driven) that springs in at `delay` and fades with its scene."""
    def __init__(self, sprite, cx, cy, delay=0.0, rise=40, scale_from=0.94, float_amp=0, phase=0.0, dynamic=None):
        self.sprite, self.cx, self.cy, self.delay, self.rise = sprite, cx, cy, delay, rise * S
        self.scale_from, self.float_amp, self.phase, self.dynamic = scale_from, float_amp * S, phase, dynamic

def place(frame, sprite, cx, cy, alpha, scale):
    if alpha <= 0.01: return
    if abs(scale - 1) > 0.004:
        sprite = sprite.resize((max(1, int(sprite.width * scale)), max(1, int(sprite.height * scale))), Image.BILINEAR)
    if alpha < 0.995:
        a = sprite.getchannel('A').point(lambda v: int(v * alpha))
        sprite = sprite.copy(); sprite.putalpha(a)
    frame.alpha_composite(sprite, (int(cx - sprite.width / 2), int(cy - sprite.height / 2)))

# ---------- scene builders ----------
TITLE = 96 * S if not PORTRAIT else 88 * S
def build_title(s):
    items = []
    y = H * (0.40 if s.get('show_logo', True) else 0.5)
    if s.get('show_logo', True):
        ls = int((210 if not PORTRAIT else 240) * S)
        ring = int(ls * 1.55)
        r = glass(ring, ring, ring // 2, tint=(255, 255, 255, 14), border=(255, 255, 255, 70))
        def ring_dyn(lt, r=r, ring=ring):
            img = r.copy(); d = ImageDraw.Draw(img); a0 = lt * 70
            d.arc((3, 3, ring - 4, ring - 4), a0, a0 + 70, fill=(255, 255, 255, 170), width=max(2, int(3 * S)))
            d.arc((3, 3, ring - 4, ring - 4), a0 + 180, a0 + 215, fill=ACC + (150,), width=max(2, int(3 * S)))
            return img
        items.append(Item(r, W / 2, y - H * 0.06, 0.0, rise=0, scale_from=0.8, dynamic=ring_dyn))
        items.append(Item(shadowed(logo_sprite(ls), int(ls * 0.23), int(24 * S)), W / 2, y - H * 0.06, 0.08, rise=0, scale_from=0.8))
        y = y - H * 0.06 + ring / 2 + TITLE * 0.9
    words = s['title'].split()
    f = font('bold', TITLE)
    lines = wrap(s['title'], f, W * 0.84)
    lh = TITLE * 1.18
    k = 0
    for li, line in enumerate(lines):
        ws = line.split(); rtl = is_rtl(line)
        sizes = [tw(w_, f) for w_ in ws]; space = tw(' ', f) or TITLE * 0.25
        total = sum(sizes) + space * (len(ws) - 1)
        x = W / 2 + total / 2 if rtl else W / 2 - total / 2
        for w_, sz in zip(ws, sizes):
            spr = text_sprite(w_, 'bold', TITLE, W, max_lines=1)
            x0 = x - sz if rtl else x
            items.append(Item(spr, x0 + sz / 2, y + li * lh + spr.height / 2, 0.35 + k * 0.07, rise=28, scale_from=1.0))
            x = x0 - space if rtl else x + sz + space
            k += 1
    if s.get('subtitle'):
        sub = text_sprite(s['subtitle'], 'regular', TITLE * 0.42, W * 0.7, fill=(255, 255, 255, 185), max_lines=2)
        items.append(Item(sub, W / 2, y + len(lines) * lh + sub.height / 2 + TITLE * 0.25, 0.45 + k * 0.07, rise=20, scale_from=1.0))
    return items

def card_sprite(c, cw, i):
    pad = int(34 * S)
    rtl = is_rtl(c['title'] + ' ' + c.get('body', ''))
    inner = cw - pad * 2
    parts = []
    icon = gradient_pill(int(56 * S), int(56 * S), mix(G1, (255, 255, 255), 0.15) if i % 2 == 0 else mix(G2, (255, 255, 255), 0.15), ACC, radius=int(16 * S))
    ImageDraw.Draw(icon).ellipse((icon.width * 0.34, icon.height * 0.34, icon.width * 0.66, icon.height * 0.66), outline=(255, 255, 255, 235), width=max(2, int(3 * S)))
    parts.append(icon)
    parts.append(text_sprite(c['title'], 'bold', 40 * S, inner, align='start', max_lines=3))
    if c.get('body'): parts.append(text_sprite(c['body'], 'regular', 26 * S, inner, fill=(255, 255, 255, 170), align='start', max_lines=4))
    if c.get('tags'):
        tf = font('semi', 22 * S); pills, rows, row, rw = [], [], [], 0
        for tag in c['tags']:
            pw = int(tw(tag, tf) + 30 * S); ph = int(42 * S)
            p = glass(pw, ph, ph // 2, tint=(255, 255, 255, 22), border=(255, 255, 255, 50), highlight=False)
            ImageDraw.Draw(p).text((pw / 2, ph / 2), shape(tag), font=tf, anchor='mm', fill=(255, 255, 255, 220), **dir_kw(tag))
            if row and rw + pw > inner: rows.append(row); row, rw = [], 0
            row.append(p); rw += pw + int(10 * S)
        if row: rows.append(row)
        ph = int(42 * S); block = Image.new('RGBA', (inner, len(rows) * (ph + int(10 * S))), (0, 0, 0, 0))
        for ri, r in enumerate(rows):
            x = inner if rtl else 0
            for p in r:
                if rtl: x -= p.width
                block.alpha_composite(p, (x, ri * (ph + int(10 * S))))
                x = x - int(10 * S) if rtl else x + p.width + int(10 * S)
        parts.append(block)
    gap = int(18 * S)
    ht = pad * 2 + sum(p.height for p in parts) + gap * (len(parts) - 1)
    return parts, ht, pad, gap, rtl

def build_cards(s):
    items = []
    cards = s['cards']; n = len(cards)
    top = H * 0.16
    if s.get('title'):
        hd = text_sprite(s['title'], 'bold', TITLE * 0.62, W * 0.84, max_lines=2)
        items.append(Item(hd, W / 2, H * 0.14 + hd.height / 2, 0.0, rise=24))
        top = H * 0.14 + hd.height + 40 * S
    row = not PORTRAIT and n <= 4
    gap = int(30 * S)
    cw = int((W * 0.86 - gap * (n - 1)) / n) if row else int(W * 0.84)
    specs = [card_sprite(c, cw, i) for i, c in enumerate(cards)]
    ht_all = max(sp[1] for sp in specs) if row else None
    sprites = []
    for (parts, ht, pad, g, rtl) in specs:
        ht = ht_all or ht
        g_ = glass(cw, ht, int(34 * S))
        y = pad
        for p in parts:
            x = cw - pad - p.width if rtl else pad
            g_.alpha_composite(p, (int(x), int(y))); y += p.height + g
        sprites.append(shadowed(g_, int(34 * S), int(30 * S), alpha=120))
    if row:
        cy = (top + H * 0.92) / 2
        x = W / 2 - (cw * n + gap * (n - 1)) / 2 + cw / 2
        for i, sp in enumerate(sprites):
            items.append(Item(sp, x + i * (cw + gap), cy, 0.12 + i * 0.16, rise=70, scale_from=0.9, float_amp=7, phase=i * 1.3))
    else:
        total = sum(sp.height for sp in sprites) - (len(sprites) - 1) * int(60 * S * 0.4)
        y = max(top, (H - total) / 2)
        for i, sp in enumerate(sprites):
            items.append(Item(sp, W / 2, y + sp.height / 2, 0.12 + i * 0.16, rise=70, scale_from=0.9, float_amp=6, phase=i * 1.3))
            y += sp.height - int(60 * S * 0.4) + int(6 * S)
    return items

def bubble(text, user, maxw):
    f = 30 * S
    txt = text_sprite(text, 'regular', f, maxw, fill=(255, 255, 255, 245), align='start', max_lines=5)
    px, py = int(28 * S), int(18 * S)
    wd, ht = txt.width + px * 2, txt.height + py * 2 - int(f * 0.2)
    if user:
        b = gradient_pill(wd, ht, mix(ACC, G2, 0.2), mix(ACC, (40, 90, 255), 0.45), radius=int(28 * S))
    else:
        b = glass(wd, ht, int(28 * S), tint=(255, 255, 255, 30))
    b.alpha_composite(txt, (px, py))
    return shadowed(b, int(28 * S), int(18 * S), alpha=90)

def build_chat(s):
    items, D = [], s['duration']
    prompt, reply = s['prompt'], s['reply']
    rtl = is_rtl(prompt + reply)
    cw = int(W * (0.62 if not PORTRAIT else 0.86)); ch = int(92 * S)
    capsule_y = H * (0.72 if not PORTRAIT else 0.78)
    base = glass(cw, ch, ch // 2, tint=(255, 255, 255, 24))
    f = font('regular', 30 * S)
    send = gradient_pill(int(60 * S), int(60 * S), ACC, mix(ACC, G2, 0.5))
    ImageDraw.Draw(send).polygon([(send.width * 0.5, send.height * 0.28), (send.width * 0.3, send.height * 0.52), (send.width * 0.7, send.height * 0.52)], fill=(255, 255, 255, 255))
    ImageDraw.Draw(send).line([(send.width * 0.5, send.height * 0.45), (send.width * 0.5, send.height * 0.72)], fill=(255, 255, 255, 255), width=max(2, int(5 * S)))
    t_send = D * 0.42
    placeholder = s.get('placeholder') or ('اكتب لفريقك…' if rtl else 'Ask your team…')
    cache = {}
    def capsule(lt):
        if lt < t_send:
            n = int(len(prompt) * clamp((lt - 0.35) / max(0.4, t_send - 0.6)))
            key = ('t', n, int(lt * 2) % 2)
        else:
            key = ('p',)
        if key in cache: return cache[key]
        img = base.copy(); d = ImageDraw.Draw(img)
        img.alpha_composite(send, (int(ch * 0.17) if rtl else cw - send.width - int(ch * 0.17), (ch - send.height) // 2))
        if key[0] == 't':
            text = prompt[:key[1]]
            while text and tw(text, f) > cw - ch * 1.6: text = text[1:]
            x_end = 0
            if text:
                width = tw(text, f)
                x = cw - ch * 0.45 - width if rtl else ch * 0.45
                d.text((x, ch / 2), shape(text), font=f, anchor='lm', fill=(255, 255, 255, 240), **dir_kw(text))
                x_end = x if rtl else x + width
            else:
                x_end = cw - ch * 0.45 if rtl else ch * 0.45
            if key[2] == 0: d.line([(x_end + (-6 if rtl else 6) * S, ch * 0.3), (x_end + (-6 if rtl else 6) * S, ch * 0.7)], fill=ACC + (255,), width=max(2, int(3 * S)))
        else:
            d.text((cw - ch * 0.45 if rtl else ch * 0.45, ch / 2), shape(placeholder), font=f, anchor='rm' if rtl else 'lm', fill=(255, 255, 255, 110), **dir_kw(placeholder))
        cache[key] = img
        return img
    items.append(Item(base, W / 2, capsule_y, 0.0, rise=40, dynamic=capsule))
    maxw = int(cw * 0.78)
    ub = bubble(prompt, True, maxw)
    side = -1 if rtl else 1
    ux = W / 2 + side * (cw / 2 - ub.width / 2 + int(18 * S))
    uy = capsule_y - ch / 2 - H * 0.36 + ub.height / 2
    items.append(Item(ub, ux, uy, t_send, rise=-60, scale_from=0.9))
    av = int(54 * S)
    avatar = logo_sprite(av, 0.5)
    rb = bubble(reply, False, maxw)
    rx = W / 2 - side * (cw / 2 - rb.width / 2 - av - int(4 * S))
    ry = uy + ub.height / 2 + int(30 * S) + rb.height / 2
    items.append(Item(avatar, W / 2 - side * (cw / 2 - av / 2 + int(6 * S)), ry - rb.height / 2 + av / 2 + int(10 * S), t_send + 0.35, rise=10))
    dots_end = t_send + min(1.1, D * 0.18)
    dot = glass(int(110 * S), int(64 * S), int(32 * S), tint=(255, 255, 255, 30))
    def dots(lt):
        if lt > dots_end - t_send - 0.35: return Image.new('RGBA', (2, 2), (0, 0, 0, 0))
        img = dot.copy(); d = ImageDraw.Draw(img)
        for k in range(3):
            a = 0.5 + 0.5 * math.sin(lt * 9 - k * 0.9)
            r = 7 * S; cx = img.width / 2 + (k - 1) * 24 * S
            d.ellipse((cx - r, img.height / 2 - r - a * 4 * S, cx + r, img.height / 2 + r - a * 4 * S), fill=(255, 255, 255, int(130 + 120 * a)))
        return img
    items.append(Item(dot, rx - side * (rb.width / 2 - dot.width / 2), ry - rb.height / 2 + dot.height / 2, t_send + 0.35, rise=10, dynamic=dots))
    items.append(Item(rb, rx, ry, dots_end, rise=24, scale_from=0.92))
    return items

def build_cta(s):
    items = []
    y = H * 0.40
    if s.get('show_logo', True):
        ls = int(150 * S)
        items.append(Item(shadowed(logo_sprite(ls), int(ls * 0.23), int(22 * S)), W / 2, y - ls * 0.9, 0.0, rise=0, scale_from=0.8))
    hd = text_sprite(s['title'], 'bold', TITLE * 0.8, W * 0.84, max_lines=3)
    items.append(Item(hd, W / 2, y + hd.height / 2, 0.15, rise=30))
    bf = font('bold', 38 * S)
    label = s['button']
    bw, bh = int(tw(label, bf) + 120 * S), int(104 * S)
    btn = gradient_pill(bw, bh, (255, 255, 255), (236, 240, 255))
    ImageDraw.Draw(btn).text((bw / 2, bh / 2), shape(label), font=bf, anchor='mm', fill=mix(BG, (20, 24, 40), 0.3) + (255,), **dir_kw(label))
    glow = Image.new('RGBA', (bw + int(160 * S), bh + int(160 * S)), (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle((80 * S, 80 * S, 80 * S + bw, 80 * S + bh), radius=bh // 2, fill=ACC + (150,))
    glow = glow.filter(ImageFilter.GaussianBlur(int(36 * S)))
    def btn_dyn(lt, btn=btn, glow=glow):
        img = glow.copy(); b = btn.copy()
        sx = (lt * 0.6 % 1.6 - 0.3) * bw
        sheen = Image.new('RGBA', b.size, (0, 0, 0, 0)); ImageDraw.Draw(sheen).polygon([(sx, 0), (sx + 40 * S, 0), (sx - 10 * S, bh), (sx - 50 * S, bh)], fill=(255, 255, 255, 120))
        sheen.putalpha(Image.fromarray(np.minimum(np.array(sheen.getchannel('A')), np.array(b.getchannel('A')))))
        b.alpha_composite(sheen)
        img.alpha_composite(b, (int(80 * S), int(80 * S)))
        return img
    by = y + hd.height + bh * 1.05
    items.append(Item(glow, W / 2, by, 0.45, rise=30, scale_from=0.85, dynamic=btn_dyn))
    if s.get('url'):
        u = text_sprite(s['url'], 'semi', 30 * S, W * 0.8, fill=mix(ACC, (255, 255, 255), 0.35) + (255,), max_lines=1)
        items.append(Item(u, W / 2, by + bh * 0.95, 0.7, rise=16))
    return items

def build_image(s):
    items = []
    src = Image.open(asset(s['source'], 'scene-image-' + str(id(s)))).convert('RGBA')
    top = H * 0.1
    if s.get('title'):
        hd = text_sprite(s['title'], 'bold', TITLE * 0.6, W * 0.84, max_lines=2)
        items.append(Item(hd, W / 2, H * 0.09 + hd.height / 2, 0.0, rise=24)); top = H * 0.09 + hd.height + 34 * S
    maxw, maxh = W * 0.8, H * 0.92 - top
    src.thumbnail((int(maxw), int(maxh)), Image.LANCZOS)
    r = int(30 * S); fr = int(14 * S)
    frame = glass(src.width + fr * 2, src.height + fr * 2, r + fr, tint=(255, 255, 255, 30))
    mask = Image.new('L', src.size, 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, src.width - 1, src.height - 1), radius=r, fill=255)
    inner = Image.new('RGBA', src.size, (0, 0, 0, 0)); inner.paste(src, (0, 0), mask)
    frame.alpha_composite(inner, (fr, fr))
    items.append(Item(shadowed(frame, r + fr, int(34 * S), alpha=130), W / 2, top + frame.height / 2 + 10 * S, 0.15, rise=60, scale_from=0.92, float_amp=4))
    return items

BUILD = {'title': build_title, 'cards': build_cards, 'chat': build_chat, 'cta': build_cta, 'image': build_image}
built = [BUILD[s['type']](s) for s in scenes]

# ---------- captions (optional, from measured voiceover words) ----------
caps = []
for c in C.get('captions', []):
    spr = text_sprite(c['text'], 'semi', 34 * S, W * 0.7, max_lines=2)
    px, py = int(30 * S), int(16 * S)
    g = glass(spr.width + px * 2, spr.height + py * 2 - int(8 * S), int(26 * S), tint=(10, 12, 20, 140))
    g.alpha_composite(spr, (px, py))
    caps.append((c['start'], c['end'], shadowed(g, int(26 * S), int(16 * S), alpha=90)))

# ---------- background ----------
LW, LH = max(32, W // 8), max(32, H // 8)
yy, xx = np.mgrid[0:LH, 0:LW].astype(np.float32)
bg0 = np.array(BG, np.float32)[None, None, :]
def background(t):
    img = np.repeat(np.repeat(bg0, LH, 0), LW, 1).copy()
    blobs = [(G1, 0.28 + 0.08 * math.sin(t * 0.35), 0.30 + 0.07 * math.cos(t * 0.28), 0.42, 0.55),
             (G2, 0.74 + 0.07 * math.cos(t * 0.31), 0.72 + 0.08 * math.sin(t * 0.26), 0.46, 0.5),
             (mix(G1, G2, 0.5), 0.55 + 0.12 * math.sin(t * 0.2 + 2), 0.18 + 0.05 * math.sin(t * 0.33), 0.3, 0.22)]
    for col, bx, by, rad, k in blobs:
        d2 = ((xx / LW - bx) * (LW / max(LW, LH))) ** 2 + ((yy / LH - by) * (LH / max(LW, LH))) ** 2
        a = np.exp(-d2 / (2 * (rad * 0.42) ** 2))[..., None] * k
        img = img * (1 - a) + np.array(col, np.float32)[None, None, :] * 0.55 * a
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB').resize((W, H), Image.BICUBIC)

# ---------- render ----------
video = os.path.join(work, 'video.mp4')
enc = subprocess.Popen([ff, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-threads', '2', video], stdin=subprocess.PIPE, stderr=subprocess.PIPE)
EXIT = 0.38
frames = int(round(DURATION * FPS))
noise = (np.random.default_rng(7).integers(-3, 4, (H, W, 1), dtype=np.int16))
for fi in range(frames):
    t = fi / FPS
    frame = background(t).convert('RGBA')
    for si, s in enumerate(scenes):
        st, d = starts[si], s['duration']
        lt_scene = t - st
        if lt_scene < -0.01 or lt_scene > d + EXIT * 0.0 + 0.001: continue
        last = si == len(scenes) - 1
        out = 1.0 if last else clamp((d - lt_scene) / EXIT)
        for it in built[si]:
            lt = lt_scene - it.delay
            if lt < 0: continue
            p = spring(lt / 0.75)
            a = clamp(lt / 0.32) * ease(out)
            sc = (it.scale_from + (1 - it.scale_from) * p) * (0.97 + 0.03 * out)
            dy = (1 - p) * it.rise - (1 - out) * 18 * S + (math.sin(t * 1.1 + it.phase) * it.float_amp if it.float_amp else 0)
            spr = it.dynamic(lt) if it.dynamic else it.sprite
            place(frame, spr, it.cx, it.cy + dy, a, sc)
    for (cs, ce, spr) in caps:
        if cs <= t <= ce:
            a = clamp((t - cs) / 0.18) * clamp((ce - t) / 0.18)
            place(frame, spr, W / 2, H * (0.9 if not PORTRAIT else 0.88), a, 0.96 + 0.04 * a)
    if fi == 0 or fi == frames - 1:
        pass
    arr = np.asarray(frame.convert('RGB'), dtype=np.int16)
    # Fine grain dithering removes gradient banding in the dark glows.
    arr = np.clip(arr + np.roll(noise, fi * 37 % W, axis=1), 0, 255).astype(np.uint8)
    enc.stdin.write(arr.tobytes())
enc.stdin.close()
if enc.wait(): raise RuntimeError('Encoder failed: ' + enc.stderr.read().decode()[-1200:])

# ---------- sound ----------
def ambient(path, seconds):
    sr = 44100; n = int(sr * (seconds + 1)); tt = np.arange(n) / sr; out = np.zeros(n)
    chords = [[57, 64, 69, 72], [53, 60, 65, 69], [48, 55, 60, 64], [55, 62, 67, 71]]
    f = lambda m: 440 * 2 ** ((m - 69) / 12); bar = 3.2
    for k in range(int(seconds / bar) + 2):
        s0 = int(k * bar * sr); e = min(n, int((k + 1.6) * bar * sr))
        if s0 >= n: break
        lt = tt[s0:e] - k * bar
        env = np.minimum(1, lt / 1.2) * np.exp(-lt * 0.45)
        for m in chords[k % 4]: out[s0:e] += 0.05 * env * (np.sin(2 * np.pi * f(m) * lt) + 0.25 * np.sin(2 * np.pi * f(m) * 1.004 * lt))
        out[s0:e] += 0.07 * env * np.sin(2 * np.pi * f(chords[k % 4][0] - 24) * lt)
    for k in range(int(seconds * 2)):
        s0 = int(k * 0.5 * sr); L = int(0.25 * sr)
        if s0 + L < n: out[s0:s0 + L] += 0.03 * np.sin(2 * np.pi * f(81 + (k % 3) * 2) * tt[:L]) * np.exp(-tt[:L] * 14)
    out /= max(1e-6, np.abs(out).max()) * 1.2
    wv = wave.open(path, 'wb'); wv.setnchannels(1); wv.setsampwidth(2); wv.setframerate(sr); wv.writeframes((out * 32767).astype(np.int16).tobytes()); wv.close()

args, filters, idx = ['-i', video], [], 1
voice = music = None
if C.get('narration'):
    voice = idx; idx += 1; args += ['-i', asset(C['narration'], 'narration')]
mus = C.get('music', 'ambient')
if mus and mus != 'none':
    mp = os.path.join(work, 'ambient.wav') if mus == 'ambient' else asset(mus, 'music')
    if mus == 'ambient': ambient(mp, DURATION)
    music = idx; idx += 1; args += ['-stream_loop', '-1', '-i', mp]
if voice is not None:
    filters.append(f"[{voice}:a]aresample=48000,adelay={int(C.get('narration_offset', 0) * 1000)}:all=1,apad,atrim=duration={DURATION},asetpts=PTS-STARTPTS[voice]")
if music is not None:
    filters.append(f"[{music}:a]aresample=48000,volume={C['music_volume']},atrim=duration={DURATION},asetpts=PTS-STARTPTS,afade=t=in:d=0.8,afade=t=out:st={max(0, DURATION - 1.6)}:d=1.6[music]")
if voice is not None and music is not None:
    filters += ['[voice]asplit=2[spoken][side]', '[music][side]sidechaincompress=threshold=0.02:ratio=6:attack=25:release=300[ducked]', '[spoken][ducked]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5[audio]']
elif voice is not None: filters.append('[voice]loudnorm=I=-14:TP=-1.5[audio]')
elif music is not None: filters.append('[music]loudnorm=I=-16:TP=-1.5[audio]')
output = '/home/user/' + C['name']
cmd = [*args]
if filters: cmd += ['-filter_complex', ';'.join(filters), '-map', '0:v', '-map', '[audio]', '-c:a', 'aac', '-b:a', '160k']
else: cmd += ['-map', '0:v', '-an']
run([*cmd, '-c:v', 'copy', '-t', f'{DURATION:.3f}', '-movflags', '+faststart', output])
if os.path.getsize(output) > 20 * 1024 * 1024: raise ValueError('Video exceeds private export size; shorten it or use 720p')
print(json.dumps({'path': output, 'name': C['name'], 'mime': 'video/mp4', 'duration': round(DURATION, 3), 'width': W, 'height': H, 'has_audio': bool(filters), 'narration': voice is not None, 'music': mus if music is not None else 'none', 'scenes': len(scenes), 'size': os.path.getsize(output)}))
