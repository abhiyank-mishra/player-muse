export class DeepLinkHandler {
  static init() {
    if (typeof window === 'undefined') return;

    const checkAndRedirect = () => {
      const url = window.location.href;
      if (url.includes('spotify.com/playlist') && !url.includes('/import-spotify')) {
        const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
        if (match && match[1]) {
          const playlistId = match[1];
          // Redirect safely to our import flow
          window.location.href = `/import-spotify?url=${encodeURIComponent(`https://open.spotify.com/playlist/${playlistId}`)}`;
        }
      }
    };

    // Check on initial load
    checkAndRedirect();

    // Optionally check if window gains focus (for example, user pastes or comes back from another app)
    // Though for pure URLs this is enough.
  }
}
