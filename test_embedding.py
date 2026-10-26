
from embeddings import generate_embeddings

sample_chunks = [
    {
        "chunk_id": 1,
        "page": 1,
        "text": "Machine learning enables computers to learn from data."
    },
    {
        "chunk_id": 2,
        "page": 2,
        "text": "Plants use sunlight to produce their food."
    }
]

results = generate_embeddings(sample_chunks)

print("\nTotal chunks:", len(results))

for item in results:
    print("\nChunk ID:", item["chunk_id"])
    print("Page:", item["page"])
    print("Embedding dimensions:", len(item["embedding"]))
    print("First five numbers:", item["embedding"][:5])
