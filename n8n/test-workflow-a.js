/**
 * Simula a execução completa do Workflow A do n8n
 * Lógica idêntica ao Code node "Classificar e Separar Leads"
 */
const axios = require('axios');

// ─── Parâmetros da Busca (node Set) ──────────────────────
const PARAMS = {
  termo_busca: 'dentista',
  regiao:      'São José dos Campos, SP',
  limit:       10,
};

// ─── Mapeamento de nichos ─────────────────────────────────
const NICHO_MAP = {
  'Clínica':           'Saúde/estética',
  'Dentista':          'Saúde/estética',
  'Odontológica':      'Saúde/estética',
  'Médico':            'Saúde/estética',
  'Fisioterapeuta':    'Saúde/estética',
  'Estética':          'Saúde/estética',
  'Psicólogo':         'Saúde/estética',
  'Nutricionista':     'Saúde/estética',
  'Salão':             'Saúde/estética',
  'Spa':               'Saúde/estética',
  'Academia':          'Saúde/estética',
  'Advogado':          'Serviços profissionais',
  'Contador':          'Serviços profissionais',
  'Arquiteto':         'Serviços profissionais',
  'Imobiliária':       'Serviços profissionais',
  'Imóveis':           'Serviços profissionais',
  'Consultoria':       'Serviços profissionais',
  'Engenheiro':        'Serviços profissionais',
  'Loja de roupa':     'Comércio/loja física',
  'Loja de roupas':    'Comércio/loja física',
  'Móveis':            'Comércio/loja física',
  'Decoração':         'Comércio/loja física',
  'Joalheria':         'Comércio/loja física',
  'Loja de presentes': 'Comércio/loja física',
  'Hotel':             'Eventos/hospedagem',
  'Pousada':           'Eventos/hospedagem',
  'Buffet':            'Eventos/hospedagem',
  'Espaço de festa':   'Eventos/hospedagem',
};

const REDES_SOCIAIS = [
  'instagram.com', 'facebook.com', 'fb.com',
  'linktr.ee', 'linktree.com', 'wa.me',
  'api.whatsapp.com', 'twitter.com', 'tiktok.com',
];

function resolverNicho(categoria) {
  if (!categoria) return null;
  for (const [chave, nicho] of Object.entries(NICHO_MAP)) {
    if (categoria.toLowerCase().includes(chave.toLowerCase())) return nicho;
  }
  return null;
}

function temSiteProprio(site) {
  if (!site || site.trim() === '') return false;
  return !REDES_SOCIAIS.some(d => site.toLowerCase().includes(d));
}

async function executarWorkflowA() {
  console.log('─'.repeat(60));
  console.log('  WORKFLOW A — CAPTAÇÃO DE LEADS');
  console.log('─'.repeat(60));
  console.log(`  Busca: "${PARAMS.termo_busca}" | Região: "${PARAMS.regiao}" | Limit: ${PARAMS.limit}`);
  console.log('─'.repeat(60));

  // ── Node: HTTP Request → POST /scrape-maps ────────────
  console.log('\n[1/2] Chamando scraper...');
  const { data } = await axios.post('http://localhost:3000/scrape-maps', {
    query:  PARAMS.termo_busca,
    regiao: PARAMS.regiao,
    limit:  PARAMS.limit,
  });

  const leads = data.leads || [];
  console.log(`      → ${leads.length} leads recebidos da SerpAPI\n`);

  // ── Node: Code → Classificar e Separar Leads ──────────
  console.log('[2/2] Executando Code node (classificação)...\n');
  const leads_com_site    = [];
  const leads_sem_site    = [];
  const leads_descartados = [];
  let indiceCanal = 0;

  leads.forEach((lead) => {
    const nicho = resolverNicho(lead.categoria);
    if (nicho === null) {
      leads_descartados.push({ nome: lead.nome || '', categoria: lead.categoria || '', motivo: 'nicho_nao_mapeado' });
      return;
    }
    const canal    = indiceCanal % 2 === 0 ? 'whatsapp' : 'instagram';
    const tem_site = temSiteProprio(lead.site);
    indiceCanal++;
    const lp = {
      nome:              lead.nome      || '',
      telefone:          lead.telefone  || '',
      endereco:          lead.endereco  || '',
      site:              lead.site      || '',
      categoria:         lead.categoria || '',
      categoria_mapeada: nicho,
      canal,
      tem_site,
    };
    if (tem_site) leads_com_site.push(lp);
    else          leads_sem_site.push(lp);
  });

  const resumo = {
    total_recebidos:   leads.length,
    total_processados: leads_com_site.length + leads_sem_site.length,
    com_site:          leads_com_site.length,
    sem_site:          leads_sem_site.length,
    descartados:       leads_descartados.length,
  };

  const output = { leads_com_site, leads_sem_site, leads_descartados, resumo };
  console.log(JSON.stringify(output, null, 2));
}

executarWorkflowA().catch(e => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
