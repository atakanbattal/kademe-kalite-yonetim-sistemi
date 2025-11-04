#!/bin/bash

# Supabase Migration Runner
# Bu script SQL migration'ı otomatik çalıştırır

echo "🚀 Supabase Migration başlatılıyor..."
echo ""

# Supabase CLI kurulu mu kontrol et
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI bulunamadı!"
    echo "📦 Kurulum için: npm install -g supabase"
    echo ""
    echo "YA DA Supabase Dashboard'da manuel çalıştırın:"
    echo "https://supabase.com/dashboard/project/rqnvoatirfczpklaamhf/sql"
    exit 1
fi

# SQL dosyasını çalıştır
echo "📝 SQL migration çalıştırılıyor..."
supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.rqnvoatirfczpklaamhf.supabase.co:5432/postgres" < scripts/add-supplier-to-quality-costs.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration başarıyla tamamlandı!"
    echo ""
    echo "🎉 Şimdi yapmanız gerekenler:"
    echo "   1. Tarayıcıyı yenileyin (F5)"
    echo "   2. Tedarikçi özelliklerini test edin"
    echo ""
else
    echo ""
    echo "❌ Migration başarısız!"
    echo "   Lütfen Supabase Dashboard'dan manuel çalıştırın"
    exit 1
fi


