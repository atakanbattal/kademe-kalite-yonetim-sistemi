#!/bin/bash

# Lot No Migration Script Runner
# Bu script, sheet_metal_items tablosuna lot_no kolonunu ekler

echo "🚀 Lot No Migration Başlatılıyor..."
echo "================================================"
echo ""

# .env dosyasından Supabase bilgilerini al
if [ -f .env ]; then
    echo "✅ .env dosyası bulundu, değişkenler yükleniyor..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "⚠️  .env dosyası bulunamadı!"
    echo "Lütfen .env dosyasını oluşturun ve Supabase bağlantı bilgilerini ekleyin."
    exit 1
fi

# Supabase bağlantı bilgilerini kontrol et
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "❌ Supabase bağlantı bilgileri eksik!"
    echo "VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY değişkenlerini .env dosyasına ekleyin."
    exit 1
fi

echo "📊 Supabase URL: $VITE_SUPABASE_URL"
echo ""

# Migration scriptini çalıştır
echo "📝 Migration scripti çalıştırılıyor..."
echo "Script: scripts/add-lot-no-to-sheet-metal.sql"
echo ""

# Supabase CLI kullanarak migration'ı çalıştır
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI bulundu"
    supabase db push --file scripts/add-lot-no-to-sheet-metal.sql
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "================================================"
        echo "✅ Migration başarıyla tamamlandı!"
        echo "================================================"
        echo ""
        echo "📋 Yapılan Değişiklikler:"
        echo "  • sheet_metal_items tablosuna lot_no kolonu eklendi"
        echo "  • Kolon tipi: TEXT"
        echo "  • Index oluşturuldu: idx_sheet_metal_items_lot_no"
        echo ""
        echo "🎉 Artık sac malzemeler için Lot No kaydedebilirsiniz!"
        echo ""
    else
        echo ""
        echo "================================================"
        echo "❌ Migration başarısız oldu!"
        echo "================================================"
        echo ""
        echo "Lütfen hata mesajını kontrol edin ve tekrar deneyin."
        echo ""
        exit 1
    fi
else
    echo "⚠️  Supabase CLI bulunamadı!"
    echo ""
    echo "📝 Manuel kurulum için:"
    echo "1. Supabase Dashboard'a gidin: https://app.supabase.com"
    echo "2. Projenizi seçin"
    echo "3. SQL Editor'e gidin"
    echo "4. scripts/add-lot-no-to-sheet-metal.sql dosyasının içeriğini yapıştırın"
    echo "5. Run butonuna tıklayın"
    echo ""
    echo "Alternatif olarak, aşağıdaki SQL komutunu doğrudan SQL Editor'de çalıştırabilirsiniz:"
    echo ""
    echo "ALTER TABLE sheet_metal_items ADD COLUMN IF NOT EXISTS lot_no TEXT;"
    echo "CREATE INDEX IF NOT EXISTS idx_sheet_metal_items_lot_no ON sheet_metal_items(lot_no);"
    echo ""
    echo "Veya Supabase CLI'ı yükleyin:"
    echo "  npm install -g supabase"
    echo ""
fi

echo "✅ Migration tamamlandı. Artık Lot No alanını kullanabilirsiniz!"

