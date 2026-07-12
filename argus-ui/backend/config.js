module.exports = {
  N8N_URL: process.env.N8N_URL || 'http://n8n:5678',
  OLLAMA_URL: process.env.OLLAMA_URL || 'http://prospeccao-ollama:11434',
  SCRAPER_URL: process.env.SCRAPER_URL || 'http://scraper:3000',
  EVOLUTION_URL: process.env.EVOLUTION_URL || 'http://evolution-api:8080',
  INSTAGRAPI_URL: process.env.INSTAGRAPI_URL || 'http://instagrapi:8001',
  PORT: process.env.PORT || 3001
};
