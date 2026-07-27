/**
 * 本报徽记：一轮停在地平线上的月亮，同时也是一只将睁未睁的眼睛。
 * `blink` 打开时眼睑会偶尔合一下。
 */
export function MoonEye({ size = 36, blink = false }: { size?: number; blink?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="JONTOP 月眼徽记">
      <defs>
        <radialGradient id="me-moon" cx="42%" cy="36%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="62%" stopColor="#e8f0ff" />
          <stop offset="100%" stopColor="#b9cdf2" />
        </radialGradient>
        <radialGradient id="me-iris" cx="42%" cy="36%">
          <stop offset="0%" stopColor="#5b8def" />
          <stop offset="70%" stopColor="#2f6bff" />
          <stop offset="100%" stopColor="#0b2545" />
        </radialGradient>
        <clipPath id="me-clip">
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>

      <circle cx="50" cy="50" r="46" fill="#071a30" />
      <g clipPath="url(#me-clip)">
        {/* 月亮本体 = 眼白 */}
        <circle cx="50" cy="44" r="30" fill="url(#me-moon)" />
        {/* 环形山，也是虹膜的纹理 */}
        <circle cx="38" cy="32" r="4" fill="#cddcf6" opacity="0.75" />
        <circle cx="63" cy="38" r="2.6" fill="#cddcf6" opacity="0.6" />
        {/* 瞳孔 */}
        <circle cx="50" cy="44" r="12.5" fill="url(#me-iris)" />
        <circle cx="50" cy="44" r="5" fill="#04101f" />
        <circle cx="45.5" cy="39.5" r="2.6" fill="#ffffff" opacity="0.9" />
        {/* 地平线 = 下眼睑 */}
        <rect x="0" y="70" width="100" height="30" fill="#05101f" />
        <rect x="0" y="69" width="100" height="1.6" fill="#8fb4ff" opacity="0.85" />
        {blink && (
          <rect x="0" y="-40" width="100" height="60" fill="#05101f">
            <animate attributeName="y" values="-40;-40;24;-40;-40" dur="6s" repeatCount="indefinite" />
          </rect>
        )}
      </g>
      <circle cx="50" cy="50" r="46" fill="none" stroke="#2f6bff" strokeOpacity="0.35" strokeWidth="1.5" />
    </svg>
  );
}

/** 英雄区里那轮大月亮 */
export function MoonEyeLarge() {
  return (
    <svg viewBox="0 0 240 240" width="100%" height="100%" aria-hidden>
      <defs>
        <radialGradient id="hm-moon" cx="40%" cy="34%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="58%" stopColor="#e9f1ff" />
          <stop offset="100%" stopColor="#a7c1ec" />
        </radialGradient>
        <radialGradient id="hm-iris" cx="40%" cy="34%">
          <stop offset="0%" stopColor="#7aa5ff" />
          <stop offset="62%" stopColor="#2f6bff" />
          <stop offset="100%" stopColor="#0b2545" />
        </radialGradient>
      </defs>
      <circle cx="120" cy="120" r="106" fill="url(#hm-moon)" />
      <circle cx="78" cy="70" r="13" fill="#d3e0f7" opacity="0.7" />
      <circle cx="163" cy="96" r="8" fill="#d3e0f7" opacity="0.55" />
      <circle cx="96" cy="150" r="6" fill="#d3e0f7" opacity="0.5" />
      <circle cx="120" cy="120" r="46" fill="url(#hm-iris)">
        <animate attributeName="r" values="46;43;46" dur="6s" repeatCount="indefinite" />
      </circle>
      <circle cx="120" cy="120" r="19" fill="#04101f" />
      <circle cx="106" cy="106" r="9" fill="#ffffff" opacity="0.92" />
      <circle cx="134" cy="136" r="4" fill="#ffffff" opacity="0.45" />
    </svg>
  );
}
