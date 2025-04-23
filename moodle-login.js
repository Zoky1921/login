const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    console.log('🔹 Iniciando sesión en Moodle...');
    
    // 1. Ir a la página de login
    await page.goto(`${process.env.MOODLE_URL}/login/index.php`, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });

    // 2. Rellenar usuario y contraseña
    await page.type('#username', process.env.MOODLE_USER);
    await page.type('#password', process.env.MOODLE_PASS);

    // 3. Hacer clic en el botón de login
    await Promise.all([
      page.click('#loginbtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    // 4. Verificar si el login fue exitoso
    const pageTitle = await page.title();
    if (pageTitle.includes('Dashboard') || pageTitle.includes('Inicio')) {
      console.log('✅ ¡Login exitoso!');
      await page.screenshot({ path: 'moodle-login-success.png' });
    } else {
      throw new Error('Login fallido. Título inesperado: ' + pageTitle);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: 'error.png' }); // Debug
  } finally {
    await browser.close();
  }
})();
