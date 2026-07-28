type TomatoVariant = 1 | 2 | 3 | 4 | 5;

export function TomatoIcon({ variant = 2, size = 22, className = '' }: { variant?: TomatoVariant; size?: number; className?: string }) {
  return <img className={`tomato-icon ${className}`.trim()} src={`/tomatoes/tmt${variant}.png`} width={size} height={size} alt="" aria-hidden="true" />;
}
