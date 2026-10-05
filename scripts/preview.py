"""Serve the current worktree for local Wi-Fi previews."""

import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent.parent


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        request_path = unquote(urlsplit(self.path).path).replace("\\", "/")
        # Keep repository metadata and local agent settings off the network.
        if any(part.startswith(".") for part in request_path.split("/") if part):
            self.send_error(404)
            return None
        if request_path == "/":
            self.path = "/duckpeon_latest.html"
        resolved = Path(self.translate_path(self.path)).resolve()
        if not resolved.is_relative_to(ROOT):
            self.send_error(404)
            return None
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404)
        return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()
    with ThreadingHTTPServer((args.bind, args.port), PreviewHandler) as server:
        print(f"Serving Duckpeon on {args.bind}:{args.port} from {ROOT}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
