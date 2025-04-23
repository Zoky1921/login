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
    // 1. Limpieza básica (sin localStorage)
    console.log('🧹 Limpiando cookies...');
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');

    // 2. Navegación a login
    console.log('🌐 Cargando página de login...');
    await page.goto(`${process.env.MOODLE_URL}/login/index.php`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}0-pagina-login.png` });

    // 3. Verificar elementos del formulario
    console.log('🔍 Verificando formulario...');
    await page.waitForSelector('#username', { visible: true, timeout: 10000 });
    await page.waitForSelector('#password', { visible: true, timeout: 10000 });
    await page.waitForSelector('#loginbtn', { visible: true, timeout: 10000 });

    // 4. Insertar credenciales
    console.log('⌨️ Escribiendo credenciales...');
    await page.type('#username', process.env.MOODLE_USER, { delay: 50 });
    await page.type('#password', process.env.MOODLE_PASS, { delay: 50 });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}1-credenciales-llenadas.png` });

    // 5. Enviar formulario
    console.log('🚀 Enviando formulario...');
    await Promise.all([
      page.click('#loginbtn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
    ]);

    // 6. Verificación de login
    console.log('✅ Verificando login...');
    const currentUrl = page.url();
    console.log('🔗 URL actual:', currentUrl);

    if (currentUrl.includes('login') || await page.$('#loginerrormessage')) {
      const errorMsg = await page.evaluate(() => {
        const errElement = document.querySelector('#loginerrormessage');
        return errElement ? errElement.textContent.trim() : 'Error desconocido';
      }).catch(() => 'No se pudo obtener mensaje de error');
      throw new Error(`Fallo en login: ${errorMsg}`);
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}2-login-exitoso.png` });
    console.log('🎉 ¡Login exitoso confirmado!');

    // 7. Navegar al dashboard de cursos
    console.log('📚 Accediendo al listado de cursos...');
    await page.goto(`${process.env.MOODLE_URL}/my/`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}3-listado-cursos.png` });

    // 8. Obtener enlaces a cursos con selector mejorado
    console.log('🔍 Buscando cursos...');
    const cursos = await page.$$eval('a[href*="course/view.php"]', links => 
      links
        .filter(link => link.textContent.includes('Prevención y Abordaje en Violencia de Género - Comisión'))
        .map(link => {
          const url = new URL(link.href);
          return {
            nombre: link.textContent.trim(),
            url: link.href,
            id: url.searchParams.get('id') || '0',
            comision: link.textContent.match(/Comisión (\d+)/)?.[1] || '0'
          };
        })
        .sort((a, b) => parseInt(a.comision) - parseInt(b.comision))
    );

    console.log(`📊 Cursos encontrados: ${cursos.length}`);
    if (cursos.length === 0) {
      // Guardar HTML para diagnóstico
      const html = await page.content();
      fs.writeFileSync(`${SCREENSHOTS_DIR}listado-cursos.html`, html);
      throw new Error('No se encontraron cursos - HTML guardado para diagnóstico');
    }

    // 9. Procesar cada curso
    for (const [index, curso] of cursos.entries()) {
      try {
        console.log(`\n🔄 [${index + 1}/${cursos.length}] Ingresando a: ${curso.nombre} (ID: ${curso.id})`);
        
        // Navegar al curso
        await page.goto(curso.url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        // Esperar a que cargue el contenido principal
        await page.waitForSelector('#region-main', { timeout: 20000 });
        
        // Tomar captura del curso
        const screenshotName = `4-curso-${index + 1}-comision-${curso.comision}.png`;
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}${screenshotName}`,
          fullPage: true
        });
        console.log(`📸 Captura guardada: ${screenshotName}`);
        
        // Pequeña pausa entre cursos
        await page.waitForTimeout(3000);
        
      } catch (error) {
        console.error(`⚠️ Error en curso ${curso.nombre}:`, error.message);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}error-curso-${index + 1}.png` });
      }
    }

    console.log('✅ Proceso de cursos completado');

  } catch (error) {
    console.error('❌ ERROR CRÍTICO:', error);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}error-final.png` });
    const htmlContent = await page.content();
    fs.writeFileSync(`${SCREENSHOTS_DIR}error-page.html`, htmlContent);
    console.log('💾 HTML de error guardado');
  } finally {
    await browser.close();
    console.log('🏁 Proceso finalizado');
  }
})();
