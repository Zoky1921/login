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
    // 1. Limpieza de cookies y caché
    console.log('🧹 Limpiando datos de sesión anteriores...');
    await page.deleteCookie();
    await page.goto('about:blank');

    // 2. Login
    console.log('🔐 Iniciando sesión...');
    await page.goto(`${process.env.MOODLE_URL}/login/index.php`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await page.type('#username', process.env.MOODLE_USER, { delay: 100 });
    await page.type('#password', process.env.MOODLE_PASS, { delay: 100 });
    await Promise.all([
      page.click('#loginbtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
    ]);

    // 3. Verificación de login
    if (page.url().includes('login')) {
      throw new Error('Posible fallo de autenticación');
    }
    console.log('✅ Login exitoso - URL actual:', page.url());
    await page.screenshot({ path: `${SCREENSHOTS_DIR}1-login-exitoso.png` });

    // 4. Navegación a "Mis cursos" con parámetro anti-caché
    console.log('📚 Cargando listado de cursos...');
    await page.goto(`${process.env.MOODLE_URL}/my/?timestamp=${Date.now()}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}2-listado-cursos.png` });

    // 5. Búsqueda FLEXIBLE de cursos
    console.log('🔍 Buscando cursos con método flexible...');
    
    // Opción 1: Buscar por texto en cualquier elemento <a>
    let cursos = await page.$$eval('a', anchors => 
      anchors
        .filter(a => a.textContent.includes('Prevención y Abordaje'))
        .map(a => ({
          nombre: a.textContent.trim(),
          url: a.href,
          id: new URL(a.href).searchParams.get('id'),
          outerHTML: a.outerHTML
        }))
    );

    // Opción 2: Si no encuentra, buscar en cualquier elemento que contenga el texto
    if (cursos.length === 0) {
      console.log('⚠️ No se encontraron con selector de enlaces, intentando método alternativo...');
      const pageContent = await page.content();
      const regex = /Prevención y Abordaje[\s\S]*?href="(.*?)"/gi;
      const matches = [...pageContent.matchAll(regex)];
      
      cursos = matches.map(match => ({
        nombre: match[0].split('"')[0].trim(),
        url: match[1],
        id: new URL(match[1]).searchParams.get('id')
      }));
    }

    // Guardar HTML para diagnóstico
    fs.writeFileSync(`${SCREENSHOTS_DIR}page-content.html`, await page.content());
    console.log('💾 HTML del listado guardado para diagnóstico');

    console.log('\n📊 RESULTADOS DE BÚSQUEDA:');
    console.log(`- Cursos encontrados: ${cursos.length}`);
    cursos.forEach((curso, i) => {
      console.log(`\n[${i + 1}] ${curso.nombre}`);
      console.log(`   URL: ${curso.url}`);
      console.log(`   ID: ${curso.id}`);
    });

    if (cursos.length === 0) {
      throw new Error('No se encontraron cursos. Posibles causas:\n' +
        '1. El texto del curso es diferente\n' +
        '2. Los cursos están en otra página\n' +
        '3. Requiere interacción para cargar (ej: clic en pestaña)');
    }

    // 6. Procesamiento de cursos
    for (const [index, curso] of cursos.entries()) {
      console.log(`\n🔄 [${index + 1}/${cursos.length}] Procesando: ${curso.nombre}`);
      
      try {
        // Navegación al curso
        await page.goto(curso.url, { waitUntil: 'networkidle2' });
        
        // Esperar a que cargue el contenido principal
        await page.waitForSelector('#region-main', { timeout: 15000 });
        
        // Captura completa
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}3-curso-${index + 1}.png`,
          fullPage: true
        });
        console.log('📸 Captura del curso guardada');

        // Verificación adicional
        const titulo = await page.title();
        console.log('📌 Título de la página:', titulo);

      } catch (error) {
        console.error(`⚠️ Error procesando curso: ${error.message}`);
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
