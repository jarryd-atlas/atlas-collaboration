"use client";

import { Avatar } from "../ui/avatar";

interface Participant {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface PresenceBarProps {
  participants: Participant[];
  onlineUserIds: string[];
}

export function PresenceBar({ participants, onlineUserIds }: PresenceBarProps) {
  const onlineCount = onlineUserIds.length;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center -space-x-1">
        {participants.map((p) => {
          const isOnline = onlineUserIds.includes(p.id);
          return (
            <div key={p.id} className="relative" title={`${p.full_name}${isOnline ? " (online)" : ""}`}>
              <Avatar
                name={p.full_name}
                src={p.avatar_url}
                size="sm"
              />
              {/* Online indicator dot */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white transition-colors ${
                  isOnline ? "bg-green-500" : "bg-gray-300"
                }`}
              />
            </div>
          );
        })}
      </div>
      {onlineCount > 0 && (
        <span className="text-xs text-gray-400">
          {onlineCount} online
        </span>
      )}
    </div>
  );
}
