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

  try {
    // 1. Limpieza básica (sin localStorage)
    console.log('🧹 Limpiando cookies...');
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');

    // 2. Navegación a login
    console.log('🌐 Cargando página de login...');
    await page.goto(`${process.env.MOODLE_URL}/login/index.php`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}0-pagina-login.png` });

    // 3. Verificar elementos del formulario
    console.log('🔍 Verificando formulario...');
    await page.waitForSelector('#username', { visible: true, timeout: 10000 });
    await page.waitForSelector('#password', { visible: true, timeout: 10000 });
    await page.waitForSelector('#loginbtn', { visible: true, timeout: 10000 });

    // 4. Insertar credenciales
    console.log('⌨️ Escribiendo credenciales...');
    await page.type('#username', process.env.MOODLE_USER, { delay: 50 });
    await page.type('#password', process.env.MOODLE_PASS, { delay: 50 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}1-credenciales-llenadas.png` });

    // 5. Enviar formulario
    console.log('🚀 Enviando formulario...');
    await Promise.all([
      page.click('#loginbtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
    ]);

    // 6. Verificación de login
    console.log('✅ Verificando login...');
    const currentUrl = page.url();
    console.log('🔗 URL actual:', currentUrl);

    if (currentUrl.includes('login') || await page.$('#loginerrormessage')) {
      const errorMsg = await page.evaluate(() => {
        const errElement = document.querySelector('#loginerrormessage');
        return errElement ? errElement.textContent.trim() : 'Error desconocido';
      }).catch(() => 'No se pudo obtener mensaje de error');
      throw new Error(`Fallo en login: ${errorMsg}`);
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}2-login-exitoso.png` });
    console.log('🎉 ¡Login exitoso confirmado!');

    // [Aquí iría el resto de tu código para procesar cursos]

  } catch (error) {
    console.error('❌ ERROR CRÍTICO:', error);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}error-final.png` });
    const htmlContent = await page.content();
    fs.writeFileSync(`${SCREENSHOTS_DIR}error-page.html`, htmlContent);
    console.log('💾 HTML de error guardado');
  } finally {
    await browser.close();
    console.log('🏁 Proceso finalizado');
  }
})();
