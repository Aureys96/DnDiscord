import { useEffect } from 'react';
import { Loader2, AlertCircle, WifiOff, Hash, Globe } from 'lucide-react';
import { useChatStore } from '../../../stores/chatStore';
import { useRoomStore } from '../../../stores/roomStore';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

interface ChatContainerProps {
  roomId?: number | null;
}

export function ChatContainer({ roomId }: ChatContainerProps) {
  const {
    messages,
    currentRoomId,
    isConnected,
    isConnecting,
    typingUsers,
    error,
    connect,
    sendMessage,
    setTyping,
    setCurrentRoom,
    clearError,
  } = useChatStore();

  const { rooms } = useRoomStore();

  // Get current room info
  const currentRoom = currentRoomId ? rooms.find((r) => r.id === currentRoomId) : null;

  // Connect to socket when component mounts
  useEffect(() => {
    connect();

    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, [connect]);

  // Sync room from props to store
  useEffect(() => {
    if (roomId !== undefined && roomId !== currentRoomId) {
      setCurrentRoom(roomId);
    }
  }, [roomId, currentRoomId, setCurrentRoom]);

  // Connection status indicator
  const renderConnectionStatus = () => {
    if (isConnecting) {
      return (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Connecting to chat server...
        </div>
      );
    }

    if (!isConnected) {
      return (
        <div className="flex items-center justify-between px-4 py-2 bg-red-500/10 text-red-400 text-sm">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            Disconnected from chat server
          </div>
          <button
            onClick={connect}
            className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-xs transition-colors"
          >
            Reconnect
          </button>
        </div>
      );
    }

    return null;
  };

  // Error display
  const renderError = () => {
    if (!error) return null;

    return (
      <div className="flex items-center justify-between px-4 py-2 bg-red-500/10 text-red-400 text-sm">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
        <button
          onClick={clearError}
          className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-xs transition-colors"
        >
          Dismiss
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
        {currentRoom ? (
          <>
            <Hash className="w-5 h-5 text-violet-400" />
            <h2 className="font-medium text-gray-100">{currentRoom.name}</h2>
          </>
        ) : (
          <>
            <Globe className="w-5 h-5 text-violet-400" />
            <h2 className="font-medium text-gray-100">Global Chat</h2>
          </>
        )}
        {isConnected && (
          <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
            <span className="w-2 h-2 bg-emerald-400 rounded-full" />
            Connected
          </span>
        )}
      </div>

      {/* Connection status / Error */}
      {renderConnectionStatus()}
      {renderError()}

      {/* Messages */}
      <MessageList messages={messages} typingUsers={typingUsers} />

      {/* Input */}
      <ChatInput
        onSendMessage={sendMessage}
        onTypingChange={setTyping}
        disabled={!isConnected}
        placeholder={isConnected ? 'Type a message...' : 'Connecting...'}
      />
    </div>
  );
}
