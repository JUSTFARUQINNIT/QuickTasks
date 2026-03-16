type CommentInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
};

export function CommentInput({
  value,
  onChange,
  onSubmit,
  loading,
}: CommentInputProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && value.trim()) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="comment-input">
      <label htmlFor="new-comment">Add a comment</label>
      <textarea
        id="new-comment"
        className="tasks-input"
        rows={3}
        placeholder="Share an update, decision, or question with collaborators..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="comment-input-actions">
        <span className="comment-input-hint">
          Press Enter to add a new line, Ctrl/⌘+Enter to send.
        </span>
        <button
          type="button"
          className="comment-button-primary"
          onClick={onSubmit}
          disabled={loading || !value.trim()}
        >
          {loading ? "Sending..." : "Post comment"}
        </button>
      </div>
    </div>
  );
}
