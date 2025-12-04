#!/bin/bash
# Kademe QMS - Otomatik Push Script

echo "🚀 Kademe QMS - Git Push İşlemi"
echo "================================"

# Repository kontrolü
if ! git remote get-url origin &>/dev/null; then
    echo "❌ Remote repository bulunamadı!"
    echo "Remote ekleniyor..."
    git remote add origin https://github.com/atakanbattal/Kademe-QMS.git
fi

echo "✅ Remote: $(git remote get-url origin)"
echo "✅ Branch: $(git branch --show-current)"
echo "✅ Commit sayısı: $(git log --oneline | wc -l | tr -d ' ')"
echo ""
echo "📤 Push ediliyor..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Push başarılı!"
    echo "🌐 Repository: https://github.com/atakanbattal/Kademe-QMS"
else
    echo ""
    echo "❌ Push başarısız!"
    echo ""
    echo "🔧 Çözüm:"
    echo "1. GitHub'da repository oluşturun: https://github.com/new"
    echo "   - Repository adı: Kademe-QMS"
    echo "   - Private seçin"
    echo "   - README eklemeyin"
    echo ""
    echo "2. Tekrar çalıştırın:"
    echo "   bash PUSH_SCRIPT.sh"
fi

