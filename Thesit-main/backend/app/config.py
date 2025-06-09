import os
from dotenv import load_dotenv

load_dotenv()

FB_APP_ID = os.getenv("FB_APP_ID")
FB_APP_SECRET = os.getenv("FB_APP_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI")
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN")
FB_API_URL = os.getenv("FB_API_URL")

OAUTH_LINK = (
    f"https://www.facebook.com/v14.0/dialog/oauth?client_id={FB_APP_ID}"
    f"&redirect_uri={REDIRECT_URI}"
    f"&scope=pages_show_list,pages_read_engagement,pages_messaging&response_type=code"
)

page_tokens = {}
page_names = {}