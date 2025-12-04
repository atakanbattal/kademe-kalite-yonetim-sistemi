#!/bin/bash

# ============================================================================
# BENCHMARK CREATED_BY MIGRATION SCRIPT
# ============================================================================
# Bu script benchmark tablolarına created_by kolonlarını ekler
# ============================================================================

set -e  # Hata durumunda durdur

echo "============================================================================"
echo "BENCHMARK CREATED_BY KOLONU EKLENİYOR..."
echo "============================================================================"

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# .env dosyasını yükle
if [ ! -f .env ]; then
    echo -e "${RED}HATA: .env dosyası bulunamadı!${NC}"
    echo "Lütfen önce .env dosyasını oluşturun."
    exit 1
fi

# .env dosyasından değişkenleri yükle
export $(grep -v '^#' .env | xargs)

# Veritabanı bağlantısını kontrol et
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}HATA: Supabase bağlantı bilgileri eksik!${NC}"
    echo "VITE_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY .env dosyasında tanımlı olmalı."
    exit 1
fi

# Supabase Project ID'yi URL'den çıkar
PROJECT_ID=$(echo $VITE_SUPABASE_URL | sed -E 's/https:\/\/([^.]+).*/\1/')

echo -e "${YELLOW}Supabase Projesi: ${PROJECT_ID}${NC}"
echo ""

# SQL dosyasını kontrol et
SQL_FILE="scripts/add-created-by-to-benchmarks.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}HATA: $SQL_FILE dosyası bulunamadı!${NC}"
    exit 1
fi

echo -e "${YELLOW}SQL dosyası bulundu: ${SQL_FILE}${NC}"
echo ""

# Supabase CLI'nin yüklü olup olmadığını kontrol et
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}HATA: Supabase CLI yüklü değil!${NC}"
    echo "Yüklemek için: npm install -g supabase"
    exit 1
fi

# Migration'ı çalıştır
echo -e "${GREEN}Migration çalıştırılıyor...${NC}"
echo ""

# SQL dosyasını Supabase'e gönder
psql "$DATABASE_URL" -f "$SQL_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}============================================================================${NC}"
    echo -e "${GREEN}✓ BENCHMARK CREATED_BY KOLONU BAŞARIYLA EKLENDİ!${NC}"
    echo -e "${GREEN}============================================================================${NC}"
    echo ""
    echo -e "${YELLOW}Eklenen kolonlar:${NC}"
    echo "  - benchmarks.created_by"
    echo "  - benchmark_pros_cons.created_by"
    echo "  - benchmark_documents.uploaded_by"
    echo "  - benchmark_activity_log.performed_by"
    echo "  - benchmark_reports.generated_by"
    echo ""
    echo -e "${GREEN}Artık Benchmark modülünü sorunsuz kullanabilirsiniz!${NC}"
else
    echo ""
    echo -e "${RED}============================================================================${NC}"
    echo -e "${RED}✗ MIGRATION BAŞARISIZ!${NC}"
    echo -e "${RED}============================================================================${NC}"
    echo ""
    echo "Lütfen hata mesajlarını kontrol edin ve düzeltin."
    exit 1
fi

