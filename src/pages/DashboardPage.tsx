import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { BoardGrid } from "@/components/dashboard/BoardGrid";
import type { BoardData } from "@/components/dashboard/BoardCard";

const mockBoards: BoardData[] = [
  {
    id: "1",
    name: "Product Launch",
    description:
      "Track tasks and milestones for the upcoming product launch across all teams.",
    taskCount: 24,
    lastModified: "2 hours ago",
    color: "#4f46e5",
  },
  {
    id: "2",
    name: "Design Sprint",
    description: "UI/UX design tasks for the new dashboard feature set.",
    taskCount: 16,
    lastModified: "Yesterday",
    color: "#0ea5e9",
  },
  {
    id: "3",
    name: "Bug Tracker",
    description: "Track and resolve reported bugs from the latest release.",
    taskCount: 31,
    lastModified: "3 days ago",
    color: "#ef4444",
  },
  {
    id: "4",
    name: "Marketing Q3",
    description: "Campaign planning, content creation, and analytics for Q3.",
    taskCount: 12,
    lastModified: "1 week ago",
    color: "#10b981",
  },
  {
    id: "5",
    name: "Feature Requests",
    description: "Collect and prioritize feature requests from user feedback.",
    taskCount: 8,
    lastModified: "5 days ago",
    color: "#8b5cf6",
  },
  {
    id: "6",
    name: "Sprint 24",
    description:
      "Current sprint backlog and in-progress tasks for the engineering team.",
    taskCount: 19,
    lastModified: "1 day ago",
    color: "#f59e0b",
  },
];

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <DashboardHeader />
      <div className="flex-1 p-6">
        <BoardGrid boards={mockBoards} />
      </div>
    </DashboardLayout>
  );
}
