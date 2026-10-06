// Playlist backend settings (see docs/playlist.md).
// Leave supabaseUrl / supabaseAnonKey empty to run in demo mode: songs and votes
// are kept only in this browser, which is enough to try the widget locally.
// The anon / publishable key is public by design. Never put the service_role key here.
window.PLAYLIST_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  votesPerGuest: 5,   // must match vote_limit in docs/playlist-schema.sql
  songsPerGuest: 3,   // must match song_limit in docs/playlist-schema.sql
  itunesCountry: 'ES'
};
