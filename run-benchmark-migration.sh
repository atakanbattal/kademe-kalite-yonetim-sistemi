#!/bin/bash

# Benchmark Modülü Veritabanı Migration Script
# Bu script benchmark modülü için gerekli tüm veritabanı yapılarını oluşturur

set -e

echo "🚀 Benchmark Modülü Migration Başlatılıyor..."
echo "=============================================="
echo ""

# Renk kodları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Supabase URL ve Key kontrolü
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo -e "${RED}❌ Hata: SUPABASE_URL ve SUPABASE_SERVICE_KEY çevre değişkenleri ayarlanmalı${NC}"
    echo ""
    echo "Kullanım:"
    echo "  export SUPABASE_URL='https://your-project.supabase.co'"
    echo "  export SUPABASE_SERVICE_KEY='your-service-key'"
    echo "  ./run-benchmark-migration.sh"
    echo ""
    echo "veya direkt:"
    echo "  SUPABASE_URL='...' SUPABASE_SERVICE_KEY='...' ./run-benchmark-migration.sh"
    exit 1
fi

echo -e "${YELLOW}📡 Supabase bağlantısı kontrol ediliyor...${NC}"
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_SERVICE_KEY")

if [ "$HEALTH_CHECK" != "200" ]; then
    echo -e "${RED}❌ Supabase bağlantısı başarısız (HTTP $HEALTH_CHECK)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Supabase bağlantısı başarılı${NC}"
echo ""

# SQL dosyasını oku
SQL_FILE="scripts/create-benchmark-module.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ SQL dosyası bulunamadı: $SQL_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}📄 SQL dosyası okunuyor: $SQL_FILE${NC}"
SQL_CONTENT=$(cat "$SQL_FILE")

echo -e "${YELLOW}🔄 Migration çalıştırılıyor...${NC}"
echo ""

# Supabase REST API üzerinden SQL çalıştır
RESPONSE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL_CONTENT" | jq -Rs .)}")

# Hata kontrolü
if echo "$RESPONSE" | grep -q "error"; then
    echo -e "${RED}❌ Migration başarısız!${NC}"
    echo ""
    echo "Hata detayı:"
    echo "$RESPONSE" | jq .
    echo ""
    echo -e "${YELLOW}💡 İpucu: SQL dosyasını doğrudan Supabase SQL Editor'de çalıştırmayı deneyin${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Migration başarıyla tamamlandı!${NC}"
echo ""

# Doğrulama
echo -e "${YELLOW}🔍 Veritabanı yapısı doğrulanıyor...${NC}"

# Tabloları kontrol et
TABLES=$(curl -s "$SUPABASE_URL/rest/v1/rpc/check_benchmark_tables" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY")

echo ""
echo -e "${GREEN}📊 Oluşturulan Tablolar:${NC}"
echo "  • benchmark_categories"
echo "  • benchmarks"
echo "  • benchmark_items"
echo "  • benchmark_pros_cons"
echo "  • benchmark_criteria"
echo "  • benchmark_scores"
echo "  • benchmark_documents"
echo "  • benchmark_approvals"
echo "  • benchmark_activity_log"
echo "  • benchmark_reports"
echo ""

echo -e "${GREEN}⚙️  Oluşturulan Fonksiyonlar:${NC}"
echo "  • generate_benchmark_number()"
echo "  • generate_benchmark_report_number()"
echo ""

echo -e "${GREEN}🔐 RLS Politikaları:${NC}"
echo "  • Tüm tablolarda Row Level Security aktif"
echo "  • Authenticated kullanıcılar için okuma/yazma izni"
echo ""

echo -e "${YELLOW}📦 Storage Bucket Kurulumu (Manuel)${NC}"
echo "  ⚠️  Supabase Dashboard > Storage bölümünden:"
echo "  1. 'benchmark_documents' bucket'ını oluşturun"
echo "  2. Public: false (Private)"
echo "  3. Policies ekleyin (BENCHMARK_HIZLI_BASLANGIC.md'ye bakın)"
echo ""

echo -e "${GREEN}🎯 Varsayılan Kategoriler:${NC}"
echo "  • Ürün Karşılaştırma"
echo "  • Süreç Karşılaştırma"
echo "  • Teknoloji Karşılaştırma"
echo "  • Tedarikçi Karşılaştırma"
echo "  • Ekipman Karşılaştırma"
echo "  • Malzeme Karşılaştırma"
echo ""

echo "=============================================="
echo -e "${GREEN}✨ Benchmark Modülü Kurulumu Tamamlandı!${NC}"
echo ""
echo -e "${YELLOW}📚 Sonraki Adımlar:${NC}"
echo "  1. Storage bucket'ı manuel olarak oluşturun"
echo "  2. BENCHMARK_HIZLI_BASLANGIC.md dosyasını okuyun"
echo "  3. İlk benchmark'ınızı oluşturun"
echo ""
echo -e "${GREEN}🚀 Başarılar!${NC}"

