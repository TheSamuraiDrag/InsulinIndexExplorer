#!/usr/bin/env python3
"""Change the Admin page username and password.

Usage:  python3 scripts/set_admin_login.py            (asks for both)
        python3 scripts/set_admin_login.py numed      (asks for the password)

Only a hash of "username + password" is stored in assets/js/admin.js, so the password isn't
written in the code. Commit and push the change; everyone then signs in with the new login.
Pick a password that isn't easy to guess: this login is a light lock on a site with no server.
"""
import getpass
import hashlib
import re
import sys
from pathlib import Path

ADMIN_JS = Path(__file__).resolve().parent.parent / "assets" / "js" / "admin.js"


def main():
    user = (sys.argv[1] if len(sys.argv) > 1 else input("Username: ")).strip().lower()
    password = getpass.getpass("New password: ")
    if not user or not password:
        sys.exit("Username and password can't be empty.")
    if getpass.getpass("Repeat password: ") != password:
        sys.exit("The passwords don't match. Nothing was changed.")
    digest = hashlib.sha256(f"insulin-index-admin|{user}|{password}".encode()).hexdigest()
    src = ADMIN_JS.read_text(encoding="utf-8")
    new, n = re.subn(r"const LOGIN_HASH = '[0-9a-f]{64}';", f"const LOGIN_HASH = '{digest}';", src)
    if n != 1:
        sys.exit("Couldn't find LOGIN_HASH in assets/js/admin.js. Nothing was changed.")
    ADMIN_JS.write_text(new, encoding="utf-8")
    print(f"Login updated for username '{user}'. Commit and push assets/js/admin.js to apply it.")


if __name__ == "__main__":
    main()
