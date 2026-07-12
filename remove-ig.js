const fs = require('fs');
const wf = JSON.parse(fs.readFileSync('/app/workflow-c.json', 'utf8'));

// Filter out nodes
const nodesToRemove = ['Qual Canal?', 'Delay Instagram', 'Enviar Instagram (Instagrapi)'];
wf.nodes = wf.nodes.filter(n => !nodesToRemove.includes(n.name));

// Remove connections involving removed nodes
delete wf.connections['Status Aprovado?']; // We'll rewrite it to point to Delay WhatsApp directly
delete wf.connections['Qual Canal?'];
delete wf.connections['Delay Instagram'];
delete wf.connections['Enviar Instagram (Instagrapi)'];

// Status Aprovado? main index 0 -> Delay WhatsApp
wf.connections['Status Aprovado?'] = {
  main: [
    [{"node": "Delay WhatsApp", "type": "main", "index": 0}]
  ]
};

fs.writeFileSync('/app/workflow-c.json', JSON.stringify(wf, null, 2));
console.log('Instagram nodes removed successfully!');
