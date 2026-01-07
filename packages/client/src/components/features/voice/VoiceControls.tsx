import { useState, useCallback, useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Phone, Settings } from 'lucide-react';
import { useVoiceStore } from '../../../stores/voiceStore';
import { useAuthStore } from '../../../stores/authStore';
import { voiceManager, type VoiceMode } from '../../../lib/voiceManager';
import { Button } from '../../ui/Button';

interface VoiceControlsProps {
  roomId: number;
}

export function VoiceControls({ roomId }: VoiceControlsProps) {
  const { user } = useAuthStore();
  const {
    isInVoice,
    isMuted,
    currentRoomId,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    setupSocketListeners,
    cleanupSocketListeners,
    error,
  } = useVoiceStore();

  const [isConnecting, setIsConnecting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('always-on');
  const wasInVoice = useRef(false);

  // Cleanup voiceManager when auto-kicked from voice (e.g., room switch)
  useEffect(() => {
    if (wasInVoice.current && !isInVoice) {
      // User was in voice but no longer - cleanup voiceManager
      console.log('✗ Voice state cleared, cleaning up voiceManager');
      voiceManager.cleanup();
      cleanupSocketListeners();
    }
    wasInVoice.current = isInVoice;
  }, [isInVoice, cleanupSocketListeners]);

  const handleJoinVoice = useCallback(async () => {
    if (!user) return;

    setIsConnecting(true);
    try {
      // Initialize voice manager
      await voiceManager.initialize();
      voiceManager.setRoom(roomId);

      // Setup socket listeners with current user ID
      setupSocketListeners(user.id);

      // Join voice channel and get existing users
      const existingUsers = await joinVoiceChannel(roomId);

      // Connect to existing users
      if (existingUsers.length > 0) {
        await voiceManager.connectToUsers(existingUsers);
      }

      console.log(`✓ Joined voice channel in room ${roomId}`);
    } catch (err) {
      console.error('Failed to join voice:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [roomId, user, joinVoiceChannel, setupSocketListeners]);

  const handleLeaveVoice = useCallback(async () => {
    try {
      // Cleanup voice manager
      voiceManager.cleanup();

      // Cleanup socket listeners
      cleanupSocketListeners();

      // Leave voice channel
      await leaveVoiceChannel();

      console.log('✓ Left voice channel');
    } catch (err) {
      console.error('Failed to leave voice:', err);
    }
  }, [leaveVoiceChannel, cleanupSocketListeners]);

  const handleToggleMute = useCallback(() => {
    toggleMute();
    voiceManager.setMuted(!isMuted);
  }, [toggleMute, isMuted]);

  const handleVoiceModeChange = useCallback((mode: VoiceMode) => {
    setVoiceMode(mode);
    voiceManager.setSettings({ mode });

    // If switching to PTT, mute by default
    if (mode === 'ptt') {
      voiceManager.setMuted(true);
      useVoiceStore.getState().setMuted(true);
    }
  }, []);

  if (!isInVoice) {
    return (
      <div className="flex items-center gap-2">
        <Button
          onClick={handleJoinVoice}
          disabled={isConnecting}
          variant="primary"
          size="sm"
          className="flex items-center gap-2"
        >
          <Phone className="w-4 h-4" />
          {isConnecting ? 'Connecting...' : 'Join Voice'}
        </Button>
        {error && (
          <span className="text-red-400 text-sm">{error}</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-2">
      {/* Mute/Unmute Button */}
      <button
        onClick={handleToggleMute}
        className={`p-2 rounded-lg transition-colors ${
          isMuted
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
        }`}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>

      {/* Voice Mode Indicator */}
      <span className="text-xs text-gray-400 px-2">
        {voiceMode === 'ptt' ? 'PTT (Space)' : 'Voice'}
      </span>

      {/* Settings Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        title="Voice Settings"
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* Leave Voice Button */}
      <button
        onClick={handleLeaveVoice}
        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
        title="Leave Voice"
      >
        <PhoneOff className="w-5 h-5" />
      </button>

      {/* Settings Dropdown */}
      {showSettings && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-3 z-50">
          <div className="text-sm text-gray-300 mb-2">Voice Mode</div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="voiceMode"
                checked={voiceMode === 'always-on'}
                onChange={() => handleVoiceModeChange('always-on')}
                className="text-violet-500"
              />
              <span className="text-sm text-gray-300">Always On</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="voiceMode"
                checked={voiceMode === 'ptt'}
                onChange={() => handleVoiceModeChange('ptt')}
                className="text-violet-500"
              />
              <span className="text-sm text-gray-300">Push to Talk</span>
            </label>
          </div>
          {voiceMode === 'ptt' && (
            <div className="mt-2 text-xs text-gray-500">
              Hold Space to talk
            </div>
          )}
        </div>
      )}
    </div>
  );
}
