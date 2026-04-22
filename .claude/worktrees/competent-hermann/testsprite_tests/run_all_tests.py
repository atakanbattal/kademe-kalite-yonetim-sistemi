#!/usr/bin/env python3
"""
Kademe QMS - Frontend Test Suite (Lokal Playwright)
TestSprite bulut servisi yerine doğrudan bu script ile test çalıştırılabilir.

Kullanım:
  python3 testsprite_tests/run_all_tests.py

Gereksinimler:
  pip install playwright
  python -m playwright install chromium
"""
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

BASE_URL = "http://localhost:3003"
EMAIL = "atakan.battal@kademe.com.tr"
PASSWORD = "atakan1234."

results = []


def record(name, status, error=""):
    results.append({"title": name, "status": status, "error": error})
    icon = "✅" if status == "PASSED" else "❌"
    print(f"  {icon} {name}" + (f" — {error[:80]}" if error else ""))


async def login(page):
    await page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=15000)
    await page.wait_for_timeout(2000)
    await page.locator('[data-testid="login-email"]').fill(EMAIL)
    await page.locator('[data-testid="login-password"]').fill(PASSWORD)
    await page.locator('[data-testid="login-submit"]').click()
    await page.wait_for_url("**/dashboard**", timeout=30000)
    await page.wait_for_timeout(3000)


async def run_all():
    from playwright.async_api import async_playwright

    pw = await async_playwright().start()
    browser = await pw.chromium.launch(
        headless=True,
        args=["--window-size=1280,720", "--disable-dev-shm-usage", "--no-sandbox"],
    )

    # TC001: Başarılı Login
    print("\n🔐 TC001: Başarılı login...")
    try:
        ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page()
        await login(page)
        assert "/dashboard" in page.url
        body = await page.inner_text("body", timeout=5000)
        assert "Ana Panel" in body
        record("TC001-Başarılı Login", "PASSED")
    except Exception as e:
        record("TC001-Başarılı Login", "FAILED", str(e))
    finally:
        await ctx.close()

    # TC002: Geçersiz Login
    print("🔐 TC002: Geçersiz login reddi...")
    try:
        ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page()
        await page.goto(f"{BASE_URL}/login", wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(1500)
        await page.locator('[data-testid="login-email"]').fill("wrong@example.com")
        await page.locator('[data-testid="login-password"]').fill("wrongpass")
        await page.locator('[data-testid="login-submit"]').click()
        await page.wait_for_timeout(3000)
        assert await page.locator('[data-testid="login-submit"]').is_visible()
        record("TC002-Geçersiz Login Reddi", "PASSED")
    except Exception as e:
        record("TC002-Geçersiz Login Reddi", "FAILED", str(e))
    finally:
        await ctx.close()

    # TC003: Dashboard
    print("📊 TC003: Dashboard yükleme...")
    try:
        ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page()
        await login(page)
        body = await page.inner_text("body", timeout=5000)
        assert "Ana Panel" in body and "Kalite Yönetim Sistemi" in body
        record("TC003-Dashboard Yükleme", "PASSED")
    except Exception as e:
        record("TC003-Dashboard Yükleme", "FAILED", str(e))
    finally:
        await ctx.close()

    # TC004-TC008: Modül navigasyonları
    modules = [
        ("TC004", "KPI", "/kpi"),
        ("TC005", "DF-8D", "/df-8d"),
        ("TC006", "Kalite Maliyetleri", "/quality-cost"),
        ("TC007", "Müşteri Şikayetleri", "/customer-complaints"),
        ("TC008", "Görev Yönetimi", "/tasks"),
    ]
    print("🧭 Modül navigasyon testleri...")
    try:
        ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page()
        await login(page)
        for tc_id, label, route in modules:
            try:
                await page.goto(f"{BASE_URL}{route}", wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_timeout(2000)
                assert "/login" not in page.url
                assert len(await page.inner_text("body", timeout=5000)) > 50
                record(f"{tc_id}-{label} Navigasyon", "PASSED")
            except Exception as e:
                record(f"{tc_id}-{label} Navigasyon", "FAILED", str(e))
    except Exception as e:
        for tc_id, label, _ in modules:
            record(f"{tc_id}-{label} Navigasyon", "FAILED", str(e))
    finally:
        await ctx.close()

    # TC009: Logout
    print("🔓 TC009: Logout...")
    try:
        ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page()
        await login(page)
        await page.locator('text=Çıkış Yap').first.click()
        await page.wait_for_url("**/login**", timeout=15000)
        record("TC009-Logout", "PASSED")
    except Exception as e:
        record("TC009-Logout", "FAILED", str(e))
    finally:
        await ctx.close()

    # TC010: Yetkisiz erişim
    print("🛡️ TC010: Yetkisiz erişim koruması...")
    try:
        ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page()
        await page.goto(f"{BASE_URL}/dashboard", wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_timeout(3000)
        assert "/login" in page.url or await page.locator('[data-testid="login-email"]').is_visible(timeout=3000)
        record("TC010-Yetkisiz Erişim Koruması", "PASSED")
    except Exception as e:
        record("TC010-Yetkisiz Erişim Koruması", "FAILED", str(e))
    finally:
        await ctx.close()

    await browser.close()
    await pw.stop()

    # Rapor
    passed = sum(1 for r in results if r["status"] == "PASSED")
    failed = sum(1 for r in results if r["status"] == "FAILED")
    total = len(results)

    print(f"\n{'='*55}")
    print(f"  SONUÇ: {passed}/{total} başarılı ({passed*100//total}%)")
    print(f"  ✅ Başarılı: {passed}  |  ❌ Başarısız: {failed}")
    print(f"{'='*55}\n")

    if failed > 0:
        print("BAŞARISIZ TESTLER:")
        for r in results:
            if r["status"] == "FAILED":
                print(f"  ❌ {r['title']}: {r['error'][:100]}")

    report = {
        "date": datetime.now().isoformat(),
        "total": total,
        "passed": passed,
        "failed": failed,
        "pass_rate": f"{passed*100//total}%",
        "tests": results,
    }
    report_path = Path(__file__).parent / "tmp" / "local_test_results.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"📄 Rapor: {report_path}")

    return failed == 0


if __name__ == "__main__":
    success = asyncio.run(run_all())
    sys.exit(0 if success else 1)
