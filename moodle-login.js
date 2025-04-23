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

    // Verificación de login exitoso
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

    // 4. Verificación EXTENDIDA de cursos
    console.log('🔍 Buscando cursos...');
    const cursosHTML = await page.content();
    fs.writeFileSync(`${SCREENSHOTS_DIR}page-content.html`, cursosHTML);
    console.log('💾 HTML del listado guardado como page-content.html');

    const cursos = await page.$$eval('a.aalink.coursename', links => {
      console.log('Enlaces encontrados:', links.length); // Debug interno
      return links
        .filter(link => link.textContent.includes('Prevención y Abordaje'))
        .map(link => {
          const url = new URL(link.href);
          return {
            nombre: link.textContent.trim(),
            url: link.href,
            id: url.searchParams.get('id') || '0',
            html: link.outerHTML // Guardamos el HTML para debug
          };
        });
    });

    console.log(`\n📊 RESULTADOS DE BÚSQUEDA:`);
    console.log(`- Total de enlaces analizados: ${cursos.length}`);
    console.log(`- Cursos filtrados encontrados: ${cursos.length}`);
    
    if (cursos.length === 0) {
      console.log('⚠️ No se encontraron cursos. Posibles causas:');
      console.log('1. Los cursos no contienen "Prevención y Abordaje" en el nombre');
      console.log('2. La estructura HTML de Moodle ha cambiado');
      console.log('3. El selector CSS no coincide con tu versión de Moodle');
      
      // Guardamos todo el HTML para análisis
      fs.writeFileSync(`${SCREENSHOTS_DIR}full-page.html`, await page.content());
      console.log('🆘 HTML completo guardado como full-page.html para diagnóstico');
    }

    // 5. Procesamiento de cursos encontrados
    for (const [index, curso] of cursos.entries()) {
      console.log(`\n🔄 [${index + 1}/${cursos.length}] Procesando curso: ${curso.nombre}`);
      console.log('🔗 Enlace del curso:', curso.url);
      console.log('🏷️ ID del curso:', curso.id);
      
      try {
        // Navegación al curso
        await page.goto(curso.url, { waitUntil: 'networkidle2' });
        
        // Verificación de contenido del curso
        const tituloCurso = await page.title();
        console.log('📌 Título de la página:', tituloCurso);
        
        await page.screenshot({ path: `${SCREENSHOTS_DIR}curso-${index + 1}.png` });
        console.log('📸 Captura del curso guardada');
        
        // Verificación adicional
        const contenido = await page.$('#region-main');
        if (!contenido) {
          throw new Error('No se encontró el área de contenido principal');
        }
        console.log('✔️ Contenido del curso verificado');
        
      } catch (error) {
        console.error(`⚠️ Error procesando curso: ${error.message}`);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}error-curso-${index + 1}.png` });
      }
      
      await page.waitForTimeout(2000);
    }

  } catch (error) {
    console.error('❌ ERROR CRÍTICO:', error);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}error-critico.png` });
  } finally {
    await browser.close();
    console.log('🏁 Proceso finalizado');
  }
})();
