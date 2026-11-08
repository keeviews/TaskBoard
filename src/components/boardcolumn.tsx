import { useDroppable } from "@dnd-kit/react";
import type { ReactNode } from "react";
import type { TaskStatus } from "../types/task";

type BoardColumnProps = {
  status: TaskStatus;
  title: string;
  children: ReactNode;
};

function BoardColumn({ title, status, children }: BoardColumnProps) {
  const droppable = useDroppable({
    id: status,
    type: "column",
    accept: "task",
  });

  return (
    <section
      ref={droppable.ref}
      className={`min-h-[24rem] rounded-xl border p-4 transition-colors ${
        droppable.isDropTarget
          ? "border-sorbet-sage bg-sorbet-sage-soft"
          : "border-sorbet-gray bg-sorbet-mist/65"
      }`}
    >
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-sorbet-ink">
        {title}
      </h2>

      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export default BoardColumn;
