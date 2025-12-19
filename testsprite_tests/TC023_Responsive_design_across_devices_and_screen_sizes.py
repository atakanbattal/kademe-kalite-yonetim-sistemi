import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()
        
        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )
        
        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)
        
        # Open a new page in the browser context
        page = await context.new_page()
        
        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:3001", wait_until="commit", timeout=10000)
        
        # Wait for the main page to reach DOMContentLoaded state (optional for stability)
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except async_api.Error:
            pass
        
        # Iterate through all iframes and wait for them to load as well
        for frame in page.frames:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=3000)
            except async_api.Error:
                pass
        
        # Interact with the page elements to simulate user flow
        # -> Input username and password, then click login button to access the application on desktop.
        frame = context.pages[-1]
        # Input username
        elem = frame.locator('xpath=html/body/div/div/div/div/form/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('atakan.battal@kademe.com.tr')
        

        frame = context.pages[-1]
        # Input password
        elem = frame.locator('xpath=html/body/div/div/div/div/form/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('atakan1234.')
        

        frame = context.pages[-1]
        # Click login button
        elem = frame.locator('xpath=html/body/div/div/div/div/form/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Resize or switch to tablet viewport and verify UI adjusts correctly without content overlap or loss of functionality.
        await page.goto('http://localhost:3001', timeout=10000)
        await asyncio.sleep(3)
        

        # -> Resize or switch to tablet viewport and verify UI adjusts correctly without content overlap or loss of functionality.
        await page.goto('http://localhost:3001/dashboard?viewport=tablet', timeout=10000)
        await asyncio.sleep(3)
        

        # -> Switch to mobile viewport and verify UI usability and readability, especially navigation and interactive elements.
        await page.goto('http://localhost:3001/dashboard?viewport=mobile', timeout=10000)
        await asyncio.sleep(3)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=Kademe A.Ş.').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Kalite Yönetim Sistemi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Ana Panel').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=KPI Modülü').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=İyileştirme (Kaizen)').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=DF ve 8D Yönetimi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Kalitesizlik Maliyetleri').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Tedarikçi Kalite').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Müşteri Şikayetleri').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Girdi Kalite Kontrol').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Üretilen Araçlar').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=İç Tetkik Yönetimi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Sapma Yönetimi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Ekipman & Kalibrasyon').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Karantina Yönetimi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Eğitim Yönetimi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Polivalans Matrisi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Benchmark Yönetimi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Doküman Yönetimi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=WPS Yönetimi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Görev Yönetimi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Denetim Kayıtları').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Ayarlar').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=atakan.battal@kademe.com.tr').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Tüm kalite süreçlerinize genel bir bakış.').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Rapor Al').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Açık DF Sayısı').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Açık 8D Sayısı').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Karantinadaki Ürünler').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Bu Ayki Maliyet').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Birim Bazlı Uygunsuzluk Dağılımı').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Toplam Kalitesizlik Maliyetleri Dağılımı').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Uyarılar').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Bu Ayın Trendleri').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Bugünün Görevleri').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=5 En Kritik Uygunsuzluk').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Kalite Duvarı').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Kök Neden Isı Haritası').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Kalite Hedefleri').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Benchmark Analizi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Risk Bazlı Göstergeler').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=AI Destekli Kök Neden Tahmin').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=5S - İş Güvenliği - OEE').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Bildirimler').first).to_be_visible(timeout=30000)
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    