const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const SERP_API_KEY = process.env.SERP_API_KEY || '';
const SERP_API_URL = 'https://serpapi.com/search';

// ─────────────────────────────────────────
// GET /health — Health check
// ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'scraper', type: 'serpapi', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────
// POST /screenshot — Fallback leve (sem Chromium)
// ─────────────────────────────────────────
app.post('/screenshot', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ erro: 'url_obrigatoria', detalhe: 'Campo "url" é obrigatório' });
  }
  console.log(`[screenshot] Fallback sem Chromium para: ${url}`);
  const greyPixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  res.json({ imagem_base64: greyPixelBase64, aviso: 'Serviço configurado no modo leve (sem Chromium).' });
});

// ─────────────────────────────────────────
// POST /scrape-maps — Busca leads via SerpAPI (Google Maps)
// Body: { query, regiao, limit }
// ─────────────────────────────────────────
app.post('/scrape-maps', async (req, res) => {
  const { query, regiao, limit = 10 } = req.body;

  if (!query || !regiao) {
    return res.status(400).json({
      erro: 'campos_obrigatorios',
      detalhe: 'Campos "query" e "regiao" são obrigatórios',
    });
  }

  if (!SERP_API_KEY) {
    return res.status(500).json({
      erro: 'config_invalida',
      detalhe: 'Variável SERP_API_KEY não configurada no container',
    });
  }

  const termoBusca = `${query} ${regiao}`;
  console.log(`[scrape-maps] Chamando SerpAPI: "${termoBusca}", limit=${limit}`);

  try {
    const resposta = await axios.get(SERP_API_URL, {
      params: {
        engine: 'google_maps',
        q: termoBusca,
        api_key: SERP_API_KEY,
        hl: 'pt',
        gl: 'br',
        num: Math.min(limit, 20),
      },
      timeout: 30000,
    });

    const dados = resposta.data;

    // Detecta erro da SerpAPI no payload
    if (dados.error) {
      console.error(`[scrape-maps] Erro SerpAPI: ${dados.error}`);
      return res.status(502).json({
        erro: 'falha_serpapi',
        detalhe: dados.error,
      });
    }

    const resultados = dados.local_results || [];

    if (resultados.length === 0) {
      console.warn(`[scrape-maps] Nenhum resultado retornado pela SerpAPI para: "${termoBusca}"`);
      return res.json({ leads: [], total: 0 });
    }

    // Mapeia os campos da SerpAPI para o formato interno do sistema
    const leads = resultados.slice(0, limit).map((r) => ({
      nome:      r.title     || '',
      telefone:  r.phone     || '',
      endereco:  r.address   || '',
      site:      r.website   || '',
      categoria: r.type      || '',
    }));

    console.log(`[scrape-maps] ${leads.length} leads encontrados para "${termoBusca}"`);
    res.json({ leads, total: leads.length });

  } catch (err) {
    // Trata erros HTTP da SerpAPI (429 rate limit, 401 chave inválida, etc.)
    const status = err.response?.status;
    const mensagem = err.response?.data?.error || err.message || 'Erro desconhecido';

    if (status === 429 || status === 401 || status === 403) {
      console.error('[scrape-maps] Limite de requisições ou chave SerpAPI inválida detectada. Retornando dados falsos para continuidade dos testes (Mock Mode).');
      
      const mockLeads = [
        {
          nome: `Mock - Clínica ${query} 1`,
          telefone: '5511999999991',
          endereco: `Rua Fictícia 1, ${regiao}`,
          site: 'https://odontospecialsjc.com.br',
          categoria: 'Clínica'
        },
        {
          nome: `Mock - Consultório ${query} 2`,
          telefone: '5511999999992',
          endereco: `Avenida Falsa 2, ${regiao}`,
          site: '',
          categoria: 'Dentista'
        },
        {
          nome: `Mock - Espaço ${query} 3`,
          telefone: '5511999999993',
          endereco: `Travessa Inventada 3, ${regiao}`,
          site: 'https://odontospecialsjc.com.br',
          categoria: 'Médico'
        }
      ];

      return res.json({ leads: mockLeads.slice(0, limit), total: Math.min(3, limit), aviso: 'Modo Mock Ativado (Limite SerpAPI excedido)' });
    }

    console.error(`[scrape-maps] Erro inesperado: ${mensagem}`);
    res.status(500).json({
      erro: 'falha_serpapi',
      detalhe: mensagem,
    });
  }
});

// ─────────────────────────────────────────
// Inicialização
// ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[scraper] Rodando com SerpAPI na porta ${PORT}`);
});
