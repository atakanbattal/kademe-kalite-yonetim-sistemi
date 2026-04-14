import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Standart liste tablosu sarmalayıcı — modül listelerinde tek tip görünüm.
 * İçerik: native `data-table` veya shadcn Table; yatay kaydırma gerekiyorsa `innerClassName` ile birleştirin.
 */
const ListTableShell = ({ children, className, innerClassName, noInner = false }) => {
    if (noInner) {
        return <div className={cn('list-table-shell', className)}>{children}</div>;
    }
    return (
        <div className={cn('list-table-shell', className)}>
            <div className={cn('list-table-shell-inner', innerClassName)}>{children}</div>
        </div>
    );
};

export default ListTableShell;
