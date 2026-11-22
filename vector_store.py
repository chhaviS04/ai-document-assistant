
import chromadb

client = chromadb.PersistentClient(
    path="./chroma_db"
)

collection = client.get_or_create_collection(
    name="document_chunks"
)


def store_chunks(chunks):
    if not chunks:
        return

    collection.upsert(
        ids=[
            f"{chunk['document_id']}_{chunk['chunk_id']}"
            for chunk in chunks
        ],
        embeddings=[
            chunk["embedding"]
            for chunk in chunks
        ],
        documents=[
            chunk["text"]
            for chunk in chunks
        ],
        metadatas=[
            {
                "page": chunk["page"],
                "document_id": chunk["document_id"],
                "filename": chunk["filename"]
            }
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
            "document_id": results["metadatas"][0][i]["document_id"],
            "filename": results["metadatas"][0][i]["filename"],
            "distance": results["distances"][0][i]
        })

    return matches
