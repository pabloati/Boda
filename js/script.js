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

  // --- 2. AUDIO ENGINE (HTML5 + Web Audio API Ambient Synthesizer Fallback) ---
  let isMusicPlaying = false;
  let audioContext = null;
  let synthInterval = null;
  let usingSynthFallback = false;

  // Gentle romantic chord arpeggio progression (C - G - Am - F) in frequency (Hz)
  const romanticMelody = [
    261.63, 329.63, 392.00, 523.25, // C chord
    196.00, 246.94, 293.66, 392.00, // G chord
    220.00, 261.63, 329.63, 440.00, // Am chord
    174.61, 220.00, 261.63, 349.23  // F chord
  ];
  let noteIndex = 0;

  function initWebAudioSynth() {
    if (audioContext) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioCtx();
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  function playSynthNote(freq) {
    if (!audioContext || audioContext.state === 'suspended') {
      audioContext && audioContext.resume();
    }
    if (!audioContext) return;

    try {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioContext.currentTime);

      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start();
      osc.stop(audioContext.currentTime + 1.3);
    } catch (err) {
      console.error(err);
    }
  }

  function startSynthMelody() {
    initWebAudioSynth();
    usingSynthFallback = true;
    if (synthInterval) clearInterval(synthInterval);
    synthInterval = setInterval(() => {
      if (isMusicPlaying) {
        playSynthNote(romanticMelody[noteIndex]);
        noteIndex = (noteIndex + 1) % romanticMelody.length;
      }
    }, 450);
  }

  function stopSynthMelody() {
    if (synthInterval) {
      clearInterval(synthInterval);
      synthInterval = null;
    }
  }

  function playMusic() {
    isMusicPlaying = true;
    btnMusicToggle.classList.add('active');
    musicIcon.className = 'fa-solid fa-volume-high';

    if (weddingAudio) {
      weddingAudio.play().then(() => {
        usingSynthFallback = false;
      }).catch((err) => {
        console.info('Audio source blocked or unavailable, engaging gentle romantic synth fallback:', err);
        startSynthMelody();
      });
    } else {
      startSynthMelody();
    }
  }

  function pauseMusic() {
    isMusicPlaying = false;
    btnMusicToggle.classList.remove('active');
    musicIcon.className = 'fa-solid fa-volume-xmark';

    if (weddingAudio && !usingSynthFallback) {
      weddingAudio.pause();
    }
    stopSynthMelody();
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
  const busFromGroup = document.getElementById('bus-from-group');
  if (busSelect && busFromGroup) {
    busSelect.addEventListener('change', function () {
      busFromGroup.style.display = this.value.startsWith('Si') ? 'block' : 'none';
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

    const bus = readValue('guest-bus', 'No, voy por mi cuenta');
    const busFrom = bus.startsWith('Si') ? readValue('guest-bus-from', 'sin indicar') : '';

    const diet = readValue('guest-diet', 'Ninguna');
    const menu = readValue('guest-menu', 'Ninguno');

    return {
      guestName,
      phone,
      status,
      companions,
      bus,
      busFrom,
      diet,
      menu
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
          `🚌 *Autobús:* ${data.bus}${data.busFrom ? ` (desde ${data.busFrom})` : ''}\n` +
          `🍽️ *Alergias:* ${data.diet}\n` +
          `🥗 *Menú especial:* ${data.menu}\n`;
      } else {
        whatsappText = `¡Hola Mª Ángeles y Pablo! 💍✨\n\n` +
          `👤 *Nombre:* ${data.guestName}\n` +
          (data.phone ? `📞 *Teléfono:* ${data.phone}\n` : '') +
          `❌ *Asistencia:* Lamentablemente no podré acompañaros en esta ocasión, ¡pero os deseo todo lo mejor en este gran día!\n`;
      }

      whatsappText += `\n¡Un abrazo grande!`;

      const encodedUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`;
      window.open(encodedUrl, '_blank');
    });
  }

  if (rsvpForm) {
    rsvpForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const data = getRsvpFormData();

      if (!data.guestName) {
        alert('Por favor indica tu nombre y apellidos antes de guardar.');
        return;
      }

      if (rsvpStatusMessage) {
        rsvpStatusMessage.style.display = 'block';
        rsvpStatusMessage.className = 'rsvp-status-message success';
        rsvpStatusMessage.innerHTML = `<i class="fa-solid fa-circle-check"></i> ¡Muchas gracias, <strong>${escapeHtml(data.guestName)}</strong>! Tu confirmación ha sido guardada. Nos alegra mucho celebrar contigo.`;
      }

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

})();
