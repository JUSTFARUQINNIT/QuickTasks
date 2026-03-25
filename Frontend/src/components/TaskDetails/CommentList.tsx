type Comment = {
  id: string;
  userLabel: string;
  text: string;
  createdAt: string;
  parentId?: string;
};

type CommentListProps = {
  comments: Comment[];
  onReply?: (id: string, userLabel: string) => void;
};

export function CommentList({ comments, onReply }: CommentListProps) {
  if (comments.length === 0) {
    return (
      <span style={{ color: "#6b7280" }}>
        No comments yet. Start the conversation.
      </span>
    );
  }

  const topLevelComments = comments.filter((c) => !c.parentId);
  const repliesByParentId = comments.reduce((acc, c) => {
    if (c.parentId) {
      if (!acc[c.parentId]) acc[c.parentId] = [];
      acc[c.parentId].push(c);
    }
    return acc;
  }, {} as Record<string, Comment[]>);

  const renderComment = (c: Comment, isReply = false, parentIdForReply?: string) => (
    <li
      key={c.id}
      className={`comment-item ${isReply ? "comment-reply" : ""}`}
      style={{
        padding: "8px 0",
        borderBottom: isReply ? "none" : "1px solid #1f2937",
        marginLeft: isReply ? "24px" : "0",
        borderLeft: isReply ? "2px solid #374151" : "none",
        paddingLeft: isReply ? "12px" : "0",
        marginTop: isReply ? "8px" : "0",
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
      {onReply && (
        <button
          type="button"
          onClick={() => onReply(parentIdForReply || c.id, c.userLabel)}
          style={{
            background: "none",
            border: "none",
            color: "#6b7280",
            fontSize: 11,
            cursor: "pointer",
            padding: 0,
            marginTop: 4,
          }}
        >
          Reply
        </button>
      )}
    </li>
  );

  return (
    <ul
      className="comment-list"
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        maxHeight: 400,
        overflowY: "auto",
      }}
    >
      {topLevelComments.map((c) => (
        <div key={`thread-${c.id}`} style={{ borderBottom: "1px solid #1f2937", paddingBottom: "8px" }}>
          {renderComment(c, false)}
          {repliesByParentId[c.id]?.map((reply) => renderComment(reply, true, c.id))}
        </div>
      ))}
    </ul>
  );
}
