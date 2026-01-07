/**
 * Voice Channel State Management
 * Tracks which users are in voice channels per room
 */

export interface VoiceUser {
  userId: number;
  username: string;
  role: 'dm' | 'player';
  isMuted: boolean;
  isSpeaking: boolean;
}

// Track users in voice per room: roomId -> Map<userId, VoiceUser>
const voiceUsers = new Map<number, Map<number, VoiceUser>>();

/**
 * Get all users in a room's voice channel
 */
export function getVoiceUsers(roomId: number): VoiceUser[] {
  const users = voiceUsers.get(roomId);
  if (!users) return [];
  return Array.from(users.values());
}

/**
 * Get voice user by ID in a specific room
 */
export function getVoiceUser(roomId: number, userId: number): VoiceUser | undefined {
  return voiceUsers.get(roomId)?.get(userId);
}

/**
 * Check if user is in voice in a specific room
 */
export function isUserInVoice(roomId: number, userId: number): boolean {
  return voiceUsers.get(roomId)?.has(userId) ?? false;
}

/**
 * Add user to voice channel
 */
export function addUserToVoice(
  roomId: number,
  userId: number,
  username: string,
  role: 'dm' | 'player'
): VoiceUser {
  if (!voiceUsers.has(roomId)) {
    voiceUsers.set(roomId, new Map());
  }

  const user: VoiceUser = {
    userId,
    username,
    role,
    isMuted: false,
    isSpeaking: false,
  };

  voiceUsers.get(roomId)!.set(userId, user);
  return user;
}

/**
 * Remove user from voice channel
 */
export function removeUserFromVoice(roomId: number, userId: number): boolean {
  const roomVoiceUsers = voiceUsers.get(roomId);
  if (!roomVoiceUsers) return false;

  const removed = roomVoiceUsers.delete(userId);

  // Clean up empty room
  if (roomVoiceUsers.size === 0) {
    voiceUsers.delete(roomId);
  }

  return removed;
}

/**
 * Remove user from all voice channels (used on disconnect)
 */
export function removeUserFromAllVoice(userId: number): number[] {
  const roomsLeft: number[] = [];

  for (const [roomId, users] of voiceUsers.entries()) {
    if (users.has(userId)) {
      users.delete(userId);
      roomsLeft.push(roomId);

      // Clean up empty room
      if (users.size === 0) {
        voiceUsers.delete(roomId);
      }
    }
  }

  return roomsLeft;
}

/**
 * Update user's mute state
 */
export function updateUserMuteState(roomId: number, userId: number, isMuted: boolean): boolean {
  const user = voiceUsers.get(roomId)?.get(userId);
  if (!user) return false;

  user.isMuted = isMuted;
  return true;
}

/**
 * Update user's speaking state
 */
export function updateUserSpeakingState(roomId: number, userId: number, isSpeaking: boolean): boolean {
  const user = voiceUsers.get(roomId)?.get(userId);
  if (!user) return false;

  user.isSpeaking = isSpeaking;
  return true;
}

/**
 * Get count of users in voice for a room
 */
export function getVoiceUserCount(roomId: number): number {
  return voiceUsers.get(roomId)?.size ?? 0;
}

/**
 * Check if room has any users in voice
 */
export function hasVoiceUsers(roomId: number): boolean {
  return getVoiceUserCount(roomId) > 0;
}

/**
 * Clear all voice state (for testing only)
 */
export function clearAllVoiceState(): void {
  voiceUsers.clear();
}
