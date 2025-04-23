const puppeteer = require('puppeteer');
const fs = require('fs');

// Configuración
const SCREENSHOTS_DIR = 'capturas/';
const DELAY = 2000; // 2 segundos entre acciones

(async () => {
  // Preparar directorio
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // 1. Captura de Login
    await login(page);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}1-login-exitoso.png` });
    console.log('📸 Captura de login guardada');

    // 2. Captura de Listado de Cursos
    await page.goto(`${process.env.MOODLE_URL}/my/`, { waitUntil: 'networkidle2' });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}2-listado-cursos.png` });
    console.log('📸 Captura de listado de cursos guardada');

    // 3. Procesar cada curso
    const cursos = await obtenerCursos(page);
    console.log(`🔍 Encontrados ${cursos.length} cursos`);

    for (const [index, curso] of cursos.entries()) {
      await procesarCurso(page, curso, index);
      await page.waitForTimeout(DELAY); // Espera entre cursos
    }

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}error.png` });
  } finally {
    await browser.close();
    console.log('🏁 Proceso completado');
  }
})();

// Funciones auxiliares
async function login(page) {
  console.log('🔐 Iniciando login...');
  await page.goto(`${process.env.MOODLE_URL}/login/index.php`, { 
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  await page.type('#username', process.env.MOODLE_USER);
  await page.type('#password', process.env.MOODLE_PASS);
  await page.click('#loginbtn');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  console.log('✅ Login exitoso');
}

async function obtenerCursos(page) {
  return await page.$$eval('a.aalink.coursename', links => 
    links
      .filter(link => link.textContent.includes('Prevención y Abordaje'))
      .map(link => ({
        nombre: link.textContent.trim(),
        url: link.href,
        id: new URL(link.href).searchParams.get('id') || '0'
      }))
  );
}

async function procesarCurso(page, curso, index) {
  try {
    console.log(`\n🔄 [${index + 1}] Procesando: ${curso.nombre}`);
    await page.goto(curso.url, { waitUntil: 'domcontentloaded' });
    
    // Captura completa de la página del curso
    await page.screenshot({
      path: `${SCREENSHOTS_DIR}3-curso-${index + 1}-${curso.id}.png`,
      fullPage: true
    });
    console.log(`📸 Captura de curso guardada: 3-curso-${index + 1}-${curso.id}.png`);

  } catch (error) {
    console.error(`⚠️ Error en curso ${curso.nombre}:`, error);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}error-curso-${index + 1}.png` });
  }
}
