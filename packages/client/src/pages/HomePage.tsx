import { Crown, User, LogOut } from 'lucide-react';
import { Button, Card, CardContent } from '../components/ui';
import { useAuthStore } from '../stores/authStore';

export function HomePage() {
  const { user, logout } = useAuthStore();

  if (!user) return null;

  const isDM = user.role === 'dm';

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <Card variant="elevated" className="w-full max-w-md">
        <CardContent className="pt-8">
          {/* User Info */}
          <div className="text-center mb-8">
            <div
              className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
                isDM ? 'bg-amber-500/10' : 'bg-violet-500/10'
              }`}
            >
              {isDM ? (
                <Crown className="w-10 h-10 text-amber-500" />
              ) : (
                <User className="w-10 h-10 text-violet-500" />
              )}
            </div>
            <h1 className="text-2xl font-semibold text-gray-50">
              Welcome, {user.username}!
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                  isDM
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-violet-500/20 text-violet-400'
                }`}
              >
                {isDM ? (
                  <>
                    <Crown className="w-3 h-3" />
                    Dungeon Master
                  </>
                ) : (
                  <>
                    <User className="w-3 h-3" />
                    Player
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Placeholder for future content */}
          <div className="text-center text-gray-400 mb-8">
            <p>Authentication successful!</p>
            <p className="text-sm mt-2">
              The main application UI will be built in upcoming milestones.
            </p>
          </div>

          {/* User Details */}
          <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
            <h2 className="text-sm font-medium text-gray-300 mb-3">
              Account Details
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-400">User ID</dt>
                <dd className="text-gray-200">{user.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Username</dt>
                <dd className="text-gray-200">{user.username}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-400">Role</dt>
                <dd
                  className={isDM ? 'text-amber-400' : 'text-violet-400'}
                >
                  {isDM ? 'Dungeon Master' : 'Player'}
                </dd>
              </div>
              {user.createdAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-400">Joined</dt>
                  <dd className="text-gray-200">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Logout Button */}
          <Button
            variant="secondary"
            className="w-full"
            onClick={logout}
            leftIcon={<LogOut className="w-4 h-4" />}
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
