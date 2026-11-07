# 緑背景を抜いて webp(透過) にする。python key.py（Pillow と numpy が要る）
import numpy as np, glob, os, sys
from PIL import Image, ImageFilter
D = os.path.dirname(os.path.abspath(__file__)); OUT = D + '/../img/'; RAW = D + '/../../_art_raw/job-host/raw'  # 生成元の画像はリポジトリの外
def key(src, size=None):
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = g - np.maximum(r, b)
    al = 1 - np.clip((k - 2) / (40 - 2), 0, 1)
    lim = np.maximum(r, b); g = np.where(g > lim, lim, g)  # 縁の緑かぶりを取る
    # 縁の黄緑のにじみ: 半透明の所は緑を赤青の平均まで落とす
    spill = (k > -6) | (al < 0.98); g = np.where(spill, np.minimum(g, 0.72 * r + 0.28 * b), g)
    im = Image.fromarray(np.dstack([r, g, b, al * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    A = im.split()[3].filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(0.9)); im.putalpha(A)
    return im.resize(size, Image.LANCZOS) if size else im
def save(im, n, q=80):
    im.save(OUT + n + '.webp', quality=q, method=6); print(n, im.size, os.path.getsize(OUT + n + '.webp') // 1024, 'KB')
for f in sorted(glob.glob(RAW + '/[gxs]*.png')):
    n = os.path.basename(f)[:-4]
    if n.startswith('s_') or n.startswith('x_') or n.startswith('g'):
        save(key(f, (640, 960)), n, 78)
cw = key(RAW + '/crew.png'); bb = cw.getbbox(); cw = cw.crop(bb); cw.thumbnail((1000, 1000)); save(cw, 'crew', 80)
tw = key(RAW + '/tower.png'); tw = tw.crop(tw.getbbox()); tw.thumbnail((520, 760)); save(tw, 'tower', 80)
bg = Image.open(RAW + '/bg.png').convert('RGB'); save(bg, 'bg', 78)
def cells(sheet, cols, rows, names, mx=300):
    it = key(RAW + '/' + sheet + '.png'); W, H = it.size
    for i, n in enumerate(names):
        c = it.crop((i % cols * W // cols, i // cols * H // rows, (i % cols + 1) * W // cols, (i // cols + 1) * H // rows))
        bb = c.getbbox(); print(sheet, n, bb)
        c = c.crop(bb); c.thumbnail((mx, mx)); save(c, n, 82)
cells('items_a', 4, 3, ['i_mirror', 'i_lipstick', 'i_brooch', 'i_medicine', 'i_phone', 'i_papers', 'i_fish', 'i_nose', 'i_ticket', 'i_book', 'i_earbuds', 'i_readers'])
cells('items_b', 3, 2, ['i_senpai', 'i_pass', 'i_ledger', 'i_cards', 'i_coupons', 'i_purse'])
cells('bottles', 3, 1, ['b1', 'b2', 'b3'], 420)
