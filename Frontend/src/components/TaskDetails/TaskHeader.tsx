import { HiArrowLeft, HiPencil, HiTrash } from "react-icons/hi2";

type TaskHeaderProps = {
  isOwner: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete?: () => void;
};

export function TaskHeader({
  isOwner,
  onBack,
  onEdit,
  onDelete,
}: TaskHeaderProps) {
  return (
    <header className="task-details-header">
      <button
        type="button"
        className="task-details-icon"
        onClick={onBack}
        aria-label="Go back"
      >
        <HiArrowLeft />
      </button>
      <div className="task-details-header-mai">
        <h2 className="task-details-title">Task Details</h2>
      </div>

      <div className="task-details-header-actions">
        {isOwner && (
          <>
            <button
              type="button"
              className="icon-button task-details-icon"
              onClick={onEdit}
              aria-label="Edit task"
              style={{ fontSize: "16px" }}
            >
              <HiPencil />
            </button>
            {onDelete && (
              <button
                type="button"
                className="icon-button task-details-icon"
                onClick={onDelete}
                aria-label="Delete task"
                style={{ fontSize: "16px", color: "#ef4444" }}
              >
                <HiTrash />
              </button>
            )}
          </>
        )}
      </div>
    </header>
  );
}
