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
    // 1. Cierre de sesión forzado
    await cerrarSesionForzado(page);
    
    // 2. Login completo con cookies limpias
    await page.deleteCookie();
    await login(page);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}1-login-exitoso.png` });
    console.log('✅ Login exitoso');

    // 3. Navegación directa a "Mis cursos" (evitando caché)
    await page.goto(`${process.env.MOODLE_URL}/my/?timestamp=${Date.now()}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 4. Verificación POSITIVA de listado de cursos
    const tieneCursos = await page.evaluate(() => {
      return document.querySelectorAll('a.aalink.coursename').length > 0;
    });

    if (!tieneCursos) {
      throw new Error('No se detectaron cursos en el listado');
    }

    await page.screenshot({ path: `${SCREENSHOTS_DIR}2-listado-cursos.png` });
    console.log('📚 Listado de cursos verificado');

    // 5. Procesamiento de cursos con confirmación
    const cursos = await obtenerCursos(page);
    console.log(`🔍 Cursos a procesar: ${cursos.length}`);

    for (const [index, curso] of cursos.entries()) {
      await procesarCurso(page, curso, index);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}error-${Date.now()}.png` });
  } finally {
    await browser.close();
    console.log('🏁 Proceso completado');
  }
})();

// Función mejorada de cierre de sesión
async function cerrarSesionForzado(page) {
  console.log('🔒 Cerrando sesiones previas...');
  try {
    await page.goto(`${process.env.MOODLE_URL}/login/logout.php`, {
      waitUntil: 'networkidle2',
      timeout: 10000
    });
    // Esperar a que aparezca el mensaje de logout
    await page.waitForSelector('.alert-success', { timeout: 5000 });
    console.log('🚪 Sesión cerrada exitosamente');
  } catch (error) {
    console.log('ℹ️ No se encontró sesión activa');
  }
}

// Función mejorada de procesamiento de cursos
async function procesarCurso(page, curso, index) {
  const screenshotPath = `${SCREENSHOTS_DIR}3-curso-${index + 1}-${curso.id}.png`;
  
  try {
    console.log(`\n🔄 [${index + 1}] Ingresando a: ${curso.nombre}`);
    
    // Navegación con parámetro anti-caché
    await page.goto(`${curso.url}&timestamp=${Date.now()}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // VERIFICACIÓN POSITIVA DE INGRESO AL CURSO
    const estaEnCurso = await page.evaluate(() => {
      return document.querySelector('#page-content') !== null;
    });

    if (!estaEnCurso) {
      throw new Error('No se pudo confirmar el ingreso al curso');
    }

    // Captura inteligente del área principal
    await page.screenshot({
      path: screenshotPath,
      clip: { x: 0, y: 0, width: 1280, height: 800 }
    });

    console.log(`📸 Captura confirmada: ${screenshotPath}`);
    console.log(`✔️ Acceso verificado al curso: ${curso.nombre}`);

    await page.waitForTimeout(2000);

  } catch (error) {
    console.error(`⚠️ Error en curso ${curso.nombre}:`, error.message);
    await page.screenshot({ path: screenshotPath.replace('.png', '-error.png') });
  }
}

// Resto de funciones (login, obtenerCursos) se mantienen igual que antes
