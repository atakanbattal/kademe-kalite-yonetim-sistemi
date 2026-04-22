import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import React from 'react';

const buttonVariants = cva(
	'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 touch-manipulation active:scale-[0.98]',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80',
				destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80',
				outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
				secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70',
				ghost: 'hover:bg-accent hover:text-accent-foreground active:bg-accent/80',
				link: 'text-primary underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-9 sm:h-10 px-3 sm:px-4 py-2 text-xs sm:text-sm',
				sm: 'h-8 sm:h-9 rounded-md px-2.5 sm:px-3 text-xs',
				lg: 'h-10 sm:h-11 rounded-md px-6 sm:px-8 text-sm',
				icon: 'h-9 w-9 sm:h-10 sm:w-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	const Comp = asChild ? Slot : 'button';
	return (
		<Comp
			className={cn(buttonVariants({ variant, size, className }))}
			ref={ref}
			{...props}
		/>
	);
});
Button.displayName = 'Button';

export { Button, buttonVariants };