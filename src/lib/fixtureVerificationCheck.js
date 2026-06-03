import { supabase } from '@/lib/customSupabaseClient';

const IN_USE_STATUSES = ['Aktif', 'Uygunsuz', 'Devreye Alma Bekleniyor'];

const isVerificationOverdue = (fixture, today) => {
    if (!fixture.next_verification_date) return true;
    const next = new Date(fixture.next_verification_date);
    if (Number.isNaN(next.getTime())) return true;
    next.setHours(0, 0, 0, 0);
    return next < today;
};

const hasNeverBeenVerified = (fixture) => {
    if (fixture.status === 'Devreye Alma Bekleniyor') return true;
    if (!fixture.last_verification_date) return true;
    const verCount = fixture.fixture_verifications?.length ?? 0;
    return verCount === 0;
};

const formatFixtureLabel = (fixture, suffix) =>
    `${fixture.fixture_no || fixture.id}${suffix ? ` (${suffix})` : ''}`;

/**
 * Parça kodu için kullanımdaki fikstürlerde doğrulama eksikliği veya süresi dolmuş mu?
 * @returns {Promise<{ blocked: boolean, fixtures: object[], message: string|null, reason: 'none'|'never_verified'|'overdue'|'both' }>}
 */
export async function checkFixtureVerificationForPartCode(partCode) {
    const code = String(partCode || '').trim();
    if (!code) {
        return { blocked: false, fixtures: [], message: null, reason: 'none' };
    }

    const { data, error } = await supabase
        .from('fixtures')
        .select(
            'id, fixture_no, part_code, part_name, next_verification_date, last_verification_date, status, fixture_verifications(id)'
        )
        .eq('part_code', code)
        .in('status', IN_USE_STATUSES);

    if (error) throw error;

    const fixtures = data || [];
    if (fixtures.length === 0) {
        return { blocked: false, fixtures: [], message: null, reason: 'none' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const neverVerified = fixtures.filter(hasNeverBeenVerified);
    const overdueOnly = fixtures.filter(
        (f) => !hasNeverBeenVerified(f) && isVerificationOverdue(f, today)
    );
    const blockedFixtures = [
        ...new Map(
            [...neverVerified, ...overdueOnly].map((f) => [f.id, f])
        ).values(),
    ];

    if (blockedFixtures.length === 0) {
        return { blocked: false, fixtures: [], message: null, reason: 'none' };
    }

    const parts = [];

    if (neverVerified.length > 0) {
        const labels = neverVerified
            .map((f) => formatFixtureLabel(f, f.status === 'Devreye Alma Bekleniyor' ? 'devreye alma bekliyor' : 'doğrulama yapılmamış'))
            .join('; ');
        parts.push(`Henüz doğrulama yapılmamış fikstür(ler): ${labels}`);
    }

    if (overdueOnly.length > 0) {
        const labels = overdueOnly
            .map((f) => {
                const next = f.next_verification_date
                    ? new Date(f.next_verification_date).toLocaleDateString('tr-TR')
                    : 'belirtilmemiş';
                return formatFixtureLabel(f, `sonraki doğrulama: ${next}`);
            })
            .join('; ');
        parts.push(`Doğrulama süresi geçmiş fikstür(ler): ${labels}`);
    }

    const reason =
        neverVerified.length > 0 && overdueOnly.length > 0
            ? 'both'
            : neverVerified.length > 0
              ? 'never_verified'
              : 'overdue';

    return {
        blocked: true,
        fixtures: blockedFixtures,
        reason,
        message: `Bu parça kodu fikstürde üretiliyor. ${parts.join(' ')} Önce fikstür doğrulamasını tamamlayın.`,
    };
}
