ALTER TABLE public.leak_test_records
DROP CONSTRAINT IF EXISTS leak_test_records_tank_type_check;

ALTER TABLE public.leak_test_records
ADD CONSTRAINT leak_test_records_tank_type_check
CHECK (
    tank_type IN (
        'Yağ Tankı',
        'Su Tankı',
        'Mazot Tankı',
        'Fıskiye',
        'Kriko',
        'Yağlama Haznesi',
        'Yağlama Profili'
    )
);
