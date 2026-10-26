
from embeddings import model
from vector_store import store_chunks, search_chunks

# Sample document chunks
sample_chunks = [
    {
        "chunk_id": 1,
        "page": 1,
        "text": "Machine learning enables computers to learn patterns from data."
    },
    {
        "chunk_id": 2,
        "page": 2,
        "text": "Plants use sunlight to produce food through photosynthesis."
    },
    {
        "chunk_id": 3,
        "page": 3,
        "text": "Neural networks are inspired by the structure of the human brain."
    }
]

# Step 1: Generate embeddings for the sample chunks
texts = [chunk["text"] for chunk in sample_chunks]

vectors = model.encode(
    texts,
    normalize_embeddings=True
)

for chunk, vector in zip(sample_chunks, vectors):
    chunk["embedding"] = vector.tolist()

# Step 2: Store chunks in ChromaDB
store_chunks(sample_chunks)

# Step 3: Ask a question
question = "How do computers learn from information?"

# Convert the question into an embedding
query_embedding = model.encode(
    question,
    normalize_embeddings=True
).tolist()

# Step 4: Retrieve relevant chunks
matches = search_chunks(query_embedding, top_k=2)

print("\nQuestion:", question)
print("\nRetrieved chunks:")

for match in matches:
    print("\nPage:", match["page"])
    print("Text:", match["text"])
    print("Distance:", match["distance"])
