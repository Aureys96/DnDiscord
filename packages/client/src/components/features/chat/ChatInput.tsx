import { type FormEvent, useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<boolean>;
  onTypingChange?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSendMessage,
  onTypingChange,
  disabled = false,
  placeholder = "Type a message...",
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<number | undefined>(undefined);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle typing indicator
  const handleTyping = () => {
    if (onTypingChange) {
      onTypingChange(true);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = window.setTimeout(() => {
        onTypingChange(false);
      }, 2000);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const trimmed = message.trim();
    if (!trimmed || isSending || disabled) return;

    setIsSending(true);

    // Stop typing indicator
    if (onTypingChange) {
      onTypingChange(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }

    const success = await onSendMessage(trimmed);

    if (success) {
      setMessage("");
    }

    setIsSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
      <div className="flex items-end gap-2 bg-gray-700 rounded-lg p-2">
        <textarea
          ref={inputRef}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            handleTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSending}
          rows={1}
          className="flex-1 bg-transparent text-gray-100 placeholder-gray-400 resize-none focus:outline-none min-h-[24px] max-h-[120px]"
          style={{
            height: "auto",
            overflow: message.split("\n").length > 1 ? "auto" : "hidden",
          }}
        />
        <button
          type="submit"
          disabled={!message.trim() || isSending || disabled}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-violet-400 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1 px-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  );
}
