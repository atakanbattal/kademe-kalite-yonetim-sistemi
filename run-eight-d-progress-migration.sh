#!/bin/bash

# eight_d_progress Kolonu Migration Script
# Bu script non_conformities tablosuna eight_d_progress kolonunu ekler

echo "🚀 eight_d_progress Kolonu Migration Başlatılıyor..."
echo "=================================================="
echo ""

# Supabase CLI kontrolü
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI bulundu"
    echo ""
    echo "📝 Migration çalıştırılıyor..."
    
    # SQL dosyasını çalıştır
    supabase db push --file scripts/add-eight-d-progress-column.sql
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "=================================================="
        echo "✅ Migration başarıyla tamamlandı!"
        echo "=================================================="
        echo ""
        echo "📋 Yapılan Değişiklikler:"
        echo "  • non_conformities tablosuna eight_d_progress JSONB kolonu eklendi"
        echo "  • Index oluşturuldu (performans için)"
        echo "  • Mevcut kayıtlar için varsayılan değer güncellendi"
        echo ""
        echo "🎉 Artık 8D modülünü sorunsuz kullanabilirsiniz!"
        echo ""
    else
        echo ""
        echo "=================================================="
        echo "❌ Migration başarısız!"
        echo "=================================================="
        echo ""
        echo "Lütfen hata mesajını kontrol edin."
        echo ""
        exit 1
    fi
else
    echo "⚠️  Supabase CLI bulunamadı!"
    echo ""
    echo "📝 Manuel kurulum için:"
    echo ""
    echo "1. Supabase Dashboard'a gidin:"
    echo "   https://app.supabase.com/project/rqnvoatirfczpklaamhf/sql"
    echo ""
    echo "2. SQL Editor'ü açın"
    echo ""
    echo "3. Aşağıdaki SQL'i yapıştırın ve çalıştırın:"
    echo ""
    echo "---"
    cat scripts/add-eight-d-progress-column.sql
    echo "---"
    echo ""
    echo "Veya Supabase CLI'ı yükleyin:"
    echo "  npm install -g supabase"
    echo ""
fi

