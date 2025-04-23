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
    // 1. Limpieza de cookies
    console.log('🧹 Limpiando cookies anteriores...');
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');

    // 2. Proceso de login (MANTENIDO COMO FUNCIONA ACTUALMENTE)
    console.log('🔐 Iniciando sesión...');
    await page.goto(`${process.env.MOODLE_URL}/login/index.php`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    await page.type('#username', process.env.MOODLE_USER, { delay: 50 });
    await page.type('#password', process.env.MOODLE_PASS, { delay: 50 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}1-credenciales-llenadas.png` });
    
    await Promise.all([
      page.click('#loginbtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
    ]);

    // Verificación de login exitoso
    const currentUrl = page.url();
    if (currentUrl.includes('login') || await page.$('#loginerrormessage')) {
      const errorMsg = await page.evaluate(() => {
        const errElement = document.querySelector('#loginerrormessage');
        return errElement ? errElement.textContent.trim() : 'Error desconocido';
      }).catch(() => 'No se pudo obtener mensaje de error');
      throw new Error(`Fallo en login: ${errorMsg}`);
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}2-login-exitoso.png` });
    console.log('🎉 ¡Login exitoso confirmado!');

    // 3. Acceso a cursos (VERSIÓN MEJORADA)
    console.log('📚 Cargando listado de cursos...');
    await page.goto(`${process.env.MOODLE_URL}/my/`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}3-listado-cursos.png` });

    // Estrategia múltiple para encontrar cursos
    console.log('🔍 Buscando cursos con 3 métodos diferentes...');
    let cursos = [];

    // Método 1: Selector exacto que me proporcionaste
    try {
      cursos = await page.$$eval('a.aalink.coursename.mr-2.mb-1', links => 
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
      console.log(`📌 (Método 1) Cursos encontrados: ${cursos.length}`);
    } catch (error) {
      console.log('⚠️ Método 1 falló:', error.message);
    }

    // Método 2: Búsqueda por texto en todo el HTML
    if (cursos.length === 0) {
      console.log('🔍 Intentando método alternativo (búsqueda por texto)...');
      const pageContent = await page.content();
      
      // Patrón regex mejorado para encontrar enlaces
      const regex = /<a [^>]*class="[^"]*aalink[^"]*"[^>]*>([^<]*Prevención y Abordaje[^<]*)<\/a>/gi;
      const matches = [...pageContent.matchAll(regex)];
      
      cursos = matches.map(match => {
        const urlMatch = match[0].match(/href="([^"]*)"/);
        return {
          nombre: match[1].trim(),
          url: urlMatch ? urlMatch[1] : '',
          id: urlMatch ? new URL(urlMatch[1]).searchParams.get('id') : '0'
        };
      }).filter(curso => curso.url !== '');
      
      console.log(`📌 (Método 2) Cursos encontrados: ${cursos.length}`);
    }

    // Método 3: Scroll y nueva búsqueda (para contenido dinámico)
    if (cursos.length === 0) {
      console.log('🔄 Intentando con scroll y espera...');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(3000);
      
      cursos = await page.$$eval('a', links => 
        links
          .filter(link => link.textContent.includes('Prevención y Abordaje'))
          .map(link => {
            const url = new URL(link.href);
            return {
              nombre: link.textContent.trim(),
              url: link.href,
              id: url.searchParams.get('id')
            };
          })
      );
      console.log(`📌 (Método 3) Cursos encontrados: ${cursos.length}`);
    }

    // Verificación final
    if (cursos.length === 0) {
      // Guardar recursos para diagnóstico
      fs.writeFileSync(`${SCREENSHOTS_DIR}debug-page.html`, await page.content());
      await page.screenshot({ path: `${SCREENSHOTS_DIR}debug-fullpage.png`, fullPage: true });
      throw new Error('No se encontraron cursos después de 3 métodos de búsqueda. Se guardaron archivos para diagnóstico.');
    }

    console.log('\n📊 Cursos identificados:');
    cursos.forEach((curso, i) => {
      console.log(`${i + 1}. ${curso.nombre} (ID: ${curso.id})`);
    });

    // 4. Procesamiento de cada curso
    for (const [index, curso] of cursos.entries()) {
      console.log(`\n🔄 [${index + 1}/${cursos.length}] Procesando: ${curso.nombre}`);
      
      try {
        // Navegación al curso
        await page.goto(curso.url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        // Esperar elementos clave del curso
        await page.waitForSelector('#region-main', { timeout: 15000 });
        
        // Captura del curso
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}4-curso-${index + 1}-${curso.id}.png`,
          fullPage: true
        });
        console.log('📸 Captura del curso guardada');

        // Verificación adicional
        const tituloCurso = await page.title();
        console.log('📌 Título del curso:', tituloCurso);

        // Pequeña pausa entre cursos
        await page.waitForTimeout(2000);

      } catch (error) {
        console.error(`⚠️ Error en curso "${curso.nombre}":`, error.message);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}error-curso-${index + 1}.png` });
      }
    }

    console.log('\n✅ Todos los cursos procesados exitosamente');

  } catch (error) {
    console.error('❌ ERROR CRÍTICO:', error);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}error-final.png` });
  } finally {
    await browser.close();
    console.log('🏁 Proceso finalizado');
  }
})();
