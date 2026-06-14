export default function GameBoyIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Body */}
      <rect x="8" y="4" width="84" height="110" rx="10" ry="10" fill="#d4d0c8" />
      {/* Bottom rounded taper */}
      <path d="M8 90 Q8 114 32 126 L68 126 Q92 114 92 90 L92 114 Q92 130 76 130 L24 130 Q8 130 8 114 Z" fill="#d4d0c8" />
      <rect x="8" y="100" width="84" height="28" rx="14" fill="#d4d0c8" />

      {/* Screen bezel */}
      <rect x="18" y="12" width="64" height="54" rx="4" fill="#8a8880" />
      {/* Screen */}
      <rect x="24" y="18" width="52" height="42" rx="2" fill="#8bac0f" />
      {/* Screen glare */}
      <rect x="26" y="20" width="14" height="6" rx="1" fill="#9bbc0f" opacity="0.6" />

      {/* NINTENDO label */}
      <text x="50" y="75" textAnchor="middle" fontSize="7" fontFamily="Arial, sans-serif" fontWeight="bold" fill="#555" letterSpacing="1">NINTENDO</text>
      {/* GAME BOY label */}
      <text x="50" y="84" textAnchor="middle" fontSize="9.5" fontFamily="Arial, sans-serif" fontWeight="bold" fontStyle="italic" fill="#333" letterSpacing="0.5">GAME BOY</text>

      {/* D-pad vertical */}
      <rect x="22" y="92" width="10" height="30" rx="2" fill="#555" />
      {/* D-pad horizontal */}
      <rect x="17" y="97" width="20" height="10" rx="2" fill="#555" />
      {/* D-pad center */}
      <rect x="22" y="97" width="10" height="10" rx="1" fill="#444" />

      {/* A button */}
      <circle cx="73" cy="107" r="7" fill="#8b1a1a" />
      <text x="73" y="110.5" textAnchor="middle" fontSize="7" fontFamily="Arial, sans-serif" fontWeight="bold" fill="#fff">A</text>
      {/* B button */}
      <circle cx="57" cy="114" r="7" fill="#8b1a1a" />
      <text x="57" y="117.5" textAnchor="middle" fontSize="7" fontFamily="Arial, sans-serif" fontWeight="bold" fill="#fff">B</text>

      {/* Select button */}
      <rect x="32" y="126" width="12" height="5" rx="2.5" fill="#888" />
      {/* Start button */}
      <rect x="56" y="126" width="12" height="5" rx="2.5" fill="#888" />

      {/* Speaker dots */}
      <circle cx="80" cy="125" r="1.5" fill="#aaa" />
      <circle cx="85" cy="122" r="1.5" fill="#aaa" />
      <circle cx="80" cy="119" r="1.5" fill="#aaa" />
      <circle cx="85" cy="116" r="1.5" fill="#aaa" />
      <circle cx="80" cy="113" r="1.5" fill="#aaa" />
    </svg>
  );
}
