#!/bin/bash

# Kesin Çözüm: Cache'i tamamen temizle ve yeniden başlat

echo "🧹 Tüm cache'leri temizleniyor..."

# 1. Vite cache'ini sil
rm -rf node_modules/.vite

# 2. Dist klasörünü sil
rm -rf dist

# 3. Build cache'ini sil
rm -rf .cache

echo "✅ Cache temizlendi!"
echo ""
echo "📝 Şimdi şunları yapın:"
echo "1. Terminal'de çalışan dev server'ı durdurun (Ctrl+C)"
echo "2. Komutu çalıştırın: npm run dev"
echo "3. Tarayıcıda Hard Refresh yapın: Cmd+Shift+R (Mac) veya Ctrl+Shift+R (Windows)"
echo ""
echo "🎯 Bu kesinlikle sorunu çözecek!"


