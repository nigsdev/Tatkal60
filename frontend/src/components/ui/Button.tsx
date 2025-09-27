import { cn } from '../../lib/utils';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'ghost' | 'outline' 
};

export default function Button({ className, variant = 'primary', ...props }: Props) {
  const base = 'inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-60 disabled:pointer-events-none transform hover:scale-105 active:scale-95';
  
  const styles = {
    primary: 'bg-gradient-to-r from-teal-400 to-teal-500 text-black hover:from-teal-300 hover:to-teal-400 focus:ring-teal-500 shadow-lg hover:shadow-teal-500/25',
    ghost: 'bg-white/10 text-white hover:bg-white/20 focus:ring-teal-500 border border-white/10 hover:border-white/20',
    outline: 'border border-white/15 text-white hover:bg-white/10 focus:ring-teal-500 hover:border-teal-400/50',
  }[variant];
  
  return <button className={cn(base, styles, className)} {...props} />;
}
