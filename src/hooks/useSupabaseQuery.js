/**
 * useSupabaseQuery - Supabase veri çekme hook'u
 * Modül bazlı lazy data loading için kullanılır.
 * DataContext'i BOZMAZ - ek olarak modül-spesifik veri çekmek için kullanılır.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * @param {string} table - Supabase tablo adı
 * @param {Object} options
 * @param {string} options.select - Select query (default: '*')
 * @param {Object[]} options.filters - Filtre dizisi [{column, operator, value}]
 * @param {Object} options.order - Sıralama {column, ascending}
 * @param {number} options.limit - Kayıt limiti
 * @param {boolean} options.enabled - Query'nin çalışıp çalışmayacağı (default: true)
 * @param {boolean} options.realtime - Realtime subscription aktif mi (default: false)
 * @param {number} options.refetchInterval - Otomatik yenileme aralığı (ms, 0 = kapalı)
 */
export function useSupabaseQuery(table, {
    select = '*',
    filters = [],
    order = null,
    limit = null,
    enabled = true,
    realtime = false,
    refetchInterval = 0,
} = {}) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [count, setCount] = useState(0);
    const mountedRef = useRef(true);
    const intervalRef = useRef(null);

    const fetchData = useCallback(async () => {
        if (!table || !enabled) return;

        setLoading(true);
        setError(null);

        try {
            let query = supabase.from(table).select(select, { count: 'exact' });

            // Filtreleri uygula
            for (const filter of filters) {
                const { column, operator = 'eq', value } = filter;
                if (value === undefined || value === null) continue;
                
                switch (operator) {
                    case 'eq': query = query.eq(column, value); break;
                    case 'neq': query = query.neq(column, value); break;
                    case 'gt': query = query.gt(column, value); break;
                    case 'gte': query = query.gte(column, value); break;
                    case 'lt': query = query.lt(column, value); break;
                    case 'lte': query = query.lte(column, value); break;
                    case 'like': query = query.like(column, value); break;
                    case 'ilike': query = query.ilike(column, value); break;
                    case 'in': query = query.in(column, value); break;
                    case 'is': query = query.is(column, value); break;
                    case 'contains': query = query.contains(column, value); break;
                    default: query = query.eq(column, value);
                }
            }

            // Sıralama
            if (order) {
                query = query.order(order.column, { ascending: order.ascending ?? false });
            }

            // Limit
            if (limit) {
                query = query.limit(limit);
            }

            const { data: result, error: queryError, count: totalCount } = await query;

            if (!mountedRef.current) return;

            if (queryError) {
                // Tablo bulunamadı hatası - sessizce geç
                if (queryError.code === 'PGRST205' || queryError.code === '42P01') {
                    console.warn(`⚠️ Tablo "${table}" bulunamadı`);
                    setData([]);
                    setCount(0);
                } else {
                    setError(queryError);
                    console.error(`❌ ${table} query error:`, queryError);
                }
            } else {
                setData(result || []);
                setCount(totalCount || result?.length || 0);
            }
        } catch (err) {
            if (!mountedRef.current) return;
            setError(err);
            console.error(`❌ ${table} fetch error:`, err);
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [table, select, JSON.stringify(filters), JSON.stringify(order), limit, enabled]);

    // İlk yükleme
    useEffect(() => {
        mountedRef.current = true;
        fetchData();
        return () => { mountedRef.current = false; };
    }, [fetchData]);

    // Otomatik yenileme
    useEffect(() => {
        if (refetchInterval && refetchInterval > 0 && enabled) {
            intervalRef.current = setInterval(fetchData, refetchInterval);
            return () => clearInterval(intervalRef.current);
        }
    }, [refetchInterval, enabled, fetchData]);

    // Realtime subscription
    useEffect(() => {
        if (!realtime || !table || !enabled) return;

        const channel = supabase
            .channel(`${table}-realtime`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: table,
            }, () => {
                // Değişiklik algılandığında veriyi yenile
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [realtime, table, enabled, fetchData]);

    // Manuel yenileme
    const refetch = useCallback(() => {
        return fetchData();
    }, [fetchData]);

    return {
        data,
        loading,
        error,
        count,
        refetch,
        isEmpty: !loading && data.length === 0,
    };
}

/**
 * useSupabaseMutation - Supabase INSERT/UPDATE/DELETE hook'u
 * @param {string} table - Supabase tablo adı
 */
export function useSupabaseMutation(table) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const insert = useCallback(async (data, options = {}) => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase.from(table).insert(data);
            if (options.select !== false) query = query.select();
            if (options.single) query = query.single();
            
            const result = await query;
            if (result.error) setError(result.error);
            return result;
        } catch (err) {
            setError(err);
            return { data: null, error: err };
        } finally {
            setLoading(false);
        }
    }, [table]);

    const update = useCallback(async (data, filters = {}, options = {}) => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase.from(table).update(data);
            
            // Filtreleri uygula
            Object.entries(filters).forEach(([key, value]) => {
                query = query.eq(key, value);
            });
            
            if (options.select !== false) query = query.select();
            if (options.single) query = query.single();
            
            const result = await query;
            if (result.error) setError(result.error);
            return result;
        } catch (err) {
            setError(err);
            return { data: null, error: err };
        } finally {
            setLoading(false);
        }
    }, [table]);

    const remove = useCallback(async (filters = {}) => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase.from(table).delete();
            
            Object.entries(filters).forEach(([key, value]) => {
                query = query.eq(key, value);
            });
            
            const result = await query;
            if (result.error) setError(result.error);
            return result;
        } catch (err) {
            setError(err);
            return { data: null, error: err };
        } finally {
            setLoading(false);
        }
    }, [table]);

    const upsert = useCallback(async (data, options = {}) => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase.from(table).upsert(data, options);
            if (options.select !== false) query = query.select();
            
            const result = await query;
            if (result.error) setError(result.error);
            return result;
        } catch (err) {
            setError(err);
            return { data: null, error: err };
        } finally {
            setLoading(false);
        }
    }, [table]);

    return {
        loading,
        error,
        insert,
        update,
        remove,
        upsert,
    };
}
