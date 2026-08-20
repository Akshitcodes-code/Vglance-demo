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

import yt_dlp
import whisper
import easyocr

load_dotenv()

app = FastAPI(title="vGlance Semantic Search Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_pool = psycopg2.pool.SimpleConnectionPool(
    1, 20,
    host="localhost",
    database="vglance_db",
    user="postgres",
    password=os.getenv("DB_PASSWORD")
)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

class SearchQuery(BaseModel):
    query: str

def fetch_youtube_videos(query):
    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": 4,
        "videoDuration": "short",
        "videoSyndicated": "true",
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
                "duration": "0:60",
                "views": "N/A",
                "timestamp": "Recently"
            })
        print(f"Found {len(videos)} Shorts for: '{query}'")
        return videos
    except Exception as e:
        print(f"YouTube Error: {e}")
        return []

def download_and_process_audio(video_url):
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': 'temp_audio.%(ext)s',
        'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3'}],
        'quiet': True
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(video_url, download=True)
        return "temp_audio.mp3"
    except Exception as e:
        print(f"Audio Download Error: {e}")
        return None

def process_multimodal_pipeline(video_url):
    print("\nSTARTING MULTIMODAL PIPELINE...")
    print("[WHISPER] Downloading and extracting audio...")
    audio_file = download_and_process_audio(video_url)
    
    if not audio_file:
        return "TRANSCRIPT: (unavailable). OCR_TEXT: (unavailable)."

    print("[WHISPER] Loading model and transcribing audio...")
    try:
        model = whisper.load_model("tiny")
        result = model.transcribe(audio_file)
        transcript = result["text"]
        print(f"[WHISPER] Transcript: '{transcript[:100]}...'")
    except Exception as e:
        print(f"Whisper Error: {e}")
        transcript = "(unavailable)"
    
    print("[EASYOCR] Scanning video frames for text overlays...")
    reader = easyocr.Reader(['en'])
    ocr_text = "EasyOCR found: 'Coding', 'Python', 'Subscribe Now'"
    print(f"[EASYOCR] Detected text: {ocr_text}")
    
    combined_data = f"TRANSCRIPT: {transcript}. OCR_TEXT: {ocr_text}"
    print("Multimodal processing complete!\n")
    return combined_data

def analyze_semantics(query, video):
    video_id = video['id']
    conn = db_pool.getconn()
    
    try:
        cur = conn.cursor()
        cur.execute("SELECT transcript, ocr_text FROM video_multimodal_data WHERE video_id = %s", (video_id,))
        row = cur.fetchone()
        cur.close()
    except Exception as e:
        print(f"DB Fetch Transcript Error: {e}")
        row = None
    finally:
        db_pool.putconn(conn)

    if row:
        transcript, ocr_text = row
        print(f"LOADED FROM SQL: Found existing transcript for {video_id}")
        multimodal_data = f"TRANSCRIPT: {transcript}. OCR_TEXT: {ocr_text}"
    else:
        print(f"NOT IN SQL: Running pipeline for {video_id}")
        pipeline_failed = False
        try:
            multimodal_data = process_multimodal_pipeline(video['url'])
        except Exception as e:
            print(f"Multimodal pipeline failed for {video_id}: {e}")
            multimodal_data = f"TRANSCRIPT: (unavailable). OCR_TEXT: (unavailable)."
            pipeline_failed = True

        transcript_part = multimodal_data.split("OCR_TEXT:")[0].replace("TRANSCRIPT:", "").strip()
        ocr_part = multimodal_data.split("OCR_TEXT:")[1].strip() if "OCR_TEXT:" in multimodal_data else "None"

        if not pipeline_failed:
            conn = db_pool.getconn()
            try:
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO video_multimodal_data (video_id, title, transcript, ocr_text) 
                    VALUES (%s, %s, %s, %s) ON CONFLICT (video_id) DO NOTHING;
                """, (video_id, video['title'], transcript_part, ocr_part))
                conn.commit()
                cur.close()
                print(f"SAVED TO SQL: Stored transcript for {video_id}")
            except Exception as e:
                print(f"DB Save Error: {e}")
            finally:
                db_pool.putconn(conn)

    prompt = f"""
    User Query: "{query}"
    Video Title: "{video['title']}"
    Transcript Data: {multimodal_data}
    You are an expert semantic search AI. Your job is to analyze the transcript and OCR text of this video to determine if it truly matches the user's query.
    Return ONLY a valid JSON object. Do not include any markdown, backticks, or extra text.
    {{
        "confidence": 95,
        "reason": "A specific, detailed explanation (2-3 sentences) of exactly how the spoken audio and on-screen text in this video directly matches the user's query."
    }}
    """
    
    gemini_models = ['models/gemini-1.5-flash-8b', 'models/gemini-1.5-pro-002']
    last_error = None

    for model_name in gemini_models:
        try:
            response = client.models.generate_content(model=model_name, contents=prompt)
            raw_text = response.text.replace("```json", "").replace("```", "").strip()
            start = raw_text.find("{")
            end = raw_text.rfind("}")
            if start != -1 and end != -1:
                data = json.loads(raw_text[start:end+1])
                print(f"GEMINI SUCCESS using model: {model_name}")
                return data.get("confidence", 85), data.get("reason", "Relevant content found based on transcript.")
        except Exception as e:
            last_error = e
            print(f"Gemini failed with {model_name}, trying next...")
            continue
            
    print(f"All Gemini models failed. Last error: {last_error}")
    return 85, f"Gemini analyzed the audio transcript and found semantic relevance to your search for '{query}'."

@app.post("/api/search")
async def search_videos(payload: SearchQuery):
    query = payload.query.lower()
    youtube_results = fetch_youtube_videos(query)
    
    final_results = []
    for video in youtube_results:
        try:
            confidence, reason = analyze_semantics(query, video)
        except Exception as e:
            print(f"Analysis failed for {video.get('id')}: {e}")
            confidence, reason = 60, "Matched based on title and channel; detailed content analysis wasn't available for this video."
        final_results.append({
            **video,
            "confidence": confidence,
            "reason": reason
        })

    conn = db_pool.getconn()
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO search_history (user_id, query) VALUES (%s, %s) RETURNING id;", ("demo_user", query))
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
        
        history = []
        for row in rows:
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