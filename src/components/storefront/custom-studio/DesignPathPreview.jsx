import React from "react";

const previews = {
  seasonal: { a: "#F45F68", b: "#794456", shirt: "#FFF8E9", name: "SEASONAL", second: "MAGIC", ink: "#357259" },
  bootleg: { a: "#8755DE", b: "#27336F", shirt: "#242631", name: "PHOTO", second: "COLLAGES", ink: "#F2B3E4" },
  memorial: { a: "#9883AC", b: "#374B61", shirt: "#2B2D3B", name: "LOVING", second: "TRIBUTES", ink: "#E8D2C0" },
  upload: { a: "#24B1AD", b: "#2A66A3", shirt: "#FFF9EE", name: "YOUR ART", second: "YOUR WAY", ink: "#EA875D" }
};

export default function DesignPathPreview({ type }) {
  const p = previews[type] || previews.upload;
  const id = "studio-visual-" + type;
  return (
    <svg viewBox="0 0 480 185" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transform-none">
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="1" y2="0">
          <stop offset="0%" stopColor={p.a} />
          <stop offset="100%" stopColor={p.b} />
        </linearGradient>
      </defs>
      <rect width="480" height="185" fill={"url(#" + id + ")"} />
      <circle cx="454" cy="1" r="128" fill="#FFFFFF" opacity=".09" />
      <circle cx="24" cy="183" r="95" fill="#FFFFFF" opacity=".09" />
      <path d="M32 140 l6 -14 6 14 14 6 -14 6 -6 14 -6 -14 -14 -6 Z" fill="#FFFFFF" opacity=".5" />
      <text x="27" y="84" fontSize="30" fontFamily="Arial, sans-serif" fontWeight="900" fill="#FFFFFF">{p.name}</text>
      <text x="27" y="118" fontSize="30" fontFamily="Arial, sans-serif" fontWeight="900" fill="#FFFFFF">{p.second}</text>
      <text x="29" y="139" fontSize="10" fontFamily="Arial, sans-serif" fontWeight="700" letterSpacing="1.4" fill="#FFFFFF" opacity=".85">DESIGN INSPIRATION</text>
      <g transform="translate(263 -8) rotate(-6 94 101)">
        <ellipse cx="94" cy="191" rx="66" ry="7" fill="#16253A" opacity=".18" />
        <path d="M44 34 L72 20 Q94 35 116 20 L144 34 L170 66 L145 88 L130 73 L130 190 L58 190 L58 73 L43 88 L18 66 Z" fill={p.shirt} stroke="#C4C4C4" strokeOpacity=".42" strokeWidth="2" strokeLinejoin="round" />
        <path d="M72 20 Q94 51 116 20" fill="none" stroke="#ADADAD" strokeOpacity=".48" strokeWidth="3" />
        {type === "seasonal" && <g><path d="M94 70 L66 121 H122 Z" fill="#276B59" /><path d="M94 89 L72 132 H116 Z" fill="#4AA47A" /><circle cx="94" cy="78" r="5" fill="#F0B943" /><text x="94" y="150" textAnchor="middle" fill="#B64754" fontSize="15" fontWeight="900">JOY</text></g>}
        {type === "bootleg" && <g><rect x="65" y="74" width="58" height="71" rx="3" fill="#935BC2" /><circle cx="82" cy="100" r="12" fill="#E1A4C3" /><path d="M66 132 Q83 102 99 132" fill="#E1A4C3" /><circle cx="109" cy="101" r="12" fill="#87AFE3" /><text x="94" y="141" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="900">ICONIC</text></g>}
        {type === "memorial" && <g><ellipse cx="94" cy="111" rx="30" ry="37" fill="#544A5C" stroke="#DDC2B0" /><path d="M94 111 C77 95 76 119 94 134 C112 119 111 95 94 111Z" fill="#E8D2C0" /><text x="94" y="94" textAnchor="middle" fill="#F7E7D8" fontFamily="Georgia, serif" fontSize="9">Forever</text><text x="94" y="151" textAnchor="middle" fill="#F7E7D8" fontFamily="Georgia, serif" fontSize="9">Loved</text></g>}
        {type === "upload" && <g><rect x="65" y="73" width="58" height="74" rx="4" fill="#E4F0E9" /><circle cx="86" cy="98" r="19" fill="#F39B75" /><path d="M66 125 Q84 96 100 120 T123 111 V147 H66 Z" fill="#26A6AA" /><text x="94" y="157" textAnchor="middle" fill="#2A729D" fontSize="10" fontWeight="900">CREATE</text></g>}
      </g>
    </svg>
  );
}
