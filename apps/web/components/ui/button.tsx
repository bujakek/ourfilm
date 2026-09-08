import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-[transform,opacity,border-color,color,background-color] outline-none select-none active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'btn-shine bg-primary text-primary-foreground hover:scale-[1.02]',
        outline:
          'glass hover:border-strong border-border text-foreground hover:text-foreground',
        secondary:
          'glass hover:border-strong border-border text-foreground hover:text-foreground',
        ghost: 'text-muted-foreground hover:text-foreground',
        destructive: 'bg-destructive/90 text-foreground hover:bg-destructive',
        'destructive-outline':
          'border-destructive/40 text-destructive hover:border-destructive/70',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'min-h-11 px-5 text-sm',
        default: 'min-h-12 px-6 text-sm',
        lg: 'min-h-14 px-7 text-base',
        icon: 'size-11 p-0',
        'icon-lg': 'size-12 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
