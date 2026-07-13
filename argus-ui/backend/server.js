const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const axios = require('axios');
const pool = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

// Utilitário para formatar a linha do DB no formato que o Frontend espera
function mapLeadToFrontend(row) {
  return {
    ...row,
    diagnostico: row.problemas_encontrados || [],
    timeline: {
      captado_em: row.created_at,
      enviado_em: (row.status === 'enviado' || row.status === 'erro_envio') ? row.updated_at : null
    }
  };
}

// --- ROTAS ---

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/status', (req, res) => {
  res.json({
    n8n: 'online',
    scraper: 'online',
    ollama: 'online',
    whatsapp: 'online',
    instagram: 'offline'
  });
});

app.post('/api/rodada', async (req, res) => {
  const { nicho, regiao, quantidade } = req.body;
  
  try {
    // Dispara Webhook do N8N (Workflow A)
    await axios.post(`${config.N8N_URL}/webhook/argus-rodada`, {
      nicho,
      regiao,
      limit: quantidade
    }, { timeout: 10000 });
    
    res.json({ success: true, message: 'Rodada iniciada no n8n' });
  } catch (error) {
    console.error('Erro ao disparar N8N:', error.message);
    res.status(500).json({ error: 'Falha ao iniciar rodada no n8n' });
  }
});

app.get('/api/leads', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM argus.leads WHERE status NOT IN ('rejeitado') ORDER BY created_at DESC");
    res.json(rows.map(mapLeadToFrontend));
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/leads/:id', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM argus.leads WHERE id = $1", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Lead não encontrado' });
    res.json(mapLeadToFrontend(rows[0]));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/leads/:id/aprovar', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Marca como aprovado e recupera dados para envio
    await pool.query("UPDATE argus.leads SET status = 'aprovado', updated_at = NOW() WHERE id = $1", [id]);
    const { rows } = await pool.query("SELECT telefone, mensagem_gerada FROM argus.leads WHERE id = $1", [id]);
    
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const lead = rows[0];

    // 2. Dispara Evolution API
    let evolutionSuccess = false;
    let errorDetail = null;
    try {
      const evoRes = await axios.post(`${config.EVOLUTION_URL}/message/sendText/default`, {
        number: lead.telefone,
        text: lead.mensagem_gerada
      }, { headers: { apikey: process.env.EVOLUTION_API_KEY || 'changeme' }, timeout: 10000 });
      
      evolutionSuccess = true;
    } catch(err) {
      console.error('Erro Evolution API', err.response?.data || err.message);
      errorDetail = err.message;
    }
    
    // 3. Atualiza status final (Enviado ou Erro)
    const finalStatus = evolutionSuccess ? 'enviado' : 'erro_envio';
    await pool.query("UPDATE argus.leads SET status = $1, updated_at = NOW() WHERE id = $2", [finalStatus, id]);
    
    res.json({ success: true, status: finalStatus });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/leads/:id/rejeitar', async (req, res) => {
  try {
    await pool.query("UPDATE argus.leads SET status = 'rejeitado', updated_at = NOW() WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/historico', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM argus.leads WHERE status IN ('enviado','respondido','erro','rejeitado', 'erro_envio', 'erro_copy') ORDER BY updated_at DESC");
    res.json(rows.map(mapLeadToFrontend));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(config.PORT, () => {
  console.log(`[ARGUS] BFF Operando na porta ${config.PORT}`);
});
