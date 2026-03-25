import { HiXMark, HiEnvelope, HiUserMinus } from "react-icons/hi2";

import { Avatar } from "../Avatar";

type ProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  canRemoveCollaborator?: boolean;
  isRemovingCollaborator?: boolean;
  onRemoveCollaborator?: (userId: string) => void;
  profile: {
    id: string;
    username?: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    avatarData?: string | null;
    role: string;
  } | null;
};

export function ProfileModal({
  isOpen,
  onClose,
  profile,
  canRemoveCollaborator = false,
  isRemovingCollaborator = false,
  onRemoveCollaborator,
}: ProfileModalProps) {
  if (!isOpen || !profile) return null;

  const displayName =
    profile.name?.trim() ||
    profile.username?.trim() ||
    profile.email.split("@")[0] ||
    profile.email;

  const getAvatarContent = () => {
    return (
      <Avatar
        src={profile.avatarData || profile.avatarUrl}
        alt={profile.name}
        size={80}
      />
    );
  };

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="profile-modal-close"
          onClick={onClose}
          aria-label="Close profile"
        >
          <HiXMark />
        </button>

        <div className="profile-modal-header">
          <div className="profile-modal-avatar">{getAvatarContent()}</div>

          <div className="profile-modal-info">
            <div className="">{displayName}</div>
            <p className="profile-modal-email">{profile.email}</p>
          </div>
        </div>

        <div className="profile-modal-role">
          <span className="profile-role-badge">{profile.role}</span>
        </div>

        <div className="profile-modal-actions">
          <button
            className="profile-modal-btn primary"
            onClick={() => {
              window.location.href = `mailto:${profile.email}`;
            }}
          >
            <HiEnvelope style={{ marginRight: "8px" }} />
            Send Email
          </button>
          {canRemoveCollaborator && onRemoveCollaborator && (
            <button
              className="profile-modal-btn danger"
              onClick={() => onRemoveCollaborator(profile.id)}
              disabled={isRemovingCollaborator}
            >
              <HiUserMinus style={{ marginRight: "8px" }} />
              {isRemovingCollaborator ? "Removing..." : "Remove Collaborator"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
