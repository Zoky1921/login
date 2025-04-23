const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  // Configuración
  const screenshotBasePath = 'screenshots/';
  fs.mkdirSync(screenshotBasePath, { recursive: true });

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    timeout: 120000 // 2 minutos para inicio del navegador
  });

  const page = await browser.newPage();
  
  try {
    console.log('🔹 Iniciando proceso...');
    
    // 1. Login rápido con verificación
    console.log('🔐 Realizando login...');
    await page.goto(`${process.env.MOODLE_URL}/login/index.php`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    await page.type('#username', process.env.MOODLE_USER);
    await page.type('#password', process.env.MOODLE_PASS);
    await Promise.all([
      page.click('#loginbtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
    ]);

    // Verificación inmediata de login
    if (page.url().includes('login')) {
      throw new Error('Login fallido - Redirigido a página de login');
    }
    console.log('✅ Login exitoso');
    await page.screenshot({ path: `${screenshotBasePath}1_dashboard.png` });

    // 2. Navegación rápida a cursos
    console.log('📚 Buscando cursos...');
    await page.goto(`${process.env.MOODLE_URL}/my/`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 3. Procesamiento acelerado de cursos
    const cursos = await page.$$eval('a.aalink.coursename', links => 
      links
        .filter(link => link.textContent.includes('Prevención y Abordaje'))
        .map(link => ({
          nombre: link.textContent.trim().substring(0, 30).replace(/[^a-z0-9]/gi, '_'),
          url: link.href
        }))
    );

    console.log(`🔄 Encontrados ${cursos.length} cursos - Procesando...`);
    
    for (const [index, curso] of cursos.entries()) {
      const startTime = Date.now();
      console.log(`\n📂 Curso ${index + 1}/${cursos.length}: ${curso.nombre}`);
      
      // Navegación con timeout corto
      await page.goto(curso.url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Captura inmediata
      await page.screenshot({
        path: `${screenshotBasePath}2_curso_${index + 1}.png`,
        fullPage: false
      });
      console.log(`📸 Captura tomada en ${(Date.now() - startTime)/1000} segundos`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: `${screenshotBasePath}error.png` });
  } finally {
    await browser.close();
    console.log('🏁 Proceso finalizado');
  }
})();
