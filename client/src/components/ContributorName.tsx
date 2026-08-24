import type { ReactNode } from 'react';

export function ContributorName({ contributor, children, className = '' }: { contributor?: boolean; children: ReactNode; className?: string }) {
  return <span className={`${contributor ? 'contributor-name' : ''} ${className}`.trim()}>{children}</span>;
}
