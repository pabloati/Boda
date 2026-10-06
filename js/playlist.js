/* ========================================================
   WEDDING PLAYLIST — search, suggest and vote
   1. Config & helpers
   2. Song normalisation & fuzzy matching
   3. Stores (Supabase / local demo)
   4. iTunes catalogue search
   5. UI: ranking, hearts, search results, manual add, previews
======================================================== */

(function () {
  'use strict';

  // --- 1. CONFIG & HELPERS ---
  const cfg = Object.assign({
    supabaseUrl: '',
    supabaseAnonKey: '',
    votesPerGuest: 5,
    songsPerGuest: 3,
    itunesCountry: 'ES'
  }, window.PLAYLIST_CONFIG || {});

  const VISIBLE_ROWS = 10;
  const POLL_MS = 30000;

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* private mode: keep going */ }
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // Anonymous per-device id. Lets a guest un-vote and enforces the vote budget.
  function getVoterId() {
    let id = storageGet('playlist.voterId');
    if (!id) {
      id = uuid();
      storageSet('playlist.voterId', id);
    }
    return id;
  }

  function httpsOrNull(url) {
    return typeof url === 'string' && /^https:\/\//i.test(url) ? url : null;
  }

  // --- 2. SONG NORMALISATION & FUZZY MATCHING ---
  // "Bohemian Rhapsody (Remastered 2011)" / "bohemian rapsody" / "BOHEMIAN RHAPSODY - Live"
  // all collapse to roughly the same string so duplicates can be detected.
  function normalizeText(str) {
    return String(str || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\(.*?\)|\[.*?\]/g, ' ')
      .replace(/\s[-–—]\s.*$/, ' ')
      .replace(/\b(feat|ft|featuring)\b\.?.*$/, ' ')
      .replace(/&/g, ' y ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/^the\s+/, '')
      .trim();
  }

  function songKey(title, artist) {
    return normalizeText(title) + '|' + normalizeText(artist);
  }

  function trigrams(str) {
    const padded = '  ' + str + ' ';
    const set = new Set();
    for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
    return set;
  }

  // Dice coefficient over character trigrams: 1 = identical, 0 = nothing in common.
  function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const ta = trigrams(a);
    const tb = trigrams(b);
    let shared = 0;
    ta.forEach(function (t) { if (tb.has(t)) shared++; });
    return (2 * shared) / (ta.size + tb.size);
  }

  // How well a search query matches a song already in the list (0..1).
  // Every query word must appear in the song (as a prefix, or with a small typo).
  function queryScore(query, song) {
    const q = normalizeText(query);
    if (q.length < 2) return 0;
    const target = normalizeText(song.title) + ' ' + normalizeText(song.artist);
    const targetWords = target.split(' ');
    const queryWords = q.split(' ').filter(function (w) { return w.length >= 2; });
    if (!queryWords.length) return 0;

    let hits = 0;
    queryWords.forEach(function (w) {
      const found = targetWords.some(function (t) {
        return t.indexOf(w) === 0 || (w.length >= 4 && similarity(w, t) >= 0.5);
      });
      if (found) hits++;
    });
    return Math.max(similarity(q, target), (hits / queryWords.length) * 0.95);
  }

  // Are two songs probably the same one written differently?
  function isLikelySame(a, b) {
    if (songKey(a.title, a.artist) === songKey(b.title, b.artist)) return true;
    const titleSim = similarity(normalizeText(a.title), normalizeText(b.title));
    if (titleSim < 0.75) return false;
    const artistA = normalizeText(a.artist);
    const artistB = normalizeText(b.artist);
    if (!artistA || !artistB) return true;
    return similarity(artistA, artistB) >= 0.6 || artistA.indexOf(artistB) !== -1 || artistB.indexOf(artistA) !== -1;
  }

  function findLikelyDuplicate(candidate, songs) {
    for (let i = 0; i < songs.length; i++) {
      if (isLikelySame(candidate, songs[i])) return songs[i];
    }
    return null;
  }

  // --- 3. STORES ---
  // Both stores expose the same promise-based API:
  //   list() -> [{ id, title, artist, artworkUrl, previewUrl, externalUrl, source, votes, createdAt }]
  //   myVotes() -> [songId]
  //   toggleVote(songId) -> true if now voted, false if vote removed
  //   addSong(song) -> { id, created }   (adding also spends one vote on it)
  // Errors carry a code: 'vote_limit', 'song_limit', 'not_found', 'network'.

  function PlaylistError(code) {
    this.code = code;
    this.message = code;
  }

  function fromRow(row) {
    return {
      id: row.id,
      title: row.title,
      artist: row.artist || '',
      artworkUrl: httpsOrNull(row.artwork_url),
      previewUrl: httpsOrNull(row.preview_url),
      externalUrl: httpsOrNull(row.external_url),
      source: row.source,
      votes: Number(row.votes) || 0,
      createdAt: row.created_at
    };
  }

  function createSupabaseStore(voterId) {
    const base = cfg.supabaseUrl.replace(/\/+$/, '') + '/rest/v1/rpc/';
    const headers = { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' };
    // Legacy anon keys are JWTs and also go in Authorization; new publishable keys only use apikey.
    if (cfg.supabaseAnonKey.indexOf('eyJ') === 0) headers.Authorization = 'Bearer ' + cfg.supabaseAnonKey;

    function rpc(name, body) {
      return fetch(base + name, { method: 'POST', headers: headers, body: JSON.stringify(body || {}) })
        .catch(function () { throw new PlaylistError('network'); })
        .then(function (res) {
          return res.json().catch(function () { return null; }).then(function (data) {
            if (!res.ok) {
              const msg = data && data.message;
              throw new PlaylistError(['vote_limit', 'song_limit', 'not_found'].indexOf(msg) !== -1 ? msg : 'network');
            }
            return data;
          });
        });
    }

    return {
      mode: 'supabase',
      list: function () {
        return rpc('get_ranking').then(function (rows) { return (rows || []).map(fromRow); });
      },
      myVotes: function () {
        return rpc('my_votes', { p_voter: voterId }).then(function (rows) {
          return (rows || []).map(function (r) { return typeof r === 'string' ? r : r.song_id; });
        });
      },
      toggleVote: function (songId) {
        return rpc('toggle_vote', { p_song: songId, p_voter: voterId });
      },
      addSong: function (song) {
        return rpc('add_song', {
          p_norm_key: songKey(song.title, song.artist),
          p_title: song.title,
          p_artist: song.artist,
          p_artwork_url: song.artworkUrl,
          p_preview_url: song.previewUrl,
          p_external_url: song.externalUrl,
          p_source: song.source,
          p_voter: voterId
        });
      }
    };
  }

  // Demo store: same rules as the database, kept in localStorage. Nothing leaves the browser.
  function createDemoStore(voterId) {
    const KEY = 'playlist.demo.v1';

    function seed() {
      const songs = [
        ['Vivir Mi Vida', 'Marc Anthony', 9],
        ['September', 'Earth, Wind & Fire', 7],
        ['Mr. Brightside', 'The Killers', 6],
        ['Despechá', 'ROSALÍA', 5],
        ['Bohemian Rhapsody', 'Queen', 4],
        ['La Bicicleta', 'Carlos Vives & Shakira', 3],
        ["Can't Stop the Feeling!", 'Justin Timberlake', 2],
        ['Thinking Out Loud', 'Ed Sheeran', 2],
        ['Sarà perché ti amo', 'Ricchi e Poveri', 1],
        ['Dancing Queen', 'ABBA', 1],
        ['Mamma Mia', 'ABBA', 1],
        ['Paquito el Chocolatero', 'Gustavo Pascual Falcó', 1]
      ];
      const state = { songs: [], votes: [] };
      songs.forEach(function (s, i) {
        const id = uuid();
        state.songs.push({
          id: id, title: s[0], artist: s[1], norm_key: songKey(s[0], s[1]),
          artwork_url: null, preview_url: null, external_url: null, source: 'manual',
          created_by: 'demo-' + i, created_at: new Date(Date.now() - (songs.length - i) * 3600e3).toISOString()
        });
        for (let v = 0; v < s[2]; v++) state.votes.push({ song_id: id, voter_id: 'demo-' + v });
      });
      return state;
    }

    function load() {
      try {
        const raw = storageGet(KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* corrupted: reseed */ }
      const state = seed();
      save(state);
      return state;
    }

    function save(state) {
      storageSet(KEY, JSON.stringify(state));
    }

    function later(fn) {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          try { resolve(fn()); } catch (err) { reject(err); }
        }, 150);
      });
    }

    function votesUsed(state) {
      return state.votes.filter(function (v) { return v.voter_id === voterId; }).length;
    }

    return {
      mode: 'demo',
      list: function () {
        return later(function () {
          const state = load();
          return state.songs.map(function (s) {
            const row = Object.assign({}, s);
            row.votes = state.votes.filter(function (v) { return v.song_id === s.id; }).length;
            return fromRow(row);
          });
        });
      },
      myVotes: function () {
        return later(function () {
          return load().votes
            .filter(function (v) { return v.voter_id === voterId; })
            .map(function (v) { return v.song_id; });
        });
      },
      toggleVote: function (songId) {
        return later(function () {
          const state = load();
          const idx = state.votes.findIndex(function (v) { return v.song_id === songId && v.voter_id === voterId; });
          if (idx !== -1) {
            state.votes.splice(idx, 1);
            save(state);
            return false;
          }
          if (!state.songs.some(function (s) { return s.id === songId; })) throw new PlaylistError('not_found');
          if (votesUsed(state) >= cfg.votesPerGuest) throw new PlaylistError('vote_limit');
          state.votes.push({ song_id: songId, voter_id: voterId });
          save(state);
          return true;
        });
      },
      addSong: function (song) {
        return later(function () {
          const state = load();
          const key = songKey(song.title, song.artist);
          let existing = state.songs.find(function (s) { return s.norm_key === key; });
          const alreadyVoted = existing && state.votes.some(function (v) { return v.song_id === existing.id && v.voter_id === voterId; });
          if (!alreadyVoted && votesUsed(state) >= cfg.votesPerGuest) throw new PlaylistError('vote_limit');
          let created = false;
          if (!existing) {
            const mine = state.songs.filter(function (s) { return s.created_by === voterId; }).length;
            if (mine >= cfg.songsPerGuest) throw new PlaylistError('song_limit');
            existing = {
              id: uuid(), title: song.title, artist: song.artist, norm_key: key,
              artwork_url: song.artworkUrl, preview_url: song.previewUrl, external_url: song.externalUrl,
              source: song.source, created_by: voterId, created_at: new Date().toISOString()
            };
            state.songs.push(existing);
            created = true;
          }
          if (!alreadyVoted) state.votes.push({ song_id: existing.id, voter_id: voterId });
          save(state);
          return { id: existing.id, created: created };
        });
      }
    };
  }

  function createStore() {
    const voterId = getVoterId();
    return cfg.supabaseUrl && cfg.supabaseAnonKey ? createSupabaseStore(voterId) : createDemoStore(voterId);
  }

  function sortRanking(songs) {
    return songs.slice().sort(function (a, b) {
      return b.votes - a.votes || String(a.createdAt).localeCompare(String(b.createdAt));
    });
  }

  // Shared with playlist-admin.html (export page)
  window.WeddingPlaylist = { createStore: createStore, sortRanking: sortRanking, normalizeText: normalizeText };

  // --- 4. ITUNES CATALOGUE SEARCH (JSONP: works from a static site, no key) ---
  let jsonpSeq = 0;

  function jsonp(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      const cbName = '__playlistItunes' + (++jsonpSeq);
      const script = document.createElement('script');
      const timer = setTimeout(function () { cleanup(); reject(new Error('timeout')); }, timeoutMs);

      function cleanup() {
        clearTimeout(timer);
        window[cbName] = function () {}; // a late response must not throw
        script.remove();
      }

      window[cbName] = function (data) { cleanup(); resolve(data); };
      script.onerror = function () { cleanup(); reject(new Error('network')); };
      script.src = url + '&callback=' + cbName;
      document.head.appendChild(script);
    });
  }

  function searchCatalog(term) {
    const url = 'https://itunes.apple.com/search?media=music&entity=song&limit=12' +
      '&country=' + encodeURIComponent(cfg.itunesCountry) +
      '&term=' + encodeURIComponent(term);
    return jsonp(url, 8000).then(function (data) {
      const seen = new Set();
      return ((data && data.results) || [])
        .filter(function (r) { return r.trackName && r.artistName; })
        .map(function (r) {
          return {
            title: r.trackName,
            artist: r.artistName,
            artworkUrl: httpsOrNull((r.artworkUrl100 || '').replace('100x100bb', '200x200bb')),
            previewUrl: httpsOrNull(r.previewUrl),
            externalUrl: httpsOrNull(r.trackViewUrl),
            source: 'itunes'
          };
        })
        // Album, single and remaster versions of the same song collapse into one result
        .filter(function (s) {
          const key = songKey(s.title, s.artist);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 6);
    });
  }

  // --- 5. UI ---
  const searchInput = document.getElementById('playlist-search-input');
  const resultsEl = document.getElementById('playlist-results');
  const rankingEl = document.getElementById('playlist-ranking');
  const moreBtn = document.getElementById('playlist-more');
  const heartsEl = document.getElementById('playlist-hearts');
  const countEl = document.getElementById('playlist-count');
  const noticeEl = document.getElementById('playlist-notice');
  const manualForm = document.getElementById('playlist-manual');
  const manualTitle = document.getElementById('manual-title');
  const manualArtist = document.getElementById('manual-artist');
  const manualCancel = document.getElementById('manual-cancel');

  if (!searchInput || !resultsEl || !rankingEl) return;

  const store = createStore();
  const state = {
    songs: [],
    mine: new Set(),
    expanded: false,
    busy: false,
    catalog: { term: '', status: 'idle', results: [] },
    previewId: null
  };
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let searchTimer = null;
  let searchSeq = 0;
  let noticeTimer = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function icon(classes) {
    const i = el('i', classes);
    i.setAttribute('aria-hidden', 'true');
    return i;
  }

  function heartsLeft() {
    return Math.max(0, cfg.votesPerGuest - state.mine.size);
  }

  const ERROR_TEXT = {
    vote_limit: 'Ya has usado tus ' + cfg.votesPerGuest + ' corazones. Quita uno de otra canción para votar esta.',
    song_limit: 'Ya has propuesto ' + cfg.songsPerGuest + ' canciones. ¡Ahora toca votar las de los demás!',
    not_found: 'Esa canción ya no está en la lista.',
    network: 'No hemos podido conectar. Inténtalo de nuevo en un momento.'
  };

  // Notices: a short message, optionally with action buttons ([{label, primary, onClick}])
  function showNotice(text, kind, actions) {
    if (!noticeEl) return;
    clearTimeout(noticeTimer);
    noticeEl.replaceChildren();
    noticeEl.className = 'playlist-notice' + (kind ? ' is-' + kind : '');
    noticeEl.appendChild(el('span', 'playlist-notice-text', text));
    if (actions && actions.length) {
      const box = el('div', 'playlist-notice-actions');
      actions.forEach(function (a) {
        const b = el('button', a.primary ? 'btn-primary-burgundy' : 'btn-mini', a.label);
        b.type = 'button';
        b.addEventListener('click', function () { hideNotice(); a.onClick(); });
        box.appendChild(b);
      });
      noticeEl.appendChild(box);
    } else {
      noticeTimer = setTimeout(hideNotice, 5000);
    }
    noticeEl.hidden = false;
  }

  function hideNotice() {
    if (noticeEl) noticeEl.hidden = true;
  }

  function handleError(err) {
    const code = err && err.code ? err.code : 'network';
    showNotice(ERROR_TEXT[code] || ERROR_TEXT.network, 'error');
    if (code !== 'network') refresh();
  }

  // Hearts meter + song count
  function renderMeta() {
    if (heartsEl) {
      heartsEl.replaceChildren();
      const left = heartsLeft();
      const row = el('span', 'playlist-hearts-icons');
      for (let i = 0; i < cfg.votesPerGuest; i++) {
        row.appendChild(icon(i < left ? 'fa-solid fa-heart' : 'fa-regular fa-heart'));
      }
      heartsEl.appendChild(row);
      heartsEl.appendChild(el('span', null, left === 1 ? 'Te queda 1 corazón' : 'Te quedan ' + left + ' corazones'));
    }
    if (countEl) {
      const n = state.songs.length;
      countEl.textContent = n === 1 ? '1 canción' : n + ' canciones';
    }
  }

  function coverNode(song) {
    const hasPreview = !!song.previewUrl;
    const cover = el(hasPreview ? 'button' : 'span', 'pl-cover');
    if (song.artworkUrl) {
      const img = el('img');
      img.src = song.artworkUrl;
      img.alt = '';
      img.loading = 'lazy';
      cover.appendChild(img);
    } else {
      cover.appendChild(icon('fa-solid fa-music pl-cover-fallback'));
    }
    if (hasPreview) {
      const playing = state.previewId === previewKey(song);
      cover.type = 'button';
      cover.classList.add('has-preview');
      cover.classList.toggle('is-playing', playing);
      cover.setAttribute('aria-label', (playing ? 'Parar' : 'Escuchar') + ' un fragmento de ' + song.title);
      cover.appendChild(el('span', 'pl-cover-play')).appendChild(icon(playing ? 'fa-solid fa-pause' : 'fa-solid fa-play'));
      cover.addEventListener('click', function () { togglePreview(song); });
    }
    return cover;
  }

  function voteButton(song) {
    const voted = state.mine.has(song.id);
    const btn = el('button', 'pl-vote' + (voted ? ' is-voted' : ''));
    btn.type = 'button';
    btn.setAttribute('aria-pressed', voted ? 'true' : 'false');
    btn.setAttribute('aria-label', (voted ? 'Quitar tu voto de ' : 'Votar ') + song.title + ' (' + song.votes + ' votos)');
    btn.appendChild(icon(voted ? 'fa-solid fa-heart' : 'fa-regular fa-heart'));
    btn.appendChild(el('span', 'pl-vote-count', String(song.votes)));
    btn.addEventListener('click', function () { vote(song.id, btn); });
    return btn;
  }

  function songInfo(song) {
    const info = el('div', 'pl-info');
    info.appendChild(el('span', 'pl-title', song.title));
    info.appendChild(el('span', 'pl-artist', song.artist));
    return info;
  }

  function renderRanking(highlightId) {
    // FLIP: remember where each row was, so moved rows can slide to their new place
    const before = new Map();
    rankingEl.querySelectorAll('li[data-id]').forEach(function (li) {
      before.set(li.dataset.id, li.getBoundingClientRect().top);
    });

    rankingEl.replaceChildren();
    if (!state.songs.length) {
      const empty = el('li', 'pl-empty', 'Todavía no hay canciones. ¡Estrena tú la playlist!');
      rankingEl.appendChild(empty);
    }

    const visible = state.expanded ? state.songs : state.songs.slice(0, VISIBLE_ROWS);
    visible.forEach(function (song, i) {
      const li = el('li', 'pl-row' + (i < 3 ? ' is-top is-top-' + (i + 1) : ''));
      li.dataset.id = song.id;
      li.appendChild(el('span', 'pl-rank', String(i + 1)));
      li.appendChild(coverNode(song));
      li.appendChild(songInfo(song));
      if (song.externalUrl) {
        const link = el('a', 'pl-link');
        link.href = song.externalUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', 'Abrir ' + song.title + ' en Apple Music');
        link.appendChild(icon('fa-solid fa-arrow-up-right-from-square'));
        li.appendChild(link);
      }
      li.appendChild(voteButton(song));
      if (song.id === highlightId) li.classList.add('is-new');
      rankingEl.appendChild(li);
    });

    if (!reduceMotion && before.size) {
      rankingEl.querySelectorAll('li[data-id]').forEach(function (li) {
        const oldTop = before.get(li.dataset.id);
        if (oldTop == null) return;
        const delta = oldTop - li.getBoundingClientRect().top;
        if (!delta) return;
        li.style.transition = 'none';
        li.style.transform = 'translateY(' + delta + 'px)';
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            li.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            li.style.transform = '';
          });
        });
      });
    }

    if (moreBtn) {
      const hiddenCount = state.songs.length - VISIBLE_ROWS;
      moreBtn.hidden = hiddenCount <= 0;
      moreBtn.textContent = state.expanded ? 'Ver solo el top ' + VISIBLE_ROWS : 'Ver las ' + state.songs.length + ' canciones';
    }

    if (highlightId) {
      const row = rankingEl.querySelector('li[data-id="' + highlightId + '"]');
      if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    renderMeta();
  }

  function refresh(highlightId) {
    return Promise.all([store.list(), store.myVotes()]).then(function (res) {
      state.songs = sortRanking(res[0]);
      state.mine = new Set(res[1]);
      // keep the highlighted song visible even if it ranks below the top 10
      if (highlightId && state.songs.findIndex(function (s) { return s.id === highlightId; }) >= VISIBLE_ROWS) {
        state.expanded = true;
      }
      renderRanking(highlightId);
      if (!resultsEl.hidden) renderResults();
    }).catch(function () {
      if (!state.songs.length) {
        rankingEl.replaceChildren(el('li', 'pl-empty', 'No hemos podido cargar la playlist. Recarga la página en un momento.'));
      }
    });
  }

  function vote(songId, btn) {
    if (state.busy) return;
    if (!state.mine.has(songId) && heartsLeft() === 0) {
      showNotice(ERROR_TEXT.vote_limit, 'error');
      return;
    }
    state.busy = true;
    if (btn) btn.classList.add('is-busy');
    store.toggleVote(songId)
      .then(function (voted) {
        if (voted) showNotice('¡Corazón dado! 💛', 'ok');
        return refresh(voted ? songId : null);
      })
      .catch(handleError)
      .then(function () { state.busy = false; });
  }

  function addSong(song) {
    if (state.busy) return;
    state.busy = true;
    store.addSong(song)
      .then(function (res) {
        closeSearch(true);
        showNotice(res && res.created
          ? '¡Añadida! Ya lleva tu corazón. Compártela para que suba 🎶'
          : 'Esa ya estaba en la lista: le hemos sumado tu corazón 💛', 'ok');
        return refresh(res && res.id);
      })
      .catch(handleError)
      .then(function () { state.busy = false; });
  }

  // Before adding, check whether it is a song already in the list spelled differently
  function confirmAndAdd(song) {
    const dup = findLikelyDuplicate(song, state.songs);
    if (!dup) {
      addSong(song);
      return;
    }
    if (songKey(dup.title, dup.artist) === songKey(song.title, song.artist)) {
      // Same song for sure: just vote for the existing one
      if (state.mine.has(dup.id)) {
        closeSearch(true);
        showNotice('Ya le habías dado tu corazón a «' + dup.title + '».', 'ok');
        refresh(dup.id);
      } else {
        closeSearch(true);
        vote(dup.id);
      }
      return;
    }
    showNotice('¿Te refieres a «' + dup.title + ' – ' + dup.artist + '», que ya está en la lista?', 'ask', [
      { label: 'Sí, votar esa', primary: true, onClick: function () {
        closeSearch(true);
        if (!state.mine.has(dup.id)) vote(dup.id); else refresh(dup.id);
      } },
      { label: 'No, es otra', onClick: function () { addSong(song); } }
    ]);
  }

  // Search dropdown: songs already in the list first, then catalogue results
  function resultRow(song, existing) {
    const row = el('div', 'pl-result');
    row.appendChild(coverNode(existing || song));
    row.appendChild(songInfo(existing || song));
    if (existing) {
      row.appendChild(voteButton(existing));
    } else {
      const add = el('button', 'pl-add');
      add.type = 'button';
      add.setAttribute('aria-label', 'Añadir ' + song.title + ' de ' + song.artist);
      add.appendChild(icon('fa-solid fa-plus'));
      add.appendChild(el('span', null, 'Añadir'));
      add.addEventListener('click', function () { confirmAndAdd(song); });
      row.appendChild(add);
    }
    return row;
  }

  function renderResults() {
    const term = searchInput.value.trim();
    resultsEl.replaceChildren();
    if (term.length < 2) {
      resultsEl.hidden = true;
      return;
    }

    const inList = state.songs
      .map(function (s) { return { song: s, score: queryScore(term, s) }; })
      .filter(function (x) { return x.score >= 0.6; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 4)
      .map(function (x) { return x.song; });

    if (inList.length) {
      resultsEl.appendChild(el('p', 'pl-results-heading', 'Ya en la lista'));
      inList.forEach(function (s) { resultsEl.appendChild(resultRow(s, s)); });
    }

    const cat = state.catalog;
    if (cat.term === term) {
      const shown = new Set(inList.map(function (s) { return s.id; }));
      const fresh = [];
      cat.results.forEach(function (r) {
        const dup = findLikelyDuplicate(r, state.songs);
        if (dup && !shown.has(dup.id)) {
          // catalogue hit for a song already suggested: offer the vote instead
          shown.add(dup.id);
          resultsEl.appendChild(resultRow(dup, dup));
        } else if (!dup) {
          fresh.push(r);
        }
      });
      if (fresh.length) {
        resultsEl.appendChild(el('p', 'pl-results-heading', 'Añadir una nueva'));
        fresh.forEach(function (r) { resultsEl.appendChild(resultRow(r, null)); });
      }
      if (cat.status === 'error') {
        resultsEl.appendChild(el('p', 'pl-results-status', 'No hemos podido buscar en el catálogo de música.'));
      } else if (!fresh.length && !inList.length && !cat.results.length) {
        resultsEl.appendChild(el('p', 'pl-results-status', 'Sin resultados para «' + term + '».'));
      }
    } else {
      const loading = el('p', 'pl-results-status');
      loading.appendChild(icon('fa-solid fa-spinner fa-spin'));
      loading.appendChild(document.createTextNode(' Buscando…'));
      resultsEl.appendChild(loading);
    }

    const manualBtn = el('button', 'pl-results-manual', '¿No la encuentras? Añádela a mano');
    manualBtn.type = 'button';
    manualBtn.addEventListener('click', openManual);
    resultsEl.appendChild(manualBtn);

    resultsEl.hidden = false;
  }

  function runCatalogSearch() {
    const term = searchInput.value.trim();
    if (term.length < 2) return;
    const seq = ++searchSeq;
    searchCatalog(term)
      .then(function (results) {
        if (seq !== searchSeq) return;
        state.catalog = { term: term, status: 'done', results: results };
        renderResults();
      })
      .catch(function () {
        if (seq !== searchSeq) return;
        state.catalog = { term: term, status: 'error', results: [] };
        renderResults();
      });
  }

  function closeSearch(clear) {
    // drop any pending or in-flight catalogue search so it can't reopen the dropdown
    clearTimeout(searchTimer);
    searchSeq++;
    resultsEl.hidden = true;
    if (clear) {
      searchInput.value = '';
      state.catalog = { term: '', status: 'idle', results: [] };
      if (manualForm) manualForm.hidden = true;
    }
  }

  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    renderResults(); // songs already in the list show instantly
    searchTimer = setTimeout(runCatalogSearch, 350);
  });

  searchInput.addEventListener('focus', function () {
    if (searchInput.value.trim().length >= 2) renderResults();
  });

  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSearch(false);
  });

  document.addEventListener('click', function (e) {
    if (resultsEl.hidden) return;
    if (!e.target.closest || !e.target.closest('.playlist-search')) closeSearch(false);
  });

  // Manual entry (for songs not in the catalogue)
  function openManual() {
    if (!manualForm) return;
    closeSearch(false);
    manualForm.hidden = false;
    if (manualTitle) {
      manualTitle.value = searchInput.value.trim();
      manualTitle.focus();
    }
  }

  if (manualForm && manualTitle && manualArtist) {
    manualForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const title = manualTitle.value.trim().slice(0, 120);
      const artist = manualArtist.value.trim().slice(0, 120);
      if (!title || !artist) return;
      manualTitle.value = '';
      manualArtist.value = '';
      confirmAndAdd({ title: title, artist: artist, artworkUrl: null, previewUrl: null, externalUrl: null, source: 'manual' });
    });
  }

  if (manualCancel && manualForm) {
    manualCancel.addEventListener('click', function () { manualForm.hidden = true; });
  }

  if (moreBtn) {
    moreBtn.addEventListener('click', function () {
      state.expanded = !state.expanded;
      renderRanking();
    });
  }

  // 30-second previews. The main script pauses the background music while one plays.
  const previewAudio = new Audio();
  previewAudio.preload = 'none';

  function setPreview(id) {
    const wasPlaying = state.previewId !== null;
    state.previewId = id;
    if (wasPlaying !== (id !== null)) {
      document.dispatchEvent(new CustomEvent('playlist:preview', { detail: { playing: id !== null } }));
    }
    renderRanking();
    if (!resultsEl.hidden) renderResults();
  }

  // Catalogue results are not in the list yet and have no id, so key previews by URL
  function previewKey(song) {
    return song.previewUrl;
  }

  function togglePreview(song) {
    const key = previewKey(song);
    if (state.previewId === key) {
      previewAudio.pause();
      setPreview(null);
      return;
    }
    previewAudio.src = song.previewUrl;
    previewAudio.play().then(function () {
      setPreview(key);
    }).catch(function () {
      showNotice('No se ha podido reproducir el fragmento.', 'error');
    });
  }

  previewAudio.addEventListener('ended', function () { setPreview(null); });

  if (store.mode === 'demo') {
    showNotice('Modo demo: las canciones y votos se guardan solo en este navegador.', 'info');
  }

  refresh();
  setInterval(function () {
    if (!document.hidden && resultsEl.hidden && !state.busy) refresh();
  }, POLL_MS);
})();
