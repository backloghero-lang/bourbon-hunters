from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android" / "app" / "src" / "main" / "res"


def main() -> None:
    targets = sorted(RES.glob("drawable*/splash.png"))
    if not targets:
        raise SystemExit("No Android splash resources found")

    for target in targets:
        with Image.open(target) as source:
            splash = Image.new("RGB", source.size, "#000000")
        splash.save(target, optimize=True)

    print(f"Generated {len(targets)} black Android splash resources")


if __name__ == "__main__":
    main()
