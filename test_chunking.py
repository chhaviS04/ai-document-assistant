
from chunking import chunk_pages

sample_pages = [
    {
        "page": 1,
        "text": (
            "Artificial Intelligence enables machines to perform tasks "
            "that usually require human intelligence. "
        ) * 30
    },
    {
        "page": 2,
        "text": (
            "Retrieval-Augmented Generation retrieves relevant information "
            "before generating an answer. "
        ) * 25
    }
]

chunks = chunk_pages(
    sample_pages,
    chunk_size=300,
    overlap=50
)

print("Total chunks:", len(chunks))

for chunk in chunks:
    print("\nChunk ID:", chunk["chunk_id"])
    print("Page:", chunk["page"])
    print("Text length:", len(chunk["text"]))
    print("Text preview:", chunk["text"][:100])
