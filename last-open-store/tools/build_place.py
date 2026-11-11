#!/usr/bin/env python3
"""Builds TheLastOpenStore.rbxlx from default.project.json + src/ (same layout Rojo produces).

    python3 tools/build_place.py

Supports the Rojo conventions this project uses:
  *.server.lua -> Script, *.client.lua -> LocalScript, *.lua -> ModuleScript,
  folders -> Folder, or the class/properties in a folder's init.meta.json.
"""
import json
import os
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ref = [0]


def ref():
    _ref[0] += 1
    return "RBX%08X" % _ref[0]


def cdata(text):
    return "<![CDATA[" + text.replace("]]>", "]]]]><![CDATA[>") + "]]>"


def prop_xml(name, value):
    if isinstance(value, bool):
        return '<bool name="%s">%s</bool>' % (name, "true" if value else "false")
    if isinstance(value, (int, float)):
        return '<float name="%s">%s</float>' % (name, value)
    return '<string name="%s">%s</string>' % (name, escape(str(value)))


def item(cls, name, children=(), source=None, props=None):
    p = prop_xml("Name", name)
    for k, v in (props or {}).items():
        p += prop_xml(k, v)
    if source is not None:
        p += '<ProtectedString name="Source">%s</ProtectedString>' % cdata(source)
    return '<Item class="%s" referent="%s"><Properties>%s</Properties>%s</Item>' % (
        cls, ref(), p, "".join(children))


def from_dir(path, name):
    cls, props = "Folder", {}
    meta = os.path.join(path, "init.meta.json")
    if os.path.exists(meta):
        with open(meta, encoding="utf-8") as f:
            m = json.load(f)
        cls = m.get("className", cls)
        props = m.get("properties", {})
    children = []
    for entry in sorted(os.listdir(path)):
        full = os.path.join(path, entry)
        if os.path.isdir(full):
            children.append(from_dir(full, entry))
            continue
        if entry.endswith(".json"):
            continue
        with open(full, encoding="utf-8") as f:
            src = f.read()
        if entry.endswith(".server.lua"):
            children.append(item("Script", entry[:-11], source=src))
        elif entry.endswith(".client.lua"):
            children.append(item("LocalScript", entry[:-11], source=src))
        elif entry.endswith(".lua"):
            children.append(item("ModuleScript", entry[:-4], source=src))
    return item(cls, name, children, props=props)


def from_node(name, node):
    if "$path" in node:
        return from_dir(os.path.join(ROOT, node["$path"]), name)
    cls = node.get("$className", name)
    children = [from_node(k, v) for k, v in node.items() if not k.startswith("$")]
    return item(cls, name, children)


def main():
    with open(os.path.join(ROOT, "default.project.json"), encoding="utf-8") as f:
        project = json.load(f)
    tree = project["tree"]
    services = [item("Workspace", "Workspace")]
    services += [from_node(k, v) for k, v in tree.items() if not k.startswith("$")]
    xml = ('<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" '
           'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
           'xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">'
           + "".join(services) + "</roblox>\n")
    out = os.path.join(ROOT, "TheLastOpenStore.rbxlx")
    with open(out, "w", encoding="utf-8") as f:
        f.write(xml)
    print("Wrote", out)


if __name__ == "__main__":
    main()
