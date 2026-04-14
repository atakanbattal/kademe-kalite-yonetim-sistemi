-- Bazı metinlerde "i" harfi i + birleşik nokta (U+0307) ile saklanıyor; ILIKE '%civata%'
-- bu diziyi bulamaz. NFKC + birleşik işaret temizliği ile arama metni ASCII tabanına iner.

CREATE OR REPLACE FUNCTION public.tr_normalize_for_search(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN input IS NULL OR btrim(input) = '' THEN ''
    ELSE trim(regexp_replace(
      normalize(
        regexp_replace(
          normalize(
            lower(
              translate(
                normalize(normalize(input, NFKC), NFC),
                'ıİIğĞüÜşŞöÖçÇâÂîÎûÛ',
                'iiigguussoocccaaiiuu'
              )
            ),
            NFD
          ),
          '[\u0300-\u036f]', '', 'g'
        ),
        NFC
      ),
      '\s+', ' ', 'g'
    ))
  END;
$$;

COMMENT ON FUNCTION public.tr_normalize_for_search(text) IS
  'Türkçe karakterleri arama için ASCII tabanına indirir; birleşik Unicode işaretlerini kaldırır (normalizeTurkishForSearch ile uyumlu).';
