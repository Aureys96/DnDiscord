import { Crown, User, Mic, MicOff, Wifi, WifiOff, Loader2 } from "lucide-react";
import {
  useVoiceStore,
  type ConnectionState,
} from "../../../stores/voiceStore";
import type { VoiceUser } from "../../../lib/socket";

interface VoiceParticipantProps {
  user: VoiceUser;
  connectionState?: ConnectionState;
}

function VoiceParticipant({ user, connectionState }: VoiceParticipantProps) {
  const isDM = user.role === "dm";

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
        user.isSpeaking
          ? "bg-emerald-500/20 ring-2 ring-emerald-500/50"
          : "bg-gray-800/50"
      }`}
    >
      {/* Avatar with speaking indicator */}
      <div className="relative">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isDM ? "bg-amber-500/20" : "bg-violet-500/20"
          } ${user.isSpeaking ? "animate-pulse" : ""}`}
        >
          {isDM ? (
            <Crown
              className={`w-4 h-4 ${isDM ? "text-amber-500" : "text-violet-500"}`}
            />
          ) : (
            <User className="w-4 h-4 text-violet-500" />
          )}
        </div>

        {/* Speaking glow effect */}
        {user.isSpeaking && (
          <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
        )}
      </div>

      {/* Username */}
      <span
        className={`text-sm flex-1 truncate ${
          isDM ? "text-amber-400" : "text-gray-200"
        }`}
      >
        {user.username}
      </span>

      {/* Connection/Mute Status */}
      <div className="flex items-center gap-1">
        {/* Connection state indicator */}
        {connectionState && connectionState !== "connected" && (
          <span title={`Connection: ${connectionState}`}>
            {connectionState === "connecting" ? (
              <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />
            ) : connectionState === "failed" ? (
              <WifiOff className="w-3 h-3 text-red-400" />
            ) : (
              <Wifi className="w-3 h-3 text-gray-500" />
            )}
          </span>
        )}

        {/* Mute indicator */}
        {user.isMuted ? (
          <MicOff className="w-4 h-4 text-red-400" />
        ) : (
          <Mic
            className={`w-4 h-4 ${user.isSpeaking ? "text-emerald-400" : "text-gray-500"}`}
          />
        )}
      </div>
    </div>
  );
}

interface VoiceParticipantsProps {
  compact?: boolean;
}

export function VoiceParticipants({ compact = false }: VoiceParticipantsProps) {
  const { voiceUsers, connectionStates, isInVoice } = useVoiceStore();

  const users = Array.from(voiceUsers.values());

  if (!isInVoice || users.length === 0) {
    return null;
  }

  if (compact) {
    // Compact view - just show avatars
    return (
      <div className="flex items-center -space-x-2">
        {users.slice(0, 5).map((user) => (
          <div
            key={user.userId}
            className={`w-7 h-7 rounded-full flex items-center justify-center border-2 border-gray-900 ${
              user.role === "dm" ? "bg-amber-500/20" : "bg-violet-500/20"
            } ${user.isSpeaking ? "ring-2 ring-emerald-500" : ""}`}
            title={`${user.username}${user.isMuted ? " (muted)" : ""}${user.isSpeaking ? " (speaking)" : ""}`}
          >
            {user.role === "dm" ? (
              <Crown className="w-3 h-3 text-amber-500" />
            ) : (
              <User className="w-3 h-3 text-violet-500" />
            )}
          </div>
        ))}
        {users.length > 5 && (
          <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-700 border-2 border-gray-900 text-xs text-gray-300">
            +{users.length - 5}
          </div>
        )}
      </div>
    );
  }

  // Full view - show list
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Voice ({users.length})
      </div>
      <div className="space-y-1">
        {users.map((user) => (
          <VoiceParticipant
            key={user.userId}
            user={user}
            connectionState={connectionStates.get(user.userId)}
          />
        ))}
      </div>
    </div>
  );
}
