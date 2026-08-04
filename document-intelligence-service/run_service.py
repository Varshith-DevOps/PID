import os
import sys
import uvicorn
from app.main import app

if __name__ == "__main__":
    # Support frozen execution (PyInstaller packaging path context)
    if getattr(sys, 'frozen', False):
        os.environ["PATH"] += os.pathsep + sys._MEIPASS

    port = int(os.environ.get("PORT", 8002))
    host = os.environ.get("HOST", "0.0.0.0")
    
    print(f"Starting Priya Document Intelligence Service on http://{host}:{port}...")
    uvicorn.run(app, host=host, port=port)
