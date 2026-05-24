import os
import re
from typing import List, Dict, Any, Optional
import pdfplumber
from pypdf import PdfReader

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Chroma
from langchain_core.embeddings import Embeddings

from backend.app.config import settings

class SimpleLocalEmbeddings(Embeddings):
    """
    A lightweight, zero-dependency local embedding fallback that uses
    a deterministic hashing vectorizer (128 dimensions). Ensures the system
    never crashes on start, even without internet or active API keys.
    """
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        embeddings = []
        for text in texts:
            vec = [0.0] * 128
            # Simple tokenization
            words = re.findall(r'\w+', text.lower())
            if not words:
                embeddings.append(vec)
                continue
            for w in words:
                # Deterministic hash index
                h = abs(hash(w)) % 128
                vec[h] += 1.0
            # L2 Normalization
            norm = sum(x * x for x in vec) ** 0.5
            if norm > 0:
                vec = [x / norm for x in vec]
            embeddings.append(vec)
        return embeddings

    def embed_query(self, text: str) -> List[float]:
        return self.embed_documents([text])[0]


class RobustGoogleEmbeddings(Embeddings):
    """
    A robust wrapper around GoogleGenerativeAIEmbeddings that bypasses the LangChain
    batching bug by calling the working single-document embed_query in a loop.
    """
    def __init__(self, model: str, google_api_key: str):
        self.underlying = GoogleGenerativeAIEmbeddings(
            model=model,
            google_api_key=google_api_key
        )

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        # Call embed_query individually to avoid the LangChain batch flattening bug
        return [self.underlying.embed_query(text) for text in texts]

    def embed_query(self, text: str) -> List[float]:
        return self.underlying.embed_query(text)


def get_embedding_model() -> Embeddings:
    """
    Returns the appropriate embedding model based on settings configuration.
    """
    provider = settings.EMBEDDING_PROVIDER
    
    if provider == "gemini" and settings.GEMINI_API_KEY:
        try:
            return RobustGoogleEmbeddings(
                model="models/gemini-embedding-2",
                google_api_key=settings.GEMINI_API_KEY
            )
        except Exception as e:
            print(f"Error initializing Gemini Embeddings: {e}. Falling back to local.")
            
    elif provider == "openai" and settings.OPENAI_API_KEY:
        try:
            return OpenAIEmbeddings(api_key=settings.OPENAI_API_KEY)
        except Exception as e:
            print(f"Error initializing OpenAI Embeddings: {e}. Falling back to local.")
            
    # Fallback to zero-dependency local embeddings
    print("Using simple offline local embeddings (zero-dependency).")
    return SimpleLocalEmbeddings()


class RAGEngine:
    def __init__(self):
        self.embeddings = get_embedding_model()
        self.vector_store = Chroma(
            collection_name="cfa_curriculum",
            embedding_function=self.embeddings,
            persist_directory=settings.CHROMA_DB_DIR
        )
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=700,
            chunk_overlap=120,
            length_function=len
        )

    def reload_embeddings(self):
        """Re-initializes the embedding function and vector store connection."""
        self.embeddings = get_embedding_model()
        self.vector_store = Chroma(
            collection_name="cfa_curriculum",
            embedding_function=self.embeddings,
            persist_directory=settings.CHROMA_DB_DIR
        )

    def extract_text_from_pdf(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Parses a PDF file page by page to extract text and keep page citations.
        Returns a list of dictionaries with 'text' and 'metadata'.
        """
        pages_content = []
        filename = os.path.basename(file_path)
        
        # Try pdfplumber first (more accurate formatting)
        try:
            with pdfplumber.open(file_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    text = page.extract_text()
                    if text and text.strip():
                        pages_content.append({
                            "text": text,
                            "metadata": {
                                "source": filename,
                                "page": i + 1
                            }
                        })
        except Exception as plumber_error:
            print(f"pdfplumber failed: {plumber_error}. Trying PyPDF...")
            # Fallback to PyPDF
            try:
                reader = PdfReader(file_path)
                for i, page in enumerate(reader.pages):
                    text = page.extract_text()
                    if text and text.strip():
                        pages_content.append({
                            "text": text,
                            "metadata": {
                                "source": filename,
                                "page": i + 1
                            }
                        })
            except Exception as pypdf_error:
                print(f"PyPDF also failed: {pypdf_error}")
                
        return pages_content

    def ingest_file(self, file_path: str, filename: str) -> Dict[str, Any]:
        """
        Ingests a text, markdown, or PDF file, chunks it, embeds it, and stores it in ChromaDB.
        """
        chunks_to_add = []
        
        if filename.endswith(".pdf"):
            pages = self.extract_text_from_pdf(file_path)
            for page in pages:
                # Split page-level text recursively
                splits = self.text_splitter.split_text(page["text"])
                for chunk_idx, split in enumerate(splits):
                    metadata = page["metadata"].copy()
                    metadata["chunk_index"] = chunk_idx
                    # Clean content representation
                    chunks_to_add.append((split, metadata))
        else:
            # Handle text/markdown files
            with open(file_path, "r", encoding="utf-8") as f:
                text_content = f.read()
            
            splits = self.text_splitter.split_text(text_content)
            for chunk_idx, split in enumerate(splits):
                metadata = {
                    "source": filename,
                    "page": 1,
                    "chunk_index": chunk_idx
                }
                chunks_to_add.append((split, metadata))
                
        if not chunks_to_add:
            return {"status": "error", "message": "No text extracted from file"}

        # Extract texts and metadatas lists
        texts = [c[0] for c in chunks_to_add]
        metadatas = [c[1] for c in chunks_to_add]
        
        # Add to ChromaDB
        self.vector_store.add_texts(texts=texts, metadatas=metadatas)
        return {"status": "success", "chunks_created": len(chunks_to_add)}

    def retrieve(self, query: str, n_results: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieves top semantically matching chunks from ChromaDB.
        """
        try:
            results = self.vector_store.similarity_search_with_relevance_scores(query, k=n_results)
            # Filter matches and format them
            formatted_matches = []
            for doc, score in results:
                formatted_matches.append({
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                    "score": float(score)
                })
            return formatted_matches
        except Exception as e:
            print(f"Similarity search error: {e}")
            # Dynamic fallback: search standard contains if vector store fails
            try:
                results = self.vector_store.similarity_search(query, k=n_results)
                return [{
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                    "score": 0.8
                } for doc in results]
            except Exception as inner:
                print(f"Fallback search also failed: {inner}")
                return []

    def get_all_documents(self) -> List[Dict[str, Any]]:
        """
        Retrieves details of all documents loaded in the vector database.
        """
        try:
            data = self.vector_store.get()
            if not data or not data.get("metadatas"):
                return []
            
            # Group by unique filenames
            docs_summary = {}
            for meta in data["metadatas"]:
                src = meta.get("source", "unknown")
                if src not in docs_summary:
                    docs_summary[src] = {
                        "filename": src,
                        "chunks_count": 0,
                        "pages_count": set()
                    }
                docs_summary[src]["chunks_count"] += 1
                docs_summary[src]["pages_count"].add(meta.get("page", 1))
            
            return [
                {
                    "filename": info["filename"],
                    "chunks_count": info["chunks_count"],
                    "pages_count": len(info["pages_count"])
                }
                for info in docs_summary.values()
            ]
        except Exception as e:
            print(f"Error fetching documents: {e}")
            return []

    def delete_document(self, filename: str) -> bool:
        """
        Deletes all chunks associated with a specific file from ChromaDB.
        """
        try:
            # Fetch all items to get IDs with the matching source filename
            data = self.vector_store.get()
            if not data or not data.get("ids"):
                return False
                
            ids_to_delete = []
            for i, meta in enumerate(data["metadatas"]):
                if meta.get("source") == filename:
                    ids_to_delete.append(data["ids"][i])
                    
            if ids_to_delete:
                self.vector_store.delete(ids=ids_to_delete)
                return True
            return False
        except Exception as e:
            print(f"Error deleting document: {e}")
            return False

    def query_llm(self, prompt: str, system_prompt: str, provider: Optional[str] = None) -> str:
        """
        Queries the selected LLM provider using the given user prompt and system instruction.
        """
        llm_provider = provider or settings.LLM_PROVIDER
        
        # Guard: If prompt is a multimodal list and provider is Groq, extract only text parts
        if isinstance(prompt, list) and llm_provider == "groq":
            text_parts = [item["text"] for item in prompt if item.get("type") == "text"]
            prompt = "\n".join(text_parts)
            
        # Prepare system and user messages structure for standard ChatModels
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]
        
        errors_logged = []
        
        # 1. Groq Provider
        if llm_provider == "groq" and settings.GROQ_API_KEY:
            try:
                llm = ChatGroq(
                    groq_api_key=settings.GROQ_API_KEY,
                    model_name=settings.GROQ_MODEL,
                    temperature=0.2
                )
                response = llm.invoke(messages)
                return response.content
            except Exception as e:
                err_msg = str(e)
                print(f"Groq API error: {err_msg}. Falling back to Gemini...")
                errors_logged.append(("Groq", err_msg))
                llm_provider = "gemini"  # Fallback
                
        # 2. Gemini Provider
        if llm_provider == "gemini" and settings.GEMINI_API_KEY:
            try:
                llm = ChatGoogleGenerativeAI(
                    google_api_key=settings.GEMINI_API_KEY,
                    model=settings.GEMINI_MODEL,
                    temperature=0.2
                )
                # Google Generative AI in Langchain takes a specific message format
                from langchain_core.messages import SystemMessage, HumanMessage
                lg_messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=prompt)
                ]
                response = llm.invoke(lg_messages)
                return response.content
            except Exception as e:
                err_msg = str(e)
                print(f"Gemini API error: {err_msg}. Falling back to OpenAI...")
                errors_logged.append(("Gemini", err_msg))
                llm_provider = "openai"  # Fallback

        # 3. OpenAI Provider
        if llm_provider == "openai" and settings.OPENAI_API_KEY:
            try:
                llm = ChatOpenAI(
                    api_key=settings.OPENAI_API_KEY,
                    model_name=settings.OPENAI_MODEL,
                    temperature=0.2
                )
                response = llm.invoke(messages)
                return response.content
            except Exception as e:
                err_msg = str(e)
                print(f"OpenAI API error: {err_msg}")
                errors_logged.append(("OpenAI", err_msg))
                
        # Inspect logged errors to check if rate limits or quota caps were exceeded
        for prov, err in errors_logged:
            if "RESOURCE_EXHAUSTED" in err or "quota" in err.lower() or "429" in err:
                return (
                    f"⚠️ **{prov} API Rate Limit Exceeded (429 Quota Error)**\n\n"
                    f"Your `{prov}_API_KEY` in the `.env` file is valid, but has **exceeded its usage quotas** (e.g. 20 requests per day/per minute limit on the Free Tier for new accounts).\n\n"
                    f"**Details from the API:**\n"
                    f"*{err}*\n\n"
                    f"**Action Steps:**\n"
                    f"1. Wait 60 seconds and retry your query.\n"
                    f"2. Or obtain a fresh/pay-as-you-go API key from Google AI Studio to lift rate ceilings."
                )
                
        # Zero-API-key response block if all else fails (Mock mode)
        return (
            "⚠️ **API Key Missing / Connection Error**\n\n"
            "I could not connect to a live LLM inference service (Groq, Gemini, or OpenAI). "
            "Please make sure you have added your API keys in the `.env` file.\n\n"
            "**Here is what the RAG engine retrieved from the CFA notes:**\n"
            f"Based on your query: *\"{prompt[:60] if isinstance(prompt, str) else 'Attached file query'}...\"*, the local vector database retrieved curriculum matches. "
            "Once API keys are active, these matches will be compiled into a blistering-fast financial tutor response here."
        )

# Instantiate a single global RAG engine
rag_engine = RAGEngine()
