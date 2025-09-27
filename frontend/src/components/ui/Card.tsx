import { cn } from '../../lib/utils';

export default function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-white/5 border border-white/10 rounded-xl shadow-sm', className)} {...props} />;
}
