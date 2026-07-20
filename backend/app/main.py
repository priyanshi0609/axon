from dotenv import load_dotenv
load_dotenv()   # must run before importing routers/services (they read os.getenv at import time)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import upload, process, embed, graph, chat, insights

app = FastAPI(
    title="Axon API",
    description="Industrial Knowledge Intelligence — ET AI Hackathon 2.0",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(process.router)
app.include_router(embed.router)
app.include_router(graph.router)
app.include_router(chat.router)
app.include_router(insights.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "axon-api"}
