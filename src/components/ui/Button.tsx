import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const base =
  'inline-flex items-center justify-center gap-2 rounded-[8px] border font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap';

const variants: Record<ButtonVariant, string> = {
  primary:
    'border-accent bg-accent text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_24px_-18px_rgba(41,43,41,0.55)] hover:border-accent/90 hover:bg-accent/90',
  secondary:
    'border-line bg-paper text-ink hover:border-ink/25 hover:bg-surface2/60 hover:shadow-paper',
  ghost:
    'border-transparent bg-transparent text-muted hover:bg-surface2/60 hover:text-ink',
  danger:
    'border-danger/40 bg-transparent text-danger hover:border-danger hover:bg-danger-soft/70',
  quiet:
    'border-line bg-transparent text-ink hover:border-ink/25 hover:bg-surface2/60',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-[14px]',
  lg: 'h-12 px-5 text-[15px]',
  icon: 'h-9 w-9 p-0',
};

export function buttonClass(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      {...props}
    />
  );
});
