import os
from dotenv import load_dotenv

# Load .env file if it exists
load_dotenv()

class Settings:
    # API Keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # Provider Configurations
    # Options: "gemini", "groq", "openai"
    # Default order of preference: gemini -> groq -> openai
    DEFAULT_LLM_PROVIDER: str = "gemini"
    
    @property
    def LLM_PROVIDER(self) -> str:
        provider = os.getenv("LLM_PROVIDER", "").lower()
        if provider in ["gemini", "groq", "openai"]:
            return provider
        
        # Fallback based on available API keys
        if self.GEMINI_API_KEY:
            return "gemini"
        elif self.GROQ_API_KEY:
            return "groq"
        elif self.OPENAI_API_KEY:
            return "openai"
        return "gemini"  # Default fallback
        
    @property
    def EMBEDDING_PROVIDER(self) -> str:
        provider = os.getenv("EMBEDDING_PROVIDER", "").lower()
        if provider in ["gemini", "openai", "local"]:
            return provider
            
        if self.GEMINI_API_KEY:
            return "gemini"
        elif self.OPENAI_API_KEY:
            return "openai"
        return "local"

    # Directory Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    CHROMA_DB_DIR: str = os.path.join(BASE_DIR, "data", "chromadb")
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "data", "uploads")
    STARTER_NOTES_DIR: str = os.path.join(BASE_DIR, "starter_notes")
    
    # Models
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama3-70b-8192")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4-turbo")
    
    # App Config
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")

settings = Settings()

# Create necessary directories
os.makedirs(settings.CHROMA_DB_DIR, exist_ok=True)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.STARTER_NOTES_DIR, exist_ok=True)
