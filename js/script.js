/**
 * WEDDING INVITATION INTERACTIVITY ENGINE
 * Mª Ángeles & Pablo - 13 de marzo de 2027
 */

(function () {
  'use strict';

  // --- 1. DOM REFERENCES ---
  const envelopeOverlay = document.getElementById('envelope-overlay');
  const btnOpenEnvelope = document.getElementById('btn-open-envelope');
  const waxSeal = document.getElementById('wax-seal');
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
  const btnSubmitWhatsapp = document.getElementById('btn-submit-whatsapp');
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
  function openEnvelope() {
    // 1. Play background music on user gesture
    playMusic();

    // 2. Open flap 3D animation
    if (envelopeOverlay) {
      envelopeOverlay.classList.add('opened-flap');

      // 3. After letter slides out and flap opens, fade out overlay
      setTimeout(() => {
        envelopeOverlay.classList.add('opened');
      }, 1700);

      // 4. Remove overlay from DOM flow after transition
      setTimeout(() => {
        envelopeOverlay.style.display = 'none';
      }, 2600);
    }
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
        'SUMMARY:💍 Boda de Mª Ángeles & Pablo',
        'DESCRIPTION:Ceremonia en la Parroquia de San José (C. Alcalá 43) a las 12:30 y convite en el Complejo La Cigüeña (Arganda del Rey) a las 14:30.',
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

  // --- 7. RSVP FORM SUBMISSION & WHATSAPP GENERATOR ---
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
      website: readValue('guest-website', '')
    };
  }

  if (btnSubmitWhatsapp) {
    btnSubmitWhatsapp.addEventListener('click', function () {
      const data = getRsvpFormData();

      if (!data.guestName) {
        alert('Por favor indica tu nombre y apellidos antes de enviar la confirmación.');
        const nameInput = document.getElementById('guest-name');
        nameInput && nameInput.focus();
        return;
      }

      let whatsappText = '';
      if (data.status === 'asistire') {
        whatsappText = `¡Hola Mª Ángeles y Pablo! 💍✨\n\nConfirmo mi asistencia a vuestra boda:\n\n` +
          `👤 *Nombre:* ${data.guestName}\n` +
          (data.phone ? `📞 *Teléfono:* ${data.phone}\n` : '') +
          `✅ *Asistencia:* ¡Sí, estaré allí con mucha ilusión!\n` +
          `👥 *Acompañantes:* ${data.companions.length ? data.companions.join(', ') : 'Ninguno'}\n` +
          `🚌 *Autobús:* ${data.bus}${data.busType ? ` (${data.busType.toLowerCase()})` : ''}\n` +
          `🍽️ *Alergias:* ${data.diet}\n` +
          `🥗 *Menú especial:* ${data.menu}\n`;
      } else {
        whatsappText = `¡Hola Mª Ángeles y Pablo! 💍✨\n\n` +
          `👤 *Nombre:* ${data.guestName}\n` +
          (data.phone ? `📞 *Teléfono:* ${data.phone}\n` : '') +
          `❌ *Asistencia:* Lamentablemente no podré acompañaros en esta ocasión, ¡pero os deseo todo lo mejor en este gran día!\n`;
      }

      whatsappText += `\n¡Un abrazo grande!`;

      const waNumber = (window.RSVP_CONFIG && window.RSVP_CONFIG.whatsappNumber) || '';
      const encodedUrl = waNumber
        ? `https://wa.me/${waNumber}?text=${encodeURIComponent(whatsappText)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;
      window.open(encodedUrl, '_blank');
    });
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
        alert('Por favor indica tu nombre y apellidos antes de guardar.');
        const nameInput = document.getElementById('guest-name');
        nameInput && nameInput.focus();
        return;
      }

      sending = true;
      if (submitButton) submitButton.disabled = true;
      showRsvpStatus('pending', '<i class="fa-solid fa-spinner fa-spin"></i> Enviando tu respuesta…');

      sendRsvp(data).then(() => {
        const thanks = data.status === 'asistire'
          ? 'Nos alegra mucho celebrar contigo.'
          : 'Gracias por avisarnos, te echaremos de menos.';
        showRsvpStatus('success', `<i class="fa-solid fa-circle-check"></i> ¡Muchas gracias, <strong>${escapeHtml(data.guestName)}</strong>! Hemos recibido tu respuesta. ${thanks}`);
      }).catch(err => {
        console.warn('RSVP not saved:', err);
        showRsvpStatus('error', 'No hemos podido guardar tu respuesta. Inténtalo de nuevo en un momento o envíanosla por WhatsApp con el enlace de arriba.');
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
        if (copyText) copyText.textContent = '¡Copiado!';
        btnCopyIban.innerHTML = '<i class="fa-solid fa-check"></i> ¡Copiado!';

        setTimeout(() => {
          btnCopyIban.classList.remove('copied');
          btnCopyIban.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar';
        }, 2500);
      });
    });
  }

  if (btnCopyHashtag && weddingHashtag) {
    btnCopyHashtag.addEventListener('click', function () {
      const tag = weddingHashtag.textContent.trim();
      copyToClipboard(tag, function () {
        const originalContent = btnCopyHashtag.innerHTML;
        btnCopyHashtag.innerHTML = '<i class="fa-solid fa-check"></i> ¡Copiado!';
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
