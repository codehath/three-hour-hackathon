import React, { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import * as Tone from 'tone';

const instruments = {
  piano: new Tone.Sampler({
    urls: {
      C4: "C4.mp3",
      "D#4": "Ds4.mp3",
      "F#4": "Fs4.mp3",
      A4: "A4.mp3",
    },
    baseUrl: "https://tonejs.github.io/audio/salamander/",
  }).toDestination(),
  synth: new Tone.Synth().toDestination(),
  marimba: new Tone.Sampler({
    urls: {
      C4: "C4.mp3",
    },
    baseUrl: "https://tonejs.github.io/audio/marimba/",
  }).toDestination(),
};

const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];

function App() {
  const videoRef = useRef(null);
  const [selectedInstrument, setSelectedInstrument] = useState('piano');
  const [isPlaying, setIsPlaying] = useState(false);
  const lastPlayedNote = useRef(null);
  const lastPlayTime = useRef(0);

  useEffect(() => {
    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    hands.onResults(onResults);

    if (videoRef.current) {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await hands.send({ image: videoRef.current });
        },
        width: 640,
        height: 480
      });
      camera.start();
    }

    return () => {
      hands.close();
    };
  }, []);

  const onResults = (results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      
      // Calculate average height of fingers (excluding thumb)
      const fingerTips = [8, 12, 16, 20]; // Index, middle, ring, pinky fingertips
      const avgHeight = fingerTips.reduce((sum, tipIdx) => {
        return sum + (1 - landmarks[tipIdx].y);
      }, 0) / fingerTips.length;

      // Map height to note index
      const noteIndex = Math.floor(avgHeight * notes.length);
      const note = notes[Math.min(noteIndex, notes.length - 1)];

      // Check if enough time has passed since last note (100ms minimum)
      const now = Date.now();
      if (now - lastPlayTime.current > 100 && note !== lastPlayedNote.current) {
        const instrument = instruments[selectedInstrument];
        instrument.triggerAttackRelease(note, "8n");
        lastPlayedNote.current = note;
        lastPlayTime.current = now;
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(false);
    }
  };

  return (
    <div>
      <h1>Hand Music Player</h1>
      <div className="video-container">
        <video ref={videoRef} width="640" height="480" />
      </div>
      <div className="controls">
        <select 
          value={selectedInstrument} 
          onChange={(e) => setSelectedInstrument(e.target.value)}
        >
          <option value="piano">Piano</option>
          <option value="synth">Synth</option>
          <option value="marimba">Marimba</option>
        </select>
      </div>
      <div className="status">
        {isPlaying ? "Playing music..." : "Move your hand in front of the camera"}
      </div>
    </div>
  );
}

export default App;
