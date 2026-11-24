
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from pypdf import PdfReader
from io import BytesIO
import pytesseract
import pypdfium2 as pdfium
import uuid
from fastapi.middleware.cors import CORSMiddleware

from chunking import chunk_pages
from embeddings import generate_embeddings, embed_query
from vector_store import store_chunks, search_chunks, list_documents, delete_document
from llm import generate_answer


app = FastAPI(title="AI Document Assistant")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Configure Tesseract OCR
pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)


# Request model for question-answering endpoint
class QuestionRequest(BaseModel):
    query: str
    document_id: str | None = None


@app.get("/")
def home():
    return {"message": "AI Document Assistant is running!"}


# PDF Upload Endpoint
@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF file."
        )

    contents = await file.read()

    try:
        reader = PdfReader(BytesIO(contents))
        pdf_document = pdfium.PdfDocument(contents)

        extracted_pages = []

        for index, page in enumerate(reader.pages):

            text = page.extract_text() or ""
            method = "text extraction"

            # OCR fallback for scanned pages
            if not text.strip():

                pdf_page = pdfium.PdfDocument(contents)[index]
                bitmap = pdf_page.render(scale=2)
                image = bitmap.to_pil()

                text = pytesseract.image_to_string(
                    image,
                    lang="eng"
                )

                method = "OCR"
                pdf_page.close()

            extracted_pages.append({
                "page": index + 1,
                "method": method,
                "text": text.strip()
            })

        pdf_document.close()

        # Step 1: Chunk extracted pages
        chunks = chunk_pages(extracted_pages)

        # Step 2: Assign unique document ID
        document_id = str(uuid.uuid4())

        # Step 3: Add document metadata
        for chunk in chunks:
            chunk["document_id"] = document_id
            chunk["filename"] = file.filename

        # Step 4: Generate embeddings
        embedded_chunks = generate_embeddings(chunks)

        # Step 5: Store embedded chunks
        store_chunks(embedded_chunks)

        return {
            "filename": file.filename,
            "document_id": document_id,
            "total_pages": len(extracted_pages),
            "total_chunks": len(embedded_chunks),
            "message": "PDF processed and stored successfully."
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not process PDF: {str(e)}"
        )

    finally:
        await file.close()


# Question Answering Endpoint
@app.post("/ask")
def ask_question(request: QuestionRequest):
    query = request.query.strip()

    if not query:
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty."
        )

    query_embedding = embed_query(query)

    retrieved_chunks = search_chunks(
        query_embedding,
        top_k=3,
        document_id=request.document_id
    )

    if not retrieved_chunks:
        return {
            "query": query,
            "answer": "No relevant information found in the selected document.",
            "sources": []
        }

    answer = generate_answer(query, retrieved_chunks)

    sources = []
    seen_sources = set()

    for chunk in retrieved_chunks:
        source_key = (chunk["document_id"], chunk["page"])

        if source_key not in seen_sources:
            seen_sources.add(source_key)

            sources.append({
                "filename": chunk["filename"],
                "page": chunk["page"],
                "document_id": chunk["document_id"]
            })

    return {
        "query": query,
        "answer": answer,
        "sources": sources
    }

@app.get("/documents")
def get_documents():
    return list_documents()

@app.delete("/documents/{document_id}")
def remove_document(document_id: str):

    documents = list_documents()

    document_exists = any(
        doc["document_id"] == document_id
        for doc in documents
    )

    if not document_exists:
        raise HTTPException(
            status_code=404,
            detail="Document not found."
        )

    delete_document(document_id)

    return {
        "message": "Document deleted successfully.",
        "document_id": document_id
    }