"""Decode supplied test screenshots; no source photos are published to the Site."""
from PIL import Image
import json,pathlib
ROOT=pathlib.Path('/workspace/scratch/15c36d537591')
out=pathlib.Path(__file__).resolve().parent/'ocr-raw'
out.mkdir(exist_ok=True)
items=[]
for number in list(range(8581,8587))+list(range(8569,8575))+[8590]:
    name=f'IMG_{number}.jpeg'
    if not (ROOT/'upload'/name).exists():continue
    image=Image.open(ROOT/'upload'/name).convert('RGBA')
    target=out/(name+'.rgba');target.write_bytes(image.tobytes())
    items.append(dict(name=name,path=str(target),width=image.width,height=image.height))
(out/'manifest.json').write_text(json.dumps(items))
print(len(items),'local screenshot test fixtures decoded')
