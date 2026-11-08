import type { Task } from "../types/task";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

type TaskCardProps = {
      onOpen: () => void;
  task: Task;
  onTaskUpdated: (updatedTask: Task) => void;
    onTaskDeleted: (deletedTaskId: string) => void;
};

function TaskCard({ task, onOpen, onTaskUpdated, onTaskDeleted }: TaskCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description ?? "");
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editDueDate, setEditDueDate] = useState(task.due_date ?? "");
  const [saveError, setSaveError] = useState("");

  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      const clickedOutsideTheMenu = menuRef.current && !menuRef.current.contains(event.target as Node);
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

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", task.id);

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

  return (
    <div
      ref={menuRef}
      className="rounded-lg border border-sorbet-gray bg-sorbet-white p-4 shadow-sm"
    >
      <div className="relative">
        <button className="float-right" onClick={() => {
          onOpen();
          setIsMenuOpen((open) => !open);
        }}>•••</button>
        {isMenuOpen && (
          <div className="absolute right-0 top-4.5 mt-2 w-48 rounded-md bg-sorbet-white shadow-lg ring-1 ring-sorbet-gray">
            <button
              className="block w-full px-4 py-2 text-left text-sm text-sorbet-ink hover:bg-sorbet-mist"
              onClick={() => {
                setEditTitle(task.title);
                setEditDescription(task.description ?? "");
                setEditPriority(task.priority);
                setEditDueDate(task.due_date ?? "");
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
        setEditPriority(
          event.target.value as "low" | "normal" | "high",
        )
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

    {saveError && <p className="text-sm text-sorbet-rose">{saveError}</p>}

    <div className="flex gap-2">
      <button className="mb-2 block rounded-md bg-sorbet-sage p-1.5 text-sorbet-ink shadow-sm hover:bg-sorbet-rose sm:text-sm" onClick={saveTask}>Save</button>

      <button className="mb-2 block rounded-md bg-sorbet-rose p-1.5 text-sorbet-ink shadow-sm hover:bg-sorbet-sage sm:text-sm" onClick={() => setIsEditing(false)}>
        Cancel
      </button>
    </div>
  </div>
) : (
  <>
    <h2 className="font-bold">{task.title}</h2>
    {task.description && <p>{task.description}</p>}
    <br></br>
    <hr className="border-sorbet-gray"></hr>
    <p
      className={`mt-3 inline-flex px-2 py-1 rounded-2xl text-xs font-medium ${priorityStyles[task.priority]}`}
    >
      {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} priority
    </p>
    {task.due_date && (
      <p className="text-sm text-sorbet-ink/60">Due {task.due_date}</p>
    )}
    
    
  </>
)}


    </div>
  );
}

export default TaskCard;
