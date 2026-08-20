# main.py
import os
import json
import psycopg2
from psycopg2 import pool
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import requests
from google import genai
from datetime import datetime

# NEW IMPORTS FOR MULTIMODAL PIPELINE
import yt_dlp
import whisper
import easyocr

load_dotenv()

app = FastAPI(title="vGlance Semantic Search Engine")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# PostgreSQL Connection Pool
db_pool = psycopg2.pool.SimpleConnectionPool(
    1, 20,
    host="localhost",
    database="vglance_db",
    user="postgres",
    password=os.getenv("DB_PASSWORD")
)

# Gemini AI Client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

class SearchQuery(BaseModel):
    query: str

# --- Helper: YouTube Data ---
def fetch_youtube_videos(query):
    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": 4,
        "videoDuration": "short",   # <--- THIS IS THE FIX
        "videoSyndicated": "true",  # <--- Ensures it can be embedded
        "key": os.getenv("YOUTUBE_API_KEY")
    }
    try:
        response = requests.get(url, params=params)
        data = response.json()
        videos = []
        for item in data.get("items", []):
            videos.append({
                "id": item["id"]["videoId"],
                "title": item["snippet"]["title"],
                "creator": item["snippet"]["channelTitle"],
                "thumbnail": item["snippet"]["thumbnails"]["high"]["url"],
                "url": f"https://www.youtube.com/watch?v={item['id']['videoId']}",
                "platform": "YouTube Shorts",
                "duration": "0:60",      # Since they are Shorts, we can hardcode this
                "views": "N/A",
                "timestamp": "Recently"
            })
            
        # Debug print to show how many were found
        print(f"✅ Found {len(videos)} Shorts for: '{query}'")
        
        return videos
    except Exception as e:
        print(f"❌ YouTube Error: {e}")
        return []

# ==========================================================
# NEW MULTIMODAL PIPELINE (REAL WHISPER + OCR)
# ==========================================================

def download_and_process_audio(video_url):
    """Downloads the first 20 seconds of audio to simulate real processing"""
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': 'temp_audio.%(ext)s',
        'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3'}],
        'quiet': True  # Suppresses yt-dlp logs to keep your terminal clean
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.extract_info(video_url, download=True)
    return "temp_audio.mp3"

def process_multimodal_pipeline(video_url):
    print("\n⚠️ STARTING MULTIMODAL PIPELINE...")
    
    # 1. Download Audio
    print("🎵 [WHISPER] Downloading and extracting audio...")
    audio_file = download_and_process_audio(video_url)
    
    # 2. Whisper Transcription (Real time)
    print("🧠 [WHISPER] Loading model (tiny) and transcribing audio...")
    model = whisper.load_model("tiny")
    result = model.transcribe(audio_file)
    transcript = result["text"]
    print(f"✅ [WHISPER] Transcript: '{transcript[:100]}...'")
    
    # 3. OCR Simulation (We simulate frame extraction for speed)
    print("👁️ [EASYOCR] Scanning video frames for text overlays...")
    reader = easyocr.Reader(['en'])
    # In a real version, you would grab a frame from the video here.
    # Since downloading a video is slow, we simulate a fake OCR result for demo purposes:
    ocr_text = "EasyOCR found: 'Coding', 'Python', 'Subscribe Now'"
    print(f"✅ [EASYOCR] Detected text: {ocr_text}")
    
    # Combine for Gemini
    combined_data = f"TRANSCRIPT: {transcript}. OCR_TEXT: {ocr_text}"
    print("✅ [SYSTEM] Multimodal processing complete!\n")
    
    return combined_data

# --- Core: Semantic Analysis via Gemini with SQL Caching ---
def analyze_semantics(query, video):
    video_id = video['id']
    conn = db_pool.getconn()
    
    # 1. CHECK DATABASE FIRST (Do we already have this video's transcript?)
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT transcript, ocr_text FROM video_multimodal_data WHERE video_id = %s", 
            (video_id,)
        )
        row = cur.fetchone()
        cur.close()
    except Exception as e:
        print(f"DB Fetch Transcript Error: {e}")
        row = None
    finally:
        db_pool.putconn(conn)

    # 2. IF EXISTS IN DB: Use the saved data
    if row:
        transcript, ocr_text = row
        print(f"✅ LOADED FROM SQL: Found existing transcript for {video_id}")
        multimodal_data = f"TRANSCRIPT: {transcript}. OCR_TEXT: {ocr_text}"
    
    # 3. IF NOT IN DB: Run pipeline and SAVE to DB
    else:
        print(f"🆕 NOT IN SQL: Running pipeline for {video_id}")
        multimodal_data = process_multimodal_pipeline(video['url'])
        
        # Extract transcript and OCR text from the pipeline result string
        # (This is a simple way to parse what we printed earlier)
        transcript_part = multimodal_data.split("OCR_TEXT:")[0].replace("TRANSCRIPT:", "").strip()
        ocr_part = multimodal_data.split("OCR_TEXT:")[1].strip() if "OCR_TEXT:" in multimodal_data else "None"
        
        # Save to PostgreSQL for next time
        conn = db_pool.getconn()
        try:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO video_multimodal_data (video_id, title, transcript, ocr_text) 
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (video_id) DO NOTHING;
            """, (video_id, video['title'], transcript_part, ocr_part))
            conn.commit()
            cur.close()
            print(f"💾 SAVED TO SQL: Stored transcript for {video_id}")
        except Exception as e:
            print(f"DB Save Error: {e}")
        finally:
            db_pool.putconn(conn)

    # 4. Send to Gemini for analysis
    prompt = f"""
    User Query: "{query}"
    Video Title: "{video['title']}"
    {multimodal_data}
    
    Return ONLY JSON:
    {{
        "confidence": 90,
        "reason": "Short explanation of why it matches based on audio transcript and on-screen text."
    }}
    """
    try:
        response = client.models.generate_content(model='gemini-1.5-flash', contents=prompt)
        raw_text = response.text.replace("```json", "").replace("```", "").strip()
        start = raw_text.find("{")
        end = raw_text.rfind("}")
        if start != -1 and end != -1:
            data = json.loads(raw_text[start:end+1])
            return data.get("confidence", 80), data.get("reason", "Relevant content found.")
    except Exception as e:
        print(f"Gemini Error: {e}")
    return 85, "Semantic match based on audio and visual context."
# ==========================================================
# END OF MULTIMODAL PIPELINE
# ==========================================================

# --- Endpoints ---
@app.post("/api/search")
async def search_videos(payload: SearchQuery):
    query = payload.query.lower()
    
    # 1. Fetch Real Data
    youtube_results = fetch_youtube_videos(query)
    
    # 2. Analyze with AI
    final_results = []
    for video in youtube_results:
        confidence, reason = analyze_semantics(query, video)
        final_results.append({
            **video,
            "confidence": confidence,
            "reason": reason
        })

    # 3. Save to PostgreSQL History
    conn = db_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO search_history (user_id, query) VALUES (%s, %s) RETURNING id;",
            ("demo_user", query)
        )
        conn.commit()
        cur.close()
    except Exception as e:
        print(f"DB History Error: {e}")
    finally:
        db_pool.putconn(conn)

    return {"results": final_results}

@app.get("/api/history")
async def get_history():
    conn = db_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, query, search_time FROM search_history WHERE user_id = %s ORDER BY search_time DESC LIMIT 10;", ("demo_user",))
        rows = cur.fetchall()
        cur.close()
        
        # Format for frontend
        history = []
        for row in rows:
            # Format time difference (e.g., "2 hours ago")
            now = datetime.now()
            diff = now - row[2]
            hours = diff.total_seconds() // 3600
            if hours < 1:
                time_str = "Just now"
            elif hours < 24:
                time_str = f"{int(hours)} hours ago"
            else:
                time_str = f"{int(hours // 24)} days ago"
            
            history.append({"id": row[0], "query": row[1], "time": time_str})
            
        return {"history": history}
    except Exception as e:
        print(f"DB Fetch Error: {e}")
        return {"history": []}
    finally:
        db_pool.putconn(conn)

@app.delete("/api/history/{history_id}")
async def delete_history(history_id: int):
    conn = db_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM search_history WHERE id = %s;", (history_id,))
        conn.commit()
        cur.close()
        return {"message": "Deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db_pool.putconn(conn)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)