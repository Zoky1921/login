const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  // Configuración mejorada
  const screenshotBasePath = 'screenshots/';
  fs.mkdirSync(screenshotBasePath, { recursive: true });

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    console.log('🔹 Iniciando sesión...');
    
    // 1. Login
    await page.goto(`${process.env.MOODLE_URL}/login/index.php`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    await page.type('#username', process.env.MOODLE_USER);
    await page.type('#password', process.env.MOODLE_PASS);
    await page.click('#loginbtn');
    await page.waitForNavigation();
    
    console.log('✅ Login exitoso');
    
    // 2. Captura del dashboard
    await page.screenshot({ path: `${screenshotBasePath}dashboard.png` });
    console.log('📸 Captura del dashboard guardada');

    // 3. Navegación a cursos
    await page.goto(`${process.env.MOODLE_URL}/my/`);
    const cursos = await page.$$eval('a.aalink.coursename', links => 
      links
        .filter(link => link.textContent.includes('Prevención y Abordaje'))
        .map(link => ({
          nombre: link.textContent.trim().replace(/[^a-z0-9áéíóúüñ]/gi, '_'),
          url: link.href
        }))
    );

    console.log(`📚 Encontrados ${cursos.length} cursos`);
    
    // 4. Procesar cada curso
    for (const [index, curso] of cursos.entries()) {
      console.log(`\n🔄 Curso ${index + 1}: ${curso.nombre}`);
      await page.goto(curso.url, { waitUntil: 'networkidle2' });
      await page.screenshot({
        path: `${screenshotBasePath}curso_${index + 1}_${curso.nombre}.png`,
        fullPage: true
      });
      console.log(`📸 Captura de ${curso.nombre} guardada`);
      await page.waitForTimeout(3000);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: `${screenshotBasePath}error.png` });
  } finally {
    await browser.close();
    console.log('🏁 Proceso completado');
  }
})();
