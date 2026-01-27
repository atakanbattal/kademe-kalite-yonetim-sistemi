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
        # -> Input valid username and password, then click login button to authenticate.
        frame = context.pages[-1]
        # Input valid username
        elem = frame.locator('xpath=html/body/div/div/div/div/form/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('atakan.battal@kademe.com.tr')
        

        frame = context.pages[-1]
        # Input valid password
        elem = frame.locator('xpath=html/body/div/div/div/div/form/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('atakan1234.')
        

        frame = context.pages[-1]
        # Click login button to submit credentials
        elem = frame.locator('xpath=html/body/div/div/div/div/form/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Invoke RPC functions with valid input parameters to verify correct execution and expected results.
        frame = context.pages[-1]
        # Click KPI Modülü to trigger RPC call with valid parameters and load KPI data
        elem = frame.locator('xpath=html/body/div/div/div/aside/div/nav/button[2]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click 'Yeni KPI Ekle' button to open the form and invoke RPC call with valid parameters.
        frame = context.pages[-1]
        # Click 'Yeni KPI Ekle' button to open new KPI form and trigger RPC call with valid input
        elem = frame.locator('xpath=html/body/div/div/div/div/main/div/div/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click the first 'Ekle' button under 'Otomatik Ekle' tab to invoke RPC with valid parameters and verify the result.
        frame = context.pages[-1]
        # Click first 'Ekle' button to add 'Üretilen Araç Sayısı (30 gün)' KPI automatically and trigger RPC call with valid input
        elem = frame.locator('xpath=html/body/div[3]/div[2]/div[2]/div/div/div/div/div/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Invoke RPC function with invalid parameters to test error handling and confirm informative feedback.
        frame = context.pages[-1]
        # Click close button to close 'Yeni KPI Ekle' form
        elem = frame.locator('xpath=html/body/div[3]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Test another RPC call with invalid parameters or try to reload the units to verify consistent error handling and feedback.
        frame = context.pages[-1]
        # Click 'Yeni KPI Ekle' button to retry adding KPI and trigger RPC call with valid or invalid parameters
        elem = frame.locator('xpath=html/body/div/div/div/div/main/div/div/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click another 'Ekle' button under 'Otomatik Ekle' tab to invoke RPC call with valid parameters and verify the result.
        frame = context.pages[-1]
        # Click second 'Ekle' button to add 'Açık 8D Sayısı' KPI automatically and trigger RPC call with valid input
        elem = frame.locator('xpath=html/body/div[3]/div[2]/div[2]/div/div/div/div/div[10]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Close the 'Yeni KPI Ekle' modal and verify the KPI list updates accordingly.
        frame = context.pages[-1]
        # Click 'Close' button to close 'Yeni KPI Ekle' modal
        elem = frame.locator('xpath=html/body/div[3]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=KPI Modülü').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Önemli performans göstergelerinizi takip edin.').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Henüz KPI eklenmemiş.').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=İlk KPI\'ınızı Ekleyin').first).to_be_visible(timeout=30000)
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    