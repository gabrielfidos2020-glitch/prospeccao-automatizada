import os
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from instagrapi import Client
from instagrapi.exceptions import LoginRequired, BadPassword, TwoFactorRequired

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("instagrapi-service")

app = FastAPI(title="Instagrapi Service", version="1.0.0")

cl = Client()
is_logged_in = False
logged_username = ""


# ─────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────

class LoginRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None

class DMRequest(BaseModel):
    username: str   # @ do destinatário no Instagram (sem o @)
    message: str

class DMResponse(BaseModel):
    status: str
    para: str


# ─────────────────────────────────────────
# GET /health — Health check
# ─────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "instagrapi",
        "logged_in": is_logged_in,
        "username": logged_username or None,
    }


# ─────────────────────────────────────────
# POST /login — Autentica conta Instagram
# Body: { username?, password? }
# Se omitido, usa variáveis de ambiente INSTAGRAM_USERNAME / INSTAGRAM_PASSWORD
# ─────────────────────────────────────────

@app.post("/login")
async def login(data: Optional[LoginRequest] = None):
    global cl, is_logged_in, logged_username

    username = (data and data.username) or os.getenv("INSTAGRAM_USERNAME", "")
    password = (data and data.password) or os.getenv("INSTAGRAM_PASSWORD", "")

    if not username or not password:
        raise HTTPException(
            status_code=400,
            detail="Credenciais não fornecidas. Passe no body ou configure INSTAGRAM_USERNAME e INSTAGRAM_PASSWORD.",
        )

    logger.info(f"[login] Autenticando conta: @{username}")

    try:
        cl = Client()
        cl.login(username, password)
        is_logged_in = True
        logged_username = username
        logger.info(f"[login] Sucesso: @{username}")
        return {"status": "autenticado", "username": username}

    except BadPassword:
        raise HTTPException(status_code=401, detail="Senha incorreta")
    except TwoFactorRequired:
        raise HTTPException(status_code=403, detail="Autenticação de dois fatores ativa. Desative temporariamente.")
    except Exception as e:
        logger.error(f"[login] Erro: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────
# POST /direct/send — Envia DM no Instagram
# Body: { username: string, message: string }
# ─────────────────────────────────────────

@app.post("/direct/send", response_model=DMResponse)
async def send_dm(data: DMRequest):
    global is_logged_in
    if not is_logged_in:
        raise HTTPException(
            status_code=401,
            detail="Não autenticado. Chame POST /login primeiro.",
        )

    logger.info(f"[direct/send] Enviando DM para @{data.username}")

    try:
        user_id = cl.user_id_from_username(data.username)
        cl.direct_send(data.message, [user_id])
        logger.info(f"[direct/send] Mensagem enviada para @{data.username}")
        return {"status": "enviado", "para": data.username}

    except LoginRequired:
        is_logged_in = False
        raise HTTPException(status_code=401, detail="Sessão expirada. Faça login novamente.")
    except Exception as e:
        logger.error(f"[direct/send] Erro: {e}")
        raise HTTPException(status_code=500, detail=str(e))
