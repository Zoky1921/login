const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const SCREENSHOTS_DIR = 'capturas/';
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: false,  // Cambiado a false para debug
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ],
    timeout: 60000
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Configurar User-Agent para parecer un navegador real
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  try {
    // 1. Limpiar cookies y almacenamiento
    console.log('🧹 Limpiando cookies y almacenamiento...');
    await page.deleteCookie();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // 2. Ir directamente a la página de login
    console.log('🔐 Navegando a la página de login...');
    await page.goto(`${process.env.MOODLE_URL}/login/index.php`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}0-pagina-login.png` });

    // 3. Rellenar credenciales
    console.log('⌨️ Escribiendo credenciales...');
    await page.type('#username', process.env.MOODLE_USER, { delay: 100 });
    await page.type('#password', process.env.MOODLE_PASS, { delay: 100 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}1-credenciales-llenadas.png` });

    // 4. Enviar formulario
    console.log('🚀 Enviando formulario...');
    await Promise.all([
      page.click('#loginbtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
    ]);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}2-post-login.png` });

    // 5. Verificación EXPLÍCITA de login exitoso
    const urlPostLogin = page.url();
    if (urlPostLogin.includes('login') || await page.$('#loginerrormessage')) {
      throw new Error('Error en el login - Redirigido a página de login');
    }
    console.log(`✅ Login exitoso - URL actual: ${urlPostLogin}`);

    // 6. Captura del dashboard
    await page.screenshot({ path: `${SCREENSHOTS_DIR}3-dashboard.png` });
    console.log('📸 Captura del dashboard guardada');

    // 7. Navegar a "Mis cursos"
    console.log('📚 Navegando a "Mis cursos"...');
    await page.goto(`${process.env.MOODLE_URL}/my/`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}4-listado-cursos.png` });

    // 8. Procesar cursos
    const cursos = await page.$$eval('a.aalink.coursename', links => 
      links
        .filter(link => link.textContent.includes('Prevención y Abordaje'))
        .map(link => ({
          nombre: link.textContent.trim(),
          url: link.href,
          id: new URL(link.href).searchParams.get('id') || '0'
        }))
    );

    console.log(`🔍 Encontrados ${cursos.length} cursos`);
    
    for (const [index, curso] of cursos.entries()) {
      console.log(`\n🔄 [${index + 1}] Procesando: ${curso.nombre}`);
      
      try {
        // 9. Navegar al curso
        await page.goto(curso.url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        // 10. Verificar contenido del curso
        await page.waitForSelector('#region-main', { timeout: 15000 });
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}5-curso-${index + 1}-${curso.id}.png`,
          fullPage: true
        });
        console.log(`📸 Captura del curso guardada`);

      } catch (error) {
        console.error(`⚠️ Error en curso ${curso.nombre}:`, error.message);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}error-curso-${index + 1}.png` });
      }
      
      await page.waitForTimeout(2000);
    }

  } catch (error) {
    console.error('❌ Error crítico:', error);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}error-final.png` });
  } finally {
    await browser.close();
    console.log('🏁 Proceso completado');
  }
})();
