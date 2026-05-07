import os
from pathlib import Path
from functools import lru_cache

import google.generativeai as genai
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from dotenv import load_dotenv

load_dotenv()


BASE_DIR   = Path(__file__).parent
CHROMA_DIR = str(BASE_DIR / "chroma_db")


EMBED_MODEL    = "sentence-transformers/all-MiniLM-L6-v2"
GEMINI_MODEL   = "gemini-3.1-flash-lite-preview"
API_KEY        = os.environ.get("GEMINI_API_KEY")


MMR_K          = 5
MMR_FETCH_K    = 15
MMR_LAMBDA     = 0.6


SYSTEM_PROMPT = """You are a helpful medical information assistant for PneumaVision, 
a chest X-ray analysis application. You have access to a knowledge base covering 
14 chest conditions that the application can detect.

Your strict rules:
- Answer ONLY using the context provided to you in each message.
- Do NOT use any medical knowledge outside of what is in the provided context.
- If the answer is not found in the context, say clearly:
  "I don't have information about that in my knowledge base. Please consult 
   a qualified healthcare professional for questions beyond the 14 conditions 
   I cover."
- Do NOT provide personal medical advice, diagnosis, or treatment plans.
- Always remind users that PneumaVision is an AI tool and not a substitute 
  for professional medical evaluation.
- Keep answers clear, well-structured, and in plain English.
- If the user asks something completely unrelated to chest conditions or 
  radiology, politely redirect them to ask about the 14 conditions covered.
- You may use bullet points or short paragraphs to make answers easy to read."""


_embeddings  = None
_vectorstore = None


def _load_resources():
    """Load embedding model and ChromaDB from disk. Called once at startup."""
    global _embeddings, _vectorstore

    if _vectorstore is not None:
        return   # already loaded

    if not Path(CHROMA_DIR).exists():
        raise RuntimeError(
            f"ChromaDB not found at {CHROMA_DIR}.\n"
            "Please run build_vectordb.py first to create the vector database."
        )

    print("[RAG] Loading embedding model...")
    _embeddings = HuggingFaceEmbeddings(
        model_name=EMBED_MODEL,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )

    print(f"[RAG] Loading ChromaDB from {CHROMA_DIR}...")
    _vectorstore = Chroma(
        persist_directory=CHROMA_DIR,
        embedding_function=_embeddings,
        collection_name="pneumavision_kb",
    )
    count = _vectorstore._collection.count()
    print(f"[RAG] Vector store ready — {count} chunks loaded")


def _retrieve_chunks(question: str) -> list[str]:
    """
    Use MMR to retrieve the most relevant AND diverse chunks for the question.
    MMR prevents returning near-duplicate chunks about the same sub-topic.
    """
    retriever = _vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k":           MMR_K,
            "fetch_k":     MMR_FETCH_K,
            "lambda_mult": MMR_LAMBDA,
        },
    )
    docs = retriever.invoke(question)
    return [doc.page_content for doc in docs]


def _build_user_message(context_chunks: list[str], question: str) -> str:
    """Combine retrieved chunks and the question into a single prompt message."""
    context = "\n\n---\n\n".join(context_chunks)
    return f"""Use the following excerpts from the PneumaVision knowledge base to answer the question.

KNOWLEDGE BASE CONTEXT:
{context}

---

USER QUESTION: {question}

Answer based strictly on the context above."""


def ask_knowledge_chatbot(question: str, history: list[dict]) -> str:
    if not API_KEY:
        raise ValueError("GEMINI_API_KEY not set in environment / .env file.")

    # Ensure resources are loaded (no-op after first call)
    _load_resources()

    # Step 1: Retrieve relevant chunks using MMR
    chunks = _retrieve_chunks(question)

    if not chunks:
        return (
            "I wasn't able to find relevant information in my knowledge base "
            "for that question. Please try rephrasing or ask about one of the "
            "14 chest conditions covered by PneumaVision."
        )

    # Step 2: Build the prompt with retrieved context
    user_message = _build_user_message(chunks, question)

    # Step 3: Call Gemini with conversation history for multi-turn support
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        system_instruction=SYSTEM_PROMPT,
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            top_p=0.9,
            max_output_tokens=1024,
        ),
    )

    chat     = model.start_chat(history=history)
    response = chat.send_message(user_message)
    return response.text