/**
 * VoiceManager - Handles WebRTC peer connections for voice chat
 *
 * Manages:
 * - Local audio stream capture
 * - Peer connections to other users
 * - Offer/answer exchange
 * - ICE candidate exchange
 * - Audio playback for remote streams
 * - Voice activity detection (for speaking indicators)
 */

import {
  getSocket,
  sendVoiceOffer,
  sendVoiceAnswer,
  sendVoiceIceCandidate,
  emitVoiceSpeaking,
  type VoiceUser,
  type VoiceOfferEvent,
  type VoiceAnswerEvent,
  type VoiceIceCandidateEvent,
} from './socket';
import { useVoiceStore } from '../stores/voiceStore';

// WebRTC configuration with Google STUN servers
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// Audio constraints for getUserMedia
const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
};

// Voice activity detection threshold
const VAD_THRESHOLD = 15;
const VAD_CHECK_INTERVAL = 100; // ms

export type VoiceMode = 'always-on' | 'ptt';

export interface VoiceSettings {
  mode: VoiceMode;
  pttKey: string;
}

class VoiceManager {
  private localStream: MediaStream | null = null;
  private peerConnections: Map<number, RTCPeerConnection> = new Map();
  private remoteAudioElements: Map<number, HTMLAudioElement> = new Map();
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadInterval: ReturnType<typeof setInterval> | null = null;
  private isSpeaking = false;
  private currentRoomId: number | null = null;
  private settings: VoiceSettings = {
    mode: 'always-on',
    pttKey: 'Space',
  };
  private isPttActive = false;

  /**
   * Initialize voice with local audio capture
   */
  async initialize(): Promise<void> {
    try {
      // Request microphone permission and get local stream
      this.localStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
      console.log('✓ Microphone access granted');

      // Setup voice activity detection
      this.setupVoiceActivityDetection();

      // Setup PTT listeners
      this.setupPTTListeners();

      // Setup socket event listeners for WebRTC signaling
      this.setupSignalingListeners();
    } catch (error) {
      console.error('Failed to access microphone:', error);
      throw new Error('Microphone access denied');
    }
  }

  /**
   * Cleanup and release resources
   */
  cleanup(): void {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close all peer connections
    for (const pc of this.peerConnections.values()) {
      pc.close();
    }
    this.peerConnections.clear();

    // Remove audio elements
    for (const audio of this.remoteAudioElements.values()) {
      audio.pause();
      audio.srcObject = null;
    }
    this.remoteAudioElements.clear();

    // Stop VAD
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Remove PTT listeners
    this.removePTTListeners();

    // Remove signaling listeners
    this.removeSignalingListeners();

    this.currentRoomId = null;
    console.log('✓ Voice manager cleaned up');
  }

  /**
   * Set the current room for voice
   */
  setRoom(roomId: number): void {
    this.currentRoomId = roomId;
  }

  /**
   * Connect to existing voice users
   */
  async connectToUsers(users: VoiceUser[]): Promise<void> {
    for (const user of users) {
      await this.createOffer(user.userId);
    }
  }

  /**
   * Create a peer connection and send offer to a user
   */
  async createOffer(targetUserId: number): Promise<void> {
    console.log(`Creating offer for user ${targetUserId}`);

    const pc = this.createPeerConnection(targetUserId);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await sendVoiceOffer(targetUserId, offer);
      console.log(`✓ Sent offer to user ${targetUserId}`);
    } catch (error) {
      console.error(`Failed to create offer for user ${targetUserId}:`, error);
      useVoiceStore.getState().setConnectionState(targetUserId, 'failed');
    }
  }

  /**
   * Handle incoming offer from another user
   */
  async handleOffer(fromUserId: number, offer: RTCSessionDescriptionInit): Promise<void> {
    console.log(`Received offer from user ${fromUserId}`);

    const pc = this.createPeerConnection(fromUserId);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendVoiceAnswer(fromUserId, answer);
      console.log(`✓ Sent answer to user ${fromUserId}`);
    } catch (error) {
      console.error(`Failed to handle offer from user ${fromUserId}:`, error);
      useVoiceStore.getState().setConnectionState(fromUserId, 'failed');
    }
  }

  /**
   * Handle incoming answer from another user
   */
  async handleAnswer(fromUserId: number, answer: RTCSessionDescriptionInit): Promise<void> {
    console.log(`Received answer from user ${fromUserId}`);

    const pc = this.peerConnections.get(fromUserId);
    if (!pc) {
      console.error(`No peer connection for user ${fromUserId}`);
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(`✓ Set remote description for user ${fromUserId}`);
    } catch (error) {
      console.error(`Failed to set remote description for user ${fromUserId}:`, error);
    }
  }

  /**
   * Handle incoming ICE candidate from another user
   */
  async handleIceCandidate(fromUserId: number, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (!pc) {
      console.error(`No peer connection for user ${fromUserId}`);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error(`Failed to add ICE candidate from user ${fromUserId}:`, error);
    }
  }

  /**
   * Disconnect from a specific user
   */
  disconnectFromUser(userId: number): void {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }

    const audio = this.remoteAudioElements.get(userId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      this.remoteAudioElements.delete(userId);
    }

    console.log(`Disconnected from user ${userId}`);
  }

  /**
   * Mute/unmute local audio
   */
  setMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Get current mute state
   */
  isMuted(): boolean {
    if (!this.localStream) return true;
    const track = this.localStream.getAudioTracks()[0];
    return track ? !track.enabled : true;
  }

  /**
   * Update voice settings
   */
  setSettings(settings: Partial<VoiceSettings>): void {
    this.settings = { ...this.settings, ...settings };

    // If switching to PTT mode, mute by default
    if (settings.mode === 'ptt' && !this.isPttActive) {
      this.setMuted(true);
      useVoiceStore.getState().setMuted(true);
    }
  }

  /**
   * Get current settings
   */
  getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  // ==================== Private Methods ====================

  /**
   * Create a new peer connection for a user
   */
  private createPeerConnection(userId: number): RTCPeerConnection {
    // Close existing connection if any
    const existingPc = this.peerConnections.get(userId);
    if (existingPc) {
      existingPc.close();
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnections.set(userId, pc);

    // Update connection state
    useVoiceStore.getState().setConnectionState(userId, 'connecting');

    // Add local stream tracks to connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendVoiceIceCandidate(userId, event.candidate.toJSON());
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with user ${userId}: ${pc.connectionState}`);

      switch (pc.connectionState) {
        case 'connected':
          useVoiceStore.getState().setConnectionState(userId, 'connected');
          break;
        case 'disconnected':
        case 'closed':
          useVoiceStore.getState().setConnectionState(userId, 'disconnected');
          break;
        case 'failed':
          useVoiceStore.getState().setConnectionState(userId, 'failed');
          break;
      }
    };

    // Handle incoming audio stream
    pc.ontrack = (event) => {
      console.log(`Received audio track from user ${userId}`);

      const remoteStream = event.streams[0];
      if (remoteStream) {
        this.playRemoteAudio(userId, remoteStream);
      }
    };

    return pc;
  }

  /**
   * Play remote audio stream
   */
  private playRemoteAudio(userId: number, stream: MediaStream): void {
    let audio = this.remoteAudioElements.get(userId);

    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      this.remoteAudioElements.set(userId, audio);
    }

    audio.srcObject = stream;
    audio.play().catch((error) => {
      console.error(`Failed to play audio from user ${userId}:`, error);
    });
  }

  /**
   * Setup voice activity detection
   */
  private setupVoiceActivityDetection(): void {
    if (!this.localStream) return;

    try {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;

      const source = this.audioContext.createMediaStreamSource(this.localStream);
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      this.vadInterval = setInterval(() => {
        if (!this.analyser || !this.currentRoomId) return;

        this.analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const speaking = average > VAD_THRESHOLD && !this.isMuted();

        if (speaking !== this.isSpeaking) {
          this.isSpeaking = speaking;
          emitVoiceSpeaking(this.currentRoomId, speaking);
        }
      }, VAD_CHECK_INTERVAL);
    } catch (error) {
      console.error('Failed to setup voice activity detection:', error);
    }
  }

  /**
   * Setup PTT keyboard listeners
   */
  private setupPTTListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  /**
   * Remove PTT keyboard listeners
   */
  private removePTTListeners(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.settings.mode !== 'ptt') return;
    if (e.code !== this.settings.pttKey) return;
    if (e.repeat) return; // Ignore key repeat

    this.isPttActive = true;
    this.setMuted(false);
    useVoiceStore.getState().setMuted(false);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (this.settings.mode !== 'ptt') return;
    if (e.code !== this.settings.pttKey) return;

    this.isPttActive = false;
    this.setMuted(true);
    useVoiceStore.getState().setMuted(true);
  };

  /**
   * Setup socket event listeners for WebRTC signaling
   */
  private setupSignalingListeners(): void {
    const socket = getSocket();
    if (!socket) return;

    socket.on('voice_offer', (event: VoiceOfferEvent) => {
      this.handleOffer(event.fromUserId, event.offer);
    });

    socket.on('voice_answer', (event: VoiceAnswerEvent) => {
      this.handleAnswer(event.fromUserId, event.answer);
    });

    socket.on('voice_ice_candidate', (event: VoiceIceCandidateEvent) => {
      this.handleIceCandidate(event.fromUserId, event.candidate);
    });
  }

  /**
   * Remove socket event listeners
   */
  private removeSignalingListeners(): void {
    const socket = getSocket();
    if (!socket) return;

    socket.off('voice_offer');
    socket.off('voice_answer');
    socket.off('voice_ice_candidate');
  }
}

// Singleton instance
export const voiceManager = new VoiceManager();
