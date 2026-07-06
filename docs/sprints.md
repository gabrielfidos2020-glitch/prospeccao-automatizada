# Projeto: Sistema de Prospecção Automatizada

## Visão do Produto
Sistema que encontra empresas locais, diagnostica problemas no site e gera mensagens personalizadas de abordagem, enviadas via WhatsApp/Instagram, com fechamento validado por humano.

---

## Definições Globais do Projeto

### Definition of Done (DoD) — vale para toda história
- Funciona end-to-end sem intervenção manual
- Tratamento de erro implementado (timeout, falha de API, dado vazio)
- Testado com dados reais (não mock)
- Documentado com pelo menos 1 exemplo de input/output
- Revisado e aprovado pelo PO (você)

### Definition of Ready (DoR) — para uma história entrar numa sprint
- Critérios de aceitação claros e escritos
- Dependências técnicas identificadas
- Ambiente necessário disponível

### Modelo de LLM recomendado para LM Studio (4-5GB)
**Mistral 7B Instruct Q4_K_M** — 4.1GB, excelente em português, bom em análise de texto estruturado e output JSON. É a melhor opção nessa faixa de tamanho para o caso de uso de diagnóstico de site.

---

## Backlog do Produto

```
EPIC 1: Infraestrutura
EPIC 2: Captação de Leads
EPIC 3: Diagnóstico de Sites
EPIC 4: Geração e Envio de Mensagens
EPIC 5: Acompanhamento e Fechamento
```

---

# SPRINT 0 — Infraestrutura e Ambiente
**Duração:** 2-3 dias
**Objetivo:** ambiente 100% funcional antes de qualquer workflow

---

### História 1.1 — Docker Compose completo

**Como** desenvolvedor
**Quero** subir toda a infraestrutura com um único comando
**Para** não depender de configuração manual a cada reinício

**Critérios de aceitação:**
- [ ] `docker-compose up -d` sobe todos os serviços sem erro
- [ ] n8n acessível em `localhost:5678`
- [ ] LM Studio acessível em `localhost:1234` (já instalado, só documentar a porta)
- [ ] Evolution API acessível em `localhost:8080`
- [ ] Instagrapi acessível em `localhost:8001`
- [ ] Scraper acessível em `localhost:3000`
- [ ] Todos os containers se comunicam na mesma rede Docker

**Entregáveis:**
```
/projeto-prospeccao
  docker-compose.yml
  scraper/
    index.js
    package.json
    Dockerfile
  .env.example
  README.md
```

**DoD específico:** `docker-compose up -d` + health check em todos os endpoints retorna 200.

---

### História 1.2 — LM Studio configurado

**Como** sistema
**Quero** ter o modelo Mistral 7B Instruct rodando e respondendo via API
**Para** usar nos workflows de diagnóstico

**Critérios de aceitação:**
- [ ] Mistral 7B Instruct Q4_K_M baixado no LM Studio
- [ ] Servidor local ativado na porta 1234
- [ ] Chamada de teste via curl retorna resposta em português
- [ ] Output em JSON funciona (o modelo respeita instrução de retornar JSON puro)

**Teste de validação:**
```bash
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral",
    "messages": [
      {"role": "system", "content": "Responda apenas em JSON válido."},
      {"role": "user", "content": "Liste 2 problemas fictícios de um site. Retorne {\"problemas\": [], \"severidade\": \"\"}"}
    ]
  }'
```
**DoD específico:** curl retorna JSON válido com os campos `problemas` e `severidade`.

---

### História 1.3 — Evolution API conectada

**Como** sistema
**Quero** ter meu número de WhatsApp autenticado na Evolution API
**Para** enviar mensagens reais nos workflows seguintes

**Critérios de aceitação:**
- [ ] Container Evolution API rodando
- [ ] QR Code gerado e escaneado com WhatsApp Business (número dedicado à prospecção)
- [ ] Status da instância retorna `open` (conectado)
- [ ] Mensagem de teste enviada e recebida com sucesso

**Teste de validação:**
```bash
curl -X POST http://localhost:8080/message/sendText/default \
  -H "Content-Type: application/json" \
  -d '{"number": "55119XXXXXXXX", "text": "teste de conexão"}'
```
**DoD específico:** mensagem aparece no WhatsApp do número de destino.

---

### História 1.4 — Instagrapi autenticada

**Como** sistema
**Quero** ter minha conta Instagram autenticada no Instagrapi
**Para** enviar DMs nos workflows seguintes

**Critérios de aceitação:**
- [ ] Container Instagrapi rodando
- [ ] Conta Instagram dedicada à prospecção autenticada (não conta pessoal)
- [ ] Chamada de teste de DM enviada com sucesso

**DoD específico:** DM de teste aparece na conta de destino.

---

### Revisão da Sprint 0
**Critério de saída:** todos os health checks passando + WhatsApp conectado + Instagram autenticado + LM Studio respondendo JSON. Se qualquer um falhar, sprint não encerra.

---

# SPRINT 1 — Captação de Leads
**Duração:** 3-4 dias
**Objetivo:** Workflow A funcionando, entregando leads classificados com qualidade

---

### História 2.1 — Endpoint de scraping

**Como** Workflow A
**Quero** chamar um endpoint local e receber leads do Google Maps
**Para** não depender de API paga e manter o sistema gratuito

**Decisão técnica — OSS vs Outscraper:**

| Critério | Scraper próprio (Playwright) | Outscraper |
|---|---|---|
| Custo | Grátis | ~R$0,05/lead |
| Estabilidade | Média (Google bloqueia) | Alta |
| Manutenção | Alta | Zero |
| Setup | 1-2 dias | 30 minutos |

**Recomendação:** começar com Outscraper para validar o processo. Migrar para scraper próprio depois que o sistema estiver gerando receita. O custo de 100 leads = R$5 — menor que 1 hora do seu tempo.

**Se optar por OSS**, o endpoint implementa:
- Playwright abre `maps.google.com`
- Busca `query + regiao`
- Extrai por card: nome, telefone, endereço, site, categoria
- Delay 2-3s entre extrações
- User-agent de navegador real
- Retorno `{"erro": "bloqueio_detectado"}` se CAPTCHA aparecer

**Critérios de aceitação:**
- [ ] `POST /scrape-maps` retorna array de leads com todos os campos
- [ ] Funciona com pelo menos 10 leads por busca
- [ ] Campos vazios retornam string vazia, não null/undefined
- [ ] Erros retornam objeto de erro descritivo, não exception

**DoD específico:** teste com "dentista + São José dos Campos" retorna mínimo 5 leads com nome e telefone preenchidos.

---

### História 2.2 — Workflow A no n8n

**Como** operador do sistema
**Quero** executar o Workflow A no n8n e receber leads classificados
**Para** alimentar o Workflow B com dados prontos

**Nodes do workflow:**
```
Manual Trigger
    ↓
Set (termo_busca, regiao, limit)
    ↓
HTTP Request → POST /scrape-maps
    ↓
Code node (classificação)
    ↓
Output: leads_com_site + leads_sem_site
```

**Lógica do Code node:**
- Mapeamento de categoria → nicho guarda-chuva (4 nichos)
- Validação de site (descarta Instagram, Facebook, Linktree, wa.me)
- Alternância de canal: par = whatsapp, ímpar = instagram
- Descarta leads sem nicho correspondente

**Critérios de aceitação:**
- [ ] Workflow importável via JSON no n8n
- [ ] Execução manual funciona sem erro
- [ ] `leads_com_site` contém apenas leads com URL de site próprio válido
- [ ] `leads_sem_site` contém leads sem site ou com apenas rede social
- [ ] Campo `canal` alternado corretamente entre whatsapp/instagram
- [ ] Campo `categoria_mapeada` é um dos 4 nichos (nunca vazio para leads que passaram)

**Resumo de output esperado:**
```json
{
  "leads_com_site": [...],
  "leads_sem_site": [...],
  "resumo": {
    "total_processados": 10,
    "com_site": 7,
    "sem_site": 3
  }
}
```

**DoD específico:** execução com "dentista + São José dos Campos, limit=10" entrega mínimo 5 leads corretamente classificados, revisados e aprovados pelo PO.

---

### Revisão da Sprint 1
**Critério de saída:** PO valida manualmente pelo menos 10 leads reais — nome correto, telefone válido, site próprio identificado corretamente, canal alternando.

---

# SPRINT 2 — Diagnóstico de Sites
**Duração:** 4-5 dias
**Objetivo:** Workflow B analisando sites reais e entregando diagnósticos úteis e convincentes

---

### História 3.1 — Análise de HTML via LM Studio

**Como** Workflow B
**Quero** mandar o HTML filtrado de um site pro LM Studio e receber um diagnóstico real
**Para** ter conteúdo concreto pra preencher a mensagem de abordagem

**Lógica de filtragem do HTML (antes de mandar pra IA):**
- Remover todo conteúdo de `<script>` e `<style>`
- Extrair: `<title>`, `<meta>`, atributos `href`, atributos `alt`/`src` de imagens, headings `h1`-`h6`, comentários HTML
- Se texto restante < 300 caracteres → site é JS-heavy → usar fallback de screenshot

**System prompt para o modelo:**
```
Você analisa sites de negócios locais brasileiros. Responda APENAS em JSON válido, sem texto fora do JSON. Nunca use jargão técnico — use linguagem que um dono de negócio sem conhecimento técnico entenda.
```

**User prompt:**
```
Analise o HTML abaixo de um site de negócio local. Identifique 2 a 3 problemas reais. Considere: ausência de meta description ou viewport, links vazios ou quebrados, imagens sem alt ou src, copyright desatualizado, ausência de telefone ou endereço visível. Retorne exatamente: {"problemas": ["problema 1", "problema 2"], "severidade": "critico" ou "melhoria"}

HTML: [html filtrado]
```

**Critérios de aceitação:**
- [ ] Retorna JSON válido com campos `problemas` e `severidade`
- [ ] Problemas escritos em português simples, sem jargão
- [ ] Severidade é sempre "critico" ou "melhoria", nunca outro valor
- [ ] Funciona com pelo menos 3 sites reais de nichos diferentes

**DoD específico:** PO lê os diagnósticos de 5 sites reais e considera pelo menos 4 convincentes o suficiente pra usar numa mensagem de abordagem.

---

### História 3.2 — Fallback de screenshot

**Como** Workflow B
**Quero** tirar screenshot quando o HTML não for suficiente
**Para** cobrir sites modernos em React/Vue que não têm conteúdo no HTML puro

**Critérios de aceitação:**
- [ ] Endpoint `POST /screenshot` no container scraper retorna imagem em base64
- [ ] LM Studio recebe imagem e retorna diagnóstico visual no mesmo formato JSON
- [ ] IF node no n8n roteia corretamente: HTML suficiente → análise de código, HTML insuficiente → screenshot

**DoD específico:** pelo menos 1 site JS-heavy testado e diagnosticado corretamente via screenshot.

---

### História 3.3 — Workflow B completo no n8n

**Como** operador do sistema
**Quero** executar o Workflow B com um lead real e receber diagnóstico pronto
**Para** ter os dados que alimentam o Workflow C

**Nodes do workflow:**
```
Manual Trigger (input: url_site)
    ↓
HTTP Request GET → baixa HTML
    ↓
Code node → checa suficiência + filtra HTML
    ↓
IF node → HTML suficiente?
    ↓ sim                    ↓ não
HTTP Request              HTTP Request
POST /lmstudio            POST /screenshot
(análise código)              ↓
    ↓                    HTTP Request
    ↓                    POST /lmstudio
    ↓                    (análise visual)
    └──────── Merge ──────────┘
                ↓
         Code node final
    (normaliza JSON do LM Studio)
                ↓
    Output: problemas_encontrados + severidade
```

**Critérios de aceitação:**
- [ ] Workflow importável via JSON no n8n
- [ ] Execução com URL real retorna diagnóstico sem erro
- [ ] Cache por domínio funciona (segunda execução com mesma URL não chama LM Studio)
- [ ] Site inacessível registra `status: "site_inacessivel"` sem travar o fluxo

**DoD específico:** PO executa com 5 URLs reais dos nichos definidos e valida que o output está pronto pra alimentar o Workflow C.

---

### Revisão da Sprint 2
**Critério de saída:** 5 diagnósticos reais revisados pelo PO — linguagem simples, problemas convincentes, JSON válido em todos os casos.

---

# SPRINT 3 — Mensagens e Envio
**Duração:** 3-4 dias
**Objetivo:** Workflow C gerando mensagens e enviando após aprovação manual

---

### História 4.1 — Geração de mensagem por template

**Como** operador do sistema
**Quero** que o sistema gere automaticamente a mensagem personalizada de cada lead
**Para** só precisar revisar e aprovar, sem escrever nada do zero

**Templates (fixos, sem IA):**

*Para leads com site:*
> Oi! Vi a [nome] no Google e dei uma olhada no site de vocês.
> Reparei que [observação específica] — não é nada grave, mas pra [contexto do nicho] isso costuma pesar, porque [consequência concreta].
> Eu trabalho justamente com isso, ajustando esse tipo de coisa em negócios como o seu. Posso te mostrar exatamente o que vi e como resolver — topa conversar?

*Para leads sem site:*
> Oi! Vi a [nome] no Google e notei que vocês não têm site ainda, só aparecem por aqui mesmo.
> Isso chamou minha atenção porque [observação concreta do nicho] — e dá pra fazer isso ficar bem simples, sem virar um projeto grande ou caro.
> Já ajudei alguns negócios parecidos com isso. Se fizer sentido, posso te mostrar uns exemplos e a gente conversa se topa, sem compromisso nenhum.

**Mapeamento de contexto por nicho:**

| Nicho | Contexto | Consequência |
|---|---|---|
| Saúde/estética | paciente decide pela confiança visual antes de marcar | pode estar afastando agendamento sem perceber |
| Serviços profissionais | cliente busca credibilidade antes de fechar contrato caro | pode estar perdendo cliente na primeira impressão |
| Comércio/loja | cliente quer ver o produto antes de ir até a loja | pode estar indo direto pro concorrente que mostra melhor |
| Eventos/hospedagem | cliente decide quase só pela primeira impressão visual | pode estar descartando vocês antes de entrar em contato |

**Critérios de aceitação:**
- [ ] Mensagem gerada para lead com site usa o primeiro problema do Workflow B adaptado naturalmente
- [ ] Mensagem gerada para lead sem site usa o contexto do nicho correspondente
- [ ] Output inclui: nome, telefone, canal, mensagem_gerada, status="aguardando_aprovacao"
- [ ] Nenhuma mensagem tem colchetes visíveis no output final (todos substituídos)

**DoD específico:** PO lê 5 mensagens geradas e considera todas prontas pra enviar sem edição.

---

### História 4.2 — Envio via WhatsApp e Instagram

**Como** operador do sistema
**Quero** aprovar um lead e o sistema enviar a mensagem automaticamente
**Para** não precisar copiar e colar manualmente em cada contato

**Lógica de envio:**
```
Status = "aprovado"?
    ↓ sim
canal = "whatsapp"?
    ↓ sim                         ↓ não (instagram)
POST /evolution-api               POST /instagrapi
sendText                          direct/send
delay 3-5s                        delay 5-8s
    ↓
status = "enviado" + timestamp
```

**Critérios de aceitação:**
- [ ] Mudar status para "aprovado" dispara envio automaticamente
- [ ] Mensagem chega no WhatsApp do lead de teste
- [ ] Mensagem chega no Instagram do lead de teste
- [ ] Delay entre envios implementado (sem rafada)
- [ ] Erro de envio registra `status: "erro_envio"` com descrição do erro
- [ ] Nenhum envio acontece sem status "aprovado"

**DoD específico:** PO aprova 2 leads de teste (1 WhatsApp, 1 Instagram) e recebe as mensagens nos dois canais sem erro.

---

### Revisão da Sprint 3
**Critério de saída:** ciclo completo testado — lead captado → site diagnosticado → mensagem gerada → PO aprova → mensagem enviada. Tudo sem erro em pelo menos 3 leads reais.

---

# SPRINT 4 — Acompanhamento e Fechamento
**Duração:** 2-3 dias
**Objetivo:** estrutura simples pra acompanhar respostas e ter os dados da análise disponíveis na conversa

---

### História 5.1 — Painel de acompanhamento

**Como** operador do sistema
**Quero** ver todos os leads num lugar só com status atualizado
**Para** saber quem respondeu, quem está pendente, e acessar os dados da análise durante a conversa

**Status possíveis:**
```
aguardando_aprovacao → aprovado → enviado → respondeu → em_negociacao → fechado / declinado
```

**Solução recomendada:** planilha Google Sheets atualizada pelo n8n via node nativo (Google Sheets node já existe no n8n, sem configuração extra). Cada linha é um lead, cada coluna é um campo.

**Colunas da planilha:**
```
nome | telefone | canal | nicho | tem_site | problemas_encontrados | severidade | mensagem_gerada | status | data_envio | observacoes
```

**Critérios de aceitação:**
- [ ] Cada lead do Workflow C é adicionado automaticamente como linha na planilha
- [ ] Status atualiza na planilha quando muda no n8n
- [ ] Campo `problemas_encontrados` visível na linha do lead para consulta durante conversa
- [ ] PO consegue atualizar status manualmente na planilha (sem precisar abrir o n8n)

**DoD específico:** PO abre a planilha durante uma conversa real com um lead e encontra todas as informações necessárias para conduzir a negociação sem precisar lembrar de memória.

---

### Revisão da Sprint 4
**Critério de saída:** planilha com pelo menos 5 leads reais preenchidos, status funcionando, PO consegue operar sem abrir o n8n.

---

## Resumo das Sprints

| Sprint | Foco | Duração | Critério de saída |
|---|---|---|---|
| Sprint 0 | Infraestrutura | 2-3 dias | Todos os serviços rodando e conectados |
| Sprint 1 | Captação de leads | 3-4 dias | 10 leads reais classificados e aprovados pelo PO |
| Sprint 2 | Diagnóstico de sites | 4-5 dias | 5 diagnósticos reais aprovados pelo PO |
| Sprint 3 | Mensagens e envio | 3-4 dias | Ciclo completo testado com 3 leads reais |
| Sprint 4 | Acompanhamento | 2-3 dias | Planilha operacional com 5 leads reais |

**Tempo total estimado:** 2-3 semanas trabalhando 1-2 horas por dia.
