import { useEffect, useState, useCallback, useRef } from "react";
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Plus,
  ChevronUp,
  ChevronDown,
  X,
  Music,
  Loader2,
} from "lucide-react";
import { useMusicStore } from "../../../stores/musicStore";
import { useAuthStore } from "../../../stores/authStore";
import { musicManager } from "../../../lib/musicManager";
import { Button } from "../../ui/Button";

interface MusicPlayerProps {
  currentRoomId: number | null;
}

export function MusicPlayer({ currentRoomId }: MusicPlayerProps) {
  const user = useAuthStore((state) => state.user);
  const {
    currentTrack,
    queue,
    isPlaying,
    volume,
    currentPosition,
    audioUrl,
    startedAt,
    pausedAt,
    isExpanded,
    isLoading,
    error,
    play,
    pause,
    skip,
    addToQueue,
    removeFromQueue,
    setVolume,
    setExpanded,
    setScope,
    clearError,
    setupSocketListeners,
    cleanupSocketListeners,
    fetchCurrentState,
  } = useMusicStore();

  const [addUrl, setAddUrl] = useState("");
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const isDM = user?.role === "dm";
  const prevAudioUrlRef = useRef<string | null>(null);

  // Initialize music manager and socket listeners
  useEffect(() => {
    musicManager.initialize();
    setupSocketListeners();
    fetchCurrentState();

    return () => {
      musicManager.cleanup();
      cleanupSocketListeners();
    };
  }, [setupSocketListeners, cleanupSocketListeners, fetchCurrentState]);

  // Update scope when room changes
  useEffect(() => {
    // For now, always use global scope
    // In the future, could check if room has active music
    setScope("global", currentRoomId ?? undefined);
  }, [currentRoomId, setScope]);

  // Update music manager when playback state changes (not volume)
  useEffect(() => {
    // Only update if audioUrl changed or playback state changed
    if (audioUrl !== prevAudioUrlRef.current || audioUrl) {
      prevAudioUrlRef.current = audioUrl;
      musicManager.updateFromState(
        audioUrl,
        isPlaying,
        startedAt,
        pausedAt,
        volume,
      );
    }
  }, [audioUrl, isPlaying, startedAt, pausedAt]); // volume removed from deps

  // Handle volume changes separately to avoid reloading audio
  useEffect(() => {
    musicManager.setVolume(volume);
  }, [volume]);

  // Format time in MM:SS
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Handle adding a song
  const handleAddSong = async () => {
    if (!addUrl.trim()) return;

    setIsAddingUrl(true);
    try {
      await addToQueue(addUrl.trim());
      setAddUrl("");
    } finally {
      setIsAddingUrl(false);
    }
  };

  // Handle play/pause toggle
  const handlePlayPause = async () => {
    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  };

  // If no current track and no queue, show minimal UI
  if (!currentTrack && queue.length === 0) {
    if (!isDM) {
      return null; // Players don't see the player when nothing is playing
    }

    // DM sees add song interface
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Music className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            placeholder="Paste YouTube URL to add music..."
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            onKeyDown={(e) => e.key === "Enter" && handleAddSong()}
          />
          <Button
            size="sm"
            onClick={handleAddSong}
            disabled={!addUrl.trim() || isAddingUrl}
          >
            {isAddingUrl ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </Button>
        </div>
        {error && (
          <div className="max-w-4xl mx-auto mt-2 text-red-400 text-sm flex items-center gap-2">
            {error}
            <button
              onClick={clearError}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700">
      {/* Main player bar */}
      <div className="p-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          {/* Track info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {currentTrack?.thumbnailUrl ? (
              <img
                src={currentTrack.thumbnailUrl}
                alt={currentTrack.title}
                className="w-12 h-12 rounded object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded bg-gray-700 flex items-center justify-center">
                <Music className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-medium truncate">
                {currentTrack?.title || "No track"}
              </div>
              <div className="text-sm text-gray-400">
                {formatTime(currentPosition)} /{" "}
                {formatTime(currentTrack?.duration || 0)}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Play/Pause - DM only */}
            {isDM && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePlayPause}
                  disabled={isLoading || !currentTrack}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </Button>

                {/* Skip */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skip}
                  disabled={isLoading || queue.length === 0}
                >
                  <SkipForward className="w-5 h-5" />
                </Button>
              </>
            )}

            {/* Volume - visible to all but only DM can change */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => isDM && setShowVolumeSlider(!showVolumeSlider)}
              >
                {volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </Button>
              {showVolumeSlider && isDM && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-gray-700 rounded shadow-lg">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(parseInt(e.target.value))}
                    className="w-24 accent-violet-500"
                  />
                </div>
              )}
            </div>

            {/* Expand/collapse */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronUp className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="max-w-4xl mx-auto mt-2">
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 transition-all duration-100"
              style={{
                width: `${
                  currentTrack?.duration
                    ? (currentPosition / currentTrack.duration) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Expanded view - queue */}
      {isExpanded && (
        <div className="border-t border-gray-700 p-3 max-h-64 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Queue ({queue.length} tracks)
            </h3>

            {/* Add song input - DM only */}
            {isDM && (
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  placeholder="YouTube URL..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  onKeyDown={(e) => e.key === "Enter" && handleAddSong()}
                />
                <Button
                  size="sm"
                  onClick={handleAddSong}
                  disabled={!addUrl.trim() || isAddingUrl}
                >
                  {isAddingUrl ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              </div>
            )}

            {/* Queue list */}
            {queue.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4">
                Queue is empty
              </div>
            ) : (
              <div className="space-y-2">
                {queue.map((track, index) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-2 bg-gray-700/50 rounded"
                  >
                    <span className="text-sm text-gray-500 w-6">
                      {index + 1}
                    </span>
                    {track.thumbnailUrl ? (
                      <img
                        src={track.thumbnailUrl}
                        alt={track.title}
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-600 flex items-center justify-center">
                        <Music className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{track.title}</div>
                      <div className="text-xs text-gray-400">
                        {formatTime(track.duration)} • Added by{" "}
                        {track.addedByUsername}
                      </div>
                    </div>
                    {isDM && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromQueue(track.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="border-t border-gray-700 px-3 py-2 bg-red-900/20">
          <div className="max-w-4xl mx-auto flex items-center gap-2 text-red-400 text-sm">
            {error}
            <button
              onClick={clearError}
              className="ml-auto text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
