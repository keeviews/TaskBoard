import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type SubmitEvent,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import type { Task, TaskStatus, TeamMember } from "./types/task";
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

const statuses: TaskStatus[] = ["todo", "in_progress", "in_review", "done"];

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
  const membersMenuRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<
    "low" | "normal" | "high"
  >("normal");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [taskError, setTaskError] = useState("");

  const [activeView, setActiveView] = useState<"overview" | TaskStatus>(
    "overview",
  );

  const tasksBeforeDrag = useRef<Task[]>([]);
  const latestTasks = useRef<Task[]>([]);

  const [searchQuery, setSearchQuery] = useState("");

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberColor, setNewMemberColor] = useState("#b7c396");
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(
    null,
  );
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      const clickedOutsideTheTaskMenu =
        menuRef.current && !menuRef.current.contains(event.target as Node);
      const clickedOutsideTheMembersMenu =
        membersMenuRef.current &&
        !membersMenuRef.current.contains(event.target as Node);

      if (clickedOutsideTheTaskMenu) {
        setIsFormOpen(false);
      }

      if (clickedOutsideTheMembersMenu) {
        setIsManageMembersOpen(false);
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

      const { data: members, error: membersError } = await supabase
        .from("team_members")
        .select("*")
        .order("created_at");

      if (membersError) {
        setTaskError(membersError.message);
        return;
      }

      setTeamMembers(members);

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
        assignee_id: selectedAssigneeId || null,
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
    setSelectedAssigneeId("");
  }

  async function handleDeleteMember(member: TeamMember) {
    if (!window.confirm(`Delete ${member.name}?`)) return;

    setDeletingMemberId(member.id);
    setTaskError("");

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", member.id);

    setDeletingMemberId(null);

    if (error) {
      setTaskError(error.message);
      return;
    }

    setTeamMembers((members) =>
      members.filter((currentMember) => currentMember.id !== member.id),
    );
    setSelectedAssigneeId((currentId) =>
      currentId === member.id ? "" : currentId,
    );
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
  const newTaskAssignee = teamMembers.find(
    (member) => member.id === selectedAssigneeId,
  );

  const navigationButtonClass = (view: "overview" | TaskStatus) =>
    `shrink-0 rounded px-3 py-2 text-left text-sm transition-colors hover:bg-sorbet-sage/35 md:mx-auto md:mb-2 md:w-[85%] md:px-4 ${
      activeView === view ? "bg-sorbet-sage/35 font-medium" : ""
    }`;

  return (
    <main className="flex min-h-screen w-full flex-col bg-sorbet-white text-sorbet-ink md:h-screen md:flex-row md:overflow-hidden">
      <div className="flex w-full shrink-0 flex-row flex-wrap border-b border-sorbet-gray bg-sorbet-sage-soft px-3 pb-3 md:h-full md:w-56 md:flex-col md:border-r md:border-b-0 md:px-0 md:pb-0">
        <h1 className="w-full px-4 py-4 text-center text-2xl font-bold sm:text-3xl md:py-[23px] md:text-[35px]">
          TaskSetter
        </h1>
        <button
          onClick={() => setActiveView("overview")}
          aria-pressed={activeView === "overview"}
          className={navigationButtonClass("overview")}
        >
          Overview
        </button>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto md:flex-none md:flex-col md:pt-[23px] md:pb-45">
          <button
            onClick={() => setActiveView("todo")}
            aria-pressed={activeView === "todo"}
            className={navigationButtonClass("todo")}
          >
            To Do
          </button>

          <button
            onClick={() => setActiveView("in_progress")}
            aria-pressed={activeView === "in_progress"}
            className={navigationButtonClass("in_progress")}
          >
            In Progress
          </button>

          <button
            onClick={() => setActiveView("in_review")}
            aria-pressed={activeView === "in_review"}
            className={navigationButtonClass("in_review")}
          >
            In Review
          </button>

          <button
            onClick={() => setActiveView("done")}
            aria-pressed={activeView === "done"}
            className={navigationButtonClass("done")}
          >
            Done
          </button>
        </div>
      </div>

      {taskError && <p className="mt-4 text-sorbet-rose">{taskError}</p>}

      <div className="relative flex min-w-0 flex-1 flex-col md:min-h-0 md:overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-sorbet-gray bg-sorbet-white px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:px-8 md:py-5">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search tasks..."
            className="w-full rounded-lg border border-sorbet-gray bg-sorbet-white px-3 py-2 text-base outline-none focus:border-sorbet-sage sm:text-sm md:w-64"
          />
          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <div ref={membersMenuRef} className="relative">
              <button
                onClick={() => setIsManageMembersOpen((open) => !open)}
                className="rounded-lg border border-sorbet-gray px-4 py-2 font-medium text-sorbet-ink shadow-sm hover:bg-sorbet-mist"
              >
                Manage members
              </button>
              {isManageMembersOpen && (
                <form
                  className="absolute right-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-80 rounded-lg border border-sorbet-gray bg-sorbet-white p-3 shadow-xl"
                  onSubmit={async (event) => {
                    event.preventDefault();

                    if (!newMemberName.trim() || !user) return;

                    const { data, error } = await supabase
                      .from("team_members")
                      .insert({
                        name: newMemberName.trim(),
                        user_id: user.id,
                      color: newMemberColor,
                      })
                      .select()
                      .single();

                    if (error) {
                      setTaskError(error.message);
                      return;
                    }

                    setTeamMembers((currentMembers) => [...currentMembers, data]);
                    setNewMemberName("");
                    setNewMemberColor("#b7c396");
                  }}
                >
                  <div className="flex gap-2">
                    <input
                      value={newMemberName}
                      onChange={(event) => setNewMemberName(event.target.value)}
                      placeholder="Team member name"
                      className="min-w-0 flex-1 rounded-md border border-sorbet-gray px-3 py-2 text-sm focus:border-sorbet-sage focus:outline-none"
                    />
                    <label className="shrink-0" title="Member color">
                      <span className="sr-only">Member color</span>
                      <input
                        type="color"
                        value={newMemberColor}
                        onChange={(event) => setNewMemberColor(event.target.value)}
                        className="h-10 w-10 cursor-pointer rounded-md border border-sorbet-gray bg-sorbet-white p-1"
                      />
                    </label>
                    <button
                      type="submit"
                      className="shrink-0 rounded-md bg-sorbet-sage px-3 py-2 text-sm font-medium hover:bg-sorbet-rose"
                    >
                      Add
                    </button>
                  </div>

                  <div className="mt-3 border-t border-sorbet-gray pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sorbet-ink/60">
                      Members
                    </p>
                    {teamMembers.length === 0 ? (
                      <p className="text-sm text-sorbet-ink/60">
                        No members yet.
                      </p>
                    ) : (
                      <ul className="max-h-48 space-y-1 overflow-y-auto">
                        {teamMembers.map((member) => (
                          <li
                            key={member.id}
                            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-sorbet-mist"
                          >
                            <span className="flex min-w-0 items-center gap-2 text-sm">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: member.color }}
                              />
                              <span className="truncate">{member.name}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(member)}
                              disabled={deletingMemberId === member.id}
                              className="text-xs font-medium text-sorbet-rose hover:underline disabled:opacity-50"
                            >
                              {deletingMemberId === member.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </form>
              )}
            </div>
            <div ref={menuRef} className="relative">
            <button
              onClick={() => {
                setIsFormOpen(!isFormOpen);
              }}
              className="rounded-lg bg-sorbet-sage px-4 py-2 font-medium text-sorbet-ink shadow-sm hover:bg-sorbet-rose"
            >
              Add Task
            </button>

            {isFormOpen && (
              <form
                onSubmit={handleTaskSubmit}
                className="absolute right-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-96 rounded-xl border border-sorbet-gray bg-sorbet-white p-5 shadow-xl"
              >
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                  placeholder="Task title"
                  className="mb-3 block w-full rounded-md border-sorbet-gray bg-sorbet-white px-3 py-2.5 shadow-sm focus:border-sorbet-sage focus:ring-sorbet-sage sm:text-sm"
                />

                <textarea
                  value={newTaskDescription}
                  onChange={(event) =>
                    setNewTaskDescription(event.target.value)
                  }
                  placeholder="Task description"
                  className="mb-3 block min-h-28 w-full rounded-md border-sorbet-gray bg-sorbet-white px-3 py-2.5 shadow-sm focus:border-sorbet-sage focus:ring-sorbet-sage sm:text-sm"
                />

                <select
                  value={newTaskPriority}
                  onChange={(event) =>
                    setNewTaskPriority(
                      event.target.value as "low" | "normal" | "high",
                    )
                  }
                  className="mb-3 block w-full rounded-md border-sorbet-gray bg-sorbet-white px-3 py-2.5 shadow-sm focus:border-sorbet-sage focus:ring-sorbet-sage sm:text-sm"
                >
                  <option value="low">Low priority</option>
                  <option value="normal">Normal priority</option>
                  <option value="high">High priority</option>
                </select>

                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(event) => setNewTaskDueDate(event.target.value)}
                  className="mb-4 block w-full rounded-md border-sorbet-gray bg-sorbet-white px-3 py-2.5 shadow-sm focus:border-sorbet-sage focus:ring-sorbet-sage sm:text-sm"
                />
                <div className="mb-4 flex items-center gap-2">
                  <select
                    value={selectedAssigneeId}
                    onChange={(event) =>
                      setSelectedAssigneeId(event.target.value)
                    }
                    className="block min-w-0 flex-1 rounded-md border border-sorbet-gray bg-sorbet-white px-3 py-2.5"
                  >
                    <option value="">Unassigned</option>

                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  {newTaskAssignee && (
                    <span
                      className="h-9 w-9 shrink-0 rounded-full border-2 border-sorbet-white shadow-sm"
                      style={{ backgroundColor: newTaskAssignee.color }}
                      title={`${newTaskAssignee.name}'s color`}
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="mr-2 rounded-md border border-sorbet-gray px-4 py-2.5 hover:bg-sorbet-mist"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingTask || !newTaskTitle.trim()}
                  className="rounded-md bg-sorbet-sage px-4 py-2.5 text-sorbet-ink hover:bg-sorbet-rose disabled:opacity-50"
                >
                  {isSavingTask ? "Creating..." : "Create task"}
                </button>
              </form>
            )}
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <DragDropProvider
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div
              className={`grid min-h-full gap-4 p-4 sm:gap-5 sm:p-6 md:p-8 ${
                activeView === "overview"
                  ? "grid-cols-1 md:grid-cols-2 2xl:grid-cols-4"
                  : "grid-cols-1"
              }`}
            >
              {visibleColumns.map((column) => {
                const normalizedSearch = searchQuery.trim().toLowerCase();

                const columnTasks = tasks
                  .filter((task) => {
                    const matchesColumn = task.status === column.status;

                    const matchesSearch =
                      task.title.toLowerCase().includes(normalizedSearch) ||
                      task.description
                        ?.toLowerCase()
                        .includes(normalizedSearch);

                    return matchesColumn && matchesSearch;
                  })
                  .sort((a, b) => a.position - b.position);
                return (
                  <BoardColumn
                    key={column.status}
                    title={column.title}
                    status={column.status}
                  >
                    {tasks.length > 0 &&
                      columnTasks.length === 0 &&
                      searchQuery && (
                        <p className="text-sm text-sorbet-ink/60">
                          No matching tasks in this column.
                        </p>
                      )}

                    {columnTasks.length === 0 && !searchQuery && (
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
                        teamMembers={teamMembers}
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
                            currentTasks.filter(
                              (task) => task.id !== deletedTaskId,
                            ),
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
