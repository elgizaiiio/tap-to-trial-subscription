"""Measures real media facts (no models): streams, scene cuts, brightness, motion, beats, silences, keyframe sheet."""
import json, subprocess, re, os, socket, ipaddress, urllib.request, urllib.parse, pathlib, tempfile
import imageio_ffmpeg
ff = imageio_ffmpeg.get_ffmpeg_exe()
work = tempfile.mkdtemp(prefix='analyze-', dir='/home/user')

def public_host(url):
    for info in socket.getaddrinfo(urllib.parse.urlparse(url).hostname or '', 443):
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified: raise ValueError('Asset host is not public')
class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not newurl.startswith('https://'): raise ValueError('Insecure redirect')
        public_host(newurl); return super().redirect_request(req, fp, code, msg, headers, newurl)

src = SOURCE
if src.startswith('/home/user/'):
    path = str(pathlib.Path(src).resolve())
    if not path.startswith('/home/user/') or not os.path.isfile(path): raise ValueError('File missing under /home/user/')
else:
    public_host(src)
    path = os.path.join(work, 'input')
    with urllib.request.build_opener(SafeRedirect).open(urllib.request.Request(src, headers={'User-Agent': 'CeyoMedia/2.0'}), timeout=40) as r, open(path, 'wb') as out:
        n = 0
        while True:
            c = r.read(65536)
            if not c: break
            n += len(c)
            if n > 150 * 1024 * 1024: raise ValueError('Asset exceeds 150 MB')
            out.write(c)

def ffrun(args, timeout=150):
    return subprocess.run([ff, '-hide_banner', *args], capture_output=True, text=True, timeout=timeout)

t = ffrun(['-i', path]).stderr
if 'Video:' not in t and 'Audio:' not in t: raise ValueError('Not readable video/audio: ' + t[-300:])
d = re.search(r'Duration: (\d+):(\d+):([\d.]+)', t)
dur = int(d[1]) * 3600 + int(d[2]) * 60 + float(d[3]) if d else None
v = re.search(r'Video: ([^,\s]+).*?(\d{2,5})x(\d{2,5})', t)
fr = re.search(r'([\d.]+) fps', t)
report = {'source': src, 'duration': dur, 'has_video': 'Video:' in t, 'has_audio': 'Audio:' in t,
          'video_codec': v[1] if v else None, 'width': int(v[2]) if v else None, 'height': int(v[3]) if v else None, 'fps': float(fr[1]) if fr else None}
is_still = report['has_video'] and (dur is None or dur < 0.2)
if report['has_video'] and report['width']:
    report['orientation'] = 'vertical' if report['height'] > report['width'] else 'horizontal' if report['width'] > report['height'] else 'square'
if report['has_video'] and not is_still:
    sc = ffrun(['-i', path, '-vf', f"scale=320:-2,select='gt(scene,{THRESHOLD})',showinfo", '-an', '-f', 'null', '-'], 200).stderr
    cuts = [round(float(x), 2) for x in re.findall(r'pts_time:([\d.]+)', sc)]
    bounds = [0.0] + cuts + [dur or 0]
    shots = [{'start': round(a, 2), 'end': round(b, 2), 'length': round(b - a, 2)} for a, b in zip(bounds, bounds[1:]) if b - a > 0.15]
    # Brightness/motion per shot from signalstats on a downscaled pass.
    st = ffrun(['-i', path, '-vf', 'fps=2,scale=160:-2,signalstats,metadata=print', '-an', '-f', 'null', '-'], 200).stderr
    times = [float(x) for x in re.findall(r'pts_time:([\d.]+)', st)]
    yavg = [float(x) for x in re.findall(r'YAVG=([\d.]+)', st)]
    ydif = [float(x) for x in re.findall(r'YDIF=([\d.]+)', st)]
    sat = [float(x) for x in re.findall(r'SATAVG=([\d.]+)', st)]
    for s in shots:
        idx = [i for i, tt in enumerate(times) if s['start'] <= tt < s['end']]
        if idx:
            b = sum(yavg[i] for i in idx) / len(idx); m = sum(ydif[i] for i in idx if i < len(ydif)) / len(idx)
            s['brightness'] = 'dark' if b < 60 else 'bright' if b > 170 else 'normal'
            s['motion'] = 'static' if m < 2 else 'high' if m > 12 else 'moderate'
            if sat: s['saturation'] = round(sum(sat[i] for i in idx if i < len(sat)) / len(idx), 1)
    report['shots'] = shots[:80]
    report['shot_count'] = len(shots)
    # Contact sheet: one frame from the middle of up to 12 shots, labelled by timestamp, for the user/vision review.
    picks = shots[:12]
    frames = []
    for k, s in enumerate(picks):
        f = os.path.join(work, f'k{k}.jpg')
        ffrun(['-y', '-ss', str((s['start'] + s['end']) / 2), '-i', path, '-frames:v', '1', '-vf', 'scale=360:-2', f], 60)
        if os.path.exists(f): frames.append((f, s))
    if frames:
        from PIL import Image, ImageDraw
        ims = [Image.open(f).convert('RGB') for f, _ in frames]
        cw, ch = 360, max(i.height for i in ims)
        cols = 4; rows = (len(ims) + cols - 1) // cols
        sheet = Image.new('RGB', (cw * cols, ch * rows), (16, 16, 18))
        for n, (im, (_, s)) in enumerate(zip(ims, frames)):
            x, y = (n % cols) * cw, (n // cols) * ch
            sheet.paste(im, (x, y)); ImageDraw.Draw(sheet).text((x + 8, y + 8), f"{s['start']:.1f}s", fill=(255, 214, 10))
        out = '/home/user/' + NAME
        sheet.save(out, quality=85)
        report['keyframe_sheet'] = out
if report['has_audio']:
    raw = subprocess.run([ff, '-v', 'error', '-i', path, '-t', '600', '-ac', '1', '-ar', '11025', '-f', 's16le', '-'], capture_output=True, timeout=150).stdout
    import numpy as np
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
    if x.size > 11025:
        hop = 256
        frames = x[: x.size // hop * hop].reshape(-1, hop)
        energy = np.sqrt((frames ** 2).mean(axis=1) + 1e-9)
        flux = np.maximum(0, np.diff(np.log(energy), prepend=np.log(energy[0])))
        win = 43
        thresh = np.convolve(flux, np.ones(win) / win, mode='same') * 1.6 + 0.02
        peaks = [i for i in range(1, len(flux) - 1) if flux[i] > thresh[i] and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1]]
        onsets, last = [], -1e9
        for i in peaks:
            tt = i * hop / 11025
            if tt - last >= 0.18: onsets.append(round(tt, 3)); last = tt
        tempo = None
        if len(onsets) > 8:
            ac = np.correlate(flux - flux.mean(), flux - flux.mean(), mode='full')[len(flux) - 1:]
            lo, hi = int(60 / 200 * 11025 / hop), int(60 / 60 * 11025 / hop)
            lag = lo + int(np.argmax(ac[lo:hi]))
            tempo = round(60 * 11025 / hop / lag, 1)
        report['tempo_bpm'] = tempo
        report['beats'] = onsets[:300]
        loud = 20 * np.log10(energy + 1e-9)
        silent = loud < -42
        sil, start = [], None
        for i, s in enumerate(silent):
            tt = i * hop / 11025
            if s and start is None: start = tt
            if not s and start is not None:
                if tt - start > 0.5: sil.append([round(start, 2), round(tt, 2)])
                start = None
        report['silences'] = sil[:60]
        report['peak_dbfs'] = round(float(20 * np.log10(np.abs(x).max() + 1e-9)), 1)
print(json.dumps(report))
