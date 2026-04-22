import React from 'react';

import { cn } from '@/lib/utils';

const Textarea = React.forwardRef(({ className, autoFormat = false, onBlur, onChange, ...props }, ref) => {
  // autoFormat artık varsayılan olarak false - uzun metinler için formatlama yapılmaz
  // Eğer formatlama isteniyorsa, açıkça autoFormat={true} verilmeli
  
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      onBlur={onBlur}
      onChange={onChange}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };