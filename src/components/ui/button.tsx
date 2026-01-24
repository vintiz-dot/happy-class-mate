import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 premium-click hover:scale-[1.02] active:transition-transform active:duration-100",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg backdrop-blur-xl",
        destructive: "glass-sm bg-destructive/90 text-destructive-foreground hover:bg-destructive shadow-md hover:shadow-lg",
        outline: "glass-sm hover:bg-warmGray hover:text-royalGreen dark:hover:bg-warmGray-dark dark:hover:text-royalGreen-light shadow-sm hover:shadow-md",
        secondary: "glass-sm bg-secondary/80 text-secondary-foreground hover:bg-secondary shadow-sm hover:shadow-md",
        ghost: "hover:glass-sm hover:bg-warmGray hover:text-royalGreen dark:hover:bg-warmGray-dark dark:hover:text-royalGreen-light",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, onMouseEnter, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Play click sound
      if (typeof window !== 'undefined' && !props.disabled) {
        import('@/lib/soundManager').then(({ soundManager }) => {
          soundManager.play('click');
        });
      }
      onClick?.(e);
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Play subtle hover sound
      if (typeof window !== 'undefined' && !props.disabled) {
        import('@/lib/soundManager').then(({ soundManager }) => {
          if (soundManager.getVolume() > 0.5) { // Only on higher volume settings
            soundManager.play('hover');
          }
        });
      }
      onMouseEnter?.(e);
    };

    return (
      <Comp 
        className={cn(buttonVariants({ variant, size, className }))} 
        ref={ref} 
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        {...props} 
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
