import { useEffect, useRef } from 'react';
import { Crown, User } from 'lucide-react';
import type { ChatMessage } from '../../../lib/socket';

interface MessageListProps {
  messages: ChatMessage[];
  typingUsers: Map<number, string>;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MessageItem({ message }: { message: ChatMessage }) {
  const isDM = message.userRole === 'dm';

  return (
    <div className="group flex items-start gap-3 px-4 py-2 hover:bg-gray-800/50">
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          isDM ? 'bg-amber-500/20' : 'bg-violet-500/20'
        }`}
      >
        {isDM ? (
          <Crown className="w-5 h-5 text-amber-500" />
        ) : (
          <User className="w-5 h-5 text-violet-500" />
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className={`font-medium ${isDM ? 'text-amber-400' : 'text-violet-400'}`}
          >
            {message.username}
          </span>
          <span className="text-xs text-gray-500">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
        <p className="text-gray-100 break-words whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  );
}

function TypingIndicator({ usernames }: { usernames: string[] }) {
  if (usernames.length === 0) return null;

  const text =
    usernames.length === 1
      ? `${usernames[0]} is typing...`
      : usernames.length === 2
        ? `${usernames[0]} and ${usernames[1]} are typing...`
        : `${usernames[0]} and ${usernames.length - 1} others are typing...`;

  return (
    <div className="px-4 py-2 text-sm text-gray-400 italic">
      <span className="inline-flex items-center gap-1">
        <span className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
        {text}
      </span>
    </div>
  );
}

export function MessageList({ messages, typingUsers }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if user is near bottom (within 100px)
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    // Only auto-scroll if user is near bottom
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Scroll to bottom on initial load
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, []);

  const typingUsernames = Array.from(typingUsers.values());

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-lg">No messages yet</p>
          <p className="text-sm">Be the first to say something!</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div className="py-4">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
        <TypingIndicator usernames={typingUsernames} />
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
