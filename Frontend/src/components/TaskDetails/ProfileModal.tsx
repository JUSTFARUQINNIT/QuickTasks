import { HiXMark, HiEnvelope } from "react-icons/hi2";

type ProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    avatarData?: string | null;
    role: string;
  } | null;
};

export function ProfileModal({ isOpen, onClose, profile }: ProfileModalProps) {
  if (!isOpen || !profile) return null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarContent = () => {
    if (profile.avatarData || profile.avatarUrl) {
      return (
        <img
          src={profile.avatarData || profile.avatarUrl || ""}
          alt={profile.name}
          className="profile-modal-avatar-img"
        />
      );
    }
    return getInitials(profile.name);
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
            <h3 className="profile-modal-name">{profile.name}</h3>
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
        </div>
      </div>
    </div>
  );
}
