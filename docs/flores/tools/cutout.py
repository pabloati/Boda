import sys, os, json
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
def cutout(path, crop=None, mask=(), height=820, lo=22, hi=62, soft=0):
    im = Image.open(path).convert('RGB'); W0, H0 = im.size
    # paper colour = median of the outer ring of the (cropped) plate
    box = (int(crop[0]*W0), int(crop[1]*H0), int(crop[2]*W0), int(crop[3]*H0)) if crop else (0, 0, W0, H0)
    ring = np.asarray(im.crop(box)); r = max(4, ring.shape[0]//30)
    edge = np.concatenate([ring[:r].reshape(-1,3), ring[-r:].reshape(-1,3), ring[:, :r].reshape(-1,3), ring[:, -r:].reshape(-1,3)])
    paper = np.median(edge, axis=0)
    d = ImageDraw.Draw(im)
    for m in mask: d.rectangle([m[0]*W0, m[1]*H0, m[2]*W0, m[3]*H0], fill=tuple(int(v) for v in paper))
    im = im.crop(box); s = height / im.size[1]; im = im.resize((max(1, int(im.size[0]*s)), height), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float32)
    dist = np.sqrt(((a - paper) ** 2).sum(axis=2))
    al = np.clip((dist - lo) / (hi - lo), 0, 1)
    al = np.asarray(Image.fromarray((al*255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32) / 255
    al[al < 0.12] = 0
    h, w = al.shape; yy, xx = np.mgrid[0:h, 0:w]
    dd = np.minimum.reduce([xx, w-1-xx, yy, h-1-yy]).astype(np.float32)
    if soft: al *= np.clip(dd / soft, 0, 1)
    out = np.dstack([a.astype(np.uint8), (al*255).astype(np.uint8)])
    im2 = Image.fromarray(out, 'RGBA'); bb = im2.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    return im2.crop(bb) if bb else im2
if __name__ == '__main__':
    src, dst, spec = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
    for name, kw in spec.items():
        f = [x for x in os.listdir(src) if x.rsplit('.', 1)[0] == name][0]
        cutout(os.path.join(src, f), **kw).save(os.path.join(dst, name + '.png'), optimize=True); print('ok', name)
