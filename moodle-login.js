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
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ],
    timeout: 60000
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // 1. Limpieza inicial
    console.log('🧹 Limpiando cookies y caché...');
    await page.deleteCookie();

    // 2. Login
    console.log('🔐 Iniciando sesión...');
    await page.goto(`${process.env.MOODLE_URL}/login/index.php`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    await page.type('#username', process.env.MOODLE_USER, { delay: 50 });
    await page.type('#password', process.env.MOODLE_PASS, { delay: 50 });
    await page.click('#loginbtn');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    // 3. Verificación de login
    if (page.url().includes('login')) {
      throw new Error('Error en el login - Redirigido a página de login');
    }
    console.log('✅ Login exitoso');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}1-login-exitoso.png` });

    // 4. Navegar a "Mis cursos"
    console.log('📚 Accediendo al listado de cursos...');
    await page.goto(`${process.env.MOODLE_URL}/my/`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}2-listado-cursos.png` });

    // 5. Procesar cursos
    const cursos = await page.$$eval('a.aalink.coursename', links => 
      links
        .filter(link => link.textContent.includes('Prevención y Abordaje'))
        .map(link => ({
          nombre: link.textContent.trim().substring(0, 50),
          url: link.href,
          id: new URL(link.href).searchParams.get('id') || '0'
        }))
    );

    console.log(`🔍 Encontrados ${cursos.length} cursos`);

    for (const [index, curso] of cursos.entries()) {
      console.log(`\n🔄 [${index + 1}] Procesando: ${curso.nombre}`);
      
      try {
        await page.goto(curso.url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        await page.waitForSelector('#region-main', { timeout: 15000 });
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}3-curso-${index + 1}-${curso.id}.png`,
          fullPage: true
        });
        console.log(`📸 Captura guardada: 3-curso-${index + 1}-${curso.id}.png`);
        
        await page.waitForTimeout(2000); // Espera entre cursos
        
      } catch (error) {
        console.error(`⚠️ Error en curso ${curso.nombre}:`, error.message);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}error-curso-${index + 1}.png` });
      }
    }

  } catch (error) {
    console.error('❌ Error crítico:', error);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}error-general.png` });
  } finally {
    await browser.close();
    console.log('🏁 Proceso completado');
  }
})();
