import type { ReactNode } from "react";

export function EmptyLine({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-line">
      <h3 className="empty-line__title">{title}</h3>
      <p className="empty-line__body">{body}</p>
      {action}
    </div>
  );
}
