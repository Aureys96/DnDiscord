import { useEffect, useState } from "react";
import { Crown, User, Plus, MessageSquare, X } from "lucide-react";
import { useDMStore } from "../../../stores/dmStore";
import type { Conversation, User as UserType } from "@dnd-voice/shared";

interface ConversationListProps {
  onSelectConversation: (conversation: Conversation) => void;
}

export function ConversationList({
  onSelectConversation,
}: ConversationListProps) {
  const {
    conversations,
    currentConversation,
    users,
    isLoading,
    totalUnreadCount,
    fetchConversations,
    fetchUsers,
    startConversation,
    setCurrentConversation,
  } = useDMStore();

  const [showNewDMModal, setShowNewDMModal] = useState(false);

  useEffect(() => {
    fetchConversations();
    fetchUsers();
  }, [fetchConversations, fetchUsers]);

  const handleSelectConversation = (conversation: Conversation) => {
    setCurrentConversation(conversation);
    onSelectConversation(conversation);
  };

  const handleStartNewDM = async (selectedUser: UserType) => {
    const conversation = await startConversation(selectedUser.id);
    if (conversation) {
      setCurrentConversation(conversation);
      onSelectConversation(conversation);
    }
    setShowNewDMModal(false);
  };

  // Filter out users we already have conversations with
  const availableUsers = users.filter(
    (u) => !conversations.some((c) => c.otherUserId === u.id),
  );

  return (
    <div className="flex flex-col h-full bg-gray-800">
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-200">
              Direct Messages
            </span>
            {totalUnreadCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-red-500 text-white rounded-full">
                {totalUnreadCount}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowNewDMModal(true)}
            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
            title="New Direct Message"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            Loading...
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No conversations yet.
            <br />
            <button
              onClick={() => setShowNewDMModal(true)}
              className="text-violet-400 hover:text-violet-300 mt-1"
            >
              Start a new message
            </button>
          </div>
        ) : (
          <div className="py-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation)}
                className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-700 transition-colors ${
                  currentConversation?.id === conversation.id
                    ? "bg-gray-700"
                    : ""
                }`}
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                    {conversation.otherRole === "dm" ? (
                      <Crown className="w-4 h-4 text-amber-500" />
                    ) : (
                      <User className="w-4 h-4 text-violet-400" />
                    )}
                  </div>
                  {/* Unread indicator */}
                  {(conversation.unreadCount || 0) > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">
                        {conversation.unreadCount! > 9
                          ? "9+"
                          : conversation.unreadCount}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-sm font-medium truncate ${
                        conversation.otherRole === "dm"
                          ? "text-amber-500"
                          : "text-gray-200"
                      }`}
                    >
                      {conversation.otherUsername}
                    </span>
                  </div>
                  {conversation.lastMessage && (
                    <p className="text-xs text-gray-400 truncate">
                      {conversation.lastMessage}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New DM Modal */}
      {showNewDMModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-gray-100">
                New Direct Message
              </h2>
              <button
                onClick={() => setShowNewDMModal(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto">
              {availableUsers.length === 0 ? (
                <p className="text-gray-400 text-center py-4">
                  No other users available
                </p>
              ) : (
                <div className="space-y-1">
                  {availableUsers.map((availableUser) => (
                    <button
                      key={availableUser.id}
                      onClick={() => handleStartNewDM(availableUser)}
                      className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-700 rounded transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                        {availableUser.role === "dm" ? (
                          <Crown className="w-4 h-4 text-amber-500" />
                        ) : (
                          <User className="w-4 h-4 text-violet-400" />
                        )}
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          availableUser.role === "dm"
                            ? "text-amber-500"
                            : "text-gray-200"
                        }`}
                      >
                        {availableUser.username}
                      </span>
                      <span className="text-xs text-gray-500 ml-auto">
                        {availableUser.role === "dm"
                          ? "Dungeon Master"
                          : "Player"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
