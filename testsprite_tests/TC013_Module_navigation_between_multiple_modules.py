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
        await page.goto("http://localhost:3003", wait_until="commit", timeout=10000)
        
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
        # -> Input username and password, then click login button to access main navigation
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
        

        # -> Click on 'Karantina Yönetimi' (Quarantine Management) module to load and verify its interface and data
        frame = context.pages[-1]
        # Click Karantina Yönetimi (Quarantine Management) module
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[13]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'Sapma Yönetimi' (Deviation Management) module to load and verify its interface and data
        frame = context.pages[-1]
        # Click Sapma Yönetimi (Deviation Management) module
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[11]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'Ekipman & Kalibrasyon' (Equipment & Calibration) module to load and verify its interface and data
        frame = context.pages[-1]
        # Click Ekipman & Kalibrasyon (Equipment & Calibration) module
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[12]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'Doküman Yönetimi' (Document Management) module to load and verify its interface and data
        frame = context.pages[-1]
        # Click Doküman Yönetimi (Document Management) module
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[17]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'KPI Modülü' (KPI Module) to load and verify its interface and data
        frame = context.pages[-1]
        # Click KPI Modülü (KPI Module)
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'İyileştirme (Kaizen)' module to load and verify its interface and data
        frame = context.pages[-1]
        # Click İyileştirme (Kaizen) module
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[3]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'Görev Yönetimi' (Task Management) module to load and verify its interface and data
        frame = context.pages[-1]
        # Click Görev Yönetimi (Task Management) module
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[19]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'DF ve 8D Yönetimi' module to load and verify its interface and data
        frame = context.pages[-1]
        # Click DF ve 8D Yönetimi module
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[4]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'Kalitesizlik Maliyetleri' module to load and verify its interface and data
        frame = context.pages[-1]
        # Click Kalitesizlik Maliyetleri module
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[5]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'Tedarikçi Kalite' (Supplier Quality) module to load and verify its interface and data
        frame = context.pages[-1]
        # Click Tedarikçi Kalite (Supplier Quality) module
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[6]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'Müşteri Şikayetleri' (Customer Complaints) module to load and verify its interface and data
        frame = context.pages[-1]
        # Click Müşteri Şikayetleri (Customer Complaints) module
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[7]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'Girdi Kalite Kontrol' (Incoming Quality Control) module to load and verify its interface and data
        frame = context.pages[-1]
        # Click Girdi Kalite Kontrol (Incoming Quality Control) module
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[8]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click on 'Üretilen Araçlar' (Produced Vehicles) module to load and verify its interface and data
        frame = context.pages[-1]
        # Click Üretilen Araçlar (Produced Vehicles) module
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[9]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=Karantina Yönetimi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Sapma Yönetimi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Ekipman & Kalibrasyon').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Doküman Yönetimi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=KPI Modülü').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=İyileştirme (Kaizen)').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Görev Yönetimi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=DF ve 8D Yönetimi').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Kalitesizlik Maliyetleri').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Tedarikçi Kalite').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Müşteri Şikayetleri').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Girdi Kalite Kontrol').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Üretilen Araçlar').first).to_be_visible(timeout=30000)
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    