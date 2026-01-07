import { useEffect, useRef, useState, useCallback } from "react";
import { Crown, User, Send, ArrowLeft } from "lucide-react";
import { useDMStore } from "../../../stores/dmStore";
import { useAuthStore } from "../../../stores/authStore";
import {
  getSocket,
  sendDM,
  emitDMTypingStart,
  emitDMTypingStop,
  type DMTypingEvent,
} from "../../../lib/socket";
import type { Conversation } from "@dnd-voice/shared";

// Local DMMessage interface for socket events (with string userRole)
interface SocketDMMessage {
  id: number;
  userId: number;
  recipientId: number;
  content: string;
  timestamp: string;
  type: "dm";
  username: string;
  userRole: string;
}

interface DMChatProps {
  conversation: Conversation;
  onBack: () => void;
}

export function DMChat({ conversation, onBack }: DMChatProps) {
  const { user } = useAuthStore();
  const {
    messages,
    typingUser,
    isLoadingMessages,
    fetchMessages,
    addMessage,
    setTypingUser,
    markAsRead,
  } = useDMStore();

  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (conversation.otherUserId) {
      fetchMessages(conversation.otherUserId);
      markAsRead(conversation.otherUserId);
    }
  }, [conversation.otherUserId, fetchMessages, markAsRead]);

  // Set up socket listeners for DMs
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewDM = (message: SocketDMMessage) => {
      // Only add if it's for this conversation
      if (
        message.userId === conversation.otherUserId ||
        message.recipientId === conversation.otherUserId
      ) {
        addMessage(message);
        // Mark as read if we're viewing this conversation
        if (message.userId === conversation.otherUserId) {
          markAsRead(conversation.otherUserId);
        }
      }
    };

    const handleTyping = (data: DMTypingEvent) => {
      if (data.userId === conversation.otherUserId) {
        setTypingUser(data);
        // Clear typing after 3 seconds
        setTimeout(() => {
          setTypingUser(null);
        }, 3000);
      }
    };

    const handleStoppedTyping = (data: { userId: number }) => {
      if (data.userId === conversation.otherUserId) {
        setTypingUser(null);
      }
    };

    socket.on("new_dm", handleNewDM);
    socket.on("dm_user_typing", handleTyping);
    socket.on("dm_user_stopped_typing", handleStoppedTyping);

    return () => {
      socket.off("new_dm", handleNewDM);
      socket.off("dm_user_typing", handleTyping);
      socket.off("dm_user_stopped_typing", handleStoppedTyping);
    };
  }, [conversation.otherUserId, addMessage, setTypingUser, markAsRead]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleTypingIndicator = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emitDMTypingStart(conversation.otherUserId!);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      emitDMTypingStop(conversation.otherUserId!);
    }, 2000);
  }, [conversation.otherUserId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;

    const content = inputValue.trim();
    setInputValue("");
    setIsSending(true);

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
    emitDMTypingStop(conversation.otherUserId!);

    try {
      const result = await sendDM(conversation.otherUserId!, content);
      if (!result.success) {
        console.error("Failed to send DM:", result.error);
        setInputValue(content); // Restore message on failure
      }
    } catch (error) {
      console.error("Error sending DM:", error);
      setInputValue(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return (
      date.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors md:hidden"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
          {conversation.otherRole === "dm" ? (
            <Crown className="w-4 h-4 text-amber-500" />
          ) : (
            <User className="w-4 h-4 text-violet-400" />
          )}
        </div>
        <div>
          <h2
            className={`text-sm font-semibold ${
              conversation.otherRole === "dm"
                ? "text-amber-500"
                : "text-gray-100"
            }`}
          >
            {conversation.otherUsername}
          </h2>
          <p className="text-xs text-gray-500">
            {conversation.otherRole === "dm" ? "Dungeon Master" : "Player"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageIcon className="w-12 h-12 mb-3" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => {
              const isOwnMessage = message.userId === user?.id;
              const showAvatar =
                index === 0 || messages[index - 1]?.userId !== message.userId;

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : ""}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 flex-shrink-0 ${showAvatar ? "" : "invisible"}`}
                  >
                    {showAvatar && (
                      <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                        {(isOwnMessage
                          ? user?.role
                          : conversation.otherRole) === "dm" ? (
                          <Crown className="w-4 h-4 text-amber-500" />
                        ) : (
                          <User className="w-4 h-4 text-violet-400" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Message content */}
                  <div
                    className={`max-w-[70%] ${isOwnMessage ? "text-right" : ""}`}
                  >
                    {showAvatar && (
                      <div
                        className={`flex items-center gap-2 mb-1 ${isOwnMessage ? "justify-end" : ""}`}
                      >
                        <span
                          className={`text-xs font-medium ${
                            (isOwnMessage
                              ? user?.role
                              : conversation.otherRole) === "dm"
                              ? "text-amber-500"
                              : "text-violet-400"
                          }`}
                        >
                          {isOwnMessage
                            ? user?.username
                            : conversation.otherUsername}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(message.timestamp)}
                        </span>
                      </div>
                    )}
                    <div
                      className={`px-3 py-2 rounded-lg ${
                        isOwnMessage
                          ? "bg-violet-600 text-white"
                          : "bg-gray-700 text-gray-100"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Typing indicator */}
        {typingUser && (
          <div className="flex items-center gap-2 mt-2 text-gray-400">
            <div className="flex gap-1">
              <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <span className="text-xs">{typingUser.username} is typing...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-700">
        <div className="flex items-center gap-3">
          <textarea
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              handleTypingIndicator();
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${conversation.otherUsername}`}
            className="flex-1 bg-gray-700 text-gray-100 rounded-lg px-4 py-2 resize-none placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            rows={1}
            maxLength={2000}
            disabled={isSending}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isSending}
            className="p-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple message icon for empty state
function MessageIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}
