import os

def fix_service_imports():
    root_dir = "d:\\PROJECTS\\LearNnEarn\\backend\\app\\services"
    for file in os.listdir(root_dir):
        if file.endswith(".py"):
            path = os.path.join(root_dir, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            
            new_content = content.replace("from common.models", "from app.models")
            # Also handle if they import from each other in app.services
            # But usually it's common.services
            
            if new_content != content:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Fixed {file}")

if __name__ == "__main__":
    fix_service_imports()
