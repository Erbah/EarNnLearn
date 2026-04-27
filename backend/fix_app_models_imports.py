import os

def fix_imports():
    root_dir = "d:\\PROJECTS\\LearNnEarn\\backend\\app\\models"
    for file in os.listdir(root_dir):
        if file.endswith(".py"):
            path = os.path.join(root_dir, file)
            with open(path, "r") as f:
                content = f.read()
            
            new_content = content.replace("from common.database.base import Base", "from app.database.base import Base")
            
            if new_content != content:
                with open(path, "w") as f:
                    f.write(new_content)
                print(f"Fixed {file}")

if __name__ == "__main__":
    fix_imports()
