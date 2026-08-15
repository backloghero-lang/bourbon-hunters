from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "brand" / "android-launcher-source.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
ARTIFACTS = ROOT / "artifacts"

LEGACY_SIZES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
FOREGROUND_SIZES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}


def prepared_square() -> Image.Image:
    source = Image.open(SOURCE).convert("RGBA")
    side = min(source.width, source.height)
    left = (source.width - side) // 2
    top = max(0, min(source.height - side, 68))
    image = source.crop((left, top, left + side, top + side))
    image = ImageEnhance.Contrast(image).enhance(1.04)
    return image.filter(ImageFilter.UnsharpMask(radius=1.2, percent=110, threshold=2))


def round_icon(image: Image.Image, size: int) -> Image.Image:
    scale = 4
    large = ImageOps.fit(image, (size * scale, size * scale), method=Image.Resampling.LANCZOS)
    mask = Image.new("L", large.size, 0)
    from PIL import ImageDraw

    ImageDraw.Draw(mask).ellipse((0, 0, large.width - 1, large.height - 1), fill=255)
    large.putalpha(mask)
    return large.resize((size, size), Image.Resampling.LANCZOS)


def adaptive_foreground(image: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    artwork_size = round(size * 0.78)
    artwork = round_icon(image, artwork_size)
    offset = (size - artwork_size) // 2
    canvas.alpha_composite(artwork, (offset, offset))
    return canvas


def main() -> None:
    image = prepared_square()
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    image.resize((1024, 1024), Image.Resampling.LANCZOS).save(
        ARTIFACTS / "android-launcher-preview-square.png", optimize=True
    )
    round_icon(image, 1024).save(ARTIFACTS / "android-launcher-preview-round.png", optimize=True)

    for density, size in LEGACY_SIZES.items():
        target = RES / f"mipmap-{density}"
        target.mkdir(parents=True, exist_ok=True)
        resized = image.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(target / "ic_launcher.png", optimize=True)
        round_icon(image, size).save(target / "ic_launcher_round.png", optimize=True)

    for density, size in FOREGROUND_SIZES.items():
        target = RES / f"mipmap-{density}"
        adaptive_foreground(image, size).save(
            target / "ic_launcher_foreground.png", optimize=True
        )

    print("Generated Bourbon Hunters launcher icons from", SOURCE)


if __name__ == "__main__":
    main()
