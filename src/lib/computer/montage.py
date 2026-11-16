"""Deterministic cinematic FFmpeg/Pillow renderer executed only inside the task sandbox."""
import os, json, subprocess, tempfile, pathlib, urllib.request, urllib.parse, re, glob, socket, ipaddress
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont, ImageFilter, features

ff = imageio_ffmpeg.get_ffmpeg_exe()
work = tempfile.mkdtemp(prefix='montage-', dir='/home/user')
scenes = CONFIG['scenes']
duration = sum(s['duration'] for s in scenes)
short = 720 if CONFIG['resolution'] == '720p' else 1080
w, h = {'9:16': (short, short * 16 // 9), '16:9': (short * 16 // 9, short), '1:1': (short, short), '4:5': (short, short * 5 // 4), '21:9': (short * 21 // 9, short)}[CONFIG['aspect_ratio']]
w, h = w // 2 * 2, h // 2 * 2
fps = 30
TRANS = {'fade': 'fade', 'dissolve': 'dissolve', 'slide': 'slideleft', 'wipe': 'wipeleft', 'zoom': 'zoomin', 'whip': 'smoothleft', 'circle': 'circleopen', 'blur': 'hblur'}
tr = CONFIG['transition']
overlap = 0.0 if tr == 'cut' else min(0.45, min(s['duration'] for s in scenes) / 3)

def run(args, timeout=240):
    p = subprocess.run([ff, '-hide_banner', '-loglevel', 'error', '-y', *args], capture_output=True, text=True, timeout=timeout)
    if p.returncode: raise RuntimeError('Media render failed: ' + p.stderr[-1800:])

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
        if not str(real).startswith('/home/user/'): raise ValueError('Asset path escapes task directory')
        if not real.is_file(): raise ValueError('Asset file missing: ' + source)
        return str(real)
    public_host(source)
    target = os.path.join(work, label)
    req = urllib.request.Request(source, headers={'User-Agent': 'CeyoMedia/2.0'})
    with opener.open(req, timeout=40) as response, open(target, 'wb') as out:
        size = 0
        while True:
            chunk = response.read(65536)
            if not chunk: break
            size += len(chunk)
            if size > 150 * 1024 * 1024: raise ValueError('Asset exceeds 150 MB; trim it first')
            out.write(chunk)
    return target

GRADES = {
    'none': '',
    'cinematic': 'colorbalance=rs=-0.04:gs=0.0:bs=0.07:rh=0.07:gh=0.01:bh=-0.06,eq=contrast=1.08:saturation=1.08:gamma=0.97',
    'teal_orange': 'colorbalance=rs=-0.08:bs=0.12:rm=0.04:bm=-0.03:rh=0.12:bh=-0.10,eq=contrast=1.12:saturation=1.15',
    'noir': 'hue=s=0,eq=contrast=1.3:brightness=-0.03:gamma=0.92',
    'golden': 'colorbalance=rm=0.09:gm=0.03:bm=-0.09:rh=0.05:bh=-0.05,eq=saturation=1.12:contrast=1.04',
    'cool': 'colorbalance=rs=-0.03:bs=0.06:rm=-0.04:bm=0.08,eq=contrast=1.06:saturation=0.95',
    'vivid': 'eq=saturation=1.38:contrast=1.07',
    'vintage': 'curves=preset=vintage,eq=saturation=0.85:contrast=0.96',
    'moody': 'eq=contrast=1.15:saturation=0.78:brightness=-0.05:gamma=0.9,colorbalance=bs=0.05:bm=0.03',
}
look = [GRADES[CONFIG['grade']]] if GRADES[CONFIG['grade']] else []
if CONFIG['vignette']: look.append('vignette=PI/4.5')
if CONFIG['grain'] > 0: look.append(f"noise=alls={max(1, round(CONFIG['grain'] * 30))}:allf=t")
if CONFIG['letterbox']:
    bar = max(0, round((h - w / 2.39) / 2)) if w > h else round(h * 0.06)
    if bar > 0: look.append(f'drawbox=x=0:y=0:w=iw:h={bar}:color=black:t=fill,drawbox=x=0:y=ih-{bar}:w=iw:h={bar}:color=black:t=fill')

parts = []
for i, scene in enumerate(scenes):
    source = asset(scene['source'], 'source-' + str(i))
    d = scene['duration'] + (overlap if i < len(scenes) - 1 else 0)
    speed = scene['speed']
    args = ['-loop', '1', '-framerate', str(fps), '-i', source] if scene['kind'] == 'image' else ['-ss', str(scene['trim_start']), '-i', source]
    vf = f'scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1'
    if scene['kind'] == 'video' and speed != 1: vf += f',setpts=PTS/{speed}'
    vf += f',fps={fps}'
    m = scene['motion']
    if scene['kind'] == 'image' and m != 'none':
        frames = max(1, round(d * fps))
        p = f'on/{frames}'
        z, x, y = {'zoom_in': (f'1+0.14*{p}', 'iw/2-iw/zoom/2', 'ih/2-ih/zoom/2'), 'zoom_out': (f'1.14-0.14*{p}', 'iw/2-iw/zoom/2', 'ih/2-ih/zoom/2'),
                   'pan_left': ('1.12', f'(iw-iw/zoom)*(1-{p})', 'ih/2-ih/zoom/2'), 'pan_right': ('1.12', f'(iw-iw/zoom)*{p}', 'ih/2-ih/zoom/2'),
                   'pan_up': ('1.12', 'iw/2-iw/zoom/2', f'(ih-ih/zoom)*(1-{p})'), 'ken_burns': (f'1.04+0.12*{p}', f'(iw-iw/zoom)*{p}*0.6', f'(ih-ih/zoom)*{p}*0.4')}[m]
        # Upscale first so slow zoom stays smooth instead of jittering on integer pixels.
        vf = f'scale={w*2}:{h*2}:force_original_aspect_ratio=increase,crop={w*2}:{h*2},setsar=1' + f",zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={w}x{h}:fps={fps}"
    if scene['kind'] == 'video': vf += f',tpad=stop_mode=clone:stop_duration={d}'
    if look: vf += ',' + ','.join(look)
    path = os.path.join(work, f'scene-{i}.mp4')
    run([*args, '-t', f'{d:.3f}', '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', str(fps), '-threads', '2', path])
    parts.append(path)

base = os.path.join(work, 'base.mp4')
if overlap == 0 or len(parts) == 1:
    listing = os.path.join(work, 'list.txt')
    with open(listing, 'w') as out: out.write(''.join("file '" + p + "'\n" for p in parts))
    run(['-f', 'concat', '-safe', '0', '-i', listing, '-c', 'copy', base])
else:
    # Each scene is padded by the overlap, so xfade keeps the timeline equal to the sum of scene durations.
    args, chain, prev, offset = [], [], '0:v', 0.0
    for p in parts: args += ['-i', p]
    for i in range(1, len(parts)):
        offset += scenes[i - 1]['duration']
        out = f'x{i}'
        chain.append(f'[{prev}][{i}:v]xfade=transition={TRANS[tr]}:duration={overlap:.3f}:offset={offset:.3f}[{out}]')
        prev = out
    run([*args, '-filter_complex', ';'.join(chain), '-map', f'[{prev}]', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p', '-threads', '2', base], timeout=280)

def font_file(weight):
    name = {'bold': 'IBMPlexSansArabic-Bold.ttf', 'regular': 'IBMPlexSansArabic-Medium.ttf'}[weight]
    target = os.path.join('/home/user/.fonts', name)
    if not os.path.exists(target):
        try:
            os.makedirs('/home/user/.fonts', exist_ok=True)
            urllib.request.urlretrieve('https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsansarabic/' + name, target)
        except Exception:
            if os.path.exists(target): os.remove(target)
    if os.path.exists(target) and os.path.getsize(target) > 10000: return target
    found = glob.glob('/usr/share/fonts/**/DejaVuSans-Bold.ttf' if weight == 'bold' else '/usr/share/fonts/**/DejaVuSans.ttf', recursive=True)
    if not found: raise ValueError('Caption font missing')
    return found[0]

style = CONFIG['caption_style']
ACCENT = tuple(int(CONFIG['accent'][i:i + 2], 16) for i in (1, 3, 5)) + (255,)
raqm = features.check_feature('raqm')

def shape(text):
    if re.search('[\\u0600-\\u06ff]', text) and not raqm:
        import arabic_reshaper
        from bidi.algorithm import get_display
        return get_display(arabic_reshaper.reshape(text))
    return text

def caption_image(c, index, active=None):
    """active: index of the highlighted word for karaoke; whole lines are kept identical across states."""
    pos = c['position']
    big = style == 'bold' or pos == 'center' and style != 'minimal'
    size = int(short * (0.085 if big else 0.06 if style != 'minimal' else 0.046))
    words = c['text'].split()
    arabic = bool(re.search('[\\u0600-\\u06ff]', c['text']))
    direction = {'direction': 'rtl'} if arabic and raqm else {}
    image = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    path = font_file('bold' if style in ('bold', 'karaoke', 'glass') else 'regular')
    while True:
        font = ImageFont.truetype(path, size)
        lines, line = [], []
        for i, word in enumerate(words):
            trial = ' '.join(x for _, x in line + [(i, word)])
            if draw.textlength(shape(trial), font=font, **direction) > w * 0.82 and line: lines.append(line); line = [(i, word)]
            else: line.append((i, word))
        if line: lines.append(line)
        if size <= 16 or len(lines) <= (2 if big else 3): break
        size -= 2
    lh = size * 1.32
    block = len(lines) * lh
    y = {'center': (h - block) / 2, 'top': h * 0.12, 'bottom': h * 0.76 - block / 2}[pos]
    widths = [draw.textlength(shape(' '.join(x for _, x in l)), font=font, **direction) for l in lines]
    pad = size * 0.55
    if style == 'glass':
        bw = max(widths) + pad * 2
        box = (w / 2 - bw / 2, y - pad * 0.7, w / 2 + bw / 2, y + block + pad * 0.5)
        shadow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle((box[0], box[1] + 8, box[2], box[3] + 8), radius=int(size * 0.9), fill=(0, 0, 0, 90))
        image = Image.alpha_composite(image, shadow.filter(ImageFilter.GaussianBlur(18)))
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle(box, radius=int(size * 0.9), fill=(28, 28, 32, 150), outline=(255, 255, 255, 70), width=2)
    for l, lw in zip(lines, widths):
        text = ' '.join(x for _, x in l)
        if style == 'karaoke' and active is not None:
            # Place each word separately (right-to-left for Arabic) so the active word is highlighted exactly.
            space = draw.textlength(' ', font=font)
            sizes = [draw.textlength(shape(x), font=font, **direction) for _, x in l]
            total = sum(sizes) + space * (len(l) - 1)
            x = w / 2 + total / 2 if arabic else w / 2 - total / 2
            for (i, word), ww in zip(l, sizes):
                x0 = x - ww if arabic else x
                draw.text((x0, y), shape(word), font=font, anchor='lt', fill=ACCENT if i == active else (255, 255, 255, 235), stroke_width=max(2, size // 14), stroke_fill=(0, 0, 0, 220), **direction)
                x = x0 - space if arabic else x + ww + space
        elif style == 'minimal':
            draw.text((w / 2, y + 2), shape(text), font=font, anchor='mt', fill=(0, 0, 0, 140), **direction)
            draw.text((w / 2, y), shape(text), font=font, anchor='mt', fill=(255, 255, 255, 240), **direction)
        else:
            stroke = max(2, size // 12) if style == 'bold' else 0
            draw.text((w / 2, y), shape(text), font=font, anchor='mt', fill=(255, 255, 255, 250), stroke_width=stroke, stroke_fill=(0, 0, 0, 230), **direction)
        y += lh
    target = os.path.join(work, f'caption-{index}-{active}.png')
    image.save(target)
    return target

overlays = []
for i, c in enumerate(CONFIG['captions']):
    if style == 'karaoke' and c.get('words'):
        for k, word in enumerate(c['words']):
            end = c['words'][k + 1]['start'] if k + 1 < len(c['words']) else c['end']
            overlays.append((caption_image(c, i, k), word['start'], max(end, word['end'])))
    else:
        overlays.append((caption_image(c, i), c['start'], c['end']))
if len(overlays) > 400: raise ValueError('Too many caption states; split into shorter renders')

args, filters, current, index = ['-i', base], [], '0:v', 1
for n, (img, start, end) in enumerate(overlays):
    args += ['-loop', '1', '-t', f'{duration:.3f}', '-i', img]
    nxt = f'cap{n}'
    filters.append(f"[{current}][{index}:v]overlay=enable='between(t,{start:.3f},{end - 0.001:.3f})'[{nxt}]")
    current = nxt; index += 1
voice = music = None
if CONFIG.get('narration'):
    voice = index; index += 1; args += ['-i', asset(CONFIG['narration'], 'narration')]
if CONFIG.get('music'):
    music = index; index += 1; args += ['-stream_loop', '-1', '-i', asset(CONFIG['music'], 'music')]
if voice is not None:
    filters.append(f'[{voice}:a]aresample=48000,apad,atrim=duration={duration},asetpts=PTS-STARTPTS[voice]')
if music is not None:
    fade_out = max(0, duration - 1.5)
    filters.append(f"[{music}:a]aresample=48000,volume={CONFIG['music_volume']},atrim=duration={duration},asetpts=PTS-STARTPTS,afade=t=in:d=0.6,afade=t=out:st={fade_out}:d=1.5[music]")
if voice is not None and music is not None:
    filters += ['[voice]asplit=2[spoken][side]', '[music][side]sidechaincompress=threshold=0.025:ratio=8:attack=20:release=250[ducked]', '[spoken][ducked]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5[audio]']
elif voice is not None: filters.append('[voice]loudnorm=I=-14:TP=-1.5[audio]')
elif music is not None: filters.append('[music]loudnorm=I=-14:TP=-1.5[audio]')
if filters: args += ['-filter_complex', ';'.join(filters), '-filter_complex_threads', '1']
args += ['-map', f'[{current}]' if current != '0:v' else '0:v']
if voice is not None or music is not None: args += ['-map', '[audio]', '-c:a', 'aac', '-b:a', '160k']
else: args += ['-an']
rate = min(6000000, int(18 * 1024 * 1024 * 8 / duration) - 180000)
output = '/home/user/' + CONFIG['name']
run([*args, '-t', f'{duration:.3f}', '-c:v', 'libx264', '-preset', 'medium' if duration <= 30 else 'veryfast', '-profile:v', 'high', '-b:v', str(rate), '-maxrate', str(rate), '-bufsize', str(rate * 2), '-threads', '2', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output], timeout=290)
if os.path.getsize(output) > 20 * 1024 * 1024: raise ValueError('Video exceeds private export size; reduce duration or resolution')
print(json.dumps({'path': output, 'name': CONFIG['name'], 'mime': 'video/mp4', 'duration': duration, 'width': w, 'height': h, 'grade': CONFIG['grade'], 'transition': tr, 'caption_style': style, 'has_audio': voice is not None or music is not None, 'captions': len(CONFIG['captions']), 'size': os.path.getsize(output)}))
