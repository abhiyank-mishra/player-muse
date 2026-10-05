"use client";

/**
 * YouTubePlayerPatch
 * Prevents "TypeError: _a.getVolume is not a function" in youtube-video-element / react-player.
 *
 * Root cause:
 * `youtube-video-element` hooks into YouTube IFrame API's `onVolumeChange` event and volume getter,
 * calling `this.api.getVolume()`. During initialization, unmounting, or track switching,
 * `this.api` is an instance of `YT.Player` whose instance methods have not yet been dynamically
 * bound via the iframe postMessage handshake. Because `youtube-video-element` does not check
 * `typeof _a.getVolume === 'function'`, calling `_a.getVolume()` throws a fatal runtime TypeError,
 * which crashes playback and triggers unintended track skipping.
 *
 * Fix:
 * 1. Define fallback `getVolume()`, `isMuted()`, `setVolume()` on `YT.Player.prototype`.
 *    Once the iframe handshake completes, YouTube's instance methods cleanly shadow these.
 * 2. Guard `youtube-video` custom element's `volume` getter so it never throws if accessed early.
 */

if (typeof window !== 'undefined') {
  const patchYT = (yt: any) => {
    try {
      if (yt?.Player?.prototype) {
        if (typeof yt.Player.prototype.getVolume !== 'function') {
          yt.Player.prototype.getVolume = function () {
            return typeof (this as any)._volume === 'number' ? (this as any)._volume : 100;
          };
        }
        if (typeof yt.Player.prototype.isMuted !== 'function') {
          yt.Player.prototype.isMuted = function () {
            return Boolean((this as any)._muted);
          };
        }
        if (typeof yt.Player.prototype.setVolume !== 'function') {
          yt.Player.prototype.setVolume = function (vol: number) {
            (this as any)._volume = vol;
          };
        }
      }
    } catch {
      // Best-effort patch
    }
  };

  // 1. If window.YT is already present
  if ((window as any).YT) {
    patchYT((window as any).YT);
  }

  // 2. Intercept when window.YT is assigned by YouTube IFrame API script
  let currentYT = (window as any).YT;
  try {
    Object.defineProperty(window, 'YT', {
      configurable: true,
      enumerable: true,
      get() {
        return currentYT;
      },
      set(val) {
        currentYT = val;
        patchYT(val);
      },
    });
  } catch {
    // If property is already defined non-configurably, observe
    const checkInterval = setInterval(() => {
      if ((window as any).YT?.Player?.prototype) {
        patchYT((window as any).YT);
        clearInterval(checkInterval);
      }
    }, 100);
    setTimeout(() => clearInterval(checkInterval), 15000);
  }

  // 3. Patch customElements 'youtube-video'
  const patchCustomElement = () => {
    try {
      const CustomElem = window.customElements?.get('youtube-video');
      if (CustomElem && !(CustomElem as any)._patchedVolume) {
        (CustomElem as any)._patchedVolume = true;
        const proto = CustomElem.prototype;
        const origDesc = Object.getOwnPropertyDescriptor(proto, 'volume');
        if (origDesc) {
          Object.defineProperty(proto, 'volume', {
            configurable: true,
            enumerable: true,
            get() {
              try {
                if (!this.isLoaded || !this.api || typeof this.api.getVolume !== 'function') {
                  return (this as any)._initialVolume ?? 1;
                }
                return origDesc.get ? origDesc.get.call(this) : 1;
              } catch {
                return 1;
              }
            },
            set(val: number) {
              try {
                if (origDesc.set) {
                  origDesc.set.call(this, val);
                }
              } catch {
                // Silently absorb premature volume changes
              }
            },
          });
        }
      }
    } catch {
      // Best-effort
    }
  };

  if (typeof window.customElements !== 'undefined') {
    patchCustomElement();
    window.customElements.whenDefined('youtube-video').then(patchCustomElement).catch(() => {});
  }
}
