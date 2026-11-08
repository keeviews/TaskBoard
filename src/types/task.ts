export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";

export type TaskPriority = "low" | "normal" | "high";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  user_id: string;
  created_at: string;
  position: number;
  assignee_id: string | null;
};

export type TeamMember = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  avatar_url: string | null;
  created_at: string;
};
