# Kademe QMS - Test Dosyaları

## Hızlı Başlangıç

### 1. Frontend Testleri (UI - Playwright)

Uygulama `http://localhost:3003` üzerinde çalışıyor olmalı.

```bash
# Bağımlılıkları kur (ilk seferde)
pip3 install -r testsprite_tests/requirements.txt
python3 -m playwright install chromium

# Frontend testlerini çalıştır (uygulama localhost:3003'te çalışıyor olmalı)
python3 testsprite_tests/run_all_tests.py
```

### 2. Backend Testleri (Supabase API)

```bash
# Backend testlerini çalıştır (requests requirements.txt'te)
python3 testsprite_tests/run_backend_tests.py
```

---

## Dosya Yapısı

| Dosya | Açıklama |
|-------|----------|
| `testsprite_frontend_test_plan.json` | TestSprite frontend test planı (10 test) |
| `testsprite_backend_test_plan.json` | TestSprite backend test planı (3 test) |
| `run_all_tests.py` | **Lokal** frontend test runner (Playwright) |
| `run_backend_tests.py` | **Lokal** backend test runner (Supabase API) |
| `config.example.json` | Örnek konfigürasyon |
| `tmp/code_summary.json` | TestSprite için kod özeti |
| `tmp/local_test_results.json` | Frontend test sonuçları |
| `tmp/backend_test_results.json` | Backend test sonuçları |

---

## TestSprite Bulut ile Kullanım

1. Uygulamayı `npm run dev` ile başlatın (port 3003)
2. TestSprite MCP veya CLI ile bootstrap yapın
3. `code_summary.json` ve test planları otomatik kullanılır

**Not:** TestSprite bulut servisi bazen timeout verebilir. Lokal `run_all_tests.py` ve `run_backend_tests.py` her zaman çalışır.

---

## Test Kimlik Bilgileri

Varsayılan test kullanıcısı:
- **Email:** atakan.battal@kademe.com.tr
- **Şifre:** atakan1234.

Farklı kullanıcı için `config.example.json`'u kopyalayıp `tmp/config.json` olarak kaydedin veya ortam değişkenlerini kullanın.
