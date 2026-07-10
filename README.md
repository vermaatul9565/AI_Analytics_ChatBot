# AI Chatbot with Tavily Web Search (LangGraph + Next.js)

A stateful, tool-calling AI assistant built using the LangGraph framework (FastAPI backend) and a sleek Glassmorphism dashboard UI (Next.js App Router frontend). The chatbot retrieves real-time information from the web using the Tavily Search API.

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
