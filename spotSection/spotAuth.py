#!/usr/bin/env python3
"""
ONE-TIME SETUP: authorise this app against your own Spotify account and save a
refresh token.

Why this exists
---------------
The /me/top/... endpoints return *your personal* listening data, so they need a
token issued on behalf of a user (Authorization Code flow + the `user-top-read`
scope). The Client Credentials flow cannot reach them at all - it only proves
which *app* is calling, not which *user*, so it returns 401/403 on any /me route.

You run this script once, interactively, on your own machine. It opens a browser,
you click "Agree", and it saves a refresh token to .env. From then on the weekly
script (spotify_stats.py) uses that refresh token unattended - no browser needed.

Usage:
    pip install -r requirements.txt
    python spotify_auth.py
"""

import base64
import hashlib
import os
import secrets
import sys
import threading
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

import requests
from dotenv import load_dotenv, set_key

load_dotenv()

CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
# NOTE: must be http://127.0.0.1 - Spotify no longer accepts "localhost" or any
# other plain-HTTP redirect URI. Add this EXACT string in your app's settings.
REDIRECT_URI = os.getenv("SPOTIFY_REDIRECT_URI", "http://127.0.0.1:8888/callback")
SCOPE = "user-top-read"

AUTH_URL = "https://accounts.spotify.com/authorize"
TOKEN_URL = "https://accounts.spotify.com/api/token"

_result = {}


class _CallbackHandler(BaseHTTPRequestHandler):
    """Catches the single redirect Spotify sends back with ?code=..."""

    def do_GET(self):
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        _result.update({k: v[0] for k, v in params.items()})

        ok = "code" in _result
        body = (
            "<h2>Authorised.</h2><p>You can close this tab and return to the terminal.</p>"
            if ok else
            f"<h2>Authorisation failed</h2><p>{_result.get('error', 'unknown error')}</p>"
        )
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(f"<html><body style='font-family:sans-serif'>{body}</body></html>".encode())

    def log_message(self, *args):
        pass  # keep the terminal quiet


def main():
    if not CLIENT_ID or not CLIENT_SECRET:
        sys.exit("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env first.")

    # PKCE: generate a verifier and its S256 challenge. Spotify expects the
    # authorization-code grant to use PKCE, and it costs nothing to include.
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(64)).decode().rstrip("=")
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).decode().rstrip("=")
    state = secrets.token_urlsafe(16)

    params = {
        "client_id": CLIENT_ID,
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPE,
        "state": state,
        "code_challenge_method": "S256",
        "code_challenge": challenge,
        # force the consent screen so you can confirm the right account is used
        "show_dialog": "true",
    }
    url = f"{AUTH_URL}?{urllib.parse.urlencode(params)}"

    parsed = urllib.parse.urlparse(REDIRECT_URI)
    server = HTTPServer((parsed.hostname, parsed.port or 80), _CallbackHandler)
    threading.Thread(target=server.handle_request, daemon=True).start()

    print("\nOpening your browser to authorise...")
    print(f"If it doesn't open, paste this URL manually:\n\n{url}\n")
    webbrowser.open(url)

    # handle_request() serves exactly one request, then the thread ends
    while not _result:
        pass
    server.server_close()

    if "error" in _result:
        sys.exit(f"Authorisation failed: {_result['error']}")
    if _result.get("state") != state:
        sys.exit("State mismatch - aborting (possible CSRF).")

    resp = requests.post(
        TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": _result["code"],
            "redirect_uri": REDIRECT_URI,
            "code_verifier": verifier,
        },
        auth=(CLIENT_ID, CLIENT_SECRET),
        timeout=30,
    )

    if resp.status_code != 200:
        sys.exit(f"Token exchange failed ({resp.status_code}): {resp.text}")

    payload = resp.json()
    refresh_token = payload.get("refresh_token")
    if not refresh_token:
        sys.exit(f"No refresh_token in response: {payload}")

    set_key(".env", "SPOTIFY_REFRESH_TOKEN", refresh_token)

    print("\nDone. Refresh token saved to .env as SPOTIFY_REFRESH_TOKEN.\n")
    print("Keep it secret - it grants ongoing read access to your listening data.")
    print("For GitHub Actions, copy this value into a repository secret:\n")
    print(f"  {refresh_token}\n")


if __name__ == "__main__":
    main()