from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import logging

app = FastAPI(title="CediTrees API Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration for service endpoints
# In production, these would be service names in Docker/K8s
SERVICES = {
    "auth": "http://127.0.0.1:8001",
    "economy": "http://127.0.0.1:8002",
    "marketplace": "http://127.0.0.1:8002",
    "network": "http://127.0.0.1:8003",
    "wallet": "http://127.0.0.1:8004",
    "learn": "http://127.0.0.1:8005",
    "creator": "http://127.0.0.1:8006",
    "ai": "http://127.0.0.1:8007",
    "admin": "http://127.0.0.1:8008",
    "analytics": "http://127.0.0.1:8009",
    "seasons": "http://127.0.0.1:8010"
}

@app.api_route("/api/v1/{service}/{rest_of_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_request(service: str, rest_of_path: str, request: Request):
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail=f"Service '{service}' not found in gateway configuration.")

    base_url = SERVICES[service]
    # Reconstruct the URL for the downstream service
    # Downstream services usually keep the /api/v1/ prefix in their routers for consistency
    url = f"{base_url}/api/v1/{service}/{rest_of_path}"
    
    # Forward headers, but exclude 'host'
    headers = dict(request.headers)
    headers.pop("host", None)

    # Get body
    body = await request.body()
    
    async with httpx.AsyncClient() as client:
        try:
            # Proxy request
            response = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                params=request.query_params,
                content=body,
                timeout=30.0
            )
            
            # Log response summary
            print(f"[{service}] {request.method} {url} -> {response.status_code}")
            
            # Return response from service with exact status code and headers
            content_type = response.headers.get("Content-Type", "")
            response_headers = dict(response.headers)
            # Remove content-related headers that FastAPI will set
            response_headers.pop("content-length", None)
            response_headers.pop("content-type", None)

            if "application/json" in content_type:
                try:
                    from fastapi.responses import JSONResponse
                    return JSONResponse(
                        content=response.json(), 
                        status_code=response.status_code,
                        headers=response_headers
                    )
                except Exception:
                    from fastapi.responses import Response
                    return Response(
                        content=response.content, 
                        status_code=response.status_code, 
                        media_type=content_type,
                        headers=response_headers
                    )
            else:
                from fastapi.responses import Response
                return Response(
                    content=response.content, 
                    status_code=response.status_code, 
                    media_type=content_type,
                    headers=response_headers
                )
            
        except httpx.RequestError as exc:
            logging.error(f"Error proxying to {service}: {exc}")
            raise HTTPException(status_code=502, detail=f"Service '{service}' is unreachable.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
