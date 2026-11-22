
from fastapi import FastAPI, UploadFile, File, HTTPException
from pypdf import PdfReader
from io import BytesIO
import pytesseract
import pypdfium2 as pdfium
import uuid

from chunking import chunk_pages
from embeddings import generate_embeddings
from vector_store import store_chunks

app = FastAPI(title="AI Document Assistant")

pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)


@app.get("/")
def home():
    return {"message": "AI Document Assistant is running!"}


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

            if not text.strip():
                pdf_page = pdf_document[index]
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

        # Step 2: Assign a unique document ID
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
