from fastapi import FastAPI

app = FastAPI(title="Puja Saathi Backend")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
