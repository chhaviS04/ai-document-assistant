
from sentence_transformers import SentenceTransformer

# Load the embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")


def generate_embeddings(chunks):
    """
    Generate an embedding vector for each text chunk.
    """
    if not chunks:
        return []

    texts = [chunk["text"] for chunk in chunks]

    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=True
    )

    results = []

    for chunk, embedding in zip(chunks, embeddings):
        results.append({
            **chunk,
            "embedding": embedding.tolist()
        })

    return results
