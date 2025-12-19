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
        # -> Input username and password for restricted user and submit login form
        frame = context.pages[-1]
        # Input username for restricted user
        elem = frame.locator('xpath=html/body/div/div/div/div/form/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('atakan.battal@kademe.com.tr')
        

        frame = context.pages[-1]
        # Input password for restricted user
        elem = frame.locator('xpath=html/body/div/div/div/div/form/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('atakan1234.')
        

        frame = context.pages[-1]
        # Click login button to submit credentials
        elem = frame.locator('xpath=html/body/div/div/div/div/form/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Attempt to navigate directly to unauthorized modules one by one to verify access control
        frame = context.pages[-1]
        # Click KPI Modülü to test access permission
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Attempt to access İyileştirme (Kaizen) module to verify access control
        frame = context.pages[-1]
        # Click İyileştirme (Kaizen) module to test access permission
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[3]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Attempt to access 'DF ve 8D Yönetimi' module to verify access control
        frame = context.pages[-1]
        # Click DF ve 8D Yönetimi module to test access permission
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[4]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Attempt to access 'Kalitesizlik Maliyetleri' module to verify access control
        frame = context.pages[-1]
        # Click Kalitesizlik Maliyetleri module to test access permission
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[5]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Attempt to access 'Tedarikçi Kalite' module to verify access control
        frame = context.pages[-1]
        # Click Tedarikçi Kalite module to test access permission
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[6]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Attempt to access 'Müşteri Şikayetleri' module to verify access control
        frame = context.pages[-1]
        # Click Müşteri Şikayetleri module to test access permission
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[7]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Attempt to access 'Girdi Kalite Kontrol' module to verify access control
        frame = context.pages[-1]
        # Click Girdi Kalite Kontrol module to test access permission
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[8]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Attempt to access 'Üretilen Araçlar' module to verify access control
        frame = context.pages[-1]
        # Click Üretilen Araçlar module to test access permission
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[9]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Attempt to access 'İç Tetkik Yönetimi' module to verify access control
        frame = context.pages[-1]
        # Click İç Tetkik Yönetimi module to test access permission
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[10]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Attempt to access 'Sapma Yönetimi' module to verify access control
        frame = context.pages[-1]
        # Click Sapma Yönetimi module to test access permission
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[11]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Attempt to access 'Ekipman & Kalibrasyon' module to verify access control
        frame = context.pages[-1]
        # Click Ekipman & Kalibrasyon module to test access permission
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[12]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Attempt to access 'Karantina Yönetimi' module to verify access control
        frame = context.pages[-1]
        # Click Karantina Yönetimi module to test access permission
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[13]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Attempt to access 'Eğitim Yönetimi' module to verify access control
        frame = context.pages[-1]
        # Click Eğitim Yönetimi module to test access permission
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[14]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        # Assert that the user email is visible indicating login success
        await expect(frame.locator('text=atakan.battal@kademe.com.tr').first).to_be_visible(timeout=30000)
        # Assert that the page shows the 'Eğitim Yönetimi' section indicating restricted access or redirection
        await expect(frame.locator('text=Eğitim Yönetimi').first).to_be_visible(timeout=30000)
        # Assert that the education management subsections are visible indicating user is on allowed page
        await expect(frame.locator('text=Planlama').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Dokümanlar').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Sınavlar').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Sonuçlar').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Katılım').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Raporlar').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Sertifikalar').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Yeni Eğitim Planı').first).to_be_visible(timeout=30000)
        # Assert that the education table headers are visible indicating the page content loaded correctly
        await expect(frame.locator('text=Eğitim Kodu').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Eğitim Başlığı').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Eğitmen').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Katılımcı Sayısı').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Planlanan Tarih').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Durum').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=İşlemler').first).to_be_visible(timeout=30000)
        # Assert that the loading text is visible indicating no unauthorized content loaded
        await expect(frame.locator('text=Yükleniyor...').first).to_be_visible(timeout=30000)
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    