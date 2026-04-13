"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "../ui/avatar";
import { updateTaskAssignee } from "../../lib/actions";
import { cn } from "../../lib/utils";
import { Search, Check, User } from "lucide-react";

interface AssignableUser {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface TaskAssigneeDropdownProps {
  taskId: string;
  currentAssignee?: { id: string; full_name: string; avatar_url?: string | null } | null;
  assignableUsers: AssignableUser[];
}

export function TaskAssigneeDropdown({
  taskId,
  currentAssignee,
  assignableUsers,
}: TaskAssigneeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [optimisticAssignee, setOptimisticAssignee] = useState(currentAssignee);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setOptimisticAssignee(currentAssignee);
  }, [currentAssignee]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const filtered = search.trim()
    ? assignableUsers.filter((u) => u.full_name.toLowerCase().includes(search.toLowerCase()))
    : assignableUsers;

  function handleSelect(user: AssignableUser | null) {
    if (user?.id === optimisticAssignee?.id) {
      setIsOpen(false);
      setSearch("");
      return;
    }

    setOptimisticAssignee(user ? { id: user.id, full_name: user.full_name, avatar_url: user.avatar_url } : null);
    setIsOpen(false);
    setSearch("");

    startTransition(async () => {
      const result = await updateTaskAssignee(taskId, user?.id ?? null);
      if (result && "error" in result) {
        setOptimisticAssignee(currentAssignee);
      }
      router.refresh();
    });
  }

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => {
          if (!isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setOpenUp(rect.bottom + 260 > window.innerHeight);
          }
          setIsOpen(!isOpen);
          setSearch("");
        }}
        className={cn(
          "cursor-pointer transition-opacity",
          isPending && "opacity-50",
        )}
        title={optimisticAssignee ? `Assigned to ${optimisticAssignee.full_name}` : "Unassigned — click to assign"}
      >
        {optimisticAssignee ? (
          <Avatar name={optimisticAssignee.full_name} src={optimisticAssignee.avatar_url} size="sm" />
        ) : (
          <div className="h-6 w-6 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-gray-400 transition-colors">
            <User className="h-3 w-3 text-gray-400" />
          </div>
        )}
      </button>

      {isOpen && (
        <div className={cn(
          "absolute right-0 w-56 rounded-lg border border-gray-200 bg-white shadow-lg z-50 max-h-[260px] flex flex-col overflow-hidden",
          openUp ? "bottom-full mb-1" : "top-full mt-1",
        )}>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team..."
              className="flex-1 text-sm outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={cn(
                "w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-400 italic",
                !optimisticAssignee && "bg-gray-50",
              )}
            >
              Unassigned
            </button>
            {filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSelect(u)}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2",
                  u.id === optimisticAssignee?.id && "bg-brand-green/5 font-medium",
                )}
              >
                <Avatar name={u.full_name} src={u.avatar_url} size="sm" />
                <span className="flex-1 truncate text-gray-900">{u.full_name}</span>
                {u.id === optimisticAssignee?.id && <Check className="h-3.5 w-3.5 text-brand-green shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
