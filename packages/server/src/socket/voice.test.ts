import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";
import { createServer, Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import {
  clearAllVoiceState,
  getVoiceUsers,
  isUserInVoice,
  getUserVoiceRoom,
  addUserToVoice,
  removeUserFromVoice,
  removeUserFromAllVoice,
  updateUserMuteState,
  updateUserSpeakingState,
} from "./voiceChannels.js";

const JWT_SECRET = "test-secret-key";
const TEST_PORT = 3099;

// Track user's current room for room switching tests
const userCurrentRoom = new Map<number, number | null>();

// Minimal Socket.IO setup for voice testing (no database needed)
function setupTestSocketIO(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
  });

  // JWT authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: number;
        username: string;
        role: "dm" | "player";
      };
      (socket as any).user = {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role,
      };
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const user = (socket as any).user;

    // Join room event (for testing room switching)
    socket.on(
      "join_room",
      (
        { roomId }: { roomId: number },
        callback?: (response: { success: boolean }) => void,
      ) => {
        const currentRoomId = userCurrentRoom.get(user.id);

        // Auto-leave voice if in voice channel in old room
        if (
          currentRoomId !== null &&
          currentRoomId !== undefined &&
          currentRoomId !== roomId
        ) {
          const voiceRoomId = getUserVoiceRoom(user.id);
          if (voiceRoomId !== null && voiceRoomId === currentRoomId) {
            const removed = removeUserFromVoice(currentRoomId, user.id);
            if (removed) {
              socket.leave(`voice:${currentRoomId}`);
              io.to(`voice:${currentRoomId}`).emit("voice_user_left", {
                roomId: currentRoomId,
                userId: user.id,
                username: user.username,
              });
              // Also notify the user themselves
              socket.emit("voice_user_left", {
                roomId: currentRoomId,
                userId: user.id,
                username: user.username,
              });
            }
          }
          socket.leave(`room:${currentRoomId}`);
        }

        socket.join(`room:${roomId}`);
        userCurrentRoom.set(user.id, roomId);
        callback?.({ success: true });
      },
    );

    // Leave room event
    socket.on(
      "leave_room",
      (callback?: (response: { success: boolean }) => void) => {
        const currentRoomId = userCurrentRoom.get(user.id);
        if (currentRoomId !== null && currentRoomId !== undefined) {
          // Auto-leave voice if in voice channel
          const voiceRoomId = getUserVoiceRoom(user.id);
          if (voiceRoomId !== null && voiceRoomId === currentRoomId) {
            removeUserFromVoice(currentRoomId, user.id);
            socket.leave(`voice:${currentRoomId}`);
            io.to(`voice:${currentRoomId}`).emit("voice_user_left", {
              roomId: currentRoomId,
              userId: user.id,
            });
          }
          socket.leave(`room:${currentRoomId}`);
          userCurrentRoom.set(user.id, null);
        }
        callback?.({ success: true });
      },
    );

    // Voice join
    socket.on("voice_join", ({ roomId }: { roomId: number }) => {
      if (isUserInVoice(roomId, user.id)) {
        socket.emit("voice_joined", {
          success: false,
          error: "Already in voice channel",
        });
        return;
      }

      const existingUsers = getVoiceUsers(roomId);
      addUserToVoice(roomId, user.id, user.username, user.role);
      socket.join(`voice:${roomId}`);

      socket.emit("voice_joined", { success: true, voiceUsers: existingUsers });

      socket.to(`voice:${roomId}`).emit("voice_user_joined", {
        roomId,
        user: {
          userId: user.id,
          username: user.username,
          role: user.role,
          isMuted: false,
          isSpeaking: false,
        },
      });
    });

    // Voice leave
    socket.on("voice_leave", ({ roomId }: { roomId: number }) => {
      removeUserFromVoice(roomId, user.id);
      socket.leave(`voice:${roomId}`);
      socket.emit("voice_left", { success: true });
      socket
        .to(`voice:${roomId}`)
        .emit("voice_user_left", { roomId, userId: user.id });
    });

    // Voice offer relay
    socket.on(
      "voice_offer",
      ({ targetUserId, offer }: { targetUserId: number; offer: any }) => {
        const targetSocket = [...io.sockets.sockets.values()].find(
          (s) => (s as any).user?.id === targetUserId,
        );
        if (targetSocket) {
          targetSocket.emit("voice_offer", { fromUserId: user.id, offer });
        }
      },
    );

    // Voice answer relay
    socket.on(
      "voice_answer",
      ({ targetUserId, answer }: { targetUserId: number; answer: any }) => {
        const targetSocket = [...io.sockets.sockets.values()].find(
          (s) => (s as any).user?.id === targetUserId,
        );
        if (targetSocket) {
          targetSocket.emit("voice_answer", { fromUserId: user.id, answer });
        }
      },
    );

    // ICE candidate relay
    socket.on(
      "voice_ice_candidate",
      ({
        targetUserId,
        candidate,
      }: {
        targetUserId: number;
        candidate: any;
      }) => {
        const targetSocket = [...io.sockets.sockets.values()].find(
          (s) => (s as any).user?.id === targetUserId,
        );
        if (targetSocket) {
          targetSocket.emit("voice_ice_candidate", {
            fromUserId: user.id,
            candidate,
          });
        }
      },
    );

    // Voice state update
    socket.on(
      "voice_state_update",
      ({ roomId, isMuted }: { roomId: number; isMuted: boolean }) => {
        updateUserMuteState(roomId, user.id, isMuted);
        socket
          .to(`voice:${roomId}`)
          .emit("voice_state_changed", { roomId, userId: user.id, isMuted });
      },
    );

    // Voice speaking
    socket.on(
      "voice_speaking",
      ({ roomId, isSpeaking }: { roomId: number; isSpeaking: boolean }) => {
        updateUserSpeakingState(roomId, user.id, isSpeaking);
        socket.to(`voice:${roomId}`).emit("voice_speaking_changed", {
          roomId,
          userId: user.id,
          isSpeaking,
        });
      },
    );

    // Get voice users
    socket.on("voice_get_users", ({ roomId }: { roomId: number }) => {
      const voiceUsers = getVoiceUsers(roomId);
      socket.emit("voice_users", { success: true, voiceUsers });
    });

    // Cleanup on disconnect
    socket.on("disconnect", () => {
      const roomsLeft = removeUserFromAllVoice(user.id);
      for (const roomId of roomsLeft) {
        io.to(`voice:${roomId}`).emit("voice_user_left", {
          roomId,
          userId: user.id,
        });
      }
    });
  });

  return io;
}

describe("Voice Socket Events", () => {
  let httpServer: HTTPServer;
  let io: SocketIOServer;
  let clientSocket1: ClientSocket;
  let clientSocket2: ClientSocket;
  let clientSocket3: ClientSocket;

  // Test users
  const user1 = { userId: 1, username: "player1", role: "player" as const };
  const user2 = { userId: 2, username: "player2", role: "player" as const };
  const user3 = { userId: 3, username: "dungeonmaster", role: "dm" as const };

  const createToken = (user: {
    userId: number;
    username: string;
    role: "dm" | "player";
  }) => {
    return jwt.sign(user, JWT_SECRET);
  };

  const connectClient = (token: string): Promise<ClientSocket> => {
    return new Promise((resolve, reject) => {
      const socket = ioClient(`http://localhost:${TEST_PORT}`, {
        auth: { token },
        transports: ["websocket"],
        forceNew: true,
      });

      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", (err) => reject(err));

      // Timeout after 5 seconds
      setTimeout(() => reject(new Error("Connection timeout")), 5000);
    });
  };

  const waitForEvent = <T>(
    socket: ClientSocket,
    event: string,
    timeout = 2000,
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timeout waiting for ${event}`)),
        timeout,
      );
      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;

    // Create HTTP server and Socket.IO
    httpServer = createServer();
    io = setupTestSocketIO(httpServer);

    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(TEST_PORT, resolve);
    });
  });

  afterAll(async () => {
    // Disconnect all clients
    if (clientSocket1?.connected) clientSocket1.disconnect();
    if (clientSocket2?.connected) clientSocket2.disconnect();
    if (clientSocket3?.connected) clientSocket3.disconnect();

    // Close server
    io.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(() => {
    // Clear voice state between tests
    clearAllVoiceState();
    userCurrentRoom.clear();

    // Disconnect any connected clients
    if (clientSocket1?.connected) clientSocket1.disconnect();
    if (clientSocket2?.connected) clientSocket2.disconnect();
    if (clientSocket3?.connected) clientSocket3.disconnect();
  });

  describe("voice_join", () => {
    it("should allow user to join voice channel", async () => {
      clientSocket1 = await connectClient(createToken(user1));

      const responsePromise = waitForEvent<{
        success: boolean;
        voiceUsers: unknown[];
      }>(clientSocket1, "voice_joined");

      clientSocket1.emit("voice_join", { roomId: 100 });

      const response = await responsePromise;

      expect(response.success).toBe(true);
      expect(response.voiceUsers).toBeDefined();
      expect(isUserInVoice(100, user1.userId)).toBe(true);
    });

    it("should return existing users when joining", async () => {
      clientSocket1 = await connectClient(createToken(user1));
      clientSocket2 = await connectClient(createToken(user2));

      // User 1 joins first
      const join1Promise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await join1Promise;

      // User 2 joins and should see User 1
      const join2Promise = waitForEvent<{
        success: boolean;
        voiceUsers: unknown[];
      }>(clientSocket2, "voice_joined");
      clientSocket2.emit("voice_join", { roomId: 100 });

      const response = await join2Promise;

      expect(response.success).toBe(true);
      expect(response.voiceUsers.length).toBe(1);
    });

    it("should broadcast voice_user_joined to other users in room", async () => {
      clientSocket1 = await connectClient(createToken(user1));
      clientSocket2 = await connectClient(createToken(user2));

      // User 1 joins first
      const join1Promise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await join1Promise;

      // Set up listener for broadcast
      const broadcastPromise = waitForEvent<{
        roomId: number;
        user: { userId: number };
      }>(clientSocket1, "voice_user_joined");

      // User 2 joins
      clientSocket2.emit("voice_join", { roomId: 100 });

      const broadcast = await broadcastPromise;

      expect(broadcast.roomId).toBe(100);
      expect(broadcast.user.userId).toBe(user2.userId);
    });

    it("should not join if already in voice in same room", async () => {
      clientSocket1 = await connectClient(createToken(user1));

      // Join first time
      const join1Promise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await join1Promise;

      // Try to join again
      const join2Promise = waitForEvent<{ success: boolean; error?: string }>(
        clientSocket1,
        "voice_joined",
      );
      clientSocket1.emit("voice_join", { roomId: 100 });

      const response = await join2Promise;

      expect(response.success).toBe(false);
      expect(response.error?.toLowerCase()).toContain("already in voice");
    });
  });

  describe("voice_leave", () => {
    it("should allow user to leave voice channel", async () => {
      clientSocket1 = await connectClient(createToken(user1));

      // Join first
      const joinPromise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await joinPromise;

      expect(isUserInVoice(100, user1.userId)).toBe(true);

      // Leave
      const leavePromise = waitForEvent<{ success: boolean }>(
        clientSocket1,
        "voice_left",
      );
      clientSocket1.emit("voice_leave", { roomId: 100 });

      const response = await leavePromise;

      expect(response.success).toBe(true);
      expect(isUserInVoice(100, user1.userId)).toBe(false);
    });

    it("should broadcast voice_user_left to other users in room", async () => {
      clientSocket1 = await connectClient(createToken(user1));
      clientSocket2 = await connectClient(createToken(user2));

      // Both join
      const join1Promise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await join1Promise;

      const join2Promise = waitForEvent(clientSocket2, "voice_joined");
      clientSocket2.emit("voice_join", { roomId: 100 });
      await join2Promise;

      // Set up listener for broadcast on client 2
      const broadcastPromise = waitForEvent<{ roomId: number; userId: number }>(
        clientSocket2,
        "voice_user_left",
      );

      // User 1 leaves
      clientSocket1.emit("voice_leave", { roomId: 100 });

      const broadcast = await broadcastPromise;

      expect(broadcast.roomId).toBe(100);
      expect(broadcast.userId).toBe(user1.userId);
    });
  });

  describe("voice_offer", () => {
    it("should relay offer to target user", async () => {
      clientSocket1 = await connectClient(createToken(user1));
      clientSocket2 = await connectClient(createToken(user2));

      // Both join voice
      const join1Promise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await join1Promise;

      const join2Promise = waitForEvent(clientSocket2, "voice_joined");
      clientSocket2.emit("voice_join", { roomId: 100 });
      await join2Promise;

      // Set up listener on client 2
      const offerPromise = waitForEvent<{
        fromUserId: number;
        offer: { type: string; sdp: string };
      }>(clientSocket2, "voice_offer");

      // Client 1 sends offer to client 2
      clientSocket1.emit("voice_offer", {
        targetUserId: user2.userId,
        offer: { type: "offer", sdp: "test-sdp-offer" },
      });

      const receivedOffer = await offerPromise;

      expect(receivedOffer.fromUserId).toBe(user1.userId);
      expect(receivedOffer.offer.type).toBe("offer");
      expect(receivedOffer.offer.sdp).toBe("test-sdp-offer");
    });
  });

  describe("voice_answer", () => {
    it("should relay answer to target user", async () => {
      clientSocket1 = await connectClient(createToken(user1));
      clientSocket2 = await connectClient(createToken(user2));

      // Both join voice
      const join1Promise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await join1Promise;

      const join2Promise = waitForEvent(clientSocket2, "voice_joined");
      clientSocket2.emit("voice_join", { roomId: 100 });
      await join2Promise;

      // Set up listener on client 1
      const answerPromise = waitForEvent<{
        fromUserId: number;
        answer: { type: string; sdp: string };
      }>(clientSocket1, "voice_answer");

      // Client 2 sends answer to client 1
      clientSocket2.emit("voice_answer", {
        targetUserId: user1.userId,
        answer: { type: "answer", sdp: "test-sdp-answer" },
      });

      const receivedAnswer = await answerPromise;

      expect(receivedAnswer.fromUserId).toBe(user2.userId);
      expect(receivedAnswer.answer.type).toBe("answer");
      expect(receivedAnswer.answer.sdp).toBe("test-sdp-answer");
    });
  });

  describe("voice_ice_candidate", () => {
    it("should relay ICE candidate to target user", async () => {
      clientSocket1 = await connectClient(createToken(user1));
      clientSocket2 = await connectClient(createToken(user2));

      // Both join voice
      const join1Promise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await join1Promise;

      const join2Promise = waitForEvent(clientSocket2, "voice_joined");
      clientSocket2.emit("voice_join", { roomId: 100 });
      await join2Promise;

      // Set up listener on client 2
      const candidatePromise = waitForEvent<{
        fromUserId: number;
        candidate: { candidate: string };
      }>(clientSocket2, "voice_ice_candidate");

      // Client 1 sends ICE candidate to client 2
      clientSocket1.emit("voice_ice_candidate", {
        targetUserId: user2.userId,
        candidate: {
          candidate: "test-ice-candidate",
          sdpMid: "0",
          sdpMLineIndex: 0,
        },
      });

      const receivedCandidate = await candidatePromise;

      expect(receivedCandidate.fromUserId).toBe(user1.userId);
      expect(receivedCandidate.candidate.candidate).toBe("test-ice-candidate");
    });
  });

  describe("voice_state_update", () => {
    it("should broadcast mute state change", async () => {
      clientSocket1 = await connectClient(createToken(user1));
      clientSocket2 = await connectClient(createToken(user2));

      // Both join voice
      const join1Promise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await join1Promise;

      const join2Promise = waitForEvent(clientSocket2, "voice_joined");
      clientSocket2.emit("voice_join", { roomId: 100 });
      await join2Promise;

      // Set up listener on client 2
      const stateChangePromise = waitForEvent<{
        roomId: number;
        userId: number;
        isMuted: boolean;
      }>(clientSocket2, "voice_state_changed");

      // Client 1 mutes
      clientSocket1.emit("voice_state_update", { roomId: 100, isMuted: true });

      const stateChange = await stateChangePromise;

      expect(stateChange.roomId).toBe(100);
      expect(stateChange.userId).toBe(user1.userId);
      expect(stateChange.isMuted).toBe(true);
    });
  });

  describe("voice_speaking", () => {
    it("should broadcast speaking state change", async () => {
      clientSocket1 = await connectClient(createToken(user1));
      clientSocket2 = await connectClient(createToken(user2));

      // Both join voice
      const join1Promise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await join1Promise;

      const join2Promise = waitForEvent(clientSocket2, "voice_joined");
      clientSocket2.emit("voice_join", { roomId: 100 });
      await join2Promise;

      // Set up listener on client 2
      const speakingPromise = waitForEvent<{
        roomId: number;
        userId: number;
        isSpeaking: boolean;
      }>(clientSocket2, "voice_speaking_changed");

      // Client 1 starts speaking
      clientSocket1.emit("voice_speaking", { roomId: 100, isSpeaking: true });

      const speaking = await speakingPromise;

      expect(speaking.roomId).toBe(100);
      expect(speaking.userId).toBe(user1.userId);
      expect(speaking.isSpeaking).toBe(true);
    });
  });

  describe("voice_get_users", () => {
    it("should return list of voice users in room", async () => {
      clientSocket1 = await connectClient(createToken(user1));
      clientSocket2 = await connectClient(createToken(user2));
      clientSocket3 = await connectClient(createToken(user3));

      // All three join voice
      const join1Promise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await join1Promise;

      const join2Promise = waitForEvent(clientSocket2, "voice_joined");
      clientSocket2.emit("voice_join", { roomId: 100 });
      await join2Promise;

      const join3Promise = waitForEvent(clientSocket3, "voice_joined");
      clientSocket3.emit("voice_join", { roomId: 100 });
      await join3Promise;

      // Request user list
      const usersPromise = waitForEvent<{
        success: boolean;
        voiceUsers: unknown[];
      }>(clientSocket1, "voice_users");
      clientSocket1.emit("voice_get_users", { roomId: 100 });

      const response = await usersPromise;

      expect(response.success).toBe(true);
      expect(response.voiceUsers.length).toBe(3);
    });
  });

  describe("disconnect cleanup", () => {
    it("should remove user from voice on disconnect", async () => {
      clientSocket1 = await connectClient(createToken(user1));
      clientSocket2 = await connectClient(createToken(user2));

      // Both join voice
      const join1Promise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await join1Promise;

      const join2Promise = waitForEvent(clientSocket2, "voice_joined");
      clientSocket2.emit("voice_join", { roomId: 100 });
      await join2Promise;

      expect(getVoiceUsers(100).length).toBe(2);

      // Set up listener for user left broadcast
      const leftPromise = waitForEvent<{ roomId: number; userId: number }>(
        clientSocket2,
        "voice_user_left",
      );

      // Disconnect client 1
      clientSocket1.disconnect();

      const leftEvent = await leftPromise;

      expect(leftEvent.roomId).toBe(100);
      expect(leftEvent.userId).toBe(user1.userId);
      expect(getVoiceUsers(100).length).toBe(1);
      expect(isUserInVoice(100, user1.userId)).toBe(false);
    });
  });

  describe("room audio isolation", () => {
    it("should auto-leave voice when switching rooms", async () => {
      clientSocket1 = await connectClient(createToken(user1));

      // Join room 100
      const joinRoomPromise = new Promise<void>((resolve) => {
        clientSocket1.emit("join_room", { roomId: 100 }, () => resolve());
      });
      await joinRoomPromise;

      // Join voice in room 100
      const joinVoicePromise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await joinVoicePromise;

      expect(isUserInVoice(100, user1.userId)).toBe(true);
      expect(getUserVoiceRoom(user1.userId)).toBe(100);

      // Listen for voice_user_left event when switching rooms
      const voiceLeftPromise = waitForEvent<{ roomId: number; userId: number }>(
        clientSocket1,
        "voice_user_left",
      );

      // Switch to room 200
      const switchRoomPromise = new Promise<void>((resolve) => {
        clientSocket1.emit("join_room", { roomId: 200 }, () => resolve());
      });
      await switchRoomPromise;

      // Should receive voice_user_left event
      const leftEvent = await voiceLeftPromise;
      expect(leftEvent.roomId).toBe(100);
      expect(leftEvent.userId).toBe(user1.userId);

      // Verify user is no longer in voice
      expect(isUserInVoice(100, user1.userId)).toBe(false);
      expect(getUserVoiceRoom(user1.userId)).toBeNull();
    });

    it("should notify other users when someone auto-leaves voice due to room switch", async () => {
      clientSocket1 = await connectClient(createToken(user1));
      clientSocket2 = await connectClient(createToken(user2));

      // Both join room 100
      await new Promise<void>((resolve) => {
        clientSocket1.emit("join_room", { roomId: 100 }, () => resolve());
      });
      await new Promise<void>((resolve) => {
        clientSocket2.emit("join_room", { roomId: 100 }, () => resolve());
      });

      // Both join voice in room 100
      const join1Promise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await join1Promise;

      const join2Promise = waitForEvent(clientSocket2, "voice_joined");
      clientSocket2.emit("voice_join", { roomId: 100 });
      await join2Promise;

      expect(getVoiceUsers(100).length).toBe(2);

      // User2 listens for user1 leaving
      const voiceLeftPromise = waitForEvent<{ roomId: number; userId: number }>(
        clientSocket2,
        "voice_user_left",
      );

      // User1 switches to room 200
      await new Promise<void>((resolve) => {
        clientSocket1.emit("join_room", { roomId: 200 }, () => resolve());
      });

      // User2 should receive notification that user1 left voice
      const leftEvent = await voiceLeftPromise;
      expect(leftEvent.roomId).toBe(100);
      expect(leftEvent.userId).toBe(user1.userId);

      // Only user2 should remain in voice
      expect(getVoiceUsers(100).length).toBe(1);
      expect(isUserInVoice(100, user2.userId)).toBe(true);
      expect(isUserInVoice(100, user1.userId)).toBe(false);
    });

    it("should not affect voice when staying in same room", async () => {
      clientSocket1 = await connectClient(createToken(user1));

      // Join room 100
      await new Promise<void>((resolve) => {
        clientSocket1.emit("join_room", { roomId: 100 }, () => resolve());
      });

      // Join voice
      const joinVoicePromise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await joinVoicePromise;

      expect(isUserInVoice(100, user1.userId)).toBe(true);

      // "Rejoin" same room (should not trigger voice leave)
      await new Promise<void>((resolve) => {
        clientSocket1.emit("join_room", { roomId: 100 }, () => resolve());
      });

      // Should still be in voice
      expect(isUserInVoice(100, user1.userId)).toBe(true);
      expect(getUserVoiceRoom(user1.userId)).toBe(100);
    });

    it("should auto-leave voice when leaving room entirely", async () => {
      clientSocket1 = await connectClient(createToken(user1));

      // Join room 100
      await new Promise<void>((resolve) => {
        clientSocket1.emit("join_room", { roomId: 100 }, () => resolve());
      });

      // Join voice
      const joinVoicePromise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await joinVoicePromise;

      expect(isUserInVoice(100, user1.userId)).toBe(true);

      // Leave room entirely
      await new Promise<void>((resolve) => {
        clientSocket1.emit("leave_room", () => resolve());
      });

      // Should no longer be in voice
      expect(isUserInVoice(100, user1.userId)).toBe(false);
      expect(getUserVoiceRoom(user1.userId)).toBeNull();
    });

    it("should keep voice users isolated between rooms", async () => {
      clientSocket1 = await connectClient(createToken(user1));
      clientSocket2 = await connectClient(createToken(user2));

      // User1 joins room 100 and voice
      await new Promise<void>((resolve) => {
        clientSocket1.emit("join_room", { roomId: 100 }, () => resolve());
      });
      const join1Promise = waitForEvent(clientSocket1, "voice_joined");
      clientSocket1.emit("voice_join", { roomId: 100 });
      await join1Promise;

      // User2 joins room 200 and voice
      await new Promise<void>((resolve) => {
        clientSocket2.emit("join_room", { roomId: 200 }, () => resolve());
      });
      const join2Promise = waitForEvent(clientSocket2, "voice_joined");
      clientSocket2.emit("voice_join", { roomId: 200 });
      await join2Promise;

      // Verify voice isolation
      expect(getUserVoiceRoom(user1.userId)).toBe(100);
      expect(getUserVoiceRoom(user2.userId)).toBe(200);
      expect(getVoiceUsers(100).length).toBe(1);
      expect(getVoiceUsers(200).length).toBe(1);
      expect(isUserInVoice(100, user1.userId)).toBe(true);
      expect(isUserInVoice(100, user2.userId)).toBe(false);
      expect(isUserInVoice(200, user1.userId)).toBe(false);
      expect(isUserInVoice(200, user2.userId)).toBe(true);
    });
  });
});
