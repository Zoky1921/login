const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const SCREENSHOTS_DIR = 'capturas/';
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ],
    timeout: 60000
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Configurar timeout global
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(30000);

  try {
    // 1. Limpieza exhaustiva
    console.log('🧹 Limpiando cookies y caché...');
    await page.deleteCookie();
    await page.goto('about:blank');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // 2. Navegación a login
    console.log('🌐 Cargando página de login...');
    await page.goto(`${process.env.MOODLE_URL}/login/index.php`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}0-pagina-login.png` });

    // 3. Verificar elementos del formulario
    console.log('🔍 Verificando formulario de login...');
    await page.waitForSelector('#username', { visible: true, timeout: 10000 });
    await page.waitForSelector('#password', { visible: true, timeout: 10000 });
    await page.waitForSelector('#loginbtn', { visible: true, timeout: 10000 });

    // 4. Rellenar credenciales con delays humanos
    console.log('⌨️ Escribiendo credenciales...');
    await page.type('#username', process.env.MOODLE_USER, { delay: 100 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}1-usuario-insertado.png` });
    await page.type('#password', process.env.MOODLE_PASS, { delay: 100 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}2-password-insertado.png` });

    // 5. Enviar formulario
    console.log('🚀 Enviando formulario...');
    const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
    await page.click('#loginbtn');
    await navigationPromise;

    // 6. Verificación exhaustiva de login
    console.log('✅ Verificando login exitoso...');
    const currentUrl = page.url();
    console.log('🔗 URL actual:', currentUrl);

    if (currentUrl.includes('login') || await page.$('#loginerrormessage')) {
      const errorMsg = await page.$eval('#loginerrormessage', el => el.textContent.trim()).catch(() => 'Mensaje no encontrado');
      throw new Error(`Fallo en login: ${errorMsg}`);
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}3-login-exitoso.png` });
    console.log('🎉 ¡Login exitoso confirmado!');

    // 7. Continuar con el resto del proceso (cursos, etc.)
    // ... [resto del código para procesar cursos]

  } catch (error) {
    console.error('❌ ERROR CRÍTICO:', error);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}error-final.png` });
    
    // Capturar HTML de la página de error
    const htmlContent = await page.content();
    fs.writeFileSync(`${SCREENSHOTS_DIR}error-page.html`, htmlContent);
    console.log('💾 HTML de error guardado como error-page.html');
  } finally {
    await browser.close();
    console.log('🏁 Proceso finalizado');
  }
})();
