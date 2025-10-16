from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from langchain_mongodb.vectorstores import MongoDBAtlasVectorSearch
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from pymongo import MongoClient
from dotenv import load_dotenv
import os

# --- Load environment variables ---
load_dotenv()
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB = os.getenv("MONGODB_DB", "my_db")
MONGODB_COLLECTION = os.getenv("MONGODB_COLLECTION", "vector_docs")

# --- FastAPI setup ---
app = FastAPI(title="RAG Chatbot API with MongoDB Atlas")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Connect to MongoDB ---
client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB]
collection = db[MONGODB_COLLECTION]  

# --- Initialize Embeddings ---
embedding = HuggingFaceEmbeddings()

# --- Setup MongoDB Vector Store ---
vector_store = MongoDBAtlasVectorSearch(
    collection=collection,        
    embedding=embedding,
    index_name="vector_index",
)

# --- Setup LLM ---
llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.5)

# --- Conversation Memory ---
memory = ConversationBufferMemory(
    memory_key="chat_history",
    return_messages=True,
    output_key="answer"
)

# --- Retriever and RAG Chain ---
retriever = vector_store.as_retriever()
qa_chain = ConversationalRetrievalChain.from_llm(
    llm=llm,
    retriever=retriever,
    memory=memory,
    return_source_documents=True
)

# --- API Models ---
class ChatRequest(BaseModel):
    query: str

# --- API Endpoints ---
@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    query = request.query.strip()
    response = qa_chain.invoke({"question": query})

    sources = []
    for doc in response.get("source_documents", []):
        file_path = doc.metadata.get("source", "")
        pdf_name = os.path.basename(file_path)
        sources.append({"source": pdf_name})

    return {
        "answer": response.get("answer", ""),
        "sources": sources,
        "chat_history": [
            {"user": msg.content} if msg.type == "human" else {"bot": msg.content}
            for msg in memory.chat_memory.messages
        ],
    }

@app.get("/reset_memory")
async def reset_memory():
    memory.chat_memory.messages = []
    return {"message": "Memory cleared!"}

@app.get("/")
async def root():
    return {"message": "RAG Chatbot (MongoDB Atlas) is running!"}
