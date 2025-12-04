#!/bin/bash

# Kapsamlı Audit Logging Sistemi Kurulum Script'i
# Bu script tüm tablolara audit trigger ekler

echo "🔍 Kapsamlı Audit Logging Sistemi Kurulumu"
echo "=========================================="
echo ""
echo "Bu script şunları yapacak:"
echo "  ✅ Tüm veritabanı tablolarına audit trigger ekleyecek"
echo "  ✅ Eksik tabloları otomatik bulup trigger ekleyecek"
echo "  ✅ Mevcut trigger'ları güncelleyecek"
echo ""
echo "⚠️  ÖNEMLİ: Bu script'i Supabase SQL Editor'de çalıştırmanız gerekiyor!"
echo ""
echo "📋 Adımlar:"
echo "  1. Supabase Dashboard'a gidin: https://app.supabase.com"
echo "  2. Projenizi seçin"
echo "  3. Sol menüden 'SQL Editor' seçin"
echo "  4. scripts/add-all-audit-triggers-comprehensive.sql dosyasını açın"
echo "  5. İçeriğini SQL Editor'e kopyalayın"
echo "  6. 'Run' butonuna tıklayın"
echo ""
echo "📄 Script dosyası: scripts/add-all-audit-triggers-comprehensive.sql"
echo ""
read -p "Script dosyasını açmak ister misiniz? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "scripts/add-all-audit-triggers-comprehensive.sql" ]; then
        if command -v code &> /dev/null; then
            code scripts/add-all-audit-triggers-comprehensive.sql
        elif command -v nano &> /dev/null; then
            nano scripts/add-all-audit-triggers-comprehensive.sql
        else
            cat scripts/add-all-audit-triggers-comprehensive.sql
        fi
    else
        echo "❌ Script dosyası bulunamadı!"
        exit 1
    fi
fi

echo ""
echo "✅ Hazır! Script'i Supabase SQL Editor'de çalıştırdıktan sonra:"
echo "   • Audit Log sayfasını kontrol edin: https://kademekalite.online/audit-logs"
echo "   • Herhangi bir modülde işlem yapın ve logların göründüğünü doğrulayın"
echo ""

