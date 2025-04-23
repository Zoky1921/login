const puppeteer = require('puppeteer');
const fs = require('fs');

// Configuración
const TIEMPO_ESPERA = 5000; // 5 segundos entre acciones

(async () => {
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
  
  try {
    console.log('🔹 Iniciando navegación...');
    
    // 1. Login
    await login(page);
    
    // 2. Navegar a cursos
    await page.goto(`${process.env.MOODLE_URL}/my/`, { 
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // 3. Procesar cursos
    await procesarCursos(page);

  } catch (error) {
    console.error('❌ Error crítico:', error);
    await page.screenshot({ path: 'error.png' });
  } finally {
    await browser.close();
    console.log('🏁 Proceso finalizado');
  }
})();

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

async function procesarCursos(page) {
  const cursos = await page.$$eval('a.aalink.coursename', links => 
    links
      .filter(link => link.textContent.includes('Prevención y Abordaje en Violencia de Género'))
      .map(link => ({
        nombre: link.textContent.trim().replace(/[^a-z0-9]/gi, '_').slice(0, 50),
        url: link.href
      }))
  );

  console.log(`📚 Cursos encontrados: ${cursos.length}`);

  for (const [index, curso] of cursos.entries()) {
    try {
      console.log(`\n🔄 [${index + 1}/${cursos.length}] Ingresando a: ${curso.nombre}`);
      await page.goto(curso.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      // Esperar a que cargue el contenido principal
      await page.waitForSelector('#region-main', { timeout: 30000 });
      
      // Captura ajustada al contenido
      await page.screenshot({
        path: `curso-${index + 1}-${curso.nombre}.png`,
        fullPage: false,
        clip: await page.$eval('#region-main', el => {
          const rect = el.getBoundingClientRect();
          return { 
            x: rect.x, 
            y: rect.y, 
            width: Math.min(rect.width, 1200), 
            height: Math.min(rect.height, 800) 
          };
        })
      });
      
      console.log(`📸 Captura guardada: curso-${index + 1}-${curso.nombre}.png`);
      await page.waitForTimeout(TIEMPO_ESPERA);
      
    } catch (error) {
      console.error(`⚠️ Error en curso ${curso.nombre}:`, error.message);
      await page.screenshot({ path: `error-curso-${index + 1}.png` });
    }
  }
}
