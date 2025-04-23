const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const SCREENSHOTS_DIR = 'capturas/';
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    timeout: 60000
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // 1. Cerrar sesión previa si existe
    await cerrarSesion(page);
    
    // 2. Login completo
    await login(page);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}1-login-exitoso.png` });
    console.log('✅ Login exitoso');

    // 3. Navegar a "Mis cursos" con verificación
    await page.goto(`${process.env.MOODLE_URL}/my/`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Verificar que no muestra mensaje de sesión existente
    const tieneMensajeSesion = await page.evaluate(() => {
      return document.body.textContent.includes('ya ha iniciado sesión');
    });

    if (tieneMensajeSesion) {
      throw new Error('Persiste mensaje de sesión activa');
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}2-listado-cursos.png` });
    console.log('📚 Captura de listado de cursos guardada');

    // 4. Procesar cursos
    const cursos = await obtenerCursos(page);
    console.log(`🔍 Encontrados ${cursos.length} cursos`);

    for (const [index, curso] of cursos.entries()) {
      await procesarCurso(page, curso, index);
      await page.waitForTimeout(2000);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}error-${Date.now()}.png` });
  } finally {
    await browser.close();
    console.log('🏁 Proceso completado');
  }
})();

// Funciones auxiliares mejoradas
async function cerrarSesion(page) {
  try {
    console.log('🔒 Cerrando sesión previa...');
    await page.goto(`${process.env.MOODLE_URL}/login/logout.php?sesskey=${await obtenerSesskey(page)}`, {
      waitUntil: 'networkidle2',
      timeout: 10000
    });
    console.log('🚪 Sesión cerrada (si existía)');
  } catch (error) {
    console.log('ℹ️ No había sesión activa o no se pudo cerrar');
  }
}

async function obtenerSesskey(page) {
  await page.goto(`${process.env.MOODLE_URL}/my/`, { waitUntil: 'domcontentloaded' });
  return await page.evaluate(() => {
    return document.querySelector('[name="sesskey"]')?.value || '';
  });
}

async function login(page) {
  console.log('🔐 Iniciando sesión...');
  await page.goto(`${process.env.MOODLE_URL}/login/index.php`, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  
  await page.type('#username', process.env.MOODLE_USER);
  await page.type('#password', process.env.MOODLE_PASS);
  await page.click('#loginbtn');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  // Verificación adicional
  if (await page.$('#loginerrormessage')) {
    throw new Error('Error en credenciales');
  }
}

async function obtenerCursos(page) {
  return await page.$$eval('a.aalink.coursename', links => 
    links
      .filter(link => link.textContent.includes('Prevención y Abordaje'))
      .map(link => {
        const url = new URL(link.href);
        return {
          nombre: link.textContent.trim(),
          url: link.href,
          id: url.searchParams.get('id') || '0'
        };
      })
  );
}

async function procesarCurso(page, curso, index) {
  const screenshotPath = `${SCREENSHOTS_DIR}3-curso-${index + 1}-${curso.id}.png`;
  
  try {
    console.log(`\n🔄 [${index + 1}] Ingresando a: ${curso.nombre}`);
    await page.goto(curso.url, { waitUntil: 'networkidle2' });
    
    // Esperar contenido específico del curso
    await page.waitForSelector('#region-main', { timeout: 15000 });
    await page.screenshot({ path: screenshotPath });
    console.log(`📸 Captura guardada: ${screenshotPath}`);

  } catch (error) {
    console.error(`⚠️ Error en curso ${curso.nombre}:`, error.message);
    await page.screenshot({ path: screenshotPath.replace('.png', '-error.png') });
  }
}
