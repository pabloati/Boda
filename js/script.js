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
  const rsvpStatusMessage = document.getElementById('rsvp-status-message');
  const rsvpAttendanceDetails = document.getElementById('rsvp-attendance-details');
  const btnCopyIban = document.getElementById('btn-copy-iban');
  const ibanValue = document.getElementById('iban-value');
  const copyText = document.getElementById('copy-text');
  const btnCopyHashtag = document.getElementById('btn-copy-hashtag');
  const weddingHashtag = document.getElementById('wedding-hashtag');

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
    });
  });

  const busSelect = document.getElementById('guest-bus');
  const busTypeGroup = document.getElementById('bus-type-group');
  if (busSelect && busTypeGroup) {
    busSelect.addEventListener('change', function () {
      busTypeGroup.style.display = this.value.startsWith('Si') ? 'block' : 'none';
    });
  }

  // --- 7. RSVP FORM SUBMISSION & WHATSAPP CONTACT LINK ---
  function readValue(id, fallback) {
    const el = document.getElementById(id);
    const v = el ? el.value.trim() : '';
    return v || fallback;
  }

  function getRsvpFormData() {
    const guestName = readValue('guest-name', '');
    const phone = readValue('guest-phone', '');

    const statusEl = document.querySelector('input[name="attendanceStatus"]:checked');
    const status = statusEl ? statusEl.value : 'asistire';

    const companionsRaw = readValue('guest-companions', '');
    const companions = companionsRaw
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const attending = status === 'asistire';
    const bus = attending ? readValue('guest-bus', 'No, voy por mi cuenta') : '';
    const busType = attending && bus.startsWith('Si') ? readValue('guest-bus-type', 'Ida y vuelta') : '';

    const diet = attending ? readValue('guest-diet', 'Ninguna') : '';
    const menu = attending ? readValue('guest-menu', 'Ninguno') : '';

    return {
      guestName,
      phone,
      status,
      companions: attending ? companions : [],
      bus,
      busType,
      diet,
      menu,
      message: readValue('guest-message', ''),
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
  function showRsvpStatus(kind, html) {
    if (!rsvpStatusMessage) return;
    rsvpStatusMessage.style.display = 'block';
    rsvpStatusMessage.className = 'rsvp-status-message ' + kind;
    rsvpStatusMessage.innerHTML = html;
  }

  function sendRsvp(data) {
    const endpoint = (window.RSVP_CONFIG && window.RSVP_CONFIG.endpoint) || '';
    if (!endpoint) {
      return Promise.reject(new Error('rsvp endpoint not configured'));
    }
    return fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    }).then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(json => {
      if (!json || json.ok !== true) throw new Error((json && json.error) || 'bad response');
      return json;
    });
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

      sending = true;
      if (submitButton) submitButton.disabled = true;
      showRsvpStatus('pending', '<i class="fa-solid fa-spinner fa-spin"></i> ' + t('rsvp.sending'));

      sendRsvp(data).then(() => {
        const thanks = t(data.status === 'asistire' ? 'rsvp.thanksYes' : 'rsvp.thanksNo');
        showRsvpStatus('success', '<i class="fa-solid fa-circle-check"></i> ' + t('rsvp.thanks', { name: escapeHtml(data.guestName) }) + ' ' + thanks);
      }).catch(err => {
        console.warn('RSVP not saved:', err);
        showRsvpStatus('error', t('rsvp.error'));
        sending = false;
        if (submitButton) submitButton.disabled = false;
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
    btnCopyIban.addEventListener('click', function () {
      const iban = ibanValue.textContent.trim();
      copyToClipboard(iban, function () {
        btnCopyIban.classList.add('copied');
        btnCopyIban.innerHTML = '<i class="fa-solid fa-check"></i> ' + t('copy.done');

        setTimeout(() => {
          btnCopyIban.classList.remove('copied');
          btnCopyIban.innerHTML = '<span id="copy-text" data-i18n="gifts.copy">' + t('gifts.copy') + '</span>';
        }, 2500);
      });
    });
  }

  if (btnCopyHashtag && weddingHashtag) {
    btnCopyHashtag.addEventListener('click', function () {
      const tag = weddingHashtag.textContent.trim();
      copyToClipboard(tag, function () {
        const originalContent = btnCopyHashtag.innerHTML;
        btnCopyHashtag.innerHTML = '<i class="fa-solid fa-check"></i> ' + t('copy.done');
        setTimeout(() => {
          btnCopyHashtag.innerHTML = originalContent;
        }, 2000);
      });
    });
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

})();
