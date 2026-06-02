#!/usr/bin/env python3
# Быстрая выдача премиум-доступа через Termux/терминал с автоматическим git push.
# Примеры:
#   python activate.py 6543349748 --days 30
#   python activate.py 6543349748 --forever
#   python activate.py 6543349748 --days 30 --fp 45A2C438 --name Ali
#   python activate.py 6543349748 --days 30 --no-push

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PREMIUM_FILE = ROOT / "premium_users.json"
DEVICE_FILE = ROOT / "device_locks.json"


def run(cmd: list[str], *, cwd: Path = ROOT, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=str(cwd), text=True, capture_output=True, check=check)


def clean_id(value: str) -> str:
    return "".join(ch for ch in str(value) if ch.isdigit())


def now_text() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def today_plus(days: int) -> str:
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")


def load_json(path: Path, fallback: dict) -> dict:
    if not path.exists():
        return json.loads(json.dumps(fallback, ensure_ascii=False))
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else json.loads(json.dumps(fallback, ensure_ascii=False))
    except Exception as exc:
        raise SystemExit(f"❌ Не могу прочитать {path.name}: {exc}")


def save_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def ensure_git_repo() -> None:
    result = run(["git", "rev-parse", "--is-inside-work-tree"], check=False)
    if result.returncode != 0 or result.stdout.strip() != "true":
        raise SystemExit(
            "❌ Эта папка не является git-репозиторием.\n"
            "Открой папку сайта, которую ты склонировал с GitHub:\n"
            "  cd macro\n"
            "И снова запусти команду активации."
        )


def git_has_remote() -> bool:
    result = run(["git", "remote"], check=False)
    return bool(result.stdout.strip())


def git_current_branch() -> str:
    result = run(["git", "branch", "--show-current"], check=False)
    branch = result.stdout.strip()
    return branch or "main"


def git_commit_and_push(files: list[str], message: str, push: bool, branch: str | None) -> None:
    ensure_git_repo()

    run(["git", "add", *files])

    status = run(["git", "status", "--porcelain", "--", *files], check=False).stdout.strip()
    if not status:
        print("ℹ️ Изменений в JSON нет, commit не нужен.")
        return

    commit = run(["git", "commit", "-m", message], check=False)
    if commit.returncode != 0:
        # Частая ситуация: git user.name/user.email не настроены.
        print(commit.stdout.strip())
        print(commit.stderr.strip())
        raise SystemExit(
            "❌ Git commit не получился. Проверь настройки Git:\n"
            "  git config --global user.name \"Nurislombek\"\n"
            "  git config --global user.email \"nurislombek006@gmail.com\""
        )

    print("✅ Git commit создан")

    if not push:
        print("ℹ️ --no-push включён, поэтому на GitHub не отправляю.")
        return

    if not git_has_remote():
        raise SystemExit(
            "❌ У репозитория нет remote GitHub. Добавь remote или склонируй сайт через git clone."
        )

    target_branch = branch or git_current_branch()
    pushed = run(["git", "push", "origin", target_branch], check=False)
    if pushed.returncode != 0:
        print(pushed.stdout.strip())
        print(pushed.stderr.strip())
        raise SystemExit(
            "❌ Git push не получился. Возможно, нужно войти в GitHub или указать правильный branch.\n"
            "Пример:\n"
            "  git push origin main"
        )

    print(f"✅ Отправлено на GitHub: origin/{target_branch}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Выдать или продлить премиум через Telegram ID и автоматически сделать git push")
    parser.add_argument("user_id", help="Telegram ID пользователя, например 6543349748")
    parser.add_argument("--days", type=int, default=30, help="Срок в днях. По умолчанию 30")
    parser.add_argument("--forever", action="store_true", help="Бессрочный премиум")
    parser.add_argument("--fp", "--fingerprint", dest="fingerprint", default="", help="Fingerprint устройства, если нужно привязать к одному устройству")
    parser.add_argument("--name", default="", help="Заметка/имя клиента")
    parser.add_argument("--no-push", action="store_true", help="Только изменить JSON, без git commit/push")
    parser.add_argument("--branch", default="", help="Branch для push. Если не указать, используется текущий branch")
    parser.add_argument("--message", default="", help="Свой текст commit")
    args = parser.parse_args()

    uid = clean_id(args.user_id)
    if not uid:
        raise SystemExit("❌ Telegram ID должен содержать цифры")
    if args.days <= 0 and not args.forever:
        raise SystemExit("❌ --days должен быть больше 0. Для бессрочного доступа используй --forever")

    expires = "" if args.forever else today_plus(args.days)
    fingerprint = args.fingerprint.strip().upper()

    record = {
        "active": True,
        "uid": uid,
        "user_id": uid,
        "created": now_text(),
        "expires": expires,
        "note": args.name or "Выдано через activate.py",
    }
    if fingerprint:
        record["fingerprint"] = fingerprint

    premium = load_json(PREMIUM_FILE, {"users": {}})
    premium.setdefault("users", {})
    premium["users"][uid] = record
    save_json(PREMIUM_FILE, premium)

    changed_files = ["premium_users.json"]

    if fingerprint:
        locks = load_json(DEVICE_FILE, {"locks": {}, "users": {}})
        locks.setdefault("locks", {})
        locks.setdefault("users", {})
        locks["users"][uid] = {"fingerprint": fingerprint, "updated": now_text()}
        locks["locks"][uid] = fingerprint
        save_json(DEVICE_FILE, locks)
        changed_files.append("device_locks.json")

    print("✅ Премиум обновлён")
    print(f"Telegram ID: {uid}")
    print(f"Срок: {expires or 'бессрочно'}")
    print(f"Устройство: {fingerprint or 'не привязано'}")

    commit_message = args.message or f"Activate premium for {uid}"
    git_commit_and_push(changed_files, commit_message, push=not args.no_push, branch=args.branch or None)

    print("\nГотово. После обновления сайта у клиента будет статус: Премиум пользователь.")


if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError as exc:
        if exc.filename == "git":
            raise SystemExit("❌ Git не установлен. В Termux выполни: pkg install git python -y")
        raise
    except subprocess.CalledProcessError as exc:
        print(exc.stdout or "")
        print(exc.stderr or "", file=sys.stderr)
        raise SystemExit(f"❌ Команда не выполнена: {' '.join(exc.cmd)}")
