-- İç doküman numaraları silme veya taşıma sonrası yeniden sıralanmaz.
-- Boşluklar korunur; birim/kategori değişiminde yalnızca taşınan kayda yeni numara verilir.

DROP TRIGGER IF EXISTS after_delete_document_resequence ON public.documents;
DROP TRIGGER IF EXISTS after_update_document_resequence ON public.documents;

DROP FUNCTION IF EXISTS public.handle_document_update_resequence();
DROP FUNCTION IF EXISTS public.resequence_documents(text, integer);

COMMENT ON FUNCTION public.handle_document_update_renumber IS
  'Birim veya kategori değişince yalnızca ilgili kayda yeni doküman numarası atar; diğer kayıtların sırasını değiştirmez';
