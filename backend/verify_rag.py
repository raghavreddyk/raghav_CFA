import os
import sys

# Append project root to path so we can import absolute backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.rag_engine import rag_engine
from backend.app.main import ingest_starter_notes_if_empty

print("=========================================")
echo_prefix = "--> [TEST AUDIT] "
print(f"{echo_prefix}Initializing RAG Engine components...")

# 1. Trigger database bootstrap
print(f"{echo_prefix}Triggering starter notes bootstrap...")
ingest_starter_notes_if_empty()

# 2. Check loaded documents
print(f"{echo_prefix}Auditing active vector database records...")
docs = rag_engine.get_all_documents()
print(f"{echo_prefix}Documents found in database:")
for doc in docs:
    print(f"   - File: {doc['filename']} | Chunks: {doc['chunks_count']} | Pages/Sections: {doc['pages_count']}")

if not docs:
    print(f"{echo_prefix}❌ FAILED: ChromaDB database is empty.")
    sys.exit(1)

# 3. Test semantic search query
test_query = "What are the rules of Independence and Objectivity under Standard I(B)?"
print(f"\n{echo_prefix}Testing semantic similarity query: '{test_query}'...")
matches = rag_engine.retrieve(test_query, n_results=2)

print(f"{echo_prefix}Retrieved semantic RAG matches:")
for idx, match in enumerate(matches):
    src = match["metadata"].get("source", "unknown")
    pg = match["metadata"].get("page", 1)
    score = match.get("score", 0.0)
    print(f"   Match #{idx+1} (Source: {src}, Page: {pg}, Relevance: {score:.4f}):")
    print(f"   Content preview: \"{match['content'][:150]}...\"\n")

if not matches:
    print(f"{echo_prefix}❌ FAILED: No matches retrieved.")
    sys.exit(1)

print(f"{echo_prefix}✅ SUCCESS: RAG pipeline verification complete! Core engine is operational.")
sys.exit(0)
