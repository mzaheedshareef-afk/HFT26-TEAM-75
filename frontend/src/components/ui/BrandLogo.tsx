import { Link } from 'react-router-dom';
import { Terminal } from 'lucide-react';

interface BrandLogoProps {
  to?: string;
  size?: 'sm' | 'md';
}

export function BrandLogo({ to = '/', size = 'md' }: BrandLogoProps) {
  const iconBoxSize = size === 'sm' ? 'h-7 w-7 rounded-md' : 'h-8 w-8 rounded-lg';
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-4.5 w-4.5';
  const textSize = size === 'sm' ? 'text-base' : 'text-lg';

  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2.5 text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-md"
    >
      <span
        className={`inline-flex items-center justify-center bg-slate-900 text-white shadow-xs ${iconBoxSize}`}
      >
        <Terminal className={iconSize} strokeWidth={2.2} />
      </span>
      <span className={`font-semibold tracking-tight ${textSize}`}>
        Gate<span className="text-blue-600">Code</span>
      </span>
    </Link>
  );
}
