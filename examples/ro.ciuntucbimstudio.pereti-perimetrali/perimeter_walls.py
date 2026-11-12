# lapin: name="Perimeter walls", version="1.0.0", requires="scripting"
# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Ciuntuc BIM Studio SRL
"""Four walls round a rectangle, as one undo step.

Written on lapinbim, Lapin's Python package (docs/python.md in lapin-pro). Installed from Lapin Extensions it waits for
Lapin's Python console, and runs only when you run it. From a terminal, with Lapin open:

    python perimeter_walls.py 8 6 2.8
"""

import sys

import lapinbim as lapin


def perimeter_walls(width: float = 8.0, depth: float = 6.0, height: float = 2.8, storey: str | None = None) -> list[str]:
    """Walls on the axis of a width x depth rectangle (metres), its corner at 0,0, on `storey` (default: the one at ±0.00)."""
    if width <= 0 or depth <= 0 or height <= 0:
        raise ValueError("width, depth and height are metres above zero")
    storeys = lapin.model.storeys
    storey_id = storey or next((s.id for s in storeys if s.elevation == 0), storeys[0].id)
    corners = [(0.0, 0.0), (width, 0.0), (width, depth), (0.0, depth)]
    with lapin.batch("Perimeter walls") as b:
        for (x1, y1), (x2, y2) in zip(corners, corners[1:] + corners[:1]):
            lapin.architecture.add_wall(storey_id=storey_id, x1=x1, y1=y1, x2=x2, y2=y2, height=height)
    return [r.id for r in b.results]


if __name__ == "__main__":
    numbers = [float(a) for a in sys.argv[1:4]]
    made = perimeter_walls(*numbers)
    print(f"{len(made)} walls")
