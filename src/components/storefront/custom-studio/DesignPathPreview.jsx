import React from "react";

// Original, self-contained preview art. Existing GDP template art is shown in the
// bootleg/memorial mockups; these illustrations are NOT production print previews.
const SCENES = {
  seasonal: { shirt: "#214A38", trim: "#193A30", outline: "#16392E", ink: "#F8EFE4" },
  bootleg: { shirt: "#181924", trim: "#0B1020", outline: "#161621", ink: "#FFFFFF" },
  memorial: { shirt: "#1C2028", trim: "#10141B", outline: "#191B24", ink: "#FFF2E7" },
  upload: { shirt: "#FFFFFF", trim: "#E4E9ED", outline: "#CBD6DE", ink: "#263A58" },
};

function Shirt({ type }) {
  const theme = SCENES[type] || SCENES.upload;
  const shirtPath = "M118 37 L147 22 Q175 44 203 22 L232 37 L279 71 L253 110 L225 91 L225 226 L125 226 L125 91 L97 110 L71 71 Z";
  const clip = "gdp-design-shirt-" + type;
  return (
    <g>
      <defs><clipPath id={clip}><path d={shirtPath} /></clipPath></defs>
      <ellipse cx="175" cy="224" rx="86" ry="12" fill="#151927" opacity=".15" />
      <path d={shirtPath} fill={theme.shirt} stroke={theme.outline} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M147 22 Q175 62 203 22" fill="none" stroke={theme.trim} strokeWidth="5" strokeLinecap="round" />
      <path d="M125 215 H225 M71 71 L97 110 M253 110 L279 71" stroke={theme.trim} strokeWidth="2" fill="none" opacity=".7" />
      {type === "seasonal" && (
        <g clipPath={"url(#" + clip + ")"}>
          <circle cx="172" cy="117" r="29" fill="#ECA94D" />
          <circle cx="172" cy="117" r="16" fill="#F2C876" />
          <path d="M171 88 L171 75 M171 160 L171 146 M142 117 L129 117 M214 117 L200 117 M150 95 L141 86 M201 148 L192 139 M151 139 L142 148 M200 86 L192 94" stroke="#F5D89F" strokeWidth="5" strokeLinecap="round" />
          <path d="M133 163 Q165 131 201 162 Q183 153 175 178 Q159 151 133 163Z" fill="#71B692" />
          <path d="M135 180 Q167 157 211 182" fill="none" stroke="#E47E45" strokeWidth="6" strokeLinecap="round" />
          <text x="175" y="197" fontSize="13" fill="#FFF6DB" fontWeight="900" textAnchor="middle" fontFamily="Arial, sans-serif">ALL YEAR</text>
          <circle cx="139" cy="148" r="8" fill="#FFE6AD" />
          <circle cx="210" cy="150" r="7" fill="#F2A4AC" />
        </g>
      )}
      {type === "bootleg" && (
        <g clipPath={"url(#" + clip + ")"}>
          <rect x="131" y="83" width="88" height="101" rx="4" fill="#6F25B5" />
          <image href="/images/gdp-styles/flame-neon.webp" x="131" y="83" width="88" height="101" preserveAspectRatio="xMidYMid slice" opacity=".65" />
          <circle cx="158" cy="127" r="17" fill="#B9A6D1" />
          <path d="M134 168 Q158 137 182 168" fill="#E0C0F4" />
          <circle cx="197" cy="130" r="13" fill="#C4ADD9" />
          <path d="M178 163 Q195 142 218 164" fill="#2B204B" />
          <text x="175" y="100" fill="white" textAnchor="middle" fontSize="12" fontWeight="900" fontFamily="Arial, sans-serif">CUSTOM</text>
          <text x="175" y="194" fill="#F5A4FB" textAnchor="middle" fontSize="11" fontWeight="900" fontFamily="Arial, sans-serif">LEGEND</text>
        </g>
      )}
      {type === "memorial" && (
        <g clipPath={"url(#" + clip + ")"}>
          <image href="/images/gdp-styles/memorial-everlasting-bloom.avif" x="130" y="75" width="90" height="115" preserveAspectRatio="xMidYMid meet" opacity=".76" />
          <path d="M146 148 Q129 131 147 117 Q151 130 163 135 M204 148 Q220 131 203 117 Q199 130 187 135" fill="none" stroke="#EEDCE5" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="175" cy="128" r="24" fill="#BCA6AD" stroke="#F5DFE6" strokeWidth="2" />
          <path d="M163 122 Q163 102 177 108 Q190 108 187 125 L181 132 L167 132Z" fill="#675B65" />
          <path d="M166 129 Q175 144 184 129 L184 135 Q175 151 166 135Z" fill="#F0D9C5" />
          <path d="M147 161 Q173 140 203 161 L203 167 L147 167Z" fill="#CFB9CD" />
          <text x="175" y="93" textAnchor="middle" fill="#FFF3EF" fontSize="12" fontStyle="italic" fontFamily="Georgia, serif">In Loving</text>
          <text x="175" y="185" textAnchor="middle" fill="#FFF3EF" fontSize="15" fontStyle="italic" fontFamily="Georgia, serif">Memory</text>
        </g>
      )}
      {type === "upload" && (
        <g clipPath={"url(#" + clip + ")"}>
          <rect x="139" y="94" width="73" height="92" rx="4" fill="#F2F7FA" stroke="#4A6683" strokeDasharray="5 4" strokeWidth="2.5" />
          <path d="M163 132 L175 120 L187 132 M175 121 V147 M162 145 V156 H188 V145" fill="none" stroke="#234266" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="175" y="169" textAnchor="middle" fill="#234266" fontSize="9" fontWeight="900" fontFamily="Arial, sans-serif">UPLOAD</text>
          <text x="175" y="178" textAnchor="middle" fill="#234266" fontSize="8" fontWeight="900" fontFamily="Arial, sans-serif">YOUR ART</text>
        </g>
      )}
    </g>
  );
}

export default function DesignPathPreview({ type }) {
  return (
    <svg className="h-full w-full" viewBox="0 0 350 236" preserveAspectRatio="xMidYMid meet" focusable="false" aria-hidden="true">
      {type === "seasonal" && (
        <g>
          <circle cx="287" cy="46" r="21" fill="#F8B958" opacity=".7" />
          <path d="M287 12 V28 M287 65 V81 M253 46 H269 M305 46 H321" stroke="#E79A41" strokeWidth="5" strokeLinecap="round" />
          <path d="M53 48 L65 75 L91 70 L70 87 L81 107 L59 93 L43 109 L45 85 L24 74 L51 73Z" fill="#EE9858" />
          <path d="M267 183 L274 198 L290 197 L278 208 L285 224 L270 214 L255 225 L261 209 L248 199 L265 198Z" fill="#E8A54A" />
          <path d="M326 135 L326 170 M310 143 L342 163 M342 143 L310 163" stroke="#BBD9E6" strokeWidth="4" strokeLinecap="round" />
          <circle cx="323" cy="88" r="11" fill="#FFFFFF" opacity=".7" />
        </g>
      )}
      {type === "bootleg" && (
        <g>
          <path d="M31 168 L68 149 M22 187 L86 154 M294 48 L325 24 M295 62 L338 40" stroke="#A76BFF" strokeWidth="5" opacity=".7" />
          <path d="M299 85 L324 70 L318 98 L337 112" fill="none" stroke="#BD73FF" strokeWidth="4" strokeLinejoin="round" />
          <rect x="273" y="117" width="61" height="77" rx="4" fill="#EEEFF5" transform="rotate(9 303 156)" />
          <rect x="280" y="123" width="48" height="54" rx="2" fill="#7F74AB" transform="rotate(9 304 150)" />
          <circle cx="306" cy="145" r="14" fill="#BEB7E1" />
          <path d="M286 173 Q306 153 324 173" fill="#53447C" />
          <path d="M284 109 L281 103 L274 103 L281 100 L283 94 L286 100 L294 103 L287 106Z" fill="#D59EFC" />
        </g>
      )}
      {type === "memorial" && (
        <g>
          <circle cx="302" cy="40" r="34" fill="#F8D9E9" />
          <circle cx="302" cy="40" r="11" fill="#F4BB6C" />
          {Array.from({ length: 8 }, (_, index) => (
            <ellipse key={index} cx="302" cy="16" rx="10" ry="23" fill="#FFF7FC" stroke="#EDB4D5" strokeWidth="1.5" transform={"rotate(" + (index * 45) + " 302 40)"} />
          ))}
          <path d="M36 160 Q42 104 83 117 Q54 122 60 151Z" fill="#F9E6F5" stroke="#E8CAE0" />
          <path d="M305 156 Q321 121 339 137 Q321 143 321 169Z" fill="#FFF6FC" stroke="#F0D2E2" />
          <circle cx="47" cy="82" r="8" fill="#F7C3E2" />
          <circle cx="67" cy="91" r="6" fill="#F5B7D6" />
        </g>
      )}
      {type === "upload" && (
        <g>
          <path d="M21 83 Q55 58 100 96 M254 40 Q295 13 330 42 M288 209 L341 183" fill="none" stroke="#5BB7F1" strokeWidth="12" opacity=".35" strokeLinecap="round" />
          <circle cx="302" cy="69" r="12" fill="#B6E7FF" />
          <circle cx="38" cy="187" r="9" fill="#E3F5FF" />
          <path d="M25 136 Q55 117 73 131 L64 120 M73 131 L59 146" fill="none" stroke="#1B8FE4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      <g transform="rotate(-7 176 118)">
        <Shirt type={type} />
      </g>
    </svg>
  );
}
