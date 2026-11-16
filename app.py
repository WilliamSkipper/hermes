import yt_dlp
import os
import re
import tempfile
import threading
import time
import uuid
from PIL import Image
import subprocess
import json
import zipfile
import shutil
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, quote, parse_qs

# ── Valid access tokens ───────────────────────────────────────────────────────
VALID_TOKENS = {
    "123",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def sanitize(name):
    return re.sub(r'[\\/*?:"<>|]', '_', name).strip()

def crop_square_thumbnail(path):
    img = Image.open(path)
    w, h = img.size
    m = min(w, h)
    img.crop(((w - m) // 2, (h - m) // 2, (w + m) // 2, (h + m) // 2)).save(path)

def embed_thumbnail(mp3_path, thumb_path):
    tmp = mp3_path + "_cover.mp3"
    subprocess.run([
        "ffmpeg", "-y",
        "-i", mp3_path,
        "-i", thumb_path,
        "-map", "0:a", "-map", "1",
        "-c", "copy",
        "-id3v2_version", "3",
        "-metadata:s:v", "title=Album cover",
        "-metadata:s:v", "comment=Cover (front)",
        tmp
    ], check=True, capture_output=True)
    os.replace(tmp, mp3_path)

def find_output_file(tmpdir, ext):
    for fname in os.listdir(tmpdir):
        if fname.lower().endswith(ext):
            return os.path.join(tmpdir, fname), fname
    return None, None

def find_all_output_files(tmpdir, ext):
    results = []
    for fname in os.listdir(tmpdir):
        if fname.lower().endswith(ext):
            results.append((os.path.join(tmpdir, fname), fname))
    return results

def is_playlist(url):
    parsed = urlparse(url)
    return "list=" in parsed.query and ("playlist" in url or "list=" in parsed.query)

def process_thumbnail(tmpdir, mp3_path):
    for img_ext in (".jpg", ".jpeg", ".png", ".webp"):
        thumb_path, _ = find_output_file(tmpdir, img_ext)
        if thumb_path:
            if img_ext == ".webp":
                jpg_path = thumb_path[:-5] + ".jpg"
                Image.open(thumb_path).convert("RGB").save(jpg_path)
                os.remove(thumb_path)
                thumb_path = jpg_path
            crop_square_thumbnail(thumb_path)
            embed_thumbnail(mp3_path, thumb_path)
            os.remove(thumb_path)
            break

# ── Download functions ────────────────────────────────────────────────────────

def do_mp3_full(url, tmpdir):
    outtmpl = os.path.join(tmpdir, "%(title)s.%(ext)s")
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': outtmpl,
        'writethumbnail': True,
        'postprocessors': [
            {'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'},
            {'key': 'FFmpegMetadata', 'add_metadata': True},
        ],
        'postprocessor_args': {'ffmpegmetadata': ['-id3v2_version', '3']},
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    mp3_path, mp3_name = find_output_file(tmpdir, ".mp3")
    if not mp3_path:
        raise FileNotFoundError(f"No MP3 found in {tmpdir}.")
    process_thumbnail(tmpdir, mp3_path)
    return mp3_path, sanitize(mp3_name)

def do_mp3_simple(url, tmpdir):
    outtmpl = os.path.join(tmpdir, "%(title)s.%(ext)s")
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': outtmpl,
        'postprocessors': [
            {'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'},
        ],
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    mp3_path, mp3_name = find_output_file(tmpdir, ".mp3")
    if not mp3_path:
        raise FileNotFoundError(f"No MP3 found in {tmpdir}.")
    return mp3_path, sanitize(mp3_name)

def do_mp4(url, tmpdir):
    outtmpl = os.path.join(tmpdir, "%(title)s.%(ext)s")
    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': outtmpl,
        'merge_output_format': 'mp4',
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    mp4_path, mp4_name = find_output_file(tmpdir, ".mp4")
    if not mp4_path:
        raise FileNotFoundError(f"No MP4 found in {tmpdir}.")
    return mp4_path, sanitize(mp4_name)

def do_playlist_mp3_full(url, tmpdir):
    outtmpl = os.path.join(tmpdir, "%(playlist_index)s - %(title)s.%(ext)s")
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': outtmpl,
        'writethumbnail': True,
        'ignoreerrors': True,
        'postprocessors': [
            {'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'},
            {'key': 'FFmpegMetadata', 'add_metadata': True},
        ],
        'postprocessor_args': {'ffmpegmetadata': ['-id3v2_version', '3']},
    }
    playlist_title = "playlist"
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if info and info.get("title"):
            playlist_title = sanitize(info["title"])
    mp3_files = find_all_output_files(tmpdir, ".mp3")
    if not mp3_files:
        raise FileNotFoundError(f"No MP3s found in {tmpdir}.")
    for mp3_path, _ in mp3_files:
        base = os.path.splitext(mp3_path)[0]
        thumb_path = None
        for img_ext in (".jpg", ".jpeg", ".png", ".webp"):
            candidate = base + img_ext
            if os.path.exists(candidate):
                thumb_path = candidate
                break
        if thumb_path:
            if thumb_path.endswith(".webp"):
                jpg_path = thumb_path[:-5] + ".jpg"
                Image.open(thumb_path).convert("RGB").save(jpg_path)
                os.remove(thumb_path)
                thumb_path = jpg_path
            crop_square_thumbnail(thumb_path)
            embed_thumbnail(mp3_path, thumb_path)
            os.remove(thumb_path)
    zip_name = f"{playlist_title}.zip"
    zip_path = os.path.join(tmpdir, zip_name)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for mp3_path, mp3_name in mp3_files:
            zf.write(mp3_path, sanitize(mp3_name))
    return zip_path, zip_name

def do_playlist_mp3_simple(url, tmpdir):
    outtmpl = os.path.join(tmpdir, "%(playlist_index)s - %(title)s.%(ext)s")
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': outtmpl,
        'ignoreerrors': True,
        'postprocessors': [
            {'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'},
        ],
    }
    playlist_title = "playlist"
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if info and info.get("title"):
            playlist_title = sanitize(info["title"])
    mp3_files = find_all_output_files(tmpdir, ".mp3")
    if not mp3_files:
        raise FileNotFoundError(f"No MP3s found in {tmpdir}.")
    zip_name = f"{playlist_title}.zip"
    zip_path = os.path.join(tmpdir, zip_name)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for mp3_path, mp3_name in mp3_files:
            zf.write(mp3_path, sanitize(mp3_name))
    return zip_path, zip_name

def do_playlist_mp4(url, tmpdir):
    outtmpl = os.path.join(tmpdir, "%(playlist_index)s - %(title)s.%(ext)s")
    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': outtmpl,
        'merge_output_format': 'mp4',
        'ignoreerrors': True,
    }
    playlist_title = "playlist"
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if info and info.get("title"):
            playlist_title = sanitize(info["title"])
    mp4_files = find_all_output_files(tmpdir, ".mp4")
    if not mp4_files:
        raise FileNotFoundError(f"No MP4s found in {tmpdir}.")
    zip_name = f"{playlist_title}.zip"
    zip_path = os.path.join(tmpdir, zip_name)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for mp4_path, mp4_name in mp4_files:
            zf.write(mp4_path, sanitize(mp4_name))
    return zip_path, zip_name

# ── Static file paths ─────────────────────────────────────────────────────────

BASE   = os.path.dirname(os.path.abspath(__file__))
STATIC = {
    "/":                       os.path.join(BASE, "public", "html", "index.html"),
    "/index.html":             os.path.join(BASE, "public", "html", "index.html"),
    "/favicon.svg":            os.path.join(BASE, "public", "favicon.svg"),
    "/apple-touch-icon.png":   os.path.join(BASE, "public", "apple-touch-icon.png"),
    "/og-image.png":           os.path.join(BASE, "public", "og-image.png"),
}
MIME_MAP = {
    ".html": "text/html; charset=utf-8",
    ".css":  "text/css; charset=utf-8",
    ".js":   "application/javascript; charset=utf-8",
    ".png":  "image/png",
    ".ico":  "image/x-icon",
    ".svg":  "image/svg+xml",
    ".webp": "image/webp",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".json": "application/json",
}

# ── Request handler ───────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        print(f"[{self.address_string()}] {fmt % args}")

    def send_json(self, code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        fp = STATIC.get(path)
        if not fp and path.startswith("/public/"):
            rel_path = os.path.normpath(path.lstrip("/"))
            target_path = os.path.join(BASE, rel_path)
            if os.path.commonpath([BASE, target_path]) == BASE and os.path.isfile(target_path):
                fp = target_path

        if not fp or not os.path.isfile(fp):
            self.send_error(404)
            return

        ext = os.path.splitext(fp)[1].lower()
        try:
            with open(fp, "rb") as f:
                body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", MIME_MAP.get(ext, "application/octet-stream"))
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(body)
        except FileNotFoundError:
            self.send_error(404, f"Missing: {fp}")

    def do_POST(self):
        path = urlparse(self.path).path

        # ── /auth ─────────────────────────────────────────────────────────
        if path == "/auth":
            length = int(self.headers.get("Content-Length", 0))
            try:
                data = json.loads(self.rfile.read(length))
            except json.JSONDecodeError:
                self.send_json(400, {"error": "Invalid JSON"})
                return
            token = data.get("token", "").strip()
            self.send_json(200, {"valid": token in VALID_TOKENS})
            return

        # ── /download — accepts both JSON and form-encoded ─────────────────
        if path != "/download":
            self.send_error(404)
            return

        length       = int(self.headers.get("Content-Length", 0))
        content_type = self.headers.get("Content-Type", "")
        raw_body     = self.rfile.read(length)

        if "application/json" in content_type:
            try:
                data = json.loads(raw_body)
            except json.JSONDecodeError:
                self.send_json(400, {"error": "Invalid JSON"})
                return
            url   = data.get("url",   "").strip()
            mode  = data.get("mode",  "").strip()
            token = data.get("token", "").strip()
        else:
            # form-encoded: url=...&mode=...&token=...
            params = parse_qs(raw_body.decode("utf-8", errors="replace"))
            url    = params.get("url",   [""])[0].strip()
            mode   = params.get("mode",  [""])[0].strip()
            token  = params.get("token", [""])[0].strip()

        if token not in VALID_TOKENS:
            self.send_json(401, {"error": "Unauthorized"})
            return
        if not url:
            self.send_json(400, {"error": "No URL provided"})
            return
        if mode not in ("mp4", "mp3_full", "mp3_simple"):
            self.send_json(400, {"error": "Invalid mode"})
            return

        with tempfile.TemporaryDirectory() as tmpdir:
            try:
                playlist = is_playlist(url)
                if playlist:
                    if mode == "mp4":
                        file_path, filename = do_playlist_mp4(url, tmpdir)
                    elif mode == "mp3_full":
                        file_path, filename = do_playlist_mp3_full(url, tmpdir)
                    else:
                        file_path, filename = do_playlist_mp3_simple(url, tmpdir)
                else:
                    if mode == "mp4":
                        file_path, filename = do_mp4(url, tmpdir)
                    elif mode == "mp3_full":
                        file_path, filename = do_mp3_full(url, tmpdir)
                    else:
                        file_path, filename = do_mp3_simple(url, tmpdir)

                ext = os.path.splitext(filename)[1].lower()
                mime = {
                    ".mp3": "audio/mpeg",
                    ".mp4": "video/mp4",
                    ".zip": "application/zip",
                }.get(ext, "application/octet-stream")
                file_size    = os.path.getsize(file_path)
                ascii_name   = filename.encode("ascii", "replace").decode("ascii").replace("?", "_")
                rfc5987_name = quote(filename, safe="!#$&+-.^_`|~")

                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(file_size))
                self.send_header(
                    "Content-Disposition",
                    f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{rfc5987_name}'
                )
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()

                with open(file_path, "rb") as f:
                    while True:
                        chunk = f.read(65536)
                        if not chunk:
                            break
                        self.wfile.write(chunk)

            except Exception as e:
                print(f"  ERROR: {e}")
                try:
                    self.send_json(500, {"error": str(e)})
                except Exception:
                    pass


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    PORT = 8765
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"  Hermes running  ->  http://localhost:{PORT}")
    print("  Ctrl+C to stop\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")
