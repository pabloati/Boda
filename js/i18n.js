/**
 * LANGUAGE TOGGLE (ES / EN)
 *
 * How it works
 * - Static texts: the element carries data-i18n="key". Its Spanish content in the
 *   HTML is captured at start-up, so Spanish never needs to be repeated here;
 *   only the English entry is written in EN below. data-i18n-placeholder,
 *   data-i18n-aria and data-i18n-title translate those attributes the same way.
 * - Texts built by scripts: call I18N.t('key', { var: value }) and keep both the
 *   ES and the EN entries below ({var} placeholders are replaced).
 * - A missing English entry logs a console warning and leaves the Spanish text,
 *   so a forgotten translation is visible in the console but never breaks the page.
 * - The choice is remembered in localStorage ("lang"). Default: Spanish.
 */
window.I18N = (function () {
  'use strict';

  const ES = {
    // --- script.js ---
    'rsvp.alertName': 'Por favor indica tu nombre y apellidos antes de guardar.',
    'rsvp.sending': 'Enviando tu respuesta…',
    'rsvp.thanks': '¡Muchas gracias, <strong>{name}</strong>! Hemos recibido tu respuesta.',
    'rsvp.thanksYes': 'Nos alegra mucho celebrar contigo.',
    'rsvp.thanksNo': 'Gracias por avisarnos, te echaremos de menos.',
    'rsvp.error': 'No hemos podido guardar tu respuesta. Inténtalo de nuevo en un momento y, si sigue fallando, escríbenos por WhatsApp.',
    'copy.done': '¡Copiado!',
    'ics.summary': 'Boda de Mª Ángeles & Pablo',
    'ics.description': 'Ceremonia en la Parroquia de San José (C. Alcalá 43) a las 12:30 y convite en el Complejo La Cigüeña (Arganda del Rey) a las 14:30.',
    'lang.switchTo': 'Cambiar a inglés',
    // --- playlist.js ---
    'pl.err.voteLimit': 'Ya has usado tus {n} corazones. Quita uno de otra canción para votar esta.',
    'pl.err.songLimit': 'Ya has propuesto {n} canciones. ¡Ahora toca votar las de los demás!',
    'pl.err.notFound': 'Esa canción ya no está en la lista.',
    'pl.err.network': 'No hemos podido conectar. Inténtalo de nuevo en un momento.',
    'pl.heartsOne': 'Te queda 1 corazón',
    'pl.hearts': 'Te quedan {n} corazones',
    'pl.countOne': '1 canción',
    'pl.count': '{n} canciones',
    'pl.empty': 'Todavía no hay canciones. ¡Estrena tú la playlist!',
    'pl.showTop': 'Ver solo el top {n}',
    'pl.showAll': 'Ver las {n} canciones',
    'pl.added': '¡Añadida! Ya lleva tu corazón. Compártela para que suba 🎶',
    'pl.addedExisting': 'Esa ya estaba en la lista: le hemos sumado tu corazón 💛',
    'pl.askDuplicate': '¿Te refieres a «{title} – {artist}», que ya está en la lista?',
    'pl.askYes': 'Sí, votar esa',
    'pl.askNo': 'No, es otra',
    'pl.add': 'Añadir',
    'pl.addAria': 'Añadir {title} de {artist}',
    'pl.inList': 'Ya en la lista',
    'pl.addNew': 'Añadir una nueva',
    'pl.catalogError': 'No hemos podido buscar en el catálogo de música.',
    'pl.noResults': 'Sin resultados para «{term}».',
    'pl.searching': ' Buscando…',
    'pl.manual': '¿No la encuentras? Añádela a mano',
    'pl.previewError': 'No se ha podido reproducir el fragmento.',
    'pl.demo': 'Modo demo: las canciones y votos se guardan solo en este navegador.'
  };

  const EN = {
    // --- envelope ---
    'env.subtitle': "We're getting married",
    'env.sealAria': 'Open the invitation',
    // --- hero ---
    'hero.pretitle': "We're getting married",
    'hero.date': 'Saturday, 13 March 2027',
    'hero.scroll': 'Scroll',
    'hero.scrollAria': 'Scroll to keep reading',
    // --- intro ---
    'intro.text': '&laquo;There is no fear in love, but perfect love casts out fear.&raquo;',
    'intro.ref': '1 John 4:18',
    // --- parents ---
    'parents.title': 'Our parents',
    'parents.bride': 'Parents of the bride',
    'parents.groom': 'Parents of the groom',
    // --- countdown ---
    'countdown.title': 'Only a few days to go',
    'countdown.days': 'days',
    'countdown.hours': 'hours',
    'countdown.min': 'min',
    'countdown.sec': 'sec',
    'countdown.calendar': 'Add to calendar',
    // --- where & when ---
    'loc.title': 'Where and when',
    'loc.ceremony': 'Ceremony · 12:30',
    'loc.reception': 'Reception · 14:30',
    'loc.map': 'See map',
    // --- timeline ---
    'tl.title': 'The day',
    'tl.1.title': 'Ceremony',
    'tl.1.desc': 'Where our marriage begins.',
    'tl.2.title': 'Reception',
    'tl.2.desc': 'A good cocktail awaits you.',
    'tl.3.title': 'Party',
    'tl.3.desc': 'Now the fun starts.',
    'tl.4.title': 'Buses',
    'tl.4.desc': "Don't let the party stop!",
    // --- rsvp ---
    'rsvp.title': 'Will you join us?',
    'rsvp.lead': 'Please reply by 1 February 2027.',
    'rsvp.name': 'Full name',
    'rsvp.phone': 'Phone <span class="optional">(in case we need to call you)</span>',
    'rsvp.coming': 'Are you coming?',
    'rsvp.yes': "Yes, I'll be there",
    'rsvp.no': "I can't make it",
    'rsvp.companions': 'Guests coming with you <span class="optional">(full names, one per line)</span>',
    'rsvp.bus': 'Bus',
    'rsvp.busNo': "No, I'll make my own way",
    'rsvp.busYes': 'Yes, I need a seat',
    'rsvp.busType': 'Which bus?',
    'rsvp.busThere': 'There',
    'rsvp.busBack': 'Back',
    'rsvp.busBoth': 'Both ways',
    'rsvp.diet': 'Allergies or intolerances',
    'rsvp.menu': 'Menu',
    'rsvp.menuRegular': 'Regular',
    'rsvp.menuVeg': 'Vegetarian',
    'rsvp.playlistHint': "A song that can't be missing? Request or vote for it in <a href=\"#playlist\">the playlist</a>.",
    'rsvp.message': 'Leave us a little message <span class="optional">(the most original one wins a prize) ;)</span>',
    'rsvp.submit': 'Send',
    'rsvp.whatsapp': 'Any questions? Message us on WhatsApp',
    'rsvp.alertName': 'Please enter your full name before sending.',
    'rsvp.sending': 'Sending your reply…',
    'rsvp.thanks': 'Thank you, <strong>{name}</strong>! We have received your reply.',
    'rsvp.thanksYes': "We can't wait to celebrate with you.",
    'rsvp.thanksNo': "Thanks for letting us know, we'll miss you.",
    'rsvp.error': "We couldn't save your reply. Please try again in a moment and, if it keeps failing, message us on WhatsApp.",
    // --- gifts ---
    'gifts.title': 'Gifts',
    'gifts.lead': "Your presence is the best gift.<br>If you'd also like to give us a little envelope or a present:",
    'gifts.showIban': 'Show bank account',
    'gifts.copy': 'Copy',
    'gifts.copyAria': 'Copy the IBAN',
    'gifts.meta': 'Pablo Atienza &amp; María de los Ángeles Quijano<br>Reference: Boda Mª Ángeles y Pablo + your name',
    'copy.done': 'Copied!',
    // --- playlist (static) ---
    'pl.title': 'The playlist',
    'pl.lead': "Search for the song that can't be missing, or vote for the ones already there.",
    'pl.searchLabel': 'Song or artist',
    'pl.searchPlaceholder': 'Vivir mi vida, Queen, Rosalía…',
    'pl.manualTitle': 'Add it by hand',
    'pl.song': 'Song',
    'pl.artist': 'Artist',
    'pl.cancel': 'Cancel',
    'pl.addBtn': 'Add',
    'pl.rankingAria': 'Song ranking',
    // --- playlist (script) ---
    'pl.err.voteLimit': "You've used your {n} hearts. Take one off another song to vote for this one.",
    'pl.err.songLimit': "You've already suggested {n} songs. Time to vote for the others!",
    'pl.err.notFound': "That song isn't on the list any more.",
    'pl.err.network': "We couldn't connect. Please try again in a moment.",
    'pl.heartsOne': 'You have 1 heart left',
    'pl.hearts': 'You have {n} hearts left',
    'pl.countOne': '1 song',
    'pl.count': '{n} songs',
    'pl.empty': 'No songs yet. Be the first to add one!',
    'pl.showTop': 'Show only the top {n}',
    'pl.showAll': 'Show all {n} songs',
    'pl.added': 'Added! It already has your heart. Share it to push it up 🎶',
    'pl.addedExisting': "That one was already on the list: we've added your heart 💛",
    'pl.askDuplicate': 'Did you mean "{title} – {artist}", which is already on the list?',
    'pl.askYes': 'Yes, vote for that one',
    'pl.askNo': "No, it's a different one",
    'pl.add': 'Add',
    'pl.addAria': 'Add {title} by {artist}',
    'pl.inList': 'Already on the list',
    'pl.addNew': 'Add a new one',
    'pl.catalogError': "We couldn't search the music catalogue.",
    'pl.noResults': 'No results for "{term}".',
    'pl.searching': ' Searching…',
    'pl.manual': "Can't find it? Add it by hand",
    'pl.previewError': "The preview couldn't be played.",
    'pl.demo': 'Demo mode: songs and votes are saved only in this browser.',
    // --- photos ---
    'social.title': 'Photos',
    'social.lead': 'Share your photos and videos of the day with the hashtag',
    'social.copy': 'Copy',
    // --- footer ---
    'footer.title': 'Thank you for being part of our lives',
    // --- controls ---
    'music.aria': 'Play or pause the music',
    'top.aria': 'Back to top',
    'lang.switchTo': 'Cambiar a español',
    // --- calendar file ---
    'ics.summary': 'Wedding of Mª Ángeles & Pablo',
    'ics.description': 'Ceremony at Parroquia de San José (C. Alcalá 43) at 12:30 and reception at Complejo La Cigüeña (Arganda del Rey) at 14:30.'
  };

  const dict = { es: ES, en: EN };
  let lang = 'es';
  try { lang = localStorage.getItem('lang') === 'en' ? 'en' : 'es'; } catch (e) { /* storage blocked: stay in Spanish */ }

  const ATTRS = [
    ['data-i18n', null],
    ['data-i18n-placeholder', 'placeholder'],
    ['data-i18n-aria', 'aria-label'],
    ['data-i18n-title', 'title']
  ];

  // Capture the Spanish texts from the HTML once, so ES needs no duplicate entries
  function captureSpanish() {
    ATTRS.forEach(function (pair) {
      const attr = pair[0], target = pair[1];
      document.querySelectorAll('[' + attr + ']').forEach(function (el) {
        const key = el.getAttribute(attr);
        if (ES[key] != null) return;
        ES[key] = target ? el.getAttribute(target) : el.innerHTML;
      });
    });
  }

  function t(key, vars) {
    let s = dict[lang][key];
    if (s == null) {
      if (lang !== 'es') console.warn('[i18n] missing ' + lang.toUpperCase() + ' text for "' + key + '"');
      s = ES[key] != null ? ES[key] : key;
    }
    if (vars) {
      Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(String(vars[k])); });
    }
    return s;
  }

  function apply() {
    document.documentElement.lang = lang;
    ATTRS.forEach(function (pair) {
      const attr = pair[0], target = pair[1];
      document.querySelectorAll('[' + attr + ']').forEach(function (el) {
        const value = t(el.getAttribute(attr));
        if (target) el.setAttribute(target, value); else el.innerHTML = value;
      });
    });
    const toggle = document.getElementById('lang-toggle');
    if (toggle) {
      toggle.textContent = lang === 'es' ? 'EN' : 'ES';
      toggle.setAttribute('aria-label', t('lang.switchTo'));
    }
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
  }

  function set(next) {
    lang = next === 'en' ? 'en' : 'es';
    try { localStorage.setItem('lang', lang); } catch (e) { /* ignore */ }
    apply();
  }

  function init() {
    captureSpanish();
    const toggle = document.getElementById('lang-toggle');
    if (toggle) toggle.addEventListener('click', function () { set(lang === 'es' ? 'en' : 'es'); });
    apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  return { t: t, set: set, apply: apply, get lang() { return lang; } };
})();
