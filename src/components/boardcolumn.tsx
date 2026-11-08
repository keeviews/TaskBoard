import { useDragOperation, useDroppable } from "@dnd-kit/react";
import type { ReactNode } from "react";
import type { TaskStatus } from "../types/task";

type BoardColumnProps = {
  status: TaskStatus;
  title: string;
  children: ReactNode;
  expanded?: boolean;
};

function BoardColumn({
  title,
  status,
  children,
  expanded = false,
}: BoardColumnProps) {
  const droppable = useDroppable({
    id: status,
    type: "column",
    accept: "task",
    data: { status },
  });
  const { target } = useDragOperation();
  const isActiveDropColumn =
    droppable.isDropTarget || target?.data.status === status;

  return (
    <section
      ref={droppable.ref}
      className={`min-h-[24rem] rounded-xl border p-4 transition-colors ${
        isActiveDropColumn
          ? "border-sorbet-sage bg-sorbet-sage-soft"
          : "border-sorbet-gray bg-sorbet-mist/65"
      }`}
    >
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-sorbet-ink">
        {title}
      </h2>

      <div
        className={
          expanded
            ? "grid grid-cols-1 gap-3 md:grid-cols-2"
            : "flex flex-col gap-3"
        }
      >
        {children}
      </div>
    </section>
  );
}

export default BoardColumn;
