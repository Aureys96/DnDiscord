import { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import {
  getMessageQueries,
  getDMQueries,
  getConversationQueries,
  getUserQueries,
} from "../db/index.js";
import {
  extractDiceCommand,
  parseAndRoll,
  formatRollResult,
  type DiceRollResult,
} from "@dnd-voice/shared";
import {
  getVoiceUsers,
  addUserToVoice,
  removeUserFromVoice,
  removeUserFromAllVoice,
  updateUserMuteState,
  updateUserSpeakingState,
  isUserInVoice,
  getUserVoiceRoom,
} from "./voiceChannels.js";
import {
  getGlobalMusicState,
  getRoomMusicState,
  getEffectiveMusicState,
  getCurrentPosition,
  playGlobalMusic,
  pauseGlobalMusic,
  skipGlobalTrack,
  seekGlobalMusic,
  setGlobalVolume,
  addToGlobalQueue,
  removeFromGlobalQueue,
  playRoomMusic,
  pauseRoomMusic,
  skipRoomTrack,
  seekRoomMusic,
  setRoomVolume,
  addToRoomQueue,
  removeFromRoomQueue,
  generateTrackId,
  type MusicTrack,
  type MusicState,
} from "./musicState.js";
import {
  extractAudioUrl,
  validateYouTubeUrl,
  getVideoInfo,
} from "../services/youtubeService.js";

const JWT_SECRET =
  process.env.JWT_SECRET || "dev-secret-key-please-change-in-production";

interface JWTPayload {
  userId: number;
  username: string;
  role: "dm" | "player";
}

interface AuthenticatedSocket extends Socket {
  user: {
    id: number;
    username: string;
    role: "dm" | "player";
  };
}

interface SendMessagePayload {
  content: string;
  type?: "global" | "room";
  roomId?: number;
}

interface SendDMPayload {
  recipientId: number;
  content: string;
}

interface DMMessageResponse {
  id: number;
  userId: number;
  recipientId: number;
  content: string;
  timestamp: string;
  type: "dm";
  username: string;
  userRole: string;
}

// Voice signaling payload types
interface VoiceJoinPayload {
  roomId: number;
}

// WebRTC types for signaling (server just relays these, doesn't need full types)
interface RTCSessionDescriptionLike {
  type: string;
  sdp?: string;
}

interface RTCIceCandidateLike {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

interface VoiceOfferPayload {
  targetUserId: number;
  offer: RTCSessionDescriptionLike;
}

interface VoiceAnswerPayload {
  targetUserId: number;
  answer: RTCSessionDescriptionLike;
}

interface VoiceIceCandidatePayload {
  targetUserId: number;
  candidate: RTCIceCandidateLike;
}

interface VoiceStateUpdatePayload {
  roomId: number;
  isMuted: boolean;
}

interface VoiceSpeakingPayload {
  roomId: number;
  isSpeaking: boolean;
}

// Music payload types
interface MusicScopePayload {
  scope: "global" | "room";
  roomId?: number;
}

interface MusicAddPayload extends MusicScopePayload {
  youtubeUrl: string;
}

interface MusicRemovePayload extends MusicScopePayload {
  trackId: string;
}

interface MusicSeekPayload extends MusicScopePayload {
  position: number;
}

interface MusicVolumePayload extends MusicScopePayload {
  volume: number;
}

interface MessageResponse {
  id: number;
  roomId: number | null;
  userId: number;
  content: string;
  timestamp: string;
  type: string;
  username: string;
  userRole: string;
  rollResult?: DiceRollResult;
}

// Store connected users
const connectedUsers = new Map<number, AuthenticatedSocket>();

// Track which room each user is currently in (null = global only)
const userCurrentRoom = new Map<number, number | null>();

// Track users in each room for presence
const roomUsers = new Map<number, Set<number>>();

function getRoomUserList(
  roomId: number,
): Array<{ userId: number; username: string; role: string }> {
  const userIds = roomUsers.get(roomId) || new Set();
  const users: Array<{ userId: number; username: string; role: string }> = [];

  for (const userId of userIds) {
    const socket = connectedUsers.get(userId);
    if (socket) {
      users.push({
        userId: socket.user.id,
        username: socket.user.username,
        role: socket.user.role,
      });
    }
  }

  return users;
}

export function setupSocketIO(httpServer: HTTPServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
    },
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      (socket as AuthenticatedSocket).user = {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role,
      };
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return next(new Error("Token expired"));
      }
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const { user } = authSocket;

    console.log(`✓ User connected: ${user.username} (ID: ${user.id})`);

    // Store connected user
    connectedUsers.set(user.id, authSocket);

    // Join global room
    authSocket.join("global");

    // Broadcast user joined
    io.to("global").emit("user_joined", {
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // Handle send message
    authSocket.on("send_message", (payload: SendMessagePayload, callback) => {
      try {
        const { content, type = "global", roomId } = payload;

        if (!content || content.trim() === "") {
          return callback?.({ error: "Message content is required" });
        }

        if (content.length > 2000) {
          return callback?.({
            error: "Message too long (max 2000 characters)",
          });
        }

        // Check for dice roll command
        const diceNotation = extractDiceCommand(content.trim());
        let rollResult: DiceRollResult | null = null;
        let messageContent = content.trim();
        let messageType: string = type;

        if (diceNotation) {
          rollResult = parseAndRoll(diceNotation);
          if (rollResult) {
            // Format the roll result as human-readable content
            messageContent = formatRollResult(rollResult);
            messageType = "roll";
          }
        }

        const queries = getMessageQueries();

        // Insert message into database
        const result = queries.create.run(
          type === "room" ? roomId : null, // Use original type for room context
          user.id,
          messageContent,
          messageType,
          null, // recipient_id (for DMs)
          rollResult ? JSON.stringify(rollResult) : null, // roll_result
        );

        // Get the created message with user info
        const message = queries.getById.get(result.lastInsertRowid) as {
          id: number;
          room_id: number | null;
          user_id: number;
          content: string;
          timestamp: string;
          type: string;
          username: string;
          user_role: string;
          roll_result: string | null;
        };

        const messageResponse: MessageResponse = {
          id: message.id,
          roomId: message.room_id,
          userId: message.user_id,
          content: message.content,
          timestamp: message.timestamp,
          type: message.type,
          username: message.username,
          userRole: message.user_role,
          rollResult: message.roll_result
            ? JSON.parse(message.roll_result)
            : undefined,
        };

        // Broadcast to appropriate room
        if (type === "global") {
          io.to("global").emit("new_message", messageResponse);
        } else if (type === "room" && roomId) {
          io.to(`room:${roomId}`).emit("new_message", messageResponse);
        }

        callback?.({ success: true, message: messageResponse });
      } catch (error) {
        console.error("Error sending message:", error);
        callback?.({ error: "Failed to send message" });
      }
    });

    // Handle get message history
    authSocket.on(
      "get_messages",
      (
        payload: { type?: "global" | "room"; roomId?: number; limit?: number },
        callback,
      ) => {
        try {
          const { type = "global", roomId, limit = 50 } = payload;
          const queries = getMessageQueries();

          let messages: Array<{
            id: number;
            room_id: number | null;
            user_id: number;
            content: string;
            timestamp: string;
            type: string;
            username: string;
            user_role: string;
            roll_result: string | null;
          }>;

          if (type === "global") {
            messages = queries.getGlobalMessages.all(
              Math.min(limit, 100),
            ) as typeof messages;
          } else if (type === "room" && roomId) {
            messages = queries.getRoomMessages.all(
              roomId,
              Math.min(limit, 100),
            ) as typeof messages;
          } else {
            return callback?.({ error: "Invalid request" });
          }

          // Transform and reverse to get chronological order (oldest first)
          const transformedMessages: MessageResponse[] = messages
            .map((m) => ({
              id: m.id,
              roomId: m.room_id,
              userId: m.user_id,
              content: m.content,
              timestamp: m.timestamp,
              type: m.type,
              username: m.username,
              userRole: m.user_role,
              rollResult: m.roll_result ? JSON.parse(m.roll_result) : undefined,
            }))
            .reverse();

          callback?.({ success: true, messages: transformedMessages });
        } catch (error) {
          console.error("Error getting messages:", error);
          callback?.({ error: "Failed to get messages" });
        }
      },
    );

    // Handle typing indicator
    authSocket.on("typing_start", (payload?: { roomId?: number }) => {
      const roomId = payload?.roomId;
      const targetRoom = roomId ? `room:${roomId}` : "global";
      authSocket.to(targetRoom).emit("user_typing", {
        userId: user.id,
        username: user.username,
        roomId: roomId || null,
      });
    });

    authSocket.on("typing_stop", (payload?: { roomId?: number }) => {
      const roomId = payload?.roomId;
      const targetRoom = roomId ? `room:${roomId}` : "global";
      authSocket.to(targetRoom).emit("user_stopped_typing", {
        userId: user.id,
        roomId: roomId || null,
      });
    });

    // Handle join room
    authSocket.on("join_room", (payload: { roomId: number }, callback) => {
      try {
        const { roomId } = payload;

        if (!roomId || typeof roomId !== "number") {
          return callback?.({ error: "Invalid room ID" });
        }

        // Leave current room if in one
        const currentRoomId = userCurrentRoom.get(user.id);
        if (currentRoomId !== null && currentRoomId !== undefined) {
          // Auto-leave voice if in voice channel in old room
          const voiceRoomId = getUserVoiceRoom(user.id);
          if (voiceRoomId !== null && voiceRoomId === currentRoomId) {
            const removed = removeUserFromVoice(currentRoomId, user.id);
            if (removed) {
              // Notify others in old room that user left voice
              io.to(`room:${currentRoomId}`).emit("voice_user_left", {
                roomId: currentRoomId,
                userId: user.id,
                username: user.username,
              });
              console.log(
                `✗ ${user.username} auto-left voice in room ${currentRoomId} (switched rooms)`,
              );
            }
          }

          authSocket.leave(`room:${currentRoomId}`);

          // Remove from room users tracking
          const currentRoomUsers = roomUsers.get(currentRoomId);
          if (currentRoomUsers) {
            currentRoomUsers.delete(user.id);
            if (currentRoomUsers.size === 0) {
              roomUsers.delete(currentRoomId);
            }
          }

          // Notify others in the old room
          io.to(`room:${currentRoomId}`).emit("user_left_room", {
            userId: user.id,
            username: user.username,
            roomId: currentRoomId,
          });
        }

        // Join new room
        authSocket.join(`room:${roomId}`);
        userCurrentRoom.set(user.id, roomId);

        // Add to room users tracking
        if (!roomUsers.has(roomId)) {
          roomUsers.set(roomId, new Set());
        }
        roomUsers.get(roomId)!.add(user.id);

        // Notify others in the new room
        io.to(`room:${roomId}`).emit("user_joined_room", {
          userId: user.id,
          username: user.username,
          role: user.role,
          roomId,
        });

        // Return success with room users
        callback?.({
          success: true,
          roomId,
          users: getRoomUserList(roomId),
        });
      } catch (error) {
        console.error("Error joining room:", error);
        callback?.({ error: "Failed to join room" });
      }
    });

    // Handle leave room (go back to global only)
    authSocket.on("leave_room", (callback) => {
      try {
        const currentRoomId = userCurrentRoom.get(user.id);

        if (currentRoomId !== null && currentRoomId !== undefined) {
          // Auto-leave voice if in voice channel
          const voiceRoomId = getUserVoiceRoom(user.id);
          if (voiceRoomId !== null && voiceRoomId === currentRoomId) {
            const removed = removeUserFromVoice(currentRoomId, user.id);
            if (removed) {
              io.to(`room:${currentRoomId}`).emit("voice_user_left", {
                roomId: currentRoomId,
                userId: user.id,
                username: user.username,
              });
              console.log(
                `✗ ${user.username} auto-left voice in room ${currentRoomId} (left room)`,
              );
            }
          }

          authSocket.leave(`room:${currentRoomId}`);

          // Remove from room users tracking
          const currentRoomUsers = roomUsers.get(currentRoomId);
          if (currentRoomUsers) {
            currentRoomUsers.delete(user.id);
            if (currentRoomUsers.size === 0) {
              roomUsers.delete(currentRoomId);
            }
          }

          // Notify others in the room
          io.to(`room:${currentRoomId}`).emit("user_left_room", {
            userId: user.id,
            username: user.username,
            roomId: currentRoomId,
          });

          userCurrentRoom.set(user.id, null);
        }

        callback?.({ success: true });
      } catch (error) {
        console.error("Error leaving room:", error);
        callback?.({ error: "Failed to leave room" });
      }
    });

    // Get room users
    authSocket.on("get_room_users", (payload: { roomId: number }, callback) => {
      try {
        const { roomId } = payload;

        if (!roomId || typeof roomId !== "number") {
          return callback?.({ error: "Invalid room ID" });
        }

        callback?.({
          success: true,
          users: getRoomUserList(roomId),
        });
      } catch (error) {
        console.error("Error getting room users:", error);
        callback?.({ error: "Failed to get room users" });
      }
    });

    // Handle send DM
    authSocket.on("send_dm", (payload: SendDMPayload, callback) => {
      try {
        const { recipientId, content } = payload;

        if (!recipientId || typeof recipientId !== "number") {
          return callback?.({ error: "Invalid recipient ID" });
        }

        if (recipientId === user.id) {
          return callback?.({ error: "Cannot send DM to yourself" });
        }

        if (!content || content.trim() === "") {
          return callback?.({ error: "Message content is required" });
        }

        if (content.length > 2000) {
          return callback?.({
            error: "Message too long (max 2000 characters)",
          });
        }

        // Check if recipient exists
        const userQueries = getUserQueries();
        const recipient = userQueries.getById.get(recipientId) as
          | { id: number; username: string; role: string }
          | undefined;

        if (!recipient) {
          return callback?.({ error: "User not found" });
        }

        // Create/update conversation
        const conversationQueries = getConversationQueries();
        const conversation = conversationQueries.getOrCreate(
          user.id,
          recipientId,
        );

        // Create DM message
        const dmQueries = getDMQueries();
        const result = dmQueries.create.run(
          user.id,
          content.trim(),
          recipientId,
        );

        // Update conversation timestamp
        conversationQueries.updateLastMessage.run(conversation.id);

        // Mark as read for sender
        dmQueries.markRead.run(conversation.id, user.id);

        const dmMessage: DMMessageResponse = {
          id: result.lastInsertRowid as number,
          userId: user.id,
          recipientId,
          content: content.trim(),
          timestamp: new Date().toISOString(),
          type: "dm",
          username: user.username,
          userRole: user.role,
        };

        // Send to recipient if online
        const recipientSocket = connectedUsers.get(recipientId);
        if (recipientSocket) {
          recipientSocket.emit("new_dm", dmMessage);
        }

        // Also send back to sender for confirmation
        authSocket.emit("new_dm", dmMessage);

        callback?.({ success: true, message: dmMessage });
      } catch (error) {
        console.error("Error sending DM:", error);
        callback?.({ error: "Failed to send DM" });
      }
    });

    // Handle DM typing indicator
    authSocket.on("dm_typing_start", (payload: { recipientId: number }) => {
      const { recipientId } = payload;
      const recipientSocket = connectedUsers.get(recipientId);
      if (recipientSocket) {
        recipientSocket.emit("dm_user_typing", {
          userId: user.id,
          username: user.username,
        });
      }
    });

    authSocket.on("dm_typing_stop", (payload: { recipientId: number }) => {
      const { recipientId } = payload;
      const recipientSocket = connectedUsers.get(recipientId);
      if (recipientSocket) {
        recipientSocket.emit("dm_user_stopped_typing", {
          userId: user.id,
        });
      }
    });

    // ==================== Voice Channel Events ====================

    // Handle joining voice channel
    authSocket.on("voice_join", (payload: VoiceJoinPayload, callback) => {
      try {
        const { roomId } = payload;

        if (!roomId || typeof roomId !== "number") {
          return callback?.({ error: "Invalid room ID" });
        }

        // Check if user is in the room
        const currentRoomId = userCurrentRoom.get(user.id);
        if (currentRoomId !== roomId) {
          return callback?.({ error: "You must be in the room to join voice" });
        }

        // Check if already in voice
        if (isUserInVoice(roomId, user.id)) {
          return callback?.({ error: "Already in voice channel" });
        }

        // Get existing voice users before adding
        const existingUsers = getVoiceUsers(roomId);

        // Add user to voice channel
        const voiceUser = addUserToVoice(
          roomId,
          user.id,
          user.username,
          user.role,
        );

        // Notify others in room that user joined voice
        io.to(`room:${roomId}`).emit("voice_user_joined", {
          roomId,
          user: voiceUser,
        });

        console.log(`✓ ${user.username} joined voice in room ${roomId}`);

        // Return success with list of existing voice users (for peer connection setup)
        callback?.({
          success: true,
          roomId,
          voiceUsers: existingUsers,
        });
      } catch (error) {
        console.error("Error joining voice:", error);
        callback?.({ error: "Failed to join voice channel" });
      }
    });

    // Handle leaving voice channel
    authSocket.on("voice_leave", (payload: { roomId: number }, callback) => {
      try {
        const { roomId } = payload;

        if (!roomId || typeof roomId !== "number") {
          return callback?.({ error: "Invalid room ID" });
        }

        // Remove user from voice
        const removed = removeUserFromVoice(roomId, user.id);

        if (removed) {
          // Notify others in room
          io.to(`room:${roomId}`).emit("voice_user_left", {
            roomId,
            userId: user.id,
            username: user.username,
          });

          console.log(`✗ ${user.username} left voice in room ${roomId}`);
        }

        callback?.({ success: true });
      } catch (error) {
        console.error("Error leaving voice:", error);
        callback?.({ error: "Failed to leave voice channel" });
      }
    });

    // Handle WebRTC offer (relay to target user)
    authSocket.on("voice_offer", (payload: VoiceOfferPayload, callback) => {
      try {
        const { targetUserId, offer } = payload;

        if (!targetUserId || !offer) {
          return callback?.({ error: "Invalid offer payload" });
        }

        const targetSocket = connectedUsers.get(targetUserId);
        if (!targetSocket) {
          return callback?.({ error: "Target user not connected" });
        }

        // Relay offer to target user
        targetSocket.emit("voice_offer", {
          fromUserId: user.id,
          fromUsername: user.username,
          offer,
        });

        callback?.({ success: true });
      } catch (error) {
        console.error("Error relaying voice offer:", error);
        callback?.({ error: "Failed to relay offer" });
      }
    });

    // Handle WebRTC answer (relay to target user)
    authSocket.on("voice_answer", (payload: VoiceAnswerPayload, callback) => {
      try {
        const { targetUserId, answer } = payload;

        if (!targetUserId || !answer) {
          return callback?.({ error: "Invalid answer payload" });
        }

        const targetSocket = connectedUsers.get(targetUserId);
        if (!targetSocket) {
          return callback?.({ error: "Target user not connected" });
        }

        // Relay answer to target user
        targetSocket.emit("voice_answer", {
          fromUserId: user.id,
          answer,
        });

        callback?.({ success: true });
      } catch (error) {
        console.error("Error relaying voice answer:", error);
        callback?.({ error: "Failed to relay answer" });
      }
    });

    // Handle ICE candidate exchange
    authSocket.on(
      "voice_ice_candidate",
      (payload: VoiceIceCandidatePayload, callback) => {
        try {
          const { targetUserId, candidate } = payload;

          if (!targetUserId || !candidate) {
            return callback?.({ error: "Invalid ICE candidate payload" });
          }

          const targetSocket = connectedUsers.get(targetUserId);
          if (!targetSocket) {
            return callback?.({ error: "Target user not connected" });
          }

          // Relay ICE candidate to target user
          targetSocket.emit("voice_ice_candidate", {
            fromUserId: user.id,
            candidate,
          });

          callback?.({ success: true });
        } catch (error) {
          console.error("Error relaying ICE candidate:", error);
          callback?.({ error: "Failed to relay ICE candidate" });
        }
      },
    );

    // Handle voice state update (mute/unmute)
    authSocket.on("voice_state_update", (payload: VoiceStateUpdatePayload) => {
      const { roomId, isMuted } = payload;

      if (!roomId || typeof roomId !== "number") return;

      // Update state
      updateUserMuteState(roomId, user.id, isMuted);

      // Broadcast to room
      io.to(`room:${roomId}`).emit("voice_state_changed", {
        roomId,
        userId: user.id,
        isMuted,
      });
    });

    // Handle speaking state update (for speaking indicators)
    authSocket.on("voice_speaking", (payload: VoiceSpeakingPayload) => {
      const { roomId, isSpeaking } = payload;

      if (!roomId || typeof roomId !== "number") return;

      // Update state
      updateUserSpeakingState(roomId, user.id, isSpeaking);

      // Broadcast to room
      io.to(`room:${roomId}`).emit("voice_speaking_changed", {
        roomId,
        userId: user.id,
        isSpeaking,
      });
    });

    // Get current voice users in a room
    authSocket.on(
      "voice_get_users",
      (payload: { roomId: number }, callback) => {
        try {
          const { roomId } = payload;

          if (!roomId || typeof roomId !== "number") {
            return callback?.({ error: "Invalid room ID" });
          }

          const voiceUsers = getVoiceUsers(roomId);
          callback?.({ success: true, voiceUsers });
        } catch (error) {
          console.error("Error getting voice users:", error);
          callback?.({ error: "Failed to get voice users" });
        }
      },
    );

    // ==================== End Voice Channel Events ====================

    // ==================== Music Events ====================

    // Helper function to broadcast music state change
    const broadcastMusicState = async (
      scope: "global" | "room",
      roomId: number | undefined,
      state: MusicState,
    ) => {
      let audioUrl: string | undefined;

      // Extract audio URL if there's a current track
      if (state.currentTrack) {
        try {
          const audioInfo = await extractAudioUrl(
            state.currentTrack.youtubeUrl,
          );
          audioUrl = audioInfo.audioUrl;
        } catch (error) {
          console.error("Error extracting audio URL:", error);
        }
      }

      const event = {
        scope,
        roomId,
        state,
        audioUrl,
      };

      if (scope === "global") {
        io.to("global").emit("music_state_changed", event);
      } else if (roomId) {
        io.to(`room:${roomId}`).emit("music_state_changed", event);
      }
    };

    // Helper to check DM role
    const requireDM = (
      callback?: (response: { error: string }) => void,
    ): boolean => {
      if (user.role !== "dm") {
        callback?.({ error: "Only DM can control music" });
        return false;
      }
      return true;
    };

    // Handle music play
    authSocket.on(
      "music_play",
      async (payload: MusicScopePayload, callback) => {
        try {
          if (!requireDM(callback)) return;

          const { scope, roomId } = payload;
          let state: MusicState;

          if (scope === "global") {
            state = playGlobalMusic();
          } else if (roomId) {
            state = playRoomMusic(roomId);
          } else {
            return callback?.({ error: "Room ID required for room scope" });
          }

          await broadcastMusicState(scope, roomId, state);
          console.log(`▶ ${user.username} started ${scope} music`);
          callback?.({ success: true, state });
        } catch (error) {
          console.error("Error playing music:", error);
          callback?.({ error: "Failed to play music" });
        }
      },
    );

    // Handle music pause
    authSocket.on("music_pause", (payload: MusicScopePayload, callback) => {
      try {
        if (!requireDM(callback)) return;

        const { scope, roomId } = payload;
        let state: MusicState;

        if (scope === "global") {
          state = pauseGlobalMusic();
        } else if (roomId) {
          state = pauseRoomMusic(roomId);
        } else {
          return callback?.({ error: "Room ID required for room scope" });
        }

        if (scope === "global") {
          io.to("global").emit("music_state_changed", { scope, state });
        } else if (roomId) {
          io.to(`room:${roomId}`).emit("music_state_changed", {
            scope,
            roomId,
            state,
          });
        }

        console.log(`⏸ ${user.username} paused ${scope} music`);
        callback?.({ success: true, state });
      } catch (error) {
        console.error("Error pausing music:", error);
        callback?.({ error: "Failed to pause music" });
      }
    });

    // Handle music skip
    authSocket.on(
      "music_skip",
      async (payload: MusicScopePayload, callback) => {
        try {
          if (!requireDM(callback)) return;

          const { scope, roomId } = payload;
          let state: MusicState;

          if (scope === "global") {
            state = skipGlobalTrack();
          } else if (roomId) {
            state = skipRoomTrack(roomId);
          } else {
            return callback?.({ error: "Room ID required for room scope" });
          }

          await broadcastMusicState(scope, roomId, state);
          console.log(`⏭ ${user.username} skipped to next ${scope} track`);
          callback?.({ success: true, state });
        } catch (error) {
          console.error("Error skipping track:", error);
          callback?.({ error: "Failed to skip track" });
        }
      },
    );

    // Handle adding song to queue
    authSocket.on("music_add", async (payload: MusicAddPayload, callback) => {
      try {
        if (!requireDM(callback)) return;

        const { youtubeUrl, scope, roomId } = payload;

        // Validate URL
        if (!validateYouTubeUrl(youtubeUrl)) {
          return callback?.({ error: "Invalid YouTube URL" });
        }

        // Get video info
        let videoInfo;
        try {
          videoInfo = await getVideoInfo(youtubeUrl);
        } catch (error) {
          return callback?.({ error: "Failed to get video info" });
        }

        const track: MusicTrack = {
          id: generateTrackId(),
          youtubeUrl,
          title: videoInfo.title,
          duration: videoInfo.duration,
          thumbnailUrl: videoInfo.thumbnailUrl,
          addedBy: user.id,
          addedByUsername: user.username,
        };

        let state: MusicState;
        let shouldAutoPlay = false;

        if (scope === "global") {
          const currentState = getGlobalMusicState();
          shouldAutoPlay = !currentState.currentTrack;
          state = addToGlobalQueue(track);
        } else if (roomId) {
          const currentState = getRoomMusicState(roomId);
          shouldAutoPlay = !currentState?.currentTrack;
          state = addToRoomQueue(roomId, track);
        } else {
          return callback?.({ error: "Room ID required for room scope" });
        }

        // If nothing was playing, auto-start the added track
        if (shouldAutoPlay) {
          if (scope === "global") {
            state = playGlobalMusic();
          } else if (roomId) {
            state = playRoomMusic(roomId);
          }

          // Get audio URL for immediate playback
          let audioUrl: string | undefined;
          try {
            const audioInfo = await extractAudioUrl(youtubeUrl);
            audioUrl = audioInfo.audioUrl;
          } catch (error) {
            console.error("Error extracting audio URL:", error);
          }

          // Broadcast state change (includes currentTrack)
          const stateEvent = { scope, roomId, state, audioUrl };
          if (scope === "global") {
            io.to("global").emit("music_state_changed", stateEvent);
          } else if (roomId) {
            io.to(`room:${roomId}`).emit("music_state_changed", stateEvent);
          }

          console.log(
            `▶️ Auto-playing "${track.title}" (${scope} was empty)`,
          );
        } else {
          // Broadcast queue update only
          const queueEvent = { scope, roomId, queue: state.queue };
          if (scope === "global") {
            io.to("global").emit("music_queue_updated", queueEvent);
          } else if (roomId) {
            io.to(`room:${roomId}`).emit("music_queue_updated", queueEvent);
          }
        }

        console.log(
          `➕ ${user.username} added "${track.title}" to ${scope} queue`,
        );
        callback?.({ success: true, track, state });
      } catch (error) {
        console.error("Error adding to queue:", error);
        callback?.({ error: "Failed to add song to queue" });
      }
    });

    // Handle removing song from queue
    authSocket.on("music_remove", (payload: MusicRemovePayload, callback) => {
      try {
        if (!requireDM(callback)) return;

        const { trackId, scope, roomId } = payload;
        let state: MusicState;

        if (scope === "global") {
          state = removeFromGlobalQueue(trackId);
        } else if (roomId) {
          state = removeFromRoomQueue(roomId, trackId);
        } else {
          return callback?.({ error: "Room ID required for room scope" });
        }

        // Broadcast queue update
        const queueEvent = { scope, roomId, queue: state.queue };
        if (scope === "global") {
          io.to("global").emit("music_queue_updated", queueEvent);
        } else if (roomId) {
          io.to(`room:${roomId}`).emit("music_queue_updated", queueEvent);
        }

        console.log(`➖ ${user.username} removed track from ${scope} queue`);
        callback?.({ success: true, state });
      } catch (error) {
        console.error("Error removing from queue:", error);
        callback?.({ error: "Failed to remove song from queue" });
      }
    });

    // Handle seek
    authSocket.on("music_seek", (payload: MusicSeekPayload, callback) => {
      try {
        if (!requireDM(callback)) return;

        const { position, scope, roomId } = payload;
        let state: MusicState;

        if (scope === "global") {
          state = seekGlobalMusic(position);
        } else if (roomId) {
          state = seekRoomMusic(roomId, position);
        } else {
          return callback?.({ error: "Room ID required for room scope" });
        }

        if (scope === "global") {
          io.to("global").emit("music_state_changed", { scope, state });
        } else if (roomId) {
          io.to(`room:${roomId}`).emit("music_state_changed", {
            scope,
            roomId,
            state,
          });
        }

        callback?.({ success: true, state });
      } catch (error) {
        console.error("Error seeking:", error);
        callback?.({ error: "Failed to seek" });
      }
    });

    // Handle volume change
    authSocket.on("music_volume", (payload: MusicVolumePayload, callback) => {
      try {
        if (!requireDM(callback)) return;

        const { volume, scope, roomId } = payload;
        let state: MusicState;

        if (scope === "global") {
          state = setGlobalVolume(volume);
        } else if (roomId) {
          state = setRoomVolume(roomId, volume);
        } else {
          return callback?.({ error: "Room ID required for room scope" });
        }

        if (scope === "global") {
          io.to("global").emit("music_state_changed", { scope, state });
        } else if (roomId) {
          io.to(`room:${roomId}`).emit("music_state_changed", {
            scope,
            roomId,
            state,
          });
        }

        callback?.({ success: true, state });
      } catch (error) {
        console.error("Error setting volume:", error);
        callback?.({ error: "Failed to set volume" });
      }
    });

    // Get current music state (any user can request)
    authSocket.on(
      "music_get_state",
      async (payload: { roomId?: number }, callback) => {
        try {
          const { roomId } = payload;
          const effective = getEffectiveMusicState(roomId ?? null);

          let audioUrl: string | undefined;
          if (effective.state.currentTrack) {
            try {
              const audioInfo = await extractAudioUrl(
                effective.state.currentTrack.youtubeUrl,
              );
              audioUrl = audioInfo.audioUrl;
            } catch (error) {
              console.error("Error extracting audio URL:", error);
            }
          }

          callback?.({
            success: true,
            scope: effective.scope,
            roomId: effective.roomId,
            state: effective.state,
            audioUrl,
          });
        } catch (error) {
          console.error("Error getting music state:", error);
          callback?.({ error: "Failed to get music state" });
        }
      },
    );

    // Sync request (any user can request)
    authSocket.on(
      "music_sync",
      (payload: { scope: "global" | "room"; roomId?: number }, callback) => {
        try {
          const { scope, roomId } = payload;
          let state: MusicState | null;

          if (scope === "global") {
            state = getGlobalMusicState();
          } else if (roomId) {
            state = getRoomMusicState(roomId);
          } else {
            return callback?.({ error: "Room ID required for room scope" });
          }

          if (!state) {
            return callback?.({ error: "No music state found" });
          }

          callback?.({
            success: true,
            isPlaying: state.isPlaying,
            startedAt: state.startedAt,
            pausedAt: state.pausedAt,
            currentPosition: getCurrentPosition(state),
          });
        } catch (error) {
          console.error("Error syncing music:", error);
          callback?.({ error: "Failed to sync music" });
        }
      },
    );

    // ==================== End Music Events ====================

    // Handle disconnect
    authSocket.on("disconnect", () => {
      console.log(`✗ User disconnected: ${user.username} (ID: ${user.id})`);

      // Clean up voice channel membership
      const voiceRoomsLeft = removeUserFromAllVoice(user.id);
      for (const roomId of voiceRoomsLeft) {
        io.to(`room:${roomId}`).emit("voice_user_left", {
          roomId,
          userId: user.id,
          username: user.username,
        });
        console.log(
          `✗ ${user.username} disconnected from voice in room ${roomId}`,
        );
      }

      // Clean up room membership
      const currentRoomId = userCurrentRoom.get(user.id);
      if (currentRoomId !== null && currentRoomId !== undefined) {
        const currentRoomUsers = roomUsers.get(currentRoomId);
        if (currentRoomUsers) {
          currentRoomUsers.delete(user.id);
          if (currentRoomUsers.size === 0) {
            roomUsers.delete(currentRoomId);
          }
        }

        // Notify others in the room
        io.to(`room:${currentRoomId}`).emit("user_left_room", {
          userId: user.id,
          username: user.username,
          roomId: currentRoomId,
        });
      }

      userCurrentRoom.delete(user.id);
      connectedUsers.delete(user.id);

      io.to("global").emit("user_left", {
        userId: user.id,
        username: user.username,
      });
    });
  });

  return io;
}

export function getConnectedUsers(): Map<number, AuthenticatedSocket> {
  return connectedUsers;
}
