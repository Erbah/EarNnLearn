from app.main import app

print("DEBUG: Active Routes:")
for route in app.routes:
    if hasattr(route, "path"):
        print(f"Path: {route.path}, Name: {route.name}, Methods: {route.methods}")
