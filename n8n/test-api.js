const axios = require('axios');

async function testApis() {
  console.log('Validando WhatsApp (Evolution API)...');
  try {
    const wppResp = await axios.post('http://evolution-api:8080/message/sendText/capta%C3%A7ao', {
      number: '5511999999999',
      text: 'Teste de validação do fluxo automatizado - WhatsApp'
    }, {
      headers: { apikey: 'changeme' }
    });
    console.log('✅ WhatsApp retornou sucesso!');
    console.log('Status HTTP:', wppResp.status);
    console.log('Resposta:', JSON.stringify(wppResp.data).substring(0, 200) + '...');
  } catch (err) {
    console.error('❌ Erro no WhatsApp:', err.response ? err.response.status : err.message);
    if (err.response && err.response.data && err.response.data.response) console.error(JSON.stringify(err.response.data.response));
  }
}

testApis();
