import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Send, PlusCircle, Trash2, Sun, Moon, Menu } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Typewriter } from "react-simple-typewriter";

const API_URL = import.meta.env.VITE_API_URL;

export default function App() {
  const [messages, setMessages] = useState([]);
  const [references, setReferences] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = localStorage.getItem("chatSessions");
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") || "dark";
    }
    return "dark";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const chatEndRef = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem("chatSessions", JSON.stringify(chatHistory));
  }, [chatHistory]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/chat`, { query: input });

      if (res.data.chat_history?.length > 0) {
        const syncedMessages = res.data.chat_history.map((msg) =>
          msg.user
            ? { sender: "user", text: msg.user }
            : { sender: "bot", text: msg.bot }
        );
        setMessages(syncedMessages);
      } else {
        const botMessage = { sender: "bot", text: res.data.answer };
        setMessages((prev) => [...prev, botMessage]);
      }

      const newRefs = res.data.sources || [];
      setReferences((prev) => {
        const allRefs = [...prev, ...newRefs];
        const uniqueRefs = Array.from(
          new Map(
            allRefs.map((ref) => {
              const key =
                typeof ref === "string"
                  ? ref
                  : ref.source || JSON.stringify(ref);
              return [key, ref];
            })
          ).values()
        );
        return uniqueRefs;
      });

      const title =
        messages[0]?.text.slice(0, 30) || input.slice(0, 30) || "New Chat";

      const updatedSession = {
        id: currentSessionId || Date.now(),
        title,
        messages: res.data.chat_history
          ? res.data.chat_history.map((msg) =>
              msg.user
                ? { sender: "user", text: msg.user }
                : { sender: "bot", text: msg.bot }
            )
          : [...messages, userMessage],
        references: Array.from(
          new Map(
            [...references, ...newRefs].map((ref) => {
              const key =
                typeof ref === "string"
                  ? ref
                  : ref.source || JSON.stringify(ref);
              return [key, ref];
            })
          ).values()
        ),
      };

      if (currentSessionId) {
        setChatHistory((prev) =>
          prev.map((s) => (s.id === currentSessionId ? updatedSession : s))
        );
      } else {
        setChatHistory((prev) => [updatedSession, ...prev.slice(0, 4)]);
        setCurrentSessionId(updatedSession.id);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "❌ Error connecting to backend." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = async () => {
    setMessages([]);
    setReferences([]);
    setCurrentSessionId(null);
    try {
      await axios.get(`${API_URL}/reset_memory`);
    } catch (err) {
      console.error("Failed to reset memory:", err);
    }
  };

  const clearHistory = () => {
    setChatHistory([]);
    localStorage.removeItem("chatSessions");
  };

  const loadChatSession = (session) => {
    setMessages(session.messages);
    setReferences(session.references);
    setCurrentSessionId(session.id);
    setSidebarOpen(false); // Close sidebar on mobile
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className="h-screen flex bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100 transition-colors duration-300 overflow-hidden">
      {/* Sidebar Overlay for mobile */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden transition-opacity ${
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gray-200 dark:bg-gray-950 border-r border-gray-300 dark:border-gray-800 p-4 flex flex-col justify-between z-50 transform lg:transform-none transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:relative lg:translate-x-0`}
      >
        {/* References */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">References</h2>
          <div className="max-h-60 sm:max-h-80 overflow-y-auto space-y-2 pr-2">
            {references.length > 0 ? (
              references.map((ref, idx) => {
                const refName = ref.source || ref;
                return (
                  <div
                    key={idx}
                    className="bg-gray-300 dark:bg-gray-800 px-3 py-2 rounded-xl text-sm truncate hover:bg-gray-400 dark:hover:bg-gray-700 cursor-default"
                    title={refName}
                  >
                    {refName}
                  </div>
                );
              })
            ) : (
              <p className="text-gray-600 dark:text-gray-500 text-sm">
                No references yet
              </p>
            )}
          </div>
        </div>

        {/* Chat History */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Chat History</h2>
            <button
              onClick={clearHistory}
              className="text-gray-600 dark:text-gray-400 hover:text-red-500 transition-colors"
              title="Clear chat history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-60 sm:max-h-80 overflow-y-auto space-y-2 pr-2">
            {chatHistory.length > 0 ? (
              chatHistory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => loadChatSession(item)}
                  className={`cursor-pointer bg-gray-300 dark:bg-gray-800 px-3 py-2 rounded-xl text-sm truncate hover:bg-gray-400 dark:hover:bg-gray-700 ${
                    currentSessionId === item.id ? "ring-2 ring-blue-500" : ""
                  }`}
                  title={item.title}
                >
                  {item.title}
                </div>
              ))
            ) : (
              <p className="text-gray-600 dark:text-gray-500 text-sm">
                No chat history
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col transition-all duration-300">
        {/* Top Bar */}
        <div className="flex justify-between items-center bg-gray-200 dark:bg-gray-950 border-b border-gray-300 dark:border-gray-800 p-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 rounded-lg bg-gray-300 dark:bg-gray-800 hover:bg-gray-400 dark:hover:bg-gray-700 transition"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            <h1 className="text-lg font-semibold flex items-center gap-2">
              📚 BrainyDocs
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-300 dark:bg-gray-800 hover:bg-gray-400 dark:hover:bg-gray-700 transition"
              title="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-yellow-400" />
              ) : (
                <Moon className="w-5 h-5 text-gray-700" />
              )}
            </button>

            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm text-white transition"
            >
              <PlusCircle className="w-4 h-4" />
              New Chat
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="text-center text-gray-500 mt-20 px-4">
              <p className="text-2xl sm:text-3xl font-semibold leading-relaxed">
                ✨ Ask me anything — your documents are full of secrets!<br />
                🔍 I can help you uncover insights, summaries, and hidden gems.<br />
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-xl p-3 rounded-2xl text-sm sm:text-base leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-300 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                }`}
              >
                {msg.sender === "bot" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.text}
                  </ReactMarkdown>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-300 dark:bg-gray-800 text-gray-600 dark:text-gray-400 p-3 rounded-2xl text-sm sm:text-base">
                <Typewriter
                  words={[
                    "Thinking...",
                    "Retrieving context...",
                    "Generating response...",
                  ]}
                  loop
                  cursor
                  cursorStyle="_"
                  typeSpeed={70}
                  deleteSpeed={50}
                  delaySpeed={1000}
                />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Box */}
        <form
          onSubmit={handleSend}
          className="border-t border-gray-300 dark:border-gray-800 p-3 sm:p-4 flex items-center gap-3 bg-gray-200 dark:bg-gray-950 transition-colors"
        >
          <input
            className="flex-1 bg-gray-300 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm sm:text-base"
            type="text"
            placeholder="Ask something..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 p-3 rounded-xl transition disabled:opacity-50"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </form>
      </main>
    </div>
  );
}

