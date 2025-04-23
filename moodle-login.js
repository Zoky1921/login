const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  // Configuración
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
    // 1. Login y captura inicial
    await login(page);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}1-login-exitoso.png` });
    console.log('✅ Login exitoso - Captura guardada');

    // 2. Navegar a "Mis cursos" y capturar
    await page.goto(`${process.env.MOODLE_URL}/my/`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}2-listado-cursos.png` });
    console.log('📚 Captura de listado de cursos guardada');

    // 3. Procesar cada curso
    const cursos = await obtenerCursos(page);
    console.log(`🔍 Encontrados ${cursos.length} cursos`);

    for (const [index, curso] of cursos.entries()) {
      await procesarCurso(page, curso, index);
      await page.waitForTimeout(2000); // Espera breve entre cursos
    }

  } catch (error) {
    console.error('❌ Error general:', error);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}error-general.png` });
  } finally {
    await browser.close();
  }
})();

// Funciones mejoradas
async function login(page) {
  console.log('🔐 Iniciando sesión...');
  await page.goto(`${process.env.MOODLE_URL}/login/index.php`, {
    waitUntil: 'networkidle2',
    timeout: 60000
  });
  
  await page.type('#username', process.env.MOODLE_USER);
  await page.type('#password', process.env.MOODLE_PASS);
  await Promise.all([
    page.click('#loginbtn'),
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
  ]);

  // Verificación adicional de login
  if (page.url().includes('login')) {
    throw new Error('Redirección a login - Credenciales incorrectas');
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
    
    // Navegación con verificación
    await page.goto(curso.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Esperar elemento específico del curso
    await page.waitForSelector('#region-main', { timeout: 15000 });
    
    // Captura inteligente
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
      clip: await obtenerAreaContenido(page)
    });
    
    console.log(`📸 Captura guardada: ${screenshotPath}`);

  } catch (error) {
    console.error(`⚠️ Error en curso ${curso.nombre}:`, error.message);
    await page.screenshot({ path: screenshotPath.replace('.png', '-error.png') });
  }
}

async function obtenerAreaContenido(page) {
  return await page.$eval('#region-main', el => {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: Math.min(rect.height, window.innerHeight)
    };
  });
}
