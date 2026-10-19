"""Export only public app source; never include Site identity, Git or local state."""
from pathlib import Path
import sys
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]).resolve()
out.parent.mkdir(parents=True, exist_ok=True)
paths = [root / name for name in ['README.md', 'package.json', 'package-lock.json', '.gitignore']]
for folder in ['dist', 'tests', 'scripts', '.github']:
    paths += [p for p in (root / folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(paths):
        rel = path.relative_to(root)
        if '.git' in rel.parts or '.openai' in rel.parts or 'node_modules' in rel.parts:
            raise RuntimeError(f'Nonpublic path: {rel}')
        archive.write(path, 'umabong-calculator/' + str(rel))
print(f'{out} ({out.stat().st_size:,} bytes)')
