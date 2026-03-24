import React, { memo, useMemo } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, User, ChevronRight, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { getHumanReadableMessage, getActionBadge, getReadableTableName } from './auditLogHelpers';

const AuditLogEntryRow = memo(function AuditLogEntryRow({ log, isExpanded, onToggleExpand, onSelectLog }) {
  const humanMessage = useMemo(() => getHumanReadableMessage(log), [log]);

  return (
    <div className="flex gap-4 p-4 bg-card border rounded-lg hover:shadow-md transition-shadow duration-200 group">
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          log.action.startsWith('EKLEME')
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : log.action.startsWith('GÜNCELLEME')
              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              : log.action.startsWith('SİLME')
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        }`}
      >
        {humanMessage.actionIcon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-1">
          <p className="font-medium text-foreground group-hover:text-primary transition-colors">
            {humanMessage.message}
          </p>
          <Badge variant="outline" className="text-xs">
            {getReadableTableName(log.table_name)}
          </Badge>
        </div>

        {humanMessage.recordIdentifier && (
          <p className="text-xs text-muted-foreground mb-1 font-mono">{humanMessage.recordIdentifier}</p>
        )}

        {humanMessage.extraInfo && (
          <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
            <ChevronRight className="h-3 w-3" />
            {humanMessage.extraInfo}
          </p>
        )}

        {isExpanded && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg text-xs space-y-2">
            <div className="font-semibold text-foreground mb-2">Detaylı Bilgiler:</div>
            {humanMessage.recordInfo.name && (
              <div>
                <span className="font-medium">Ad:</span> {humanMessage.recordInfo.name}
              </div>
            )}
            {humanMessage.recordInfo.title && (
              <div>
                <span className="font-medium">Başlık:</span> {humanMessage.recordInfo.title}
              </div>
            )}
            {humanMessage.recordInfo.changedFields && humanMessage.recordInfo.changedFields.length > 0 && (
              <div>
                <span className="font-medium">Değişen Alanlar:</span>{' '}
                {humanMessage.recordInfo.changedFields.join(', ')}
              </div>
            )}
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => onSelectLog(log)}>
              <Eye className="h-3 w-3 mr-1" />
              Tüm Detayları Görüntüle
            </Button>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {log.user_full_name || 'Sistem'}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: tr })}
          </span>
          <span className="text-muted-foreground/60">
            {format(new Date(log.created_at), 'dd.MM.yyyy HH:mm', { locale: tr })}
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 self-start flex flex-col gap-2">
        {getActionBadge(log.action)}
        <Button variant="ghost" size="sm" onClick={() => onToggleExpand(log.id)} className="h-6 w-6 p-0">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
});

export default AuditLogEntryRow;
