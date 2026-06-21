# Deepfake Forensic Analysis Engine

**CENG 384 — Sinyal İşleme | Mühendislik Bölümü**

Deepfake Forensic Analysis Engine, ses ve video dosyalarında dijital sinyal işleme (DSP) teknikleri kullanarak yapay zeka tarafından üretilmiş (deepfake) içerikleri tespit eden web tabanlı bir adli bilişim aracıdır.

**Ekip:** Kaan Mete Küçük · Ahmet Serdar Erünsal · Berat Yılmaz · Alim Barış Sevindik · Erol Yağız Gemalmaz · Göktuğ Yıldırım

---

## İçindekiler

- [Sistem Mimarisi](#sistem-mimarisi)
- [Uygulanan DSP Algoritmaları](#uygulanan-dsp-algoritmaları)
- [Gereksinimler](#gereksinimler)
- [Kurulum ve Çalıştırma](#kurulum-ve-çalıştırma)
- [API Dokümantasyonu](#api-dokümantasyonu)
- [Karşılanan Fonksiyonel Gereksinimler](#karşılanan-fonksiyonel-gereksinimler)
- [Sonraki Adımlar](#sonraki-adımlar)

---

## Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────┐
│                    launcher.py (GUI)                     │
│         Tkinter arayüzü — tek tıkla başlatma            │
└───────────────────┬─────────────────┬───────────────────┘
                    │                 │
          ┌─────────▼──────┐  ┌──────▼──────────┐
          │  Backend       │  │   Frontend      │
          │  FastAPI       │  │   React + Vite  │
          │  :8000         │  │   :5173         │
          └─────────┬──────┘  └─────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
   ┌────▼────┐ ┌───▼────┐ ┌───▼──────┐
   │  Audio  │ │ Video  │ │  SQLite  │
   │  DSP    │ │  DSP   │ │   DB     │
   │ Pipeline│ │Pipeline│ │ (geçmiş) │
   └─────────┘ └────────┘ └──────────┘
```

### Dosya Yapısı

```
Signal-main/
├── launcher.py                  ← GUI başlatıcı (buradan çalıştır)
├── start.bat                    ← Windows kısayolu
├── .venv/                       ← Python sanal ortamı
│
├── backend/
│   ├── main.py                  ← FastAPI uygulaması + WebSocket
│   ├── database.py              ← SQLite şema (SQLAlchemy)
│   ├── requirements.txt
│   ├── dsp/
│   │   ├── audio_processor.py  ← STFT, MFCC, faz analizi, vocoder
│   │   ├── video_processor.py  ← Yüz tespiti, YCbCr, DCT, Laplacian
│   │   └── aggregator.py       ← Ağırlıklı skor hesaplama
│   └── routers/
│       ├── upload.py           ← Dosya yükleme, analiz başlatma
│       └── history.py          ← Geçmiş, silme, PDF rapor
│
└── deepforensics-ui/
    └── src/
        ├── api.js              ← Backend API istemcisi
        ├── pages/
        │   ├── UploadPage.jsx
        │   ├── ProcessingPage.jsx
        │   ├── ResultsPage.jsx
        │   └── HistoryPage.jsx
        └── components/
            ├── Spectrogram.jsx ← Gerçek STFT verisi ile canvas
            ├── Heatmap.jsx     ← Gerçek DCT verisi ile canvas
            └── AudioDetailTab.jsx
```

---

## Uygulanan DSP Algoritmaları

### Ses İşleme Hattı

| Adım | Algoritma | Parametre |
|------|-----------|-----------|
| Ön vurgu filtresi | 1. dereceden yüksek geçiren filtre | α = 0.97 |
| Çerçeveleme | Hamming penceresi | 25 ms, %50 örtüşme |
| Frekans dönüşümü | STFT (Kısa Zamanlı Fourier) | n_fft = 400 |
| Kepstral analiz | MFCC çıkarma | 13 katsayı |
| Faz sürekliliği | Faz spektrogramı + varyans | Eşik: 0.35 |
| Yüksek frekans | >8 kHz band enerji oranı | Vocoder tespiti |
| Değerlendirme | MFCC vektörü — vokal kanal eşiği | FR-18 |

### Video İşleme Hattı

| Adım | Algoritma | Parametre |
|------|-----------|-----------|
| Kare çıkarma | OpenCV VideoCapture | 30 fps |
| Yüz tespiti | Haar kaskad sınıflandırıcı | minNeighbors=5 |
| Renk uzayı | BGR → YCbCr dönüşümü | Cr kanal analizi |
| Uzamsal DCT | 2B Ayrık Kosinüs Dönüşümü | 8×8 blok |
| HF analizi | DCT AC katsayıları | Yüksek frekans oranı |
| Sınır tespiti | Laplacian filtresi | Yüz çevresi gradyanı |

### Skor Birleştirme

```
Deepfake Olasılığı = 0.45 × ses_skoru + 0.55 × video_skoru

Karar:
  ≥ 70%  →  MUHTEMELEN MANİPÜLE EDİLMİŞ
  40–70% →  BELİRSİZ
  < 40%  →  MUHTEMELEN ÖZGÜN
```

---

## Gereksinimler

| Yazılım | Versiyon | Not |
|---------|----------|-----|
| Python | ≥ 3.9 | `python --version` ile kontrol et |
| Node.js | ≥ 18 | `node --version` ile kontrol et |
| npm | ≥ 8 | Node.js ile birlikte gelir |

Python kütüphaneleri `backend/requirements.txt` dosyasında tanımlıdır. Launcher'ın "Install Dependencies" butonu bunları otomatik kurar.

---

## Kurulum ve Çalıştırma

### Yöntem 1 — GUI Launcher (Önerilen)

```
python launcher.py
```

veya `start.bat` dosyasına çift tıkla.

Açılan pencerede:

1. **"⬇ Install Dependencies"** — ilk kullanımda bağımlılıkları kur
2. **"▶ Start All Services"** — backend ve frontend'i başlat
3. Tarayıcı otomatik açılır (`http://localhost:5173`)

### Yöntem 2 — Manuel (iki ayrı terminal)

**Terminal 1 — Backend:**
```bash
cd Signal-main
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r backend/requirements.txt
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend:**
```bash
cd Signal-main/deepforensics-ui
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` adresini aç.

### İlk Kullanım

1. Ana sayfada **"Try sample file"** butonuna bas → sistem sentetik bir deepfake ses örneği üretir ve analiz eder.
2. Ya da kendi ses/video dosyasını sürükle-bırak ile yükle.
3. Analiz pipeline'ı tamamlanınca sonuçlar otomatik açılır.
4. **"Download PDF"** ile tam adli raporu indir.

---

## API Dokümantasyonu

Backend çalışırken `http://localhost:8000/docs` adresinde Swagger UI ile tüm endpoint'leri interaktif olarak test edebilirsin.

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/upload` | Dosya yükle, analiz başlat |
| `POST` | `/api/sample` | Sentetik demo dosyasını analiz et |
| `GET` | `/api/results/{job_id}` | Tamamlanan analiz sonuçları |
| `GET` | `/api/history` | Tüm analiz geçmişi |
| `DELETE` | `/api/history/{id}` | Kayıt sil |
| `GET` | `/api/report/{job_id}` | PDF rapor indir |
| `WS` | `/ws/{job_id}` | Gerçek zamanlı ilerleme (WebSocket) |
| `GET` | `/api/health` | Sağlık kontrolü |

---

## Karşılanan Fonksiyonel Gereksinimler

### Modül 1 — Veri Girişi ve Ayrıştırma
- **FR-01** Maksimum 2 GB dosya yükleme
- **FR-02** WebSocket ile gerçek zamanlı ilerleme güncellemeleri
- **FR-03** Video dosyasından ses akışı çıkarma (moviepy)
- **FR-04** 16 kHz'e yeniden örnekleme
- **FR-05** Ön vurgu yüksek geçiren filtre (α=0.97)
- **FR-06** 30 fps kare çıkarma

### Modül 2 — Ses DSP Analiz Motoru
- **FR-07** 25 ms Hamming pencereli çerçeveleme
- **FR-08** STFT ile zaman-frekans dönüşümü
- **FR-09** 13 MFCC katsayısı çıkarma
- **FR-10** Faz spektrogramı hesaplama
- **FR-11** Faz varyansı eşik aşımı tespiti
- **FR-12** >8 kHz band analizi (vocoder artefaktı)

### Modül 3 — Video Uzamsal Analiz Motoru
- **FR-13** Haar kaskad ile yüz sınırlama kutusu
- **FR-14** RGB → YCbCr renk uzayı dönüşümü
- **FR-15** 8×8 piksel bloklara 2B DCT uygulaması
- **FR-16** DCT yüksek frekans AC katsayı analizi
- **FR-17** Laplacian filtresi ile harmanlama sınırı tespiti

### Modül 4 — İstatistiksel Birleştirme
- **FR-18** MFCC vektörünün vokal kanal eşiğiyle karşılaştırılması
- **FR-19** Ses ve video zaman damgası korelasyonu
- **FR-20** Ağırlıklı Deepfake Olasılık Skoru hesaplama (0–100%)

### Modül 5 — Görsel Raporlama Paneli
- **FR-21** Etkileşimli ses spektrogramı (Canvas, Viridis paleti)
- **FR-22** DCT ısı haritası video kareleri üzerine bindirme
- **FR-23** Deepfake olasılık skoru gösterimi
- **FR-24** Tam adli PDF raporu oluşturma ve indirme

---

## Sonraki Adımlar

### AI API Entegrasyonu (Sonraki Aşama)

DSP tabanlı skor hesaplamasına ek olarak, büyük dil modeli (LLM) API entegrasyonu planlanmaktadır. Bu entegrasyon:

- DSP bulgularını doğal dil açıklamalarıyla zenginleştirecek
- Analistler için otomatik yorum metni üretecek
- PDF rapora "AI Yorumu" bölümü ekleyecek

**Entegrasyon noktası:** `backend/dsp/aggregator.py` içindeki `build_full_results()` fonksiyonuna yeni bir `ai_analysis` alanı eklenecek. API anahtarı `.env` dosyasında tutulacak.

```python
# backend/.env (henüz oluşturulmadı)
AI_API_KEY=sk-...
AI_MODEL=claude-sonnet-4-6
```

### Diğer Planlanan Geliştirmeler

- [ ] Kullanıcı kimlik doğrulama (JWT)
- [ ] Eş zamanlı 5 dosya işleme (Celery + Redis — NFR-07)
- [ ] HTTPS / TLS desteği (NFR-06)
- [ ] Railway üzerinde bulut dağıtımı
- [ ] Gerçek video örnekleri ile model doğrulama ve eşik ayarlaması
- [ ] Tarayıcı bildirimleri (NFR-04)

---

## Teknoloji Yığını

| Katman | Teknoloji | Amaç |
|--------|-----------|------|
| Frontend | React 18, Vite 5 | Kullanıcı arayüzü |
| Stil | Saf CSS, Canvas API | Görselleştirme |
| Backend | FastAPI, Uvicorn | REST API + WebSocket |
| Veritabanı | SQLite (SQLAlchemy) | Analiz geçmişi |
| Ses DSP | Librosa, NumPy, SciPy | STFT, MFCC, faz |
| Video DSP | OpenCV | Yüz tespiti, DCT, Laplacian |
| Video I/O | MoviePy, imageio-ffmpeg | Ses çıkarma |
| Raporlama | ReportLab | PDF üretimi |
| Başlatıcı | Tkinter | GUI launcher |
