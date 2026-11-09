// Botanical plates placed on the sections. The layout comes from js/flores-layout.js, which the
// flower editor (_dev/flores.html) writes. Everything is null-guarded: a missing section or an
// empty layout leaves the page as it was.
(function () {
  'use strict';

  const DIR = 'assets/flores/';

  // Section key → element. Keys are section ids, plus 'footer'.
  function host(doc, key) {
    return key === 'footer' ? doc.querySelector('.footer-section') : doc.getElementById(key);
  }

  // Applies one item's placement to its <img>. Offsets are px from the nearest edge, so a plate
  // flush with a section edge stays flush when the section changes size.
  function place(img, it) {
    img.style.width = it.w + 'px';
    img.style.left = it.x.a === 'l' ? it.x.v + 'px' : 'auto';
    img.style.right = it.x.a === 'r' ? it.x.v + 'px' : 'auto';
    img.style.top = it.y.a === 't' ? it.y.v + 'px' : 'auto';
    img.style.bottom = it.y.a === 'b' ? it.y.v + 'px' : 'auto';
    const t = [];
    if (it.rot) t.push('rotate(' + it.rot + 'deg)');
    if (it.flip) t.push('scaleX(-1)');
    if (it.flipY) t.push('scaleY(-1)');
    img.style.transform = t.join(' ');
    img.classList.toggle('flor--front', !!it.front);
    img.classList.toggle('flor--no-m', it.hide === 'm');
    img.classList.toggle('flor--no-d', it.hide === 'd');
  }

  function render(doc, items) {
    doc.querySelectorAll('.flor').forEach(el => el.remove());
    items.forEach(function (it) {
      const sec = host(doc, it.sec);
      if (!sec) return;
      sec.classList.add('has-flores');
      const img = doc.createElement('img');
      img.className = 'flor';
      img.src = DIR + it.img + '.png';
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.decoding = 'async';
      img.dataset.id = it.id;
      place(img, it);
      sec.appendChild(img);
    });
  }

  window.Flores = { host: host, place: place, render: render, DIR: DIR };

  const layout = window.FLORES_LAYOUT;
  if (layout && Array.isArray(layout.items) && layout.items.length) render(document, layout.items);
})();
