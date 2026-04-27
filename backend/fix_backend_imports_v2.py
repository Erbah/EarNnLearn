import os

def update_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # The issue: 'common.database.db_session' became 'common.database.db_session' via PowerShell replace
    # But it should be 'common.database.db_session'
    
    replacements = [
        ('common.database.db_session', 'common.database.db_session'),
        ('common.database.db_session', 'common.database.db_session'),
        ('from common.models', 'from common.models'),
        ('from common.schemas', 'from common.schemas'),
        ('from common.services', 'from common.services'),
        ('from common.workers', 'from common.workers'),
        ('from common.core.config', 'from common.core.config'),
        ('from common.core.security', 'from common.core.security'),
        ('import common.models', 'import common.models'),
        ('import common.schemas', 'import common.schemas'),
        ('import common.services', 'import common.services'),
        ('import common.workers', 'import common.workers'),
        ('import common.core.config', 'import common.core.config'),
        ('import common.core.security', 'import common.core.security'),
    ]

    new_content = content
    for old, new in replacements:
        new_content = new_content.replace(old, new)

    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {file_path}")

def run():
    root_dir = "d:\\PROJECTS\\LearNnEarn\\backend"
    for root, dirs, files in os.walk(root_dir):
        if 'venv' in dirs:
            dirs.remove('venv')
        if '__pycache__' in dirs:
            dirs.remove('__pycache__')
            
        for file in files:
            if file.endswith(".py"):
                update_file(os.path.join(root, file))

if __name__ == "__main__":
    run()
