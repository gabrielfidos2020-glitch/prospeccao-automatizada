import logging
from instagrapi import Client
from instagrapi.exceptions import BadPassword, TwoFactorRequired, ChallengeRequired

logging.basicConfig(level=logging.DEBUG)

def test_login():
    cl = Client()
    print("Tentando login com instagrapi...")
    try:
        cl.login("batatavisa", "5376701G")
        print("Login com sucesso!")
    except Exception as e:
        print(f"Erro ao tentar login: {type(e).__name__} - {str(e)}")

test_login()
