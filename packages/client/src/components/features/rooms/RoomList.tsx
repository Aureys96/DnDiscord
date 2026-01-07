import { useEffect, useState } from "react";
import { Hash, Plus, Trash2, Globe, Loader2, Crown } from "lucide-react";
import { useRoomStore } from "../../../stores/roomStore";
import { useAuthStore } from "../../../stores/authStore";
import { Button, Input } from "../../ui";

interface RoomListProps {
  onRoomSelect: (roomId: number | null) => void;
}

export function RoomList({ onRoomSelect }: RoomListProps) {
  const { user } = useAuthStore();
  const {
    rooms,
    currentRoomId,
    isLoading,
    error,
    fetchRooms,
    createRoom,
    deleteRoom,
    joinRoom,
    leaveRoom,
    clearError,
  } = useRoomStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const isDM = user?.role === "dm";

  // Fetch rooms on mount
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      setCreateError("Room name is required");
      return;
    }

    setCreateError(null);
    const room = await createRoom(newRoomName.trim());

    if (room) {
      setNewRoomName("");
      setIsCreating(false);
    }
  };

  const handleRoomClick = async (roomId: number | null) => {
    if (roomId === currentRoomId) return;

    if (roomId === null) {
      // Go back to global
      await leaveRoom();
    } else {
      await joinRoom(roomId);
    }

    onRoomSelect(roomId);
  };

  const handleDeleteRoom = async (roomId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this room?")) {
      await deleteRoom(roomId);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-850">
      {/* Header */}
      <div className="px-3 py-4 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Channels
        </h2>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-red-500/10 text-red-400 text-xs">
          {error}
          <button onClick={clearError} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Room list */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Global channel */}
        <button
          onClick={() => handleRoomClick(null)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
            currentRoomId === null
              ? "bg-gray-700 text-gray-100"
              : "text-gray-400 hover:text-gray-100 hover:bg-gray-700/50"
          }`}
        >
          <Globe className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">global</span>
        </button>

        {/* Loading state */}
        {isLoading && rooms.length === 0 && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
          </div>
        )}

        {/* Room channels */}
        {rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => handleRoomClick(room.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors group ${
              currentRoomId === room.id
                ? "bg-gray-700 text-gray-100"
                : "text-gray-400 hover:text-gray-100 hover:bg-gray-700/50"
            }`}
          >
            <Hash className="w-4 h-4 flex-shrink-0" />
            <span className="truncate flex-1">{room.name}</span>

            {/* Delete button (DM only, creator only) */}
            {isDM && room.createdBy === user?.id && (
              <button
                onClick={(e) => handleDeleteRoom(room.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                title="Delete room"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </button>
        ))}
      </div>

      {/* Create room (DM only) */}
      {isDM && (
        <div className="p-3 border-t border-gray-700">
          {isCreating ? (
            <div className="space-y-2">
              <Input
                placeholder="Room name"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateRoom();
                  if (e.key === "Escape") {
                    setIsCreating(false);
                    setNewRoomName("");
                    setCreateError(null);
                  }
                }}
                error={createError || undefined}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleCreateRoom}
                  disabled={!newRoomName.trim()}
                  className="flex-1"
                >
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setIsCreating(false);
                    setNewRoomName("");
                    setCreateError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsCreating(true)}
              leftIcon={<Plus className="w-4 h-4" />}
              className="w-full justify-start text-gray-400 hover:text-gray-100"
            >
              Create Room
            </Button>
          )}
        </div>
      )}

      {/* DM indicator for non-DMs */}
      {!isDM && (
        <div className="p-3 border-t border-gray-700 text-xs text-gray-500 flex items-center gap-1">
          <Crown className="w-3 h-3 text-amber-500" />
          Only DMs can create rooms
        </div>
      )}
    </div>
  );
}
