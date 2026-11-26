import "./App.css";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);

  const [question, setQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [asking, setAsking] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-scroll reference
  const chatEndRef = useRef(null);

  async function loadDocuments() {
    try {
      const response = await fetch("http://127.0.0.1:8000/documents");

      if (!response.ok) {
        throw new Error("Failed to fetch documents.");
      }

      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error("Error loading documents:", error);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  // Auto-scroll whenever messages change or AI is responding
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, asking]);

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e) {
  e.preventDefault();
  setIsDragging(false);

  const file = e.dataTransfer.files[0];

  if (file && file.type === "application/pdf") {
    setSelectedFile(file);
    setUploadMessage("");
  } else if (file) {
    setUploadMessage("Please select a PDF file.");
  }
}
  async function handleUpload() {
    if (!selectedFile) {
      setUploadMessage("Please select a PDF first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setUploading(true);
    setUploadMessage("");

    try {
      const response = await fetch("http://127.0.0.1:8000/upload-pdf", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Upload failed.");
      }

      setUploadMessage("PDF uploaded successfully!");
      setSelectedFile(null);

      await loadDocuments();
    } catch (error) {
      setUploadMessage(error.message || "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDocument(documentId, filename) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${filename}"?`,
    );

    if (!confirmed) return;

    setDeletingId(documentId);
    setDeleteMessage("");

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/documents/${documentId}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Failed to delete document.",
        );
      }

      if (selectedDocument?.document_id === documentId) {
        setSelectedDocument(null);
        setChatMessages([]);
        setQuestion("");
        setCopiedIndex(null);
      }

      setDeleteMessage("Document deleted successfully.");

      await loadDocuments();
    } catch (error) {
      setDeleteMessage(error.message || "Failed to delete document.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleChatSubmit(e, suggestedQuestion = "") {
    if (e) e.preventDefault();

    const userQuestion = (suggestedQuestion || question).trim();

    if (!userQuestion || !selectedDocument || asking) return;

    setChatMessages((prev) => [...prev, { role: "user", text: userQuestion }]);

    setQuestion("");
    setAsking(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: userQuestion,
          document_id: selectedDocument.document_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Failed to get an answer.",
        );
      }

      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.answer,
          sources: data.sources || [],
        },
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `**Error:** ${error.message || "Unable to get an answer."}`,
          sources: [],
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  function handleNewChat() {
    setChatMessages([]);
    setQuestion("");
    setCopiedIndex(null);
  }

  async function handleCopyAnswer(text, index) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);

      setTimeout(() => {
        setCopiedIndex(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy answer:", error);
      alert("Unable to copy. Please try again.");
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">✦</div>
          <h2>DocuMind</h2>
        </div>

        <button className="new-chat" onClick={handleNewChat}>
          + New Conversation
        </button>

        <div className="sidebar-section">
          <p className="section-label">WORKSPACE</p>
          <div className="sidebar-item active">▣ Documents</div>
          <div className="sidebar-item">◷ History</div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-item">⚙ Settings</div>

          <div className="profile">
            <div className="avatar">C</div>
            <div>
              <p>My Workspace</p>
              <span>Personal Account</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace / Documents</span>
          </div>

          <div className="status">
            <span className="status-dot"></span>
            AI Assistant
          </div>
        </header>

        <div className="content">
          <div className="welcome">
            <span className="welcome-tag">AI DOCUMENT ASSISTANT</span>

            <h1>
              Your documents,
              <br />
              understood.
            </h1>

            <p>
              Upload your PDFs, ask questions, and get intelligent answers
              grounded in your documents.
            </p>
          </div>

          <section className="upload-section">
            <div className="section-heading">
              <h2>Upload a document</h2>
              <span>PDF files only</span>
            </div>

            <div
              className={`upload-box ${isDragging ? "dragging" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="upload-icon">↑</div>

              <h3>Drop your PDF here</h3>
              <p>or browse files from your computer</p>

              <input
                type="file"
                accept=".pdf,application/pdf"
                hidden
                id="pdf-input"
                onChange={(e) => {
                  const file = e.target.files[0];

                  if (file && file.type === "application/pdf") {
                    setSelectedFile(file);
                    setUploadMessage("");
                  } else if (file) {
                    setUploadMessage("Please select a PDF file.");
                  }
                }}
              />

              <label htmlFor="pdf-input" className="browse-button">
                Browse Files
              </label>

              {selectedFile && (
                <p className="selected-file">Selected: {selectedFile.name}</p>
              )}

              <button
                className="upload-action"
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
              >
                {uploading ? "Uploading..." : "Upload PDF"}
              </button>

              {uploadMessage && (
                <p className="upload-message">{uploadMessage}</p>
              )}

              <span className="upload-hint">Supported format: PDF</span>
            </div>
          </section>

          <section className="documents-section">
            <div className="section-heading">
              <h2>Your documents</h2>
              <span>{documents.length} documents</span>
            </div>

            {deleteMessage && <p className="delete-message">{deleteMessage}</p>}

            {documents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">▤</div>

                <h3>No documents yet</h3>

                <p>
                  Upload your first PDF to start asking questions about its
                  contents.
                </p>
              </div>
            ) : (
              <div className="document-list">
                {documents.map((doc) => (
                  <div
                    className={`document-card ${
                      selectedDocument?.document_id === doc.document_id
                        ? "selected"
                        : ""
                    }`}
                    key={doc.document_id}
                    onClick={() => {
                      setSelectedDocument(doc);
                      setChatMessages([]);
                      setQuestion("");
                      setCopiedIndex(null);
                    }}
                  >
                    <div className="document-icon">PDF</div>

                    <div className="document-info">
                      <h3>{doc.filename}</h3>
                      <p>{doc.total_pages_stored} pages stored</p>
                    </div>

                    <button
                      className="delete-document"
                      title="Delete document"
                      disabled={deletingId === doc.document_id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDocument(doc.document_id, doc.filename);
                      }}
                    >
                      {deletingId === doc.document_id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {selectedDocument && (
            <section className="chat-section">
              <div className="section-heading chat-heading">
                <div>
                  <h2>Chat with document</h2>
                  <span>{selectedDocument.filename}</span>
                </div>

                <button
                  className="clear-chat"
                  onClick={handleNewChat}
                  disabled={asking || chatMessages.length === 0}
                  title="Clear conversation"
                >
                  ↺ Clear chat
                </button>
              </div>

              <div className="chat-box">
                <div className="chat-messages">
                  {chatMessages.length === 0 && !asking ? (
                    <div className="chat-placeholder">
                      <div className="chat-placeholder-icon">✦</div>

                      <h3>Ask anything about your document</h3>

                      <p>
                        Ask questions and get answers based on{" "}
                        {selectedDocument.filename}.
                      </p>

                      <div className="suggested-questions">
                        <button
                          type="button"
                          onClick={() =>
                            handleChatSubmit(null, "Summarize this document.")
                          }
                          disabled={asking}
                        >
                          Summarize this document
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleChatSubmit(null, "What are the key topics?")
                          }
                          disabled={asking}
                        >
                          What are the key topics?
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleChatSubmit(null, "Explain the main concepts.")
                          }
                          disabled={asking}
                        >
                          Explain the main concepts
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleChatSubmit(
                              null,
                              "What are the important points?",
                            )
                          }
                          disabled={asking}
                        >
                          What are the important points?
                        </button>
                      </div>
                    </div>
                  ) : (
                    chatMessages.map((message, index) => (
                      <div
                        className={`chat-message ${message.role}`}
                        key={index}
                      >
                        <span className="message-label">
                          {message.role === "user" ? "You" : "DocuMind"}
                        </span>

                        {message.role === "assistant" ? (
                          <>
                            <div className="markdown-content">
                              <ReactMarkdown>{message.text}</ReactMarkdown>
                            </div>

                            <button
                              className="copy-answer"
                              onClick={() =>
                                handleCopyAnswer(message.text, index)
                              }
                              title="Copy answer"
                            >
                              {copiedIndex === index ? "✓ Copied!" : "▢ Copy"}
                            </button>
                          </>
                        ) : (
                          <p>{message.text}</p>
                        )}

                        {message.sources && message.sources.length > 0 && (
                          <div className="message-sources">
                            <strong>Sources</strong>

                            {message.sources.map((source, sourceIndex) => (
                              <div className="source-item" key={sourceIndex}>
                                <span className="source-file">
                                  {source.filename || selectedDocument.filename}
                                </span>

                                <span className="source-page">
                                  Page {source.page}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {asking && (
                    <div className="chat-message assistant">
                      <span className="message-label">DocuMind</span>
                      <p>
                        Thinking... retrieving relevant information.
                        <span className="thinking-dots">
                          <span></span>
                          <span></span>
                          <span></span>
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Auto-scroll target */}
                  <div ref={chatEndRef} />
                </div>

                <form className="chat-form" onSubmit={handleChatSubmit}>
                  <input
                    type="text"
                    placeholder="Ask a question about this PDF..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    disabled={asking}
                  />

                  <button type="submit" disabled={asking || !question.trim()}>
                    {asking ? "..." : "Send ↑"}
                  </button>
                </form>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
