#!/bin/bash

# Create sounds directory if it doesn't exist
mkdir -p sounds

# Clean existing files
rm -f sounds/*.wav sounds/*.mp3

# Download sound effects from pixabay (these are free-to-use sound effects)

# Catch sound (success)
curl -L "https://cdn.pixabay.com/download/audio/2022/03/10/audio_2b8a5872e4.mp3" -o sounds/catch.wav

# Miss sound (error)
curl -L "https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c6c0de.mp3" -o sounds/miss.wav

# Change color sound
curl -L "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3" -o sounds/change.wav

# Game over sound
curl -L "https://cdn.pixabay.com/download/audio/2021/08/04/audio_88347d25d0.mp3" -o sounds/gameOver.wav

# Start game sound
curl -L "https://cdn.pixabay.com/download/audio/2021/08/04/audio_c8633d2b7b.mp3" -o sounds/start.wav

# Background music
curl -L "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0c2f3e011.mp3" -o sounds/bgm.mp3

echo "Sound files downloaded successfully!" 