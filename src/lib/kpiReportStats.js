import { subMonths } from 'date-fns';
import { getAutoKpiDisplayMeta } from '@/components/kpi/kpi-definitions';

/**
 * KPI kartı / raporu için güncel değer vs hedef uyumu (özet sayımları için).
 */
export function getKpiMeetsTarget(kpi) {
    const meta = getAutoKpiDisplayMeta(kpi);
    const dir = meta.target_direction ?? 'decrease';
    const c = kpi.current_value != null && kpi.current_value !== '' ? parseFloat(kpi.current_value) : NaN;
    const t = kpi.target_value != null && kpi.target_value !== '' ? parseFloat(kpi.target_value) : NaN;
    if (!Number.isFinite(c)) return null;
    if (!Number.isFinite(t)) return null;
    if (t === 0) return dir === 'decrease' ? c <= 0 : c >= 0;
    return dir === 'decrease' ? c <= t : c >= t;
}

/**
 * kpi_monthly_data satırlarından son 12 ay + trend metni üretir.
 * @param {Array<{ year: number, month: number, actual_value: unknown }>} rows
 * @param {'increase'|'decrease'} targetDirection
 * @param {string|null|undefined} unitLabel — örn. " adet"
 */
export function buildKpiReportPerformanceFromMonthly(rows, targetDirection, unitLabel) {
    const dir = targetDirection === 'increase' ? 'increase' : 'decrease';
    const unit = unitLabel && String(unitLabel).trim() ? String(unitLabel).trim() : '';
    const fmtNum = (n) =>
        Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
        const d = subMonths(now, i);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const ex = (rows || []).find((r) => r.year === y && r.month === m);
        const raw = ex?.actual_value;
        const actual = raw != null && raw !== '' ? parseFloat(raw) : null;
        months.push({ actual: Number.isFinite(actual) ? actual : null });
    }

    const vals = months.map((x) => x.actual).filter((v) => v != null && !Number.isNaN(v));
    if (vals.length === 0) {
        return {
            performance_lines: ['Son 12 ayda gerçekleşen (aylık) veri yok', 'Trend hesaplanamadı'],
        };
    }

    const avg12 = vals.reduce((a, b) => a + b, 0) / vals.length;
    const olderVals = months.slice(0, 6).map((x) => x.actual).filter((v) => v != null && !Number.isNaN(v));
    const newerVals = months.slice(6, 12).map((x) => x.actual).filter((v) => v != null && !Number.isNaN(v));
    const avgOld = olderVals.length ? olderVals.reduce((a, b) => a + b, 0) / olderVals.length : null;
    const avgNew = newerVals.length ? newerVals.reduce((a, b) => a + b, 0) / newerVals.length : null;

    let trend = 'Sabit';
    if (avgOld == null || avgNew == null || olderVals.length < 2 || newerVals.length < 2) {
        trend = 'Yetersiz veri (karşılaştırma için daha çok ay gerekli)';
    } else {
        const eps = Math.abs(avgOld) * 0.002 + 0.01;
        if (Math.abs(avgNew - avgOld) <= eps) {
            trend = 'Sabit';
        } else if (dir === 'decrease') {
            if (avgNew < avgOld) trend = 'İyileşiyor';
            else trend = 'Dikkat';
        } else {
            if (avgNew > avgOld) trend = 'İyileşiyor';
            else trend = 'Dikkat';
        }
    }

    const line1 = unit
        ? `Son 12 ay ort.: ${fmtNum(avg12)}${unit.startsWith(' ') ? unit : ` ${unit}`}`
        : `Son 12 ay ort.: ${fmtNum(avg12)}`;

    return {
        performance_lines: [line1, trend],
    };
}
