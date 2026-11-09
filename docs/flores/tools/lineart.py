import sys, os, json
import numpy as np
from PIL import Image, ImageFilter
OLIVE = (0x6b, 0x6e, 0x4a)
def trace(path, crop=None, mask=(), height=760, gain=5.0, fill=0.30, soft=14):
    im = Image.open(path).convert('RGB')
    from PIL import ImageDraw
    W0, H0 = im.size
    for m in mask: ImageDraw.Draw(im).rectangle([m[0]*W0, m[1]*H0, m[2]*W0, m[3]*H0], fill=(255, 255, 255))
    if crop:
        w, h = im.size; im = im.crop((int(crop[0]*w), int(crop[1]*h), int(crop[2]*w), int(crop[3]*h)))
    s = height / im.size[1]; im = im.resize((max(1, int(im.size[0]*s)), height), Image.LANCZOS)
    g = np.asarray(im.convert('L'), dtype=np.float32)
    sat = np.asarray(im.convert('HSV'), dtype=np.float32)[..., 1] / 255.0
    bg = np.asarray(Image.fromarray(g.astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(25)), dtype=np.float32)
    local = np.asarray(Image.fromarray(g.astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2)), dtype=np.float32)
    edge = np.clip((local - g) / 255.0 * gain * 3, 0, 1)          # dark detail against its surroundings
    body = np.clip((bg - g) / np.maximum(bg, 1) * 1.4, 0, 1) * (0.35 + 0.65 * sat) * fill
    a = np.clip(edge + body, 0, 1) ** 0.9
    # paper noise out
    a = np.asarray(Image.fromarray((a*255).astype(np.uint8)).filter(ImageFilter.MedianFilter(3)), dtype=np.float32)/255.0
    a = np.clip((a - 0.13) / 0.87, 0, 1)
    # soft fade at the borders, like the Hoja de ruta drawings
    h, w = a.shape; yy, xx = np.mgrid[0:h, 0:w]
    d = np.minimum.reduce([xx, w-1-xx, yy, h-1-yy]).astype(np.float32)
    a *= np.clip(d / soft, 0, 1) ** 1.2
    out = np.zeros((h, w, 4), np.uint8); out[..., :3] = OLIVE; out[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')
if __name__ == '__main__':
    src, dst, spec = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3]))
    for name, kw in spec.items():
        f = [x for x in os.listdir(src) if x.rsplit('.', 1)[0] == name][0]
        trace(os.path.join(src, f), **kw).save(os.path.join(dst, name + '.png'), optimize=True)
        print('ok', name)
