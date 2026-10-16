"""从品牌源图 assets/avatar.png 派生全套品牌资产（PRD §3）。

输出：
- assets/icon.png          512x512（图标）
- assets/icon.ico          多尺寸 256/48/32（窗口/任务栏图标）
- assets/icon-source-1024.png  1024x1024（pnpm tauri icon 源图）
- assets/splash.png        品牌启动图
- assets/avatar-128.png    关于页/设置页底栏头像
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
AVATAR = ASSETS / "avatar.png"

ICON_SIZES = [512, 256, 128, 48, 32]


def resize(size: int) -> Image.Image:
    src = Image.open(AVATAR).convert("RGBA")
    return src.resize((size, size), Image.LANCZOS)


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size, size), radius, fill=255)
    return mask


def main() -> None:
    # 512 图标
    resize(512).save(ASSETS / "icon.png")

    # 多尺寸 ICO（源图 256 直接缩放，Pillow 会按 sizes 生成各档）
    ico_src = resize(256)
    ico_src.save(ASSETS / "icon.ico", format="ICO", sizes=[(256, 256), (48, 48), (32, 32)])

    # tauri icon CLI 源图（要求 >=1024）
    resize(1024).save(ASSETS / "icon-source-1024.png")

    # 关于页 / 设置页底栏头像
    resize(128).save(ASSETS / "avatar-128.png")

    # 品牌启动图：emerald 深底 + 圆角头像
    w, h = 1200, 800
    bg = Image.new("RGB", (w, h))
    top, bottom = (2, 44, 34), (6, 78, 59)  # emerald-950 -> emerald-900
    for y in range(h):
        t = y / (h - 1)
        row = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
        ImageDraw.Draw(bg).line([(0, y), (w, y)], fill=row)

    box = 320
    avatar = resize(box)
    mask = rounded_mask(box, 64)
    pos = ((w - box) // 2, (h - box) // 2)
    bg.paste(avatar, pos, mask)
    bg.save(ASSETS / "splash.png")

    print("derived:", ", ".join(p.name for p in sorted(ASSETS.iterdir())))


if __name__ == "__main__":
    main()
