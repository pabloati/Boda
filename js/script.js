/**
 * WEDDING INVITATION INTERACTIVITY ENGINE
 * Mª Ángeles & Pablo - 13 de marzo de 2027
 */

(function () {
  'use strict';

  const t = function (key, vars) { return window.I18N ? window.I18N.t(key, vars) : key; };

  // --- 1. DOM REFERENCES ---
  const envelopeOverlay = document.getElementById('envelope-overlay');
  const btnOpenEnvelope = document.getElementById('btn-open-envelope');
  const waxSeal = document.getElementById('wax-seal');
  const envelopeLetter = document.getElementById('envelope-letter');
  const weddingAudio = document.getElementById('wedding-audio');
  const btnMusicToggle = document.getElementById('btn-music-toggle');
  const musicIcon = document.getElementById('music-icon');
  const countdownClock = document.getElementById('countdown-clock');
  const daysEl = document.getElementById('days');
  const hoursEl = document.getElementById('hours');
  const minutesEl = document.getElementById('minutes');
  const secondsEl = document.getElementById('seconds');
  const btnAddCalendar = document.getElementById('btn-add-calendar');
  const rsvpForm = document.getElementById('rsvp-form');
  const rsvpContact = document.getElementById('rsvp-contact');
  const rsvpContactList = document.getElementById('rsvp-contact-list');
  const rsvpModal = document.getElementById('rsvp-modal');
  const rsvpAttendanceDetails = document.getElementById('rsvp-attendance-details');
  const btnCopyIban = document.getElementById('btn-copy-iban');
  const ibanValue = document.getElementById('iban-value');
  const copyText = document.getElementById('copy-text');
  const socialSection = document.getElementById('social');
  const albumLink = document.getElementById('album-link');

  // --- 2. AUDIO ENGINE ---
  let isMusicPlaying = false;

  function setMusicState(playing) {
    isMusicPlaying = playing;
    if (btnMusicToggle) btnMusicToggle.classList.toggle('active', playing);
    if (musicIcon) musicIcon.className = playing ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  }

  function playMusic() {
    if (!weddingAudio) return;
    weddingAudio.play().then(() => {
      setMusicState(true);
    }).catch((err) => {
      // Autoplay refused or the file is unavailable: stay silent, show the muted state.
      console.info('Audio unavailable:', err && err.message);
      setMusicState(false);
    });
  }

  function pauseMusic() {
    if (weddingAudio) weddingAudio.pause();
    setMusicState(false);
  }

  function toggleMusic() {
    if (isMusicPlaying) {
      pauseMusic();
    } else {
      playMusic();
    }
  }

  if (btnMusicToggle) {
    btnMusicToggle.addEventListener('click', toggleMusic);
  }

  // Song previews in the playlist (js/playlist.js) pause the background track and resume it afterwards
  let resumeAfterPreview = false;
  document.addEventListener('playlist:preview', function (e) {
    if (!btnMusicToggle) return;
    if (e.detail && e.detail.playing) {
      if (isMusicPlaying) {
        resumeAfterPreview = true;
        pauseMusic();
      }
    } else if (resumeAfterPreview) {
      resumeAfterPreview = false;
      playMusic();
    }
  });

  // --- 3. ENVELOPE OPENING ANIMATION ---
  // Flap up → the envelope falls away → the card turns over and grows → fade onto the hero.
  // The CSS phases are the classes opened-flap / drop / flip / fill / opened on the overlay.

  // Takes the card out of the envelope's layout: same screen box, but fixed to the viewport,
  // so the envelope parts can fall past it. The .detached class drops the peek translate.
  function detachLetter() {
    if (!envelopeLetter) return;
    const r = envelopeLetter.getBoundingClientRect();
    envelopeLetter.style.transition = 'none';
    envelopeLetter.style.position = 'fixed';
    envelopeLetter.style.top = r.top + 'px';
    envelopeLetter.style.left = r.left + 'px';
    envelopeLetter.style.width = r.width + 'px';
    envelopeLetter.style.height = r.height + 'px';
    envelopeLetter.classList.add('detached');
    envelopeLetter.getBoundingClientRect(); // flush, so the next values animate
    envelopeLetter.style.transition = '';
  }

  // --s scales the hero copy on the card back: card width over viewport width (1 = the real hero)
  function setLetterBox(top, left, width, height) {
    if (!envelopeLetter) return;
    envelopeLetter.style.top = top + 'px';
    envelopeLetter.style.left = left + 'px';
    envelopeLetter.style.width = width + 'px';
    envelopeLetter.style.height = height + 'px';
    envelopeLetter.style.setProperty('--s', (width / window.innerWidth).toFixed(4));
  }

  function syncLetterScale() {
    if (!envelopeLetter || envelopeLetter.classList.contains('detached')) return;
    const w = envelopeLetter.getBoundingClientRect().width;
    if (w) envelopeLetter.style.setProperty('--s', (w / window.innerWidth).toFixed(4));
  }
  syncLetterScale();
  window.addEventListener('resize', syncLetterScale);

  function centerLetter() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(vw * 0.78, vh * 0.56 * 2 / 3);
    const h = w * 1.5;
    setLetterBox((vh - h) / 2, (vw - w) / 2, w, h);
  }

  function openEnvelope() {
    // 1. Play background music on user gesture
    playMusic();
    if (!envelopeOverlay) return;
    if (waxSeal) waxSeal.disabled = true;

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      envelopeOverlay.classList.add('opened-flap', 'opened');
      setTimeout(() => { envelopeOverlay.style.display = 'none'; }, 700);
      return;
    }

    // 2. 0.0s: flap opens, seal fades, the card peeks out
    envelopeOverlay.classList.add('opened-flap');

    // 3. 0.7s: the envelope falls off the screen while the card floats to the centre
    setTimeout(() => {
      envelopeOverlay.classList.add('drop');
      detachLetter();
      centerLetter();
    }, 700);

    // 4. 1.6s: the card turns over
    setTimeout(() => envelopeOverlay.classList.add('flip'), 1600);

    // 5. 2.1s: ...and grows to the viewport while turning; its back is the hero
    setTimeout(() => {
      envelopeOverlay.classList.add('fill');
      setLetterBox(0, 0, window.innerWidth, window.innerHeight);
    }, 2100);

    // 6. 2.85s: overlay fades; the real hero underneath matches the card back
    setTimeout(() => envelopeOverlay.classList.add('opened'), 2850);

    // 7. Remove overlay from DOM flow after the fade
    setTimeout(() => { envelopeOverlay.style.display = 'none'; }, 3500);
  }

  if (btnOpenEnvelope) {
    btnOpenEnvelope.addEventListener('click', openEnvelope);
  }
  if (waxSeal) {
    waxSeal.addEventListener('click', openEnvelope);
  }

  // --- 4. COUNTDOWN TIMER ---
  function initCountdown() {
    if (!countdownClock) return;

    const targetDateStr = countdownClock.getAttribute('data-target-date') || '2027-03-13T12:30:00';
    const targetDate = new Date(targetDateStr).getTime();

    function updateTimer() {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        if (daysEl) daysEl.textContent = '00';
        if (hoursEl) hoursEl.textContent = '00';
        if (minutesEl) minutesEl.textContent = '00';
        if (secondsEl) secondsEl.textContent = '00';
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
      if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
      if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
      if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
    }

    updateTimer();
    setInterval(updateTimer, 1000);
  }

  initCountdown();

  // --- 5. ADD TO CALENDAR (.ICS DYNAMIC GENERATOR) ---
  if (btnAddCalendar) {
    btnAddCalendar.addEventListener('click', function () {
      const icsData = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Boda Maria Angeles y Pablo//Invitacion Digital//ES',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:boda-mariangeles-pablo-20270313@wedding.es',
        'DTSTAMP:20261006T120000Z',
        'DTSTART:20270313T113000Z', // 12:30 Madrid CET (UTC+1, winter time)
        'DTEND:20270313T220000Z',   // 23:00 Madrid
        'SUMMARY:💍 ' + t('ics.summary'),
        'DESCRIPTION:' + t('ics.description'),
        'LOCATION:Parroquia de San José, C. Alcalá, 43, 28014 Madrid',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.href = url;
      tempLink.setAttribute('download', 'Boda-MariAngeles-y-Pablo.ics');
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      window.URL.revokeObjectURL(url);
    });
  }

  // --- 6. CONDITIONAL RSVP FIELDS ---
  const attendanceRadios = document.querySelectorAll('input[name="attendanceStatus"]');
  attendanceRadios.forEach(radio => {
    radio.addEventListener('change', function () {
      if (rsvpAttendanceDetails) {
        if (this.value === 'no_asistire') {
          rsvpAttendanceDetails.style.display = 'none';
        } else {
          rsvpAttendanceDetails.style.display = 'block';
        }
      }
      // the playlist line under the button only makes sense for those who come
      const hint = document.getElementById('rsvp-playlist-hint');
      if (hint) hint.style.display = this.value === 'no_asistire' ? 'none' : '';
    });
  });

  // Bus: "Sí" shows the outward/return choice; a return trip (Vuelta or
  // Ida y vuelta) also asks where to be dropped off.
  const busSelect = document.getElementById('guest-bus');
  const busTypeGroup = document.getElementById('bus-type-group');
  const busTypeSelect = document.getElementById('guest-bus-type');
  const returnStopGroup = document.getElementById('return-stop-group');

  function needsReturnStop() {
    return !!(busSelect && busSelect.value.startsWith('Si') &&
      busTypeSelect && busTypeSelect.value !== 'Ida');
  }

  function updateBusFields() {
    if (busTypeGroup && busSelect) busTypeGroup.style.display = busSelect.value.startsWith('Si') ? 'block' : 'none';
    if (returnStopGroup) returnStopGroup.style.display = needsReturnStop() ? 'block' : 'none';
  }

  if (busSelect) busSelect.addEventListener('change', updateBusFields);
  if (busTypeSelect) busTypeSelect.addEventListener('change', updateBusFields);

  // --- 7. RSVP FORM SUBMISSION & WHATSAPP CONTACT LINK ---
  function readValue(id, fallback) {
    const el = document.getElementById(id);
    const v = el ? el.value.trim() : '';
    return v || fallback;
  }

  // Id of the reply being filled in. It survives a failed send, so pressing
  // Confirmar again after an error overwrites the same row in the Sheet instead
  // of adding a duplicate (Google sometimes reports an error although it saved).
  // A successful send clears it: the next person gets a new Id.
  let replyId = null;
  function currentReplyId() {
    if (!replyId) {
      replyId = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
    }
    return replyId;
  }

  function getRsvpFormData() {
    const guestName = readValue('guest-name', '');
    const phone = readValue('guest-phone', '');

    const statusEl = document.querySelector('input[name="attendanceStatus"]:checked');
    const status = statusEl ? statusEl.value : 'asistire';

    const attending = status === 'asistire';
    const bus = attending ? readValue('guest-bus', 'No, voy por mi cuenta') : '';
    const busType = attending && bus.startsWith('Si') ? readValue('guest-bus-type', 'Ida y vuelta') : '';

    const returnStopEl = document.querySelector('input[name="returnStop"]:checked');
    const returnStop = attending && needsReturnStop() && returnStopEl ? returnStopEl.value : '';

    const diet = attending ? readValue('guest-diet', 'Ninguna') : '';
    const menu = attending ? readValue('guest-menu', 'Ninguno') : '';

    return {
      guestName,
      phone,
      status,
      bus,
      busType,
      returnStop,
      diet,
      menu,
      message: readValue('guest-message', ''),
      replyId: currentReplyId(),
      website: readValue('guest-website', '')
    };
  }

  // WhatsApp is only for questions: one link per person in whatsappContacts
  // (js/rsvp-config.js) opens a chat with no prefilled text. The block stays
  // hidden while the list is empty.
  const WHATSAPP_LOGO = '<svg class="wa-logo" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';

  // "34626841981" -> "626 84 19 81" (Spanish grouping; other lengths are left as typed).
  function formatPhone(number) {
    const digits = String(number).replace(/\D/g, '');
    const local = digits.length === 11 && digits.startsWith('34') ? digits.slice(2) : digits;
    if (local.length !== 9) return local;
    return `${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
  }

  if (rsvpContact && rsvpContactList) {
    const contacts = ((window.RSVP_CONFIG && window.RSVP_CONFIG.whatsappContacts) || [])
      .filter(c => c && c.number);
    if (contacts.length) {
      rsvpContactList.innerHTML = contacts.map(c => {
        const number = String(c.number).replace(/\D/g, '');
        return `<li><a class="rsvp-contact-link" href="https://wa.me/${number}" target="_blank" rel="noopener">${WHATSAPP_LOGO}<span class="rsvp-contact-name">${escapeHtml(c.name || '')}</span><span class="rsvp-contact-number">${formatPhone(number)}</span></a></li>`;
      }).join('');
      rsvpContact.style.display = '';
    }
  }

  // Replies are POSTed as JSON to a Google Apps Script web app that appends a
  // row to the couple's Google Sheet (docs/rsvp.md). The body is sent as plain
  // text so the browser skips the CORS preflight, which Apps Script cannot answer.
  // One reply per person: after a successful save the form is cleared so the
  // next person (often on the same phone) can send theirs.
  const SEND_TIMEOUT_MS = 60000;   // worst save measured: 41 s (docs/rsvp-latency.md)
  const SLOW_HINT_MS = 8000;       // swap the pending text so the card never looks frozen

  // A card over the whole page (#rsvp-modal), so the guest sees it wherever
  // they are scrolled. kind: 'pending' | 'success' | 'error'. While pending it
  // cannot be closed; afterwards the "Cerrar" button, Esc or a tap outside
  // the card closes it.
  const modalTitle = document.getElementById('rsvp-modal-title');
  const modalText = document.getElementById('rsvp-modal-text');
  const modalClose = document.getElementById('rsvp-modal-close');
  let modalKind = null;
  let modalOnClose = null;

  function showRsvpStatus(kind, title, html, onClose) {
    if (!rsvpModal) return;
    modalKind = kind;
    modalOnClose = onClose || null;
    rsvpModal.className = 'rsvp-modal ' + kind;
    if (modalTitle) modalTitle.textContent = title;
    if (modalText) modalText.innerHTML = html;
    if (modalClose) modalClose.hidden = kind === 'pending';
    if (rsvpModal.hidden) {
      rsvpModal.hidden = false;
      document.documentElement.classList.add('rsvp-modal-open');
      // next frame, so the fade-in transition runs after display changes
      requestAnimationFrame(() => rsvpModal.classList.add('is-shown'));
    } else {
      rsvpModal.classList.add('is-shown');
    }
    if (kind !== 'pending' && modalClose) modalClose.focus({ preventScroll: true });
  }

  function hideRsvpStatus() {
    if (!rsvpModal || rsvpModal.hidden || modalKind === 'pending') return;
    rsvpModal.classList.remove('is-shown');
    document.documentElement.classList.remove('rsvp-modal-open');
    setTimeout(() => { rsvpModal.hidden = true; }, 250);
    const done = modalOnClose;
    modalKind = null;
    modalOnClose = null;
    if (done) done();
  }

  if (rsvpModal) {
    if (modalClose) modalClose.addEventListener('click', hideRsvpStatus);
    rsvpModal.addEventListener('click', e => {
      if (e.target === rsvpModal) hideRsvpStatus();   // tap on the dimmed backdrop
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') hideRsvpStatus();
    });
  }

  function sendRsvp(data) {
    const endpoint = (window.RSVP_CONFIG && window.RSVP_CONFIG.endpoint) || '';
    if (!endpoint) {
      return Promise.reject(new Error('rsvp endpoint not configured'));
    }
    const controller = window.AbortController ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), SEND_TIMEOUT_MS) : null;
    return fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      signal: controller ? controller.signal : undefined
    }).then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(json => {
      if (!json || json.ok !== true) throw new Error((json && json.error) || 'bad response');
      return json;
    }).finally(() => clearTimeout(timer));
  }

  // Back to a blank form: reset() restores the defaults in the HTML, but the
  // fields shown or hidden by section 6 have to be put back by hand.
  function resetRsvpForm() {
    rsvpForm.reset();
    if (rsvpAttendanceDetails) rsvpAttendanceDetails.style.display = 'block';
    const hint = document.getElementById('rsvp-playlist-hint');
    if (hint) hint.style.display = '';
    updateBusFields();
  }

  if (rsvpForm) {
    const submitButton = document.getElementById('btn-submit-direct');
    let sending = false;

    rsvpForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      const data = getRsvpFormData();

      if (!data.guestName) {
        alert(t('rsvp.alertName'));
        const nameInput = document.getElementById('guest-name');
        nameInput && nameInput.focus();
        return;
      }

      if (data.status === 'asistire' && needsReturnStop() && !data.returnStop) {
        alert(t('rsvp.alertReturnStop'));
        if (returnStopGroup) returnStopGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      sending = true;
      if (submitButton) submitButton.disabled = true;
      const spinner = '<i class="fa-solid fa-spinner fa-spin"></i> ';
      showRsvpStatus('pending', t('rsvp.titleSending'), spinner + t('rsvp.sending'));
      const slowHint = setTimeout(() => {
        if (modalText) modalText.innerHTML = spinner + t('rsvp.stillSending');
      }, SLOW_HINT_MS);

      sendRsvp(data).then(() => {
        clearTimeout(slowHint);
        const thanks = t(data.status === 'asistire' ? 'rsvp.thanksYes' : 'rsvp.thanksNo');
        resetRsvpForm();
        replyId = null;
        sending = false;
        if (submitButton) submitButton.disabled = false;
        // after closing, bring the (now empty) form into view for the next person
        showRsvpStatus('success', t('rsvp.titleDone'),
          '<p>' + t('rsvp.thanks', { name: escapeHtml(data.guestName) }) + ' ' + thanks + '</p>' +
          '<p class="rsvp-modal-note">' + t('rsvp.another') + '</p>',
          () => rsvpForm.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }).catch(err => {
        clearTimeout(slowHint);
        console.warn('RSVP not saved:', err);
        sending = false;
        if (submitButton) submitButton.disabled = false;
        showRsvpStatus('error', t('rsvp.titleError'), '<p>' + t('rsvp.error') + '</p>');
      });
    });
  }

  function escapeHtml(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // --- 8. 1-CLICK CLIPBOARD COPY (IBAN & HASHTAG) ---
  function copyToClipboard(text, successCallback) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(successCallback).catch(() => fallbackCopy(text, successCallback));
    } else {
      fallbackCopy(text, successCallback);
    }
  }

  function fallbackCopy(text, successCallback) {
    const tempInput = document.createElement('textarea');
    tempInput.value = text;
    tempInput.style.position = 'fixed';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);
    tempInput.focus();
    tempInput.select();
    try {
      document.execCommand('copy');
      successCallback();
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(tempInput);
  }

  if (btnCopyIban && ibanValue) {
    // the whole number is the button; only the line under it changes, so the number stays put
    let copyTimer = 0;
    btnCopyIban.addEventListener('click', function () {
      const iban = ibanValue.textContent.trim();
      copyToClipboard(iban, function () {
        const label = document.getElementById('copy-text');
        btnCopyIban.classList.add('copied');
        if (label) label.textContent = t('copy.done');
        clearTimeout(copyTimer);
        copyTimer = setTimeout(function () {
          btnCopyIban.classList.remove('copied');
          if (label) label.innerHTML = t('gifts.copy');
        }, 2500);
      });
    });
  }

  // --- 8b. GIFT: the plane flies to the postmark and the boarding pass appears ---
  // The plane is a button laid over the route SVG (viewBox 320 x 120). A tap flies the whole
  // route; it can also be dragged, and wherever it is let go it finishes the trip by itself.
  // Without this block the boarding pass is simply visible (.is-ready is what hides it).
  const vuelo = document.getElementById('vuelo');
  const vueloRuta = document.getElementById('vuelo-ruta');
  const vueloPath = document.getElementById('vuelo-path');
  const vueloAvion = document.getElementById('vuelo-avion');
  if (vuelo && vueloRuta && vueloPath && vueloAvion && vueloPath.getTotalLength) {
    const vueloMask = document.getElementById('vuelo-mask');
    const vueloSaltar = document.getElementById('vuelo-saltar');
    const embarque = document.getElementById('embarque');
    const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const total = vueloPath.getTotalLength();
    const START = 0.15;   // a little after the dot of Madrid, so the dot and its name show
    let progress = START;
    let landed = false;
    let flight = 0;

    const place = function (p) {
      progress = Math.max(0, Math.min(1, p));
      const at = vueloPath.getPointAtLength(total * progress);
      const a = vueloPath.getPointAtLength(Math.max(0, total * progress - 1));
      const b = vueloPath.getPointAtLength(Math.min(total, total * progress + 1));
      const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      vueloAvion.style.left = (at.x / 320 * 100) + '%';
      vueloAvion.style.top = (at.y / 120 * 100) + '%';
      vueloAvion.style.transform = 'translate(-50%, -50%) rotate(' + angle.toFixed(1) + 'deg)';
      if (vueloMask) {
        vueloMask.setAttribute('stroke-dasharray', total);
        vueloMask.setAttribute('stroke-dashoffset', total * (1 - progress));
      }
    };

    const land = function () {
      if (landed) return;
      landed = true;
      cancelAnimationFrame(flight);
      place(1);
      vuelo.classList.remove('is-flying');
      vuelo.classList.add('is-landed');
      vueloAvion.setAttribute('aria-expanded', 'true');
      vueloAvion.disabled = true;
      if (embarque && embarque.scrollIntoView) {
        setTimeout(function () {
          const r = embarque.getBoundingClientRect();
          if (r.bottom > window.innerHeight) embarque.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'end' });
        }, calm ? 0 : 450);
      }
    };

    const fly = function () {
      if (landed) return;
      if (calm) { land(); return; }
      cancelAnimationFrame(flight);
      vuelo.classList.add('is-flying');
      const from = progress;
      const duration = 600 + 1700 * (1 - from);
      let start = 0;
      const step = function (now) {
        if (!start) start = now;
        const k = Math.min(1, (now - start) / duration);
        const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        place(from + (1 - from) * eased);
        if (k < 1) flight = requestAnimationFrame(step); else land();
      };
      flight = requestAnimationFrame(step);
    };

    // dragging: the finger's horizontal place on the route decides how far the plane is
    let drag = null;
    const xToProgress = function (clientX) {
      const box = vueloRuta.getBoundingClientRect();
      const x = (clientX - box.left) / box.width * 320;
      let lo = 0, hi = 1;
      for (let i = 0; i < 18; i += 1) {   // the route only moves right, so a bisection finds it
        const mid = (lo + hi) / 2;
        if (vueloPath.getPointAtLength(total * mid).x < x) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    };
    vueloAvion.addEventListener('pointerdown', function (e) {
      if (landed || (e.button != null && e.button > 0)) return;
      cancelAnimationFrame(flight);
      drag = { id: e.pointerId, x: e.clientX, moved: false };
      if (vueloAvion.setPointerCapture) { try { vueloAvion.setPointerCapture(e.pointerId); } catch (err) { /* the tap still works */ } }
    });
    vueloAvion.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id || landed) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x) < 6) return;
      drag.moved = true;
      vuelo.classList.add('is-flying');
      place(Math.max(progress, xToProgress(e.clientX)));   // only forwards
      if (progress > 0.985) { drag = null; land(); }
    });
    const release = function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      fly();
    };
    vueloAvion.addEventListener('pointerup', release);
    vueloAvion.addEventListener('pointercancel', release);
    // the keyboard (and any browser without pointer events) gets a plain click
    vueloAvion.addEventListener('click', function () { if (!drag) fly(); });
    if (vueloSaltar) vueloSaltar.addEventListener('click', land);

    place(START);
    vuelo.classList.add('is-ready');
  }

  // Photos: without an album link in the HTML the section hides
  if (socialSection && albumLink && !/^https:\/\//.test(albumLink.getAttribute('href') || '')) {
    socialSection.hidden = true;
  }

  // --- 9. PLAYLIST: see js/playlist.js ---

  // --- 10. BACK TO TOP (appears once the footer is in view) ---
  const btnTop = document.getElementById('btn-top');
  const footerEl = document.querySelector('footer');
  if (btnTop && footerEl && 'IntersectionObserver' in window) {
    const footerWatcher = new IntersectionObserver(function (entries) {
      btnTop.classList.toggle('is-visible', entries.some(e => e.isIntersecting));
    }, { threshold: 0.15 });
    footerWatcher.observe(footerEl);
    btnTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // --- 10b. SCROLL REVEAL: the content of each section fades up the first time it comes into view ---
  // The script picks the pieces itself (so sections added later, or with the editor, get the effect
  // too): the content block of each section, or, where a section has pieces of its own
  // (.reveal in the HTML, the stops of the Hoja de ruta), each piece and the heading.
  // css/styles.css only hides them once .js-reveal is on <html>, so nothing is hidden without
  // JavaScript, and guests who asked their device for less motion see everything at once.
  const revealRoot = document.getElementById('main-content');
  const lessMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (revealRoot && 'IntersectionObserver' in window && !lessMotion) {
    const revealEls = [];
    revealRoot.querySelectorAll('section:not(#hero)').forEach(function (sec) {
      const pieces = sec.querySelectorAll('.reveal, .ruta-stop');
      if (pieces.length) {
        pieces.forEach(function (el) { revealEls.push(el); });
        sec.querySelectorAll('.h-script').forEach(function (h) {
          if (!h.closest('.reveal, .ruta-stop')) revealEls.push(h);
        });
      } else {
        const block = sec.querySelector('.container');
        if (block) revealEls.push(block);
      }
    });
    if (revealEls.length) {
      revealEls.forEach(function (el) { el.classList.add('reveal'); });
      document.documentElement.classList.add('js-reveal');
      const revealWatcher = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          revealWatcher.unobserve(e.target);    // once: it never hides again
        });
      }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
      revealEls.forEach(function (el) { revealWatcher.observe(el); });
    }
  }

  // --- 10d. TORN EDGES: where two neighbouring sections differ in colour ---
  // The lower section of each pair gets .has-edge and --edge-bg (the colour of the one above),
  // and css/styles.css draws the torn border with them. The colours are read from the page, so
  // sections the site editor recolours, adds, hides or moves are followed too.
  const edgeHost = document.getElementById('main-content');
  if (edgeHost) {
    const solid = function (el) {
      const c = getComputedStyle(el).backgroundColor;
      return !c || c === 'transparent' || /,\s*0\)$/.test(c) ? '' : c;
    };
    const markEdges = function () {
      const pageBg = solid(document.body) || solid(document.documentElement);
      // a pale green band cannot carry the light text the editor gives to green sections:
      // those sections get .is-light-band, which turns that text dark (css/styles.css)
      const probe = document.createElement('i');
      probe.style.cssText = 'position:absolute;visibility:hidden;background:var(--olive)';
      document.body.appendChild(probe);
      const green = getComputedStyle(probe).backgroundColor;
      document.body.removeChild(probe);
      const rgb = (green.match(/[\d.]+/g) || []).map(Number);
      const paleGreen = rgb.length >= 3 && (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 > 0.8;
      let prev = '';
      let prevEl = null;
      let n = 0;
      // in the order they are seen: the editor moves sections with the CSS `order` property
      const seen = Array.prototype.map.call(edgeHost.children, function (el, i) {
        return { el: el, i: i, order: parseInt(getComputedStyle(el).order, 10) || 0 };
      }).sort(function (a, b) { return a.order - b.order || a.i - b.i; });
      seen.forEach(function (item) {
        const el = item.el;
        if (!/^(SECTION|FOOTER)$/.test(el.tagName) || !el.offsetHeight) return;
        const bg = solid(el) || pageBg;
        const lightBand = paleGreen && solid(el) === green;
        if (el.classList.contains('is-light-band') !== lightBand) el.classList.toggle('is-light-band', lightBand);
        const torn = !!prev && bg !== prev;
        if (el.classList.contains('has-edge') !== torn) el.classList.toggle('has-edge', torn);
        if (torn) { if (el.style.getPropertyValue('--edge-bg') !== prev) el.style.setProperty('--edge-bg', prev); }
        else if (el.style.getPropertyValue('--edge-bg')) el.style.removeProperty('--edge-bg');
        // who is above, for the sections that tear their own bottom edge (a picture as background)
        const from = torn && prevEl && prevEl.id ? prevEl.id : '';
        if ((el.getAttribute('data-edge-from') || '') !== from) {
          if (from) el.setAttribute('data-edge-from', from); else el.removeAttribute('data-edge-from');
        }
        if (prevEl && prevEl.classList.contains('is-torn-below') !== torn) prevEl.classList.toggle('is-torn-below', torn);
        // each one over the next: sections with the same z-index paint in the order they are seen
        if (prevEl && torn) {
          const z = String(seen.length + 1 - n);
          if (prevEl.style.getPropertyValue('--edge-z') !== z) prevEl.style.setProperty('--edge-z', z);
        }
        n += 1;
        prev = bg;
        prevEl = el;
      });
      if (prevEl && prevEl.classList.contains('is-torn-below')) prevEl.classList.remove('is-torn-below');
    };
    let edgeFrame = 0;
    const edgesSoon = function () {
      if (edgeFrame) return;
      edgeFrame = requestAnimationFrame(function () { edgeFrame = 0; markEdges(); });
    };
    markEdges();
    window.addEventListener('load', markEdges);
    if (window.MutationObserver) {
      // the editor writes colours as a <style> in the head or as tokens on <html>, and moves sections
      const mo = new MutationObserver(edgesSoon);
      mo.observe(document.head, { childList: true, subtree: true, characterData: true });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
      mo.observe(edgeHost, { childList: true, attributes: true, attributeFilter: ['class', 'hidden'] , subtree: false });
    }
  }

  // --- 10c. OUR STORY: the three prints turn over ---
  // Each .hfoto-card has the photo on the front and its text on the back. A tap moves the card to
  // a fixed layer over the page (so no section can clip it or paint over it), where it flies to
  // the middle of the screen, grows and turns over. There, each tap on the card turns it again
  // (text, photo, text…); a tap outside, Esc or scrolling away sends it back to its slot. Until the guest opens one, the prints take turns to swing
  // round and show their back for a moment, as the hint that there is something behind.
  const album = document.getElementById('historia-album');
  const albumCards = album ? Array.prototype.slice.call(album.querySelectorAll('.hfoto-card')) : [];
  if (album && albumCards.length) {
    const FLIGHT_MS = lessMotion ? 0 : 850;
    let stage = null, stageHint = null, openTurn = 0, openCard = null, openSlot = null, openScrollY = 0, busy = false;
    let everOpened = false, peekTimer = null, peekTurn = 0, albumInView = false;

    // where the card sits in its slot, written as a transform of the card on the stage
    // `turn` is the angle the card has already turned on the stage, so it never unwinds
    const slotTransform = function (slot, w, turn) {
      const r = slot.getBoundingClientRect();
      const dx = r.left + r.width / 2 - window.innerWidth / 2;
      const dy = r.top + r.height / 2 - window.innerHeight / 2;
      const tilt = getComputedStyle(slot).getPropertyValue('--tilt').trim() || '0deg';
      return 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px) scale(' + (r.width / w).toFixed(4) +
        ') rotateY(' + turn + 'deg) rotate(' + tilt + ')';
    };

    const stopPeeks = function () {
      clearTimeout(peekTimer);
      peekTimer = null;
      albumCards.forEach(function (c) { c.classList.remove('is-peeking'); });
    };

    const peekNext = function () {
      peekTimer = null;
      if (everOpened || !albumInView || openCard) return;
      const c = albumCards[peekTurn % albumCards.length];
      peekTurn += 1;
      c.classList.remove('is-peeking');
      void c.offsetWidth;                 // restart the animation
      c.classList.add('is-peeking');
      // the first round goes one after the other; after that, one every few seconds
      peekTimer = setTimeout(peekNext, peekTurn < albumCards.length ? 450 : 4200);
    };

    const closeAlbumCard = function () {
      if (!openCard || busy) return;
      busy = true;
      const card = openCard, slot = openSlot;
      // back to the photo side by the shortest way: the nearest full turn
      card.style.transform = slotTransform(slot, card.offsetWidth, Math.round(openTurn / 360) * 360);
      stage.classList.remove('is-on');
      card.setAttribute('aria-expanded', 'false');
      setTimeout(function () {
        const hadFocus = document.activeElement === card;
        card.style.transition = 'none';
        ['left', 'top', 'width', 'transform'].forEach(function (k) { card.style[k] = ''; });
        slot.appendChild(card);
        void card.offsetWidth;
        card.style.transition = '';
        if (hadFocus) card.focus({ preventScroll: true });
        openCard = openSlot = null;
        busy = false;
      }, FLIGHT_MS);
    };

    const openAlbumCard = function (card) {
      if (openCard || busy) return;
      const slot = card.parentNode;
      if (!slot || !slot.classList.contains('hfoto')) return;
      everOpened = true;
      stopPeeks();
      if (!stage) {
        stage = document.createElement('div');
        stage.className = 'hfoto-stage';
        document.body.appendChild(stage);
        stageHint = document.createElement('p');
        stageHint.className = 'hfoto-stage-hint';
        stage.appendChild(stageHint);
        stage.addEventListener('click', closeAlbumCard);
      }
      busy = true;
      const r = slot.getBoundingClientRect();
      const ratio = r.height / r.width;
      const w = Math.min(window.innerWidth * 0.84, 400, window.innerHeight * 0.8 / ratio);
      const h = w * ratio;
      card.style.transition = 'none';
      card.style.left = ((window.innerWidth - w) / 2).toFixed(1) + 'px';
      card.style.top = ((window.innerHeight - h) / 2).toFixed(1) + 'px';
      card.style.width = w.toFixed(1) + 'px';
      card.style.transform = slotTransform(slot, w, 0);
      stageHint.textContent = t('story.stageHint');
      stage.insertBefore(card, stageHint);
      void card.offsetWidth;
      card.style.transition = '';
      openTurn = 180;
      card.style.transform = 'translate(0px, 0px) scale(1) rotateY(180deg) rotate(0deg)';
      stage.classList.add('is-on');
      card.setAttribute('aria-expanded', 'true');
      card.focus({ preventScroll: true });
      openCard = card;
      openSlot = slot;
      openScrollY = window.scrollY;
      setTimeout(function () { busy = false; }, FLIGHT_MS);
    };

    // on the stage: half a turn more, always the same way round
    const turnAlbumCard = function () {
      if (!openCard || busy) return;
      openTurn += 180;
      openCard.style.transform = 'translate(0px, 0px) scale(1) rotateY(' + openTurn + 'deg) rotate(0deg)';
    };

    albumCards.forEach(function (card) {
      card.addEventListener('click', function (e) {
        e.stopPropagation();                                         // on the stage, only a tap outside the card closes it
        if (card.querySelector('[contenteditable="true"]')) return;   // a text being edited in the site editor: the card stays as it is
        if (openCard === card) turnAlbumCard(); else openAlbumCard(card);
      });
      card.addEventListener('keydown', function (e) {
        if (e.target !== card || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        if (openCard === card) turnAlbumCard(); else openAlbumCard(card);
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAlbumCard();
    });
    window.addEventListener('scroll', function () {
      if (openCard && Math.abs(window.scrollY - openScrollY) > 70) closeAlbumCard();
    }, { passive: true });
    window.addEventListener('resize', closeAlbumCard);

    if ('IntersectionObserver' in window && !lessMotion) {
      new IntersectionObserver(function (entries) {
        albumInView = entries[0].isIntersecting;
        if (albumInView && !everOpened && !peekTimer) peekTimer = setTimeout(peekNext, 350);
        if (!albumInView) stopPeeks();
      }, { threshold: 0, rootMargin: '0px 0px -22% 0px' }).observe(album);   // as soon as the top of the prints is well in view
    }
  }

  // --- 11. HERO VEIL ---
  // The hero stage is sticky inside a section two screens tall. Over the first
  // 80% of that extra scroll the veil (names, date, gold wavy line) slides up
  // off the photo; then the photo holds a moment and the page moves on.
  const heroSection = document.getElementById('hero');
  const heroVeil = document.getElementById('hero-veil');
  if (heroSection && heroVeil) {
    let veilQueued = false;
    const placeVeil = function () {
      veilQueued = false;
      const travel = heroSection.offsetHeight - window.innerHeight;
      const p = travel > 0
        ? Math.min(1, Math.max(0, (window.scrollY - heroSection.offsetTop) / (travel * 0.8)))
        : 0;
      heroVeil.style.setProperty('--veil-p', p.toFixed(3));   // lets the CSS fade the scroll hint
      heroVeil.style.transform = 'translate3d(0, ' + (-p * (heroVeil.offsetHeight + 6)).toFixed(1) + 'px, 0)';
    };
    const queueVeil = function () {
      if (!veilQueued) { veilQueued = true; requestAnimationFrame(placeVeil); }
    };
    window.addEventListener('scroll', queueVeil, { passive: true });
    window.addEventListener('resize', queueVeil);
    placeVeil();
  }

})();
