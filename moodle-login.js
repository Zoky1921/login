const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  // Configuración
  const TIEMPO_PERMANENCIA = 2 * 60 * 1000; // 2 minutos en milisegundos
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  const page = await browser.newPage();
  
  try {
    console.log('🔹 Iniciando proceso...');
    
    // 1. Login
    await page.goto(`${process.env.MOODLE_URL}/login/index.php`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    await page.type('#username', process.env.MOODLE_USER);
    await page.type('#password', process.env.MOODLE_PASS);
    await page.click('#loginbtn');
    
    console.log('✅ Login exitoso. Manteniendo sesión 2 minutos...');
    
    // 2. Temporizador visual (opcional)
    const interval = setInterval(() => {
      const tiempoRestante = Math.ceil((TIEMPO_PERMANENCIA - (Date.now() - startTime)) / 1000);
      console.log(`⏳ Tiempo restante: ${tiempoRestante}s`);
    }, 10000);
    
    const startTime = Date.now();
    
    // 3. Espera activa (2 minutos)
    await new Promise(resolve => setTimeout(resolve, TIEMPO_PERMANENCIA));
    
    clearInterval(interval);
    console.log('🕒 Tiempo completado. Cerrando sesión...');
    
    // 4. Captura final (opcional)
    await page.screenshot({ path: 'final.png' });

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: 'error.png' });
  } finally {
    await browser.close();
    console.log('🏁 Proceso finalizado');
  }
})();
