import React from 'react';

import { cn, formatTextInput } from '@/lib/utils';

const Input = React.forwardRef(({ className, type, autoFormat = true, onBlur, onChange, ...props }, ref) => {
  const handleBlur = (e) => {
    // Sadece text input'lar için formatlama yap (number, date, email, password vb. hariç)
    if (autoFormat && type !== 'number' && type !== 'date' && type !== 'datetime-local' && 
        type !== 'email' && type !== 'password' && type !== 'url' && type !== 'tel' && 
        type !== 'time' && type !== 'month' && type !== 'week' && !type) {
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
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      onBlur={handleBlur}
      onChange={onChange}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };