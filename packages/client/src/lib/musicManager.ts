/**
 * Music Manager
 * Handles audio playback and synchronization with server state
 */

import { useMusicStore } from "../stores/musicStore";
import { musicSync } from "./socket";

const SYNC_INTERVAL_MS = 30000; // Sync every 30 seconds
const MAX_DRIFT_SECONDS = 3; // Max drift before forced sync

class MusicManager {
  private audio: HTMLAudioElement;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private positionUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private currentAudioUrl: string | null = null;
  private isInitialized = false;

  constructor() {
    this.audio = new Audio();
    this.setupAudioEventListeners();
  }

  private setupAudioEventListeners(): void {
    // Handle track ended
    this.audio.addEventListener("ended", () => {
      console.log("🎵 Track ended");
      useMusicStore.getState().skip();
    });

    // Handle errors
    this.audio.addEventListener("error", (e) => {
      console.error("🎵 Audio error:", e);
    });

    // Handle can play
    this.audio.addEventListener("canplay", () => {
      console.log("🎵 Audio can play");
    });

    // Handle playing
    this.audio.addEventListener("playing", () => {
      console.log("🎵 Audio playing");
    });
  }

  /**
   * Initialize the music manager
   */
  initialize(): void {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.startPositionUpdates();
    this.startSyncCheck();

    console.log("🎵 Music manager initialized");
  }

  /**
   * Cleanup the music manager
   */
  cleanup(): void {
    this.stopPositionUpdates();
    this.stopSyncCheck();
    this.audio.pause();
    this.audio.src = "";
    this.currentAudioUrl = null;
    this.isInitialized = false;

    console.log("🎵 Music manager cleaned up");
  }

  /**
   * Load and play a track from URL
   */
  async loadTrack(audioUrl: string, startPosition = 0): Promise<void> {
    if (this.currentAudioUrl === audioUrl) {
      // Same track, just seek if needed
      if (Math.abs(this.audio.currentTime - startPosition) > 1) {
        this.audio.currentTime = startPosition;
      }
      return;
    }

    console.log(`🎵 Loading track, starting at ${startPosition}s`);

    this.currentAudioUrl = audioUrl;
    this.audio.src = audioUrl;
    this.audio.currentTime = startPosition;

    // Set volume from store
    const volume = useMusicStore.getState().volume;
    this.audio.volume = volume / 100;
  }

  /**
   * Play audio
   */
  async play(): Promise<void> {
    try {
      await this.audio.play();
      console.log("🎵 Playback started");
    } catch (error) {
      console.error("🎵 Failed to play:", error);
    }
  }

  /**
   * Pause audio
   */
  pause(): void {
    this.audio.pause();
    console.log("🎵 Playback paused");
  }

  /**
   * Seek to position
   */
  seek(position: number): void {
    this.audio.currentTime = position;
  }

  /**
   * Set volume (0-100)
   */
  setVolume(volume: number): void {
    this.audio.volume = Math.max(0, Math.min(1, volume / 100));
  }

  /**
   * Get current playback position
   */
  getCurrentPosition(): number {
    return this.audio.currentTime;
  }

  /**
   * Check if audio is playing
   */
  isPlaying(): boolean {
    return !this.audio.paused && !this.audio.ended;
  }

  /**
   * Start periodic position updates to store
   */
  private startPositionUpdates(): void {
    if (this.positionUpdateInterval) return;

    this.positionUpdateInterval = setInterval(() => {
      if (this.isPlaying()) {
        useMusicStore.getState().updatePosition(this.audio.currentTime);
      }
    }, 100); // Update 10 times per second for smooth UI
  }

  /**
   * Stop position updates
   */
  private stopPositionUpdates(): void {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
  }

  /**
   * Start periodic sync checks with server
   */
  private startSyncCheck(): void {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      this.performSync();
    }, SYNC_INTERVAL_MS);
  }

  /**
   * Stop sync checks
   */
  private stopSyncCheck(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Perform sync with server
   */
  async performSync(): Promise<void> {
    const store = useMusicStore.getState();
    const { activeScope, currentRoomId, isPlaying: storeIsPlaying } = store;

    // Only sync if we think we're playing
    if (!storeIsPlaying) return;

    try {
      const response = await musicSync(activeScope, currentRoomId ?? undefined);

      if (!response.success || response.currentPosition === undefined) {
        return;
      }

      const serverPosition = response.currentPosition;
      const localPosition = this.audio.currentTime;
      const drift = Math.abs(serverPosition - localPosition);

      // Only sync if drift exceeds threshold
      if (drift > MAX_DRIFT_SECONDS) {
        console.log(
          `🎵 Sync correction: drift was ${drift.toFixed(1)}s, adjusting`,
        );
        this.audio.currentTime = serverPosition;
      }

      // Handle play/pause state mismatch
      if (response.isPlaying && this.audio.paused) {
        console.log("🎵 Sync: resuming playback");
        await this.play();
      } else if (!response.isPlaying && !this.audio.paused) {
        console.log("🎵 Sync: pausing playback");
        this.pause();
      }
    } catch (error) {
      console.error("🎵 Sync failed:", error);
    }
  }

  /**
   * Update from store state (called when socket events update the store)
   */
  async updateFromState(
    audioUrl: string | null,
    isPlaying: boolean,
    startedAt: number | null,
    pausedAt: number | null,
    volume: number,
  ): Promise<void> {
    // Update volume
    this.setVolume(volume);

    // Handle no audio URL
    if (!audioUrl) {
      this.pause();
      this.audio.src = "";
      this.currentAudioUrl = null;
      return;
    }

    // Calculate current position
    let position = 0;
    if (isPlaying && startedAt !== null) {
      position = (Date.now() - startedAt) / 1000;
    } else if (pausedAt !== null) {
      position = pausedAt;
    }

    // Load track if needed
    if (this.currentAudioUrl !== audioUrl) {
      await this.loadTrack(audioUrl, position);
    } else {
      // Same track, check if we need to seek
      const drift = Math.abs(this.audio.currentTime - position);
      if (drift > MAX_DRIFT_SECONDS) {
        this.audio.currentTime = position;
      }
    }

    // Handle play/pause
    if (isPlaying && this.audio.paused) {
      await this.play();
    } else if (!isPlaying && !this.audio.paused) {
      this.pause();
    }
  }
}

// Singleton instance
export const musicManager = new MusicManager();
