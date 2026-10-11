import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const spinnerVariants = cva('animate-spin rounded-full border-2 border-current border-t-transparent', {
  variants: {
    size: {
      sm: 'size-4',
      default: 'size-6',
      lg: 'size-8',
    },
  },
  defaultVariants: { size: 'default' },
})

function Spinner({
  className,
  size,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof spinnerVariants>) {
  return <div role="status" aria-label="Loading" className={cn(spinnerVariants({ size }), className)} {...props} />
}

export { Spinner }
