document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = 'http://localhost:3001/api';
  
  let allLeads = [];
  let pollingLeads;
  let pollingStatus;

  // Tabs Nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      
      item.classList.add('active');
      const tabId = item.getAttribute('data-tab');
      document.getElementById(`tab-${tabId}`).classList.add('active');
    });
  });

  // Modal Rodada
  document.getElementById('btn-nova-rodada').addEventListener('click', () => {
    document.getElementById('overlay').classList.add('active');
    document.getElementById('modal-rodada').classList.add('active');
  });
  document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('overlay').classList.remove('active');
    document.getElementById('modal-rodada').classList.remove('active');
  });
  
  document.getElementById('btn-submit-rodada').addEventListener('click', async () => {
    const nicho = document.getElementById('rodada-nicho').value;
    const regiao = document.getElementById('rodada-regiao').value;
    const qtd = document.getElementById('rodada-qtd').value;
    
    document.getElementById('global-loader').style.display = 'block';
    await fetch(`${API_BASE}/rodada`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nicho, regiao, quantidade: qtd })
    });
    
    document.getElementById('close-modal').click();
    document.getElementById('global-loader').style.display = 'none';
    fetchLeads(); // refresh instantâneo
  });

  // Side Panel
  document.getElementById('close-panel').addEventListener('click', closeSidePanel);
  document.getElementById('overlay').addEventListener('click', (e) => {
    if(e.target.id === 'overlay') {
      closeSidePanel();
      document.getElementById('modal-rodada').classList.remove('active');
    }
  });

  function closeSidePanel() {
    document.getElementById('side-panel').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
  }

  // Copy
  document.getElementById('btn-copy').addEventListener('click', () => {
    const text = document.getElementById('sp-mensagem').innerText;
    navigator.clipboard.writeText(text);
    const btn = document.getElementById('btn-copy');
    btn.innerHTML = '<i class="ri-check-line"></i> Copiado!';
    setTimeout(() => btn.innerHTML = '<i class="ri-file-copy-line"></i> Copiar', 2000);
  });

  // Load Status
  async function fetchStatus() {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();
      const el = document.getElementById('header-status');
      el.innerHTML = '';
      Object.entries(data).forEach(([srv, st]) => {
        el.innerHTML += `<div class="status-pill"><div class="status-dot ${st}"></div>${srv}</div>`;
      });
    } catch(e) {}
  }

  // Load Leads
  async function fetchLeads() {
    try {
      const res = await fetch(`${API_BASE}/leads`);
      allLeads = await res.json();
      renderDashboard();
      renderLeadsTable();
      renderHistory();
    } catch(e) {}
  }

  function getBadgeClass(type, val) {
    if(type === 'nicho') {
      const map = { 'Saúde':'b-nicho-saude', 'Serviços':'b-nicho-servicos', 'Comércio':'b-nicho-comercio', 'Estética':'b-nicho-saude', 'Eventos':'b-nicho-eventos'};
      return map[val] || '';
    }
    if(type === 'canal') {
      if(val === 'whatsapp') return 'b-canal-whatsapp';
      if(val === 'instagram') return 'b-canal-instagram';
      if(val === 'email') return 'b-canal-email';
    }
    if(type === 'sev') return val === 'critico' ? 'b-sev-critico' : 'b-sev-melhoria';
    if(type === 'status') {
      if(val === 'enviados') return 'b-status-enviados';
      if(val === 'respondidos') return 'b-status-respondidos';
      if(val === 'erro') return 'b-status-erro';
    }
    return '';
  }

  function renderDashboard() {
    // Metrics
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('met-hoje').innerText = allLeads.filter(l => l.timeline.captado_em?.startsWith(hoje)).length;
    document.getElementById('met-pendentes').innerText = allLeads.filter(l => l.status === 'aguardando_aprovacao').length;
    document.getElementById('met-enviados').innerText = allLeads.filter(l => l.status === 'enviados').length;
    document.getElementById('met-respondidos').innerText = allLeads.filter(l => l.status === 'respondidos').length;

    // Kanban
    const cols = ['captando', 'aguardando_aprovacao', 'enviados', 'respondidos', 'erro'];
    cols.forEach(c => {
      document.getElementById(`col-${c}`).innerHTML = '';
      document.getElementById(`count-${c}`).innerText = '0';
    });

    allLeads.forEach(lead => {
      const c = document.getElementById(`col-${lead.status}`);
      if(c) {
        document.getElementById(`count-${lead.status}`).innerText = parseInt(document.getElementById(`count-${lead.status}`).innerText) + 1;
        
        c.innerHTML += `
          <div class="k-card" onclick="openLead('${lead.id}')">
            <h4>${lead.nome}</h4>
            <div class="k-badges">
              <span class="badge ${getBadgeClass('nicho', lead.nicho)}">${lead.nicho}</span>
              <span class="badge ${getBadgeClass('canal', lead.canal)}">${lead.canal}</span>
              <span class="badge ${getBadgeClass('sev', lead.severidade)}">${lead.severidade}</span>
            </div>
          </div>
        `;
      }
    });
  }

  function renderLeadsTable() {
    const statFilter = document.getElementById('filter-status').value;
    const nichoFilter = document.getElementById('filter-nicho').value;
    
    const tbody = document.getElementById('table-leads');
    tbody.innerHTML = '';
    
    allLeads.filter(l => {
      if(statFilter && l.status !== statFilter) return false;
      if(nichoFilter && l.nicho !== nichoFilter) return false;
      return true;
    }).forEach(lead => {
      tbody.innerHTML += `
        <tr onclick="openLead('${lead.id}')">
          <td><strong>${lead.nome}</strong></td>
          <td><span class="badge ${getBadgeClass('nicho', lead.nicho)}">${lead.nicho}</span></td>
          <td><span class="badge ${getBadgeClass('canal', lead.canal)}">${lead.canal}</span></td>
          <td><span class="badge ${getBadgeClass('status', lead.status)}" style="border:none">${lead.status}</span></td>
        </tr>
      `;
    });
  }

  document.getElementById('filter-status').addEventListener('change', renderLeadsTable);
  document.getElementById('filter-nicho').addEventListener('change', renderLeadsTable);

  function renderHistory() {
    const list = document.getElementById('list-historico');
    list.innerHTML = '';
    
    const hist = allLeads.filter(l => ['enviados', 'respondidos', 'erro'].includes(l.status))
                         .sort((a,b) => new Date(b.timeline.captado_em) - new Date(a.timeline.captado_em));
    
    hist.forEach(lead => {
      list.innerHTML += `
        <div class="h-item" onclick="openLead('${lead.id}')">
          <div>
            <strong>${lead.nome}</strong> <span class="muted">(${lead.canal})</span>
          </div>
          <div>
            <span class="badge">${new Date(lead.timeline.captado_em).toLocaleString()}</span>
            <span class="badge ${getBadgeClass('status', lead.status)}" style="border:none">${lead.status}</span>
          </div>
        </div>
      `;
    });
  }

  window.openLead = (id) => {
    const lead = allLeads.find(l => l.id === id);
    if(!lead) return;

    document.getElementById('sp-nome').innerText = lead.nome;
    document.getElementById('sp-nicho').className = `badge ${getBadgeClass('nicho', lead.nicho)}`;
    document.getElementById('sp-nicho').innerText = lead.nicho;
    document.getElementById('sp-canal').className = `badge ${getBadgeClass('canal', lead.canal)}`;
    document.getElementById('sp-canal').innerText = lead.canal;
    document.getElementById('sp-telefone').innerText = lead.telefone;
    
    document.getElementById('sp-severidade').className = `badge ${getBadgeClass('sev', lead.severidade)}`;
    document.getElementById('sp-severidade').innerText = lead.severidade;
    
    const diagUl = document.getElementById('sp-diagnostico');
    diagUl.innerHTML = lead.diagnostico.length ? lead.diagnostico.map(d => `<li>${d}</li>`).join('') : '<li class="muted">Nenhum problema técnico encontrado.</li>';
    
    document.getElementById('sp-mensagem').innerText = lead.mensagem_gerada || 'Gerando mensagem...';

    // Timeline
    const tl = document.getElementById('sp-timeline');
    const steps = [
      { key: 'captado_em', label: 'Lead Encontrado' },
      { key: 'diagnosticado_em', label: 'Diagnóstico Concluído' },
      { key: 'copy_gerada_em', label: 'Mensagem Gerada' },
      { key: 'enviado_em', label: 'Enviado' },
      { key: 'respondido_em', label: 'Respondido' }
    ];
    
    let tlHtml = '';
    let foundCurrent = false;
    for(let i=steps.length-1; i>=0; i--) {
      const s = steps[i];
      if(lead.timeline[s.key]) {
        if(!foundCurrent) {
          tlHtml = `<div class="tl-item current"><i class="ri-checkbox-circle-fill"></i> ${s.label}</div>` + tlHtml;
          foundCurrent = true;
        } else {
          tlHtml = `<div class="tl-item done"><i class="ri-checkbox-circle-line"></i> ${s.label}</div>` + tlHtml;
        }
      } else {
        tlHtml = `<div class="tl-item"><i class="ri-checkbox-blank-circle-line"></i> ${s.label}</div>` + tlHtml;
      }
    }
    tl.innerHTML = tlHtml;

    // Ações
    const footer = document.getElementById('sp-footer');
    if(lead.status === 'aguardando_aprovacao') {
      footer.style.display = 'flex';
      document.getElementById('btn-aprovar').onclick = () => actionLead(lead.id, 'aprovar');
      document.getElementById('btn-rejeitar').onclick = () => actionLead(lead.id, 'rejeitar');
    } else {
      footer.style.display = 'none';
    }

    document.getElementById('overlay').classList.add('active');
    document.getElementById('side-panel').classList.add('open');
  };

  async function actionLead(id, action) {
    document.getElementById('global-loader').style.display = 'block';
    try {
      await fetch(`${API_BASE}/leads/${id}/${action}`, { method: 'POST' });
      closeSidePanel();
      await fetchLeads(); // refresh
    } catch(e) {
      alert('Erro na operação');
    } finally {
      document.getElementById('global-loader').style.display = 'none';
    }
  }

  // Initialization & Polling
  fetchStatus();
  fetchLeads();
  
  pollingStatus = setInterval(fetchStatus, 30000);
  pollingLeads = setInterval(fetchLeads, 15000);
});
