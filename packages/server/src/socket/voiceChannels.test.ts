import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  getVoiceUsers,
  getVoiceUser,
  isUserInVoice,
  addUserToVoice,
  removeUserFromVoice,
  removeUserFromAllVoice,
  updateUserMuteState,
  updateUserSpeakingState,
  getVoiceUserCount,
  hasVoiceUsers,
  clearAllVoiceState,
} from './voiceChannels.js';

describe('Voice Channels', () => {
  beforeEach(() => {
    // Clear all voice state before each test
    clearAllVoiceState();
  });

  describe('addUserToVoice', () => {
    it('should add a user to a voice channel', () => {
      const user = addUserToVoice(100, 1, 'player1', 'player');

      expect(user.userId).toBe(1);
      expect(user.username).toBe('player1');
      expect(user.role).toBe('player');
      expect(user.isMuted).toBe(false);
      expect(user.isSpeaking).toBe(false);
    });

    it('should add a DM to a voice channel', () => {
      const user = addUserToVoice(100, 1, 'dungeonmaster', 'dm');

      expect(user.role).toBe('dm');
    });

    it('should add multiple users to same room', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      addUserToVoice(100, 2, 'player2', 'player');
      addUserToVoice(100, 3, 'dm', 'dm');

      expect(getVoiceUserCount(100)).toBe(3);
    });

    it('should add users to different rooms independently', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      addUserToVoice(200, 2, 'player2', 'player');

      expect(getVoiceUserCount(100)).toBe(1);
      expect(getVoiceUserCount(200)).toBe(1);
    });

    it('should overwrite user if added again to same room', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      addUserToVoice(100, 1, 'player1_updated', 'dm');

      const users = getVoiceUsers(100);
      expect(users.length).toBe(1);
      expect(users[0].username).toBe('player1_updated');
      expect(users[0].role).toBe('dm');
    });
  });

  describe('getVoiceUsers', () => {
    it('should return empty array for room with no voice users', () => {
      const users = getVoiceUsers(999);
      expect(users).toEqual([]);
    });

    it('should return all users in a room', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      addUserToVoice(100, 2, 'player2', 'player');

      const users = getVoiceUsers(100);
      expect(users.length).toBe(2);
      expect(users.map((u) => u.username).sort()).toEqual(['player1', 'player2']);
    });

    it('should not include users from other rooms', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      addUserToVoice(200, 2, 'player2', 'player');

      const users = getVoiceUsers(100);
      expect(users.length).toBe(1);
      expect(users[0].username).toBe('player1');
    });
  });

  describe('getVoiceUser', () => {
    it('should return undefined for non-existent user', () => {
      const user = getVoiceUser(100, 999);
      expect(user).toBeUndefined();
    });

    it('should return undefined for non-existent room', () => {
      const user = getVoiceUser(999, 1);
      expect(user).toBeUndefined();
    });

    it('should return the correct user', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      addUserToVoice(100, 2, 'player2', 'dm');

      const user = getVoiceUser(100, 2);
      expect(user).toBeDefined();
      expect(user!.username).toBe('player2');
      expect(user!.role).toBe('dm');
    });
  });

  describe('isUserInVoice', () => {
    it('should return false for user not in voice', () => {
      expect(isUserInVoice(100, 1)).toBe(false);
    });

    it('should return false for non-existent room', () => {
      expect(isUserInVoice(999, 1)).toBe(false);
    });

    it('should return true for user in voice', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      expect(isUserInVoice(100, 1)).toBe(true);
    });

    it('should return false for user in different room', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      expect(isUserInVoice(200, 1)).toBe(false);
    });
  });

  describe('removeUserFromVoice', () => {
    it('should return false when removing from non-existent room', () => {
      const result = removeUserFromVoice(999, 1);
      expect(result).toBe(false);
    });

    it('should return false when removing non-existent user', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      const result = removeUserFromVoice(100, 999);
      expect(result).toBe(false);
    });

    it('should remove user from voice channel', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      addUserToVoice(100, 2, 'player2', 'player');

      const result = removeUserFromVoice(100, 1);

      expect(result).toBe(true);
      expect(isUserInVoice(100, 1)).toBe(false);
      expect(isUserInVoice(100, 2)).toBe(true);
      expect(getVoiceUserCount(100)).toBe(1);
    });

    it('should clean up empty room after last user leaves', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      removeUserFromVoice(100, 1);

      expect(hasVoiceUsers(100)).toBe(false);
      expect(getVoiceUsers(100)).toEqual([]);
    });
  });

  describe('removeUserFromAllVoice', () => {
    it('should return empty array when user is not in any voice', () => {
      const rooms = removeUserFromAllVoice(999);
      expect(rooms).toEqual([]);
    });

    it('should remove user from single room', () => {
      addUserToVoice(100, 1, 'player1', 'player');

      const rooms = removeUserFromAllVoice(1);

      expect(rooms).toEqual([100]);
      expect(isUserInVoice(100, 1)).toBe(false);
    });

    it('should remove user from multiple rooms', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      addUserToVoice(200, 1, 'player1', 'player');
      addUserToVoice(300, 1, 'player1', 'player');

      const rooms = removeUserFromAllVoice(1);

      expect(rooms.sort()).toEqual([100, 200, 300]);
      expect(isUserInVoice(100, 1)).toBe(false);
      expect(isUserInVoice(200, 1)).toBe(false);
      expect(isUserInVoice(300, 1)).toBe(false);
    });

    it('should not affect other users in same rooms', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      addUserToVoice(100, 2, 'player2', 'player');

      removeUserFromAllVoice(1);

      expect(isUserInVoice(100, 2)).toBe(true);
      expect(getVoiceUserCount(100)).toBe(1);
    });

    it('should clean up empty rooms', () => {
      addUserToVoice(100, 1, 'player1', 'player');

      removeUserFromAllVoice(1);

      expect(hasVoiceUsers(100)).toBe(false);
    });
  });

  describe('updateUserMuteState', () => {
    it('should return false for non-existent user', () => {
      const result = updateUserMuteState(100, 999, true);
      expect(result).toBe(false);
    });

    it('should return false for non-existent room', () => {
      const result = updateUserMuteState(999, 1, true);
      expect(result).toBe(false);
    });

    it('should update mute state to true', () => {
      addUserToVoice(100, 1, 'player1', 'player');

      const result = updateUserMuteState(100, 1, true);

      expect(result).toBe(true);
      expect(getVoiceUser(100, 1)!.isMuted).toBe(true);
    });

    it('should update mute state to false', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      updateUserMuteState(100, 1, true);

      const result = updateUserMuteState(100, 1, false);

      expect(result).toBe(true);
      expect(getVoiceUser(100, 1)!.isMuted).toBe(false);
    });
  });

  describe('updateUserSpeakingState', () => {
    it('should return false for non-existent user', () => {
      const result = updateUserSpeakingState(100, 999, true);
      expect(result).toBe(false);
    });

    it('should return false for non-existent room', () => {
      const result = updateUserSpeakingState(999, 1, true);
      expect(result).toBe(false);
    });

    it('should update speaking state to true', () => {
      addUserToVoice(100, 1, 'player1', 'player');

      const result = updateUserSpeakingState(100, 1, true);

      expect(result).toBe(true);
      expect(getVoiceUser(100, 1)!.isSpeaking).toBe(true);
    });

    it('should update speaking state to false', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      updateUserSpeakingState(100, 1, true);

      const result = updateUserSpeakingState(100, 1, false);

      expect(result).toBe(true);
      expect(getVoiceUser(100, 1)!.isSpeaking).toBe(false);
    });
  });

  describe('getVoiceUserCount', () => {
    it('should return 0 for non-existent room', () => {
      expect(getVoiceUserCount(999)).toBe(0);
    });

    it('should return 0 for empty room', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      removeUserFromVoice(100, 1);

      expect(getVoiceUserCount(100)).toBe(0);
    });

    it('should return correct count', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      addUserToVoice(100, 2, 'player2', 'player');
      addUserToVoice(100, 3, 'player3', 'player');

      expect(getVoiceUserCount(100)).toBe(3);
    });
  });

  describe('hasVoiceUsers', () => {
    it('should return false for non-existent room', () => {
      expect(hasVoiceUsers(999)).toBe(false);
    });

    it('should return false for empty room', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      removeUserFromVoice(100, 1);

      expect(hasVoiceUsers(100)).toBe(false);
    });

    it('should return true when room has users', () => {
      addUserToVoice(100, 1, 'player1', 'player');

      expect(hasVoiceUsers(100)).toBe(true);
    });
  });

  describe('clearAllVoiceState', () => {
    it('should clear all voice state', () => {
      addUserToVoice(100, 1, 'player1', 'player');
      addUserToVoice(200, 2, 'player2', 'player');
      addUserToVoice(300, 3, 'player3', 'player');

      clearAllVoiceState();

      expect(hasVoiceUsers(100)).toBe(false);
      expect(hasVoiceUsers(200)).toBe(false);
      expect(hasVoiceUsers(300)).toBe(false);
    });
  });
});
