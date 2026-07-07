interface Props {
  segments: string[];
  onHome: () => void;
}

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="crumb-home"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3 3h5a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H3Z" />
      <path d="M17 3h-5a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h5Z" />
    </svg>
  );
}

export default function Breadcrumb({ segments, onHome }: Props) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <button className="crumb crumb-home-btn" onClick={onHome} title="Home">
        <HomeIcon />
      </button>
      {segments.map((seg, i) => (
        <span className="crumb-group" key={i}>
          <span className="crumb-sep">›</span>
          <span
            className={`crumb ${i === segments.length - 1 ? "current" : ""}`}
          >
            {seg}
          </span>
        </span>
      ))}
    </nav>
  );
}
