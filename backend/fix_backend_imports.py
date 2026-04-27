import os
import re

def update_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replacements
    # 1. from common.database.db_session -> from common.database.db_session
    content = content.replace('from common.database.db_session', 'from common.database.db_session')
    content = content.replace('import common.database.db_session', 'import common.database.db_session')
    
    # 2. from common. -> from common.
    content = content.replace('from common.', 'from common.')
    content = content.replace('import common.', 'import common.')
    
    # 3. Specific fix for relative imports if any (though monolith used absolute)
    # 4. Handle any remaining 'app.' strings in strings or comments if safe, 
    # but we mostly care about code.

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {file_path}")

def run():
    root_dir = "d:\\PROJECTS\\LearNnEarn\\backend"
    for root, dirs, files in os.walk(root_dir):
        # Skip venv if it exists
        if 'venv' in dirs:
            dirs.remove('venv')
            
        for file in files:
            if file.endswith(".py"):
                update_file(os.path.join(root, file))

if __name__ == "__main__":
    run()
