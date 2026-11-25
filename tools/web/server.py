#!/usr/bin/env python3
"""Web local del repo Networking.

Sirve los .md y los archivos de código del repo, y permite tildar los
checkboxes (`- [ ]` / `- [x]`) escribiendo el cambio directo en el .md.
Solo usa la librería estándar de Python.

Uso:  python tools/web/server.py [--port 7730] [--no-open]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import threading
import unicodedata
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[2]
STATIC = Path(__file__).resolve().parent / "static"

EXCLUDED_DIRS = {".git", ".claude", ".vscode", "target", "capturas", "node_modules", "tools"}
MD_EXT = {".md"}
CODE_EXT = {
    ".rs": "rust", ".py": "python", ".sh": "bash", ".yml": "yaml",
    ".yaml": "yaml", ".cpp": "cpp", ".hpp": "cpp", ".h": "cpp", ".c": "c",
    ".json": "json", ".txt": "plaintext",
}
GROUP_NAMES = {"": "General", "codigo": "Código", "referencia": "Referencia", "notas": "Notas"}

TASK_RE = re.compile(r"^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\](?:\s|$))")
FENCE_RE = re.compile(r"^\s*(`{3,}|~{3,})")
H1_RE = re.compile(r"^#\s+(.+?)\s*#*\s*$")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")

STATIC_TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml"}

write_lock = threading.Lock()


# ---------------------------------------------------------------- archivos

def iter_files():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = sorted(d for d in dirnames if d not in EXCLUDED_DIRS and not d.startswith("."))
        for name in filenames:
            p = Path(dirpath) / name
            ext = p.suffix.lower()
            if ext in MD_EXT or ext in CODE_EXT:
                yield p


def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


def safe_path(relpath: str | None, *, md_only: bool = False) -> Path | None:
    if not relpath:
        return None
    p = (ROOT / relpath).resolve()
    try:
        parts = p.relative_to(ROOT).parts
    except ValueError:
        return None
    if any(part in EXCLUDED_DIRS or part.startswith(".") for part in parts[:-1]):
        return None
    ext = p.suffix.lower()
    if md_only and ext not in MD_EXT:
        return None
    if ext not in MD_EXT and ext not in CODE_EXT:
        return None
    return p if p.is_file() else None


def read_text(p: Path) -> str:
    with open(p, encoding="utf-8", newline="") as f:
        return f.read()


def task_lines(lines: list[str]) -> dict[int, bool]:
    """Líneas (0-based) que son checkboxes fuera de bloques de código -> si están tildadas."""
    out: dict[int, bool] = {}
    fence = None
    for i, line in enumerate(lines):
        m = FENCE_RE.match(line)
        if m:
            mark = m.group(1)[0]
            if fence is None:
                fence = mark
            elif fence == mark:
                fence = None
            continue
        if fence is None:
            t = TASK_RE.match(line)
            if t:
                out[i] = t.group(2) in "xX"
    return out


def md_info(p: Path) -> dict:
    text = read_text(p)
    lines = text.splitlines()
    title = None
    for line in lines:
        m = H1_RE.match(line)
        if m:
            title = m.group(1)
            break
    tasks = task_lines(lines)
    pending = None
    heading = None
    for i, line in enumerate(lines):
        h = HEADING_RE.match(line)
        if h and len(h.group(1)) >= 2:
            heading = h.group(2)
        if i in tasks and not tasks[i]:
            pending = {"line": i, "text": TASK_RE.sub("", line).strip(), "section": heading}
            break
    return {"title": title or p.stem, "done": sum(tasks.values()), "total": len(tasks), "next": pending}


def group_of(relpath: str) -> str:
    return relpath.split("/")[0] if "/" in relpath else ""


def group_label(key: str) -> str:
    if key in GROUP_NAMES:
        return GROUP_NAMES[key]
    m = re.match(r"^(\d+)-(.+)$", key)
    if m:
        name = m.group(2).replace("-", " ")
        return f"{m.group(1)} · {name[:1].upper()}{name[1:]}"
    return key.replace("-", " ").capitalize()


def sort_key(relpath: str):
    parts = relpath.split("/")
    name = parts[-1].lower()
    is_md = name.endswith(".md")
    return (0 if name == "readme.md" else 1 if is_md else 2, relpath.lower())


def group_order(key: str):
    if key == "":
        return (0, "")
    if re.match(r"^\d", key):
        return (1, key)
    order = {"codigo": 2, "referencia": 3, "notas": 4}
    return (order.get(key, 5), key)


def build_tree() -> dict:
    groups: dict[str, list] = {}
    for p in iter_files():
        r = rel(p)
        entry = {"path": r, "kind": "md" if p.suffix.lower() in MD_EXT else "code", "mtime": p.stat().st_mtime}
        if entry["kind"] == "md":
            entry.update(md_info(p))
        else:
            entry["title"] = "/".join(r.split("/")[1:]) or r
            entry["lang"] = CODE_EXT[p.suffix.lower()]
        groups.setdefault(group_of(r), []).append(entry)
    out = []
    for key in sorted(groups, key=group_order):
        files = sorted(groups[key], key=lambda e: sort_key(e["path"]))
        out.append({
            "key": key,
            "label": group_label(key),
            "phase": bool(re.match(r"^\d", key)) or key == "codigo",
            "done": sum(f.get("done", 0) for f in files),
            "total": sum(f.get("total", 0) for f in files),
            "files": files,
        })
    return {"root": ROOT.as_posix(), "name": ROOT.name, "groups": out, "version": version()}


def version() -> float:
    v = 0.0
    for p in iter_files():
        v = max(v, p.stat().st_mtime)
    return v


def fold(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")


def search(q: str) -> list[dict]:
    q = q.strip()
    if len(q) < 2:
        return []
    fq = fold(q)
    results = []
    for p in iter_files():
        r = rel(p)
        try:
            lines = read_text(p).splitlines()
        except (OSError, UnicodeDecodeError):
            continue
        heading = None
        title = None
        for i, line in enumerate(lines):
            h = HEADING_RE.match(line) if p.suffix.lower() in MD_EXT else None
            if h:
                heading = h.group(2)
                if title is None and len(h.group(1)) == 1:
                    title = h.group(2)
            if fq in fold(line):
                results.append({"path": r, "title": title or r, "section": heading,
                                "line": i, "text": line.strip()[:200]})
                if len(results) >= 60:
                    return results
    return results


def toggle(relpath: str, line: int, checked: bool, original: str) -> dict:
    p = safe_path(relpath, md_only=True)
    if p is None:
        raise LookupError("archivo no encontrado")
    with write_lock:
        text = read_text(p)
        lines = text.splitlines(keepends=True)
        if not 0 <= line < len(lines):
            raise ValueError("línea fuera de rango")
        current = lines[line].rstrip("\r\n")
        if current != original.rstrip("\r\n"):
            raise ValueError("el archivo cambió")
        if line not in task_lines([l.rstrip("\r\n") for l in lines]):
            raise ValueError("esa línea no es un checkbox")
        ending = lines[line][len(current):]
        new = TASK_RE.sub(lambda m: m.group(1) + ("x" if checked else " ") + m.group(3), current, count=1)
        lines[line] = new + ending
        fd, tmp = tempfile.mkstemp(dir=p.parent, prefix=".tmp-", suffix=".md")
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
                f.write("".join(lines))
            os.replace(tmp, p)
        except BaseException:
            if os.path.exists(tmp):
                os.unlink(tmp)
            raise
    info = md_info(p)
    return {"ok": True, "line": new, "file": info, "mtime": p.stat().st_mtime, "version": version()}


# ---------------------------------------------------------------- HTTP

class Handler(BaseHTTPRequestHandler):
    server_version = "NetworkingWeb/1.0"

    def log_message(self, *args):  # silencioso
        pass

    def _host_ok(self) -> bool:
        host = (self.headers.get("Host") or "").split(":")[0]
        return host in {"127.0.0.1", "localhost"}

    def _send(self, code: int, body: bytes, ctype: str):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, data):
        self._send(code, json.dumps(data, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def do_GET(self):
        if not self._host_ok():
            return self._json(403, {"error": "host no permitido"})
        url = urlparse(self.path)
        qs = parse_qs(url.query)
        try:
            if url.path == "/api/tree":
                return self._json(200, build_tree())
            if url.path == "/api/version":
                return self._json(200, {"version": version()})
            if url.path == "/api/file":
                p = safe_path(qs.get("path", [None])[0])
                if p is None:
                    return self._json(404, {"error": "archivo no encontrado"})
                ext = p.suffix.lower()
                return self._json(200, {
                    "path": rel(p), "content": read_text(p), "mtime": p.stat().st_mtime,
                    "kind": "md" if ext in MD_EXT else "code", "lang": CODE_EXT.get(ext),
                })
            if url.path == "/api/search":
                return self._json(200, {"results": search(qs.get("q", [""])[0])})
            return self._static(url.path)
        except Exception as e:  # noqa: BLE001
            return self._json(500, {"error": str(e)})

    def do_POST(self):
        if not self._host_ok():
            return self._json(403, {"error": "host no permitido"})
        if not (self.headers.get("Content-Type") or "").startswith("application/json"):
            return self._json(415, {"error": "se espera JSON"})
        url = urlparse(self.path)
        if url.path != "/api/toggle":
            return self._json(404, {"error": "no existe"})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            data = json.loads(self.rfile.read(min(length, 100_000)) or b"{}")
            res = toggle(str(data["path"]), int(data["line"]), bool(data["checked"]), str(data["original"]))
            return self._json(200, res)
        except LookupError as e:
            return self._json(404, {"error": str(e)})
        except (ValueError, KeyError, TypeError) as e:
            return self._json(409, {"error": str(e)})
        except Exception as e:  # noqa: BLE001
            return self._json(500, {"error": str(e)})

    def _static(self, path: str):
        name = "index.html" if path in ("", "/") else path.lstrip("/")
        p = (STATIC / name).resolve()
        if STATIC not in p.parents or not p.is_file() or p.suffix not in STATIC_TYPES:
            return self._json(404, {"error": "no existe"})
        return self._send(200, p.read_bytes(), STATIC_TYPES[p.suffix])


def main():
    ap = argparse.ArgumentParser(description="Web local del repo Networking")
    ap.add_argument("--port", type=int, default=7730)
    ap.add_argument("--no-open", action="store_true", help="no abrir el navegador")
    args = ap.parse_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass
    try:
        httpd = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    except OSError as e:
        print(f"No pude abrir el puerto {args.port}: {e}\nProbá con --port <otro>.")
        sys.exit(1)
    url = f"http://127.0.0.1:{args.port}/"
    print(f"Networking -> {url}   (Ctrl+C para cerrar)")
    if not args.no_open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nChau.")


if __name__ == "__main__":
    main()
