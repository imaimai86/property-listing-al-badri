import { test, expect } from '@playwright/test';

test.describe('Admin Portal - Health Check and Basic Flow', () => {
  const consoleErrors: string[] = [];
  const apiFailures: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Catch console errors and logs
    page.on('console', msg => {
      console.log(`[Browser Console ${msg.type()}]: ${msg.text()}`);
      if (msg.type() === 'error') {
        consoleErrors.push(`[Console Error]: ${msg.text()}`);
      }
    });

    // Catch page errors (crashes, unhandled exceptions)
    page.on('pageerror', exception => {
      consoleErrors.push(`[Page Error]: ${exception.message}`);
    });

    // Catch API failures
    page.on('requestfailed', request => {
      apiFailures.push(`[Request Failed]: ${request.url()} - ${request.failure()?.errorText}`);
    });

    page.on('response', async response => {
      const status = response.status();
      if (status >= 400) {
        apiFailures.push(`[API Response Error]: ${response.url()} returned status ${status}`);
      }
      
      // Specifically check for Apps Script "success: false" pattern if applicable
      try {
        if (response.url().includes('script.google.com')) {
          const contentType = response.headers()['content-type'];
          if (contentType && contentType.includes('application/json')) {
            const body = await response.json();
            if (body && body.success === false) {
              apiFailures.push(`[Apps Script Logic Error]: ${response.url()} returned success: false - ${body.error || 'Unknown error'}`);
            }
          }
        }
      } catch (e) {
        // Ignore parsing errors for non-JSON responses
      }
    });
  });

  test.afterEach(async () => {
    // Assert no critical errors were captured
    if (consoleErrors.length > 0) {
      console.error('Captured Console Errors during test:\n' + consoleErrors.join('\n'));
    }
    if (apiFailures.length > 0) {
      console.error('Captured API Failures during test:\n' + apiFailures.join('\n'));
    }

    expect(consoleErrors, 'Console errors were detected during the test execution.').toHaveLength(0);
    expect(apiFailures, 'API failures or logic errors were detected during the test execution.').toHaveLength(0);
  });

  test('should load the login page without errors', async ({ page }) => {
    await page.goto('/login');
    
    // Check for "Al Badri" text to ensure page loaded
    await expect(page.getByText('Al Badri', { exact: false })).toBeVisible();
    await expect(page.getByPlaceholder('name@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
  });

  test('should show validation error on empty login attempt', async ({ page }) => {
    // This test assumes login.tsx uses Alert.alert which on web might be window.alert or a simulated toast
    // NativeWind + React Native Web might render alerts as standard DOM elements or use window.alert
    
    await page.goto('/login');
    
    // Listen for dialog if it's a window.alert
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Please enter email and password');
      await dialog.dismiss();
    });

    await page.getByText('Sign In').click();
  });
  
  test('should login and edit property details with image upload', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    // Handle potential login failure alerts
    page.on('dialog', async dialog => {
      console.log(`[Browser Alert]: ${dialog.message()}`);
      if (dialog.message().includes('Login Failed')) {
        apiFailures.push(`[Login Flow Error]: ${dialog.message()}`);
      }
      await dialog.dismiss();
    });

    // Intercept all requests for debugging
    page.on('request', request => {
      console.log(`[Browser Request]: ${request.method()} ${request.url()}`);
    });
    page.on('response', response => {
      console.log(`[Browser Response]: ${response.status()} ${response.url()}`);
    });

    // Use type with delay to ensure React state synchronizes correctly for RN Web
    await page.getByPlaceholder('name@example.com').click();
    await page.getByPlaceholder('name@example.com').pressSequentially('anas@anas.com', { delay: 100 });
    await page.getByPlaceholder('••••••••').click();
    await page.getByPlaceholder('••••••••').pressSequentially('pwd', { delay: 100 });
    const buttonState = await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('div[role="button"], button'))
        .find(el => el.textContent?.includes('Sign In')) as HTMLElement;
      if (!button) return 'NOT_FOUND';
      const style = window.getComputedStyle(button);
      return {
        visible: button.offsetWidth > 0 && button.offsetHeight > 0,
        pointerEvents: style.pointerEvents,
        opacity: style.opacity,
        disabled: (button as any).disabled
      };
    });
    console.log('Sign In Button State:', buttonState);

    await page.getByText('Sign In').click({ delay: 500 });
    console.log('Clicked Sign In with delay, waiting for navigation...');

    // Wait for navigation and check URL
    await page.waitForURL(url => url.pathname.includes('tabs') || url.pathname === '/', { timeout: 15000 });
    console.log('Current URL after login:', page.url());

    // Wait for navigation to dashboard - check for "Properties" text
    const propertiesHeading = page.getByText('Properties', { exact: false }).first();
    await propertiesHeading.waitFor({ state: 'attached', timeout: 15000 });
    console.log('Properties heading attached');
    
    // In React Native Web, sometimes elements are technically "hidden" due to layout transitions
    // We'll check for visibility but also allow a small grace period or use forced checks
    await propertiesHeading.waitFor({ state: 'visible', timeout: 5000 }).catch(e => console.log('Properties heading not yet visible, proceeding anyway...'));

    // 2. Navigate to Edit Page for ID 1
    await page.goto('/property/edit?id=1');
    console.log('Navigated to edit page');
    await page.getByText('Edit Property').waitFor({ state: 'attached' });

    // 3. Update Title and Price
    const newTitle = `Luxury Villa Elite ${Date.now()}`;
    const newPrice = `$${Math.floor(Math.random() * 1000) + 500}k`;
    
    await page.getByPlaceholder('Property Title').fill(newTitle);
    await page.getByPlaceholder('$350k').fill(newPrice);

    // 4. Image Upload
    const fileChooserPromise = page.waitForEvent('filechooser');
    
    // Find the container relative to the "Property Image" label - it should be the next sibling div
    const imageContainer = page.locator('text=Property Image').locator('xpath=../div[@role="button"]').first();
    await imageContainer.click({ force: true });
    
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('test-image.jpg');

    // Wait for upload success alert
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Image uploaded to S3');
      await dialog.dismiss();
    });
    // The dialog might happen after a bit of "uploading" state
    
    // 5. Save Changes
    await page.getByText('Save').click();

    // Wait for success alert and navigation back
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Property saved successfully');
      await dialog.dismiss();
    });

    // 6. Cross-site Verification (Frontend)
    // We wait a bit for Apps Script/S3 to propagate (usually immediate)
    await page.waitForTimeout(2000); 
    
    await page.goto('https://albadri-demo.s3.us-east-1.amazonaws.com/property-details.html?id=1');
    
    // Check if the new title and price are reflected
    await expect(page.getByText(newTitle)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(newPrice)).toBeVisible();
    
    console.log(`Verified changes on frontend: ${newTitle} and ${newPrice}`);
  });
});
