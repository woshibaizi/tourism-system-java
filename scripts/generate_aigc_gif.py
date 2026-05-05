#!/usr/bin/env python3
import sys
from pathlib import Path

from PIL import Image, ImageOps


def main() -> int:
    if len(sys.argv) < 6:
        print("usage: generate_aigc_gif.py <output> <width> <height> <fps> <image1> [image2 ...]", file=sys.stderr)
        return 1

    output_path = Path(sys.argv[1]).expanduser().resolve()
    width = max(int(sys.argv[2]), 1)
    height = max(int(sys.argv[3]), 1)
    fps = max(int(sys.argv[4]), 1)
    image_paths = [Path(arg).expanduser().resolve() for arg in sys.argv[5:]]

    frames = []
    for image_path in image_paths:
        if not image_path.exists():
            continue
        with Image.open(image_path) as image:
            frame = ImageOps.contain(image.convert("RGB"), (width, height))
            canvas = Image.new("RGB", (width, height), (18, 24, 38))
            offset_x = (width - frame.width) // 2
            offset_y = (height - frame.height) // 2
            canvas.paste(frame, (offset_x, offset_y))
            for _ in range(fps):
                frames.append(canvas.copy())

    if not frames:
        print("no valid images", file=sys.stderr)
        return 2

    output_path.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        duration=max(int(1000 / fps), 80),
        loop=0,
        optimize=False,
    )
    print(str(output_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
