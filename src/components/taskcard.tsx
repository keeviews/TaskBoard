import type { Task, TeamMember } from "../types/task";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

type TaskCardProps = {
  onOpen: () => void;
  task: Task;
  onTaskUpdated: (updatedTask: Task) => void;
  onTaskDeleted: (deletedTaskId: string) => void;
  teamMembers: TeamMember[];
};

function getDueDateStatus(dueDate: string | null) {
  if (!dueDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(`${dueDate}T00:00:00`);

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const daysUntilDue = Math.round(
    (due.getTime() - today.getTime()) / millisecondsPerDay,
  );

  if (daysUntilDue < 0) {
    return {
      label: "Overdue",
      styles: "border-sorbet-rose text-sorbet-ink",
    };
  }

  if (daysUntilDue === 0) {
    return {
      label: "Due today",
      styles: "border-amber-400 text-sorbet-ink",
    };
  }

  if (daysUntilDue <= 3) {
    return {
      label: `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`,
      styles: "border-amber-400 text-sorbet-ink",
    };
  }

  return null;
}

function TaskCard({
  task,
  onOpen,
  onTaskUpdated,
  onTaskDeleted,
  teamMembers,
}: TaskCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(
    task.description ?? "",
  );
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editDueDate, setEditDueDate] = useState(task.due_date ?? "");
  const [editAssigneeId, setEditAssigneeId] = useState(task.assignee_id ?? "");
  const [saveError, setSaveError] = useState("");

  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      const clickedOutsideTheMenu =
        menuRef.current && !menuRef.current.contains(event.target as Node);
      if (clickedOutsideTheMenu) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [isMenuOpen]);

  async function saveTask() {
    const title = editTitle.trim();

    if (!title) return;

    const { data, error } = await supabase
      .from("tasks")
      .update({
        title,
        description: editDescription.trim() || null,
        priority: editPriority,
        due_date: editDueDate || null,
        assignee_id: editAssigneeId || null,
      })
      .eq("id", task.id)
      .select()
      .single();

    if (error) {
      setSaveError(error.message);
      return;
    }

    onTaskUpdated(data);
    setIsEditing(false);
  }

  async function deleteTask() {
    const shouldDelete = window.confirm(
      `Delete "${task.title}"? This cannot be undone.`,
    );

    if (!shouldDelete) return;

    setIsDeleting(true);
    setSaveError("");

    const { error } = await supabase.from("tasks").delete().eq("id", task.id);

    setIsDeleting(false);

    if (error) {
      setSaveError(error.message);
      return;
    }

    onTaskDeleted(task.id);
  }

  const priorityStyles = {
    low: "bg-sorbet-mist text-sorbet-ink ring-sorbet-gray",
    normal: "bg-sorbet-sage-soft text-sorbet-ink ring-sorbet-sage/50",
    high: "bg-sorbet-rose/35 text-sorbet-ink ring-sorbet-rose/50",
  } as const;

  const dueDateStatus = getDueDateStatus(task.due_date);
  const assignee = teamMembers.find((member) => member.id === task.assignee_id);
  const editingAssignee = teamMembers.find(
    (member) => member.id === editAssigneeId,
  );

  return (
    <div
      ref={menuRef}
      className="rounded-lg border border-sorbet-gray bg-sorbet-white p-3 sm:p-4"
    >
      <div className="relative">
        {!isEditing && (
          <button
            className="float-right -mr-2 -mt-2 p-2"
            aria-label={`Open menu for ${task.title}`}
            onClick={() => {
              onOpen();
              setIsMenuOpen((open) => !open);
            }}
          >
            •••
          </button>
        )}
        {!isEditing && isMenuOpen && (
          <div className="absolute right-0 top-8 z-10 mt-2 w-48 rounded-md bg-sorbet-white shadow-sm ring-1 ring-sorbet-gray">
            <button
              className="block w-full px-4 py-2 text-left text-sm text-sorbet-ink hover:bg-sorbet-mist"
              onClick={() => {
                setEditTitle(task.title);
                setEditDescription(task.description ?? "");
                setEditPriority(task.priority);
                setEditDueDate(task.due_date ?? "");
                setEditAssigneeId(task.assignee_id ?? "");
                setIsEditing(true);
                setIsMenuOpen(false);
              }}
            >
              Edit
            </button>
            <button
              className="block w-full px-4 py-2 text-left text-sm text-sorbet-ink hover:bg-sorbet-rose/30"
              onClick={deleteTask}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        )}
      </div>
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <input
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            className="rounded border border-sorbet-gray bg-sorbet-white px-2 py-1 focus:border-sorbet-sage focus:ring-sorbet-sage"
          />

          <textarea
            value={editDescription}
            onChange={(event) => setEditDescription(event.target.value)}
            className="rounded border border-sorbet-gray bg-sorbet-white px-2 py-1 focus:border-sorbet-sage focus:ring-sorbet-sage"
            placeholder="Add a description"
          />

          <select
            value={editPriority}
            onChange={(event) =>
              setEditPriority(event.target.value as "low" | "normal" | "high")
            }
            className="rounded border border-sorbet-gray bg-sorbet-white px-2 py-1 focus:border-sorbet-sage focus:ring-sorbet-sage"
          >
            <option value="low">Low priority</option>
            <option value="normal">Normal priority</option>
            <option value="high">High priority</option>
          </select>

          <input
            type="date"
            value={editDueDate}
            onChange={(event) => setEditDueDate(event.target.value)}
            className="rounded border border-sorbet-gray bg-sorbet-white px-2 py-1 focus:border-sorbet-sage focus:ring-sorbet-sage"
          />

          <div className="flex items-center gap-2">
            <select
              value={editAssigneeId}
              onChange={(event) => setEditAssigneeId(event.target.value)}
              className="min-w-0 flex-1 rounded border border-sorbet-gray bg-sorbet-white px-2 py-1 focus:border-sorbet-sage focus:ring-sorbet-sage"
            >
              <option value="">Unassigned</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            {editingAssignee && (
              <span
                className="h-7 w-7 shrink-0 rounded-full"
                style={{ backgroundColor: editingAssignee.color }}
                title={`${editingAssignee.name}'s color`}
              />
            )}
          </div>

          {saveError && (
            <p className="break-words text-sm text-sorbet-rose">{saveError}</p>
          )}

          <div className="flex gap-2">
            <button
              className="mb-2 block rounded-md bg-sorbet-sage p-1.5 text-sorbet-ink hover:bg-sorbet-rose sm:text-sm"
              onClick={saveTask}
            >
              Save
            </button>

            <button
              className="mb-2 block rounded-md bg-sorbet-rose p-1.5 text-sorbet-ink hover:bg-sorbet-sage sm:text-sm"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {assignee && (
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-sorbet-ink/70">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: assignee.color }}
              />
              {assignee.name}
            </div>
          )}
          <div className="flex items-center justify-between gap-3 pr-6">
            <h2 className="min-w-0 break-words text-left text-xl font-extrabold sm:text-2xl">
              {task.title}
            </h2>

            {dueDateStatus && (
              <span
                className={`shrink-0 border-l-2 pl-2 text-[10px] font-medium ${dueDateStatus.styles}`}
              >
                {dueDateStatus.label}
              </span>
            )}
          </div>

          {task.description && (
            <p className="mt-2 break-words text-[12px]">{task.description}</p>
          )}
          <hr className="my-3 border-sorbet-gray" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <p
                className={`shrink-0 rounded-2xl px-2 py-1 text-[10px] font-medium ${priorityStyles[task.priority]}`}
              >
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}{" "}
                priority
              </p>
            </div>
            {task.due_date && (
              <p className="text-[10px] text-sorbet-ink/60">
                Due {task.due_date}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default TaskCard;
