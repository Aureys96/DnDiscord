import { useState } from 'react';
import { Crown, User, LogOut } from 'lucide-react';
import { Button } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useRoomStore } from '../stores/roomStore';
import { ChatContainer } from '../components/features/chat';
import { RoomList } from '../components/features/rooms';

export function HomePage() {
  const { user, logout } = useAuthStore();
  const { setCurrentRoom } = useChatStore();
  const { joinRoom, leaveRoom } = useRoomStore();
  const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);

  if (!user) return null;

  const isDM = user.role === 'dm';

  const handleRoomSelect = async (roomId: number | null) => {
    if (roomId === null) {
      // Go back to global
      await leaveRoom();
    } else {
      await joinRoom(roomId);
    }
    setCurrentRoomId(roomId);
    setCurrentRoom(roomId);
  };

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-50">DnD Voice Chat</h1>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isDM ? 'bg-amber-500/20' : 'bg-violet-500/20'
              }`}
            >
              {isDM ? (
                <Crown className="w-4 h-4 text-amber-500" />
              ) : (
                <User className="w-4 h-4 text-violet-500" />
              )}
            </div>
            <div className="hidden sm:block">
              <p className={`text-sm font-medium ${isDM ? 'text-amber-400' : 'text-violet-400'}`}>
                {user.username}
              </p>
              <p className="text-xs text-gray-400">
                {isDM ? 'Dungeon Master' : 'Player'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            leftIcon={<LogOut className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Room List */}
        <aside className="w-60 flex-shrink-0 bg-gray-850 border-r border-gray-700 overflow-hidden">
          <RoomList onRoomSelect={handleRoomSelect} />
        </aside>

        {/* Chat Panel */}
        <main className="flex-1 flex flex-col p-4 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <ChatContainer roomId={currentRoomId} />
          </div>
        </main>
      </div>
    </div>
  );
}
