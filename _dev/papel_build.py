# Turns a photo of paper into a seamless, darkening-only overlay: brown ink whose alpha is the
# shadow of the paper grain. usage: mkpaper.py <in.jpg> <out.webp> <strength> <tile px>
import sys
import numpy as np
from PIL import Image, ImageFilter
src, out, k, T = sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4])
O = 96                                                     # overlap that is cross-faded
a = np.asarray(Image.open(src).convert('L'), dtype=np.float32)
low = np.asarray(Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(24)), dtype=np.float32)
flat = (a / np.maximum(low, 1))[40:40 + T + O, 40:40 + T + O]   # only the grain, no large light changes
r = np.linspace(0, 1, O, dtype=np.float32)
t = flat[:, :T].copy()
t[:, :O] = flat[:, T:T + O] * (1 - r) + flat[:, :O] * r     # left border fades in from what follows the right one
u = t[:T].copy()
u[:O] = t[T:T + O] * (1 - r[:, None]) + t[:O] * r[:, None]
top = np.percentile(u, 96)
alpha = np.clip((1 - u / top) * k, 0, 1)
print('alpha mean %.3f p95 %.3f' % (alpha.mean(), np.percentile(alpha, 95)))
rgba = np.zeros((T, T, 4), np.uint8)
rgba[..., 0], rgba[..., 1], rgba[..., 2] = 104, 82, 48
rgba[..., 3] = (alpha * 255).astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save(out, quality=50, alpha_quality=45, method=6)
