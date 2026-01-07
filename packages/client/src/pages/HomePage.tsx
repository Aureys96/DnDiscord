import { useState } from 'react';
import { Crown, User, LogOut, Hash, MessageSquare } from 'lucide-react';
import { Button } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useRoomStore } from '../stores/roomStore';
import { useDMStore } from '../stores/dmStore';
import { useVoiceStore } from '../stores/voiceStore';
import { ChatContainer } from '../components/features/chat';
import { RoomList } from '../components/features/rooms';
import { ConversationList, DMChat } from '../components/features/dms';
import { VoiceParticipants } from '../components/features/voice';
import type { Conversation } from '@dnd-voice/shared';

type ActiveTab = 'rooms' | 'dms';
type ViewMode = 'rooms' | 'dm-chat';

export function HomePage() {
  const { user, logout } = useAuthStore();
  const { setCurrentRoom } = useChatStore();
  const { joinRoom, leaveRoom } = useRoomStore();
  const { currentConversation, setCurrentConversation, totalUnreadCount, clearMessages } = useDMStore();
  const { isInVoice } = useVoiceStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('rooms');
  const [viewMode, setViewMode] = useState<ViewMode>('rooms');
  const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);

  if (!user) return null;

  const isDM = user.role === 'dm';

  const handleRoomSelect = async (roomId: number | null) => {
    // Clear any active DM conversation when switching to rooms
    setCurrentConversation(null);
    setViewMode('rooms');

    if (roomId === null) {
      // Go back to global
      await leaveRoom();
    } else {
      await joinRoom(roomId);
    }
    setCurrentRoomId(roomId);
    setCurrentRoom(roomId);
  };

  const handleSelectConversation = (_conversation: Conversation) => {
    // Switch to DM view (conversation is set by ConversationList via store)
    setViewMode('dm-chat');
    setCurrentRoomId(null);
    setCurrentRoom(null);
  };

  const handleBackFromDM = () => {
    clearMessages();
    setViewMode('rooms');
    setActiveTab('dms');
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'rooms') {
      // Clear DM conversation when switching to rooms tab
      if (viewMode === 'dm-chat') {
        clearMessages();
        setViewMode('rooms');
      }
    }
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
        {/* Sidebar */}
        <aside className="w-60 flex-shrink-0 bg-gray-850 border-r border-gray-700 flex flex-col overflow-hidden">
          {/* Tab Switcher */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => handleTabChange('rooms')}
              className={`flex-1 px-3 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'rooms'
                  ? 'text-gray-100 border-b-2 border-violet-500 bg-gray-800'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
            >
              <Hash className="w-4 h-4" />
              Channels
            </button>
            <button
              onClick={() => handleTabChange('dms')}
              className={`flex-1 px-3 py-2 text-sm font-medium flex items-center justify-center gap-2 transition-colors relative ${
                activeTab === 'dms'
                  ? 'text-gray-100 border-b-2 border-violet-500 bg-gray-800'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              DMs
              {totalUnreadCount > 0 && (
                <span className="absolute top-1 right-3 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center">
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'rooms' ? (
              <RoomList onRoomSelect={handleRoomSelect} />
            ) : (
              <ConversationList onSelectConversation={handleSelectConversation} />
            )}
          </div>

          {/* Voice Participants - show when in voice */}
          {isInVoice && (
            <div className="flex-shrink-0 p-3 border-t border-gray-700 bg-gray-800/50">
              <VoiceParticipants />
            </div>
          )}
        </aside>

        {/* Main Panel */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {viewMode === 'dm-chat' && currentConversation ? (
            <DMChat conversation={currentConversation} onBack={handleBackFromDM} />
          ) : (
            <div className="flex-1 p-4 overflow-hidden">
              <ChatContainer roomId={currentRoomId} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
