interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
}

export function Avatar({ src, alt, size = 24, className = "" }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          objectFit: "cover",
        }}
      />
    );
  }

  // Fallback: first letter in a gray circle
  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        backgroundColor: "#4b5563",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${size * 0.5}px`,
        color: "#fff",
      }}
      title={alt}
    >
      {alt.charAt(0).toUpperCase()}
    </div>
  );
}
