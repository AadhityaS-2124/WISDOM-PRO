# 🎵 WISDOM-PRO

> **AI-Powered Audio Search & Discovery Engine** — Semantic search for your entire audio library using advanced embeddings and vector similarity.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-63.2%25-blue)
![Python](https://img.shields.io/badge/Python-29.5%25-green)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)

---

## 🌟 Overview

**WISDOM-PRO** is a full-stack application that revolutionizes how you search through your audio library. Instead of relying on file names or manual tags, it uses cutting-edge AI embeddings (via CLAP model) to understand audio semantically and find sounds based on their **meaning and characteristics**.

### Key Features

- 🔍 **Semantic Audio Search** — Find sounds by describing what you're looking for, not just filenames
- 🎯 **Intelligent Embeddings** — Powered by CLAP (Contrastive Language-Audio Pre-training)
- 🚀 **High-Performance Indexing** — Fast vector similarity search with Turbovec
- 🎨 **Modern UI** — Responsive React frontend with Tailwind CSS
- 🔌 **RESTful API** — FastAPI backend with CORS support
- 💾 **Persistent Storage** — Metadata and vector index persistence
- 🎛️ **Demo Audio Library** — Auto-generates sample sound loops on startup

---

## 📋 Architecture

```
WISDOM-PRO/
├── frontend/                 # React + TypeScript + Vite
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                  # Python + FastAPI
│   ├── main.py              # FastAPI application & endpoints
│   ├── model.py             # AudioEmbedder class (CLAP + fallback)
│   ├── index_manager.py     # Turbovec index management
│   └── requirements.txt
│
└── audio_library/           # Default audio storage directory
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + TypeScript + Vite | Modern, responsive UI |
| **Styling** | Tailwind CSS + Lucide Icons | Beautiful design system |
| **Backend** | FastAPI + Uvicorn | High-performance async API |
| **AI/ML** | CLAP (Transformers) + PyTorch | Audio/text embeddings |
| **Search** | Turbovec | Fast vector similarity search |
| **Audio** | librosa, soundfile, scipy | Audio processing & synthesis |

---

## 🚀 Getting Started

### Prerequisites

- **Python** 3.9+
- **Node.js** 18+
- **npm** or **pnpm**

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/AadhityaS-2124/WISDOM-PRO.git
cd WISDOM-PRO
```

#### 2. Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

#### 3. Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install
```

### Running the Application

#### Start Backend Server

```bash
cd backend
python main.py
# Server will start at http://127.0.0.1:8000
```

#### Start Frontend Development Server

```bash
cd frontend
npm run dev
# Frontend will start at http://localhost:5173
```

#### Build for Production

```bash
# Frontend
cd frontend
npm run build

# Backend
# Deploy using gunicorn or similar for production
```

---

## 📡 API Endpoints

### Search Audio

```http
POST /search
Content-Type: application/json

{
  "query": "bright energetic hi-hat",
  "k": 5
}
```

**Response:**
```json
{
  "results": [
    {
      "name": "bright_hihat_closed.wav",
      "path": "/path/to/audio",
      "duration": 0.08,
      "samplerate": 44100,
      "channels": 1,
      "score": 0.92
    }
  ]
}
```

### List All Tracks

```http
GET /tracks
```

**Response:**
```json
{
  "tracks": [
    {
      "name": "vintage_kick_loop.wav",
      "duration": 0.3,
      "samplerate": 44100,
      "channels": 1
    }
  ]
}
```

### Add Audio File

```http
POST /add-asset
Content-Type: application/json

{
  "file_path": "/path/to/audio.wav"
}
```

### Ingest Directory

```http
POST /ingest
Content-Type: application/json

{
  "directory": "/path/to/audio/folder"
}
```

### Get Audio File

```http
GET /audio-file?path=/path/to/audio.wav
```

---

## 🎵 Demo Audio Library

WISDOM-PRO automatically generates a demo audio library on first startup with these sound loops:

- 🥁 **Vintage Kick Drum** — Classic 150Hz sweep-to-40Hz kick
- 🎯 **Retro Snare** — Bandpass-filtered noise burst
- ✨ **Bright Hi-Hat** — High-frequency closed hi-hat
- 🎸 **Heavy Vintage Synth Bass** — Low sawtooth bassline
- 🎹 **Melodic Lead Synth** — Square wave arpeggio
- 🌊 **Lush Ambient Pad** — Chorus chord with detuning

All samples are procedurally generated using NumPy and Scipy at 44.1kHz quality.

---

## 🧠 How It Works

### Embedding Process

1. **Audio → Embedding**: Each audio file is processed by the CLAP model to generate a 512-dimensional vector
2. **Text → Embedding**: User queries are converted to embeddings using the same space
3. **Similarity Search**: Turbovec indexes these vectors and finds closest matches using cosine similarity
4. **Ranking**: Results are ranked by score and returned to the frontend

### Fallback Mode

If CLAP model fails to load, the system gracefully falls back to:
- **Filename-based tokenization** with vocabulary projection
- **Acoustic feature analysis** (zero-crossing rate, spectral centroid)
- **Deterministic hashing** for consistent pseudo-random projections

---

## 🛠️ Configuration

### Workspace Directory

Edit `WORKSPACE_DIR` in `backend/main.py`:

```python
WORKSPACE_DIR = "d:\\Wisdom Pro"  # Windows
WORKSPACE_DIR = "/home/user/wisdom-pro"  # Linux/Mac
```

### Audio Library Location

```python
AUDIO_LIBRARY_DIR = os.path.join(WORKSPACE_DIR, "audio_library")
```

### Server Configuration

```python
uvicorn.run(app, host="127.0.0.1", port=8000)
```

---

## 📊 Performance Metrics

| Operation | Time | Notes |
|-----------|------|-------|
| CLAP Model Load | ~5-10s | Background task, async |
| Audio Embedding | ~0.5-1s | Per file |
| Text Embedding | ~0.1-0.2s | Per query |
| Index Search | <10ms | Turbovec optimized |
| Directory Ingest | ~1-2s per file | Parallel capable |

---

## 🔐 Security

- ✅ **Path Validation** — Workspace boundary checks prevent directory traversal
- ✅ **CORS Enabled** — Configurable origins (currently `*` for development)
- ✅ **Type Safety** — Pydantic models for request validation
- ✅ **Error Handling** — Graceful HTTP exceptions

### Production Recommendations

```python
# Update CORS for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
```

---

## 🧪 Testing

```bash
# Backend tests
cd backend
python test_embed.py
python test_search.py

# Frontend tests
cd frontend
npm run lint
npm run build
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 📧 Support & Contact

- **Issues**: [GitHub Issues](https://github.com/AadhityaS-2124/WISDOM-PRO/issues)
- **Discussions**: [GitHub Discussions](https://github.com/AadhityaS-2124/WISDOM-PRO/discussions)
- **Author**: [@AadhityaS-2124](https://github.com/AadhityaS-2124)

---

## 🙏 Acknowledgments

- **CLAP Model** by LAION — [laion/clap-htsat-unfused](https://huggingface.co/laion/clap-htsat-unfused)
- **Turbovec** — Fast vector indexing library
- **FastAPI** — Modern async Python web framework
- **React + Vite** — Next-generation frontend tooling

---

## 📚 Resources

- [CLAP Model Documentation](https://github.com/LAION-AI/CLAP)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

---

<div align="center">

**⭐ If you find this project useful, please consider giving it a star!**

Made with ❤️ by [AadhityaS-2124](https://github.com/AadhityaS-2124)

</div>
