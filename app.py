
from fastapi import FastAPI, UploadFile, File, HTTPException
from pypdf import PdfReader
from io import BytesIO
import pytesseract
import pypdfium2 as pdfium

app = FastAPI(title="AI Document Assistant")

# Tell Python where Tesseract is installed on Windows.
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
            # First, try normal text extraction.
            text = page.extract_text() or ""
            method = "text extraction"

            # If no text exists, use OCR.
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

        return {
            "filename": file.filename,
            "total_pages": len(extracted_pages),
            "pages": extracted_pages
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not process PDF: {str(e)}"
        )

    finally:
        await file.close()
