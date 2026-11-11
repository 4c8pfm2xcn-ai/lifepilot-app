#!/usr/bin/env python3
"""Builds GetawayCity.rbxlx from src/ so you can open it straight in Roblox Studio.

Usage:  python3 tools/build_place.py            (writes GetawayCity.rbxlx)
Mirrors default.project.json (same layout Rojo would produce).
"""
import os
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ref = [0]


def ref():
    _ref[0] += 1
    return "RBX%08X" % _ref[0]


def cdata(text):
    return "<![CDATA[" + text.replace("]]>", "]]]]><![CDATA[>") + "]]>"


def item(cls, name, children=(), source=None):
    props = '<string name="Name">%s</string>' % escape(name)
    if source is not None:
        props += '<ProtectedString name="Source">%s</ProtectedString>' % cdata(source)
    return '<Item class="%s" referent="%s"><Properties>%s</Properties>%s</Item>' % (
        cls, ref(), props, "".join(children))


def from_dir(path, name):
    """Folder -> Folder; *.server.lua -> Script; *.client.lua -> LocalScript; *.lua -> ModuleScript."""
    children = []
    for entry in sorted(os.listdir(path)):
        full = os.path.join(path, entry)
        if os.path.isdir(full):
            children.append(from_dir(full, entry))
            continue
        with open(full, encoding="utf-8") as f:
            src = f.read()
        if entry.endswith(".server.lua"):
            children.append(item("Script", entry[:-len(".server.lua")], source=src))
        elif entry.endswith(".client.lua"):
            children.append(item("LocalScript", entry[:-len(".client.lua")], source=src))
        elif entry.endswith(".lua"):
            children.append(item("ModuleScript", entry[:-len(".lua")], source=src))
    return item("Folder", name, children)


def main():
    src = os.path.join(ROOT, "src")
    tree = [
        item("Workspace", "Workspace"),
        item("ReplicatedStorage", "ReplicatedStorage", [from_dir(os.path.join(src, "shared"), "Shared")]),
        item("ServerScriptService", "ServerScriptService", [from_dir(os.path.join(src, "server"), "Server")]),
        item("StarterPlayer", "StarterPlayer", [
            item("StarterPlayerScripts", "StarterPlayerScripts", [from_dir(os.path.join(src, "client"), "Client")]),
        ]),
    ]
    xml = ('<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" '
           'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
           'xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">'
           + "".join(tree) + "</roblox>\n")
    out = os.path.join(ROOT, "GetawayCity.rbxlx")
    with open(out, "w", encoding="utf-8") as f:
        f.write(xml)
    print("Wrote", out)


if __name__ == "__main__":
    main()
