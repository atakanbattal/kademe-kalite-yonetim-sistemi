import React from 'react';

import { cn, formatTextInput } from '@/lib/utils';

const Input = React.forwardRef(({ className, type, autoFormat = true, onBlur, onChange, onWheel, ...props }, ref) => {
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

  // Number input'larda mouse scroll ile değer değişimini engelle
  const handleWheel = (e) => {
    if (type === 'number') {
      e.target.blur();
    }
    if (onWheel) {
      onWheel(e);
    }
  };

  return (
    <input
      type={type}
      className={cn(
        'flex h-9 sm:h-10 w-full rounded-md border border-input bg-background px-2.5 sm:px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation',
        className
      )}
      ref={ref}
      onBlur={handleBlur}
      onChange={onChange}
      onWheel={handleWheel}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };