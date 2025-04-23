const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    // 1. Login
    await page.goto(`${process.env.MOODLE_URL}/login/index.php`, { waitUntil: 'networkidle2' });
    await page.type('#username', process.env.MOODLE_USER);
    await page.type('#password', process.env.MOODLE_PASS);
    await page.click('#loginbtn');
    await page.waitForNavigation();

    console.log('✅ Login exitoso');

    // 2. Navegar al dashboard de cursos
    await page.goto(`${process.env.MOODLE_URL}/my/`, { waitUntil: 'networkidle2' });
    
    // 3. Buscar todos los enlaces a cursos
    const cursos = await page.$$eval('a.aalink.coursename', links => 
      links
        .filter(link => link.textContent.includes('Prevención y Abordaje en Violencia de Género'))
        .map(link => ({
          nombre: link.textContent.trim(),
          url: link.href
        }))
    );

    console.log(`📚 Cursos encontrados: ${cursos.length}`);

    // 4. Procesar cada curso
    for (const [index, curso] of cursos.entries()) {
      console.log(`\n🔄 Ingresando a: ${curso.nombre}`);
      await page.goto(curso.url, { waitUntil: 'domcontentloaded' });
      
      // Captura completa de la página (ajusta el viewport si es necesario)
      await page.setViewport({ width: 1200, height: 800 });
      await page.screenshot({
        path: `curso-${index + 1}.png`,
        fullPage: true
      });

      console.log(`📸 Captura guardada: curso-${index + 1}.png`);
      await page.waitForTimeout(2000); // Espera entre cursos
    }

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: 'error.png' });
  } finally {
    await browser.close();
  }
})();
