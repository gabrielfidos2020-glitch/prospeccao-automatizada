CREATE SCHEMA IF NOT EXISTS argus;

CREATE TABLE IF NOT EXISTS argus.leads (
    id UUID PRIMARY KEY,
    nome VARCHAR(255),
    telefone VARCHAR(50),
    endereco TEXT,
    site TEXT,
    url_site TEXT,
    categoria VARCHAR(100),
    categoria_mapeada VARCHAR(100),
    canal VARCHAR(50),
    tem_site BOOLEAN,
    problemas_encontrados JSONB,
    severidade VARCHAR(50),
    mensagem_gerada TEXT,
    status VARCHAR(50) DEFAULT 'aguardando_aprovacao',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
