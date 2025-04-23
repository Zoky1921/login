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
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // 1. Limpieza de cookies
    console.log('🧹 Limpiando cookies anteriores...');
    await page.deleteCookie();

    // 2. Proceso de login
    console.log('🔐 Iniciando sesión...');
    await page.goto(`${process.env.MOODLE_URL}/login/index.php`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await page.type('#username', process.env.MOODLE_USER);
    await page.type('#password', process.env.MOODLE_PASS);
    await page.click('#loginbtn');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // Verificación de login
    if (page.url().includes('login')) {
      throw new Error('Redirección a página de login - Credenciales incorrectas');
    }
    console.log('✅ Login exitoso - URL actual:', page.url());

    // 3. Navegación a "Mis cursos"
    console.log('📚 Accediendo al listado de cursos...');
    await page.goto(`${process.env.MOODLE_URL}/my/`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 4. Búsqueda MEJORADA de cursos
    console.log('🔍 Buscando cursos con selector preciso...');
    const cursos = await page.$$eval('a.aalink.coursename.mr-2.mb-1', links => 
      links.map(link => {
        const url = new URL(link.href);
        return {
          nombre: link.textContent.trim(),
          url: link.href,
          id: url.searchParams.get('id'),
          html: link.outerHTML
        };
      })
    );

    console.log('\n📊 RESULTADOS:');
    console.log(`- Cursos encontrados: ${cursos.length}`);
    cursos.forEach((curso, index) => {
      console.log(`\n[${index + 1}] ${curso.nombre}`);
      console.log(`   ID: ${curso.id}`);
      console.log(`   URL: ${curso.url}`);
    });

    if (cursos.length === 0) {
      throw new Error('No se encontraron cursos - Revisar selectores');
    }

    // 5. Procesamiento de cursos
    for (const [index, curso] of cursos.entries()) {
      console.log(`\n🔄 [${index + 1}/${cursos.length}] Procesando: ${curso.nombre}`);
      
      try {
        // Navegación al curso
        await page.goto(curso.url, { waitUntil: 'networkidle2' });
        
        // Verificación de contenido
        const titulo = await page.title();
        console.log('📌 Título del curso:', titulo);
        
        // Captura inteligente
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}curso-${index + 1}-${curso.id}.png`,
          fullPage: true
        });
        console.log('📸 Captura guardada');

        // Verificación adicional
        const breadcrumb = await page.$('.breadcrumb');
        if (!breadcrumb) {
          throw new Error('No se encontró el breadcrumb de navegación');
        }
        console.log('✔️ Estructura del curso verificada');

      } catch (error) {
        console.error(`⚠️ Error en curso: ${error.message}`);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}error-curso-${index + 1}.png` });
      }
      
      await page.waitForTimeout(2000);
    }

  } catch (error) {
    console.error('❌ Error crítico:', error);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}error-general.png` });
  } finally {
    await browser.close();
    console.log('🏁 Proceso finalizado');
  }
})();
