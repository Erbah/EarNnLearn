import os
import re

def refactor_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'class Config:' not in content:
        return

    # Add ConfigDict import
    if 'ConfigDict' not in content:
        if 'from pydantic import BaseModel' in content:
            content = content.replace('from pydantic import BaseModel', 'from pydantic import BaseModel, ConfigDict')
        elif 'from pydantic import ' in content:
            content = re.sub(r'(from pydantic import .*)', r'\1, ConfigDict', content, count=1)
        else:
            content = "from pydantic import ConfigDict\n" + content

    def replacer(match):
        indent = match.group(1)
        body = match.group(2)
        
        args = []
        if 'orm_mode = True' in body:
            args.append('from_attributes=True')
        if 'allow_population_by_field_name = True' in body:
            args.append('populate_by_name=True')
        if 'arbitrary_types_allowed = True' in body:
            args.append('arbitrary_types_allowed=True')
            
        return f"{indent}model_config = ConfigDict({', '.join(args)})\n"

    # Match '    class Config:\n        orm_mode = True\n        ...'
    # We capture the indent, and the entire body of the config block until the next dedent or class definition.
    # A simpler way is to match class Config: and all lines that are more indented than it.
    pattern = r'^([ \t]+)class Config:\n((?:^[ \t]+.*\n?)*)'
    content = re.sub(pattern, replacer, content, flags=re.MULTILINE)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Refactored {filepath}")

for root, _, files in os.walk('d:/PROJECTS/LearNnEarn/backend_v2/app'):
    for file in files:
        if file.endswith('.py'):
            refactor_file(os.path.join(root, file))
