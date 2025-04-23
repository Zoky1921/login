const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  // Configuración del navegador con opciones para CI
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ],
    ignoreHTTPSErrors: true
  });

  const page = await browser.newPage();
  
  try {
    console.log('🔄 Navegando a la página de login...');
    await page.goto(`${process.env.MOODLE_URL}/login/index.php`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000  // 90 segundos de timeout
    });

    // Rellenar credenciales
    console.log('🔑 Ingresando credenciales...');
    await page.type('#username', process.env.MOODLE_USER);
    await page.type('#password', process.env.MOODLE_PASS);

    // Enviar formulario
    console.log('🚀 Enviando formulario de login...');
    await Promise.all([
      page.click('#loginbtn'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 })
    ]);

    // Verificar login exitoso
    const pageTitle = await page.title();
    if (pageTitle.includes('Dashboard') || pageTitle.includes('Inicio')) {
      console.log('✅ Login exitoso!');
      await page.screenshot({ path: 'login-success.png' });
    } else {
      throw new Error(`Posible fallo en login. Título: ${pageTitle}`);
    }

  } catch (error) {
    console.error('❌ Error durante el proceso:', error);
    await page.screenshot({ path: 'error.png' });
    const htmlContent = await page.content();
    fs.writeFileSync('error.html', htmlContent);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
