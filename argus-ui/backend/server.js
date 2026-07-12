const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const axios = require('axios');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

// --- MOCK DATABASE ---
let leads = [
  {
    id: '1',
    nome: 'Odonto Excellence',
    telefone: '5511999990001',
    canal: 'whatsapp',
    nicho: 'Saúde',
    severidade: 'critico',
    mensagem_gerada: 'Oi! Encontrei a Odonto Excellence no Google e dei uma olhada no site de vocês. Notei que faltam botões de agendamento visíveis. Trabalho com isso e posso ajudar, topa bater um papo?',
    diagnostico: ['Falta CTA visível', 'Velocidade do site lenta', 'Imagens pesadas'],
    status: 'aguardando_aprovacao',
    timeline: {
      captado_em: new Date(Date.now() - 3600000).toISOString(),
      diagnosticado_em: new Date(Date.now() - 3000000).toISOString(),
      copy_gerada_em: new Date(Date.now() - 2500000).toISOString(),
      enviado_em: null,
      respondido_em: null
    }
  },
  {
    id: '2',
    nome: 'Advocacia Silva',
    telefone: '5511999990002',
    canal: 'whatsapp',
    nicho: 'Serviços',
    severidade: 'melhoria',
    mensagem_gerada: 'Oi! Vi a Advocacia Silva no Google e notei que vocês não têm site ainda. O cliente busca credibilidade antes de fechar. Se fizer sentido, posso mostrar exemplos.',
    diagnostico: ['Site inacessível (DNS)'],
    status: 'enviados',
    timeline: {
      captado_em: new Date(Date.now() - 86400000).toISOString(),
      diagnosticado_em: new Date(Date.now() - 85000000).toISOString(),
      copy_gerada_em: new Date(Date.now() - 84000000).toISOString(),
      enviado_em: new Date(Date.now() - 83000000).toISOString(),
      respondido_em: null
    }
  },
  {
    id: '3',
    nome: 'Estética Linda',
    telefone: '5511999990003',
    canal: 'whatsapp',
    nicho: 'Estética',
    severidade: 'critico',
    mensagem_gerada: 'Oi! Vi a Estética Linda no Google e notei que não têm site. O paciente decide pela confiança visual. Já ajudei negócios parecidos, topa conversar?',
    diagnostico: ['Lead sem site'],
    status: 'respondidos',
    timeline: {
      captado_em: new Date(Date.now() - 172800000).toISOString(),
      diagnosticado_em: new Date(Date.now() - 171800000).toISOString(),
      copy_gerada_em: new Date(Date.now() - 170800000).toISOString(),
      enviado_em: new Date(Date.now() - 160800000).toISOString(),
      respondido_em: new Date(Date.now() - 50000000).toISOString()
    }
  },
  {
    id: '4',
    nome: 'Mecânica Express',
    telefone: '5511999990004',
    canal: 'whatsapp',
    nicho: 'Serviços',
    severidade: 'melhoria',
    mensagem_gerada: '',
    diagnostico: [],
    status: 'captando',
    timeline: {
      captado_em: new Date().toISOString(),
      diagnosticado_em: null,
      copy_gerada_em: null,
      enviado_em: null,
      respondido_em: null
    }
  },
  {
    id: '5',
    nome: 'Padaria Doce Pão',
    telefone: '5511999990005',
    canal: 'whatsapp',
    nicho: 'Comércio',
    severidade: 'critico',
    mensagem_gerada: 'Erro de timeout no servidor',
    diagnostico: ['Erro de extração'],
    status: 'erro',
    timeline: {
      captado_em: new Date(Date.now() - 3600000).toISOString(),
      diagnosticado_em: new Date(Date.now() - 3000000).toISOString(),
      copy_gerada_em: null,
      enviado_em: null,
      respondido_em: null
    }
  }
];

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

app.post('/api/rodada', (req, res) => {
  const { nicho, regiao, quantidade } = req.body;
  // Simula criação de novos leads na coluna Captando
  for(let i=0; i<quantidade; i++) {
    leads.push({
      id: Date.now().toString() + i,
      nome: `Lead Simulado ${i+1} (${nicho})`,
      telefone: '5511999999999',
      canal: 'whatsapp',
      nicho: nicho,
      severidade: 'melhoria',
      mensagem_gerada: '',
      diagnostico: [],
      status: 'captando',
      timeline: {
        captado_em: new Date().toISOString(),
        diagnosticado_em: null,
        copy_gerada_em: null,
        enviado_em: null,
        respondido_em: null
      }
    });
  }
  res.json({ success: true, message: 'Rodada iniciada' });
});

app.get('/api/leads', (req, res) => {
  // Retorna todos para o Kanban
  res.json(leads);
});

app.get('/api/leads/:id', (req, res) => {
  const lead = leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
  res.json(lead);
});

app.post('/api/leads/:id/aprovar', async (req, res) => {
  const index = leads.findIndex(l => l.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  
  const lead = leads[index];
  
  // Simula disparo evolution api
  try {
    const evoRes = await axios.post(`${config.EVOLUTION_URL}/message/sendText/capta%C3%A7ao`, {
      number: lead.telefone,
      text: lead.mensagem_gerada
    }, { headers: { apikey: 'changeme' }, timeout: 5000 }).catch(() => null);
    
    lead.status = 'enviados';
    lead.timeline.enviado_em = new Date().toISOString();
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: 'Falha no disparo' });
  }
});

app.post('/api/leads/:id/rejeitar', (req, res) => {
  const index = leads.findIndex(l => l.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  
  leads[index].status = 'erro'; // Movendo descartado para erro ou podemos ocultar
  res.json({ success: true });
});

app.get('/api/historico', (req, res) => {
  const historico = leads.filter(l => ['enviados', 'respondidos', 'erro'].includes(l.status));
  historico.sort((a,b) => new Date(b.timeline.captado_em) - new Date(a.timeline.captado_em));
  res.json(historico);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(config.PORT, () => {
  console.log(`[ARGUS] BFF Operando na porta ${config.PORT}`);
});
