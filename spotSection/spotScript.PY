#!/usr/bin/env python3
"""
Weekly job: fetch my top artist, album and song from the last ~4 weeks and write
them to spotify-stats.json for the portfolio site to read.

Run spotify_auth.py ONCE first to create SPOTIFY_REFRESH_TOKEN.

Environment (from .env locally, or repo secrets in CI):
    SPOTIFY_CLIENT_ID
    SPOTIFY_CLIENT_SECRET
    SPOTIFY_REFRESH_TOKEN

Usage:
    python spotify_stats.py [--out spotifyDetails.json]
"""

import argparse
import json
import os
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

load_dotenv()

TOKEN_URL = "https://accounts.spotify.com/api/token"
API = "https://api.spotify.com/v1"

# Spotify offers three windows: short_term (~last 4 weeks), medium_term (~6
# months) and long_term (~1 year). There is no exact "last 30 days" option, so
# short_term is the closest match.
TIME_RANGE = "short_term"


# --------------------------------------------------------------------------- #
# HTTP helpers
# --------------------------------------------------------------------------- #
def _request(method, url, **kwargs):
    """Request with retries for rate limits (429) and transient server errors."""
    for attempt in range(5):
        resp = requests.request(method, url, timeout=30, **kwargs)

        if resp.status_code == 429:
            # Spotify tells us exactly how long to wait
            wait = int(resp.headers.get("Retry-After", "5")) + 1
            print(f"  rate limited, waiting {wait}s...", file=sys.stderr)
            time.sleep(wait)
            continue

        if resp.status_code >= 500:
            wait = 2 ** attempt
            print(f"  server error {resp.status_code}, retrying in {wait}s...", file=sys.stderr)
            time.sleep(wait)
            continue

        return resp

    return resp  # final attempt's response, caller handles the error


def get_access_token():
    """Exchange the long-lived refresh token for a fresh access token."""
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    refresh_token = os.getenv("SPOTIFY_REFRESH_TOKEN")

    missing = [n for n, v in [
        ("SPOTIFY_CLIENT_ID", client_id),
        ("SPOTIFY_CLIENT_SECRET", client_secret),
        ("SPOTIFY_REFRESH_TOKEN", refresh_token),
    ] if not v]
    if missing:
        sys.exit(f"Missing required environment variables: {', '.join(missing)}\n"
                 "Run spotify_auth.py once to generate a refresh token.")

    resp = _request(
        "POST", TOKEN_URL,
        data={"grant_type": "refresh_token", "refresh_token": refresh_token},
        auth=(client_id, client_secret),
    )

    if resp.status_code != 200:
        sys.exit(f"Could not refresh access token ({resp.status_code}): {resp.text}\n"
                 "If this says 'invalid_grant', the refresh token was revoked - "
                 "re-run spotify_auth.py.")

    payload = resp.json()

    # Usually absent for confidential clients, but if Spotify ever rotates the
    # refresh token we must notice, or the next run will fail.
    rotated = payload.get("refresh_token")
    if rotated and rotated != refresh_token:
        print("NOTE: Spotify issued a NEW refresh token. Update your .env / repo "
              "secret with the value below or future runs will fail:\n"
              f"  {rotated}", file=sys.stderr)

    return payload["access_token"]


def get_top_items(token, item_type, limit=50):
    """GET /me/top/{artists|tracks} for the configured time range."""
    resp = _request(
        "GET", f"{API}/me/top/{item_type}",
        headers={"Authorization": f"Bearer {token}"},
        params={"time_range": TIME_RANGE, "limit": limit, "offset": 0},
    )

    if resp.status_code == 403:
        sys.exit("403 from Spotify. The token lacks the 'user-top-read' scope - "
                 "re-run spotify_auth.py to re-consent.")
    if resp.status_code != 200:
        sys.exit(f"Error fetching top {item_type} ({resp.status_code}): {resp.text}")

    return resp.json().get("items", [])


# --------------------------------------------------------------------------- #
# Shaping the data
# --------------------------------------------------------------------------- #
def _image(images, prefer=300):
    """Pick the image closest to the preferred width."""
    if not images:
        return None
    best = min(images, key=lambda im: abs((im.get("width") or 0) - prefer))
    return best.get("url")


def top_album_from_tracks(tracks, include_singles=False):
    """
    Spotify has no "top albums" endpoint, so derive it from the top tracks:
    score each album by how many of your top tracks it contains, weighted by
    each track's rank (rank 1 counts most). This mirrors how you'd rank albums
    by hand from a most-played list.
    """
    scores = defaultdict(float)
    albums = {}
    n = len(tracks)

    for i, track in enumerate(tracks):
        album = track.get("album") or {}
        album_id = album.get("id")
        if not album_id:
            continue
        if not include_singles and album.get("album_type") == "single":
            continue

        scores[album_id] += n - i  # rank weight: first track scores highest
        albums[album_id] = album

    if not scores:
        # every top track was a single - fall back to counting those too
        if not include_singles:
            return top_album_from_tracks(tracks, include_singles=True)
        return None

    best_id = max(scores, key=scores.get)
    album = albums[best_id]
    return {
        "name": album.get("name"),
        "artist": ", ".join(a["name"] for a in album.get("artists", [])),
        "image": _image(album.get("images", [])),
        "url": (album.get("external_urls") or {}).get("spotify"),
        "track_count": sum(
            1 for t in tracks if (t.get("album") or {}).get("id") == best_id
        ),
    }


def get_profile(token):
    """GET /me - my account's public profile (display name, avatar, link)."""
    resp = _request(
        "GET", f"{API}/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    if resp.status_code != 200:
        sys.exit(f"Error fetching profile ({resp.status_code}): {resp.text}")

    data = resp.json()
    return {
        "name": data.get("display_name"),
        "image": _image(data.get("images", [])),   # picks the size closest to 300px
        "url": (data.get("external_urls") or {}).get("spotify"),
    }


def build_stats(token):
    print("Fetching top artists...")
    artists = get_top_items(token, "artists", limit=20)
    print("Fetching top tracks...")
    tracks = get_top_items(token, "tracks", limit=50)
    print("Fetching profile...")
    profile = get_profile(token)

    if not artists and not tracks:
        sys.exit("Spotify returned no listening data for this period.")

    if not profile:
        sys.exit("Spotify returned no profile data for this account.")

    stats = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "time_range": TIME_RANGE,
        "period_label": "last 4 weeks",
        "top_artist": None,
        "top_album": None,
        "top_track": None,
        "spot_profile": None,
    }

    if artists:
        a = artists[0]
        stats["top_artist"] = {
            "name": a.get("name"),
            "image": _image(a.get("images", [])),
            "url": (a.get("external_urls") or {}).get("spotify"),
            # genres survived the Feb 2026 field cull, so the site can still
            # show a genre label if you want one
            "genres": (a.get("genres") or [])[:3],
        }

    if tracks:
        t = tracks[0]
        stats["top_track"] = {
            "name": t.get("name"),
            "artist": ", ".join(ar["name"] for ar in t.get("artists", [])),
            "image": _image((t.get("album") or {}).get("images", [])),
            "url": (t.get("external_urls") or {}).get("spotify"),
        }
        stats["top_album"] = top_album_from_tracks(tracks)

    if profile:
        stats["spot_profile"] = profile

    return stats


# --------------------------------------------------------------------------- #
def main():
    parser = argparse.ArgumentParser(description="Update Spotify listening stats.")
    parser.add_argument("--out", default="spotSection/spotDetails.json",
                        help="output JSON path (default: spotSection/spotDetails.json)")
    args = parser.parse_args()

    token = get_access_token()
    stats = build_stats(token)

    # Write to a temp file first, then move it into place, so a crash midway
    # can never leave the site reading a half-written file.
    tmp = args.out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(stats, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    os.replace(tmp, args.out)

    print(f"\nWrote {args.out}")
    for key in ("top_artist", "top_album", "top_track"):
        item = stats.get(key)
        if item:
            extra = f" - {item['artist']}" if item.get("artist") else ""
            print(f"  {key:11}: {item['name']}{extra}")


if __name__ == "__main__":
    main()