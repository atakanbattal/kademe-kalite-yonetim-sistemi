import React from 'react';

import { cn, formatTextInput } from '@/lib/utils';

const Textarea = React.forwardRef(({ className, autoFormat = true, onBlur, onChange, ...props }, ref) => {
  const handleBlur = (e) => {
    if (autoFormat) {
      const formatted = formatTextInput(e.target.value);
      if (formatted !== e.target.value) {
        e.target.value = formatted;
        // onChange event'ini tetikle ki form state güncellensin
        if (onChange) {
          const syntheticEvent = {
            ...e,
            target: { ...e.target, value: formatted }
          };
          onChange(syntheticEvent);
        }
      }
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      onBlur={handleBlur}
      onChange={onChange}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };