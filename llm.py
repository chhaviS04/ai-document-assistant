from fastapi import HTTPException
from google import genai

# Initialize Gemini client using the API key
# stored in the environment variable
client = genai.Client()


def generate_answer(query, retrieved_chunks):
    """
    Generate an answer using the user's question
    and retrieved document chunks.
    """

    # Build context from the retrieved chunks
    context = ""

    for chunk in retrieved_chunks:
        context += (
            f"\n[Page {chunk['page']}]\n"
            f"{chunk['text']}\n"
        )

    prompt = f"""
    You are an AI document assistant.

    Answer the user's question using ONLY the
    information provided in the context.

    If the answer is not present in the context,
    clearly say that the document does not
    contain sufficient information.

    Include page numbers in your answer
    wherever relevant.

    Context:
    {context}

    Question:
    {query}

    Answer:
    """

    try:
        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt
        )

        return response.text

    except Exception as e:
        print(f"Gemini API Error: {e}")

        raise HTTPException(
            status_code=503,
            detail="The AI service is temporarily unavailable. Please try again later."
        )    