from PIL import Image
import pathlib,json,re
from PIL import ImageEnhance
from io import BytesIO
root=pathlib.Path('/workspace/scratch/15c36d537591')
text=(root/'race_10_stat_hidden_guide_review.html').read_text()
old=json.loads(re.findall(r'<script[^>]*type="application/json"[^>]*>(.*?)</script>',text,re.S)[0])['rows']
out=pathlib.Path(__file__).resolve().parent/'ocr-raw'
out.mkdir(exist_ok=True)
manifest=[]
rows=[dict(name=x['source_photo'],lane=x['lane'],grades=x['grades']) for x in old]
latest=json.loads((root/'uma_race26_forecast_20261018.json').read_text())
rows.extend(dict(name=f'IMG_{8581+i}.jpeg',lane=i+1,grades=g) for i,g in enumerate(latest['grades']))
for row in rows:
    image=Image.open(root/'upload'/row['name']).convert('RGBA')
    path=out/(row['name']+'.rgba');path.write_bytes(image.tobytes())
    manifest.append(dict(**row,path=str(path),width=image.width,height=image.height))
for row in rows[:6]+rows[-6:]:
    original=Image.open(root/'upload'/row['name']).convert('RGB')
    for variant in ['512px-jpeg50','brightness75']:
        if variant=='512px-jpeg50':
            image=original.resize((512,round(original.height*512/original.width)),Image.Resampling.LANCZOS)
            buffer=BytesIO();image.save(buffer,format='JPEG',quality=50);buffer.seek(0);image=Image.open(buffer).convert('RGBA')
        else:image=ImageEnhance.Brightness(original).enhance(.75).convert('RGBA')
        path=out/(row['name']+'.'+variant+'.rgba');path.write_bytes(image.tobytes())
        manifest.append(dict(**{**row,'name':row['name']+' '+variant},path=str(path),width=image.width,height=image.height))
(out/'color-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False))
print(len(manifest),'known-grade screenshots decoded')
