from PIL import Image, ImageDraw, ImageFont
import math

def draw_honda_logo():
    # Create high-res transparent RGBA image
    width, height = 400, 280
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    red_color = (255, 42, 42, 255)
    
    # 3 Honda Wing Feathers
    # Top Feather
    feather1 = [
        (30, 180), (80, 150), (180, 85), (370, 20),
        (310, 48), (230, 85), (130, 135), (80, 158)
    ]
    # Middle Feather
    feather2 = [
        (50, 205), (100, 175), (200, 110), (390, 45),
        (330, 73), (250, 110), (150, 160), (100, 183)
    ]
    # Bottom Feather
    feather3 = [
        (70, 230), (120, 200), (220, 135), (410, 70),
        (350, 98), (270, 135), (170, 185), (120, 208)
    ]
    
    # Draw smooth filled polygons
    for f in [feather1, feather2, feather3]:
        draw.polygon(f, fill=red_color)
        
    # Draw Base Foundation Bar
    bar = [(30, 240), (430, 240), (410, 255), (30, 255)]
    draw.polygon(bar, fill=red_color)

    # Save PNG to target path
    img.save("HondaECUTool/data/web/hondalogo.png", "PNG")
    print("[OK] Created crisp transparent Honda Wing PNG at HondaECUTool/data/web/hondalogo.png")

if __name__ == "__main__":
    draw_honda_logo()
