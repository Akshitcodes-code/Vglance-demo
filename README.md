# vGlance - AI-Powered Semantic Video Search Engine

## 🎯 Overview

vGlance is an intelligent video search engine that goes beyond traditional keyword matching. Using advanced AI technologies, it analyzes the actual content of videos - speech, text, and visual elements - to provide semantic search capabilities.

## ✨ Key Features

- **🤖 AI-Powered Analysis**: Uses Whisper for speech-to-text, EasyOCR for text detection, and Gemini AI for semantic understanding
- **⚡ Real-Time Progress**: ChatGPT-like streaming updates with detailed progress indicators
- **🌍 Multilingual Support**: Interface available in 6 languages (English, Hindi, Spanish, French, Tamil, Telugu)
- **🎨 Modern UI**: Responsive design with dark/light theme support
- **🔍 Semantic Search**: Find videos based on actual content, not just titles or tags
- **📊 Confidence Scoring**: AI-provided relevance scores with explanations

## 🏗️ Technical Architecture

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL with connection pooling
- **AI/ML**: 
  - Whisper (OpenAI) for speech transcription
  - EasyOCR for text recognition
  - Gemini AI for semantic analysis
- **Video Processing**: yt-dlp + FFmpeg

### Frontend
- **HTML5**: Semantic structure
- **CSS3**: Custom styling with CSS variables
- **JavaScript**: Vanilla JS with Server-Sent Events (SSE)
- **Icons**: Lucide icon library

### API Endpoints
- `POST /api/search` - Standard search endpoint
- `POST /api/search-stream` - Streaming search with real-time progress
- `GET /api/history` - Retrieve search history
- `DELETE /api/history/{id}` - Delete history item

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- PostgreSQL database
- FFmpeg (for audio processing)
- API keys (YouTube, Gemini)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Akshitcodes-code/Vglance-demo.git
cd Vglance-demo
```

2. **Set up the backend**
```bash
cd backend
pip install -r requirements.txt
```

3. **Configure environment variables**
Create a `.env` file in the backend directory:
```env
DB_PASSWORD=your_postgres_password
YOUTUBE_API_KEY=your_youtube_api_key
GEMINI_API_KEY=your_gemini_api_key
```

4. **Set up the database**
```sql
CREATE DATABASE vglance_db;

CREATE TABLE search_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50),
  query TEXT,
  search_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

5. **Run the application**
```bash
# Start backend
cd backend
python main.py

# Open frontend
# Open Frontend/index.html in your browser
```

## 🎯 Usage

1. **Search**: Enter your query in the search bar
2. **Monitor Progress**: Watch real-time progress updates
3. **View Results**: Browse AI-analyzed video recommendations
4. **Access History**: View previous searches in the sidebar

## 🔧 Key Features Explained

### UI Freezing Fix
The application uses `run_in_threadpool` from Starlette to offload blocking operations (API calls, database operations, AI processing) to a thread pool, keeping the UI responsive during heavy processing.

### Real-Time Progress
Server-Sent Events (SSE) provide streaming updates from backend to frontend, showing detailed progress like ChatGPT:
- YouTube search progress
- Individual video processing status
- Confidence score updates
- Completion status

### AI Pipeline
1. **Audio Extraction**: yt-dlp downloads video, FFmpeg extracts audio
2. **Speech Transcription**: Whisper converts speech to text
3. **Text Detection**: EasyOCR identifies on-screen text
4. **Semantic Analysis**: Gemini AI analyzes content relevance

## 📊 Performance

- **Non-blocking operations** using async/await
- **Connection pooling** for database efficiency
- **Thread pools** for CPU-intensive operations
- **Streaming responses** for better UX

## 🌍 Supported Languages

- English 🇬🇧
- Hindi 🇮🇳
- Spanish 🇪🇸
- French 🇫🇷
- Tamil 🇮🇳
- Telugu 🇮🇳

## 🔮 Future Scope

- Image search and visual similarity
- Video moment detection
- Mobile applications
- Browser extensions
- Enterprise API
- Live video stream analysis

## 📄 License

This project is developed for the Smart India Hackathon 2026.

## 👨‍💻 Development Team

- Anmol verma(Leader) - Frontend 
- Drishti - UI/UX Designer + PPT creator
- Abhay Avasthi - Deployer
- Aman - Debugger 
- Dev - UI/UX Designer
- Ayush Adhikari(Me) - AI/ML + Backend

Built with passion for AI-powered search technology.

---

**Note**: This project uses external APIs (YouTube, Gemini). Ensure you have valid API keys and comply with their respective terms of service.
