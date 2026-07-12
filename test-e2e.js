const axios = require('axios');
const cheerio = require('cheerio');

// WORKFLOW A: Captação (MOCK)
const leadsCaptados = [
  {
    nome: "Odonto Excellence",
    telefone: "5511999990001",
    site_url: "https://odontospecial.com.br", // mock url, logic doesn't strictly need real fetch if we mock html or we can fetch a real site. Wait, let's fetch a real site for testing if possible, or just mock the HTML to be safe and fast.
    nicho_sugerido: "dentista"
  },
  {
    nome: "Advocacia Silva",
    telefone: "5511999990002",
    site_url: "https://www.borgesteixeira.com.br/", // using a known site from previous tests
    nicho_sugerido: "advogado"
  },
  {
    nome: "Estética Linda",
    telefone: "5511999990003",
    site_url: "", // Sem site
    nicho_sugerido: "estética"
  }
];

// OLLAMA HELPER
async function runOllama(prompt, num_predict = 150) {
  try {
    const res = await axios.post('http://prospeccao-ollama:11434/api/generate', {
      model: 'mistral',
      prompt: prompt,
      stream: false,
      options: { num_predict, temperature: 0.1 }
    }, { timeout: 120000 });
    return res.data.response.trim();
  } catch (e) {
    console.error("Ollama Error:", e.message);
    return "";
  }
}

// SCRAPER HELPER
async function scrapeUrl(url) {
  try {
    const res = await axios.get(url, { 
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    return res.data;
  } catch (e) {
    console.error("Scraper Error:", e.message);
    return null;
  }
}

async function runEndToEnd() {
  console.log("🚀 INICIANDO TESTE END-TO-END (Fluxo Completo para 3 Leads)\n");
  
  for (let i = 0; i < leadsCaptados.length; i++) {
    let lead = leadsCaptados[i];
    console.log(`=========================================`);
    console.log(`📡 PROCESSANDO LEAD ${i+1}: ${lead.nome}`);
    console.log(`=========================================`);
    
    // --- WORKFLOW A: Normalização ---
    lead.tem_site = !!lead.site_url;
    lead.canal = "whatsapp";
    
    // Mapeamento de Nicho (Simplificado do Code Node A)
    let categoria_mapeada = "Saúde/estética";
    if (lead.nicho_sugerido.includes('advogado')) categoria_mapeada = "Serviços profissionais";
    lead.categoria_mapeada = categoria_mapeada;
    
    // --- WORKFLOW B: Diagnóstico ---
    console.log(`\n🔍 [WORKFLOW B] Diagnosticando...`);
    if (lead.tem_site) {
      console.log(`   Scraping site: ${lead.site_url}`);
      const scrapeData = await scrapeUrl(lead.site_url);
      if (!scrapeData) {
        lead.site_inacessivel = true;
        console.log(`   Site inacessível.`);
      } else {
        lead.site_inacessivel = false;
        const $ = cheerio.load(scrapeData);
        $('script, style, noscript').remove();
        let text = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 3000);
        lead.principal_servico = text.substring(0, 50); // Simplificação
        
        // Simular o prompt de avaliação do Ollama (Workflow B)
        const promptB = `Analise este texto de um site de ${categoria_mapeada} e aponte UM problema técnico ou de UX (ex: falta de WhatsApp visível, confuso, sem botão de contato claro). Texto: "${text.substring(0, 1000)}". Retorne apenas UMA string com o problema.`;
        const problema = await runOllama(promptB, 80);
        lead.problemas_encontrados = [problema];
        console.log(`   Problema encontrado: ${problema}`);
      }
    } else {
      console.log(`   Lead sem site (pula scraping).`);
    }
    
    // --- WORKFLOW C: Geração de Mensagem ---
    console.log(`\n✍️  [WORKFLOW C] Gerando Mensagem...`);
    
    if (!lead.tem_site || lead.site_inacessivel) {
      // Fallback Estático
      const CONTEXTOS = {
        'Saúde/estética': 'o paciente decide pela confiança visual antes de marcar',
        'Serviços profissionais': 'o cliente busca credibilidade antes de fechar um contrato'
      };
      const obs = CONTEXTOS[lead.categoria_mapeada] || CONTEXTOS['Saúde/estética'];
      lead.mensagem_gerada = `Oi! Vi a ${lead.nome} no Google e notei que vocês não têm site ainda, só aparecem por aqui mesmo.\n\nIsso chamou minha atenção porque ${obs} — e dá pra fazer isso ficar bem simples, sem virar um projeto grande ou caro.\n\nJá ajudei alguns negócios parecidos com isso. Se fizer sentido, posso te mostrar uns exemplos e a gente conversa se topa, sem compromisso nenhum.`;
      lead.status = 'aguardando_aprovacao';
    } else {
      // Variações e Ollama (Bloco 4)
      const lib = {
        abertura: ["Oi! Encontrei a [nome] no Google e dei uma olhada no site de vocês."],
        gancho: ["Enquanto olhava o site, teve um detalhe que me chamou atenção."],
        impacto: ["No fim, quem está com pressa normalmente não insiste muito."],
        cta: ["Se fizer sentido, posso te mostrar exatamente o que encontrei."]
      };
      
      let problema_principal = lead.problemas_encontrados[0] || 'algumas coisas poderiam estar melhores';
      const promptC = `Você é um especialista em comunicação de WhatsApp no Brasil. Sua única tarefa é reescrever o problema técnico abaixo em terceira pessoa (falando do site do cliente) em UMA frase coloquial e natural (máximo de 2 frases) para que se encaixe no meio de uma conversa com o dono da empresa. Ex: 'O site não possui...' e nunca 'O nosso site não possui...'. Não use jargão técnico como SEO, viewport, meta description, alt tag, SSL, cache, DOM, HTML, tag.\n\nPROBLEMA ORIGINAL:\n"${problema_principal}"\n\nRetorne APENAS uma frase contendo a reescrita do problema. Não escreva nenhuma outra frase antes ou depois. Não adicione saudações, nem introduções.`;
      
      const b4_problema = await runOllama(promptC, 80);
      console.log(`   Ollama Bloco 4 gerou: "${b4_problema}"`);
      
      lead.mensagem_gerada = `${lib.abertura[0].replace('[nome]', lead.nome)} ${lib.gancho[0]} ${b4_problema} ${lib.impacto[0]} Trabalho justamente com esse tipo de análise para negócios locais. ${lib.cta[0]}`;
      lead.status = 'aguardando_aprovacao';
    }
    
    console.log(`\n✅ RESULTADO FINAL (JSON PRONTO PARA A INTERFACE):`);
    console.log(JSON.stringify({
      nome: lead.nome,
      telefone: lead.telefone,
      canal: lead.canal,
      mensagem_gerada: lead.mensagem_gerada,
      status: lead.status
    }, null, 2));
    
    // --- WORKFLOW C: Envio via WhatsApp (Evolution API) ---
    console.log(`\n📲 [WORKFLOW C] Simulando Aprovação e Enviando WhatsApp...`);
    try {
      const evoRes = await axios.post('http://evolution-api:8080/message/sendText/capta%C3%A7ao', {
        number: lead.telefone,
        text: lead.mensagem_gerada
      }, {
        headers: { apikey: 'changeme' },
        timeout: 10000
      });
      console.log(`   ✅ Sucesso no Envio! Resposta da API:`, evoRes.data.key ? evoRes.data.key.id : evoRes.data);
    } catch (e) {
      console.error(`   ❌ Falha no Envio:`, e.response ? e.response.data : e.message);
    }
    console.log(`\n`);
  }
}

runEndToEnd();
