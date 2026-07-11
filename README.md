# DataMind AI: Stateful Generative UI Analytics Chatbot

DataMind AI is an interactive, stateful AI chatbot application built on the **LangChain / LangGraph** framework (Python FastAPI backend) and a modern, premium **Next.js App Router** frontend (Glassmorphism Dashboard). 

The project's architectural goal is to enable users to interact with their databases, perform analytics, retrieve knowledge from vector databases, and render rich visual charts/widgets directly in the chat feed (Generative UI).

---

## 🗺️ Project Roadmap: Phased Implementation

To build a robust, clean, and easily maintainable codebase, the project is structured into three progressive phases:

### 🚀 Phase 1: Foundation & Web Search (Completed)
*   **Stateful Agent Graph**: Leverages **LangGraph** to model the conversation flow, routing, and tool execution state machine.
*   **Provider-Agnostic LLM Engine**: Implements a clean, decoupled abstraction layer (`LLMFactory`). You can switch between model providers (Google Gemini, OpenAI, Claude, Ollama, Groq, OpenRouter) simply by changing variables in the `.env` file without modifying any core agent code.
*   **Reasoning State Preservation**: Special handling for Gemini's strict `thought_signature` protocol, preventing API validation crashes during multi-turn search tool loops.
*   **Tavily Web Search Integration**: Integrated a web search tool allowing the chatbot to lookup real-time information from the web.
*   **Dynamic Time Injection**: Dynamically injects the user's local date/time into system instructions on every turn.
*   **Containerized Development**: Orchestrated with **Docker Compose** featuring live hot-reloading for both backend and frontend.

### 🔒 Phase 2: Vector Database (RAG) Integration (Upcoming)
*   Integrate a Vector Database (e.g., Qdrant, Pinecone, or Chroma) into the retrieval pipeline.
*   Allow the chatbot to query, retrieve, and ground answers using external proprietary knowledge bases or documentation stores.

### 🔒 Phase 3: Database Analytics & Generative UI (Upcoming)
*   **Structured SQL Querying**: Connect the LangGraph agent to relational databases (e.g., PostgreSQL, BigQuery) to automatically generate and execute SQL queries based on user requests.
*   **Generative UI Engine**: Render customized, interactive React components (bar charts, line graphs, KPI metrics, dynamic data tables) directly in the chat feed instead of plain text, providing a premium, interactive analytical experience.

---

## 🛠️ Prerequisites

To run this project, make sure you have the following installed on your machine:
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (must be running)

---

## 🚀 Quick Start

### 1. Configure Environment Variables
Before running the containers, you need to create a `.env` file for the backend to configure your API keys.

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Copy the example template to create a `.env` file:
   ```bash
   cp .env.example .env
   ```
3. Open `backend/.env` in your text editor and fill in your keys:
   *   `LLM_PROVIDER`: Set to `google` (default), `openai`, etc.
   *   `LLM_MODEL`: Set to `gemini-3.1-flash-lite` (default), or your provider's specific model.
   *   `GOOGLE_API_KEY`: Your Gemini API key from [Google AI Studio](https://aistudio.google.com/).
   *   `TAVILY_API_KEY`: Your search API key from [Tavily](https://tavily.com/).

### 2. Start the Application Stack
Navigate back to the project root directory and start the Docker containers:
```bash
cd ..
docker compose up --build
```
This command builds the frontend and backend images, installs all required packages inside the containers automatically, and runs the servers:
*   **Frontend UI**: [http://localhost:3000/](http://localhost:3000/)
*   **Backend API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

Any changes you make to the local code will automatically trigger hot-reloads inside the running containers!

### 3. Stop the Application
To shut down the servers and clean up container resources, run:
```bash
docker compose down
```
