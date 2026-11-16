# Hermes Media Downloader

A lightweight web application for downloading videos, audio, and playlists from supported platforms using a simple browser interface.

## Requirements

⚠️ **FFmpeg must be installed and available in your system PATH.**

## Installation

Install dependencies:

```bash
pip install -r requirements.txt
```

## Features

- Download videos as MP4
- Download audio as MP3
- MP3 downloads with embedded thumbnails and metadata
- Playlist download support
- Automatic ZIP creation for playlists
- Token-based access control
- Web-based interface

## Run

Start the server:

```bash
python app.py
```

The application runs on port **8765**.

## Access

Open:

```text
http://localhost:8765
```

## Download Modes

- **MP4** – Download video
- **MP3 Full** – Download audio with metadata and cover art
- **MP3 Simple** – Download audio only

## Notes

- FFmpeg is required for audio conversion and thumbnail embedding.
- Playlist downloads are automatically packaged into ZIP files.
- Supported media sources depend on yt-dlp compatibility.

## Password protected

- Default token password is 123