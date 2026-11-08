import {  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type SubmitEvent,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import type { Task, TaskStatus } from "./types/task";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import BoardColumn from "./components/boardcolumn";
import SortableTaskCard from "./components/sortabletaskcard";
import { move } from "@dnd-kit/helpers";


const columns = [
  { title: "To Do", status: "todo" },
  { title: "In Progress", status: "in_progress" },
  { title: "In Review", status: "in_review" },
  { title: "Done", status: "done" },
] as const;

const statuses: TaskStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "done",
];

type TaskGroups = Record<TaskStatus, Task[]>;

function groupTasks(tasks: Task[]): TaskGroups {
  return Object.fromEntries(
    statuses.map((status) => [
      status,
      tasks
        .filter((task) => task.status === status)
        .sort((a, b) => a.position - b.position),
    ]),
  ) as TaskGroups;
}

function flattenTaskGroups(groups: TaskGroups): Task[] {
  return statuses.flatMap((status) =>
    groups[status].map((task, position) => ({
      ...task,
      status,
      position,
    })),
  );
}


type DragEndEvent = Parameters<
  NonNullable<ComponentProps<typeof DragDropProvider>["onDragEnd"]>
>[0];

type DragOverEvent = Parameters<
  NonNullable<ComponentProps<typeof DragDropProvider>["onDragOver"]>
>[0];


function App() {
  const menuRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "normal" | "high">("normal");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskError, setTaskError] = useState("");

  const [activeView, setActiveView] = useState<"overview" | TaskStatus>(
  "overview",
);

  const tasksBeforeDrag = useRef<Task[]>([]);
  const latestTasks = useRef<Task[]>([]);

  useEffect(() => {
  function handleClickOutside(event: PointerEvent) {
    const clickedOutsideTheMenu = menuRef.current && !menuRef.current.contains(event.target as Node);
    if (clickedOutsideTheMenu) {
      setIsFormOpen(false);
    }
  }
  document.addEventListener("pointerdown", handleClickOutside);
  return () => {
    document.removeEventListener("pointerdown", handleClickOutside);
  };
}, [isFormOpen]);

  useEffect(() => {
  latestTasks.current = tasks;
}, [tasks]);

  useEffect(() => {
    async function startGuestSession() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        setErrorMessage(sessionError.message);
        setIsLoading(false);
        return;
      }

      if (session) {
        setUser(session.user);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      setUser(data.user);
      setIsLoading(false);
    }

    startGuestSession();
  }, []);

  useEffect(() => {
  if (!user) return;

  async function loadTasks() {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("position", { ascending: true });
    if (error) {
      setTaskError(error.message);
      return;
    }

    setTasks(data);
  }

  loadTasks();
}, [user]);

async function handleTaskSubmit(event: SubmitEvent<HTMLFormElement>) {
  event.preventDefault();

  const title = newTaskTitle.trim();
  const description = newTaskDescription.trim();

  if (!title || !user) return;

  setIsSavingTask(true);
  setTaskError("");

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title,
      user_id: user.id,
      status: "todo",
      priority: newTaskPriority,
      description: description || null,
      due_date: newTaskDueDate || null,
      position: tasks.filter((task) => task.status === "todo").length,
    })
    .select()
    .single();

  setIsSavingTask(false);

  if (error) {
    setTaskError(error.message);
    return;
  }

  setTasks((currentTasks) => [data, ...currentTasks]);
  setNewTaskTitle("");
  setNewTaskDescription("");
  setIsFormOpen(false);
  setNewTaskPriority("normal");
  setNewTaskDueDate("");
}

  if (isLoading) {
    return <main>Creating your guest session…</main>;
  }

  if (errorMessage) {
    return <main>Something went wrong: {errorMessage}</main>;
  }

function handleDragStart() {
  tasksBeforeDrag.current = latestTasks.current;
}

function handleDragOver(event: DragOverEvent) {
  const { source } = event.operation;

  if (!source || source.type === "column") return;

  setTasks((currentTasks) => {
    const movedGroups = move(groupTasks(currentTasks), event) as TaskGroups;

    const nextTasks = flattenTaskGroups(movedGroups);

    // Keep the ref current immediately, even before React finishes rendering.
    latestTasks.current = nextTasks;

    return nextTasks;
  });
}

async function handleDragEnd(event: DragEndEvent) {
  if (event.canceled) {
    setTasks(tasksBeforeDrag.current);
    latestTasks.current = tasksBeforeDrag.current;
    return;
  }

  const finalTasks = latestTasks.current;

  const results = await Promise.all(
    finalTasks.map((task) =>
      supabase
        .from("tasks")
        .update({
          status: task.status,
          position: task.position,
        })
        .eq("id", task.id),
    ),
  );

  const failedUpdate = results.find((result) => result.error);

  if (failedUpdate?.error) {
    setTasks(tasksBeforeDrag.current);
    latestTasks.current = tasksBeforeDrag.current;
    setTaskError(failedUpdate.error.message);
  }
}

const visibleColumns =
  activeView === "overview"
    ? columns
    : columns.filter((column) => column.status === activeView);

  const navigationButtonClass = (view: "overview" | TaskStatus) =>
    `w-full px-4 py-2 text-left transition-colors hover:bg-sorbet-sage/35 ${
      activeView === view ? "bg-sorbet-sage/35 font-medium" : ""
    }`;

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-sorbet-white text-sorbet-ink">
      <div className="flex h-full w-56 shrink-0 flex-col border-r border-sorbet-gray bg-sorbet-sage-soft">
        <h1 className="text-xl font-bold pt-[23px] pb-[23px]">Setter</h1>
        <button
          onClick={() => setActiveView("overview")}
          className={navigationButtonClass("overview")}
        >
          Overview
        </button>
        <div className="flex flex-col pt-[23px] pb-45">
          <button
            onClick={() => setActiveView("todo")}
            className={navigationButtonClass("todo")}
          >
            To Do
          </button>

          <button
            onClick={() => setActiveView("in_progress")}
            className={navigationButtonClass("in_progress")}
          >
            In Progress
          </button>

          <button
            onClick={() => setActiveView("in_review")}
            className={navigationButtonClass("in_review")}
          >
            In Review
          </button>

          <button
            onClick={() => setActiveView("done")}
            className={navigationButtonClass("done")}
          >
            Done
          </button>
        </div>
        <div className="flex flex-col align-bottom mt-auto pb-[25%]">
          <button className="w-full px-4 py-2 text-left hover:bg-sorbet-sage/35">Settings</button>
          <button className="w-full px-4 py-2 text-left hover:bg-sorbet-sage/35">User</button>
        </div>
      </div>

      {taskError && <p className="mt-4 text-sorbet-rose">{taskError}</p>}

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-end border-b border-sorbet-gray bg-sorbet-white px-8 py-5">
  <div ref={menuRef} className="relative">
    <button
      onClick={() => {
        setIsFormOpen(true);
      }}
      className="rounded-lg bg-sorbet-sage px-4 py-2 font-medium text-sorbet-ink shadow-sm hover:bg-sorbet-rose"
    >
      Add Task
    </button>

        {isFormOpen && (
          <form onSubmit={handleTaskSubmit} className="absolute right-full top-0 z-50 mr-2 w-80 rounded-xl border border-sorbet-gray bg-sorbet-white p-4 shadow-xl">
            
            <input
              type="text"
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              placeholder="Task title"
              className="mb-2 block w-full rounded-md border-sorbet-gray bg-sorbet-white shadow-sm focus:border-sorbet-sage focus:ring-sorbet-sage sm:text-sm"
            />

            <textarea
              value={newTaskDescription}
              onChange={(event) => setNewTaskDescription(event.target.value)}
              placeholder="Task description"
              className="mb-2 block w-full rounded-md border-sorbet-gray bg-sorbet-white shadow-sm focus:border-sorbet-sage focus:ring-sorbet-sage sm:text-sm"
            />

            <select
              value={newTaskPriority}
              onChange={(event) =>
                setNewTaskPriority(
                  event.target.value as "low" | "normal" | "high",
                )
              }
              className="mb-2 block w-full rounded-md border-sorbet-gray bg-sorbet-white shadow-sm focus:border-sorbet-sage focus:ring-sorbet-sage sm:text-sm"
            >
              <option value="low">Low priority</option>
              <option value="normal">Normal priority</option>
              <option value="high">High priority</option>
            </select>

            <input
              type="date"
              value={newTaskDueDate}
              onChange={(event) => setNewTaskDueDate(event.target.value)}
              className="mb-2 block w-full rounded-md border-sorbet-gray bg-sorbet-white shadow-sm focus:border-sorbet-sage focus:ring-sorbet-sage sm:text-sm"
            />
            

            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="mr-2 rounded-md border border-sorbet-gray px-3 py-2 hover:bg-sorbet-mist"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSavingTask || !newTaskTitle.trim()}
              className="rounded-md bg-sorbet-sage px-3 py-2 text-sorbet-ink hover:bg-sorbet-rose disabled:opacity-50"
            >
              {isSavingTask ? "Creating..." : "Create task"}
            </button>
          </form>
        )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
      <DragDropProvider   onDragStart={handleDragStart}
  onDragOver={handleDragOver}
  onDragEnd={handleDragEnd}>
  <div
    className={`grid min-h-full gap-5 p-8 ${
      activeView === "overview"
        ? "grid-cols-1 md:grid-cols-2 2xl:grid-cols-4"
        : "grid-cols-1"
    }`}
  >
    {visibleColumns.map((column) => {
      const columnTasks = tasks
        .filter((task) => task.status === column.status)
        .sort((a, b) => a.position - b.position);

      return (
        <BoardColumn
          key={column.status}
          title={column.title}
          status={column.status}
        >
          {columnTasks.length === 0 && (
            <p className="rounded-lg border-2 border-dashed border-sorbet-gray p-4 text-sm text-sorbet-ink/60">
              Drop a task here
            </p>
          )}

          {columnTasks.map((task, index) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              index={index}
              status={column.status}
              onOpen={() => undefined}
              onTaskUpdated={(updatedTask) => {
                setTasks((currentTasks) =>
                  currentTasks.map((task) =>
                    task.id === updatedTask.id ? updatedTask : task,
                  ),
                );
              }}
              onTaskDeleted={(deletedTaskId) => {
                setTasks((currentTasks) =>
                  currentTasks.filter((task) => task.id !== deletedTaskId),
                );
              }}
            />
          ))}
        </BoardColumn>
      );
    })}
  </div>

  <DragOverlay>
    {(source) => {
        if (!source) return null;

        const draggedTask = tasks.find((task) => task.id === source.id);

        if (!draggedTask) return null;

        return (
          <div className="w-72 rotate-1 rounded-lg border border-sorbet-sage bg-sorbet-white p-4 shadow-2xl">
            <h2 className="font-semibold">{draggedTask.title}</h2>
          </div>
        );
      }}
  </DragOverlay>
</DragDropProvider>
  </div>
</div>
    </main>
  );
}

export default App;
