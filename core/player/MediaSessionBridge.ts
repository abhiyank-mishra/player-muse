import { Song } from '@/lib/types';
import { AndroidMediaSessionManager, MediaSessionCallbacks } from '@/platform/android/AndroidMediaSessionManager';
import { IOSMediaSessionManager } from '@/platform/ios/IOSMediaSessionManager';

export class MediaSessionBridge {
  private static getPlatform() {
    if (typeof navigator === 'undefined') return 'web';
    const ua = navigator.userAgent;
    if (/Android/.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
    return 'web';
  }

  static updateMetadata(song: Song) {
    const platform = this.getPlatform();
    if (platform === 'ios') {
      IOSMediaSessionManager.updateMetadata(song);
    } else {
      // Default to Android/Web behavior
      AndroidMediaSessionManager.updateMetadata(song);
    }
  }

  static setActionHandlers(callbacks: MediaSessionCallbacks) {
    const platform = this.getPlatform();
    if (platform === 'ios') {
      IOSMediaSessionManager.setActionHandlers(callbacks);
    } else {
      AndroidMediaSessionManager.setActionHandlers(callbacks);
    }
  }

  static updatePositionState(duration: number, playbackRate: number, position: number) {
    const platform = this.getPlatform();
    if (platform === 'ios') {
      IOSMediaSessionManager.updatePositionState(duration, playbackRate, position);
    } else {
      AndroidMediaSessionManager.updatePositionState(duration, playbackRate, position);
    }
  }

  static setPlaybackState(isPlaying: boolean) {
    const state = isPlaying ? 'playing' : 'paused';
    const platform = this.getPlatform();
    if (platform === 'ios') {
      IOSMediaSessionManager.setPlaybackState(state);
    } else {
      AndroidMediaSessionManager.setPlaybackState(state);
    }
  }
}
