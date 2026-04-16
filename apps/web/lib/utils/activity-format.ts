import { DISCOVERY_SECTION_LABELS, SECTION_STATUS_LABELS } from "@repo/shared";
import type { SectionStatus, DiscoverySection } from "@repo/shared";

export interface ActivityItem {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: Record<string, unknown>;
  created_at: string;
  customer_visible: boolean;
  site_id: string | null;
  customer_id: string | null;
  // Joined fields
  actor?: { full_name: string | null; avatar_url: string | null } | null;
  site?: { name: string } | null;
  customer?: { name: string } | null;
}

export interface FormattedActivity {
  icon: "status" | "info_request" | "task" | "milestone" | "document" | "site";
  color: string; // tailwind color class
  description: string;
  detail?: string;
}

/**
 * Time-ago formatting (reused pattern from notifications-dropdown.tsx)
 */
export function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

/**
 * Format a raw activity_log row into a human-readable description.
 */
export function formatActivity(item: ActivityItem): FormattedActivity {
  const actorName = item.actor?.full_name ?? "Someone";
  const changes = item.changes ?? {};

  switch (item.entity_type) {
    case "section_status": {
      if (item.action === "status_changed") {
        const section = DISCOVERY_SECTION_LABELS[changes.section as DiscoverySection] ?? (changes.section as string) ?? "a section";
        const newStatus = SECTION_STATUS_LABELS[changes.new_status as SectionStatus] ?? (changes.new_status as string) ?? "unknown";
        return {
          icon: "status",
          color: "text-blue-500",
          description: `${actorName} changed ${section} to ${newStatus}`,
        };
      }
      if (item.action === "assigned") {
        const section = DISCOVERY_SECTION_LABELS[changes.section as DiscoverySection] ?? (changes.section as string) ?? "a section";
        const assignee = (changes.assignee_name as string) ?? "someone";
        return {
          icon: "status",
          color: "text-purple-500",
          description: `${actorName} assigned ${section} to ${assignee}`,
        };
      }
      if (item.action === "shared") {
        const section = DISCOVERY_SECTION_LABELS[changes.section as DiscoverySection] ?? (changes.section as string) ?? "a section";
        return {
          icon: "status",
          color: "text-green-500",
          description: `${actorName} shared ${section} with customer`,
        };
      }
      if (item.action === "unshared") {
        const section = DISCOVERY_SECTION_LABELS[changes.section as DiscoverySection] ?? (changes.section as string) ?? "a section";
        return {
          icon: "status",
          color: "text-gray-500",
          description: `${actorName} hid ${section} from customer`,
        };
      }
      return {
        icon: "status",
        color: "text-blue-500",
        description: `${actorName} updated a section status`,
      };
    }

    case "info_request": {
      const title = (changes.title as string) ?? "a request";
      if (item.action === "created") {
        return {
          icon: "info_request",
          color: "text-amber-500",
          description: `${actorName} requested: ${title}`,
        };
      }
      if (item.action === "responded") {
        return {
          icon: "info_request",
          color: "text-blue-500",
          description: `${actorName} responded to: ${title}`,
        };
      }
      if (item.action === "resolved") {
        return {
          icon: "info_request",
          color: "text-green-500",
          description: `${actorName} resolved: ${title}`,
        };
      }
      return {
        icon: "info_request",
        color: "text-amber-500",
        description: `${actorName} updated request: ${title}`,
      };
    }

    case "task": {
      const title = (changes.title as string) ?? "a task";
      if (item.action === "created") {
        return {
          icon: "task",
          color: "text-blue-500",
          description: `${actorName} created task: ${title}`,
        };
      }
      if (item.action === "status_changed") {
        const newStatus = (changes.new_status as string) ?? "";
        return {
          icon: "task",
          color: newStatus === "done" ? "text-green-500" : "text-blue-500",
          description: `${actorName} marked task ${newStatus}: ${title}`,
        };
      }
      if (item.action === "assigned") {
        const assignee = (changes.assignee_name as string) ?? "someone";
        return {
          icon: "task",
          color: "text-purple-500",
          description: `${actorName} assigned ${title} to ${assignee}`,
        };
      }
      return {
        icon: "task",
        color: "text-blue-500",
        description: `${actorName} updated task: ${title}`,
      };
    }

    case "milestone": {
      const title = (changes.title as string) ?? "a milestone";
      if (item.action === "created") {
        return {
          icon: "milestone",
          color: "text-green-500",
          description: `${actorName} created milestone: ${title}`,
        };
      }
      if (item.action === "status_changed") {
        const newStatus = (changes.new_status as string) ?? "";
        return {
          icon: "milestone",
          color: "text-green-500",
          description: `${actorName} marked milestone ${newStatus}: ${title}`,
        };
      }
      return {
        icon: "milestone",
        color: "text-green-500",
        description: `${actorName} updated milestone: ${title}`,
      };
    }

    case "document": {
      const fileName = (changes.file_name as string) ?? "a document";
      return {
        icon: "document",
        color: "text-gray-500",
        description: `${actorName} uploaded ${fileName}`,
      };
    }

    case "site": {
      // Legacy baseline form activity
      return {
        icon: "site",
        color: "text-gray-500",
        description: `${actorName} updated baseline data`,
        detail: item.action,
      };
    }

    default:
      return {
        icon: "site",
        color: "text-gray-400",
        description: `${actorName} performed an action`,
      };
  }
}
