import { cn } from '@/lib/utils'

interface AspectRatioProps extends React.ComponentProps<'div'> {
  /** Width ÷ height. Defaults to 16:9. */
  ratio?: number
}

/**
 * Reserves space for media at a fixed aspect ratio using the padding-bottom
 * trick, so the box doesn't jump while the image loads.
 */
function AspectRatio({ ratio = 16 / 9, className, style, children, ...props }: AspectRatioProps) {
  return (
    <div
      className={cn('relative w-full overflow-hidden', className)}
      style={{ paddingBottom: `${100 / ratio}%`, ...style }}
      {...props}
    >
      <div className="absolute inset-0">{children}</div>
    </div>
  )
}

export { AspectRatio }
