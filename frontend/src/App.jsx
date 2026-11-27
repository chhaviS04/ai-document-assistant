
import "./App.css";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

function getChatStorageKey(documentId) {
  return `documind_chat_${documentId}`;
}

function getSessionsStorageKey(documentId) {
  return `documind_sessions_${documentId}`;
}

function createSessionId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createSession() {
  return {
    id: createSessionId(),
    title: "New conversation",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Load sessions and migrate old single-chat data if needed
function loadSessions(documentId) {
  if (!documentId) return [];

  try {
    const savedSessions = localStorage.getItem(
      getSessionsStorageKey(documentId)
    );

    if (savedSessions) {
      const parsed = JSON.parse(savedSessions);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    // Migrate older chat storage
    const oldChat = localStorage.getItem(
      getChatStorageKey(documentId)
    );

    if (oldChat) {
      const messages = JSON.parse(oldChat);

      if (Array.isArray(messages) && messages.length > 0) {
        const firstUserMessage = messages.find(
          (message) => message.role === "user"
        );

        const migratedSession = {
          id: createSessionId(),
          title: firstUserMessage?.text?.slice(0, 70) || "Previous conversation",
          messages,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const sessions = [migratedSession];

        localStorage.setItem(
          getSessionsStorageKey(documentId),
          JSON.stringify(sessions)
        );

        localStorage.removeItem(getChatStorageKey(documentId));

        return sessions;
      }
    }
  } catch (error) {
    console.error("Error loading conversations:", error);
  }

  return [];
}

function saveSessions(documentId, sessions) {
  if (!documentId) return;

  localStorage.setItem(
    getSessionsStorageKey(documentId),
    JSON.stringify(sessions)
  );
}

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [activeView, setActiveView] = useState("documents");

  const [question, setQuestion] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [asking, setAsking] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  const [deletingId, setDeletingId] = useState(null);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // References
  const chatEndRef = useRef(null);
  const documentsSectionRef = useRef(null);
  const historySectionRef = useRef(null);
  const chatSectionRef = useRef(null);

  async function loadDocuments() {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/documents"
      );

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

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [chatMessages, asking]);

  // Save current session
  function persistSession(documentId, sessionId, messages) {
    if (!documentId || !sessionId) return;

    const existingSessions = loadSessions(documentId);
    const existingSession = existingSessions.find(
      (session) => session.id === sessionId
    );

    const firstUserMessage = messages.find(
      (message) => message.role === "user"
    );

    const updatedSession = {
      id: sessionId,
      title:
        firstUserMessage?.text?.slice(0, 70) ||
        existingSession?.title ||
        "New conversation",
      messages,
      createdAt:
        existingSession?.createdAt ||
        new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedSessions = existingSessions.some(
      (session) => session.id === sessionId
    )
      ? existingSessions.map((session) =>
          session.id === sessionId
            ? updatedSession
            : session
        )
      : [...existingSessions, updatedSession];

    saveSessions(documentId, updatedSessions);

    // Update React state only for the currently selected document
    if (
      selectedDocument?.document_id === documentId
    ) {
      setSessions(updatedSessions);
    }
  }

  // Select a document and load its most recent conversation
  function handleSelectDocument(doc) {
    if (asking) return;

    const loadedSessions = loadSessions(doc.document_id);

    setSelectedDocument(doc);
    setSessions(loadedSessions);
    setQuestion("");
    setCopiedIndex(null);

    if (loadedSessions.length > 0) {
      const sortedSessions = [...loadedSessions].sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt) -
          new Date(a.updatedAt || a.createdAt)
      );

      const latestSession = sortedSessions[0];

      setSelectedSessionId(latestSession.id);
      setChatMessages(latestSession.messages || []);
    } else {
      const newSession = createSession();

      setSessions([newSession]);
      setSelectedSessionId(newSession.id);
      setChatMessages([]);

      saveSessions(doc.document_id, [newSession]);
    }
  }

  // Create a new conversation for the currently selected document
  function handleNewChat() {
    if (asking || !selectedDocument) return;

    const newSession = createSession();

    const updatedSessions = [
      ...sessions,
      newSession,
    ];

    setSessions(updatedSessions);
    saveSessions(
      selectedDocument.document_id,
      updatedSessions
    );

    setSelectedSessionId(newSession.id);
    setChatMessages([]);
    setQuestion("");
    setCopiedIndex(null);
    setActiveView("documents");

    setTimeout(() => {
      chatSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  // Open a specific session
  function handleOpenHistory(entry) {
    if (asking) return;

    const doc = entry.document;
    const sessionId = entry.session.id;

    const loadedSessions = loadSessions(doc.document_id);

    const session = loadedSessions.find(
      (item) => item.id === sessionId
    );

    if (!session) return;

    setSelectedDocument(doc);
    setSessions(loadedSessions);
    setSelectedSessionId(session.id);
    setChatMessages(session.messages || []);
    setQuestion("");
    setCopiedIndex(null);
    setActiveView("documents");

    setTimeout(() => {
      chatSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
  }

  // Delete a specific conversation
  function handleDeleteConversation(documentId, sessionId) {
    const confirmed = window.confirm(
      "Delete this conversation permanently?"
    );

    if (!confirmed) return;

    const loadedSessions = loadSessions(documentId);

    const updatedSessions = loadedSessions.filter(
      (session) => session.id !== sessionId
    );

    saveSessions(documentId, updatedSessions);

    if (
      selectedDocument?.document_id === documentId
    ) {
      setSessions(updatedSessions);

      if (selectedSessionId === sessionId) {
        if (updatedSessions.length > 0) {
          const latest = [...updatedSessions].sort(
            (a, b) =>
              new Date(b.updatedAt || b.createdAt) -
              new Date(a.updatedAt || a.createdAt)
          )[0];

          setSelectedSessionId(latest.id);
          setChatMessages(latest.messages || []);
        } else {
          const newSession = createSession();

          setSessions([newSession]);
          saveSessions(documentId, [newSession]);
          setSelectedSessionId(newSession.id);
          setChatMessages([]);
        }
      }
    }
  }

  // Drag and drop
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

  // Upload PDF
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
      const response = await fetch(
        "http://127.0.0.1:8000/upload-pdf",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Upload failed.");
      }

      setUploadMessage("PDF uploaded successfully!");
      setSelectedFile(null);

      await loadDocuments();
    } catch (error) {
      setUploadMessage(
        error.message || "Something went wrong."
      );
    } finally {
      setUploading(false);
    }
  }

  // Delete document
  async function handleDeleteDocument(documentId, filename) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${filename}"?`
    );

    if (!confirmed) return;

    setDeletingId(documentId);
    setDeleteMessage("");

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/documents/${documentId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Failed to delete document."
        );
      }

      localStorage.removeItem(
        getChatStorageKey(documentId)
      );

      localStorage.removeItem(
        getSessionsStorageKey(documentId)
      );

      if (
        selectedDocument?.document_id === documentId
      ) {
        setSelectedDocument(null);
        setChatMessages([]);
        setSessions([]);
        setSelectedSessionId(null);
        setQuestion("");
        setCopiedIndex(null);
      }

      setDeleteMessage("Document deleted successfully.");

      await loadDocuments();
    } catch (error) {
      setDeleteMessage(
        error.message || "Failed to delete document."
      );
    } finally {
      setDeletingId(null);
    }
  }

  // Ask question
  async function handleChatSubmit(e, suggestedQuestion = "") {
    if (e) e.preventDefault();

    const userQuestion = (
      suggestedQuestion || question
    ).trim();

    if (
      !userQuestion ||
      !selectedDocument ||
      asking
    ) {
      return;
    }

    let activeSessionId = selectedSessionId;

    // Ensure a session exists
    if (!activeSessionId) {
      const newSession = createSession();

      activeSessionId = newSession.id;
      setSelectedSessionId(activeSessionId);

      const updatedSessions = [
        ...sessions,
        newSession,
      ];

      setSessions(updatedSessions);

      saveSessions(
        selectedDocument.document_id,
        updatedSessions
      );
    }

    const userMessage = {
      role: "user",
      text: userQuestion,
    };

    const updatedMessages = [
      ...chatMessages,
      userMessage,
    ];

    setChatMessages(updatedMessages);
    persistSession(
      selectedDocument.document_id,
      activeSessionId,
      updatedMessages
    );

    setQuestion("");
    setAsking(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/ask",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: userQuestion,
            document_id:
              selectedDocument.document_id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Failed to get an answer."
        );
      }

      const assistantMessage = {
        role: "assistant",
        text: data.answer,
        sources: data.sources || [],
      };

      const finalMessages = [
        ...updatedMessages,
        assistantMessage,
      ];

      setChatMessages(finalMessages);

      persistSession(
        selectedDocument.document_id,
        activeSessionId,
        finalMessages
      );
    } catch (error) {
      const errorMessage = {
        role: "assistant",
        text: `**Error:** ${
          error.message || "Unable to get an answer."
        }`,
        sources: [],
      };

      const finalMessages = [
        ...updatedMessages,
        errorMessage,
      ];

      setChatMessages(finalMessages);

      persistSession(
        selectedDocument.document_id,
        activeSessionId,
        finalMessages
      );
    } finally {
      setAsking(false);
    }
  }

  // Copy answer
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

  // Navigate to Documents
  function handleDocumentsView() {
    setActiveView("documents");

    setTimeout(() => {
      documentsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  // Navigate to History
  function handleHistoryView() {
    setActiveView("history");

    setTimeout(() => {
      historySectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  // Generate history from individual sessions
  const historyEntries = documents
    .flatMap((doc) => {
      try {
        const docSessions = loadSessions(
          doc.document_id
        );

        return docSessions
          .filter(
            (session) =>
              session.messages &&
              session.messages.length > 0
          )
          .map((session) => {
            const lastUserMessage = [
              ...session.messages,
            ]
              .reverse()
              .find(
                (message) =>
                  message.role === "user"
              );

            return {
              document: doc,
              session,
              preview:
                lastUserMessage?.text ||
                "Conversation",
              messageCount:
                session.messages.length,
            };
          });
      } catch (error) {
        console.error(
          "Error reading history:",
          error
        );
        return [];
      }
    })
    .sort(
      (a, b) =>
        new Date(
          b.session.updatedAt ||
            b.session.createdAt
        ) -
        new Date(
          a.session.updatedAt ||
            a.session.createdAt
        )
    );

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">✦</div>
          <h2>DocuMind</h2>
        </div>

        <button
          className="new-chat"
          onClick={handleNewChat}
          disabled={!selectedDocument || asking}
          title={
            !selectedDocument
              ? "Select a document first"
              : "Start a new conversation"
          }
        >
          + New Conversation
        </button>

        <div className="sidebar-section">
          <p className="section-label">
            WORKSPACE
          </p>

          <div
            className={`sidebar-item ${
              activeView === "documents"
                ? "active"
                : ""
            }`}
            onClick={handleDocumentsView}
          >
            ▣ Documents
          </div>

          <div
            className={`sidebar-item ${
              activeView === "history"
                ? "active"
                : ""
            }`}
            onClick={handleHistoryView}
          >
            ◷ History
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-item">
            ⚙ Settings
          </div>

          <div className="profile">
            <div className="avatar">C</div>
            <div>
              <p>My Workspace</p>
              <span>Personal Account</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="breadcrumb">
              Workspace /{" "}
              {activeView === "history"
                ? "History"
                : "Documents"}
            </span>
          </div>

          <div className="status">
            <span className="status-dot"></span>
            AI Assistant
          </div>
        </header>

        <div className="content">
          {/* Documents View */}
          {activeView === "documents" && (
            <>
              <div className="welcome">
                <span className="welcome-tag">
                  AI DOCUMENT ASSISTANT
                </span>

                <h1>
                  Your documents,
                  <br />
                  understood.
                </h1>

                <p>
                  Upload your PDFs, ask questions,
                  and get intelligent answers
                  grounded in your documents.
                </p>
              </div>

              {/* Upload Section */}
              <section className="upload-section">
                <div className="section-heading">
                  <h2>Upload a document</h2>
                  <span>PDF files only</span>
                </div>

                <div
                  className={`upload-box ${
                    isDragging ? "dragging" : ""
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="upload-icon">
                    ↑
                  </div>

                  <h3>Drop your PDF here</h3>
                  <p>
                    or browse files from your
                    computer
                  </p>

                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    hidden
                    id="pdf-input"
                    onChange={(e) => {
                      const file =
                        e.target.files[0];

                      if (
                        file &&
                        file.type ===
                          "application/pdf"
                      ) {
                        setSelectedFile(file);
                        setUploadMessage("");
                      } else if (file) {
                        setUploadMessage(
                          "Please select a PDF file."
                        );
                      }
                    }}
                  />

                  <label
                    htmlFor="pdf-input"
                    className="browse-button"
                  >
                    Browse Files
                  </label>

                  {selectedFile && (
                    <p className="selected-file">
                      Selected:{" "}
                      {selectedFile.name}
                    </p>
                  )}

                  <button
                    className="upload-action"
                    onClick={handleUpload}
                    disabled={
                      uploading || !selectedFile
                    }
                  >
                    {uploading
                      ? "Uploading..."
                      : "Upload PDF"}
                  </button>

                  {uploadMessage && (
                    <p className="upload-message">
                      {uploadMessage}
                    </p>
                  )}

                  <span className="upload-hint">
                    Supported format: PDF
                  </span>
                </div>
              </section>

              {/* Documents Section */}
              <section
                className="documents-section"
                ref={documentsSectionRef}
              >
                <div className="section-heading">
                  <h2>Your documents</h2>
                  <span>
                    {documents.length} documents
                  </span>
                </div>

                {deleteMessage && (
                  <p className="delete-message">
                    {deleteMessage}
                  </p>
                )}

                {documents.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">
                      ▤
                    </div>

                    <h3>No documents yet</h3>

                    <p>
                      Upload your first PDF to
                      start asking questions about
                      its contents.
                    </p>
                  </div>
                ) : (
                  <div className="document-list">
                    {documents.map((doc) => (
                      <div
                        className={`document-card ${
                          selectedDocument?.document_id ===
                          doc.document_id
                            ? "selected"
                            : ""
                        }`}
                        key={doc.document_id}
                        onClick={() =>
                          handleSelectDocument(doc)
                        }
                      >
                        <div className="document-icon">
                          PDF
                        </div>

                        <div className="document-info">
                          <h3>{doc.filename}</h3>
                          <p>
                            {doc.total_pages_stored}{" "}
                            pages stored
                          </p>
                        </div>

                        <button
                          className="delete-document"
                          title="Delete document"
                          disabled={
                            deletingId ===
                            doc.document_id
                          }
                          onClick={(e) => {
                            e.stopPropagation();

                            handleDeleteDocument(
                              doc.document_id,
                              doc.filename
                            );
                          }}
                        >
                          {deletingId ===
                          doc.document_id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Chat Section */}
              {selectedDocument && (
                <section
                  className="chat-section"
                  ref={chatSectionRef}
                >
                  <div className="section-heading chat-heading">
                    <div>
                      <h2>
                        Chat with document
                      </h2>
                      <span>
                        {selectedDocument.filename}
                      </span>
                    </div>

                    <button
                      className="clear-chat"
                      onClick={handleNewChat}
                      disabled={asking}
                      title="Start a new conversation"
                    >
                      ↺ New conversation
                    </button>
                  </div>

                  <div className="chat-box">
                    <div className="chat-messages">
                      {chatMessages.length ===
                        0 && !asking ? (
                        <div className="chat-placeholder">
                          <div className="chat-placeholder-icon">
                            ✦
                          </div>

                          <h3>
                            Ask anything about
                            your document
                          </h3>

                          <p>
                            Ask questions and get
                            answers based on{" "}
                            {
                              selectedDocument.filename
                            }
                            .
                          </p>

                          <div className="suggested-questions">
                            <button
                              type="button"
                              onClick={() =>
                                handleChatSubmit(
                                  null,
                                  "Summarize this document."
                                )
                              }
                              disabled={asking}
                            >
                              Summarize this
                              document
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleChatSubmit(
                                  null,
                                  "What are the key topics?"
                                )
                              }
                              disabled={asking}
                            >
                              What are the key
                              topics?
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleChatSubmit(
                                  null,
                                  "Explain the main concepts."
                                )
                              }
                              disabled={asking}
                            >
                              Explain the main
                              concepts
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleChatSubmit(
                                  null,
                                  "What are the important points?"
                                )
                              }
                              disabled={asking}
                            >
                              What are the
                              important points?
                            </button>
                          </div>
                        </div>
                      ) : (
                        chatMessages.map(
                          (message, index) => (
                            <div
                              className={`chat-message ${message.role}`}
                              key={index}
                            >
                              <span className="message-label">
                                {message.role ===
                                "user"
                                  ? "You"
                                  : "DocuMind"}
                              </span>

                              {message.role ===
                              "assistant" ? (
                                <>
                                  <div className="markdown-content">
                                    <ReactMarkdown>
                                      {
                                        message.text
                                      }
                                    </ReactMarkdown>
                                  </div>

                                  <button
                                    className="copy-answer"
                                    onClick={() =>
                                      handleCopyAnswer(
                                        message.text,
                                        index
                                      )
                                    }
                                    title="Copy answer"
                                  >
                                    {copiedIndex ===
                                    index
                                      ? "✓ Copied!"
                                      : "▢ Copy"}
                                  </button>
                                </>
                              ) : (
                                <p>
                                  {message.text}
                                </p>
                              )}

                              {message.sources &&
                                message.sources
                                  .length > 0 && (
                                  <div className="message-sources">
                                    <strong>
                                      Sources
                                    </strong>

                                    {message.sources.map(
                                      (
                                        source,
                                        sourceIndex
                                      ) => (
                                        <div
                                          className="source-item"
                                          key={
                                            sourceIndex
                                          }
                                        >
                                          <span className="source-file">
                                            {
                                              source.filename ||
                                              selectedDocument.filename
                                            }
                                          </span>

                                          <span className="source-page">
                                            Page{" "}
                                            {
                                              source.page
                                            }
                                          </span>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}
                            </div>
                          )
                        )
                      )}

                      {asking && (
                        <div className="chat-message assistant">
                          <span className="message-label">
                            DocuMind
                          </span>

                          <p>
                            Thinking... retrieving
                            relevant information.
                            <span className="thinking-dots">
                              <span></span>
                              <span></span>
                              <span></span>
                            </span>
                          </p>
                        </div>
                      )}

                      <div ref={chatEndRef} />
                    </div>

                    <form
                      className="chat-form"
                      onSubmit={handleChatSubmit}
                    >
                      <input
                        type="text"
                        placeholder="Ask a question about this PDF..."
                        value={question}
                        onChange={(e) =>
                          setQuestion(e.target.value)
                        }
                        disabled={asking}
                      />

                      <button
                        type="submit"
                        disabled={
                          asking ||
                          !question.trim()
                        }
                      >
                        {asking
                          ? "..."
                          : "Send ↑"}
                      </button>
                    </form>
                  </div>
                </section>
              )}
            </>
          )}

          {/* History View */}
          {activeView === "history" && (
            <section
              className="history-section"
              ref={historySectionRef}
            >
              <div className="welcome">
                <span className="welcome-tag">
                  YOUR CONVERSATIONS
                </span>

                <h1>
                  Chat history,
                  <br />
                  revisited.
                </h1>

                <p>
                  Continue where you left off
                  with your previous document
                  conversations.
                </p>
              </div>

              <div className="section-heading">
                <h2>
                  Previous conversations
                </h2>
                <span>
                  {historyEntries.length} conversations
                </span>
              </div>

              {historyEntries.length ===
              0 ? (
                <div className="empty-state history-empty">
                  <div className="empty-icon">
                    ◷
                  </div>

                  <h3>
                    No conversation history
                  </h3>

                  <p>
                    Your conversations will
                    appear here once you start
                    asking questions about your
                    documents.
                  </p>

                  <button
                    className="upload-action"
                    onClick={handleDocumentsView}
                  >
                    Go to Documents
                  </button>
                </div>
              ) : (
                <div className="history-list">
                  {historyEntries.map(
                    (entry) => (
                      <div
                        className="history-card"
                        key={`${entry.document.document_id}_${entry.session.id}`}
                      >
                        <div className="history-card-icon">
                          ◷
                        </div>

                        <div className="history-card-info">
                          <h3>
                            {entry.document.filename}
                          </h3>

                          <p className="history-preview">
                            {entry.session.title ||
                              entry.preview}
                          </p>

                          <span className="history-meta">
                            {entry.messageCount}{" "}
                            messages
                          </span>
                        </div>

                        <div className="history-actions">
                          <button
                            className="history-open"
                            onClick={() =>
                              handleOpenHistory(
                                entry
                              )
                            }
                          >
                            Open →
                          </button>

                          <button
                            className="delete-document"
                            onClick={() =>
                              handleDeleteConversation(
                                entry.document.document_id,
                                entry.session.id
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
