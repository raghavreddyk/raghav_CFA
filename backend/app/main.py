import os
import shutil
import base64
import io
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.app.config import settings
from backend.app.rag_engine import rag_engine

app = FastAPI(
    title="CFA Tutor AI Backend",
    description="RAG Engine and Orchestrator for CFA Level I, II, III prep",
    version="1.0.0"
)

# Enable CORS for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact React domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Schemas ---
class Attachment(BaseModel):
    filename: str
    content_type: str
    base64_data: str

class ChatRequest(BaseModel):
    prompt: str
    provider: Optional[str] = None  # "gemini", "groq", or "openai"
    rag_enabled: bool = True
    cfa_level: Optional[str] = "Level I"
    attachments: Optional[List[Attachment]] = None

class ChatResponse(BaseModel):
    response: str
    citations: List[Dict[str, Any]]
    provider_used: str

class MockExamRequest(BaseModel):
    topic: Optional[str] = None  # "Ethics", "Quant", "Fixed Income", "Corporate Issuers", etc.
    provider: Optional[str] = None
    cfa_level: Optional[str] = "Level I"

class FormulaRequest(BaseModel):
    formula_name: str  # "capm", "sharpe", "wacc", "tvm"
    variables: Dict[str, float]
    provider: Optional[str] = None

# --- Helper to load Starter Notes ---
def ingest_starter_notes_if_empty():
    """
    Scans the starter_notes directory and loads markdown files into ChromaDB
    if the database is currently empty.
    """
    try:
        existing_docs = rag_engine.get_all_documents()
        if not existing_docs:
            print("ChromaDB collection is empty. Bootstrapping starter notes...")
            starter_dir = settings.STARTER_NOTES_DIR
            if os.path.exists(starter_dir):
                files = os.listdir(starter_dir)
                for file in files:
                    if file.endswith(".md") or file.endswith(".txt"):
                        file_path = os.path.join(starter_dir, file)
                        print(f"Auto-ingesting: {file}")
                        rag_engine.ingest_file(file_path, file)
                print("Starter notes successfully indexed!")
            else:
                print(f"Starter notes directory '{starter_dir}' does not exist.")
        else:
            print(f"ChromaDB already initialized with {len(existing_docs)} documents.")
    except Exception as e:
        print(f"Failed to ingest starter notes during bootstrap: {e}")


@app.on_event("startup")
async def startup_event():
    # Ingest starter notes if Chroma DB has no content
    ingest_starter_notes_if_empty()


# --- API Routes ---

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "llm_provider": settings.LLM_PROVIDER,
        "embedding_provider": settings.EMBEDDING_PROVIDER,
        "chroma_dir": settings.CHROMA_DB_DIR
    }


def extract_text_from_pdf_base64(base64_str: str) -> str:
    from pypdf import PdfReader
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    try:
        pdf_bytes = base64.b64decode(base64_str)
        pdf_file = io.BytesIO(pdf_bytes)
        reader = PdfReader(pdf_file)
        text = ""
        for i, page in enumerate(reader.pages):
            t = page.extract_text()
            if t:
                text += f"\n--- Page {i+1} ---\n" + t + "\n"
        return text
    except Exception as e:
        print(f"Error reading PDF from base64: {e}")
        return f"[Error extracting PDF text: {str(e)}]"

def extract_text_from_text_base64(base64_str: str) -> str:
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    try:
        text_bytes = base64.b64decode(base64_str)
        return text_bytes.decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"Error reading Text from base64: {e}")
        return f"[Error extracting text: {str(e)}]"


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    prompt = request.prompt.strip()
    if not prompt:
        if request.attachments:
            has_image = any("image" in att.content_type.lower() or att.filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")) for att in request.attachments)
            if has_image:
                prompt = "Please analyze this attached image and explain its contents in detail."
            else:
                prompt = "Please analyze this attached document and provide a high-yield study summary."
        else:
            prompt = "Hello"
            
    provider = request.provider or settings.LLM_PROVIDER
    rag_enabled = request.rag_enabled
    
    citations = []
    context_str = ""
    
    if rag_enabled:
        # Retrieve context from ChromaDB
        matches = rag_engine.retrieve(prompt, n_results=4)
        if matches:
            context_blocks = []
            for match in matches:
                src = match["metadata"].get("source", "Unknown Doc")
                pg = match["metadata"].get("page", 1)
                context_blocks.append(f"Source: {src} | Page: {pg}\nContent: {match['content']}")
                citations.append({
                    "source": src,
                    "page": pg,
                    "preview": match["content"][:200] + "..."
                })
            context_str = "\n\n---\n\n".join(context_blocks)
            
    cfa_level = request.cfa_level or "Level I"
    # Assemble structured system prompt
    system_prompt = (
        f"You are the professional 'CFA Tutor' AI—an elite Chartered Financial Analyst helper. "
        f"The candidate is currently studying for the **CFA {cfa_level}** exam. Your style is scholarly, structured, and encouraging.\n\n"
        f"Instructions:\n"
        f"1. Present all mathematical equations using clean markdown layout (e.g. standard LaTeX-style math block format, "
        f"like $$ Formula $$ and inline like $Variable$).\n"
        f"2. Break down numerical calculations step-by-step to explain how to get from variables to final answers.\n"
        f"3. Emphasize standard terms (e.g. Standard I(A) Knowledge of the Law, DuPont Analysis, WACC, etc.).\n"
        f"4. Adapt your explanation to the curriculum focus of **CFA {cfa_level}**:\n"
    )
    if cfa_level == "Level I":
        system_prompt += "   - Focus: Knowledge, comprehension, and basic tool formulas. Explain concepts clearly and define key terms.\n"
    elif cfa_level == "Level II":
        system_prompt += "   - Focus: Application and analysis. Focus on advanced asset valuation, accounting adjustments, and standard modeling/vignettes.\n"
    elif cfa_level == "Level III":
        system_prompt += "   - Focus: Portfolio management, client constraints, asset allocation strategies, and IPS (Investment Policy Statement) objectives.\n"
    
    if rag_enabled and context_str:
        system_prompt += (
            f"\nCURRICULUM CONTEXT FROM LOCAL VECTOR STORE:\n{context_str}\n\n"
            "Use the provided context chunks above to inform your answer. Citing formulas, percentages, or guidelines directly. "
            "If the context does not fully cover the answer, state that you are incorporating general CFA curriculum "
            "knowledge, but clearly distinguish RAG textbook details from general knowledge."
        )
    else:
        system_prompt += (
            "\n(No curriculum context was loaded in RAG. Answer using your deep knowledge of the official CFA curriculum. "
            "Remind the candidate they can upload curriculum PDFs in the Documents tab for context-driven RAG citations.)"
        )
        
    # Process text and PDF attachments in memory
    injected_context = ""
    image_attachments = []
    
    if request.attachments:
        for att in request.attachments:
            c_type = att.content_type.lower()
            fname = att.filename
            b64_data = att.base64_data
            
            if "pdf" in c_type or fname.endswith(".pdf"):
                extracted = extract_text_from_pdf_base64(b64_data)
                injected_context += f"\n\n--- DIRECTLY ATTACHED PDF FILE ({fname}) ---\n{extracted}\n-----------------------------------------\n"
            elif c_type.startswith("text/") or fname.endswith((".txt", ".md", ".json", ".csv")):
                extracted = extract_text_from_text_base64(b64_data)
                injected_context += f"\n\n--- DIRECTLY ATTACHED TEXT FILE ({fname}) ---\n{extracted}\n-----------------------------------------\n"
            elif c_type.startswith("image/") or fname.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
                image_attachments.append(att)

    # Append file contents to the system prompt
    if injected_context:
        system_prompt += (
            f"\n\nTHE USER HAS DIRECTLY ATTACHED THE FOLLOWING STUDY DOCUMENTS IN THE CHAT:\n{injected_context}\n"
            "Analyze these attached files to answer the user's question directly. Prioritize the text inside these "
            "attachments if the user asks questions referring to their uploaded documents."
        )

    # Setup multimodal payload for images
    prompt_payload = prompt
    if image_attachments and provider in ["gemini", "openai"]:
        prompt_list = [{"type": "text", "text": prompt}]
        for img in image_attachments:
            b64 = img.base64_data
            if not b64.startswith("data:"):
                b64 = f"data:{img.content_type};base64,{b64}"
            prompt_list.append({
                "type": "image_url",
                "image_url": {"url": b64}
            })
        prompt_payload = prompt_list
        
    # Trigger inference
    response_text = rag_engine.query_llm(prompt_payload, system_prompt, provider=provider)
    
    return ChatResponse(
        response=response_text,
        citations=citations,
        provider_used=provider
    )


@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...), 
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    if not file.filename.endswith((".pdf", ".txt", ".md")):
        raise HTTPException(status_code=400, detail="Only .pdf, .txt, or .md files are supported.")
        
    temp_path = os.path.join(settings.UPLOAD_DIR, file.filename)
    try:
        # Save file to temp path
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        # Ingest file into RAG ChromaDB
        result = rag_engine.ingest_file(temp_path, file.filename)
        
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])
            
        return {
            "status": "success",
            "filename": file.filename,
            "chunks_created": result["chunks_created"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
    finally:
        # Clean up temporary file
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.get("/api/documents")
def get_documents():
    return rag_engine.get_all_documents()


@app.delete("/api/documents")
def delete_document(filename: str):
    success = rag_engine.delete_document(filename)
    if not success:
        raise HTTPException(status_code=404, detail=f"Document '{filename}' not found or could not be deleted.")
    return {"status": "success", "message": f"Document '{filename}' deleted from database."}


@app.post("/api/mock-exam/generate")
async def generate_mock_question(request: MockExamRequest):
    topic = request.topic or "CFA Ethics or Finance"
    provider = request.provider or settings.LLM_PROVIDER
    
    # Retrieve matching chunks to extract realistic CFA curriculum statements
    matches = rag_engine.retrieve(topic, n_results=3)
    context_str = ""
    if matches:
        context_str = "\n\n".join([m["content"] for m in matches])
        
    cfa_level = request.cfa_level or "Level I"
    system_prompt = (
        f"You are an expert CFA exam developer. "
        f"Generate a realistic, high-yield, multiple-choice practice question specifically for the **CFA {cfa_level}** exam.\n"
        f"Important Guidelines:\n"
        f"1. CFA questions MUST have exactly three options: A, B, and C. Avoid D options entirely.\n"
    )
    if cfa_level == "Level I":
        system_prompt += (
            f"2. The question should represent typical Level I depth: testing basic scenario definitions, direct formula applications, and tool comprehension in topic: {topic}.\n"
        )
    elif cfa_level == "Level II":
        system_prompt += (
            f"2. The question should represent typical Level II depth: structured as a mini-vignette, testing multi-variable asset valuation, corporate adjustments, or advanced ethical standards application in topic: {topic}.\n"
        )
    elif cfa_level == "Level III":
        system_prompt += (
            f"2. The question should represent typical Level III depth: focusing on portfolio management, wealth planning scenario analysis, client Investment Policy Statement (IPS) applications, or institutional asset allocation in topic: {topic}.\n"
        )
        
    system_prompt += (
        "3. Respond in strict, valid JSON format matching this schema:\n"
        "{\n"
        '  "question": "A detailed question description...",\n'
        '  "options": {\n'
        '    "A": "Option A explanation text...",\n'
        '    "B": "Option B explanation text...",\n'
        '    "C": "Option C explanation text..."\n'
        "  },\n"
        '  "correct_answer": "A",\n'
        '  "explanation": "A comprehensive breakdown citing specific standards, guidelines, or calculations."\n'
        "}\n"
        "Ensure all JSON strings are properly escaped. Return ONLY the raw JSON block without markdown wrappers."
    )
    
    user_prompt = f"Topic area: {topic}\n"
    if context_str:
        user_prompt += f"Use this curriculum context as guidance:\n{context_str}"
        
    raw_response = rag_engine.query_llm(user_prompt, system_prompt, provider=provider)
    
    # Clean possible markdown wrapping
    cleaned = raw_response.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    
    import json
    try:
        question_data = json.loads(cleaned)
        return question_data
    except Exception as e:
        print(f"Failed to parse LLM JSON question. Raw content: {cleaned}. Error: {e}")
        # Return a fallback static question to guarantee robust UI operations
        return {
            "question": "An analyst receives an invitation from a broker to visit an investment site in a remote area. The broker offers to pay for the analyst's business-class airfare, luxury hotel, and dining expenses. Under the CFA Institute Code of Ethics, what is the analyst's most appropriate action?",
            "options": {
                "A": "Accept the offer in full, as it relates to business diligence and does not influence independence.",
                "B": "Reject the offer and pay for all travel and accommodation expenses personally to maintain objectivity.",
                "C": "Accept the travel and hotel stay but pay for the dining expenses, reporting the gift to the supervisor."
            },
            "correct_answer": "B",
            "explanation": "According to Standard I(B) Independence and Objectivity, analysts must maintain objectivity. While broker-sponsored travel is occasionally acceptable if business necessary, the best practice to avoid conflicts of interest is for the analyst's own employer to pay for all travel and accommodations (a 'pay-your-own-way' policy)."
        }


@app.post("/api/formula/explain")
def calculate_and_explain_formula(request: FormulaRequest):
    name = request.formula_name.lower()
    vars = request.variables
    provider = request.provider or settings.LLM_PROVIDER
    
    result_val = 0.0
    formula_notation = ""
    math_details = ""
    
    try:
        if name == "capm":
            rf = vars["rf"]
            beta = vars["beta"]
            mkt = vars["mkt"]
            # CAPM = Rf + Beta * (Rm - Rf)
            result_val = rf + beta * (mkt - rf)
            formula_notation = "E(R) = R_f + \\beta \\times (R_m - R_f)"
            math_details = (
                f"Risk-free Rate ($R_f$) = {rf:.2%}\n"
                f"Beta ($\\beta$) = {beta:.2f}\n"
                f"Expected Market Return ($R_m$) = {mkt:.2%}\n"
                f"Market Risk Premium ($R_m - R_f$) = {(mkt - rf):.2%}\n"
                f"Result: Expected Return = {rf:.4f} + {beta:.2f} \\times ({mkt:.4f} - {rf:.4f}) = {result_val:.2%}"
            )
            
        elif name == "sharpe":
            rp = vars["rp"]
            rf = vars["rf"]
            std = vars["std"]
            # Sharpe = (Rp - Rf) / Std
            if std == 0:
                raise ValueError("Standard deviation cannot be zero.")
            result_val = (rp - rf) / std
            formula_notation = "Sharpe\\ Ratio = \\frac{R_p - R_f}{\\sigma_p}"
            math_details = (
                f"Portfolio Return ($R_p$) = {rp:.2%}\n"
                f"Risk-free Rate ($R_f$) = {rf:.2%}\n"
                f"Portfolio Standard Deviation ($\\sigma_p$) = {std:.2%}\n"
                f"Result: Sharpe Ratio = \\frac{{ {rp:.4f} - {rf:.4f} }}{{ {std:.4f} }} = {result_val:.4f}"
            )
            
        elif name == "wacc":
            equity = vars["equity"]
            debt = vars["debt"]
            re = vars["re"]
            rd = vars["rd"]
            tax = vars["tax"]
            
            total_val = equity + debt
            if total_val == 0:
                raise ValueError("Total value (Equity + Debt) cannot be zero.")
            
            we = equity / total_val
            wd = debt / total_val
            # WACC = (We * Re) + (Wd * Rd * (1 - Tc))
            result_val = (we * re) + (wd * rd * (1 - tax))
            formula_notation = "WACC = \\left(\\frac{E}{V} \\times R_e\\right) + \\left(\\frac{D}{V} \\times R_d \\times (1 - T_c)\\right)"
            math_details = (
                f"Equity = {equity:,.2f} | Debt = {debt:,.2f} | Total Value ($V$) = {total_val:,.2f}\n"
                f"Equity Weight ($E/V$) = {we:.2%} | Debt Weight ($D/V$) = {wd:.2%}\n"
                f"Cost of Equity ($R_e$) = {re:.2%} | Cost of Debt ($R_d$) = {rd:.2%}\n"
                f"Tax Rate ($T_c$) = {tax:.2%}\n"
                f"Result: WACC = ({we:.4f} \\times {re:.4f}) + ({wd:.4f} \\times {rd:.4f} \\times (1 - {tax:.4f})) = {result_val:.2%}"
            )
            
        elif name == "tvm":
            fv = vars["fv"]
            rate = vars["rate"]
            n = vars["n"]
            # PV = FV / (1 + r)^n
            result_val = fv / ((1 + rate) ** n)
            formula_notation = "PV = \\frac{FV}{(1 + r)^n}"
            math_details = (
                f"Future Value ($FV$) = {fv:,.2f}\n"
                f"Discount Rate ($r$) = {rate:.2%}\n"
                f"Periods ($n$) = {n:.1f}\n"
                f"Result: Present Value = \\frac{{ {fv:,.2f} }}{{ (1 + {rate:.4f})^{{{n:.1f}}} }} = {result_val:,.2f}"
            )
            
        else:
            raise HTTPException(status_code=400, detail=f"Formula '{name}' is not supported.")
            
    except Exception as calculation_error:
        raise HTTPException(status_code=400, detail=f"Calculation Error: {str(calculation_error)}")

    # Ask the LLM to write a professional explanation of this exact calculation
    system_prompt = (
        "You are the premium 'CFA Tutor' AI. "
        "A student has just calculated a financial formula. "
        "Provide a high-yield, academic explanation of the result, what it represents, "
        "how it is used in the CFA curriculum, and its portfolio/corporate application.\n"
        "Important Guidelines:\n"
        "1. Address the student directly and keep the tone professional.\n"
        "2. Do not recalculate. Use the mathematically correct details provided in the prompt.\n"
        "3. Highlight key qualitative concepts (e.g. CAPM: systematic risk, SML; Sharpe: risk-adjusted performance; "
        "WACC: hurdle rate, optimal capital structure; TVM: discounting cash flows).\n"
        "4. Keep the explanation concise, high-yield, and focused on CFA preparation."
    )
    
    user_prompt = (
        f"Formula calculated: {name.upper()}\n"
        f"Formula Notation: $${formula_notation}$$\n"
        f"Calculation Steps:\n{math_details}\n"
        f"Calculated Value: {result_val:,.4f}"
    )
    
    ai_explanation = rag_engine.query_llm(user_prompt, system_prompt, provider=provider)
    
    return {
        "formula_name": name.upper(),
        "calculated_value": result_val,
        "math_details": math_details,
        "formula_notation": formula_notation,
        "ai_explanation": ai_explanation
    }
