type Comment = {
  id: string;
  userLabel: string;
  text: string;
  createdAt: string;
};

type CommentListProps = {
  comments: Comment[];
};

export function CommentList({ comments }: CommentListProps) {
  if (comments.length === 0) {
    return (
      <span style={{ color: "#6b7280" }}>
        No comments yet. Start the conversation.
      </span>
    );
  }

  return (
    <ul
      className="comment-list"
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        maxHeight: 240,
        overflowY: "auto",
      }}
    >
      {comments.map((c) => (
        <li
          key={c.id}
          className="comment-item"
          style={{
            padding: "8px 0",
            borderBottom: "1px solid #1f2937",
          }}
        >
          <div
            className="comment-item-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "#9ca3af",
              marginBottom: 2,
            }}
          >
            <span>{c.userLabel}</span>
            {c.createdAt && (
              <span>
                {new Date(c.createdAt).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            )}
          </div>
          <div className="comment-item-body" style={{ fontSize: 13 }}>
            {c.text}
          </div>
        </li>
      ))}
    </ul>
  );
}
