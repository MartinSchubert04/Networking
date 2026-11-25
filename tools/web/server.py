#!/usr/bin/env python3
"""Web local del repo Networking.

Sirve los .md y los archivos de código del repo, y permite tildar los
checkboxes (`- [ ]` / `- [x]`) escribiendo el cambio directo en el .md.
También guarda por dónde vas en los videos de YouTube (progreso/*.json).
Solo usa la librería estándar de Python.

Uso:  python tools/web/server.py [--port 7730] [--no-open]
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import tempfile
import threading
import unicodedata
import webbrowser
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
STATIC = Path(__file__).resolve().parent / "static"

EXCLUDED_DIRS = {".git", ".claude", ".vscode", "target", "capturas", "node_modules", "tools", "progreso"}
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


# ---------------------------------------------------------------- videos

# Todo lo de videos vive en progreso/ (fuera del árbol de la web):
#   listas.json  listas y videos en orden, con título y duración
#   videos.json  posición de cada video y "dónde quedé" (current)
#   README.md    resumen legible, se regenera en cada guardado
PROGRESS_DIR = ROOT / "progreso"
LISTS_FILE = PROGRESS_DIR / "listas.json"
VIDEOS_FILE = PROGRESS_DIR / "videos.json"
SUMMARY_FILE = PROGRESS_DIR / "README.md"

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
LIST_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11,64}$")
YT_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
            "youtu.be", "www.youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com"}
MAX_SECONDS = 24 * 3600
MAX_VIDEOS = 500
MAX_LISTS = 50
WATCHED_RATIO = 0.9
VIDEOS_ABOUT = ("Lo escribe tools/web/server.py. Posiciones y duraciones en segundos. "
                "current = dónde quedé (index empieza en 1). Títulos en listas.json; resumen en README.md.")

video_lock = threading.Lock()


class BadInput(ValueError):
    """Entrada inválida (400)."""


class Upstream(Exception):
    """YouTube no respondió o rechazó el pedido (502)."""


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def write_atomic(p: Path, text: str):
    p.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=p.parent, prefix=".tmp-", suffix=p.suffix)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
        os.replace(tmp, p)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def to_json(obj, depth: int = 0) -> str:
    """JSON con sangría, pero cada video / entrada de progreso en una sola línea (fácil de leer con cat)."""
    pad = "  " * depth
    flat = lambda v: not isinstance(v, (dict, list))  # noqa: E731
    if isinstance(obj, dict) and obj and not (depth >= 2 and all(flat(v) for v in obj.values())):
        items = [f"{pad}  {json.dumps(k, ensure_ascii=False)}: {to_json(v, depth + 1)}" for k, v in obj.items()]
        return "{\n" + ",\n".join(items) + f"\n{pad}}}"
    if isinstance(obj, list) and obj and not all(flat(v) for v in obj):
        return "[\n" + ",\n".join(f"{pad}  {to_json(v, depth + 1)}" for v in obj) + f"\n{pad}]"
    return json.dumps(obj, ensure_ascii=False)


def load_json(p: Path, default: dict) -> dict:
    try:
        with open(p, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else default
    except FileNotFoundError:
        return default


def load_lists() -> dict:
    data = load_json(LISTS_FILE, {"default": None, "lists": []})
    data.setdefault("lists", [])
    data.setdefault("default", None)
    return data


def load_videos() -> dict:
    data = load_json(VIDEOS_FILE, {})
    return {"about": VIDEOS_ABOUT, "current": data.get("current"), "progress": data.get("progress") or {}}


def find_list(lists: dict, list_id: str) -> dict | None:
    return next((l for l in lists["lists"] if l.get("id") == list_id), None)


def fmt_time(sec) -> str:
    sec = int(sec or 0)
    h, rest = divmod(sec, 3600)
    m, s = divmod(rest, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def list_stats(lst: dict, progress: dict) -> dict:
    seen = done_t = total_t = 0
    for v in lst["videos"]:
        p = progress.get(v["id"]) or {}
        dur = v.get("duration") or p.get("duration") or 0
        if p.get("watched"):
            seen += 1
        if dur:
            total_t += dur
            done_t += dur if p.get("watched") else min(p.get("position") or 0, dur)
    n = len(lst["videos"])
    pct = round(done_t * 100 / total_t) if total_t else (round(seen * 100 / n) if n else 0)
    return {"seen": seen, "count": n, "percent": pct}


def watch_url(video: str, list_id: str | None, position) -> str:
    q = {"v": video}
    if list_id and list_id != video:
        q["list"] = list_id
    if position and int(position) > 0:
        q["t"] = f"{int(position)}s"
    return "https://www.youtube.com/watch?" + urlencode(q)


def md_cell(s: str) -> str:
    return str(s).replace("|", "\\|").replace("\n", " ")


def summary_text(lists: dict, vstate: dict) -> str:
    progress = vstate["progress"]
    cur = vstate.get("current")
    out = ["# Progreso de videos", "",
           "Lo genera la web (`tools/web/server.py`) cada vez que guarda. No editarlo a mano: se pisa.",
           "Datos completos: `videos.json` (posición de cada video, en segundos) y `listas.json` (listas y títulos).", "",
           f"Actualizado: {datetime.now().strftime('%Y-%m-%d %H:%M')}", "", "## Dónde quedé", ""]
    lst = find_list(lists, cur["list"]) if cur else None
    if cur and lst:
        p = progress.get(cur["video"]) or {}
        dur = p.get("duration")
        title = cur.get("title") or cur["video"]
        de = f" de {fmt_time(dur)}" if dur else ""
        fin = " (terminado)" if p.get("watched") and dur and cur["position"] >= dur - 10 else ""
        out += [f"Lista \"{lst['title']}\": video {cur['index']}/{cur['total']} \"{title}\" a {fmt_time(cur['position'])}{de}{fin}.", "",
                f"Seguir en YouTube: {watch_url(cur['video'], lst['id'], cur['position'])}", ""]
    else:
        out += ["Todavía no empezaste ningún video.", ""]
    out += ["## Listas", "", "| Lista | Vistos | Avance (por tiempo) | Siguiente sin ver |", "|---|---|---|---|"]
    for l in lists["lists"]:
        st = list_stats(l, progress)
        nxt = next(((i, v) for i, v in enumerate(l["videos"], 1) if not (progress.get(v["id"]) or {}).get("watched")), None)
        nxt_txt = f"{nxt[0]}. {nxt[1].get('title') or nxt[1]['id']}" if nxt else "Todos vistos"
        out.append(f"| {md_cell(l['title'])} | {st['seen']}/{st['count']} | {st['percent']}% | {md_cell(nxt_txt)} |")
    started = []
    for l in lists["lists"]:
        for i, v in enumerate(l["videos"], 1):
            p = progress.get(v["id"]) or {}
            if p.get("position") and not p.get("watched"):
                dur = v.get("duration") or p.get("duration")
                started.append((p.get("updated") or "", f"- {l['title']} · {i}/{len(l['videos'])} "
                                f"\"{v.get('title') or v['id']}\": {fmt_time(p['position'])}"
                                f"{' de ' + fmt_time(dur) if dur else ''}"))
    if started:
        out += ["", "## Empezados sin terminar", ""] + [t for _, t in sorted(started, reverse=True)]
    return "\n".join(out) + "\n"


def write_video_files(lists: dict | None, vstate: dict | None):
    """Escribe lo que cambió y regenera el resumen. Llamar con video_lock tomado."""
    if lists is not None:
        write_atomic(LISTS_FILE, to_json(lists) + "\n")
    if vstate is not None:
        write_atomic(VIDEOS_FILE, to_json(vstate) + "\n")
    write_atomic(SUMMARY_FILE, summary_text(lists or load_lists(), vstate or load_videos()))


def videos_payload() -> dict:
    lists = load_lists()
    vstate = load_videos()
    return {"default": lists["default"], "lists": lists["lists"],
            "current": vstate["current"], "progress": vstate["progress"]}


def num(data: dict, key: str, *, required: bool = False):
    v = data.get(key)
    if v is None:
        if required:
            raise BadInput(f"falta {key}")
        return None
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or not 0 <= v <= MAX_SECONDS:
        raise BadInput(f"{key} inválido")
    return float(v)


def flag(data: dict, key: str):
    v = data.get(key)
    if v is not None and not isinstance(v, bool):
        raise BadInput(f"{key} tiene que ser true/false")
    return v


def ident(data: dict, key: str, rx: re.Pattern) -> str:
    v = data.get(key)
    if not isinstance(v, str) or not rx.match(v):
        raise BadInput(f"{key} inválido")
    return v


def save_progress(data: dict) -> dict:
    list_id = ident(data, "list", LIST_ID_RE)
    vid = ident(data, "video", VIDEO_ID_RE)
    position = num(data, "position")
    duration = num(data, "duration")
    ended = flag(data, "ended")
    watched_set = flag(data, "watched")
    make_current = flag(data, "current")
    if position is None and watched_set is None and not ended:
        raise BadInput("falta position")
    with video_lock:
        lists = load_lists()
        lst = find_list(lists, list_id)
        if lst is None:
            raise LookupError("esa lista no existe")
        idx = next((i for i, v in enumerate(lst["videos"]) if v["id"] == vid), None)
        if idx is None:
            raise LookupError("ese video no está en la lista")
        entry = lst["videos"][idx]
        lists_changed = False
        if duration and duration >= 1 and not entry.get("duration"):
            entry["duration"] = round(duration)
            lists_changed = True
        vstate = load_videos()
        prev = vstate["progress"].get(vid) or {}
        dur = round(duration) if duration and duration >= 1 else (entry.get("duration") or prev.get("duration"))
        if position is None:
            position = 0.0 if watched_set is False else float(prev.get("position") or 0)
        if dur:
            position = min(position, dur)
        watched = bool(prev.get("watched"))
        if ended or (dur and position >= WATCHED_RATIO * dur):
            watched = True
        if ended and dur:
            position = dur
        if watched_set is not None:
            watched = watched_set
        prog = {"position": int(position), "duration": dur, "watched": watched, "updated": now_iso()}
        vstate["progress"][vid] = prog
        if make_current is not False:
            vstate["current"] = {"list": list_id, "video": vid, "position": int(position), "index": idx + 1,
                                 "total": len(lst["videos"]), "title": entry.get("title"), "updated": prog["updated"]}
        write_video_files(lists if lists_changed else None, vstate)
    return {"ok": True, "video": vid, "progress": prog, "current": vstate["current"],
            "duration": entry.get("duration")}


def parse_youtube(url: str) -> tuple[str, str]:
    """('playlist', id) o ('video', id) a partir de un link de YouTube (o un id suelto)."""
    url = url.strip()
    if VIDEO_ID_RE.match(url):
        return "video", url
    if LIST_ID_RE.match(url) and url.startswith(("PL", "OL", "UU")):
        return "playlist", url
    if "://" not in url:
        url = "https://" + url
    u = urlparse(url)
    if u.scheme not in ("http", "https") or (u.hostname or "").lower() not in YT_HOSTS:
        raise BadInput("eso no parece un link de YouTube")
    qs = parse_qs(u.query)
    lst = (qs.get("list") or [""])[0]
    # Las listas RD... son "mixes" automáticos e infinitos: se toma solo el video.
    if LIST_ID_RE.match(lst) and not lst.startswith("RD"):
        return "playlist", lst
    vid = (qs.get("v") or [""])[0]
    parts = [p for p in u.path.split("/") if p]
    if not vid and parts:
        if (u.hostname or "").endswith("youtu.be"):
            vid = parts[0]
        elif len(parts) >= 2 and parts[0] in ("shorts", "embed", "live", "v"):
            vid = parts[1]
    if VIDEO_ID_RE.match(vid):
        return "video", vid
    raise BadInput("no encontré un video ni una lista en ese link")


def oembed(page_url: str) -> dict:
    req = Request("https://www.youtube.com/oembed?" + urlencode({"url": page_url, "format": "json"}),
                  headers={"User-Agent": "Mozilla/5.0 (local study app)"})
    try:
        with urlopen(req, timeout=8) as r:
            data = json.loads(r.read(200_000))
    except HTTPError as e:
        if e.code in (401, 403):
            raise Upstream("YouTube no deja insertar eso fuera de su página (o es privado)") from e
        if e.code in (400, 404):
            raise LookupError("YouTube no lo encontró (¿privado o borrado?)") from e
        raise Upstream(f"YouTube respondió {e.code}") from e
    except (URLError, TimeoutError, OSError) as e:
        raise Upstream("no pude hablar con YouTube (¿sin internet?)") from e
    return {"title": str(data.get("title") or "")[:300] or None, "channel": str(data.get("author_name") or "")[:120] or None}


def video_title(vid: str) -> str | None:
    try:
        return oembed(f"https://www.youtube.com/watch?v={vid}")["title"]
    except (LookupError, Upstream):
        return None


def add_list(data: dict) -> dict:
    url = data.get("url")
    if not isinstance(url, str) or not 0 < len(url) <= 500:
        raise BadInput("falta el link")
    kind, list_id = parse_youtube(url)
    lists = load_lists()
    if find_list(lists, list_id):
        raise ValueError("esa lista ya está agregada")
    if len(lists["lists"]) >= MAX_LISTS:
        raise BadInput(f"máximo {MAX_LISTS} listas")
    if kind == "video":
        meta = oembed(f"https://www.youtube.com/watch?v={list_id}")
        videos = [{"id": list_id, "title": meta["title"], "duration": None}]
        page = f"https://www.youtube.com/watch?v={list_id}"
    else:
        ids = data.get("videos")
        if ids is None:
            # El servidor no puede listar una playlist sin API key: la web saca los ids
            # con el reproductor de YouTube (getPlaylist) y vuelve a llamar con "videos".
            return {"ok": False, "resolve": "playlist", "id": list_id}
        if not isinstance(ids, list) or not 0 < len(ids) <= MAX_VIDEOS:
            raise BadInput(f"la lista tiene que tener entre 1 y {MAX_VIDEOS} videos")
        if not all(isinstance(v, str) and VIDEO_ID_RE.match(v) for v in ids):
            raise BadInput("hay un id de video inválido")
        ids = list(dict.fromkeys(ids))
        page = f"https://www.youtube.com/playlist?list={list_id}"
        meta = oembed(page)
        with ThreadPoolExecutor(max_workers=8) as ex:
            titles = list(ex.map(video_title, ids))
        videos = [{"id": v, "title": t, "duration": None} for v, t in zip(ids, titles)]
    new = {"id": list_id, "kind": kind, "title": meta["title"] or list_id, "channel": meta["channel"],
           "url": page, "added": now_iso(), "videos": videos}
    with video_lock:
        lists = load_lists()
        if find_list(lists, list_id):
            raise ValueError("esa lista ya está agregada")
        lists["lists"].append(new)
        if not lists["default"]:
            lists["default"] = list_id
        write_video_files(lists, load_videos())
    return {"ok": True, "list": new}


def remove_list(data: dict) -> dict:
    list_id = ident(data, "id", LIST_ID_RE)
    with video_lock:
        lists = load_lists()
        if find_list(lists, list_id) is None:
            raise LookupError("esa lista no existe")
        if list_id == lists["default"]:
            raise ValueError("la lista principal no se puede quitar")
        lists["lists"] = [l for l in lists["lists"] if l["id"] != list_id]
        vstate = load_videos()
        if vstate["current"] and vstate["current"].get("list") == list_id:
            vstate["current"] = None
        # El progreso de cada video queda guardado: si la volvés a agregar, sigue donde estaba.
        write_video_files(lists, vstate)
    return {"ok": True}


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
            if url.path == "/api/videos":
                return self._json(200, videos_payload())
            return self._static(url.path)
        except Exception as e:  # noqa: BLE001
            return self._json(500, {"error": str(e)})

    def do_POST(self):
        if not self._host_ok():
            return self._json(403, {"error": "host no permitido"})
        if not (self.headers.get("Content-Type") or "").startswith("application/json"):
            return self._json(415, {"error": "se espera JSON"})
        url = urlparse(self.path)
        routes = {"/api/toggle": None, "/api/videos/progress": save_progress,
                  "/api/videos/lists": add_list, "/api/videos/lists/remove": remove_list}
        if url.path not in routes:
            return self._json(404, {"error": "no existe"})
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length > 100_000:
                return self._json(413, {"error": "pedido muy grande"})
            data = json.loads(self.rfile.read(length) or b"{}")
            if url.path == "/api/toggle":
                res = toggle(str(data["path"]), int(data["line"]), bool(data["checked"]), str(data["original"]))
                return self._json(200, res)
            if not isinstance(data, dict):
                raise BadInput("se espera un objeto JSON")
            return self._json(200, routes[url.path](data))
        except BadInput as e:
            return self._json(400, {"error": str(e)})
        except json.JSONDecodeError:
            return self._json(400, {"error": "JSON inválido"})
        except LookupError as e:
            return self._json(404, {"error": str(e)})
        except Upstream as e:
            return self._json(502, {"error": str(e)})
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
