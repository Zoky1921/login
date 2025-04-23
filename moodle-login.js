const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const screenshotBasePath = 'screenshots/';
  fs.mkdirSync(screenshotBasePath, { recursive: true });

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // 1. Login (rápido)
    await login(page);
    
    // 2. Ir a "Mis cursos"
    await page.goto(`${process.env.MOODLE_URL}/my/`, { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    await page.screenshot({ path: `${screenshotBasePath}0-dashboard.png` });

    // 3. Buscar y procesar cursos
    const cursos = await getCourses(page);
    console.log(`📚 Cursos encontrados: ${cursos.length}`);

    for (const [index, curso] of cursos.entries()) {
      await processCourse(page, curso, index, screenshotBasePath);
    }

  } catch (error) {
    console.error('❌ Error general:', error);
    await page.screenshot({ path: `${screenshotBasePath}error-general.png` });
  } finally {
    await browser.close();
  }
})();

// Funciones auxiliares
async function login(page) {
  await page.goto(`${process.env.MOODLE_URL}/login/index.php`, { 
    waitUntil: 'networkidle2',
    timeout: 60000
  });
  await page.type('#username', process.env.MOODLE_USER);
  await page.type('#password', process.env.MOODLE_PASS);
  await page.click('#loginbtn');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  console.log('✅ Login exitoso');
}

async function getCourses(page) {
  return await page.$$eval('a.aalink.coursename', links => 
    links
      .filter(link => link.textContent.includes('Prevención y Abordaje'))
      .map(link => ({
        nombre: link.textContent.trim(),
        url: link.href,
        id: link.href.match(/id=(\d+)/)?.[1] || '0'
      }))
  );
}

async function processCourse(page, curso, index, path) {
  try {
    console.log(`\n🔄 [${index + 1}] Ingresando a: ${curso.nombre}`);
    
    // Ir al curso y esperar contenido
    await page.goto(curso.url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#region-main', { timeout: 15000 });
    
    // Captura inteligente (solo área de contenido)
    await page.screenshot({
      path: `${path}${index + 1}-[${curso.id}]_${curso.nombre.substring(0, 20)}.png`,
      clip: await getMainContentArea(page)
    });
    
    console.log(`📸 Captura guardada: ${index + 1}-[${curso.id}]_${curso.nombre.substring(0, 20)}.png`);

  } catch (error) {
    console.error(`⚠️ Error en curso ${curso.nombre}:`, error.message);
    await page.screenshot({ path: `${path}error-${index + 1}-${curso.id}.png` });
  }
}

async function getMainContentArea(page) {
  return await page.$eval('#region-main', el => {
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(rect.x, 0),
      y: Math.max(rect.y, 0),
      width: Math.min(rect.width, window.innerWidth),
      height: Math.min(rect.height, window.innerHeight)
    };
  });
}
