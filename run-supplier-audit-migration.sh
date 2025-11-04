#!/bin/bash

# Tedarikçi Denetim Migration Script Runner
# Bu script, supplier_attendees kolonunu ekler

echo "🚀 Tedarikçi Denetim Migration Başlatılıyor..."
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
echo "Script: scripts/add-supplier-attendees-to-audit.sql"
echo ""

# Supabase CLI kullanarak migration'ı çalıştır
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI bulundu"
    supabase db push --file scripts/add-supplier-attendees-to-audit.sql
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "================================================"
        echo "✅ Migration başarıyla tamamlandı!"
        echo "================================================"
        echo ""
        echo "📋 Yapılan Değişiklikler:"
        echo "  • supplier_audit_plans tablosuna supplier_attendees kolonu eklendi"
        echo "  • Kolon tipi: TEXT[] (String Array)"
        echo "  • Varsayılan değer: Boş array ('{}')"
        echo ""
        echo "🎉 Artık denetlenen firmadan katılanları kaydedebilirsiniz!"
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
    echo "4. scripts/add-supplier-attendees-to-audit.sql dosyasının içeriğini yapıştırın"
    echo "5. Run butonuna tıklayın"
    echo ""
    echo "Veya Supabase CLI'ı yükleyin:"
    echo "  npm install -g supabase"
    echo ""
fi

echo "📚 Daha fazla bilgi için TEDARIKCI_DENETIM_GUNCELLEME.md dosyasına bakın."

