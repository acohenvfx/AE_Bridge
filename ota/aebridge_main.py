"""PyInstaller entry point for the AEBridge helper.

`service/app.py` cannot be the entry script directly: AEBridge's service is a
PACKAGE and uses relative imports (`from .config import settings`), which fail
when a module is run as a top-level script. DifferenceEngine's helper gets away
with pointing PyInstaller straight at its app.py because its service modules are
flat and import each other absolutely.

So the frozen app starts here instead, importing `service` as a package.
"""
from service.app import main

if __name__ == "__main__":
    main()
