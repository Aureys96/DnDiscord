import { useEffect, useRef } from "react";
import { Crown, User, Dices } from "lucide-react";
import type { ChatMessage, DiceRollResult } from "../../../lib/socket";

interface MessageListProps {
  messages: ChatMessage[];
  typingUsers: Map<number, string>;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DiceRollDisplay({
  rollResult,
  username,
}: {
  rollResult: DiceRollResult;
  username: string;
}) {
  return (
    <div
      className={`rounded-lg border p-3 mt-1 ${
        rollResult.criticalHit
          ? "bg-emerald-900/30 border-emerald-500/50"
          : rollResult.criticalMiss
            ? "bg-red-900/30 border-red-500/50"
            : "bg-indigo-900/30 border-indigo-500/50"
      }`}
    >
      {/* Roll header */}
      <div className="flex items-center gap-2 mb-2">
        <Dices
          className={`w-5 h-5 ${
            rollResult.criticalHit
              ? "text-emerald-400"
              : rollResult.criticalMiss
                ? "text-red-400"
                : "text-indigo-400"
          }`}
        />
        <span className="text-gray-400 text-sm">
          {username} rolled{" "}
          <span className="font-mono text-gray-200">{rollResult.formula}</span>
        </span>
      </div>

      {/* Individual dice results */}
      <div className="flex flex-wrap gap-2 mb-2">
        {rollResult.rolls.map((roll, rollIdx) => (
          <div key={rollIdx} className="flex items-center gap-1">
            <span className="text-gray-500 text-xs">{roll.dice}:</span>
            <div className="flex gap-1">
              {roll.results.map((result, dieIdx) => {
                const isKept = !roll.kept || roll.kept.includes(result);
                const isMax = result === parseInt(roll.dice.split("d")[1]);
                const isMin = result === 1;
                return (
                  <span
                    key={dieIdx}
                    className={`
                      inline-flex items-center justify-center w-6 h-6 rounded text-sm font-medium
                      ${!isKept ? "line-through opacity-50" : ""}
                      ${isMax && isKept ? "bg-emerald-500/30 text-emerald-300" : ""}
                      ${isMin && isKept ? "bg-red-500/30 text-red-300" : ""}
                      ${!isMax && !isMin && isKept ? "bg-gray-700 text-gray-200" : ""}
                      ${!isKept ? "bg-gray-800 text-gray-500" : ""}
                    `}
                  >
                    {result}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
        {rollResult.modifier !== 0 && (
          <span className="text-gray-400 text-sm self-center">
            {rollResult.modifier > 0 ? "+" : ""}
            {rollResult.modifier}
          </span>
        )}
      </div>

      {/* Total */}
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-sm">Total:</span>
        <span
          className={`text-2xl font-bold ${
            rollResult.criticalHit
              ? "text-emerald-400"
              : rollResult.criticalMiss
                ? "text-red-400"
                : "text-white"
          }`}
        >
          {rollResult.total}
        </span>
        {rollResult.criticalHit && (
          <span className="text-emerald-400 text-sm font-medium animate-pulse">
            Critical Hit!
          </span>
        )}
        {rollResult.criticalMiss && (
          <span className="text-red-400 text-sm font-medium animate-pulse">
            Critical Miss!
          </span>
        )}
      </div>
    </div>
  );
}

function MessageItem({ message }: { message: ChatMessage }) {
  const isDM = message.userRole === "dm";
  const isRoll = message.type === "roll" && message.rollResult;

  return (
    <div className="group flex items-start gap-3 px-4 py-2 hover:bg-gray-800/50">
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          isRoll
            ? "bg-indigo-500/20"
            : isDM
              ? "bg-amber-500/20"
              : "bg-violet-500/20"
        }`}
      >
        {isRoll ? (
          <Dices className="w-5 h-5 text-indigo-400" />
        ) : isDM ? (
          <Crown className="w-5 h-5 text-amber-500" />
        ) : (
          <User className="w-5 h-5 text-violet-500" />
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className={`font-medium ${isDM ? "text-amber-400" : "text-violet-400"}`}
          >
            {message.username}
          </span>
          <span className="text-xs text-gray-500">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
        {isRoll && message.rollResult ? (
          <DiceRollDisplay
            rollResult={message.rollResult}
            username={message.username}
          />
        ) : (
          <p className="text-gray-100 break-words whitespace-pre-wrap">
            {message.content}
          </p>
        )}
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
          <span
            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
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
      container.scrollHeight - container.scrollTop - container.clientHeight <
      100;

    // Only auto-scroll if user is near bottom
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
