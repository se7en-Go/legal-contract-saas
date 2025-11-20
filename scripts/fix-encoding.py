from pathlib import Path

path = Path('supabase/functions/task-runner/index.ts')
text = path.read_text(encoding='utf-16le').replace('\ufeff', '')
path.write_text(text, encoding='utf-8')
print('Re-encoded file to UTF-8')
