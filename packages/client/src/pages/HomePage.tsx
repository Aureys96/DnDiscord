import { Crown, User, LogOut } from 'lucide-react';
import { Button } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { ChatContainer } from '../components/features/chat';

export function HomePage() {
  const { user, logout } = useAuthStore();

  if (!user) return null;

  const isDM = user.role === 'dm';

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
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
      <main className="flex-1 flex p-4 gap-4 overflow-hidden">
        {/* Chat Panel */}
        <div className="flex-1 max-w-3xl mx-auto h-full">
          <ChatContainer />
        </div>
      </main>
    </div>
  );
}
