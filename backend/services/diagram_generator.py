"""
Generates small graph/tree structures for Data Structures-style exam
questions, computes their CORRECT traversal answers using real algorithms
(not AI guessing — graph traversal is exactly the kind of thing LLMs get
subtly wrong), and renders them using reportlab's native drawing shapes.
No matplotlib/networkx/cairosvg — those are heavy, sometimes painful to
install on Windows, and totally unnecessary for circles-and-lines diagrams.
"""
import random
import math
import json
from reportlab.graphics.shapes import Drawing, Circle, Line, String
from reportlab.lib import colors

NODE_LETTERS = list("ABCDEFGHIJ")


# ---------- Graph generation ----------
def generate_graph(num_nodes=6, extra_edges=2, weighted=True, seed=None):
    """Builds a connected, undirected graph: a random spanning tree (so it's
    guaranteed connected) plus a few extra random edges for cycles."""
    rng = random.Random(seed)
    nodes = NODE_LETTERS[:num_nodes]
    edges = []

    # Spanning tree: connect each new node to a random earlier one
    for i in range(1, num_nodes):
        j = rng.randint(0, i - 1)
        w = rng.randint(1, 9) if weighted else None
        edges.append((nodes[j], nodes[i], w))

    # A few extra edges for cycles, avoiding duplicates
    existing = {frozenset((a, b)) for a, b, _ in edges}
    attempts = 0
    while len(existing) < num_nodes - 1 + extra_edges and attempts < 30:
        a, b = rng.sample(nodes, 2)
        key = frozenset((a, b))
        if key not in existing:
            w = rng.randint(1, 9) if weighted else None
            edges.append((a, b, w))
            existing.add(key)
        attempts += 1

    return nodes, edges


def _adjacency(nodes, edges):
    adj = {n: [] for n in nodes}
    for a, b, w in edges:
        adj[a].append(b)
        adj[b].append(a)
    for n in adj:
        adj[n].sort()  # deterministic traversal order
    return adj


def compute_dfs(nodes, edges, start):
    adj = _adjacency(nodes, edges)
    visited, order = set(), []

    def visit(n):
        visited.add(n)
        order.append(n)
        for neighbor in adj[n]:
            if neighbor not in visited:
                visit(neighbor)

    visit(start)
    return order


def compute_bfs(nodes, edges, start):
    adj = _adjacency(nodes, edges)
    visited, order, queue = {start}, [], [start]
    while queue:
        n = queue.pop(0)
        order.append(n)
        for neighbor in adj[n]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    return order


def draw_graph(nodes, edges, width=340, height=260):
    """Circular layout — simple, always readable, needs no layout library."""
    d = Drawing(width, height)
    cx, cy, r = width / 2, height / 2, min(width, height) / 2 - 40
    positions = {}
    for i, n in enumerate(nodes):
        angle = 2 * math.pi * i / len(nodes) - math.pi / 2
        positions[n] = (cx + r * math.cos(angle), cy + r * math.sin(angle))

    for a, b, w in edges:
        x1, y1 = positions[a]
        x2, y2 = positions[b]
        d.add(Line(x1, y1, x2, y2, strokeColor=colors.HexColor("#94a3b8"), strokeWidth=1.2))
        if w is not None:
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            d.add(String(mx, my, str(w), fontSize=8, fillColor=colors.HexColor("#7c3aed")))

    for n in nodes:
        x, y = positions[n]
        d.add(Circle(x, y, 14, fillColor=colors.HexColor("#ede9fe"), strokeColor=colors.HexColor("#7c3aed")))
        d.add(String(x - 4, y - 4, n, fontSize=10, fillColor=colors.HexColor("#4c1d95")))
    return d


# ---------- Binary tree generation ----------
def generate_binary_tree(num_nodes=7, seed=None):
    """Returns a tree as {label, left, right} (right/left may be None), built
    by inserting random-order labels into a BST so it's a genuine tree."""
    rng = random.Random(seed)
    labels = NODE_LETTERS[:num_nodes]
    order = labels[:]
    rng.shuffle(order)

    root = None
    def insert(node, label):
        if node is None:
            return {"label": label, "left": None, "right": None}
        if label < node["label"]:
            node["left"] = insert(node["left"], label)
        else:
            node["right"] = insert(node["right"], label)
        return node

    for label in order:
        root = insert(root, label)
    return root


def compute_inorder(tree):
    if tree is None:
        return []
    return compute_inorder(tree["left"]) + [tree["label"]] + compute_inorder(tree["right"])


def compute_preorder(tree):
    if tree is None:
        return []
    return [tree["label"]] + compute_preorder(tree["left"]) + compute_preorder(tree["right"])


def compute_postorder(tree):
    if tree is None:
        return []
    return compute_postorder(tree["left"]) + compute_postorder(tree["right"]) + [tree["label"]]


def draw_tree(tree, width=340, height=220):
    d = Drawing(width, height)

    def depth(node):
        if node is None:
            return 0
        return 1 + max(depth(node["left"]), depth(node["right"]))

    max_depth = max(depth(tree), 1)
    level_height = (height - 40) / max_depth

    def place(node, x_min, x_max, level):
        if node is None:
            return
        x = (x_min + x_max) / 2
        y = height - 30 - level * level_height
        node["_pos"] = (x, y)
        place(node["left"], x_min, x, level + 1)
        place(node["right"], x, x_max, level + 1)

    place(tree, 20, width - 20, 0)

    def draw_edges(node):
        if node is None:
            return
        x, y = node["_pos"]
        for child in (node["left"], node["right"]):
            if child is not None:
                cx, cy = child["_pos"]
                d.add(Line(x, y, cx, cy, strokeColor=colors.HexColor("#94a3b8"), strokeWidth=1.2))
                draw_edges(child)

    def draw_nodes(node):
        if node is None:
            return
        x, y = node["_pos"]
        d.add(Circle(x, y, 13, fillColor=colors.HexColor("#ede9fe"), strokeColor=colors.HexColor("#7c3aed")))
        d.add(String(x - 4, y - 4, node["label"], fontSize=10, fillColor=colors.HexColor("#4c1d95")))
        draw_nodes(node["left"])
        draw_nodes(node["right"])

    draw_edges(tree)
    draw_nodes(tree)
    return d


# ---------- High-level: build a full diagram question ----------
QUESTION_TEMPLATES = {
    "graph_dfs": "Given the graph below, perform a Depth-First Search (DFS) traversal starting from node {start}. Write the sequence of visited nodes.",
    "graph_bfs": "Given the graph below, perform a Breadth-First Search (BFS) traversal starting from node {start}. Write the sequence of visited nodes.",
    "tree_inorder": "Given the binary tree below, write its In-order traversal sequence.",
    "tree_preorder": "Given the binary tree below, write its Pre-order traversal sequence.",
    "tree_postorder": "Given the binary tree below, write its Post-order traversal sequence.",
}


def build_diagram_question(diagram_type: str, num_nodes: int = 6):
    """Returns (question_text, answer_text, diagram_data_dict) — diagram_data
    is JSON-serializable and enough to redraw the exact same diagram later."""
    if diagram_type in ("graph_dfs", "graph_bfs"):
        nodes, edges = generate_graph(num_nodes=num_nodes)
        start = nodes[0]
        order = compute_dfs(nodes, edges, start) if diagram_type == "graph_dfs" else compute_bfs(nodes, edges, start)
        question = QUESTION_TEMPLATES[diagram_type].format(start=start)
        answer = " → ".join(order)
        data = {"kind": "graph", "nodes": nodes, "edges": edges}
        return question, answer, data

    if diagram_type in ("tree_inorder", "tree_preorder", "tree_postorder"):
        tree = generate_binary_tree(num_nodes=num_nodes)
        fn = {"tree_inorder": compute_inorder, "tree_preorder": compute_preorder,
              "tree_postorder": compute_postorder}[diagram_type]
        order = fn(tree)
        question = QUESTION_TEMPLATES[diagram_type]
        answer = " → ".join(order)
        # strip layout-only "_pos" keys before serializing
        def clean(n):
            if n is None:
                return None
            return {"label": n["label"], "left": clean(n["left"]), "right": clean(n["right"])}
        data = {"kind": "tree", "tree": clean(tree)}
        return question, answer, data

    raise ValueError(f"Unknown diagram_type: {diagram_type}")


def draw_diagram(diagram_type: str, diagram_data: dict):
    """Re-renders a diagram from its stored data at PDF-build time."""
    if diagram_data["kind"] == "graph":
        return draw_graph(diagram_data["nodes"], [tuple(e) for e in diagram_data["edges"]])
    if diagram_data["kind"] == "tree":
        return draw_tree(diagram_data["tree"])
    raise ValueError(f"Unknown diagram kind: {diagram_data.get('kind')}")
