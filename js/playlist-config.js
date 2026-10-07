// Playlist backend settings (see docs/playlist.md).
// Leave supabaseUrl / supabaseAnonKey empty to run in demo mode: songs and votes
// are kept only in this browser, which is enough to try the widget locally.
// The anon / publishable key is public by design. Never put the service_role key here.
window.PLAYLIST_CONFIG = {
  supabaseUrl: 'https://tmfenvfpzboearayzdoj.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtZmVudmZwemJvZWFyYXl6ZG9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzOTgyNjYsImV4cCI6MjEwNjk3NDI2Nn0.qmiFXxpsL3G1Dxftd15wgS6loIyNFu3xSfXGGLB90bE',
  votesPerGuest: 5,   // must match vote_limit in docs/playlist-schema.sql
  songsPerGuest: 3,   // must match song_limit in docs/playlist-schema.sql
  itunesCountry: 'ES'
};
