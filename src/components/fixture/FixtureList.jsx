import React from 'react';
import {
    Edit,
    Eye,
    CheckSquare,
    RotateCcw,
    AlertTriangle,
    Trash2,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const statusConfig = {
    'Aktif': { variant: 'default', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    'Devreye Alma Bekleniyor': { variant: 'secondary', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    'Uygunsuz': { variant: 'destructive', className: 'bg-red-100 text-red-700 border-red-200' },
    'Revizyon Beklemede': { variant: 'outline', className: 'bg-purple-100 text-purple-700 border-purple-200' },
    'Hurdaya Ayrılmış': { variant: 'outline', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const criticalityConfig = {
    'Kritik': 'bg-orange-100 text-orange-700 border-orange-200',
    'Standart': 'bg-slate-100 text-slate-600 border-slate-200',
};

const getVerificationStatus = (fixture) => {
    if (fixture.status !== 'Aktif' || !fixture.next_verification_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextDate = new Date(fixture.next_verification_date);
    const diffMs = nextDate - today;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `${Math.abs(diffDays)} gün geçti`, className: 'text-red-600' };
    if (diffDays <= 7) return { text: `${diffDays} gün kaldı`, className: 'text-amber-600' };
    if (diffDays <= 30) return { text: `${diffDays} gün kaldı`, className: 'text-amber-500' };
    return { text: `${diffDays} gün kaldı`, className: 'text-muted-foreground' };
};

const SortIcon = ({ column, sortConfig }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
    return sortConfig.direction === 'asc'
        ? <ArrowUp className="ml-1 h-3 w-3" />
        : <ArrowDown className="ml-1 h-3 w-3" />;
};

const FixtureList = ({
    fixtures,
    onView,
    onEdit,
    onVerify,
    onRevise,
    onScrap,
    sortConfig,
    onSort,
}) => {
    if (!fixtures || fixtures.length === 0) {
        return (
            <div className="text-center py-16 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">Fikstür kaydı bulunamadı</p>
                <p className="text-sm">Yeni fikstür eklemek için &quot;Yeni Fikstür Ekle&quot; butonuna tıklayın.</p>
            </div>
        );
    }

    const cols = [
        { key: 'fixture_no', label: 'Fikstür No' },
        { key: 'part_code', label: 'Parça Kodu' },
        { key: 'criticality_class', label: 'Sınıf' },
        { key: 'status', label: 'Durum' },
        { key: 'last_verification_date', label: 'Son Doğrulama' },
        { key: 'next_verification_date', label: 'Sonraki Doğrulama' },
    ];

    return (
        <TooltipProvider delayDuration={250}>
            <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="data-table document-module-table w-full text-sm">
                        <thead>
                            <tr>
                                {cols.map((col) => (
                                    <th
                                        key={col.key}
                                        className="text-left cursor-pointer hover:text-foreground select-none"
                                        onClick={() => onSort(col.key)}
                                    >
                                        <div className="flex items-center">
                                            {col.label}
                                            <SortIcon column={col.key} sortConfig={sortConfig} />
                                        </div>
                                    </th>
                                ))}
                                <th className="text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fixtures.map((fixture, idx) => {
                                const vStatus = getVerificationStatus(fixture);
                                const statusCfg = statusConfig[fixture.status] || {};
                                const critCfg = criticalityConfig[fixture.criticality_class] || '';
                                const isScrapped = fixture.status === 'Hurdaya Ayrılmış';

                                return (
                                    <tr
                                        key={fixture.id}
                                        className={`transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/5'}`}
                                    >
                                        <td className="font-mono font-medium text-primary">
                                            {fixture.fixture_no}
                                        </td>
                                        <td>
                                            <div className="font-medium">{fixture.part_code}</div>
                                            {fixture.part_name && (
                                                <div className="text-xs text-muted-foreground truncate max-w-[160px]">{fixture.part_name}</div>
                                            )}
                                        </td>
                                        <td>
                                            <Badge variant="outline" className={`text-xs ${critCfg}`}>
                                                {fixture.criticality_class}
                                            </Badge>
                                        </td>
                                        <td>
                                            <Badge variant="outline" className={`text-xs ${statusCfg.className}`}>
                                                {fixture.status}
                                            </Badge>
                                        </td>
                                        <td className="text-muted-foreground">
                                            {fixture.last_verification_date
                                                ? new Date(fixture.last_verification_date).toLocaleDateString('tr-TR')
                                                : <span className="text-xs italic">Henüz yapılmadı</span>
                                            }
                                        </td>
                                        <td>
                                            {fixture.next_verification_date ? (
                                                <div>
                                                    <div className="text-muted-foreground">
                                                        {new Date(fixture.next_verification_date).toLocaleDateString('tr-TR')}
                                                    </div>
                                                    {vStatus && (
                                                        <div className={`text-xs font-medium ${vStatus.className}`}>
                                                            {vStatus.text}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs italic text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="align-middle">
                                            <div className="inline-flex items-center justify-end gap-0.5">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                            aria-label="Detay"
                                                            onClick={() => onView(fixture)}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom">Detay</TooltipContent>
                                                </Tooltip>
                                                {!isScrapped && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                                aria-label="Diğer işlemler"
                                                            >
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-56">
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-sm"
                                                                onClick={() => onEdit(fixture)}
                                                            >
                                                                <Edit className="mr-2 h-4 w-4 shrink-0" />
                                                                Düzenle
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-sm"
                                                                onClick={() => onVerify(fixture)}
                                                            >
                                                                <CheckSquare className="mr-2 h-4 w-4 shrink-0" />
                                                                Doğrulama yap
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-sm"
                                                                onClick={() => onRevise(fixture)}
                                                            >
                                                                <RotateCcw className="mr-2 h-4 w-4 shrink-0" />
                                                                Revizyon kaydet
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="cursor-pointer text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
                                                                onClick={() => onScrap(fixture)}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4 shrink-0" />
                                                                Hurdaya ayır
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </TooltipProvider>
    );
};

export default FixtureList;
