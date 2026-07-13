const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────
// GET /health — Health check
// ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'scraper', type: 'puppeteer', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────
// POST /screenshot — Tira um print de uma URL
// ─────────────────────────────────────────
app.post('/screenshot', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ erro: 'url_obrigatoria', detalhe: 'Campo "url" é obrigatório' });
  }

  let browser = null;
  try {
    console.log(`[screenshot] Capturando: ${url}`);
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const screenshot = await page.screenshot({ encoding: 'base64' });
    res.json({ imagem_base64: screenshot });
  } catch (err) {
    console.error(`[screenshot] Erro: ${err.message}`);
    res.status(500).json({ erro: 'falha_captura', detalhe: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

// ─────────────────────────────────────────
// POST /scrape-maps — Busca leads via Google Maps
// ─────────────────────────────────────────
app.post('/scrape-maps', async (req, res) => {
  const { query, regiao, limit = 10 } = req.body;

  if (!query || !regiao) {
    return res.status(400).json({ erro: 'campos_obrigatorios', detalhe: 'Campos "query" e "regiao" são obrigatórios' });
  }

  const termoBusca = `${query} ${regiao}`;
  console.log(`[scrape-maps] Iniciando busca via Puppeteer: "${termoBusca}", limit=${limit}`);

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--lang=pt-BR,pt']
    });
    
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7' });
    await page.setViewport({ width: 1366, height: 768 });

    const searchUrl = `https://www.google.com.br/maps/search/${encodeURIComponent(termoBusca)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 });

    // Checa por CAPTCHA
    const captchaExists = await page.evaluate(() => {
      return document.body.innerHTML.includes('recaptcha') || document.body.innerHTML.includes('unusual traffic');
    });

    if (captchaExists) {
      console.error('[scrape-maps] CAPTCHA detectado pelo Google');
      return res.status(429).json({ erro: 'bloqueio_detectado', detalhe: 'O Google Maps bloqueou a requisição com um CAPTCHA.' });
    }

    // Espera os cards carregarem
    try {
      await page.waitForSelector('.hfpxzc', { timeout: 15000 });
    } catch (e) {
      console.warn(`[scrape-maps] Nenhum resultado encontrado ou timeout para: "${termoBusca}"`);
      return res.json({ leads: [], total: 0 });
    }

    // Extrai as URLs primeiro
    const urls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('.hfpxzc'));
        return links.map(a => a.href);
    });
    
    console.log(`[scrape-maps] ${urls.length} cards encontrados. Iniciando navegação 1 a 1...`);
    
    const leads = [];
    const limitUrls = urls.slice(0, limit);
    
    for(let i = 0; i < limitUrls.length; i++) {
        console.log(`[scrape-maps] Navegando para o lead ${i+1}/${limitUrls.length}...`);
        await page.goto(limitUrls[i], { waitUntil: 'domcontentloaded', timeout: 45000 });
        
        // Espera o título carregar
        await page.waitForSelector('h1', { timeout: 10000 }).catch(() => {});
        
        const leadData = await page.evaluate(() => {
          const getTitle = () => {
              const h1s = Array.from(document.querySelectorAll('h1'));
              const title = h1s.find(h => h.className.includes('DUwDvf') || h.className.includes('fontHeadlineLarge'));
              if (title) return title.innerText.trim();
              if (h1s.length > 0) return h1s.reduce((a, b) => a.innerText.length > b.innerText.length ? a : b, {innerText: ''}).innerText.trim();
              return '';
          };
  
          const nome = getTitle();
          
          let telefone = '';
          let site = '';
          let endereco = '';
          let categoria = '';
  
          const catBtn = document.querySelector('button[jsaction*="category"]');
          if (catBtn) categoria = catBtn.innerText.trim();
  
          const buttons = document.querySelectorAll('button[data-item-id]');
          buttons.forEach(btn => {
            const id = btn.getAttribute('data-item-id') || '';
            if (id.startsWith('phone:')) telefone = btn.getAttribute('aria-label') || btn.innerText;
            if (id.startsWith('address:')) endereco = btn.getAttribute('aria-label') || btn.innerText;
          });
  
          const links = Array.from(document.querySelectorAll('a'));
          const siteLink = links.find(a => {
              const dtId = a.getAttribute('data-item-id') || '';
              const dtTooltip = a.getAttribute('data-tooltip') || '';
              return (dtId.startsWith('authority:') || dtTooltip.toLowerCase().includes('website') || dtTooltip.toLowerCase().includes('site') || a.innerText.toLowerCase().includes('website')) && a.href && !a.href.includes('google.com/maps');
          });
          
          if (siteLink) site = siteLink.href;
  
          if (telefone) telefone = telefone.replace(/^telefone:?/i, '').trim();
          if (endereco) endereco = endereco.replace(/^endereço:?/i, '').trim();
  
          return { nome, telefone, site, endereco, categoria };
        });
        
        if (leadData.nome) {
            leads.push(leadData);
        }
        
        // Delay extra de respeito entre as páginas
        await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log(`[scrape-maps] ${leads.length} leads extraídos com sucesso via Puppeteer`);
    res.json({ leads, total: leads.length });

  } catch (err) {
    console.error(`[scrape-maps] Erro inesperado: ${err.message}`);
    res.status(500).json({ erro: 'falha_puppeteer', detalhe: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

// ─────────────────────────────────────────
// Inicialização
// ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[scraper] Rodando com Puppeteer na porta ${PORT}`);
});
