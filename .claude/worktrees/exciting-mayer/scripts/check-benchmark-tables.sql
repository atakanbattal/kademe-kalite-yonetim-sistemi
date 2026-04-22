-- BENCHMARK TABLOLARINI KONTROL ET
-- Hangi benchmark tablolarının mevcut olduğunu gösterir

SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        ) THEN '✓ Mevcut'
        ELSE '✗ Yok'
    END as durum
FROM (
    VALUES 
        ('benchmarks'),
        ('benchmark_categories'),
        ('benchmark_items'),
        ('benchmark_pros_cons'),
        ('benchmark_criteria'),
        ('benchmark_scores'),
        ('benchmark_documents'),
        ('benchmark_approvals'),
        ('benchmark_activity_log'),
        ('benchmark_reports')
) AS expected_tables(table_name)
ORDER BY table_name;

