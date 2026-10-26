
def chunk_pages(pages, chunk_size=1000, overlap=150):
    """
    Split extracted PDF pages into smaller overlapping chunks.

    Each chunk keeps its original page number.
    """
    if chunk_size <= 0:
        raise ValueError("chunk_size must be greater than zero.")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be >= 0 and smaller than chunk_size.")

    chunks = []
    step = chunk_size - overlap

    for page_data in pages:
        page_number = page_data["page"]
        text = page_data.get("text", "").strip()

        if not text:
            continue

        start = 0

        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunk_text = text[start:end].strip()

            if chunk_text:
                chunks.append({
                    "chunk_id": len(chunks) + 1,
                    "page": page_number,
                    "text": chunk_text
                })

            if end == len(text):
                break

            start += step

    return chunks
