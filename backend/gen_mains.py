import os

services = {
    "economy_service": 8002,
    "referral_service": 8003,
    "wallet_service": 8004,
    "course_service": 8005,
    "creator_service": 8006,
    "ai_service": 8007,
    "admin_service": 8008,
    "analytics_service": 8009,
    "season_service": 8010
}

template = """from fastapi import FastAPI
from {service_name}.{routes_file} import router
from common.core.config import settings
from common.database.db_session import Base, engine

app = FastAPI(title="CediTrees {human_name} Service")

# Base.metadata.create_all(bind=engine) # Should be handled by migrations or a single service

app.include_router(router, prefix=f"{{settings.API_V1_STR}}", tags=["{human_name}"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port={port})
"""

for service, port in services.items():
    human_name = service.replace("_", " ").title()
    routes_file = service.split("_")[0] + "_routes"
    
    # Season service uses season_routes
    if service == "season_service": routes_file = "season_routes"
    
    # Creator service uses creator_routes
    if service == "creator_service": routes_file = "creator_routes"

    content = template.format(
        service_name=service,
        routes_file=routes_file,
        human_name=human_name,
        port=port
    )
    
    service_path = os.path.join("d:\\PROJECTS\\LearNnEarn\\backend", service)
    main_path = os.path.join(service_path, "main.py")
    
    with open(main_path, "w") as f:
        f.write(content)
    print(f"Created {main_path}")
