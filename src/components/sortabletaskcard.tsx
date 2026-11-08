import { useSortable } from "@dnd-kit/react/sortable";
import type { Task, TaskStatus, TeamMember } from "../types/task";
import TaskCard from "./taskcard";

type SortableTaskCardProps = {
  task: Task;
  index: number;
  status: TaskStatus;
  onOpen: () => void;
  onTaskUpdated: (updatedTask: Task) => void;
  onTaskDeleted: (deletedTaskId: string) => void;
  teamMembers: TeamMember[];
};

function SortableTaskCard({
  task,
  index,
  status,
  onOpen,
  onTaskUpdated,
  onTaskDeleted,
  teamMembers,
}: SortableTaskCardProps) {
  const sortable = useSortable({
    id: task.id,
    index,
    group: status,
    type: "task",
    accept: "task",
    data: { status },
  });

  return (
    <div
      ref={sortable.ref}
      className={`transition-opacity ${
        sortable.isDragging ? "opacity-30" : "opacity-100"
      }`}
    >
      <TaskCard
        task={task}
        onOpen={onOpen}
        onTaskUpdated={onTaskUpdated}
        onTaskDeleted={onTaskDeleted}
        teamMembers={teamMembers}
      />
    </div>
  );
}

export default SortableTaskCard;
