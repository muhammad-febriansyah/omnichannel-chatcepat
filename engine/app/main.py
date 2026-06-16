from fastapi import FastAPI

from .api.internal import router as internal_router

app = FastAPI(title="ChatCepat Engine", version="0.1.0")
app.include_router(internal_router)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


# TODO(09): flows/{id}/test, ai-agent/preview, knowledge/{doc_id}/reindex,
#           conversations/{id}/messages.
