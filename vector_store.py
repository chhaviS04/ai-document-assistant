
import chromadb

# Create a local, persistent vector database
client = chromadb.PersistentClient(
    path="./chroma_db"
)

# Create or reuse a collection
collection = client.get_or_create_collection(
    name="document_chunks"
)


def store_chunks(chunks):
    if not chunks:
        return

    collection.upsert(
        ids=[str(chunk["chunk_id"]) for chunk in chunks],
        embeddings=[chunk["embedding"] for chunk in chunks],
        documents=[chunk["text"] for chunk in chunks],
        metadatas=[
            {"page": chunk["page"]}
            for chunk in chunks
        ]
    )

    print(f"Stored {len(chunks)} chunks successfully.")


def search_chunks(query_embedding, top_k=3):
    if collection.count() == 0:
        return []

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count())
    )

    matches = []

    for i in range(len(results["ids"][0])):
        matches.append({
            "chunk_id": results["ids"][0][i],
            "text": results["documents"][0][i],
            "page": results["metadatas"][0][i]["page"],
            "distance": results["distances"][0][i]
        })

    return matches
